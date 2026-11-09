import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Pause, Play, RotateCcw, Upload, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORIES, checkVideoFile, formatBytes, formatDuration, normalizeType, quotaOf, vtError } from "@/lib/videotheque";
import { createVideoUpload, finalizeVideoUpload, markUploadFailed } from "@/lib/videotheque.functions";
import { readLocalVideo, startResumableUpload, uploadThumb, type LocalMeta, type UploadHandle } from "./upload";

type Phase = "choose" | "details" | "sending" | "paused" | "failed" | "checking";

export function UploadSheet({ open, onOpenChange, plan, usedBytes }: { open: boolean; onOpenChange: (o: boolean) => void; plan: string; usedBytes: number }) {
  const qc = useQueryClient();
  const create = useServerFn(createVideoUpload);
  const finalize = useServerFn(finalizeVideoUpload);
  const failed = useServerFn(markUploadFailed);
  const input = useRef<HTMLInputElement>(null);
  const handle = useRef<UploadHandle | null>(null);
  const started = useRef(0);
  const [phase, setPhase] = useState<Phase>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<LocalMeta | null>(null);
  const [problem, setProblem] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("formation");
  const [rights, setRights] = useState(false);
  const [sent, setSent] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const busy = phase === "sending" || phase === "paused" || phase === "checking";

  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const reset = () => {
    if (meta) URL.revokeObjectURL(meta.previewUrl);
    setPhase("choose"); setFile(null); setMeta(null); setProblem(""); setTitle(""); setDescription(""); setCategory("formation");
    setRights(false); setSent(0); setVideoId(null); setPath(null); handle.current = null;
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setProblem("");
    const type = normalizeType(f.type, f.name);
    if (!type) { setProblem("Format non accepté. Utilise une vidéo MP4, MOV ou WebM."); return; }
    try {
      const m = await readLocalVideo(f);
      const err = checkVideoFile({ size: f.size, type, name: f.name, duration: m.duration }, plan, usedBytes);
      setFile(f); setMeta(m); setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 120));
      if (err) setProblem(err);
      setPhase("details");
    } catch {
      setProblem("Impossible de lire cette vidéo sur cet appareil. Essaie un fichier MP4 (H.264).");
    }
  };

  const send = async () => {
    if (!file || !meta) return;
    const type = normalizeType(file.type, file.name)!;
    try {
      setPhase("sending"); setSent(0); started.current = Date.now();
      const r = videoId && path ? { id: videoId, path, thumbPath: null } : await create({ data: {
        title, description, category, mime: type, size: file.size, duration: meta.duration, withThumb: !!meta.thumb, rights: true as const,
      } });
      setVideoId(r.id); setPath(r.path);
      if (r.thumbPath && meta.thumb) await uploadThumb(r.thumbPath, meta.thumb).catch(() => {});
      handle.current = await startResumableUpload(file, r.path, type, {
        onProgress: (s) => setSent(s),
        onError: () => setPhase("failed"),
        onSuccess: async () => {
          setPhase("checking");
          const res = await finalize({ data: { id: r.id } }).catch(() => ({ status: "echec" }));
          qc.invalidateQueries({ queryKey: ["videotheque"] });
          if (res.status === "pret") { toast.success("Vidéo prête ✓"); reset(); onOpenChange(false); }
          else { setProblem("Le fichier reçu ne correspond pas. Réessaie l'envoi."); setVideoId(null); setPath(null); setPhase("failed"); }
        },
      });
    } catch (e) {
      setProblem(vtError(e, "Envoi refusé.")); setPhase("details");
    }
  };

  const cancel = async () => {
    await handle.current?.cancel();
    if (videoId) await failed({ data: { id: videoId } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["videotheque"] });
    reset();
  };

  const total = file?.size ?? 1;
  const pct = Math.min(100, Math.round((sent / total) * 100));
  const elapsed = (Date.now() - started.current) / 1000;
  const eta = sent > 0 && elapsed > 2 ? Math.round(((total - sent) / sent) * elapsed) : null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (busy && !o) { toast.info("Mets l'envoi en pause ou annule-le avant de fermer."); return; } if (!o) reset(); onOpenChange(o); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Ajouter une vidéo</SheetTitle>
          <SheetDescription>MP4, MOV ou WebM · {formatBytes(quotaOf(plan).maxBytes)} maximum · 60 min maximum.</SheetDescription>
        </SheetHeader>

        <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />

        {phase === "choose" && (
          <div className="mt-4">
            <button type="button" onClick={() => input.current?.click()}
              className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/50 bg-primary/5 p-6 text-sm transition-colors duration-200 hover:bg-primary/10">
              <Upload className="size-6 text-primary" />
              <span className="font-semibold">Choisir dans la galerie</span>
              <span className="text-xs text-muted-foreground">Ou un fichier de l'ordinateur</span>
            </button>
            {problem && <p className="mt-3 flex gap-2 text-sm text-destructive"><AlertTriangle className="size-4 shrink-0" />{problem}</p>}
          </div>
        )}

        {phase !== "choose" && file && meta && (
          <div className="mt-4 space-y-4">
            <video src={meta.previewUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-2xl border border-border/60 bg-muted" />
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {formatDuration(meta.duration)}{file.type === "video/quicktime" ? " · Les vidéos iPhone (HEVC) peuvent ne pas se lire sur certains Android : préfère le MP4." : ""}</p>
            {problem && <p className="flex gap-2 text-sm text-destructive"><AlertTriangle className="size-4 shrink-0" />{problem}</p>}

            {phase === "details" && (
              <>
                <label className="block text-sm font-medium">Titre<Input className="mt-1 min-h-11" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
                <label className="block text-sm font-medium">Description<Textarea className="mt-1" rows={3} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} /></label>
                <div>
                  <span className="text-sm font-medium">Catégorie</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button key={c.key} type="button" onClick={() => setCategory(c.key)} aria-pressed={category === c.key}
                        className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors duration-150 ${category === c.key ? "border-primary/60 bg-primary/12 text-foreground" : "border-border/60 text-muted-foreground"}`}>{c.label}</button>
                    ))}
                  </div>
                </div>
                <label className="flex items-start gap-3 text-sm"><Checkbox checked={rights} onCheckedChange={(v) => setRights(v === true)} className="mt-0.5" />Je détiens les droits sur cette vidéo (aucun contenu d'autrui sans autorisation).</label>
                <div className="flex gap-2">
                  <Button variant="outline" className="min-h-11" onClick={reset}>Changer</Button>
                  <Button className="min-h-11 flex-1" disabled={!!checkVideoFile({ size: file.size, type: normalizeType(file.type, file.name) ?? "", name: file.name, duration: meta.duration }, plan, usedBytes) || title.trim().length < 3 || !rights} onClick={send}>
                    <Upload className="size-4" />Envoyer
                  </Button>
                </div>
              </>
            )}

            {(phase === "sending" || phase === "paused" || phase === "checking" || phase === "failed") && (
              <div className="surface rounded-2xl p-4" aria-live="polite">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{phase === "checking" ? "Vérification…" : phase === "paused" ? "En pause" : phase === "failed" ? "Envoi interrompu" : `${formatBytes(sent)} / ${formatBytes(total)}`}</span>
                  <span className="font-semibold text-foreground">{pct} %{eta && phase === "sending" ? ` · ~${eta > 60 ? `${Math.round(eta / 60)} min` : `${eta} s`}` : ""}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${pct}%` }} /></div>
                <div className="mt-3 flex gap-2">
                  {phase === "sending" && <Button variant="outline" className="min-h-11 flex-1" onClick={() => { handle.current?.pause(); setPhase("paused"); }}><Pause className="size-4" />Pause</Button>}
                  {phase === "paused" && <Button className="min-h-11 flex-1" onClick={() => { handle.current?.resume(); setPhase("sending"); }}><Play className="size-4" />Reprendre</Button>}
                  {phase === "failed" && <Button className="min-h-11 flex-1" onClick={() => { if (handle.current && videoId) { handle.current.resume(); setProblem(""); setPhase("sending"); } else void send(); }}><RotateCcw className="size-4" />Réessayer</Button>}
                  {phase !== "checking" && <Button variant="ghost" className="min-h-11" onClick={cancel}><X className="size-4" />Annuler</Button>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Garde cette page ouverte. En cas de coupure réseau, l'envoi reprend là où il s'est arrêté.</p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
