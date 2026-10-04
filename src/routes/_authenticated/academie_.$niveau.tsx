import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight, CheckCircle2, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getLesson, lessons } from "@/lib/academy-content";

export const Route = createFileRoute("/_authenticated/academie_/$niveau")({
  loader: ({ params }) => {
    const lesson = getLesson(params.niveau);
    if (!lesson) throw notFound();
    return { slug: lesson.slug };
  },
  head: ({ params }) => {
    const l = getLesson(params.niveau);
    const title = l ? `Niveau ${l.number} — ${l.title} | Académie MLM` : "Leçon introuvable";
    const desc = l?.objectives[0] ?? "Leçon de l'Académie MLM Boost AI.";
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
    ]};
  },
  notFoundComponent: () => <div className="p-8">Leçon introuvable. <Link to="/academie" className="text-primary">Retour</Link></div>,
  component: LessonPage,
});

function splitRecap(body: string) {
  const i = body.search(/^## À retenir/m);
  if (i < 0) return { main: body, recap: "" };
  return { main: body.slice(0, i).replace(/\n---\s*$/, ""), recap: body.slice(i).replace(/^## À retenir\s*/, "") };
}

function LessonPage() {
  const { user } = Route.useRouteContext();
  const { slug } = Route.useLoaderData();
  const lesson = getLesson(slug)!;
  const prev = lessons[lesson.number - 2];
  const next = lessons[lesson.number];
  const { main, recap } = splitRecap(lesson.body);

  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[780px] p-5 lg:p-8">
        <Link to="/academie" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" /> Sommaire de l'Académie
        </Link>
        <span className="eyebrow mt-6 block">Niveau {lesson.number} / {lessons.length}</span>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">{lesson.title}</h1>

        <section className="surface mt-6 rounded-lg border-l-4 border-l-primary p-5">
          <h2 className="flex items-center gap-2 font-bold"><Target className="size-5 text-primary" />Ce que tu vas apprendre</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lesson.objectives.map((o) => (
              <li key={o} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{o}</li>
            ))}
          </ul>
        </section>

        <article className="lesson-prose mt-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{main}</ReactMarkdown>
        </article>

        {recap && (
          <section className="mt-8 rounded-lg border border-primary/50 bg-primary/10 p-5 shadow-[0_0_30px_-10px_var(--primary)]">
            <h2 className="flex items-center gap-2 font-bold text-primary"><CheckCircle2 className="size-5" />À retenir</h2>
            <div className="lesson-prose mt-2"><ReactMarkdown remarkPlugins={[remarkGfm]}>{recap}</ReactMarkdown></div>
          </section>
        )}

        <nav className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
          {prev ? (
            <Link to="/academie/$niveau" params={{ niveau: prev.slug }} className="surface flex items-center gap-2 rounded-lg px-4 py-3 text-sm hover:border-primary/60">
              <ArrowLeft className="size-4" /> Niveau {prev.number}
            </Link>
          ) : <span />}
          {next ? (
            <Link to="/academie/$niveau" params={{ niveau: next.slug }} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Passer au Niveau {next.number} — {next.title} <ArrowRight className="size-4" />
            </Link>
          ) : (
            <Link to="/prospects" className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <Trophy className="size-4" /> Parcours terminé — passer à la pratique
            </Link>
          )}
        </nav>
        <p className="mt-8 text-xs text-muted-foreground">Aucun revenu garanti — outil d’aide à la prospection.</p>
      </div>
    </AppShell>
  );
}
