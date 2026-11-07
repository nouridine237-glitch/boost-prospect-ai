import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, PlayCircle } from "lucide-react";
import { listVideoCourses } from "@/lib/academy-video.functions";
import { planDef } from "@/lib/plans";

/** Section « Cours vidéo » ; n'apparaît que si un cours est publié. */
export function VideoCoursesSection() {
  const { data } = useQuery({ queryKey: ["video-courses"], queryFn: () => listVideoCourses() });
  if (!data?.length) return null;
  const open = data.filter((c) => c.unlocked);
  const totals = open.reduce((a, c) => ({ done: a.done + c.done, total: a.total + c.lessons }), { done: 0, total: 0 });
  const global = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">Cours vidéo</h2>
        {totals.total > 0 && <span className="text-xs text-muted-foreground">Progression globale <b className="text-foreground">{global} %</b></span>}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {data.map((c) => (
          <Link key={c.id} to="/academie/cours/$slug" params={{ slug: c.slug }} search={c.unlocked && c.resumeSlug ? { l: c.resumeSlug } : {}} className="surface flex flex-col rounded-lg p-5 transition hover:border-primary/60">
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><PlayCircle className="size-4 text-primary" />{c.lessons} leçon{c.lessons > 1 ? "s" : ""} · {c.minutes} min</span>
            <h3 className="mt-2 font-bold">{c.title}</h3>
            {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
            {c.external && <p className="mt-1 text-xs text-muted-foreground">Par {c.author}, avec autorisation</p>}
            {c.unlocked && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground"><span>{c.done}/{c.lessons} terminée{c.done > 1 ? "s" : ""}</span><span>{c.percent} %</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${c.percent}%` }} /></div>
                {c.done > 0 && c.done < c.lessons && <span className="mt-2 inline-block text-sm font-semibold text-primary">Continuer →</span>}
              </div>
            )}
            {!c.unlocked && c.done > 0 && <span className="mt-2 text-xs text-muted-foreground">Progression conservée ({c.done}/{c.lessons}) — reprends avec le bon plan.</span>}
            {!c.unlocked && <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-muted-foreground"><Lock className="size-4" />Plan {planDef(c.minPlan).label}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
