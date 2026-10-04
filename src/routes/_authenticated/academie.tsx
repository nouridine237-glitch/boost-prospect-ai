import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { lessons } from "@/lib/academy-content";

export const Route = createFileRoute("/_authenticated/academie")({
  head: () => ({ meta: [
    { title: "Académie MLM — MLM Boost AI" },
    { name: "description", content: "6 niveaux de formation pour prospecter avec méthode et éthique." },
    { property: "og:title", content: "Académie MLM — MLM Boost AI" },
    { property: "og:description", content: "Comprendre le MLM, prospecter, suivre ses prospects et animer une équipe." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: AcademiePage,
});

function AcademiePage() {
  const { user } = Route.useRouteContext();
  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[1000px] p-5 lg:p-8">
        <span className="eyebrow">Formation</span>
        <h1 className="mt-2 text-3xl font-extrabold">Académie MLM.</h1>
        <p className="mt-2 text-sm text-muted-foreground">6 niveaux pour bâtir une activité structurée, honnête et durable.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {lessons.map((l) => (
            <Link key={l.slug} to="/academie/$niveau" params={{ niveau: l.slug }}
              className="surface group flex flex-col rounded-lg p-5 transition hover:border-primary/60">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-sm font-extrabold text-primary">{l.number}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" />{l.minutes} min</span>
              </div>
              <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">Niveau {l.number}</span>
              <h2 className="mt-1 font-bold">{l.title}</h2>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {l.objectives.slice(0, 2).map((o) => <li key={o} className="line-clamp-1">• {o}</li>)}
              </ul>
              <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                Commencer la leçon <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><GraduationCap className="size-4" />Aucun revenu garanti — outil d’aide à la prospection.</p>
      </div>
    </AppShell>
  );
}
