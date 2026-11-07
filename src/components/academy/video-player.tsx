import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { HEARTBEAT_MS } from "@/lib/academy-progress";

type Report = { position: number; playing: boolean; duration: number | null };
type YTPlayer = { getCurrentTime(): number; getDuration(): number; destroy(): void };

let apiPromise: Promise<boolean> | null = null;
/** Charge l'API IFrame YouTube une seule fois ; false si bloquée ou trop lente (8 s). */
function loadYouTubeApi(): Promise<boolean> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(true);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => { apiPromise = null; resolve(false); }, 8000);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); clearTimeout(timer); resolve(true); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => { clearTimeout(timer); apiPromise = null; resolve(false); };
    document.head.appendChild(s);
  });
  return apiPromise;
}

/**
 * Lecteur YouTube sans cookies, chargé au clic. Avec l'API : position et état de lecture
 * envoyés toutes les 15 s pendant la lecture, et à pause/fin/onglet masqué/fermeture.
 * Sans API (bloquée) : iframe simple, `onFallback` permet d'afficher la validation manuelle.
 */
export function VideoPlayer({ videoId, title, startAt = 0, onReport, onFallback }: {
  videoId: string; title: string; startAt?: number;
  onReport?: (r: Report) => void; onFallback?: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "loading" | "api" | "iframe">("idle");
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const playing = useRef(false);
  const reportRef = useRef(onReport);
  reportRef.current = onReport;

  const send = (isPlaying: boolean) => {
    const p = player.current;
    if (!p) return;
    try {
      const d = p.getDuration();
      reportRef.current?.({ position: p.getCurrentTime() || 0, playing: isPlaying, duration: d > 0 ? d : null });
    } catch { /* lecteur détruit */ }
  };

  useEffect(() => {
    if (mode !== "loading") return;
    let cancelled = false;
    loadYouTubeApi().then((ok) => {
      if (cancelled) return;
      if (!ok || !host.current) { setMode("iframe"); onFallback?.(); reportRef.current?.({ position: 0, playing: false, duration: null }); return; }
      const YT = (window as any).YT;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player.current = new YT.Player(el, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, start: startAt, origin: window.location.origin },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.PLAYING) { if (!playing.current) { playing.current = true; send(true); } }
            else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) { if (playing.current) { playing.current = false; send(false); } }
          },
        },
      });
      setMode("api");
    });
    return () => { cancelled = true; };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== "api") return;
    const t = setInterval(() => { if (playing.current && document.visibilityState === "visible") send(true); }, HEARTBEAT_MS);
    const onHide = () => { if (document.visibilityState === "hidden" && playing.current) send(true); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      if (playing.current) send(false);
      playing.current = false;
      player.current?.destroy();
      player.current = null;
      if (host.current) host.current.innerHTML = "";
    };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
      {mode === "iframe" ? (
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1${startAt ? `&start=${startAt}` : ""}`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : mode === "idle" ? (
        <button type="button" onClick={() => setMode("loading")} aria-label={`Lire la vidéo : ${title}`} className="group absolute inset-0">
          <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover opacity-80" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-hover:scale-105">
              <Play className="ml-1 size-7" />
            </span>
          </span>
        </button>
      ) : (
        <div className="absolute inset-0">
          <div ref={host} className="absolute inset-0 [&>div]:size-full [&_iframe]:size-full" />
          {mode === "loading" && <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Chargement de la vidéo…</span>}
        </div>
      )}
    </div>
  );
}
