import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { campaignsKey, isActive, type Campaign } from "@/lib/campaigns";
import { localDay } from "@/lib/coach";

export const CAMPAIGN_COLS = "id, name, objective, channel, starts_on, ends_on, note, archived";

/** Campagnes de l'utilisateur (RLS propriétaire). */
export function useCampaigns(userId: string | undefined) {
  return useQuery({
    queryKey: campaignsKey(userId ?? "anon"),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select(CAMPAIGN_COLS).eq("user_id", userId!).order("starts_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });
}

/** Sélecteur facultatif. Propose les campagnes actives + la campagne déjà choisie. */
export function CampaignSelect({ userId, value, onChange, className, label = "Campagne (facultatif)" }: { userId: string; value: string | null; onChange: (id: string | null) => void; className?: string; label?: string }) {
  const q = useCampaigns(userId);
  const today = localDay();
  const options = (q.data ?? []).filter(c => isActive(c, today) || c.id === value);
  return <label className="block text-sm font-semibold">{label}
    <select value={value ?? ""} onChange={e => onChange(e.target.value || null)} className={className ?? "mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"}>
      <option value="">Aucune</option>
      {options.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>;
}
