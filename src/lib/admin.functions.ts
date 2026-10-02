import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PLAN_LIMITS: Record<string, { prospects: number; generations: number; price: number }> = {
  gratuit: { prospects: 10, generations: 5, price: 0 },
  pro: { prospects: -1, generations: 100, price: 5000 },
  expert: { prospects: -1, generations: -1, price: 12000 },
  business: { prospects: -1, generations: -1, price: 25000 },
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Accès réservé aux administrateurs.");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string;
  fullName: string;
  displayName: string;
  plan: string;
  status: string;
  updatedAt: string | null;
};

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ users: AdminUserRow[] }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authData, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error("Impossible de charger la liste des comptes.");

    const ids = authData.users.map((u) => u.id);
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, display_name").in("id", ids);
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan, status, updated_at")
      .in("user_id", ids);

    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const subByUser = new Map((subs ?? []).map((s: any) => [s.user_id, s]));

    const users = authData.users.map((u) => {
      const p: any = profileById.get(u.id);
      const s: any = subByUser.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "—",
        createdAt: u.created_at,
        fullName: p?.full_name ?? "",
        displayName: p?.display_name ?? "",
        plan: s?.plan ?? "gratuit",
        status: s?.status ?? "actif",
        updatedAt: s?.updated_at ?? null,
      };
    });
    users.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { users };
  });

const updateSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(["gratuit", "pro", "expert", "business"]),
  status: z.enum(["actif", "expire", "en_attente"]),
});

export const updateUserSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limits = PLAN_LIMITS[data.plan]!;

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();

    const payload = {
      plan: data.plan as any,
      status: data.status as any,
      limite_prospects: limits.prospects,
      limite_generations_ia: limits.generations,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabaseAdmin.from("subscriptions").update(payload).eq("id", (existing as any).id);
      if (error) throw new Error("La mise à jour de l’abonnement a échoué.");
    } else {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .insert({ user_id: data.userId, ...payload });
      if (error) throw new Error("La création de l’abonnement a échoué.");
    }
    return { ok: true, updatedAt: payload.updated_at };
  });
