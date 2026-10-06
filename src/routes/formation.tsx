import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Award, CheckCircle2, Lock, Target } from "lucide-react";
import { z } from "zod";
import { Brand } from "@/components/brand";
import { lessons } from "@/lib/academy-content";
import { PASS_RATIO, quizzes } from "@/lib/academy-quiz";
import { downloadCertificate } from "@/lib/certificate";

export const Route = createFileRoute("/formation")({
  validateSearch: z.object({ parrain: z.string().optional() }),
  head: () => ({ meta: [
    { title: "Former mon équipe — Formation MLM gratuite | MLM Boost AI" },
    { name: "description", content: "6 niveaux de formation MLM avec quiz et certificat, offerts par ton parrain." },
    { property: "og:title", content: "Formation MLM en 6 niveaux — avec certificat" },
    { property: "og:description", content: "Apprends à prospecter avec méthode et éthique. Quiz et certificat à la fin." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: FormationPage,
});

const KEY = "mlm-formation-progress";
type View = { kind: "home" } | { kind: "lesson"; n: number } | { kind: "quiz"; n: number };

function FormationPage() {
  const { parrain = "" } = Route.useSearch();
  const [passed, setPassed] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [view, setView] = useState<View>({ kind: "home" });

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) ?? "{}"); setPassed(s.passed ?? []); setName(s.name ?? ""); } catch { /* ignore */ }
  }, []);
  const save = (p: number[], n = name) => { setPassed(p); localStorage.setItem(KEY, JSON.stringify({ passed: p, name: n })); };
  const go = (v: View) => { setView(v); window.scrollTo(0, 0); };
  const unlocked = (n: number) => n === 1 || passed.includes(n - 1);
  const done = passed.length >= lessons.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-5 py-4"><div className="mx-auto max-w-[820px]"><Brand /></div></header>
      <main className="mx-auto max-w-[820px] p-5 lg:p-8">
        {view.kind === "home" && (
          <>
            <span className="eyebrow">Formation offerte{parrain ? ` par ${parrain}` : ""}</span>
            <h1 className="mt-2 text-3xl font-extrabold">Former mon équipe.</h1>
            <p className="mt-2 text-sm text-muted-foreground">6 niveaux, un quiz après chacun (80 % pour valider), puis ton certificat.</p>
            <div className="surface mt-5 rounded-lg p-4 text-sm">Progression : <b className="text-primary">{passed.length}/{lessons.length}</b> niveaux validés</div>
            <div className="mt-6 grid gap-3">
              {lessons.map((l) => {
                const ok = passed.includes(l.number), open = unlocked(l.number);
                return (
                  <button key={l.slug} disabled={!open} onClick={() => go({ kind: "lesson", n: l.number })}
                    className="surface flex items-center justify-between rounded-lg p-4 text-left transition hover:border-primary/60 disabled:opacity-50">
                    <div><span className="text-xs text-primary">Niveau {l.number}</span><div className="font-semibold">{l.title}</div></div>
                    {ok ? <CheckCircle2 className="size-5 text-primary" /> : !open ? <Lock className="size-4 text-muted-foreground" /> : null}
                  </button>
                );
              })}
            </div>
            {done && (
              <section className="mt-8 rounded-lg border border-primary/50 bg-primary/10 p-5">
                <h2 className="flex items-center gap-2 font-bold text-primary"><Award className="size-5" />Félicitations, parcours terminé !</h2>
                <label className="mt-3 block text-sm">Ton nom complet (affiché sur le certificat)</label>
                <input value={name} onChange={(e) => { setName(e.target.value); save(passed, e.target.value); }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Ex : Awa Ndiaye" />
                <button disabled={!name.trim()} onClick={() => downloadCertificate(name.trim(), parrain)}
                  className="mt-3 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  Télécharger mon certificat (PDF)
                </button>
              </section>
            )}
          </>
        )}
        {view.kind === "lesson" && <LessonView n={view.n} onBack={() => go({ kind: "home" })} onQuiz={() => go({ kind: "quiz", n: view.n })} />}
        {view.kind === "quiz" && (
          <QuizView n={view.n} onBack={() => go({ kind: "lesson", n: view.n })}
            onPass={() => { if (!passed.includes(view.n)) save([...passed, view.n]); }}
            onNext={() => go(view.n < lessons.length ? { kind: "lesson", n: view.n + 1 } : { kind: "home" })} />
        )}
        <p className="mt-10 text-xs text-muted-foreground">Aucun revenu garanti — outil d’aide à la prospection.</p>
      </main>
    </div>
  );
}

