import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessagesSquare, RotateCcw, Send, Settings2, Square, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { objections } from "@/lib/objections";
import { simulatorReply, simulatorReview } from "@/lib/simulator.functions";
import {
  canReview, canSend, DEFAULT_CONFIG, LEVELS, MAX_MESSAGE, MAX_TURNS, MIN_TURNS_FOR_REVIEW, PROFILES, SCENARIOS, userTurns, validateMessage,
  type LevelKey, type ProfileKey, type ScenarioKey, type SimConfig, type SimMessage, type SimPhase, type SimReview,
} from "@/lib/simulator";

export const Route = createFileRoute("/_authenticated/simulateur")({
  head: () => ({ meta: [
    { title: "Simulateur de conversations — MLM Boost AI" },
    { name: "description", content: "Entraînez-vous face à un prospect virtuel et recevez un bilan pédagogique." },
    { property: "og:title", content: "Simulateur de conversations — MLM Boost AI" },
    { property: "og:description", content: "Prospection, objections, invitation : entraînement sans contacter de vrais prospects." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SimulatorPage,
});

function Chips<K extends string>({ label, options, value, onChange }: { label: string; options: Record<K, { label: string }>; value: K; onChange: (k: K) => void }) {
  return <fieldset className="mt-5"><legend className="text-sm font-semibold">{label}</legend>
    <div className="mt-2 flex flex-wrap gap-2">{(Object.keys(options) as K[]).map(k =>
      <Button key={k} type="button" variant={value === k ? "default" : "outline"} aria-pressed={value === k} onClick={() => onChange(k)} className="min-h-11 rounded-full px-4 text-xs">{options[k].label}</Button>)}</div>
  </fieldset>;
}

function SimulatorPage() {
  const { user } = Route.useRouteContext();
  const reply = useServerFn(simulatorReply);
  const review = useServerFn(simulatorReview);
  const [phase, setPhase] = useState<SimPhase>("setup");
  const [config, setConfig] = useState<SimConfig>(DEFAULT_CONFIG);
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimReview | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, pending]);
  useEffect(() => { if (phase === "chat" && !pending) inputRef.current?.focus(); }, [phase, pending]);

  const restart = (keepConfig: boolean) => {
    setMessages([]); setDraft(""); setError(null); setResult(null);
    if (!keepConfig) setConfig(DEFAULT_CONFIG);
    setPhase(keepConfig ? "chat" : "setup");
  };

  async function send() {
    const err = validateMessage(draft);
    if (err) { setError(err); return; }
    if (!canSend(messages, pending)) return;
    const next = [...messages, { role: "user" as const, text: draft.trim() }];
    setMessages(next); setDraft(""); setError(null); setPending(true);
    try {
      const { reply: r } = await reply({ data: { config, messages: next } });
      setMessages([...next, { role: "prospect", text: r }]);
    } catch (e) {
      setMessages(messages); setDraft(next.at(-1)!.text);
      setError(e instanceof Error ? e.message : "Erreur réseau, réessayez.");
    } finally { setPending(false); }
  }

  async function finish() {
    if (!canReview(messages, pending)) return;
    setPending(true); setError(null);
    try {
      const { review: r } = await review({ data: { config, messages } });
      setResult(r); setPhase("review");
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur réseau, réessayez."); }
    finally { setPending(false); }
  }

  const turns = userTurns(messages);
  return <AppShell user={user} title="Simulateur">
    <div className="mx-auto max-w-3xl p-5 lg:p-8">
      <span className="eyebrow">Entraînement</span>
      <h1 className="mt-2 text-3xl font-extrabold">Simulateur de conversations</h1>
      <p className="mt-2 text-sm text-muted-foreground">Entraînez-vous face à un prospect virtuel créé par l'IA. Aucun vrai prospect n'est contacté, aucun message n'est envoyé. Chaque réplique et le bilan comptent pour 1 génération IA de votre plan.</p>

      {phase === "setup" && <section className="surface mt-6 rounded-lg p-5">
        <h2 className="flex items-center gap-2 font-bold"><Settings2 className="size-4 text-primary" />Préparer la simulation</h2>
        <Chips label="Scénario" options={SCENARIOS} value={config.scenario} onChange={(k: ScenarioKey) => setConfig(c => ({ ...c, scenario: k, objectionId: k === "objection" ? c.objectionId ?? objections[0]!.id : null }))} />
        {config.scenario === "objection" && <label className="mt-4 block text-sm font-semibold">Objection à travailler
          <select value={config.objectionId ?? ""} onChange={e => setConfig(c => ({ ...c, objectionId: e.target.value }))} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
            {objections.map(o => <option key={o.id} value={o.id}>{o.objection}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">Besoin d'aide ? <Link to="/objections" search={{ o: config.objectionId ?? undefined }} className="text-primary underline">Voir la réponse conseillée</Link></span>
        </label>}
        <Chips label="Difficulté" options={LEVELS} value={config.level} onChange={(k: LevelKey) => setConfig(c => ({ ...c, level: k }))} />
        <Chips label="Profil du prospect" options={PROFILES} value={config.profile} onChange={(k: ProfileKey) => setConfig(c => ({ ...c, profile: k }))} />
        <p className="mt-5 rounded-md bg-secondary p-3 text-sm"><strong>Objectif :</strong> {SCENARIOS[config.scenario].goal}<br /><span className="text-muted-foreground">{SCENARIOS[config.scenario].situation}</span></p>
        <Button className="mt-5 min-h-11 w-full sm:w-auto" onClick={() => setPhase("chat")}><MessagesSquare className="size-4" />Commencer la simulation</Button>
      </section>}

      {phase === "chat" && <section className="surface mt-6 flex flex-col rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 text-xs text-muted-foreground">
          <span>{SCENARIOS[config.scenario].label} · {LEVELS[config.level].label} · {PROFILES[config.profile].label}</span>
          <span>{turns}/{MAX_TURNS} messages</span>
        </div>
        <div className="max-h-[60vh] min-h-64 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {!messages.length && <p className="py-10 text-center text-sm text-muted-foreground">Écrivez votre premier message au prospect, comme sur WhatsApp.<br />{SCENARIOS[config.scenario].situation}</p>}
          {messages.map((m, i) => <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2"}>
            {m.role === "prospect" && <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary"><UserRound className="size-4 text-primary" /></span>}
            <p className={m.role === "user" ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground" : "max-w-[85%] whitespace-pre-wrap py-1 text-sm"}>
              <span className="sr-only">{m.role === "user" ? "Vous : " : "Prospect virtuel : "}</span>{m.text}</p>
          </div>)}
          {pending && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Le prospect virtuel écrit…</p>}
          <div ref={endRef} />
        </div>
        {error && <p role="alert" className="mx-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <form className="border-t border-border p-4" onSubmit={e => { e.preventDefault(); void send(); }}>
          <Textarea ref={inputRef} aria-label="Votre réponse" value={draft} maxLength={MAX_MESSAGE} disabled={!canSend(messages, pending)} placeholder={turns >= MAX_TURNS ? "Nombre maximum de messages atteint : demandez votre bilan." : "Votre message au prospect…"}
            onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={2} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{draft.length}/{MAX_MESSAGE}</span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => restart(false)} disabled={pending}>Changer de scénario</Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => void finish()} disabled={!canReview(messages, pending)} title={`Au moins ${MIN_TURNS_FOR_REVIEW} messages`}><Square className="size-4" />Terminer et voir le bilan</Button>
              <Button type="submit" className="min-h-11" disabled={!canSend(messages, pending) || !draft.trim()}><Send className="size-4" />Envoyer</Button>
            </div>
          </div>
        </form>
      </section>}

      {phase === "review" && result && <ReviewView r={result} onRestart={() => restart(true)} onChange={() => restart(false)} />}
      <p className="mt-8 text-center text-xs text-muted-foreground">Prospect fictif généré par l'IA — aucun revenu garanti</p>
    </div>
  </AppShell>;
}

function List({ title, items }: { title: string; items: string[] }) {
  return <div><h3 className="font-semibold">{title}</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{items.map((t, i) => <li key={i}>{t}</li>)}</ul></div>;
}

function ReviewView({ r, onRestart, onChange }: { r: SimReview; onRestart: () => void; onChange: () => void }) {
  return <section className="surface mt-6 space-y-5 rounded-lg p-5">
    <div className="flex items-center gap-4">
      <span className="grid size-20 shrink-0 place-items-center rounded-full border-4 border-primary text-2xl font-extrabold">{r.score}</span>
      <div><h2 className="text-xl font-bold">Votre bilan</h2><p className="text-xs text-muted-foreground">Score indicatif sur 100, donné par l'IA pour vous guider : ce n'est pas une mesure scientifique.</p></div>
    </div>
    <List title="Points forts" items={r.strengths} />
    <List title="Erreurs ou occasions manquées" items={r.mistakes} />
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {([["Écoute et découverte des besoins", r.listening], ["Traitement des objections", r.objections], ["Clarté et naturel", r.clarity], ["Prochaine étape / closing", r.closing]] as const).map(([k, v]) =>
        <div key={k} className="rounded-md bg-secondary p-3"><dt className="font-semibold">{k}</dt><dd className="mt-1 text-muted-foreground">{v}</dd></div>)}
    </dl>
    <List title="3 conseils concrets" items={r.tips} />
    <div><h3 className="font-semibold">Exemple de meilleure réponse</h3><blockquote className="mt-1 border-l-2 border-primary pl-3 text-sm italic">{r.better_reply}</blockquote></div>
    <div className="flex flex-wrap gap-2">
      <Button className="min-h-11" onClick={onRestart}><RotateCcw className="size-4" />Recommencer</Button>
      <Button variant="outline" className="min-h-11" onClick={onChange}>Changer de scénario</Button>
    </div>
  </section>;
}
