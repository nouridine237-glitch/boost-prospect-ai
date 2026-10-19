import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Compass, Copy, Loader2, MessageSquareText, ShieldQuestion, SkipForward, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Crm } from "@/components/crm";
import { statusLabels } from "@/components/crm";
import { suggestNextAction } from "@/lib/ai.functions";
import { objections } from "@/lib/objections";
import { buildDailyMissions, cheer, dailyRecap, DEFAULT_COACH, isRestDay, localDay, matchObjectionId, readCoachSettings, type CoachEvent, type Mission, type Priority } from "@/lib/coach";
import { logProspectEvent, onProspectEvent } from "@/lib/prospect-events";

const priorityStyle: Record<Priority, string> = {
  haute: "bg-destructive/15 text-destructive",
  moyenne: "bg-warning/15 text-warning",
  normale: "bg-secondary text-muted-foreground",
};
const interestLabel: Record<number, string> = { 3: "Chaud", 2: "Tiède", 1: "Froid" };

/** Coach du jour : missions et bilan calculés sans IA. L'IA ne part qu'au clic, sous quota. Rien n'est envoyé sans action de l'utilisateur. */
export function CoachCard({ crm, userId }: { crm: Crm; userId: string }) {
  const today = localDay();
  const [events, setEvents] = useState<CoachEvent[]>([]);
  const [goals, setGoals] = useState({ contacts_goal: 10, relances_goal: 5 });
  const [settings, setSettings] = useState(DEFAULT_COACH);
  const [advice, setAdvice] = useState<Record<string, string>>({});

  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const load = () => supabase.from("prospect_events").select("type, content, prospect_id, created_at").gte("created_at", start.toISOString())
      .then(({ data }) => setEvents(data ?? []));
    void load();
    supabase.from("user_goals_weekly").select("contacts_goal, relances_goal").eq("user_id", userId).maybeSingle()
      .then(({ data }) => { if (data) setGoals(data); });
    supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle()
      .then(({ data }) => setSettings(readCoachSettings(data?.preferences)));
    // Conseils IA déjà générés aujourd'hui : relus, jamais régénérés automatiquement.
    supabase.from("ai_generations").select("prospect_id, generated_content").eq("user_id", userId).not("prospect_id", "is", null)
      .gte("created_at", start.toISOString()).order("created_at", { ascending: true })
      .then(({ data }) => { const m: Record<string, string> = {}; (data ?? []).forEach(g => { if (g.prospect_id) m[g.prospect_id] = g.generated_content; }); setAdvice(m); });
    return onProspectEvent(() => { void load(); });
  }, [userId]);

  const rest = isRestDay(today, settings);
  const missions = useMemo(() => buildDailyMissions(crm.prospects, events, today, settings.missions, settings), [crm.prospects, events, today, settings]);
  const recap = useMemo(() => dailyRecap(crm.prospects, events, goals, today), [crm.prospects, events, goals, today]);
  const handled = missions.filter(m => m.done || m.skipped).length;

  return (
    <section className="surface mt-6 rounded-lg">
      <div className="flex items-center gap-3 border-b border-border p-5">
        <span className="grid size-9 place-items-center rounded-md bg-primary/12 text-primary"><Compass className="size-4" /></span>
        <div className="flex-1">
          <h2 className="font-bold">Coach du jour</h2>
          <p className="text-xs text-muted-foreground">{rest ? "Jour de repos" : missions.length ? `${missions.filter(m => m.done).length}/${missions.length} missions faites` : "Aucune mission pour aujourd'hui"}</p>
        </div>
        <Link to="/parametres" className="text-xs font-semibold text-primary">Réglages</Link>
      </div>
      {missions.length > 0 && <div className="h-1.5 bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${(handled / missions.length) * 100}%` }} /></div>}
      {rest ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Jour de repos choisi dans tes réglages. Profite, on reprend demain.</p>
      ) : missions.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Ajoute des prospects ou planifie des relances : le coach te proposera tes priorités ici.</p>
      ) : (
        <ul className="divide-y divide-border">
          {missions.map(m => <MissionRow key={m.prospectId} mission={m} crm={crm} tone={settings.tone} advice={advice[m.prospectId]} onAdvice={t => setAdvice(a => ({ ...a, [m.prospectId]: t }))} />)}
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

function MissionRow({ mission: m, crm, tone, advice, onAdvice }: { mission: Mission; crm: Crm; tone: string; advice: string | undefined; onAdvice: (t: string) => void }) {
  const suggest = useServerFn(suggestNextAction);
  const [loading, setLoading] = useState(false);
  const p = crm.prospects.find(x => x.id === m.prospectId);
  const objection = useMemo(() => { const id = matchObjectionId(p?.main_objection); return id ? objections.find(o => o.id === id) : undefined; }, [p?.main_objection]);
  const context = [
    `Prospect : ${m.name}`, `Situation : ${m.reason}`,
    p ? `Statut : ${statusLabels[p.status]}` : "",
    p?.interest_level ? `Intérêt : ${interestLabel[p.interest_level] ?? ""}` : "",
    p?.product_interest ? `Produit d'intérêt : ${p.product_interest}` : "",
    p?.main_objection ? `Objection : ${p.main_objection}` : "",
    `Ton souhaité : ${tone}. Prépare un message court et respectueux, sans promesse de revenus.`,
  ].filter(Boolean).join("\n").slice(0, 1900);

  async function runAdvice() {
    if (crm.limits.generations >= 0 && crm.monthlyGenerations >= crm.limits.generations) {
      toast.error("Tu as atteint la limite de générations IA de ton plan pour ce mois.", { action: { label: "Abonnement", onClick: () => { window.location.href = "/abonnement"; } } });
      return;
    }
    setLoading(true);
    try {
      const r = await suggest({ data: { prospectId: m.prospectId } });
      onAdvice(r.message);
      crm.setLastMessages(x => ({ ...x, [m.prospectId]: r.message }));
      crm.setGenerationCount(v => v + 1); crm.setMonthlyGenerations(v => v + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(msg.includes("LIMIT_REACHED") ? "Tu as atteint la limite de générations IA de ton plan pour ce mois." : msg || "Le conseil a échoué. Réessaie.");
    } finally { setLoading(false); }
  }
  async function copy(text: string) { await navigator.clipboard.writeText(text); toast.success("Message copié"); }

  return (
    <li className={`p-4 ${m.done || m.skipped ? "opacity-55" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-2 truncate font-semibold ${m.done ? "line-through" : ""}`}>
            {m.name}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityStyle[m.priority]}`}>Priorité {m.priority}</span>
          </p>
          <p className="text-xs text-muted-foreground">{m.skipped ? "Passée" : m.reason}</p>
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link to="/assistant" search={{ context }}><MessageSquareText className="size-4" />Préparer</Link>
        </Button>
        {!advice && <Button size="sm" variant="outline" disabled={loading} onClick={() => void runAdvice()}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Conseil IA</Button>}
        {!m.done && !m.skipped && <>
          <Button size="sm" onClick={() => void logProspectEvent(m.prospectId, "mission_faite", m.reason)}><Check className="size-4" />Fait</Button>
          <Button size="sm" variant="ghost" aria-label="Passer" onClick={() => void logProspectEvent(m.prospectId, "mission_passée", m.reason)}><SkipForward className="size-4" /></Button>
        </>}
      </div>
      {objection && (
        <div className="mt-3 rounded-md border border-border p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><ShieldQuestion className="size-3.5" />Réponse à « {objection.objection} »</p>
          <p className="mt-1">{objection.short}</p>
          <Button size="sm" variant="ghost" className="mt-1 h-7 px-2" onClick={() => void copy(objection.short)}><Copy className="size-3.5" />Copier</Button>
        </div>
      )}
      {advice && (
        <div className="mt-3 rounded-md bg-primary/8 p-3 text-sm">
          <p className="text-xs font-bold text-primary">Conseil IA du jour</p>
          <p className="mt-1 whitespace-pre-line">{advice}</p>
          <Button size="sm" variant="ghost" className="mt-1 h-7 px-2" onClick={() => void copy(advice)}><Copy className="size-3.5" />Copier</Button>
        </div>
      )}
    </li>
  );
}