function LessonView({ n, onBack, onQuiz }: { n: number; onBack: () => void; onQuiz: () => void }) {
  const l = lessons[n - 1]!;
  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />Sommaire</button>
      <span className="eyebrow mt-6 block">Niveau {n} / {lessons.length}</span>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight">{l.title}</h1>
      <section className="surface mt-6 rounded-lg border-l-4 border-l-primary p-5">
        <h2 className="flex items-center gap-2 font-bold"><Target className="size-5 text-primary" />Ce que tu vas apprendre</h2>
        <ul className="mt-3 space-y-2 text-sm">{l.objectives.map((o) => <li key={o} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{o}</li>)}</ul>
      </section>
      <article className="lesson-prose mt-8"><ReactMarkdown remarkPlugins={[remarkGfm]}>{l.body}</ReactMarkdown></article>
      <button onClick={onQuiz} className="mt-10 w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">Passer le quiz du Niveau {n}</button>
    </>
  );
}

function QuizView({ n, onBack, onPass, onNext }: { n: number; onBack: () => void; onPass: () => void; onNext: () => void }) {
  const qs = quizzes[n] ?? [];
  const [answers, setAnswers] = useState<(number | null)[]>(qs.map(() => null));
  const [result, setResult] = useState<number | null>(null);
  const ok = result !== null && result / qs.length >= PASS_RATIO;
  const submit = () => { const s = qs.filter((q, i) => answers[i] === q.answer).length; setResult(s); if (s / qs.length >= PASS_RATIO) onPass(); };
  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />Revoir la leçon</button>
      <h1 className="mt-6 text-2xl font-extrabold">Quiz — Niveau {n}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Il faut {Math.ceil(qs.length * PASS_RATIO)}/{qs.length} bonnes réponses pour valider.</p>
      <div className="mt-6 space-y-4">
        {qs.map((q, i) => (
          <div key={q.q} className="surface rounded-lg p-4">
            <p className="font-semibold">{i + 1}. {q.q}</p>
            <div className="mt-3 grid gap-2">
              {q.options.map((o, j) => {
                const sel = answers[i] === j;
                const mark = result !== null ? (j === q.answer ? "border-primary bg-primary/10" : sel ? "border-destructive bg-destructive/10" : "") : sel ? "border-primary bg-primary/10" : "";
                return (
                  <button key={o} disabled={result !== null} onClick={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))}
                    className={`rounded-lg border border-border px-3 py-2 text-left text-sm transition hover:border-primary/60 ${mark}`}>{o}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {result === null ? (
        <button disabled={answers.includes(null)} onClick={submit} className="mt-6 w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">Valider mes réponses</button>
      ) : (
        <div className={`mt-6 rounded-lg border p-5 ${ok ? "border-primary/50 bg-primary/10" : "border-destructive/50 bg-destructive/10"}`}>
          <p className="font-bold">Score : {result}/{qs.length} — {ok ? "Niveau validé !" : "Pas encore, réessaie."}</p>
          <button onClick={ok ? onNext : () => { setAnswers(qs.map(() => null)); setResult(null); }}
            className="mt-3 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            {ok ? (n < lessons.length ? `Passer au Niveau ${n + 1}` : "Obtenir mon certificat") : "Recommencer le quiz"}
          </button>
        </div>
      )}
    </>
  );
}
