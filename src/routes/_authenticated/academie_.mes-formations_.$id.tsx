import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, Eye, Film, Pencil, Plus, Share2, Trash2, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorLine } from "@/components/videotheque/academy-tabs";
import { ShareSheet } from "@/components/videotheque/share-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { canRevoke, formatDuration, groupByModule, GRANT_STATUS_LABEL, vtError } from "@/lib/videotheque";
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
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); refresh(); } catch (e) { toast.error(vtError(e, e instanceof Error ? e.message : "Action impossible.")); } };

  if (q.isLoading) return <AppShell user={user} title="Académie"><div className="mx-auto max-w-[1100px] space-y-3 p-5 lg:p-8">{[0, 1, 2].map((i) => <div key={i} className="surface h-20 animate-pulse rounded-2xl" />)}</div></AppShell>;
  if (q.isError) return <AppShell user={user} title="Académie"><div className="p-5"><ErrorLine text="Formation indisponible." onRetry={() => q.refetch()} /></div></AppShell>;
  const d = q.data;
  if (!d) return <AppShell user={user} title="Académie"><p className="p-6 text-sm text-muted-foreground">Formation introuvable. <Link to="/academie/mes-formations" className="text-primary">Retour</Link></p></AppShell>;

  const groups = groupByModule(d.lessons);
  const order = d.lessons.map((l) => l.id);
  const swap = (i: number, j: number) => { const o = [...order]; [o[i], o[j]] = [o[j], o[i]]; void run(() => move({ data: { courseId: id, order: o } })); };
  const modules = [...new Set(d.lessons.map((l) => l.module).filter(Boolean))];

  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[1100px] p-5 pb-28 lg:p-8 lg:pb-28">
        <Link to="/academie/mes-formations" className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Mes formations</Link>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold">{d.course.title}</h1>
            {d.course.description && <p className="mt-1 text-sm text-muted-foreground">{d.course.description}</p>}
          </div>
          {!d.course.archived && <button type="button" onClick={() => setMeta({ title: d.course.title, description: d.course.description })} className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:text-foreground" aria-label="Modifier le titre"><Pencil className="size-4" /></button>}
        </div>
        {d.course.archived && <p className="surface mt-4 rounded-2xl p-4 text-sm">Formation archivée : elle n'est plus modifiable ni partageable. Les personnes qui l'ont reçue la gardent. <button type="button" className="font-semibold text-primary" onClick={() => run(() => archive({ data: { id, archived: false } }), "Formation restaurée")}>Restaurer</button></p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section aria-label="Structure">
            {!d.lessons.length ? (
              <div className="surface flex flex-col items-center gap-3 rounded-2xl p-8 text-center text-sm">
                <Film className="size-6 text-primary" />
                <p className="text-muted-foreground">{d.videos.length ? "Ajoute ta première leçon en choisissant une vidéo de ta vidéothèque." : "Ta vidéothèque est vide. Ajoute d'abord une vidéo."}</p>
                {d.videos.length ? null : <Link to="/academie/videos" className="font-semibold text-primary">Aller à ma vidéothèque →</Link>}
              </div>
            ) : groups.map((g, gi) => (
              <div key={gi} className="mb-4">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.module || "Sans module"}</h2>
                <ul className="space-y-2">
                  {g.items.map((l) => {
                    const i = order.indexOf(l.id);
                    return (
                      <li key={l.id} className="surface flex items-center gap-3 rounded-2xl p-2 pr-1">
                        <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {l.thumbUrl ? <img src={l.thumbUrl} alt="" loading="lazy" className="size-full object-cover" /> : <Film className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />}
                        </span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{l.title}</span><span className="text-xs text-muted-foreground">{formatDuration(l.duration)}</span></span>
                        {!d.course.archived && <span className="flex">
                          <button type="button" disabled={i === 0} onClick={() => swap(i, i - 1)} className="grid size-11 place-items-center text-muted-foreground disabled:opacity-30" aria-label="Monter"><ArrowUp className="size-4" /></button>
                          <button type="button" disabled={i === order.length - 1} onClick={() => swap(i, i + 1)} className="grid size-11 place-items-center text-muted-foreground disabled:opacity-30" aria-label="Descendre"><ArrowDown className="size-4" /></button>
                          <button type="button" onClick={() => setDraft({ id: l.id, title: l.title, summary: l.summary, module: l.module, videoId: l.videoId })} className="grid size-11 place-items-center text-muted-foreground" aria-label="Modifier"><Pencil className="size-4" /></button>
                          <button type="button" onClick={() => run(() => archiveLesson({ data: { id: l.id, courseId: id } }), "Leçon retirée")} className="grid size-11 place-items-center text-muted-foreground" aria-label="Retirer la leçon"><Trash2 className="size-4" /></button>
                        </span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {!d.course.archived && d.videos.length > 0 && (
              <Button variant="outline" className="mt-2 min-h-11 w-full" onClick={() => setDraft({ title: "", summary: "", module: modules[modules.length - 1] ?? "", videoId: "" })}><Plus className="size-4" />Leçon</Button>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Retirer une leçon ne change rien pour ceux qui ont déjà reçu la formation : ils gardent la version reçue.</p>
          </section>

          <aside className="space-y-4">
            <div className="surface rounded-2xl p-4">
              <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" />Partage</h2>
              {!d.version ? <p className="mt-2 text-sm text-muted-foreground">Publie la formation pour pouvoir la partager.</p>
                : !d.canShare ? <p className="mt-2 text-sm text-muted-foreground">Partager avec une équipe demande le plan Business. Les accès déjà donnés restent valables.</p>
                : !d.course.archived && <Button variant="outline" className="mt-3 min-h-11 w-full" onClick={() => setShare(true)}><Share2 className="size-4" />Partager</Button>}
              {d.grants.length > 0 && (
                <ul className="mt-3 divide-y divide-border/50 text-sm">
                  {d.grants.map((g) => (
                    <li key={g.id} className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{g.recipient}{g.grantor && <span className="text-xs font-normal text-muted-foreground"> · via {g.grantor}</span>}</span>
                        <span className="text-xs text-muted-foreground">{GRANT_STATUS_LABEL[g.status]}</span>
                      </div>
                      {g.status === "actif" && <p className="text-xs text-muted-foreground">{g.done}/{g.total} leçons terminées</p>}
                      {(g.status === "actif" || g.status === "en_attente") && (
                        <div className="mt-1 flex items-center gap-3">
                          {g.direct && <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={g.canReshare} onCheckedChange={(v) => run(() => reshare({ data: { id: g.id, value: v } }))} />Peut repartager</label>}
                          {canRevoke({ status: g.status, created_at: g.createdAt }) && <button type="button" className="text-xs font-semibold text-destructive" onClick={() => run(async () => { const r = await revoke({ data: { id: g.id } }); if (r.result !== "revoque") throw new Error("Accès devenu définitif."); }, "Accès retiré")}>Retirer</button>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!d.course.archived && <button type="button" onClick={() => setConfirmArchive(true)} className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><Archive className="size-4" />Archiver la formation</button>}
          </aside>
        </div>
      </div>

      {!d.course.archived && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border/60 bg-background/95 backdrop-blur lg:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-5 py-3">
            <span className="flex-1 text-xs text-muted-foreground">{d.version ? `Publiée v${d.version.number}${d.draftChanges ? " · modifications non publiées" : ""}` : "Brouillon"}</span>
            <Link to="/academie/lecture/$courseId" params={{ courseId: id }} className="flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-muted-foreground"><Eye className="size-4" />Aperçu</Link>
            <Button className="min-h-11" disabled={!d.lessons.length} onClick={() => run(async () => { const r = await publish({ data: { id } }); toast.success(`Version ${r.version} publiée`); })}>Publier</Button>
          </div>
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Modifier la leçon" : "Nouvelle leçon"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium">Vidéo</span>
                <ul className="mt-2 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto">
                  {d.videos.map((v) => (
                    <li key={v.id}><button type="button" onClick={() => setDraft({ ...draft, videoId: v.id, title: draft.title || v.title.slice(0, 120) })} aria-pressed={draft.videoId === v.id}
                      className={`w-full overflow-hidden rounded-xl border text-left transition-colors duration-150 ${draft.videoId === v.id ? "border-primary ring-1 ring-primary" : "border-border/60"}`}>
                      <span className="relative block aspect-video bg-muted">{v.thumbUrl && <img src={v.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />}</span>
                      <span className="block truncate p-2 text-xs font-medium">{v.title}</span>
                    </button></li>
                  ))}
                </ul>
              </div>
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
      <ShareSheet courseId={id} open={share} onOpenChange={setShare} />
    </AppShell>
  );
}
