import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localDay } from "@/lib/coach";
import { actionPlanKey, addDays, dayProgress, toTargets, weekActuals, weekStart, type Actuals, type DayProgress, type PlanRow, type WeekRow } from "@/lib/action-plan";

export type PlanData = { plan: PlanRow; weeks: WeekRow[]; actuals: Actuals[]; progress: DayProgress };

/** Plan le plus récent (actif en priorité) + réalisés recalculés depuis l'historique, les statuts publiés et les prospects. RLS propriétaire. */
export function useActionPlan(userId: string, enabled = true) {
  return useQuery({
    queryKey: actionPlanKey(userId),
    enabled,
    queryFn: async (): Promise<PlanData | null> => {
      const { data: plans, error } = await supabase.from("action_plans").select("id, goal, target, minutes_per_day, rest_days, starts_on, ends_on, campaign_id, status")
        .eq("user_id", userId).neq("status", "abandonne").order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      const plan = plans?.[0] as PlanRow | undefined;
      if (!plan) return null;
      const since = new Date(`${addDays(plan.starts_on, -1)}T00:00:00`).toISOString();
      const until = new Date(`${addDays(plan.ends_on, 2)}T00:00:00`).toISOString();
      const [w, ev, po, pr] = await Promise.all([
        supabase.from("action_plan_weeks").select("id, plan_id, week_index, contacts_target, relances_target, posts_target, adjusted, adjust_note, reviewed_at").eq("plan_id", plan.id).order("week_index"),
        supabase.from("prospect_events").select("type, content, prospect_id, created_at").eq("user_id", userId).gte("created_at", since).lt("created_at", until).limit(5000),
        supabase.from("content_posts").select("published_at").eq("user_id", userId).eq("status", "publie").gte("published_at", since).lt("published_at", until),
        supabase.from("prospects").select("id, name, status, interest_level, next_followup_date, last_contact_date, created_at, joined_team_at").eq("user_id", userId),
      ]);
      for (const r of [w, ev, po, pr]) if (r.error) throw r.error;
      const weeks = (w.data ?? []) as WeekRow[];
      const events = (ev.data ?? []).map(e => ({ ...e, content: e.content ?? "" }));
      const actuals = [1, 2, 3, 4].map(i => weekActuals(weekStart(plan, i), pr.data ?? [], events, po.data ?? []));
      const today = localDay();
      const probe = dayProgress(today, plan, null, actuals[0]!);
      const idx = probe.weekIndex >= 1 ? probe.weekIndex : 1;
      const cur = weeks.find(x => x.week_index === idx);
      const progress = dayProgress(today, plan, cur ? toTargets(cur) : null, actuals[idx - 1]!);
      return { plan, weeks, actuals, progress };
    },
  });
}
