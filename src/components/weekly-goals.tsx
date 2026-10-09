import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Crm } from "@/components/crm";

type Goals = { contacts_goal: number; relances_goal: number; recrues_goal: number };
const DEFAULTS: Goals = { contacts_goal: 10, relances_goal: 5, recrues_goal: 1 };

/** Lundi 00:00 (heure locale) de la semaine en cours. */
function weekStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function Ring({ value, goal, label, color }: { value: number; goal: number; label: string; color: string }) {
  const r = 42, c = 2 * Math.PI * r;
  const pct = Math.min(1, goal ? value / goal : 0);
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(pct)); return () => cancelAnimationFrame(t); }, [pct]);
  const done = value >= goal;
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative size-28">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-secondary)" strokeWidth="9" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - shown)} className="goal-ring" style={done ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined} />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-lg font-extrabold leading-none">{value}<span className="text-sm font-semibold text-muted-foreground"> / {goal}</span></p>
        </div>
      </div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {done && <p className="text-[11px] font-bold text-success">Objectif atteint ✓</p>}
    </div>
  );
}

export function WeeklyGoalsCard({ crm, userId }: { crm: Crm; userId: string }) {
  const [goals, setGoals] = useState<Goals>(DEFAULTS);
  const [draft, setDraft] = useState<Goals>(DEFAULTS);
  const [editing, setEditing] = useState(false);
  const [events, setEvents] = useState<{ type: string; content: string; prospect_id: string }[]>([]);
  const start = useMemo(weekStart, []);
  const celebrated = useRef<Set<string> | null>(null);

  useEffect(() => {
    supabase.from("user_goals_weekly").select("contacts_goal, relances_goal, recrues_goal").eq("user_id", userId).maybeSingle()
      .then(({ data }) => { if (data) { setGoals(data); setDraft(data); } });
    supabase.from("prospect_events").select("type, content, prospect_id").gte("created_at", start.toISOString())
      .then(({ data }) => setEvents(data ?? []));
  }, [userId, start]);

  const progress = useMemo(() => {
    const createdBefore = new Set(crm.prospects.filter(p => new Date(p.created_at) < start).map(p => p.id));
    const sent = events.filter(e => e.type === "message_envoyé");
    return {
      contacts: new Set(sent.map(e => e.prospect_id)).size,
      relances: sent.filter(e => createdBefore.has(e.prospect_id)).length + events.filter(e => e.type === "relance_reportée").length,
      recrues: events.filter(e => e.type === "changement_statut" && /→\s*Client$/.test(e.content)).length,
    };
  }, [events, crm.prospects, start]);

  // Encouragement une seule fois par objectif et par semaine.
  useEffect(() => {
    const key = `mlm-goals-celebrated-${start.toISOString().slice(0, 10)}`;
    if (!celebrated.current) celebrated.current = new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
    const checks: [string, number, number, string][] = [
      ["contacts", progress.contacts, goals.contacts_goal, "Objectif de prospects contactés atteint ! Continue comme ça 💪"],
      ["relances", progress.relances, goals.relances_goal, "Toutes tes relances de la semaine sont faites. Bravo pour ta régularité 👏"],
      ["recrues", progress.recrues, goals.recrues_goal, "Objectif recrues atteint ! Ton équipe grandit 🎉"],
    ];
    for (const [k, v, g, msg] of checks) {
      if (v >= g && !celebrated.current.has(k)) { celebrated.current.add(k); toast.success(msg, { duration: 6000 }); }
    }
    localStorage.setItem(key, JSON.stringify([...celebrated.current]));
  }, [progress, goals, start]);

  async function save() {
    const clean = (n: number, d: number) => Math.min(1000, Math.max(1, Math.round(n) || d));
    const next = { contacts_goal: clean(draft.contacts_goal, 10), relances_goal: clean(draft.relances_goal, 5), recrues_goal: clean(draft.recrues_goal, 1) };
    const { error } = await supabase.from("user_goals_weekly").upsert({ user_id: userId, ...next });
    if (error) { toast.error("Enregistrement impossible"); return; }
    setGoals(next); setDraft(next); setEditing(false); toast.success("Objectifs enregistrés");
  }

  const end = new Date(start); end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const field = (k: keyof Goals, label: string) => (
    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">{label}
      <Input type="number" min={1} max={1000} value={draft[k]} onChange={e => setDraft(d => ({ ...d, [k]: Number(e.target.value) }))} />
    </label>
  );

  return (
    <section className="surface mt-6 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-primary/12 text-primary"><Target className="size-4" /></span>
          <div><h2 className="font-bold">Objectifs de la semaine</h2><p className="text-xs text-muted-foreground">Du lundi {fmt(start)} au dimanche {fmt(end)} · remise à zéro chaque lundi</p></div>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setDraft(goals); setEditing(!editing); }}><Pencil /> {editing ? "Annuler" : "Modifier"}</Button>
      </div>
      {editing ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          {field("contacts_goal", "Prospects contactés")}{field("relances_goal", "Relances faites")}{field("recrues_goal", "Nouvelles recrues")}
          <Button onClick={save}>Enregistrer</Button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Ring value={progress.contacts} goal={goals.contacts_goal} label="Prospects contactés" color="var(--color-primary)" />
          <Ring value={progress.relances} goal={goals.relances_goal} label="Relances faites" color="var(--color-warning)" />
          <Ring value={progress.recrues} goal={goals.recrues_goal} label="Nouvelles recrues" color="var(--color-success)" />
        </div>
      )}
    </section>
  );
}
