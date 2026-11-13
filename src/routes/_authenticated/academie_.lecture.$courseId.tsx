import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Flag, PlayCircle, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorLine } from "@/components/videotheque/academy-tabs";
import { FilePlayer } from "@/components/videotheque/file-player";
import { LessonOutline } from "@/components/videotheque/lesson-outline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime, resumeAt } from "@/lib/academy-progress";
import { saveLessonProgress } from "@/lib/academy-progress.functions";
import { getCourseReader, getLessonPlayUrl, listReceived, reportLessonVideo, updateGrantVersion } from "@/lib/videotheque.functions";

export const Route = createFileRoute("/_authenticated/academie_/lecture/$courseId")({
  validateSearch: z.object({ l: z.string().optional() }),
  head: () => ({ meta: [
    { title: "Lecture de formation — MLM Boost AI" },
    { name: "description", content: "Regarde les leçons vidéo de ta formation et suis ta progression." },
    { property: "og:title", content: "Lecture de formation — MLM Boost AI" },
    { property: "og:description", content: "Leçons vidéo de formation, progression personnelle." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: ReaderPage,
});

function ReaderPage() {
  const { user } = Route.useRouteContext();
  const { courseId } = Route.useParams();
  const { l } = Route.useSearch();
  const fetchReader = useServerFn(getCourseReader);
  const fetchReceived = useServerFn(listReceived);
  const q = useQuery({ queryKey: ["videotheque", "reader", courseId], queryFn: () => fetchReader({ data: { courseId } }) });
  const rec = useQuery({ queryKey: ["videotheque", "received"], queryFn: () => fetchReceived(), enabled: q.data?.role === "recipient" });
  const playUrl = useServerFn(getLessonPlayUrl);
  const save = useServerFn(saveLessonProgress);
  const report = useServerFn(reportLessonVideo);
  const upgrade = useServerFn(updateGrantVersion);
  const qc = useQueryClient();
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const [flag, setFlag] = useState(false);
  const [reason, setReason] = useState("");
  const last = useRef<string | null>(null);

  if (q.isLoading) return <AppShell user={user} title="Académie"><div className="mx-auto grid max-w-[1200px] gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-8"><div className="aspect-video animate-pulse rounded-2xl bg-muted" /><div className="surface h-64 animate-pulse rounded-2xl" /></div></AppShell>;
  if (q.isError) return <AppShell user={user} title="Académie"><div className="p-5"><ErrorLine text="Formation indisponible." onRetry={() => q.refetch()} /></div></AppShell>;
  const d = q.data;
  if (!d) return <AppShell user={user} title="Académie"><p className="p-6 text-sm text-muted-foreground">Tu n'as pas accès à cette formation. <Link to="/academie/recues" className="text-primary">Formations reçues</Link></p></AppShell>;

  const current = d.lessons.find((x) => x.id === l) ?? d.lessons.find((x) => x.progress.state !== "terminee") ?? d.lessons[0];
  const idx = current ? d.lessons.indexOf(current) : -1;
  const next = idx >= 0 ? d.lessons[idx + 1] : undefined;
  const canResume = current ? resumeAt(current.progress.position, current.duration) : 0;
  const newer = d.role === "recipient" && rec.data?.find((g) => g.courseId === courseId)?.newerVersion;

  const onReport = async (r: { position: number; playing: boolean; duration: number | null }) => {
    if (!current) return;
    try {
      const res = await save({ data: { lessonId: current.id, ...r, manual: false } });
      if (res.status === "terminee" && last.current !== "terminee") toast.success("Leçon terminée ✓");
      if (res.status !== last.current || !r.playing) qc.invalidateQueries({ queryKey: ["videotheque", "reader", courseId] });
      last.current = res.status;
    } catch { /* réessayé au prochain battement */ }
  };

  const prev = idx > 0 ? d.lessons[idx - 1] : undefined;
  const select = () => { setResumeFrom(null); last.current = null; };

  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[1200px] p-4 sm:p-5 lg:p-8">
        <Link to={d.role === "owner" ? "/academie/mes-formations/$id" : "/academie/recues"} params={{ id: courseId }} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
          <ArrowLeft className="size-4" />{d.role === "owner" ? "Retour à l'éditeur" : "Formations reçues"}
        </Link>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{d.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{d.role === "owner" ? "Aperçu de ta version de travail" : `Formation de ${d.author}${d.version ? ` · version ${d.version}` : ""}`}</p>
          </div>
          <div className="w-full sm:w-56">
            <div className="flex justify-between text-xs text-muted-foreground"><span>{d.progress.done}/{d.progress.total} leçons terminées</span><span className="font-semibold tabular-nums text-foreground">{d.progress.percent} %</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={d.progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progression de la formation"><div className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${d.progress.percent}%` }} /></div>
          </div>
        </div>
        {newer && d.grantId && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-primary/8 p-3 text-sm">
            <span className="flex-1">Une nouvelle version est disponible. Ta progression sur les leçons conservées est gardée.</span>
            <Button variant="outline" className="min-h-11" onClick={async () => { await upgrade({ data: { id: d.grantId! } }); qc.invalidateQueries({ queryKey: ["videotheque"] }); toast.success("Formation mise à jour"); }}><RefreshCw className="size-4" />Mettre à jour</Button>
          </div>
        )}

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <section className="min-w-0" aria-label="Leçon en cours">
            {current ? (
              <>
                {current.available ? (
                  <FilePlayer key={`${current.id}-${resumeFrom ?? 0}`} title={current.title} startAt={resumeFrom ?? 0}
                    getUrl={async () => (await playUrl({ data: { courseId, lessonId: current.id } })).url} onReport={onReport} />
                ) : <div className="surface grid aspect-video place-items-center rounded-2xl p-6 text-center text-sm text-muted-foreground">Cette vidéo n'est plus disponible. Les autres leçons restent accessibles.</div>}
                {canResume > 0 && resumeFrom === null && current.progress.state === "en_cours" && (
                  <button type="button" onClick={() => setResumeFrom(canResume)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/50 bg-primary/5 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary/10 sm:w-auto sm:px-4"><PlayCircle className="size-4" />Reprendre à {formatTime(canResume)}</button>
                )}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-primary">Leçon {idx + 1} sur {d.lessons.length}{current.module ? ` · ${current.module}` : ""}</p>
                  <h2 className="mt-1 text-lg font-bold sm:text-xl">{current.title}</h2>
                  {current.summary && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.summary}</p>}
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-4">
                  {prev ? (
                    <Button asChild variant="outline" className="min-h-11"><Link to="/academie/lecture/$courseId" params={{ courseId }} search={{ l: prev.id }} onClick={select} aria-label={`Leçon précédente : ${prev.title}`}><ChevronLeft className="size-4" /><span className="hidden sm:inline">Précédente</span></Link></Button>
                  ) : null}
                  {next ? (
                    <Button asChild className="min-h-11 min-w-0 flex-1 sm:flex-none"><Link to="/academie/lecture/$courseId" params={{ courseId }} search={{ l: next.id }} onClick={select}><span className="truncate">Suivante : {next.title}</span><ChevronRight className="size-4" /></Link></Button>
                  ) : <span className="flex min-h-11 flex-1 items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" />Dernière leçon</span>}
                  {d.role === "recipient" && <button type="button" onClick={() => setFlag(true)} className="ml-auto flex min-h-11 items-center gap-1 px-2 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"><Flag className="size-3.5" />Signaler</button>}
                </div>
              </>
            ) : <div className="surface rounded-2xl p-6 text-center text-sm text-muted-foreground">Cette formation ne contient pas encore de leçon.</div>}
          </section>

          {d.lessons.length > 0 && (
            <aside className="min-w-0 lg:sticky lg:top-6">
              <LessonOutline courseId={courseId} lessons={d.lessons} currentId={current?.id} onSelect={select} />
            </aside>
          )}
        </div>
      </div>
      <Dialog open={flag} onOpenChange={setFlag}>
        <DialogContent>
          <DialogHeader><DialogTitle>Signaler cette vidéo</DialogTitle><DialogDescription>Contenu illégal, trompeur ou utilisé sans droits ? L'équipe MLM Boost AI l'examinera.</DialogDescription></DialogHeader>
          <Textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explique en quelques mots" />
          <Button className="min-h-11" disabled={reason.trim().length < 5 || !current} onClick={async () => {
            try { await report({ data: { courseId, lessonId: current!.id, reason } }); toast.success("Signalement envoyé"); setFlag(false); setReason(""); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Signalement non envoyé."); }
          }}>Envoyer</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
