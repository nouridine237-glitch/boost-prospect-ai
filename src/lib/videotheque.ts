// Règles pures de la Vidéothèque (partagées navigateur / serveur, testées).
import { planDef, type PlanKey } from "@/lib/plans";

export const VIDEO_BUCKET = "user-videos";
export const MB = 1024 * 1024;
export const GB = 1024 * MB;

/** Mêmes valeurs que la fonction SQL video_quota (source de vérité en base). */
export const VIDEO_QUOTAS: Record<PlanKey, { totalBytes: number; maxBytes: number; perDay: number }> = {
  gratuit: { totalBytes: 0, maxBytes: 0, perDay: 0 },
  pro: { totalBytes: 2 * GB, maxBytes: 200 * MB, perDay: 10 },
  expert: { totalBytes: 5 * GB, maxBytes: 300 * MB, perDay: 20 },
  business: { totalBytes: 15 * GB, maxBytes: 500 * MB, perDay: 40 },
};
export const quotaOf = (plan: string) => VIDEO_QUOTAS[planDef(plan).key];

export const ACCEPTED_TYPES = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" } as const;
export type AcceptedType = keyof typeof ACCEPTED_TYPES;
export const MAX_DURATION_S = 3600;
export const TUS_CHUNK = 6 * MB;
export const PLAY_URL_TTL_S = 3600;
export const PLAY_URLS_PER_HOUR = 60;
export const REVOKE_WINDOW_DAYS = 7;

export const CATEGORIES = [
  { key: "formation", label: "Formation" },
  { key: "presentation", label: "Présentation" },
  { key: "produit", label: "Produit" },
  { key: "temoignage", label: "Témoignage" },
  { key: "motivation", label: "Motivation" },
  { key: "autre", label: "Autre" },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const categoryLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? "Autre";

/** Déduit le type à partir du type déclaré ou de l'extension (certains Android n'en donnent pas). */
export function normalizeType(type: string, name: string): AcceptedType | null {
  if (type in ACCEPTED_TYPES) return type as AcceptedType;
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "mp4" || ext === "m4v") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  return null;
}

/** Vérification avant envoi ; renvoie un message clair ou null. Les mêmes limites sont rejouées en base. */
export function checkVideoFile(f: { size: number; type: string; name: string; duration: number }, plan: string, usedBytes: number): string | null {
  const q = quotaOf(plan);
  if (q.maxBytes === 0) return "L'import de vidéos est disponible à partir du plan Pro.";
  if (!normalizeType(f.type, f.name)) return "Format non accepté. Utilise une vidéo MP4, MOV ou WebM.";
  if (f.size <= 0) return "Fichier vide.";
  if (f.size > q.maxBytes) return `Vidéo trop lourde : ${formatBytes(f.size)} (maximum ${formatBytes(q.maxBytes)} avec ton plan).`;
  if (!Number.isFinite(f.duration) || f.duration < 1) return "Durée de la vidéo illisible. Essaie un fichier MP4.";
  if (f.duration > MAX_DURATION_S) return "Vidéo trop longue : 60 minutes maximum.";
  if (usedBytes + f.size > q.totalBytes) return `Espace insuffisant : il reste ${formatBytes(Math.max(0, q.totalBytes - usedBytes))}.`;
  return null;
}

export function formatBytes(n: number) {
  if (n >= GB) return `${(n / GB).toFixed(1).replace(".", ",")} Go`;
  if (n >= MB) return `${Math.round(n / MB)} Mo`;
  return `${Math.max(1, Math.round(n / 1024))} Ko`;
}
export function formatDuration(s: number) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Durée totale lisible : « 45 min », « 1 h 05 ». */
export function formatTotal(s: number) {
  const m = Math.max(0, Math.round(s / 60));
  if (s > 0 && m === 0) return "< 1 min";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** Débit d'envoi en octets/s sur une fenêtre glissante d'échantillons { t (ms), sent (octets) }. */
export function uploadRate(samples: { t: number; sent: number }[]) {
  if (samples.length < 2) return 0;
  const a = samples[0]!, b = samples[samples.length - 1]!;
  const dt = (b.t - a.t) / 1000;
  return dt >= 1 && b.sent > a.sent ? (b.sent - a.sent) / dt : 0;
}

/** Temps restant lisible, ou null si le débit est inconnu. */
export function formatEta(remainingBytes: number, rate: number) {
  if (rate <= 0 || remainingBytes <= 0) return null;
  const s = Math.ceil(remainingBytes / rate);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.ceil(s / 60)} min`;
  return `${Math.floor(s / 3600)} h ${String(Math.ceil((s % 3600) / 60)).padStart(2, "0")}`;
}

/** Retrait volontaire : en attente toujours, actif seulement dans les 7 jours suivant le partage. */
export function canRevoke(g: { status: string; created_at: string }, now = new Date()) {
  if (g.status === "en_attente") return true;
  if (g.status !== "actif") return false;
  return now.getTime() - new Date(g.created_at).getTime() < REVOKE_WINDOW_DAYS * 86400000;
}

export type SnapshotLesson = { lesson_id: string; title: string; summary: string; module: string; video_id: string; duration: number };

/** Regroupe les leçons par module en gardant l'ordre. */
export function groupByModule<T extends { module: string }>(lessons: T[]) {
  const out: { module: string; items: T[] }[] = [];
  for (const l of lessons) {
    const last = out[out.length - 1];
    if (last && last.module === l.module) last.items.push(l);
    else out.push({ module: l.module, items: [l] });
  }
  return out;
}

const ERRORS: [string, string][] = [
  ["PLAN_PAYANT_REQUIS", "L'import de vidéos est disponible à partir du plan Pro."],
  ["LIMITE_TAILLE", "Vidéo trop lourde pour ton plan."],
  ["LIMITE_STOCKAGE", "Ton espace vidéo est plein. Archive des vidéos ou passe à un plan supérieur."],
  ["LIMITE_IMPORTS", "Limite d'imports du jour atteinte. Réessaie demain."],
  ["PLAN_BUSINESS_REQUIS", "Partager avec une équipe demande le plan Business."],
  ["REPARTAGE_NON_AUTORISE", "Tu n'as pas l'autorisation de repartager cette formation."],
  ["DESTINATAIRE_HORS_EQUIPE", "Une des personnes choisies ne fait plus partie de l'équipe."],
  ["LIMITE_PARTAGES_JOUR", "Limite de 50 partages par jour atteinte."],
  ["LIMITE_DESTINATAIRES", "Limite de 200 destinataires pour cette formation."],
  ["PUBLIER_AVANT", "Publie la formation avant de la partager."],
  ["AUCUNE_LECON", "Ajoute au moins une leçon avec une vidéo prête avant de publier."],
  ["VIDEO_INVALIDE", "Cette vidéo n'est pas disponible (archivée ou pas encore prête)."],
  ["FORMATION_INTROUVABLE", "Formation introuvable."],
];
export function vtError(e: unknown, fallback = "Action impossible pour le moment.") {
  const m = e instanceof Error ? e.message : String(e ?? "");
  return ERRORS.find(([k]) => m.includes(k))?.[1] ?? fallback;
}

export const GRANT_STATUS_LABEL: Record<string, string> = {
  en_attente: "En attente", actif: "Actif", refuse: "Refusé", revoque_proprietaire: "Retiré", retire_moderation: "Retiré (modération)",
};
