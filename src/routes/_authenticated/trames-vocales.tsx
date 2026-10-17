import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, Mic, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { totalSeconds, voiceScripts, voiceText, type VoiceScript } from "@/lib/voice-scripts";

export const Route = createFileRoute("/_authenticated/trames-vocales")({
  head: () => ({ meta: [
    { title: "Trames vocales WhatsApp — MLM Boost AI" },
    { name: "description", content: "Trames chronométrées pour enregistrer des messages vocaux WhatsApp naturels et sans pression." },
    { property: "og:title", content: "Trames vocales WhatsApp — MLM Boost AI" },
    { property: "og:description", content: "Des vocaux courts, guidés étape par étape avec un chronomètre." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: VoicePage,
});

function VoicePage() {
  const { user } = Route.useRouteContext();
  return <AppShell user={user} title="Trames vocales">
    <div className="mx-auto max-w-6xl p-5 lg:p-8">
      <span className="eyebrow">WhatsApp</span>
      <h1 className="mt-2 text-3xl font-extrabold">Trames vocales guidées</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">Lance le chrono, lis chaque étape à voix haute avec tes mots et enregistre ton vocal WhatsApp en même temps. Moins de 45 secondes, c'est idéal.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">{voiceScripts.map(v => <VoiceCard key={v.id} v={v} />)}</div>
      <p className="mt-8 text-center text-xs text-muted-foreground">Aucun revenu garanti — outil d'aide à la prospection</p>
    </div>
  </AppShell>;
}

function VoiceCard({ v }: { v: VoiceScript }) {
  const total = totalSeconds(v);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setT(x => { if (x + 1 >= total) { setRunning(false); return total; } return x + 1; }), 1000);
    return () => clearInterval(id);
  }, [running, total]);
  let acc = 0;
  const active = v.steps.findIndex(s => { acc += s.seconds; return t < acc; });
  const copy = async () => { try { await navigator.clipboard.writeText(voiceText(v)); toast.success("Trame copiée"); } catch { toast.error("La copie a échoué."); } };
  const aiContext = `Adapte cette trame de message vocal WhatsApp (moins de 45 secondes, ton naturel, sans pression ni promesse de revenu) pour mon prospect.\nSituation : ${v.situation}\nTrame :\n${voiceText(v)}`;
  return <article className="surface flex min-w-0 flex-col rounded-lg p-5">
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-primary">{v.goal}</span><span className="text-xs text-muted-foreground">~{total} s</span></div>
    <h2 className="mt-2 text-base font-bold">{v.situation}</h2>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${(t / total) * 100}%` }} /></div>
    <ol className="mt-4 flex-1 space-y-3 text-sm leading-6">{v.steps.map((s, i) => <li key={s.label} className={`rounded-md p-2 ${(running || t > 0) && i === active ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}>
      <span className="text-xs font-bold text-primary">{i + 1}. {s.label} · {s.seconds} s</span><p className="text-muted-foreground">{s.text}</p></li>)}</ol>
    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
      <Button className="min-h-11" onClick={() => { if (t >= total) setT(0); setRunning(r => !r); }}>{running ? <Pause /> : t > 0 && t < total ? <Play /> : <Mic />}{running ? "Pause" : t > 0 && t < total ? "Reprendre" : "Démarrer"} · {t} s</Button>
      {t > 0 && <Button variant="ghost" className="min-h-11" aria-label="Recommencer" onClick={() => { setRunning(false); setT(0); }}><RotateCcw /></Button>}
      <Button variant="outline" className="min-h-11" onClick={copy}><Copy />Copier</Button>
      <Button variant="outline" className="min-h-11" asChild><Link to="/assistant" search={{ context: aiContext }}><Sparkles />Adapter avec l'IA</Link></Button>
    </div>
  </article>;
}
