import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Lock, PlayCircle } from "lucide-react";
import { formatDuration, formatTotal, groupByModule } from "@/lib/videotheque";

type OutlineLesson = {
  id: string; title: string; module: string; duration: number; available: boolean;
  progress: { state: "terminee" | "en_cours" | "non_commencee" | string; percent: number };
};

/** Sommaire par module : terminée (vert + coche), en cours (bleu + %), non commencée (gris). */
export function LessonOutline({ courseId, lessons, currentId, onSelect }: {
  courseId: string; lessons: OutlineLesson[]; currentId: string | undefined; onSelect: () => void;
}) {
  const groups = groupByModule(lessons);
  let n = 0;
  return (
    <nav aria-label="Sommaire de la formation" className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h2 className="text-sm font-bold">Sommaire</h2>
        <span className="text-xs text-muted-foreground">{lessons.length} leçon{lessons.length > 1 ? "s" : ""} · {formatTotal(lessons.reduce((s, l) => s + l.duration, 0))}</span>
      </div>
      <div className="lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
        {groups.map((g, gi) => {
          const done = g.items.filter((x) => x.progress.state === "terminee").length;
          return (
            <section key={gi} className={gi ? "border-t border-border/50" : ""}>
              {(g.module || groups.length > 1) && (
                <h3 className="flex items-center justify-between gap-2 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="truncate">{g.module || "Sans module"}</span><span className="tabular-nums normal-case tracking-normal">{done}/{g.items.length}</span>
                </h3>
              )}
              <ol>
                {g.items.map((x) => {
                  n += 1;
                  const active = x.id === currentId;
                  const st = x.progress.state;
                  return (
                    <li key={x.id}>
                      <Link to="/academie/lecture/$courseId" params={{ courseId }} search={{ l: x.id }} onClick={onSelect} aria-current={active ? "true" : undefined}
                        className={`relative flex min-h-14 items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ${active ? "bg-primary/10" : "hover:bg-muted/40"}`}>
                        {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
                        {!x.available ? <Lock className="size-5 shrink-0 text-muted-foreground" aria-label="Indisponible" />
                          : st === "terminee" ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Terminée" />
                          : st === "en_cours" ? <PlayCircle className="size-5 shrink-0 text-primary" aria-label="En cours" />
                          : <Circle className="size-5 shrink-0 text-muted-foreground/60" aria-label="Non commencée" />}
                        <span className="min-w-0 flex-1">
                          <span className={`line-clamp-2 leading-snug ${active ? "font-semibold" : "font-medium"}`}><span className="text-muted-foreground tabular-nums">{n}. </span>{x.title}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="tabular-nums">{formatDuration(x.duration)}</span>
                            {st === "en_cours" && <span className="font-semibold text-primary tabular-nums">{x.progress.percent} %</span>}
                            {st === "terminee" && <span className="text-success">Terminée</span>}
                            {!x.available && <span>Vidéo indisponible</span>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </nav>
  );
}
