import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GRACE_DAYS, RENEW_WARNING_DAYS, planDef, type PlanKey } from "@/lib/plans";

export type PlanPhase = "free" | "none" | "active" | "expiring" | "grace" | "expired";
export type PlanInfo = {
  plan: PlanKey; // plan effectif (après échéance + grâce)
  rawPlan: PlanKey;
  status: string;
  renewal: string | null;
  phase: PlanPhase;
  loading: boolean;
};

const initial: PlanInfo = { plan: "gratuit", rawPlan: "gratuit", status: "actif", renewal: null, phase: "free", loading: true };
let cache: { userId: string; at: number; promise: Promise<PlanInfo> } | null = null;

async function load(userId: string): Promise<PlanInfo> {
  const [{ data: sub }, { data: eff }] = await Promise.all([
    supabase.from("subscriptions").select("plan, status, date_renouvellement").eq("user_id", userId).maybeSingle(),
    supabase.rpc("effective_plan", { _user_id: userId }),
  ]);
  const rawPlan = planDef(sub?.plan).key;
  const plan = planDef(eff as string).key;
  const renewal = (sub?.date_renouvellement as string | null) ?? null;
  let phase: PlanPhase = "free";
  if (rawPlan !== "gratuit") {
    if (plan === "gratuit") phase = "expired";
    else if (!renewal) phase = "none";
    else {
      const end = new Date(renewal).getTime();
      const now = Date.now();
      if (now > end) phase = "grace";
      else if (end - now <= RENEW_WARNING_DAYS * 86400000) phase = "expiring";
      else phase = "active";
    }
  }
  return { plan, rawPlan, status: sub?.status ?? "actif", renewal, phase, loading: false };
}

export function refreshPlan() { cache = null; }

export function usePlan(userId: string | undefined): PlanInfo {
  const [info, setInfo] = useState<PlanInfo>(initial);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    if (!cache || cache.userId !== userId || Date.now() - cache.at > 60_000) {
      cache = { userId, at: Date.now(), promise: load(userId).catch(() => ({ ...initial, loading: false })) };
    }
    cache.promise.then((v) => { if (active) setInfo(v); });
    return () => { active = false; };
  }, [userId]);
  return info;
}

export function graceEnd(renewal: string) {
  return new Date(new Date(renewal).getTime() + GRACE_DAYS * 86400000);
}
