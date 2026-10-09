import { supabase } from "@/integrations/supabase/client";

export type ProspectEventType = "message_envoyé" | "message_copié" | "changement_statut" | "relance_reportée" | "note_modifiée";

const listeners = new Set<(prospectId: string) => void>();
export function onProspectEvent(fn: (prospectId: string) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export async function logProspectEvent(prospectId: string | null | undefined, type: ProspectEventType, content: string) {
  if (!prospectId) return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  const { error } = await supabase.from("prospect_events").insert({ user_id: userId, prospect_id: prospectId, type, content: content.slice(0, 280) });
  if (!error) listeners.forEach(l => l(prospectId));
}
