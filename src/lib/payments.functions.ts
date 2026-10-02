import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_LIMITS } from "@/lib/admin.functions";

export const PAID_PLANS = {
  pro: { label: "Pro", fcfa: 5000, usd: 8 },
  expert: { label: "Expert", fcfa: 12000, usd: 20 },
  business: { label: "Business", fcfa: 25000, usd: 41 },
} as const;

export type PaidPlanKey = keyof typeof PAID_PLANS;

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Accès réservé aux administrateurs.");
}

const createSchema = z.object({
  plan: z.enum(["pro", "expert", "business"]),
  devise: z.enum(["FCFA", "USD"]),
  reference: z.string().trim().min(3, "Référence de transaction trop courte.").max(120),
  capturePath: z.string().trim().max(400).optional(),
});

export const createPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const plan = PAID_PLANS[data.plan as PaidPlanKey];
    const montant = data.devise === "USD" ? plan.usd : plan.fcfa;

    const { data: existing } = await context.supabase
      .from("payment_requests")
      .select("id")
      .eq("user_id", context.userId)
      .eq("statut", "en_attente")
      .maybeSingle();
    if (existing) {
      return { ok: false as const, reason: "pending" as const };
    }

    const { error } = await context.supabase.from("payment_requests").insert({
      user_id: context.userId,
      plan_demande: data.plan,
      montant,
      devise: data.devise,
      capture_paiement: data.capturePath ?? null,
      reference_transaction: data.reference,
    });
    if (error) throw new Error("L’enregistrement de votre demande a échoué.");

    // Notification admin (best-effort, ne bloque jamais la demande de l'utilisateur)
    try {
      const { notifyAdminOfPaymentRequest } = await import("@/lib/payment-notify.server");
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      await notifyAdminOfPaymentRequest({
        userName: (profile as any)?.full_name || (context.claims as any)?.email || "Utilisateur",
        email: String((context.claims as any)?.email ?? ""),
        plan: plan.label,
        montant: `${montant.toLocaleString("fr-FR")} ${data.devise}`,
        reference: data.reference,
      });
    } catch (e) {
      console.error("[payments] notification admin non envoyée", e);
    }

    return { ok: true as const };
  });

export const getMyPaymentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("payment_requests")
      .select("plan_demande, montant, devise, statut, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { request: (data as any) ?? null };
  });

export type AdminPaymentRow = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  plan: string;
  montant: number;
  devise: string;
  reference: string;
  statut: string;
  captureUrl: string | null;
  createdAt: string;
};

export const listPaymentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ requests: AdminPaymentRow[]; pending: number }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Impossible de charger les demandes de paiement.");

    const list = (rows ?? []) as any[];
    const ids = [...new Set(list.map((r) => r.user_id))];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as any[] };
    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const emailById = new Map<string, string>();
    if (ids.length) {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of authData?.users ?? []) emailById.set(u.id, u.email ?? "");
    }

    const requests: AdminPaymentRow[] = [];
    for (const r of list) {
      let captureUrl: string | null = null;
      if (r.capture_paiement) {
        const { data: signed } = await supabaseAdmin.storage
          .from("payment-proofs")
          .createSignedUrl(r.capture_paiement, 60 * 60);
        captureUrl = signed?.signedUrl ?? null;
      }
      requests.push({
        id: r.id,
        userId: r.user_id,
        userName: (profileById.get(r.user_id) as any)?.full_name || emailById.get(r.user_id) || "Utilisateur",
        email: emailById.get(r.user_id) ?? "—",
        plan: r.plan_demande,
        montant: Number(r.montant),
        devise: r.devise,
        reference: r.reference_transaction,
        statut: r.statut,
        captureUrl,
        createdAt: r.created_at,
      });
    }

    const order: Record<string, number> = { en_attente: 0, valide: 1, refuse: 2 };
    requests.sort((a, b) => (order[a.statut]! - order[b.statut]!) || (a.createdAt < b.createdAt ? 1 : -1));

    return { requests, pending: requests.filter((r) => r.statut === "en_attente").length };
  });

const reviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["valide", "refuse"]),
});

export const reviewPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request } = await supabaseAdmin
      .from("payment_requests")
      .select("id, user_id, plan_demande")
      .eq("id", data.id)
      .maybeSingle();
    if (!request) throw new Error("Demande introuvable.");

    const { error } = await supabaseAdmin
      .from("payment_requests")
      .update({ statut: data.decision as any })
      .eq("id", data.id);
    if (error) throw new Error("La mise à jour de la demande a échoué.");

    if (data.decision === "valide") {
      const plan = (request as any).plan_demande as string;
      const limits = PLAN_LIMITS[plan]!;
      const now = new Date();
      const renew = new Date(now);
      renew.setMonth(renew.getMonth() + 1);
      const payload = {
        plan: plan as any,
        status: "actif" as any,
        limite_prospects: limits.prospects,
        limite_generations_ia: limits.generations,
        date_renouvellement: renew.toISOString(),
        updated_at: now.toISOString(),
      };
      const { data: existing } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("user_id", (request as any).user_id)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin.from("subscriptions").update(payload).eq("id", (existing as any).id);
      } else {
        await supabaseAdmin.from("subscriptions").insert({ user_id: (request as any).user_id, ...payload });
      }
    }

    return { ok: true, statut: data.decision };
  });
