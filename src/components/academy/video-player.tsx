import { useState } from "react";
import { Play } from "lucide-react";

/** Lecteur YouTube sans cookies, chargé seulement au clic (léger sur mobile). */
export function VideoPlayer({ videoId, title }: { videoId: string; title: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
      {on ? (
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`Lire la vidéo : ${title}`} className="group absolute inset-0">
          <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover opacity-80" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-hover:scale-105">
              <Play className="ml-1 size-7" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
