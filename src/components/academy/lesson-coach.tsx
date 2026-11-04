import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askLessonCoach } from "@/lib/academy-coach.functions";
import type { CoachTurn } from "@/lib/academy-coach";

/** Coach IA de la leçon : appelé uniquement au clic, 1 génération IA par question. */
export function LessonCoach({ lessonId }: { lessonId: string }) {
  const ask = useServerFn(askLessonCoach);
  const [turns, setTurns] = useState<CoachTurn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    const question = q.trim();
    if (question.length < 3 || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await ask({ data: { lessonId, question, history: turns } });
      setTurns((t) => [...t, { role: "user", text: question }, { role: "assistant", text: r.text }]);
      setQ("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally { setBusy(false); }
  }

  return (
    <section className="surface mt-6 rounded-lg p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-primary" />Coach de la leçon</h3>
      <p className="mt-1 text-xs text-muted-foreground">Posez une question sur cette leçon. Chaque réponse compte pour 1 génération IA.</p>
      {turns.length > 0 && (
        <div className="mt-3 space-y-2">
          {turns.map((t, i) => (
            <div key={i} className={`whitespace-pre-wrap rounded-lg p-3 text-sm ${t.role === "user" ? "ml-8 bg-primary/15" : "mr-4 bg-muted"}`}>{t.text}</div>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Textarea value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} rows={2}
          placeholder="Ex. : comment appliquer ça avec un prospect hésitant ?" aria-label="Question au coach" />
        <Button type="button" onClick={send} disabled={busy || q.trim().length < 3} aria-label="Envoyer la question" className="self-end">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </section>
  );
}
