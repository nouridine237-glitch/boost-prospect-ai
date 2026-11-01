import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Copy, Loader2, Lock, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { duplicationOptions } from "@/lib/duplication";
import { saveDuplication } from "@/lib/duplication.functions";
import { pathState, type KitId } from "@/lib/duplication-rules";

export const Route = createFileRoute("/_authenticated/duplication")({
  head: () => ({ meta: [
    { title: "Parcours 7 jours & kits — MLM Boost AI" },
    { name: "description", content: "Votre démarrage éthique en sept jours et vos kits de duplication réutilisables." },
    { property: "og:title", content: "Parcours 7 jours & kits — MLM Boost AI" },
    { property: "og:description", content: "Un démarrage structuré, des échanges respectueux et une progression personnelle sauvegardée." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(duplicationOptions(context.user.id)),
  pendingComponent: () => <div role="status" className="flex min-h-64 items-center justify-center gap-2"><Loader2 className="size-5 animate-spin" />Chargement du parcours…</div>,
  errorComponent: ({ reset }) => <div role="alert" className="mx-auto max-w-lg space-y-4 p-8"><h1 className="text-xl font-bold">Le parcours n’a pas pu être chargé</h1><Button onClick={reset}>Réessayer</Button></div>,
  component: DuplicationPage,
});

function DuplicationPage() {
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQuery(duplicationOptions(user.id));
  const client = useQueryClient();
  const save = useServerFn(saveDuplication);
  const state = pathState(data.progress.filter(p => p.track === "path"));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const day = data.days.find(d => d.day === (selectedDay ?? state.currentDay));
  const dayRow = data.progress.find(p => p.track === "path" && p.day === day?.day);
  async function persist(track: "path" | KitId, number: number, actions: number[], complete = false) {
    setBusy(true);
    try {
      await save({ data: { track, day: number, actions, complete } });
      await client.invalidateQueries({ queryKey: duplicationOptions(user.id).queryKey });
      if (complete) { toast.success(track === "path" ? "Journée terminée" : "Kit terminé"); if (track === "path") setSelectedDay(null); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success("Kit copié"); }
    catch { toast.error("Copie impossible. Vous pouvez sélectionner le texte."); }
  }
  return <AppShell user={user} title="Duplication"><div className="mx-auto max-w-5xl p-5 lg:p-8">
    <span className="eyebrow">Démarrage & transmission</span><h1 className="mt-2 text-3xl font-extrabold">Duplication</h1>
    {!data.allowed ? <section className="mt-8 space-y-5 border-y border-border py-8"><Lock className="size-8 text-primary" /><h2 className="text-xl font-bold">Parcours 7 jours & kits</h2><p className="max-w-xl text-muted-foreground">Un démarrage structuré et des modèles pour des conversations respectueuses. Disponibles avec les plans Pro, Expert et Business.</p><Button asChild className="min-h-11"><Link to="/abonnement">Passer au plan Pro<ArrowRight /></Link></Button></section> : <>
      <Tabs defaultValue="path" className="mt-6"><TabsList className="h-11"><TabsTrigger value="path">Parcours 7 jours</TabsTrigger><TabsTrigger value="kits">Kits de duplication</TabsTrigger></TabsList>
        <TabsContent value="path" className="mt-6">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{state.finished ? "Parcours terminé" : state.completedCount ? "Reprendre mon parcours" : "Mon démarrage"}</h2><span className="shrink-0 text-sm text-muted-foreground">{state.completedCount} / 7 jours</span></div>
          <Progress value={state.completedCount / 7 * 100} className="mt-3 h-2" aria-label="Progression du parcours" />
          <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]"><nav aria-label="Journées du parcours" className="flex flex-col gap-2">{data.days.map(d => {
            const done = data.progress.some(p => p.track === "path" && p.day === d.day && p.completed_at);
            return <Button key={d.day} variant={day?.day === d.day ? "secondary" : "ghost"} className="h-auto min-h-11 justify-start whitespace-normal text-left" aria-current={day?.day === d.day ? "step" : undefined} onClick={() => setSelectedDay(d.day)}>{done ? <Check /> : d.day > state.currentDay ? <Lock /> : <RouteIcon />}Jour {d.day} · {d.title}</Button>;
          })}</nav>
          {day ? <section className="min-w-0 border-t border-border pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0"><span className="text-sm font-semibold text-primary">Jour {day.day}{dayRow?.completed_at ? " · Terminé" : ""}</span><h3 className="mt-2 text-2xl font-bold">{day.title}</h3><p className="mt-3 font-medium">{day.objective}</p><p className="mt-3 text-sm leading-7 text-muted-foreground">{day.explanation}</p>
            <div className="my-5 divide-y divide-border">{day.actions.map((action, i) => <label key={action} className="flex min-h-14 cursor-pointer items-start gap-3 py-4 text-sm leading-6"><Checkbox className="mt-1" aria-label={action} checked={dayRow?.checked_actions.includes(i) ?? false} disabled={busy || !!dayRow?.completed_at || day.day > state.currentDay} onCheckedChange={checked => { const current = dayRow?.checked_actions ?? []; void persist("path", day.day, checked === true ? [...current, i] : current.filter(a => a !== i)); }} />{action}</label>)}</div>
            <Button className="min-h-11" disabled={busy || !!dayRow?.completed_at || day.day > state.currentDay || dayRow?.checked_actions.length !== 3} onClick={() => void persist("path", day.day, dayRow?.checked_actions ?? [], true)}>{busy ? <Loader2 className="animate-spin" /> : <Check />}{dayRow?.completed_at ? "Journée terminée" : "Marquer la journée terminée"}</Button>
            {day.day > state.currentDay && <p className="mt-3 text-sm text-muted-foreground">À terminer après le jour {state.currentDay}.</p>}
          </section> : <p>Aucune journée disponible pour le moment.</p>}</div>
          {state.finished && <p role="status" className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">Les sept journées sont terminées. Tes prochaines actions et les kits restent disponibles.</p>}
        </TabsContent>
        <TabsContent value="kits" className="mt-6"><div className="grid items-start gap-5 md:grid-cols-2">{data.kits.map(kit => {
          const row = data.progress.find(p => p.track === kit.id);
          return <article key={kit.id} className="surface min-w-0 rounded-lg p-5"><span className="text-xs font-semibold text-primary">{kit.category}</span><h2 className="mt-2 text-xl font-bold">{kit.title}</h2><p className="mt-2 text-sm text-muted-foreground">{kit.description}</p><div className="mt-4 divide-y divide-border">{kit.items.map((item, i) => <div key={item.title} className="py-4"><label className="flex items-start gap-3"><Checkbox className="mt-1" aria-label={`${kit.title} : ${item.title}`} checked={row?.checked_actions.includes(i) ?? false} disabled={busy || !!row?.completed_at} onCheckedChange={checked => { const current = row?.checked_actions ?? []; void persist(kit.id, 1, checked === true ? [...current, i] : current.filter(a => a !== i)); }} /><span><span className="block text-xs text-muted-foreground">{i + 1}. {item.kind}</span><span className="font-semibold">{item.title}</span></span></label><p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">{item.content}</p></div>)}</div><div className="flex flex-wrap gap-2 border-t border-border pt-4"><Button variant="outline" className="min-h-11" onClick={() => void copy(`${kit.title}\n\n${kit.items.map(i => `${i.title}\n${i.content}`).join("\n\n")}`)}><Copy />Copier le kit</Button><Button className="min-h-11" disabled={busy || !!row?.completed_at || row?.checked_actions.length !== kit.items.length} onClick={() => void persist(kit.id, 1, row?.checked_actions ?? [], true)}><Check />{row?.completed_at ? "Kit terminé" : "Terminer le kit"}</Button></div></article>;
        })}</div>{!data.kits.length && <p>Aucun kit disponible pour le moment.</p>}</TabsContent>
      </Tabs>
    </>}
    <p className="mt-8 text-xs text-muted-foreground">MLM Boost AI est un outil d'aide à la prospection et à la productivité. Aucun revenu n'est garanti.</p>
  </div></AppShell>;
}