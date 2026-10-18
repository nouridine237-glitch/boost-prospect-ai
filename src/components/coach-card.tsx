import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Compass, MessageSquareText, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Crm } from "@/components/crm";
import { buildDailyMissions, cheer, dailyRecap, localDay, type CoachEvent } from "@/lib/coach";
import { logProspectEvent, onProspectEvent } from "@/lib/prospect-events";

/** Coach du jour : missions et bilan calculés sans IA. Aucun message n'est envoyé sans action de l'utilisateur. */
export function CoachCard({ crm, userId }: { crm: Crm; userId: string }) {
  const today = localDay();
  const [events, setEvents] = useState<CoachEvent[]>([]);
  const [goals, setGoals] = useState({ contacts_goal: 10, relances_goal: 5 });

  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const load = () => supabase.from("prospect_events").select("type, content, prospect_id, created_at").gte("created_at", start.toISOString())
      .then(({ data }) => setEvents(data ?? []));
    void load();
    supabase.from("user_goals_weekly").select("contacts_goal, relances_goal").eq("user_id", userId).maybeSingle()
      .then(({ data }) => { if (data) setGoals(data); });
    return onProspectEvent(() => { void load(); });
  }, [userId]);

  const missions = useMemo(() => buildDailyMissions(crm.prospects, events, today), [crm.prospects, events, today]);
  const recap = useMemo(() => dailyRecap(crm.prospects, events, goals, today), [crm.prospects, events, goals, today]);
  const handled = missions.filter(m => m.done || m.skipped).length;

  return (
    <section className="surface mt-6 rounded-lg">
      <div className="flex items-center gap-3 border-b border-border p-5">
        <span className="grid size-9 place-items-center rounded-md bg-primary/12 text-primary"><Compass className="size-4" /></span>
        <div className="flex-1">
          <h2 className="font-bold">Coach du jour</h2>
          <p className="text-xs text-muted-foreground">{missions.length ? `${missions.filter(m => m.done).length}/${missions.length} missions faites` : "Aucune mission pour aujourd'hui"}</p>
        </div>
      </div>
      {missions.length > 0 && <div className="h-1.5 bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${(handled / missions.length) * 100}%` }} /></div>}
      {missions.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Ajoute des prospects ou planifie des relances : le coach te proposera tes priorités ici.</p>
      ) : (
        <ul className="divide-y divide-border">
          {missions.map(m => (
            <li key={m.prospectId} className={`flex flex-wrap items-center gap-3 p-4 ${m.done || m.skipped ? "opacity-55" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className={`truncate font-semibold ${m.done ? "line-through" : ""}`}>{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.skipped ? "Passée" : m.reason}</p>
              </div>
              <Button asChild size="sm" variant="secondary">
                <Link to="/assistant" search={{ context: `Prospect : ${m.name}. Situation : ${m.reason}. Prépare un message court et respectueux.` }}><MessageSquareText className="size-4" />Préparer</Link>
              </Button>
              {!m.done && !m.skipped && <>
                <Button size="sm" onClick={() => void logProspectEvent(m.prospectId, "mission_faite", m.reason)}><Check className="size-4" />Fait</Button>
                <Button size="sm" variant="ghost" aria-label="Passer" onClick={() => void logProspectEvent(m.prospectId, "mission_passée", m.reason)}><SkipForward className="size-4" /></Button>
              </>}
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-border p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Bilan du jour</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div><p className="text-xl font-extrabold">{recap.contacts}<span className="text-sm text-muted-foreground"> / {recap.contactsGoal}</span></p><p className="text-xs text-muted-foreground">Contacts</p></div>
          <div><p className="text-xl font-extrabold">{recap.relances}<span className="text-sm text-muted-foreground"> / {recap.relancesGoal}</span></p><p className="text-xs text-muted-foreground">Relances</p></div>
          <div><p className="text-xl font-extrabold">{recap.nouveaux}</p><p className="text-xs text-muted-foreground">Nouveaux</p></div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{cheer(today)}</p>
      </div>
    </section>
  );
}
