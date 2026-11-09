import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { HEARTBEAT_MS } from "@/lib/academy-progress";

type Report = { position: number; playing: boolean; duration: number | null };

/**
 * Lecteur de fichier natif. L'URL signée n'est demandée qu'au clic (aucun téléchargement avant).
 * Même interface de suivi que le lecteur YouTube : battement toutes les 15 s pendant la lecture.
 */
export function FilePlayer({ title, thumbUrl, startAt = 0, getUrl, onReport }: {
  title: string; thumbUrl?: string | null; startAt?: number;
  getUrl: () => Promise<string>; onReport?: (r: Report) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [rate, setRate] = useState(1);
  const ref = useRef<HTMLVideoElement>(null);
  const reportRef = useRef(onReport);
  reportRef.current = onReport;

  const send = (playing: boolean) => {
    const v = ref.current;
    if (!v) return;
    reportRef.current?.({ position: v.currentTime || 0, playing, duration: Number.isFinite(v.duration) ? v.duration : null });
  };

  const load = async () => {
    setState("loading");
    try { setUrl(await getUrl()); setState("ready"); }
    catch (e) { setError(e instanceof Error ? e.message : "Lecture impossible."); setState("error"); }
  };

  useEffect(() => {
    if (state !== "ready") return;
    const t = setInterval(() => { const v = ref.current; if (v && !v.paused && document.visibilityState === "visible") send(true); }, HEARTBEAT_MS);
    const onHide = () => { const v = ref.current; if (document.visibilityState === "hidden" && v && !v.paused) send(true); };
    document.addEventListener("visibilitychange", onHide);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onHide); const v = ref.current; if (v && !v.paused) send(false); };
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (ref.current) ref.current.playbackRate = rate; }, [rate, url]);

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-muted">
        {state === "ready" && url ? (
          <video ref={ref} src={url} controls autoPlay playsInline preload="metadata" className="absolute inset-0 size-full bg-background"
            onLoadedMetadata={(e) => { if (startAt > 0) e.currentTarget.currentTime = startAt; }}
            onPlay={() => send(true)} onPause={() => send(false)} onEnded={() => send(false)}
            onError={() => { setState("error"); setError("Cette vidéo ne se lit pas sur cet appareil. Le format HEVC n'est pas lu par tous les téléphones."); }} />
        ) : (
          <button type="button" onClick={load} disabled={state === "loading"} aria-label={`Lire la vidéo : ${title}`} className="group absolute inset-0">
            {thumbUrl ? <img src={thumbUrl} alt="" loading="lazy" className="size-full object-cover opacity-80" /> : null}
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition duration-200 group-hover:scale-105">
                {state === "loading" ? <span className="size-6 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Play className="ml-1 size-7" />}
              </span>
            </span>
          </button>
        )}
      </div>
      {state === "error" && <p className="mt-2 text-sm text-destructive">{error} <button type="button" onClick={load} className="font-semibold underline">Réessayer</button></p>}
      {state === "ready" && (
        <div className="mt-2 flex gap-2" role="group" aria-label="Vitesse de lecture">
          {[1, 1.25, 1.5].map((r) => (
            <button key={r} type="button" onClick={() => setRate(r)} aria-pressed={rate === r}
              className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${rate === r ? "border-primary/60 text-primary" : "border-border/60 text-muted-foreground"}`}>×{String(r).replace(".", ",")}</button>
          ))}
        </div>
      )}
    </div>
  );
}
