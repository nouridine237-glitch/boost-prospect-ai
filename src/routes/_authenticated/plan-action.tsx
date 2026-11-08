import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check, Loader2, Pencil, Target } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { UpgradeCard } from "@/components/plan-gate";
import { useCampaigns } from "@/components/campaign-picker";
import { useActionPlan, type PlanData } from "@/components/action-plan-data";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/use-plan";
import { DEFAULT_COACH, localDay, readCoachSettings } from "@/lib/coach";
import { isActive } from "@/lib/campaigns";
import {
  actionPlanKey, adaptNext, addDays, buildWeeks, canUseActionPlan, capacityOf, conversionRate, GOALS, MINUTES, mondayOf, planDbError, TARGET_LABEL, toTargets, weekStart,
  type Goal, type Minutes, type WeekTargets,
} from "@/lib/action-plan";

export const Route = createFileRoute("/_authenticated/plan-action")({
  head: () => ({ meta: [
    { title: "Plan d'action 30 jours — MLM Boost AI" },
    { name: "description", content: "Un plan d'activité sur 4 semaines, suivi chaque jour avec vos vraies actions." },
    { property: "og:title", content: "Plan d'action 30 jours — MLM Boost AI" },
    { property: "og:description", content: "Objectifs hebdomadaires, suivi quotidien et bilan honnête, sans promesse de revenus." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ActionPlanPage,
});

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const field = "mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-normal";
const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

function ActionPlanPage() {
  const { user } = Route.useRouteContext();
  const plan = usePlan(user.id);
  const allowed = !plan.loading && canUseActionPlan(plan.plan);
  const data = useActionPlan(user.id, !plan.loading);
  const [editing, setEditing] = useState(false);
  const d = data.data;
  const showWizard = allowed && (!d || d.plan.status === "termine" || editing);

  return <AppShell user={user} title="Plan d'action">
    <div className="mx-auto max-w-3xl p-5 lg:p-8">
      <span className="eyebrow">Organisation</span>
      <h1 className="mt-2 text-3xl font-extrabold">Plan d'action 30 jours</h1>
      <p className="mt-2 text-sm text-muted-foreground">Un objectif d'activité sur 4 semaines. Le réalisé est compté à partir de ce que vous faites dans l'app (messages envoyés, relances, statuts marqués publiés). Aucun revenu garanti.</p>
      {plan.loading || data.isLoading ? <p className="mt-6 text-sm text-muted-foreground">Chargement…</p> : <>
        {!allowed && <div className="mt-6"><UpgradeCard minPlan="pro">Le plan d'action 30 jours est inclus dès le plan Pro.</UpgradeCard></div>}
        {data.isError && <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Impossible de charger votre plan. <button className="underline" onClick={() => void data.refetch()}>Réessayer</button></p>}
        {d && d.plan.status === "actif" && !editing && <ActivePlan d={d} userId={user.id} readOnly={!allowed} onEdit={() => setEditing(true)} />}
        {d && d.plan.status === "termine" && !editing && <FinalReview d={d} />}
        {showWizard && <Wizard userId={user.id} existing={editing && d?.plan.status === "actif" ? d : null} onDone={() => setEditing(false)} />}
      </>}
      <p className="mt-8 text-center text-xs text-muted-foreground">Objectifs d'activité, pas de résultats promis. Rien n'est envoyé ni publié automatiquement.</p>
    </div>
  </AppShell>;
}

function Wizard({ userId, existing, onDone }: { userId: string; existing: PlanData | null; onDone: () => void }) {
  const qc = useQueryClient();
  const today = localDay();
  const thisMonday = mondayOf(today);
  const [step, setStep] = useState(existing ? 2 : 1);
  const [goal, setGoal] = useState<Goal>((existing?.plan.goal as Goal) ?? "clients");
  const [target, setTarget] = useState(existing?.plan.target ?? 3);
  const [minutes, setMinutes] = useState<Minutes>((existing?.plan.minutes_per_day as Minutes) ?? 30);
  const [rest, setRest] = useState<number[] | null>(existing?.plan.rest_days ?? null);
  // À partir du vendredi, la semaine en cours est presque finie : on propose lundi prochain par défaut.
  const lateWeek = [0, 5, 6].includes(new Date(`${today}T12:00:00`).getDay());
  const [start, setStart] = useState(existing?.plan.starts_on ?? (lateWeek ? addDays(thisMonday, 7) : thisMonday));
  const [campaign, setCampaign] = useState<string | null>(existing?.plan.campaign_id ?? null);
  const [custom, setCustom] = useState<WeekTargets[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campaigns = useCampaigns(userId);
  const prefs = useQuery({ queryKey: ["coach-settings", userId], queryFn: async () => (await supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle()).data });
  const prospects = useQuery({ queryKey: ["plan-prospects", userId], queryFn: async () => (await supabase.from("prospects").select("status, joined_team_at").eq("user_id", userId)).data ?? [] });
  // Repris du Coach ; si tous les jours y sont en repos, on ne peut pas planifier : on repart de zéro (l'utilisateur choisit).
  const coachRest = prefs.data ? readCoachSettings(prefs.data.preferences).restDays : DEFAULT_COACH.restDays;
  const restDays = rest ?? (coachRest.length <= 6 ? coachRest : []);
  const rate = conversionRate(goal, prospects.data ?? []);
  const built = useMemo(() => buildWeeks(goal, target, minutes, restDays, rate), [goal, target, minutes, restDays, rate?.rate]);
  const weeks = custom ?? built.weeks;
  const reviewed = new Set((existing?.weeks ?? []).filter(w => w.reviewed_at).map(w => w.week_index));

  async function activate() {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const row = { goal, target, minutes_per_day: minutes, rest_days: restDays, starts_on: start, campaign_id: campaign };
      let planId = existing?.plan.id;
      if (planId) {
        const { error: e } = await supabase.from("action_plans").update(row).eq("id", planId).eq("user_id", userId);
        if (e) throw e;
        for (const w of existing!.weeks) {
          if (reviewed.has(w.week_index)) continue;
          const t = weeks[w.week_index - 1]!;
          const { error: e2 } = await supabase.from("action_plan_weeks").update({ contacts_target: t.contacts, relances_target: t.relances, posts_target: t.posts }).eq("id", w.id).eq("user_id", userId);
          if (e2) throw e2;
        }
      } else {
        const { data, error: e } = await supabase.from("action_plans").insert({ ...row, user_id: userId }).select("id").single();
        if (e) throw e;
        planId = data.id;
        const { error: e2 } = await supabase.from("action_plan_weeks").insert(weeks.map((t, i) => ({ plan_id: planId!, user_id: userId, week_index: i + 1, contacts_target: t.contacts, relances_target: t.relances, posts_target: t.posts })));
        if (e2) { await supabase.from("action_plans").delete().eq("id", planId).eq("user_id", userId); throw e2; }
      }
      toast.success(existing ? "Plan mis à jour" : "Plan activé");
      await qc.invalidateQueries({ queryKey: actionPlanKey(userId) });
      onDone();
    } catch (e) { setError(planDbError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? ""))); }
    finally { setSaving(false); }
  }

  const setWeek = (i: number, k: keyof WeekTargets, v: number) => setCustom(weeks.map((w, j) => j === i ? { ...w, [k]: Math.max(0, Math.min(500, Math.round(v) || 0)) } : w));
  return <section className="surface mt-6 rounded-lg p-5">
    <p className="text-xs font-bold uppercase text-muted-foreground">{existing ? "Modifier mon plan" : `Étape ${step}/3`}</p>
    {step === 1 && <div className="mt-3 space-y-3">
      <p className="font-semibold">Quel est votre objectif pour les 30 prochains jours ?</p>
      <div className="grid gap-2">{(Object.keys(GOALS) as Goal[]).map(g => <button key={g} type="button" onClick={() => { setGoal(g); setCustom(null); }} className={`min-h-12 rounded-md border px-4 text-left text-sm font-semibold ${goal === g ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{GOALS[g]}</button>)}</div>
      <label className="block text-sm font-semibold">Nombre de {TARGET_LABEL[goal]}<input type="number" min={1} max={50} value={target} onChange={e => { setTarget(Math.max(1, Math.min(50, Number(e.target.value) || 1))); setCustom(null); }} className={field} /></label>
      <Button className="min-h-11 w-full" onClick={() => setStep(2)}>Continuer</Button>
    </div>}
    {step === 2 && <div className="mt-3 space-y-3">
      {existing && <>
        <div className="grid gap-2">{(Object.keys(GOALS) as Goal[]).map(g => <button key={g} type="button" onClick={() => { setGoal(g); setCustom(null); }} className={`min-h-11 rounded-md border px-4 text-left text-sm font-semibold ${goal === g ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{GOALS[g]}</button>)}</div>
        <label className="block text-sm font-semibold">Nombre de {TARGET_LABEL[goal]}<input type="number" min={1} max={50} value={target} onChange={e => { setTarget(Math.max(1, Math.min(50, Number(e.target.value) || 1))); setCustom(null); }} className={field} /></label>
      </>}
      <p className="font-semibold">Combien de temps par jour ?</p>
      <div className="grid grid-cols-3 gap-2">{MINUTES.map(m => <button key={m} type="button" onClick={() => { setMinutes(m); setCustom(null); }} className={`min-h-11 rounded-md border text-sm font-semibold ${minutes === m ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{m} min</button>)}</div>
      <p className="text-sm font-semibold">Jours de repos</p>
      <div className="flex flex-wrap gap-2">{DAYS.map((l, i) => { const on = restDays.includes(i); return <button key={l} type="button" aria-pressed={on} onClick={() => { const next = on ? restDays.filter(x => x !== i) : [...restDays, i]; if (next.length <= 6) { setRest(next); setCustom(null); } }} className={`min-h-11 min-w-12 rounded-full border px-3 text-sm ${on ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{l}</button>; })}</div>
      <div className="flex gap-2">{!existing && <Button variant="ghost" className="min-h-11" onClick={() => setStep(1)}>Retour</Button>}<Button className="min-h-11 flex-1" onClick={() => setStep(3)}>Continuer</Button></div>
    </div>}
    {step === 3 && <div className="mt-3 space-y-3">
      {!existing && <label className="block text-sm font-semibold">Début du plan<select className={field} value={start} onChange={e => setStart(e.target.value)}>
        <option value={thisMonday}>Cette semaine (lundi {fmt(thisMonday)})</option><option value={addDays(thisMonday, 7)}>Semaine prochaine (lundi {fmt(addDays(thisMonday, 7))})</option></select></label>}
      <label className="block text-sm font-semibold">Campagne liée (facultatif)<select className={field} value={campaign ?? ""} onChange={e => setCampaign(e.target.value || null)}>
        <option value="">Aucune</option>{(campaigns.data ?? []).filter(c => isActive(c, today) || c.id === campaign).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
        {goal === "relancer" ? "Base : environ 2 relances par prospect visé." : rate?.personal
          ? `Base : votre taux réel (${Math.round(rate.rate * 1000) / 10} % sur ${rate.sample} prospects).`
          : `Hypothèse prudente : 1 ${goal === "clients" ? "client pour 20 contacts" : "recrue pour 40 contacts"} (moins de 5 prospects ou aucun résultat enregistré). Ce n'est pas une promesse.`}
        {built.capped && " Votre temps disponible limite le volume : les objectifs ont été plafonnés."}
      </div>
      <p className="text-sm font-semibold">Vos 4 semaines (modifiables)</p>
      <div className="space-y-2">{weeks.map((w, i) => <div key={i} className={`grid grid-cols-4 items-end gap-2 rounded-md bg-secondary/50 p-2 ${reviewed.has(i + 1) ? "opacity-60" : ""}`}>
        <p className="pb-3 text-xs font-bold">S{i + 1}{reviewed.has(i + 1) && " ✓"}</p>
        {(["contacts", "relances", "posts"] as const).map(k => <label key={k} className="text-[11px] text-muted-foreground">{k === "posts" ? "Statuts" : k === "contacts" ? "Contacts" : "Relances"}
          <input type="number" min={0} max={500} disabled={reviewed.has(i + 1)} value={w[k]} onChange={e => setWeek(i, k, Number(e.target.value))} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>)}
      </div>)}</div>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}{/payant/.test(error) && <> <Link to="/abonnement" className="font-semibold underline">Voir les plans</Link></>}</p>}
      <div className="flex gap-2"><Button variant="ghost" className="min-h-11" onClick={() => (existing ? onDone() : setStep(2))} disabled={saving}>{existing ? "Annuler" : "Retour"}</Button>
        <Button className="min-h-11 flex-1" onClick={() => void activate()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{existing ? "Enregistrer" : "Activer mon plan"}</Button></div>
    </div>}
  </section>;
}

function Bar({ label, done, target }: { label: string; done: number; target: number }) {
  const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 100;
  return <div><div className="flex justify-between text-xs"><span>{label}</span><span className="font-semibold">{done}/{target}</span></div>
    <div className="mt-1 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div></div>;
}

function ActivePlan({ d, userId, readOnly, onEdit }: { d: PlanData; userId: string; readOnly: boolean; onEdit: () => void }) {
  const qc = useQueryClient();
  const { plan, weeks, actuals, progress } = d;
  const cur = weeks.find(w => w.week_index === progress.weekIndex);
  const curActual = actuals[progress.weekIndex - 1];
  const pending = weeks.find(w => !w.reviewed_at && (w.week_index < progress.weekIndex || progress.status === "fini"));
  const refresh = () => qc.invalidateQueries({ queryKey: actionPlanKey(userId) });
  async function setStatus(status: "abandonne" | "termine") {
    if (status === "abandonne" && !confirm("Abandonner ce plan ? Il restera dans l'historique.")) return;
    const { error } = await supabase.from("action_plans").update({ status }).eq("id", plan.id).eq("user_id", userId);
    if (error) { toast.error(planDbError(error.message)); return; }
    void refresh();
  }
  async function copyToGoals(t: WeekTargets) {
    const { data } = await supabase.from("user_goals_weekly").select("recrues_goal").eq("user_id", userId).maybeSingle();
    const { error } = await supabase.from("user_goals_weekly").upsert({ user_id: userId, contacts_goal: Math.max(1, t.contacts), relances_goal: Math.max(1, t.relances), recrues_goal: data?.recrues_goal ?? 1 });
    if (error) toast.error("Mise à jour impossible."); else toast.success("Objectifs de la semaine mis à jour");
  }
  return <div className="mt-6 space-y-4">
    <section className="surface rounded-lg p-5">
      <div className="flex items-start justify-between gap-2">
        <div><p className="flex items-center gap-2 font-bold"><Target className="size-4 text-primary" />{GOALS[plan.goal as Goal]} · {plan.target}</p>
          <p className="text-xs text-muted-foreground">Du {fmt(plan.starts_on)} au {fmt(plan.ends_on)} · {plan.minutes_per_day} min/jour</p></div>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{progress.status === "a_venir" ? "Commence lundi" : progress.status === "fini" ? "Terminé" : `Jour ${progress.day}/28`}</span>
      </div>
      {progress.status === "en_cours" && cur && curActual && <>
        <p className="mt-4 text-xs font-bold uppercase text-muted-foreground">Semaine {progress.weekIndex}</p>
        <div className="mt-2 space-y-2"><Bar label="Contacts" done={curActual.contacts} target={cur.contacts_target} /><Bar label="Relances" done={curActual.relances} target={cur.relances_target} /><Bar label="Statuts publiés" done={curActual.posts} target={cur.posts_target} /></div>
        <p className="mt-3 rounded-md bg-secondary/60 p-3 text-sm">{progress.workDaysLeft === 0 ? "Jour de repos : on reprend au prochain jour travaillé." : <>Aujourd'hui : <b>{progress.today.contacts}</b> contact(s), <b>{progress.today.relances}</b> relance(s), <b>{progress.today.posts}</b> statut(s) · {progress.workDaysLeft} jour(s) travaillé(s) restant(s) cette semaine.</>}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="min-h-11"><Link to="/prospects">Mes prospects</Link></Button>
          <Button asChild size="sm" variant="outline" className="min-h-11"><Link to="/planificateur">Planificateur</Link></Button>
          {plan.campaign_id && <Button asChild size="sm" variant="outline" className="min-h-11"><Link to="/campagnes">Ma campagne</Link></Button>}
          {!readOnly && <Button size="sm" variant="ghost" className="min-h-11" onClick={() => void copyToGoals(toTargets(cur))}>Utiliser comme objectifs du Coach</Button>}
        </div>
      </>}
    </section>
    {pending && !readOnly && <WeekReview d={d} week={pending} userId={userId} onDone={() => void refresh()} />}
    <ol className="space-y-2">{weeks.map(w => { const a = actuals[w.week_index - 1]!; return <li key={w.id} className={`surface rounded-lg p-4 ${w.week_index === progress.weekIndex && progress.status === "en_cours" ? "border-primary" : ""}`}>
      <div className="flex justify-between text-sm"><p className="font-semibold">Semaine {w.week_index} · {fmt(weekStart(plan, w.week_index))}</p>{w.reviewed_at && <span className="flex items-center gap-1 text-xs text-primary"><Check className="size-3" />Bilan validé</span>}</div>
      <p className="mt-1 text-xs text-muted-foreground">Prévu → réalisé : contacts {w.contacts_target} → {a.contacts} · relances {w.relances_target} → {a.relances} · statuts {w.posts_target} → {a.posts}{plan.goal === "clients" ? ` · clients ${a.clients}` : plan.goal === "recruter" ? ` · recrues ${a.recrues}` : ""}</p>
      {w.adjusted && w.adjust_note && <p className="mt-1 text-xs text-primary">{w.adjust_note}</p>}
    </li>; })}</ol>
    {!readOnly && <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="min-h-11" onClick={onEdit}><Pencil className="size-4" />Modifier objectif ou disponibilités</Button>
      {progress.status === "fini" && !pending && <Button className="min-h-11" onClick={() => void setStatus("termine")}><CalendarCheck className="size-4" />Clôturer le plan</Button>}
      <Button variant="ghost" className="min-h-11 text-destructive" onClick={() => void setStatus("abandonne")}>Abandonner</Button>
    </div>}
  </div>;
}

function WeekReview({ d, week, userId, onDone }: { d: PlanData; week: PlanData["weeks"][number]; userId: string; onDone: () => void }) {
  const actual = d.actuals[week.week_index - 1]!;
  const next = d.weeks.find(w => w.week_index === week.week_index + 1 && !w.reviewed_at);
  const sugg = next ? adaptNext(toTargets(week), actual, toTargets(next), capacityOf(d.plan)) : null;
  const [prop, setProp] = useState<WeekTargets | null>(sugg?.proposal ?? null);
  const [busy, setBusy] = useState(false);
  async function validate(apply: boolean) {
    setBusy(true);
    try {
      if (apply && next && prop) {
        const { error } = await supabase.from("action_plan_weeks").update({ contacts_target: prop.contacts, relances_target: prop.relances, posts_target: prop.posts, adjusted: true, adjust_note: sugg?.note ?? "Ajusté au bilan." }).eq("id", next.id).eq("user_id", userId);
        if (error) throw error;
      }
      const { error } = await supabase.from("action_plan_weeks").update({ reviewed_at: new Date().toISOString() }).eq("id", week.id).eq("user_id", userId);
      if (error) throw error;
      toast.success("Bilan validé"); onDone();
    } catch (e) { toast.error(planDbError((e as { message?: string })?.message ?? "")); }
    finally { setBusy(false); }
  }
  const rows = [["Contacts", week.contacts_target, actual.contacts], ["Relances", week.relances_target, actual.relances], ["Statuts publiés", week.posts_target, actual.posts]] as const;
  return <section className="surface rounded-lg border-primary p-5">
    <p className="font-bold">Bilan de la semaine {week.week_index}</p>
    <table className="mt-3 w-full text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="text-left">Action</th><th>Prévu</th><th>Réalisé</th></tr></thead>
      <tbody>{rows.map(([l, p, a]) => <tr key={l}><td>{l}</td><td className="text-center">{p}</td><td className={`text-center font-semibold ${a >= p ? "text-primary" : ""}`}>{a}</td></tr>)}</tbody></table>
    <p className="mt-2 text-xs text-muted-foreground">Comptés depuis votre historique dans l'app. Les échanges faits hors de l'app n'apparaissent pas.</p>
    {next && prop && sugg && <div className="mt-3 rounded-md bg-secondary/60 p-3">
      <p className="text-sm font-semibold">Proposition pour la semaine {next.week_index} : {sugg.note}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">{(["contacts", "relances", "posts"] as const).map(k => <label key={k} className="text-[11px] text-muted-foreground">{k === "posts" ? "Statuts" : k === "contacts" ? "Contacts" : "Relances"}
        <input type="number" min={0} max={500} value={prop[k]} onChange={e => setProp({ ...prop, [k]: Math.max(0, Math.min(500, Math.round(Number(e.target.value)) || 0)) })} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>)}</div>
    </div>}
    <div className="mt-3 flex flex-wrap gap-2">
      {next && <Button className="min-h-11" disabled={busy} onClick={() => void validate(true)}>Appliquer et valider</Button>}
      <Button variant={next ? "outline" : "default"} className="min-h-11" disabled={busy} onClick={() => void validate(false)}>{next ? "Garder le plan prévu" : "Valider le bilan"}</Button>
    </div>
  </section>;
}

function FinalReview({ d }: { d: PlanData }) {
  const sum = (k: "contacts" | "relances" | "posts") => d.actuals.reduce((n, a) => n + a[k], 0);
  const plannedSum = (k: "contacts_target" | "relances_target" | "posts_target") => d.weeks.reduce((n, w) => n + w[k], 0);
  const wins = d.actuals.reduce((n, a) => n + (d.plan.goal === "recruter" ? a.recrues : a.clients), 0);
  return <section className="surface mt-6 rounded-lg p-5">
    <p className="font-bold">Bilan de votre dernier plan ({fmt(d.plan.starts_on)} → {fmt(d.plan.ends_on)})</p>
    <p className="mt-2 text-sm">Contacts {sum("contacts")}/{plannedSum("contacts_target")} · Relances {sum("relances")}/{plannedSum("relances_target")} · Statuts {sum("posts")}/{plannedSum("posts_target")}</p>
    {d.plan.goal !== "relancer" && <p className="mt-1 text-sm">{d.plan.goal === "clients" ? "Nouveaux clients enregistrés" : "Recrues enregistrées"} : {wins} (objectif {d.plan.target})</p>}
    <p className="mt-2 text-xs text-muted-foreground">Vous pouvez lancer un nouveau plan ci-dessous.</p>
  </section>;
}
