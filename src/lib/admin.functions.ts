import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { PLANS } from "@/lib/plans";

export const PLAN_LIMITS: Record<string, { prospects: number; generations: number; price: number }> = Object.fromEntries(
  Object.values(PLANS).map((p) => [p.key, { prospects: p.prospects, generations: p.generations, price: p.fcfa }]),
);

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
  dateRenouvellement: string | null;
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
      .select("user_id, plan, status, updated_at, date_renouvellement")
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
        dateRenouvellement: s?.date_renouvellement ?? null,
      };
    });
    users.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { users };
  });

const updateSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(["gratuit", "pro", "expert", "business"]),
  status: z.enum(["actif", "expire", "en_attente"]),
  renewal: z.union([z.enum(["extend", "keep", "none"]), z.string().regex(/^\d{4}-\d{2}-\d{2}/)]).default("keep"),
});

export const updateUserSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { applySubscription } = await import("@/lib/subscription.server");
    const renewal = data.renewal === "extend" || data.renewal === "keep" ? data.renewal
      : data.renewal === "none" ? null : new Date(data.renewal.length === 10 ? `${data.renewal}T23:59:59Z` : data.renewal);
    if (renewal instanceof Date && Number.isNaN(renewal.getTime())) throw new Error("Date invalide.");
    const res = await applySubscription(data.userId, data.plan, { status: data.status, renewal });
    return { ok: true, ...res };
  });
