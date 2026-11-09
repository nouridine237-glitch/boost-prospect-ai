import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Circle, Flag, PlayCircle, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorLine } from "@/components/videotheque/academy-tabs";
import { FilePlayer } from "@/components/videotheque/file-player";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime, resumeAt } from "@/lib/academy-progress";
import { saveLessonProgress } from "@/lib/academy-progress.functions";
import { formatDuration, groupByModule } from "@/lib/videotheque";
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

  if (q.isLoading) return <AppShell user={user} title="Académie"><div className="mx-auto max-w-[900px] p-5"><div className="aspect-video animate-pulse rounded-2xl bg-muted" /></div></AppShell>;
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

  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[900px] p-4 lg:p-8">
        <Link to={d.role === "owner" ? "/academie/mes-formations/$id" : "/academie/recues"} params={{ id: courseId }} className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" />{d.role === "owner" ? "Retour à l'éditeur" : "Formations reçues"}
        </Link>
        <h1 className="text-2xl font-extrabold">{d.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{d.role === "owner" ? "Aperçu de ta version de travail" : `Formation de ${d.author}${d.version ? ` · version ${d.version}` : ""}`}</p>
        {newer && d.grantId && (
          <div className="surface mt-3 flex flex-wrap items-center gap-3 rounded-2xl p-3 text-sm">
            <span className="flex-1">Une nouvelle version est disponible. Ta progression sur les leçons conservées est gardée.</span>
            <Button variant="outline" className="min-h-11" onClick={async () => { await upgrade({ data: { id: d.grantId! } }); qc.invalidateQueries({ queryKey: ["videotheque"] }); toast.success("Formation mise à jour"); }}><RefreshCw className="size-4" />Mettre à jour</Button>
          </div>
        )}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground"><span>{d.progress.done}/{d.progress.total} leçons terminées</span><span className="font-semibold text-foreground">{d.progress.percent} %</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${d.progress.percent}%` }} /></div>
        </div>

        {current && (
          <section className="mt-5">
            {current.available ? (
              <FilePlayer key={`${current.id}-${resumeFrom ?? 0}`} title={current.title} startAt={resumeFrom ?? 0}
                getUrl={async () => (await playUrl({ data: { courseId, lessonId: current.id } })).url} onReport={onReport} />
            ) : <div className="surface grid aspect-video place-items-center rounded-2xl p-6 text-center text-sm text-muted-foreground">Cette vidéo a été retirée.</div>}
            {canResume > 0 && resumeFrom === null && current.progress.state === "en_cours" && (
              <button type="button" onClick={() => setResumeFrom(canResume)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/50 text-sm font-semibold text-primary sm:w-auto sm:px-4"><PlayCircle className="size-4" />Reprendre à {formatTime(canResume)}</button>
            )}
            <h2 className="mt-4 text-lg font-bold">{current.title}</h2>
            {current.summary && <p className="mt-1 text-sm text-muted-foreground">{current.summary}</p>}
            <div className="mt-3 flex flex-wrap gap-3">
              {next && <Link to="/academie/lecture/$courseId" params={{ courseId }} search={{ l: next.id }} onClick={() => { setResumeFrom(null); last.current = null; }} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">Leçon suivante : {next.title} →</Link>}
              {d.role === "recipient" && <button type="button" onClick={() => setFlag(true)} className="flex min-h-11 items-center gap-1 text-xs text-muted-foreground"><Flag className="size-3.5" />Signaler</button>}
            </div>
          </section>
        )}

        <div className="mt-8">
          {groupByModule(d.lessons).map((g, gi) => (
            <div key={gi} className="mb-4">
              {g.module && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.module}</h3>}
              <ol className="space-y-2">
                {g.items.map((x) => (
                  <li key={x.id}>
                    <Link to="/academie/lecture/$courseId" params={{ courseId }} search={{ l: x.id }} onClick={() => { setResumeFrom(null); last.current = null; }}
                      className={`surface flex min-h-14 items-center gap-3 rounded-2xl p-3 text-sm transition-colors duration-200 ${x.id === current?.id ? "border-primary/60" : ""}`}>
                      {x.progress.state === "terminee" ? <CheckCircle2 className="size-5 text-primary" /> : x.progress.state === "en_cours" ? <PlayCircle className="size-5 text-primary" /> : <Circle className="size-5 text-muted-foreground" />}
                      <span className="flex-1 font-medium">{x.title}</span>
                      <span className="text-xs text-muted-foreground">{formatDuration(x.duration)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
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
