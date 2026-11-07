/** Calculs purs de progression des leçons vidéo (aucun accès réseau). */
export type LessonState = "non_commencee" | "en_cours" | "terminee";
export type ProgressRow = { lesson_id: string; status: string; position_seconds: number; watched_seconds: number; duration_seconds: number | null; last_activity_at: string };
export type LessonProgress = { state: LessonState; position: number; percent: number };

export const COMPLETION_RATIO = 0.8;
export const MANUAL_RATIO = 0.6;
export const HEARTBEAT_MS = 15_000;

/** Absence de ligne = non commencée ; l'ouverture seule n'écrit rien. */
export function lessonProgress(row: ProgressRow | undefined, fallbackSeconds: number): LessonProgress {
  if (!row) return { state: "non_commencee", position: 0, percent: 0 };
  const dur = Math.max(row.duration_seconds ?? fallbackSeconds, 1);
  if (row.status === "terminee") return { state: "terminee", position: row.position_seconds, percent: 100 };
  return { state: "en_cours", position: row.position_seconds, percent: Math.min(99, Math.round((row.watched_seconds / dur) * 100)) };
}

/** Pourcentage d'un cours : leçons terminées / leçons publiées actuelles (les lignes orphelines sont ignorées). */
export function courseProgress(lessonIds: string[], rows: ProgressRow[]) {
  const ids = new Set(lessonIds);
  const done = rows.filter((r) => ids.has(r.lesson_id) && r.status === "terminee").length;
  return { done, total: lessonIds.length, percent: lessonIds.length ? Math.round((done / lessonIds.length) * 100) : 0 };
}

/** Leçon à reprendre : la plus récemment active non terminée, sinon la première non terminée. */
export function resumeLesson(lessonIds: string[], rows: ProgressRow[]): string | null {
  const ids = new Set(lessonIds);
  const active = rows.filter((r) => ids.has(r.lesson_id) && r.status !== "terminee").sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))[0];
  if (active) return active.lesson_id;
  const done = new Set(rows.filter((r) => r.status === "terminee").map((r) => r.lesson_id));
  return lessonIds.find((id) => !done.has(id)) ?? null;
}

/** Reprise : on ne reprend pas dans les 10 dernières secondes ni avant 5 s. */
export function resumeAt(position: number, durationSeconds: number) {
  if (position < 5 || position > durationSeconds - 10) return 0;
  return Math.floor(position);
}

/** Miroir de la règle SQL : crédit borné par l'horloge, l'avancée réelle et 30 s. */
export function creditSeconds(prevPlaying: boolean, elapsedSec: number, prevPos: number, pos: number) {
  if (!prevPlaying) return 0;
  return Math.max(0, Math.min(Math.floor(elapsedSec), Math.max(pos - prevPos + 2, 0), 30));
}

export function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
