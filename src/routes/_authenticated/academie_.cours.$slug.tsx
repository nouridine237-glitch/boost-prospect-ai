import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, Clock, Lock, PlayCircle } from "lucide-react";
import { saveLessonProgress } from "@/lib/academy-progress.functions";
import { formatTime, resumeAt } from "@/lib/academy-progress";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { VideoPlayer } from "@/components/academy/video-player";
import { LessonCoach } from "@/components/academy/lesson-coach";
import { hasCoachContext } from "@/lib/academy-coach";
import { getVideoCourse } from "@/lib/academy-video.functions";
import { planDef } from "@/lib/plans";

const courseQuery = (slug: string) => queryOptions({ queryKey: ["video-course", slug], queryFn: () => getVideoCourse({ data: { slug } }) });

export const Route = createFileRoute("/_authenticated/academie_/cours/$slug")({
  validateSearch: z.object({ l: z.string().optional() }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(courseQuery(params.slug)),
  head: () => ({ meta: [
    { title: "Cours vidéo — Académie MLM Boost AI" },
    { name: "description", content: "Leçons vidéo, notes et transcription pour progresser avec méthode." },
    { property: "og:title", content: "Cours vidéo — Académie MLM Boost AI" },
    { property: "og:description", content: "Formations vidéo éthiques pour la prospection et l’animation d’équipe." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: CoursePage,
});

function CoursePage() {
  const { user } = Route.useRouteContext();
  const { slug } = Route.useParams();
  const { l } = Route.useSearch();
  const { data } = useSuspenseQuery(courseQuery(slug));
  const [tab, setTab] = useState<"notes" | "transcript">("notes");
  const [fallback, setFallback] = useState(false);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const save = useServerFn(saveLessonProgress);
  const qc = useQueryClient();
  const failures = useRef(0);
  const lastStatus = useRef<string | null>(null);

  const report = async (lessonId: string, r: { position: number; playing: boolean; duration: number | null }, manual = false) => {
    try {
      const res = await save({ data: { lessonId, ...r, manual } });
      failures.current = 0;
      if (res.status !== lastStatus.current || !r.playing) qc.invalidateQueries({ queryKey: ["video-course", slug] });
      if (res.status === "terminee" && lastStatus.current !== "terminee") toast.success("Leçon terminée ✓");
      else if (manual && res.status !== "terminee") toast.info("Regarde encore un peu la vidéo avant de valider la leçon.");
      lastStatus.current = res.status;
      qc.invalidateQueries({ queryKey: ["video-courses"] });
    } catch {
      failures.current += 1;
      if (failures.current === 3) toast.error("Progression non enregistrée pour le moment. Elle sera réessayée.");
    }
  };

  if (!data) {
    return (
      <AppShell user={user} title="Académie">
        <div className="p-6 text-sm text-muted-foreground">Ce cours n’existe pas ou n’est plus publié. <Link to="/academie" className="text-primary">Retour à l’Académie</Link></div>
      </AppShell>
    );
  }
  const current = data.lessons.find((x) => x.slug === l) ?? data.lessons.find((x) => x.id === data.progress.resumeLessonId) ?? data.lessons[0];
  const startAt = current ? (resumeFrom ?? 0) : 0;
  const canResume = current ? resumeAt(current.progress.position, current.minutes * 60) : 0;

  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[900px] p-4 lg:p-8">
        <Link to="/academie" className="flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Académie</Link>
        <h1 className="mt-3 text-2xl font-extrabold">{data.course.title}</h1>
        {data.course.external && <p className="mt-1 text-xs text-muted-foreground">Formation de {data.course.author}, diffusée avec son autorisation.</p>}
        {data.course.description && <p className="mt-2 text-sm text-muted-foreground">{data.course.description}</p>}
        {data.unlocked && data.lessons.length > 0 && (
          <div className="mt-4" aria-label="Progression du cours">
            <div className="flex justify-between text-xs text-muted-foreground"><span>{data.progress.done}/{data.progress.total} leçons terminées</span><span className="font-semibold text-foreground">{data.progress.percent} %</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${data.progress.percent}%` }} /></div>
          </div>
        )}

        {!data.unlocked ? (
          <div className="surface mt-6 rounded-lg p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold"><Lock className="size-4" />Cours disponible avec le plan {planDef(data.course.minPlan).label}.</p>
            <Link to="/abonnement" className="mt-3 inline-block font-semibold text-primary">Voir les plans →</Link>
          </div>
        ) : current?.videoId ? (
          <section className="mt-6">
            <VideoPlayer key={`${current.id}-${startAt}`} videoId={current.videoId} title={current.title} startAt={startAt}
              onReport={(r) => report(current.id, r)} onFallback={() => setFallback(true)} />
            {canResume > 0 && resumeFrom === null && current.progress.state === "en_cours" && (
              <button type="button" onClick={() => setResumeFrom(canResume)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/50 py-2.5 text-sm font-semibold text-primary sm:w-auto sm:px-4">
                <PlayCircle className="size-4" />Reprendre à {formatTime(canResume)}
              </button>
            )}
            {fallback && current.progress.state !== "terminee" && (
              <button type="button" onClick={() => report(current.id, { position: 0, playing: false, duration: null }, true)} className="mt-3 w-full rounded-lg border border-border py-2.5 text-sm font-semibold sm:w-auto sm:px-4">
                J’ai terminé cette leçon
              </button>
            )}
            <h2 className="mt-4 text-lg font-bold">{current.title}</h2>
            {current.summary && <p className="mt-1 text-sm text-muted-foreground">{current.summary}</p>}
            {(current.notes || current.transcript) && (
              <div className="mt-4">
                <div className="flex gap-2 text-sm">
                  {current.notes && <button type="button" onClick={() => setTab("notes")} className={tab === "notes" ? "font-semibold text-primary" : "text-muted-foreground"}>Notes</button>}
                  {current.transcript && <button type="button" onClick={() => setTab("transcript")} className={tab === "transcript" ? "font-semibold text-primary" : "text-muted-foreground"}>Transcription</button>}
                </div>
                <div className="surface mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed">
                  {tab === "transcript" && current.transcript ? current.transcript : current.notes || current.transcript}
                </div>
              </div>
            )}
            {hasCoachContext(current) && <LessonCoach key={current.id} lessonId={current.id} />}
          </section>
        ) : null}

        <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Leçons</h3>
        <ol className="mt-2 space-y-2">
          {data.lessons.map((x, i) => (
            <li key={x.id}>
              <Link to="/academie/cours/$slug" params={{ slug }} search={{ l: x.slug }} onClick={() => { setResumeFrom(null); setFallback(false); lastStatus.current = null; }}
                className={`surface flex items-center gap-3 rounded-lg p-3 text-sm ${x.id === current?.id && data.unlocked ? "border-primary/60" : ""}`}>
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
                <span className="flex-1 font-medium">{x.title}
                  {data.unlocked && <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    {x.progress.state === "terminee" ? <><CheckCircle2 className="size-3.5 text-primary" />Terminée</>
                      : x.progress.state === "en_cours" ? <><PlayCircle className="size-3.5 text-primary" />En cours · {x.progress.percent} %</>
                      : <><Circle className="size-3.5" />Non commencée</>}
                  </span>}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">{data.unlocked ? <Clock className="size-3.5" /> : <Lock className="size-3.5" />}{x.minutes} min</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </AppShell>
  );
}
