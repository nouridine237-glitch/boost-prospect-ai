import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, PlayCircle } from "lucide-react";
import { listVideoCourses } from "@/lib/academy-video.functions";
import { planDef } from "@/lib/plans";

/** Section « Cours vidéo » ; n'apparaît que si un cours est publié. */
export function VideoCoursesSection() {
  const { data } = useQuery({ queryKey: ["video-courses"], queryFn: () => listVideoCourses() });
  if (!data?.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">Cours vidéo</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {data.map((c) => (
          <Link key={c.id} to="/academie/cours/$slug" params={{ slug: c.slug }} className="surface flex flex-col rounded-lg p-5 transition hover:border-primary/60">
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><PlayCircle className="size-4 text-primary" />{c.lessons} leçon{c.lessons > 1 ? "s" : ""} · {c.minutes} min</span>
            <h3 className="mt-2 font-bold">{c.title}</h3>
            {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
            {c.external && <p className="mt-1 text-xs text-muted-foreground">Par {c.author}, avec autorisation</p>}
            {!c.unlocked && <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-muted-foreground"><Lock className="size-4" />Plan {planDef(c.minPlan).name}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
