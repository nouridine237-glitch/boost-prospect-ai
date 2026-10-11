// Écriture des abonnements (serveur uniquement, client privilégié).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nextRenewalDate, planDef } from "@/lib/plans";

/**
 * Applique un plan à un utilisateur en gardant les colonnes limite_* synchronisées.
 * renewal : "extend" = max(échéance future, maintenant) + 1 mois ; "keep" = inchangée ;
 * Date = date fixée ; null = sans échéance.
 */
export async function applySubscription(userId: string, plan: string, opts: { status?: string; renewal: "extend" | "keep" | Date | null }) {
  const def = planDef(plan);
  const { data: existing } = await supabaseAdmin.from("subscriptions").select("id, date_renouvellement").eq("user_id", userId).maybeSingle();
  const current = (existing as any)?.date_renouvellement as string | null | undefined;
  let date: string | null;
  if (def.key === "gratuit") date = null;
  else if (opts.renewal === "extend") date = nextRenewalDate(current).toISOString();
  else if (opts.renewal === "keep") date = current ?? nextRenewalDate(null).toISOString();
  else date = opts.renewal ? opts.renewal.toISOString() : null;
  const now = new Date().toISOString();
  const payload = {
    plan: def.key as any,
    status: (opts.status ?? "actif") as any,
    limite_prospects: def.prospects,
    limite_generations_ia: def.generations,
    date_renouvellement: date,
    updated_at: now,
  };
  if (existing) {
    const { error } = await supabaseAdmin.from("subscriptions").update(payload).eq("id", (existing as any).id);
    if (error) throw new Error("La mise à jour de l’abonnement a échoué.");
  } else {
    const { error } = await supabaseAdmin.from("subscriptions").insert({ user_id: userId, ...payload });
    if (error) throw new Error("La création de l’abonnement a échoué.");
  }
  return { updatedAt: now, dateRenouvellement: date };
}
