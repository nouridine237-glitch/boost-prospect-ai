export const PATH_DAYS = 7;
export const ACTIONS_PER_DAY = 3;
export const KIT_IDS = ["demarrage", "decouverte", "suivi", "transmission"] as const;
export type KitId = typeof KIT_IDS[number];
export type DuplicationDay = { day: number; title: string; objective: string; explanation: string; actions: string[] };
export type DuplicationKit = { id: KitId; title: string; description: string; category: string; items: { title: string; kind: string; content: string }[] };
export type DayProgress = { day: number; checked_actions: number[]; completed_at: string | null };

export function validActions(actions: number[], count: number) {
  return actions.length <= count && new Set(actions).size === actions.length && actions.every(a => Number.isInteger(a) && a >= 0 && a < count);
}
export function pathState(progress: DayProgress[]) {
  const completed = new Set(progress.filter(p => p.completed_at && p.day >= 1 && p.day <= PATH_DAYS).map(p => p.day));
  const currentDay = Array.from({ length: PATH_DAYS }, (_, i) => i + 1).find(d => !completed.has(d)) ?? PATH_DAYS;
  return { currentDay, completedCount: completed.size, finished: completed.size === PATH_DAYS };
}
export function canCompleteDay(day: number, actions: number[], progress: DayProgress[]) {
  if (!Number.isInteger(day) || day < 1 || day > PATH_DAYS || !validActions(actions, ACTIONS_PER_DAY) || actions.length !== ACTIONS_PER_DAY) return false;
  return Array.from({ length: day - 1 }, (_, i) => i + 1).every(d => progress.some(p => p.day === d && p.completed_at));
}