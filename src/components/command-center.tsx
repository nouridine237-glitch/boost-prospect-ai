import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Crm } from "@/components/crm";
import { buildDailyMissions, localDay, readCoachSettings, type CoachEvent, type CoachSettings } from "@/lib/coach";
import { stuckProspects } from "@/lib/conversion";
import { listVideoCourses } from "@/lib/academy-video.functions";
import { duplicationOptions } from "@/lib/duplication";
import { hasFeature } from "@/lib/plans";
import { buildBrief, clampRequest, EXAMPLES, MAX_REQUEST, routeRequest, type BriefItem, type CommandAction } from "@/lib/command-center";
import { onProspectEvent } from "@/lib/prospect-events";
import { contentPostsKey, todayReminder } from "@/lib/content-planner";

const linkCls = "group flex min-h-14 items-center justify-between gap-3 rounded-md border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:border-primary/60";

function Row({ title, reason, locked }: { title: string; reason: string; locked?: boolean | undefined }) {
  return <>
    <span className="min-w-0"><span className="flex items-center gap-1.5 text-sm font-semibold">{locked && <Lock className="size-3.5 text-muted-foreground" />}{title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{reason}</span></span>
    <ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
  </>;
}

function BriefLink({ item }: { item: BriefItem }) {
  if (item.id === "coach") return <Link to="/assistant" search={{ context: clampRequest(item.context), mode: "prospection" }} className={linkCls}><Row title={item.title} reason={item.reason} /></Link>;
  if (item.id === "statut") return <Link to="/planificateur" className={linkCls}><Row title={item.title} reason={item.reason} /></Link>;
  if (item.id === "inactif") return <Link to="/prospects" className={linkCls}><Row title={item.title} reason={item.reason} /></Link>;
  if (item.id === "lecon") return <Link to="/academie/cours/$slug" params={{ slug: item.slug }} search={{ l: item.lesson }} className={linkCls}><Row title={item.title} reason={item.reason} /></Link>;
  return <Link to="/duplication" className={linkCls}><Row title={item.title} reason={item.reason} /></Link>;
}

function ActionLink({ a }: { a: CommandAction }) {
  if (a.kind === "objection") return <Link to="/objections" search={a.objectionId ? { o: a.objectionId } : {}} className={linkCls}><Row title={a.label} reason={a.reason} /></Link>;
  if (a.kind === "assistant") return <Link to="/assistant" search={{ context: clampRequest(a.context), mode: a.mode }} className={linkCls}><Row title={a.label} reason={a.reason} /></Link>;
  return <Link to={a.to} className={linkCls}><Row title={a.label} reason={a.reason} locked={a.locked} /></Link>;
}

/** Point d'entrée quotidien : brief (données déjà scopées à l'utilisateur) et orientation locale, sans IA ni envoi. */
export function CommandCenter({ crm, userId }: { crm: Crm; userId: string }) {
  const today = localDay();
  const plan = crm.planInfo.plan;
  const [events, setEvents] = useState<CoachEvent[] | null>(null);
  const [settings, setSettings] = useState<CoachSettings | null>(null);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const load = () => supabase.from("prospect_events").select("type, content, prospect_id, created_at").eq("user_id", userId).gte("created_at", since).order("created_at", { ascending: false }).limit(2000)
      .then(({ data, error }) => { if (!error) setEvents(data ?? []); });
    void load();
    supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle().then(({ data }) => setSettings(readCoachSettings(data?.preferences)));
    return onProspectEvent(() => { void load(); });
  }, [userId]);

  const todayPosts = useQuery({
    queryKey: [...contentPostsKey(userId), "today", today],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_posts").select("planned_on, status, slot").eq("user_id", userId).eq("planned_on", today);
      if (error) throw error;
      return data ?? [];
    },
  });
  const courses = useQuery({ queryKey: ["video-courses"], queryFn: () => listVideoCourses() });
  const dupAllowed = !crm.planInfo.loading && hasFeature(plan, "duplicationPath");
  const dup = useQuery({ ...duplicationOptions(userId), enabled: dupAllowed });

  const brief = useMemo(() => {
    const names = new Map(crm.prospects.map(p => [p.id, p.name]));
    const mission = events && settings ? buildDailyMissions(crm.prospects, events, today, settings.missions, settings).find(m => !m.done && !m.skipped) ?? null : null;
    const stuck = events ? stuckProspects(crm.prospects, events.map(e => ({ ...e, content: e.content ?? "" })), new Date()).stuck.map(s => ({ id: s.id, idleDays: s.idleDays, name: names.get(s.id) ?? "" })).filter(s => s.name) : null;
    return buildBrief({ mission, stuck, statut: todayReminder(todayPosts.data ?? [], today), course: courses.data ?? null, duplication: dupAllowed ? dup.data ?? null : null });
  }, [crm.prospects, events, settings, today, todayPosts.data, courses.data, dup.data, dupAllowed]);

  const actions = useMemo(() => submitted ? routeRequest(submitted, plan) : [], [submitted, plan]);
  const loading = events === null || settings === null;
  const submit = (e: FormEvent) => { e.preventDefault(); setSubmitted(clampRequest(text)); };

  return (
    <section className="surface mt-6 rounded-lg p-5 lg:p-6" aria-labelledby="command-center-title">
      <div className="flex items-center gap-2"><Compass className="size-5 text-primary" /><h2 id="command-center-title" className="text-lg font-bold">Centre de commande</h2></div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <span className="eyebrow">Brief du jour</span>
          <div className="mt-3 grid gap-2">
            {brief.map(item => <BriefLink key={item.id} item={item} />)}
            {!brief.length && <p className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">{loading ? "Préparation de votre brief…" : "Rien d'urgent aujourd'hui. Ajoutez un prospect ou reprenez une formation."}</p>}
          </div>
        </div>
        <div>
          <span className="eyebrow">Que voulez-vous faire ?</span>
          <form onSubmit={submit} className="mt-3 flex gap-2">
            <Input aria-label="Que voulez-vous faire ?" maxLength={MAX_REQUEST} placeholder="Ex. : mon prospect dit que c'est une arnaque" value={text} onChange={e => setText(e.target.value)} className="h-11" />
            <Button type="submit" className="h-11" disabled={!text.trim()}><Sparkles className="size-4" />Orienter</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map(ex => <button key={ex} type="button" onClick={() => { setText(ex); setSubmitted(ex); }} className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">{ex}</button>)}
          </div>
          {actions.length > 0 && <div className="mt-4 grid gap-2" aria-live="polite">{actions.map(a => <ActionLink key={a.id} a={a} />)}</div>}
          <p className="mt-3 text-xs text-muted-foreground">Aucune génération IA ni aucun envoi n'a lieu ici : vous choisissez l'outil, puis vous décidez.</p>
        </div>
      </div>
    </section>
  );
}
