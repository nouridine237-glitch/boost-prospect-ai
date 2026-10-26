import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Flame } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Crm } from "@/components/crm";
import { DEFAULT_COACH, localDay, mondayOf, readCoachSettings, streak, suggestNextGoals, weeklyRecap, type CoachEvent } from "@/lib/coach";
import { onProspectEvent } from "@/lib/prospect-events";

type Goals = { contacts_goal: number; relances_goal: number; recrues_goal: number };
const DEFAULTS: Goals = { contacts_goal: 10, relances_goal: 5, recrues_goal: 1 };

/** Série de jours actifs + bilan de la semaine précédente + objectifs proposés (appliqués uniquement au clic). Sans IA. */
export function CoachWeekCard({ crm, userId }: { crm: Crm; userId: string }) {
  const today = localDay();
  const [events, setEvents] = useState<CoachEvent[]>([]);
  const [goals, setGoals] = useState<Goals>(DEFAULTS);
  const [settings, setSettings] = useState(DEFAULT_COACH);
  const [saving, setSaving] = useState(false);
  const prevMonday = useMemo(() => { const d = new Date(mondayOf(today) + "T12:00:00"); d.setDate(d.getDate() - 7); return localDay(d); }, [today]);

  useEffect(() => {
    const since = new Date(); since.setDate(since.getDate() - 60);
    const load = () => supabase.from("prospect_events").select("type, content, prospect_id, created_at").gte("created_at", since.toISOString())
      .order("created_at", { ascending: false }).limit(5000).then(({ data }) => setEvents(data ?? []));
    void load();
    supabase.from("user_goals_weekly").select("contacts_goal, relances_goal, recrues_goal").eq("user_id", userId).maybeSingle().then(({ data }) => { if (data) setGoals(data); });
    supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle().then(({ data }) => setSettings(readCoachSettings(data?.preferences)));
    return onProspectEvent(() => { void load(); });
  }, [userId]);

  const days = streak(events, today, settings, 60);
  const recap = useMemo(() => weeklyRecap(crm.prospects, events, prevMonday), [crm.prospects, events, prevMonday]);
  const next = suggestNextGoals(goals, recap);
  const changed = next.contacts_goal !== goals.contacts_goal || next.relances_goal !== goals.relances_goal || next.recrues_goal !== goals.recrues_goal;
  const hadActivity = recap.contacts + recap.relances + recap.recrues + recap.missions > 0;
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" });

  async function accept() {
    setSaving(true);
    const { error } = await supabase.from("user_goals_weekly").upsert({ user_id: userId, ...next });
    setSaving(false);
    if (error) { toast.error("Enregistrement impossible"); return; }
    setGoals(next);
    window.dispatchEvent(new CustomEvent("mlm-goals-updated", { detail: next }));
    toast.success("Nouveaux objectifs enregistrés");
  }

  return (
    <section className="surface mt-6 rounded-lg p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md bg-warning/15 text-warning"><Flame className="size-4" /></span>
        <div>
          <h2 className="font-bold">{days > 0 ? `${days} jour${days > 1 ? "s" : ""} d'affilée` : "Lance ta série aujourd'hui"}</h2>
          <p className="text-xs text-muted-foreground">Un jour compte dès qu'un message, une relance ou une mission est faite. Tes jours de repos ne cassent pas la série.</p>
        </div>
      </div>
      <div className="mt-5 rounded-md border border-border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck className="size-4 text-primary" /> Bilan de la semaine dernière</p>
        {hadActivity ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {([["Contacts", recap.contacts, goals.contacts_goal], ["Relances", recap.relances, goals.relances_goal], ["Recrues", recap.recrues, goals.recrues_goal], ["Missions", recap.missions, null]] as const).map(([l, v, g]) => (
                <div key={l} className="rounded-md bg-secondary p-2">
                  <p className="text-lg font-extrabold">{v}{g !== null && <span className="text-xs font-semibold text-muted-foreground"> / {g}</span>}</p>
                  <p className="text-[11px] text-muted-foreground">{l}{g !== null && v >= g ? " ✓" : ""}</p>
                </div>
              ))}
            </div>
            {recap.bestDay && <p className="mt-3 text-xs text-muted-foreground">Meilleur jour : <span className="font-semibold text-foreground">{fmt(recap.bestDay)}</span></p>}
            {changed ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Objectifs proposés : {next.contacts_goal} contacts · {next.relances_goal} relances · {next.recrues_goal} recrue{next.recrues_goal > 1 ? "s" : ""}</p>
                <Button size="sm" onClick={accept} disabled={saving}>Accepter les objectifs proposés</Button>
              </div>
            ) : <p className="mt-3 text-xs text-muted-foreground">On garde les mêmes objectifs cette semaine : la régularité avant tout.</p>}
          </>
        ) : <p className="mt-2 text-xs text-muted-foreground">Pas encore d'activité enregistrée la semaine dernière.</p>}
      </div>
    </section>
  );
}
