import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FolderOpen, Images, Loader2, Pause, Play, RotateCcw, Upload, WifiOff, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORIES, checkVideoFile, formatBytes, formatDuration, formatEta, normalizeType, quotaOf, uploadRate, vtError } from "@/lib/videotheque";
import { createVideoUpload, finalizeVideoUpload, markUploadFailed } from "@/lib/videotheque.functions";
import { readLocalVideo, startResumableUpload, uploadThumb, type LocalMeta, type UploadHandle } from "./upload";

type Phase = "choose" | "details" | "sending" | "paused" | "failed" | "checking";

export function UploadSheet({ open, onOpenChange, plan, usedBytes }: { open: boolean; onOpenChange: (o: boolean) => void; plan: string; usedBytes: number }) {
  const qc = useQueryClient();
  const create = useServerFn(createVideoUpload);
  const finalize = useServerFn(finalizeVideoUpload);
  const failed = useServerFn(markUploadFailed);
  const input = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const samples = useRef<{ t: number; sent: number }[]>([]);
  const [rate, setRate] = useState(0);
  const [dragging, setDragging] = useState(false);
  const isMobile = useIsMobile();
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
      setPhase("sending"); setSent(0); started.current = Date.now(); samples.current = []; setRate(0);
      const r = videoId && path ? { id: videoId, path, thumbPath: null } : await create({ data: {
        title, description, category, mime: type, size: file.size, duration: meta.duration, withThumb: !!meta.thumb, rights: true as const,
      } });
      setVideoId(r.id); setPath(r.path);
      if (r.thumbPath && meta.thumb) await uploadThumb(r.thumbPath, meta.thumb).catch(() => {});
      handle.current = await startResumableUpload(file, r.path, type, {
        onProgress: (s) => {
          setSent(s);
          const now = Date.now();
          samples.current = [...samples.current.filter((x) => now - x.t < 8000), { t: now, sent: s }];
          setRate(uploadRate(samples.current));
        },
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
  const eta = phase === "sending" ? formatEta(total - sent, rate) : null;
  const pause = () => { handle.current?.pause(); samples.current = []; setRate(0); setPhase("paused"); };
  const resume = () => { handle.current?.resume(); setPhase("sending"); };
  const retry = () => { samples.current = []; setRate(0); if (handle.current && videoId) { handle.current.resume(); setProblem(""); setPhase("sending"); } else void send(); };
  const step = phase === "choose" ? 1 : phase === "details" ? 2 : 3;
  const invalid = file && meta ? !!checkVideoFile({ size: file.size, type: normalizeType(file.type, file.name) ?? "", name: file.name, duration: meta.duration }, plan, usedBytes) : true;

  const onOpen = (o: boolean) => { if (busy && !o) { toast.info("Mets l'envoi en pause ou annule-le avant de fermer."); return; } if (!o) reset(); onOpenChange(o); };
  const heading = "Ajouter une vidéo";
  const sub = `MP4, MOV ou WebM · ${formatBytes(quotaOf(plan).maxBytes)} maximum · 60 min maximum.`;

  const body = (
    <>
      <ol className="mt-3 flex items-center gap-2 text-[11px] font-semibold" aria-label="Étapes">
        {["Choisir", "Détails", "Envoi"].map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={step === i + 1 ? "step" : undefined}>
            <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-[11px] tabular-nums transition-colors duration-200 ${step > i + 1 ? "border-primary bg-primary text-primary-foreground" : step === i + 1 ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
              {step > i + 1 ? <CheckCircle2 className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={step >= i + 1 ? "text-foreground" : "text-muted-foreground"}>{label}</span>
            {i < 2 && <span className={`h-px flex-1 ${step > i + 1 ? "bg-primary" : "bg-border"}`} aria-hidden />}
          </li>
        ))}
      </ol>

      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="sr-only" tabIndex={-1} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={filesInput} type="file" accept=".mp4,.mov,.webm,.m4v" className="sr-only" tabIndex={-1} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />

      {phase === "choose" && (
        <div className="mt-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void pick(e.dataTransfer.files?.[0]); }}
            className={`flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors duration-200 ${dragging ? "border-primary bg-primary/12" : "border-primary/40 bg-primary/5"}`}>
            <span className="grid size-14 place-items-center rounded-full bg-primary/12 text-primary"><Upload className="size-6" aria-hidden /></span>
            <div>
              <p className="font-semibold">{isMobile ? "Choisis ta vidéo" : dragging ? "Dépose la vidéo ici" : "Glisse ta vidéo ici"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{isMobile ? "Depuis la galerie ou tes fichiers." : "ou choisis-la sur ton ordinateur."}</p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-2">
              <Button className="min-h-11" onClick={() => input.current?.click()}><Images className="size-4" />Galerie</Button>
              <Button variant="outline" className="min-h-11" onClick={() => filesInput.current?.click()}><FolderOpen className="size-4" />Fichiers</Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Rien n'est envoyé avant que tu valides. Tes vidéos restent privées.</p>
          {problem && <p role="alert" className="mt-3 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="size-4 shrink-0" />{problem}</p>}
        </div>
      )}

      {phase !== "choose" && file && meta && (
        <div className="mt-4 space-y-4">
          <div className="flex gap-3 rounded-2xl border border-border/60 bg-muted/30 p-2 sm:block sm:p-0 sm:border-0 sm:bg-transparent">
            <video src={meta.previewUrl} controls playsInline preload="metadata" className="aspect-video w-32 shrink-0 rounded-xl bg-muted sm:w-full sm:rounded-2xl sm:border sm:border-border/60" />
            <div className="min-w-0 py-1 sm:mt-2 sm:py-0">
              <p className="truncate text-sm font-semibold sm:hidden">{file.name}</p>
              <p className="text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)} · {formatDuration(meta.duration)}</p>
            </div>
          </div>
          {file.type === "video/quicktime" && <p className="text-xs text-warning">Les vidéos iPhone (HEVC) peuvent ne pas se lire sur certains Android : préfère le MP4.</p>}
          {problem && <p role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="size-4 shrink-0" />{problem}</p>}

          {phase === "details" && (
            <>
              <label className="block text-sm font-medium">Titre<Input className="mt-1 min-h-11" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
              <label className="block text-sm font-medium">Description <span className="font-normal text-muted-foreground">(facultatif)</span><Textarea className="mt-1" rows={3} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} /></label>
              <div>
                <span className="text-sm font-medium">Catégorie</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c.key} type="button" onClick={() => setCategory(c.key)} aria-pressed={category === c.key}
                      className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors duration-150 ${category === c.key ? "border-primary/60 bg-primary/12 text-foreground" : "border-border/60 text-muted-foreground"}`}>{c.label}</button>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-border/60 p-3 text-sm"><Checkbox checked={rights} onCheckedChange={(v) => setRights(v === true)} className="mt-0.5" />Je détiens les droits sur cette vidéo (aucun contenu d'autrui sans autorisation).</label>
              <div className="sticky bottom-0 -mx-1 flex gap-2 bg-background/95 px-1 pb-1 pt-2 backdrop-blur">
                <Button variant="outline" className="min-h-11" onClick={reset}>Changer</Button>
                <Button className="min-h-11 flex-1" disabled={invalid || title.trim().length < 3 || !rights} onClick={send}>
                  <Upload className="size-4" />Envoyer
                </Button>
              </div>
            </>
          )}

          {(phase === "sending" || phase === "paused" || phase === "checking" || phase === "failed") && (
            <div className={`rounded-2xl border p-4 ${phase === "failed" ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-card"}`} aria-live="polite">
              <div className="flex items-start gap-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-full ${phase === "failed" ? "bg-destructive/12 text-destructive" : "bg-primary/12 text-primary"}`}>
                  {phase === "failed" ? <WifiOff className="size-5" aria-hidden /> : phase === "paused" ? <Pause className="size-5" aria-hidden /> : phase === "checking" ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : <Upload className="size-5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{title || file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {phase === "checking" ? "Vérification du fichier…" : phase === "paused" ? "En pause — reprends quand tu veux" : phase === "failed" ? "Envoi interrompu — vérifie ta connexion puis réessaie" : "Envoi en cours"}
                  </p>
                </div>
                <span className="text-lg font-extrabold tabular-nums">{pct}<span className="text-xs font-semibold text-muted-foreground"> %</span></span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression de l'envoi">
                <div className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${phase === "failed" ? "bg-destructive" : phase === "paused" ? "bg-muted-foreground" : "bg-primary"}`} style={{ width: `${pct}%` }} />
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                <div><dt className="sr-only">Envoyé</dt><dd className="tabular-nums"><span className="font-semibold text-foreground">{sent > 0 ? formatBytes(sent) : "0 Ko"}</span> / {formatBytes(total)}</dd></div>
                <div className="text-center"><dt className="sr-only">Vitesse</dt><dd className="tabular-nums">{phase === "sending" && rate > 0 ? `${formatBytes(rate)}/s` : "—"}</dd></div>
                <div className="text-right"><dt className="sr-only">Temps restant</dt><dd className="tabular-nums">{eta ? `~${eta} restant` : "—"}</dd></div>
              </dl>
              <div className="mt-4 flex gap-2">
                {phase === "sending" && <Button variant="outline" className="min-h-11 flex-1" onClick={pause}><Pause className="size-4" />Pause</Button>}
                {phase === "paused" && <Button className="min-h-11 flex-1" onClick={resume}><Play className="size-4" />Reprendre</Button>}
                {phase === "failed" && <Button className="min-h-11 flex-1" onClick={retry}><RotateCcw className="size-4" />Réessayer</Button>}
                {phase !== "checking" && <Button variant="ghost" className="min-h-11" onClick={cancel}><X className="size-4" />Annuler</Button>}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Garde cette page ouverte. En cas de coupure réseau, l'envoi reprend là où il s'est arrêté.</p>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (isMobile) return (
    <Sheet open={open} onOpenChange={onOpen}>
      <SheetContent side="bottom" className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left"><SheetTitle>{heading}</SheetTitle><SheetDescription>{sub}</SheetDescription></SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{heading}</DialogTitle><DialogDescription>{sub}</DialogDescription></DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
