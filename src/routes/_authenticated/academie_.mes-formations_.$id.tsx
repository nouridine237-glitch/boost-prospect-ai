import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArrowLeft, ChevronDown, Clock, Eye, Film, Layers, Pencil, Plus, Share2, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorLine } from "@/components/videotheque/academy-tabs";
import { ShareSheet } from "@/components/videotheque/share-sheet";
import { LessonRow, ModuleSection, PublishBar, Thumb, VideoPicker } from "@/components/videotheque/course-editor-bits";
import { CourseStatusBadge, StatusBadge } from "@/components/videotheque/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { canRevoke, formatTotal, groupByModule, GRANT_STATUS_LABEL, vtError } from "@/lib/videotheque";
import { archiveCourse, archiveCourseLesson, getCourseEditor, moveCourseLesson, publishCourse, revokeGrant, saveCourseLesson, saveCourseMeta, setGrantReshare } from "@/lib/videotheque.functions";

export const Route = createFileRoute("/_authenticated/academie_/mes-formations_/$id")({
  head: () => ({ meta: [
    { title: "Éditeur de formation — MLM Boost AI" },
    { name: "description", content: "Modules, leçons, publication et partage de ta formation vidéo." },
    { property: "og:title", content: "Éditeur de formation — MLM Boost AI" },
    { property: "og:description", content: "Organise tes leçons vidéo et partage-les avec ton équipe." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: EditorPage,
});

type LessonDraft = { id?: string; title: string; summary: string; module: string; videoId: string };

function EditorPage() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();
  const fetchEditor = useServerFn(getCourseEditor);
  const q = useQuery({ queryKey: ["videotheque", "editor", id], queryFn: () => fetchEditor({ data: { id } }) });
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["videotheque"] });
  const saveMeta = useServerFn(saveCourseMeta), saveLesson = useServerFn(saveCourseLesson), archiveLesson = useServerFn(archiveCourseLesson);
  const move = useServerFn(moveCourseLesson), publish = useServerFn(publishCourse), archive = useServerFn(archiveCourse);
  const revoke = useServerFn(revokeGrant), reshare = useServerFn(setGrantReshare);
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [meta, setMeta] = useState<{ title: string; description: string } | null>(null);
  const [share, setShare] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<{ id: string; name: string } | null>(null);
  const [sharePanel, setSharePanel] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); refresh(); } catch (e) { toast.error(vtError(e, e instanceof Error ? e.message : "Action impossible.")); } };

  if (q.isLoading) return <AppShell user={user} title="Académie"><div className="mx-auto max-w-[1100px] space-y-3 p-5 lg:p-8">{[0, 1, 2].map((i) => <div key={i} className="surface h-20 animate-pulse rounded-2xl" />)}</div></AppShell>;
  if (q.isError) return <AppShell user={user} title="Académie"><div className="p-5"><ErrorLine text="Formation indisponible." onRetry={() => q.refetch()} /></div></AppShell>;
  const d = q.data;
  if (!d) return <AppShell user={user} title="Académie"><p className="p-6 text-sm text-muted-foreground">Formation introuvable. <Link to="/academie/mes-formations" className="text-primary">Retour</Link></p></AppShell>;

  const groups = groupByModule(d.lessons);
  const order = d.lessons.map((l) => l.id);
  const swap = (i: number, j: number) => { const o = [...order]; const t = o[i]!; o[i] = o[j]!; o[j] = t; void run(() => move({ data: { courseId: id, order: o } })); };
  const modules = [...new Set(d.lessons.map((l) => l.module).filter(Boolean))];
  const editable = !d.course.archived;
  const totalSeconds = d.lessons.reduce((s, l) => s + l.duration, 0);
  const activeGrants = d.grants.filter((g) => g.status === "actif" || g.status === "en_attente").length;
  const addLesson = (module: string) => setDraft({ title: "", summary: "", module, videoId: "" });

  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[1100px] p-5 pb-36 lg:p-8 lg:pb-28">
        <Link to="/academie/mes-formations" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"><ArrowLeft className="size-4" />Mes formations</Link>
        <header className="mt-1 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <CourseStatusBadge version={d.version?.number} changed={d.draftChanges} archived={d.course.archived} />
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{d.course.title}</h1>
            {d.course.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{d.course.description}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Layers className="size-3.5" />{groups.length} module{groups.length > 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1"><Film className="size-3.5" />{d.lessons.length} leçon{d.lessons.length > 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1"><Clock className="size-3.5" />{formatTotal(totalSeconds)}</span>
            </p>
          </div>
          {editable && <button type="button" onClick={() => setMeta({ title: d.course.title, description: d.course.description })} className="grid size-11 shrink-0 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors duration-150 hover:text-foreground" aria-label="Modifier le titre et la description"><Pencil className="size-4" /></button>}
        </header>
        {d.versionUnavailable > 0 && d.version && (
          <div role="status" className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/8 p-4 text-sm">
            <p><span className="font-semibold">{d.versionUnavailable} leçon{d.versionUnavailable > 1 ? "s" : ""} indisponible{d.versionUnavailable > 1 ? "s" : ""}</span> dans la version {d.version.number} : la vidéo a été retirée. Ceux qui ont reçu la formation gardent les autres leçons.</p>
            <p className="mt-1 text-muted-foreground">Republie pour partager une version sans cette vidéo. Les personnes qui ont déjà la formation pourront la mettre à jour si elles le souhaitent.</p>
            {editable && <Button className="mt-3 min-h-11" disabled={publishing} onClick={async () => { setPublishing(true); await run(async () => { const r = await publish({ data: { id } }); toast.success(`Version ${r.version} publiée`); }); setPublishing(false); }}>Republier sans cette vidéo</Button>}
          </div>
        )}
        {d.course.archived && <p className="surface mt-4 rounded-2xl p-4 text-sm">Formation archivée : elle n'est plus modifiable ni partageable. Les personnes qui l'ont reçue la gardent. <button type="button" className="font-semibold text-primary" onClick={() => run(() => archive({ data: { id, archived: false } }), "Formation restaurée")}>Restaurer</button></p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <section aria-label="Parcours" className="min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Parcours</h2>
              {editable && d.videos.length > 0 && d.lessons.length > 0 && <Button variant="outline" size="sm" className="min-h-10" onClick={() => addLesson("")}><Plus className="size-4" />Nouveau module</Button>}
            </div>
            {!d.lessons.length ? (
              <div className="surface flex flex-col items-center gap-3 rounded-2xl border-dashed px-6 py-10 text-center text-sm">
                <span className="grid size-12 place-items-center rounded-full bg-primary/12 text-primary"><Film className="size-6" /></span>
                <p className="font-semibold">{d.videos.length ? "Ajoute ta première leçon" : "Ta vidéothèque est vide"}</p>
                <p className="max-w-sm text-muted-foreground">{d.videos.length ? "Choisis une vidéo de ta vidéothèque. Tu pourras ensuite la ranger dans un module." : "Ajoute d'abord une vidéo, puis reviens créer tes leçons."}</p>
                {d.videos.length ? (editable && <Button className="min-h-11" onClick={() => addLesson("")}><Plus className="size-4" />Ajouter une leçon</Button>)
                  : <Button asChild variant="outline" className="min-h-11"><Link to="/academie/videos">Aller à ma vidéothèque</Link></Button>}
              </div>
            ) : groups.map((g, gi) => (
              <ModuleSection key={gi} index={gi} name={g.module} items={g.items} onAdd={editable && d.videos.length ? () => addLesson(g.module) : undefined}>
                {g.items.map((l) => {
                  const i = order.indexOf(l.id);
                  return (
                    <LessonRow key={l.id} number={i + 1} lesson={l} canUp={i > 0} canDown={i < order.length - 1}
                      onUp={editable ? () => swap(i, i - 1) : undefined} onDown={editable ? () => swap(i, i + 1) : undefined}
                      onEdit={editable ? () => setDraft({ id: l.id, title: l.title, summary: l.summary, module: l.module, videoId: l.videoId }) : undefined}
                      onRemove={editable ? () => run(() => archiveLesson({ data: { id: l.id, courseId: id } }), "Leçon retirée") : undefined} />
                  );
                })}
              </ModuleSection>
            ))}
            {d.lessons.length > 0 && <p className="px-1 text-xs text-muted-foreground">Retirer une leçon ne change rien pour ceux qui ont déjà reçu la formation : ils gardent la version reçue.</p>}
          </section>

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-6">
            <div className="surface overflow-hidden rounded-2xl">
              <button type="button" onClick={() => setSharePanel((o) => !o)} aria-expanded={sharePanel} className="flex min-h-14 w-full items-center gap-3 px-4 text-left lg:pointer-events-none">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/12 text-primary"><Users className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">Partage</span><span className="text-xs text-muted-foreground">{activeGrants ? `${activeGrants} personne${activeGrants > 1 ? "s" : ""}` : "Personne pour l'instant"}</span></span>
                <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none lg:hidden ${sharePanel ? "rotate-180" : ""}`} aria-hidden />
              </button>
              <div className={`${sharePanel ? "block" : "hidden"} border-t border-border/50 px-4 pb-4 lg:block`}>
                {!d.version ? <p className="mt-3 text-sm text-muted-foreground">Publie la formation pour pouvoir la partager.</p>
                  : !d.canShare ? <p className="mt-3 text-sm text-muted-foreground">Partager avec une équipe demande le plan Business. Les accès déjà donnés restent valables.</p>
                  : editable && <Button variant="outline" className="mt-3 min-h-11 w-full" onClick={() => setShare(true)}><Share2 className="size-4" />Partager v{d.version.number}</Button>}
                {d.grants.length > 0 && (
                  <ul className="mt-3 divide-y divide-border/50 text-sm">
                    {d.grants.map((g) => (
                      <li key={g.id} className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold uppercase">{g.recipient.slice(0, 1)}</span>
                          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{g.recipient}</span>{g.grantor && <span className="block truncate text-xs text-muted-foreground">via {g.grantor}</span>}</span>
                          <GrantBadge status={g.status} />
                        </div>
                        {g.status === "actif" && (
                          <div className="mt-2 pl-10">
                            <div className="flex justify-between text-[11px] text-muted-foreground"><span>{g.done}/{g.total} leçons terminées</span><span className="tabular-nums">{g.total ? Math.round((g.done / g.total) * 100) : 0} %</span></div>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${g.total ? Math.round((g.done / g.total) * 100) : 0}%` }} /></div>
                          </div>
                        )}
                        {(g.status === "actif" || g.status === "en_attente") && (
                          <div className="mt-2 flex items-center gap-3 pl-10">
                            {g.direct && <label className="flex min-h-11 flex-1 items-center gap-2 text-xs text-muted-foreground"><Switch checked={g.canReshare} onCheckedChange={(v) => run(() => reshare({ data: { id: g.id, value: v } }))} />Peut repartager</label>}
                            {canRevoke({ status: g.status, created_at: g.createdAt, accepted_at: g.acceptedAt }) && <button type="button" className="min-h-11 text-xs font-semibold text-destructive" onClick={() => setConfirmRevoke({ id: g.id, name: g.recipient })}>Retirer</button>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {d.lessons.length > 0 && (
              <Link to="/academie/lecture/$courseId" params={{ courseId: id }} className="surface group hidden overflow-hidden rounded-2xl transition-colors duration-200 hover:border-primary/40 lg:block">
                <span className="relative block">
                  <Thumb url={d.lessons[0]!.thumbUrl} className="w-full rounded-none" />
                  <span className="absolute inset-0 grid place-items-center"><span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"><Eye className="size-5" /></span></span>
                </span>
                <span className="block p-3 text-sm"><span className="font-semibold">Aperçu</span><span className="block text-xs text-muted-foreground">Vois la formation comme ton équipe la verra.</span></span>
              </Link>
            )}
            {editable && <button type="button" onClick={() => setConfirmArchive(true)} className="flex min-h-11 items-center gap-2 px-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"><Archive className="size-4" />Archiver la formation</button>}
          </aside>
        </div>
      </div>

      {editable && (
        <PublishBar courseId={id} version={d.version?.number} changed={d.draftChanges || d.versionUnavailable > 0} canPublish={d.lessons.length > 0} busy={publishing}
          onPublish={async () => { setPublishing(true); await run(async () => { const r = await publish({ data: { id } }); toast.success(`Version ${r.version} publiée`); }); setPublishing(false); }} />
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Modifier la leçon" : "Nouvelle leçon"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <VideoPicker videos={d.videos} value={draft.videoId} onChange={(vid, t) => setDraft({ ...draft, videoId: vid, title: draft.title || t.slice(0, 120) })} />
              <label className="block text-sm font-medium">Titre<Input className="mt-1 min-h-11" value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
              <label className="block text-sm font-medium">Module (facultatif)<Input className="mt-1 min-h-11" value={draft.module} maxLength={80} list="modules" onChange={(e) => setDraft({ ...draft, module: e.target.value })} placeholder="Ex. Semaine 1" /></label>
              <datalist id="modules">{modules.map((m) => <option key={m} value={m} />)}</datalist>
              <label className="block text-sm font-medium">Résumé<Textarea className="mt-1" rows={2} value={draft.summary} maxLength={1000} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></label>
              <Button className="min-h-11 w-full" disabled={!draft.videoId || draft.title.trim().length < 3} onClick={() => run(async () => { await saveLesson({ data: { ...draft, courseId: id } }); setDraft(null); }, "Leçon enregistrée")}>Enregistrer</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!meta} onOpenChange={(o) => !o && setMeta(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Formation</DialogTitle></DialogHeader>
          {meta && <>
            <label className="block text-sm font-medium">Titre<Input className="mt-1 min-h-11" value={meta.title} maxLength={120} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></label>
            <label className="block text-sm font-medium">Description<Textarea className="mt-1" rows={3} value={meta.description} maxLength={2000} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></label>
            <Button className="min-h-11" disabled={meta.title.trim().length < 3} onClick={() => run(async () => { await saveMeta({ data: { id, ...meta } }); setMeta(null); }, "Enregistré")}>Enregistrer</Button>
          </>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver cette formation ?</AlertDialogTitle>
            <AlertDialogDescription>Tu ne pourras plus la modifier ni la partager. Ceux qui l'ont reçue la gardent dans leurs formations reçues.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => run(() => archive({ data: { id, archived: true } }), "Formation archivée")}>Archiver</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!confirmRevoke} onOpenChange={(o) => !o && setConfirmRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer l'accès de {confirmRevoke?.name} ?</AlertDialogTitle>
            <AlertDialogDescription>Cette personne ne pourra plus regarder la formation. Après 7 jours, l'accès devient définitif et ne peut plus être retiré.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const g = confirmRevoke; if (g) void run(async () => { const r = await revoke({ data: { id: g.id } }); if (r.result !== "revoque") throw new Error("Accès devenu définitif."); }, "Accès retiré"); }}>Retirer l'accès</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ShareSheet courseId={id} open={share} onOpenChange={setShare} />
    </AppShell>
  );
}

function GrantBadge({ status }: { status: string }) {
  const label = GRANT_STATUS_LABEL[status as keyof typeof GRANT_STATUS_LABEL] ?? status;
  const tone = status === "actif" ? "success" : status === "en_attente" ? "primary" : status === "refuse" ? "muted" : "destructive";
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
