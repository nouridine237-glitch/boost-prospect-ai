import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function onboardingOptions(userId: string) {
  return queryOptions({
    queryKey: ["onboarding", userId],
    staleTime: 0,
    queryFn: async () => {
      const results = await Promise.all([
        supabase.from("profiles").select("onboarded, onboarding_dismissed").eq("id", userId).maybeSingle(),
        supabase.from("prospects").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("ai_generations").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("prospect_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "message_envoyé"),
      ]);
      for (const result of results) if (result.error) throw result.error;
      return {
        onboarded: results[0].data?.onboarded ?? false,
        dismissed: results[0].data?.onboarding_dismissed ?? false,
        steps: [(results[1].count ?? 0) > 0, (results[2].count ?? 0) > 0, (results[3].count ?? 0) > 0],
      };
    },
  });
}