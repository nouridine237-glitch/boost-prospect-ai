// Envoi reprenable (protocole TUS, morceaux de 6 Mo) et lecture locale des métadonnées.
import { Upload } from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";
import { TUS_CHUNK, VIDEO_BUCKET } from "@/lib/videotheque";

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

export async function startResumableUpload(file: File, objectName: string, contentType: string, cb: {
  onProgress: (sent: number, total: number) => void; onSuccess: () => void; onError: (e: Error) => void;
}): Promise<UploadHandle> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  const upload = new Upload(file, {
    endpoint: `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/upload/resumable`,
    retryDelays: [0, 3000, 5000, 10000, 20000],
    headers: { authorization: `Bearer ${token}`, apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"], "x-upsert": "false" },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    metadata: { bucketName: VIDEO_BUCKET, objectName, contentType, cacheControl: "3600" },
    chunkSize: TUS_CHUNK,
    onProgress: cb.onProgress,
    onSuccess: cb.onSuccess,
    onError: (e) => cb.onError(e instanceof Error ? e : new Error(String(e))),
  });
  const previous = await upload.findPreviousUploads();
  if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
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
