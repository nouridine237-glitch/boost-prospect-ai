import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Globe, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { publicLinkError } from "@/lib/duplication-hub";
import { createPublicLink, getPublicLinkPanel, revokePublicLink } from "@/lib/duplication-hub.functions";

type Lesson = { id: string; title: string; available?: boolean };
const STAT_LABELS: [string, string][] = [["vue", "Visites"], ["lecture_debut", "Lectures"], ["lecture_fin", "Leçons finies"], ["inscription_debut", "Inscriptions lancées"]];

/** Lien public : une leçon offerte sans compte. Le lien complet n'est visible qu'à sa création (seul son empreinte est gardée). */
export function PublicLinkPanel({ courseId, lessons, published }: { courseId: string; lessons: Lesson[]; published: boolean }) {
  const fetchPanel = useServerFn(getPublicLinkPanel), create = useServerFn(createPublicLink), revoke = useServerFn(revokePublicLink);
  const q = useQuery({ queryKey: ["duplication-hub", courseId], queryFn: () => fetchPanel({ data: { courseId } }) });
  const qc = useQueryClient();
  const [lessonId, setLessonId] = useState("");
  const [intro, setIntro] = useState("");
  const [wa, setWa] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = q.data;
  const pick = lessonId || p?.link?.freeLessonId || lessons.find((l) => l.available !== false)?.id || "";

  const make = async () => {
    setBusy(true);
    try {
      const r = await create({ data: { courseId, lessonId: pick, intro, showWhatsapp: wa, expiresDays: null } });
      setFresh(`${window.location.origin}/d/${r.token}`);
      toast.success("Lien public créé");
      await qc.invalidateQueries({ queryKey: ["duplication-hub", courseId] });
    } catch (e) { toast.error(publicLinkError(e)); }
    setBusy(false);
  };
  const stop = async () => {
    if (!p?.link) return;
    setBusy(true);
    try { await revoke({ data: { id: p.link.id } }); setFresh(null); toast.success("Lien retiré : il ne fonctionne plus."); await qc.invalidateQueries({ queryKey: ["duplication-hub", courseId] }); }
    catch (e) { toast.error(publicLinkError(e)); }
    setBusy(false);
  };
  const copy = async (url: string) => { try { await navigator.clipboard.writeText(url); toast.success("Lien copié"); } catch { toast.error("Copie impossible : sélectionne le lien."); } };

  return (
    <div className="surface rounded-2xl p-4">
      <p className="flex items-center gap-2 font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-primary/12 text-primary"><Globe className="size-4" /></span>Lien public</p>
      <p className="mt-2 text-xs text-muted-foreground">Une leçon offerte, visible sans compte. Les autres leçons restent verrouillées : tu les partages ensuite toi-même.</p>
      {q.isLoading ? <div className="mt-3 h-11 animate-pulse rounded-xl bg-muted" />
        : !p?.canLead ? <p className="mt-3 text-sm text-muted-foreground">Le lien public demande le plan Business.</p>
        : !published ? <p className="mt-3 text-sm text-muted-foreground">Publie la formation pour créer un lien public.</p>
        : (
          <div className="mt-3 space-y-3">
            {fresh && (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                <p className="text-xs font-semibold">Copie ce lien maintenant : il ne sera plus affiché ensuite.</p>
                <input readOnly value={fresh} onFocus={(e) => e.currentTarget.select()} aria-label="Lien public" className="mt-2 h-11 w-full rounded-lg border border-border/60 bg-background px-3 text-xs" />
                <Button className="mt-2 min-h-11 w-full" onClick={() => copy(fresh)}><Copy className="size-4" />Copier le lien</Button>
              </div>
            )}
            {p.link && (
              <div className="rounded-xl border border-border/60 p-3 text-sm">
                <p className="font-medium">Lien actif</p>
                <p className="text-xs text-muted-foreground">Leçon offerte : {lessons.find((l) => l.id === p.link!.freeLessonId)?.title ?? "leçon de la version publiée"}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  {STAT_LABELS.map(([k, label]) => <div key={k} className="rounded-lg bg-muted/50 px-2 py-1.5"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{p.stats[k] ?? 0}</dd></div>)}
                </dl>
                <Button variant="outline" className="mt-3 min-h-11 w-full text-destructive" disabled={busy} onClick={stop}><Link2Off className="size-4" />Retirer le lien</Button>
              </div>
            )}
            <label className="block text-xs font-semibold">Leçon offerte
              <select value={pick} onChange={(e) => setLessonId(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-border/60 bg-background px-3 text-sm">
                {lessons.map((l) => <option key={l.id} value={l.id} disabled={l.available === false}>{l.title}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold">Présentation (facultatif)
              <Textarea value={intro} maxLength={400} onChange={(e) => setIntro(e.target.value)} placeholder="Ex. : Je t'accompagne pour démarrer ton activité." className="mt-1" />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground"><Switch checked={wa} onCheckedChange={setWa} />Afficher mon WhatsApp pour les demandes d'accès</label>
            <Button className="min-h-11 w-full" disabled={busy || !pick} onClick={make}>{p.link ? "Créer un nouveau lien (l'ancien s'arrête)" : "Créer le lien public"}</Button>
          </div>
        )}
    </div>
  );
}
