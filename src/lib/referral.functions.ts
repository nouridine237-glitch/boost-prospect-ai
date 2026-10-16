import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MONTHLY_CAP = 3;
const BONUS_CAP = 30;

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function maskEmail(email: string) {
  const [u = "", d = ""] = email.split("@");
  return `${u.slice(0, 2)}***@${d}`;
}

function monthStart() {
  const d = new Date();
  d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Rattache l'utilisateur connecté au parrain du code (une seule fois, compte récent, pas d'auto-parrainage). */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const createdAt = u.user?.created_at ? new Date(u.user.created_at).getTime() : 0;
    if (!createdAt || Date.now() - createdAt > 7 * 86400000) return { ok: false, reason: "compte_ancien" };
    const { data: owner } = await supabaseAdmin.from("referral_codes").select("user_id").eq("code", data.code).maybeSingle();
    if (!owner) return { ok: false, reason: "code_inconnu" };
    if (owner.user_id === context.userId) return { ok: false, reason: "auto_parrainage" };
    const { error } = await supabaseAdmin.from("referrals").insert({ referrer_id: owner.user_id, referred_id: context.userId, status: "inscrit" });
    if (error) return { ok: false, reason: "deja_parraine" };
    return { ok: true, reason: "" };
  });

export const getMyReferral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let { data: row } = await context.supabase.from("referral_codes").select("code").eq("user_id", context.userId).maybeSingle();
    for (let i = 0; !row && i < 5; i++) {
      const code = randomCode();
      const { error } = await supabaseAdmin.from("referral_codes").insert({ user_id: context.userId, code });
      if (!error) row = { code };
      else {
        const { data: again } = await supabaseAdmin.from("referral_codes").select("code").eq("user_id", context.userId).maybeSingle();
        if (again) row = again;
      }
    }
    if (!row) throw new Error("Impossible de créer ton code de parrainage.");

    const [{ data: refs }, { data: rewards }] = await Promise.all([
      context.supabase.from("referrals").select("id, referred_id, status, created_at, rewarded, reward_note").eq("referrer_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("referral_rewards").select("type, value, expires_at, created_at").eq("user_id", context.userId),
    ]);
    const ids = (refs ?? []).map((r) => r.referred_id);
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
      for (const p of profs ?? []) { const first = (p.full_name ?? "").trim().split(/\s+/)[0]; if (first) names[p.id] = first; }
      await Promise.all(ids.filter((id) => !names[id]).map(async (id) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
        names[id] = u.user?.email ? maskEmail(u.user.email) : "Filleul";
      }));
    }
    const ms = monthStart();
    const { count: monthCount } = await context.supabase.from("referrals").select("id", { count: "exact", head: true })
      .eq("referrer_id", context.userId).eq("rewarded", true).gte("validated_at", ms);
    const bonusMonth = (rewards ?? []).filter((r) => r.type === "ai_bonus" && r.created_at >= ms).reduce((s, r) => s + r.value, 0);
    const trialUntil = (rewards ?? []).filter((r) => r.type === "pro_trial" && r.expires_at).map((r) => r.expires_at as string).sort().pop() ?? null;
    return {
      code: row.code,
      referrals: (refs ?? []).map((r) => ({ id: r.id, name: names[r.referred_id] ?? "Filleul", status: r.status, createdAt: r.created_at, rewarded: r.rewarded, capped: r.reward_note === "plafond_mensuel" })),
      stats: {
        inscrits: (refs ?? []).length,
        valides: (refs ?? []).filter((r) => r.status === "valide").length,
        rewardsMonth: monthCount ?? 0, rewardsCap: MONTHLY_CAP, bonusMonth, bonusCap: BONUS_CAP,
      },
      trialUntil: trialUntil && new Date(trialUntil).getTime() > Date.now() ? trialUntil : null,
    };
  });
