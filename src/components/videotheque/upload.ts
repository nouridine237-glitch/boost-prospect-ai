// Envoi reprenable (protocole TUS, morceaux de 6 Mo) et lecture locale des métadonnées.
import { Upload } from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";
import { SESSION_EXPIRED, TUS_CHUNK, VIDEO_BUCKET, isSameUploadTarget, shouldRetryTus, tusFingerprint } from "@/lib/videotheque";

export type LocalMeta = { duration: number; thumb: Blob | null; previewUrl: string };

/** Lit la durée et capture une petite image (≈ 320 px) sans rien envoyer. */
export function readLocalVideo(file: File): Promise<LocalMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata"; v.muted = true; v.playsInline = true; v.src = url;
    let duration = 0;
    const timer = setTimeout(() => (duration ? resolve({ duration, thumb: null, previewUrl: url }) : reject(new Error("illisible"))), 10000);
    v.onerror = () => { clearTimeout(timer); reject(new Error("illisible")); };
    v.onloadedmetadata = () => {
      duration = Number.isFinite(v.duration) ? v.duration : 0;
      v.currentTime = Math.min(1, duration / 3 || 0.1);
    };
    v.onseeked = () => {
      try {
        const w = 320, h = Math.round((v.videoHeight / Math.max(v.videoWidth, 1)) * w) || 180;
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d")?.drawImage(v, 0, 0, w, h);
        c.toBlob((b) => { clearTimeout(timer); resolve({ duration, thumb: b, previewUrl: url }); }, "image/jpeg", 0.7);
      } catch { clearTimeout(timer); resolve({ duration, thumb: null, previewUrl: url }); }
    };
  });
}

export type UploadHandle = { pause: () => void; resume: () => void; cancel: () => Promise<void> };

/** Jeton à jour : getSession rafraîchit un jeton expiré ; refresh forcé si demandé (après un 401/403). */
async function freshToken(force = false) {
  if (force) { const { data } = await supabase.auth.refreshSession(); if (data.session) return data.session.access_token; }
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (s && (s.expires_at ?? 0) * 1000 - Date.now() < 60_000) {
    const { data: r } = await supabase.auth.refreshSession();
    if (r.session) return r.session.access_token;
  }
  return s?.access_token ?? null;
}

export const isSessionExpired = (e: unknown) => e instanceof Error && e.message.includes(SESSION_EXPIRED);

export async function startResumableUpload(file: File, objectName: string, contentType: string, cb: {
  onProgress: (sent: number, total: number) => void; onSuccess: () => void; onError: (e: Error) => void;
}): Promise<UploadHandle> {
  if (!(await freshToken())) throw new Error("Session expirée. Reconnecte-toi.");
  let forceRefresh = false;
  const upload = new Upload(file, {
    endpoint: `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/upload/resumable`,
    retryDelays: [0, 3000, 5000, 10000, 20000],
    headers: { apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"], "x-upsert": "false" },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    // Empreinte propre à cette vidéo : une reprise ne peut viser que son propre chemin.
    fingerprint: async () => tusFingerprint(objectName),
    metadata: { bucketName: VIDEO_BUCKET, objectName, contentType, cacheControl: "3600" },
    chunkSize: TUS_CHUNK,
    onBeforeRequest: async (req) => {
      const token = await freshToken(forceRefresh);
      forceRefresh = false;
      if (!token) throw new Error(SESSION_EXPIRED);
      req.setHeader("authorization", `Bearer ${token}`);
    },
    onShouldRetry: (err, attempt) => {
      const status = (err as any)?.originalResponse?.getStatus?.() as number | undefined;
      if (status === 401 || status === 403) forceRefresh = true;
      if (isSessionExpired((err as any)?.causingError ?? err)) return false;
      return shouldRetryTus(status, attempt);
    },
    onProgress: cb.onProgress,
    onSuccess: cb.onSuccess,
    onError: (e) => {
      const cause = (e as any)?.causingError ?? e;
      cb.onError(isSessionExpired(cause) || isSessionExpired(e) ? new Error(SESSION_EXPIRED) : e instanceof Error ? e : new Error(String(e)));
    },
  });
  const previous = await upload.findPreviousUploads();
  const same = previous.find((p) => isSameUploadTarget(p, objectName));
  if (same) upload.resumeFromPreviousUpload(same);
  upload.start();
  return {
    pause: () => { void upload.abort(); },
    resume: () => upload.start(),
    cancel: async () => { await upload.abort(true).catch(() => {}); },
  };
}

export async function uploadThumb(path: string, blob: Blob) {
  await supabase.storage.from(VIDEO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
}
