// Calculs purs du tableau de conversion. Aucune donnée inventée : si les données manquent, on renvoie « insufficient ».

export const CONVERSION_STATUSES = ["nouveau", "contacté", "discussion", "intéressé", "client", "non_intéressé"] as const;
export type ConvStatus = (typeof CONVERSION_STATUSES)[number];
/** Libellés écrits par logProspectEvent("changement_statut", "Ancien → Nouveau"). */
const LABEL_TO_STATUS: Record<string, ConvStatus> = { "nouveau": "nouveau", "contacté": "contacté", "discussion": "discussion", "intéressé": "intéressé", "client": "client", "non intéressé": "non_intéressé" };

export type ConvProspect = { id: string; status: string; created_at: string | null; last_contact_date?: string | null; joined_team_at?: string | null };
export type ConvEvent = { prospect_id: string; type: string; content: string | null; created_at: string | null };
export type Metric<T> = { status: "ok"; value: T } | { status: "insufficient"; reason: string };

const insufficient = (reason: string): Metric<never> => ({ status: "insufficient", reason });
function isStatus(s: string): s is ConvStatus { return (CONVERSION_STATUSES as readonly string[]).includes(s); }
/** Date valide en ms, sinon null. */
export function toTime(v: string | null | undefined): number | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/** Nombre de prospects par statut (statuts inconnus comptés à part). */
export function statusDistribution(prospects: ConvProspect[]) {
  const counts = Object.fromEntries(CONVERSION_STATUSES.map(s => [s, 0])) as Record<ConvStatus, number>;
  let unknown = 0;
  for (const p of prospects) { if (isStatus(p.status)) counts[p.status]++; else unknown++; }
  return { total: prospects.length, counts, unknown };
}

/** Taux de conversion = prospects au statut Client / tous les prospects (état actuel, en %). */
export function conversionRate(prospects: ConvProspect[]): Metric<{ clients: number; total: number; rate: number }> {
  if (!prospects.length) return insufficient("Aucun prospect");
  const clients = prospects.filter(p => p.status === "client").length;
  return { status: "ok", value: { clients, total: prospects.length, rate: Math.round((clients / prospects.length) * 1000) / 10 } };
}

/** Conversion d'une cohorte : prospects créés dans [start, end[ et devenus Client (statut actuel). */
export function cohortConversion(prospects: ConvProspect[], start: Date, end: Date): Metric<{ cohort: number; clients: number; rate: number; skippedInvalidDates: number }> {
  const s = start.getTime(), e = end.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return insufficient("Période invalide");
  let skipped = 0;
  const cohort = prospects.filter(p => { const t = toTime(p.created_at); if (t === null) { skipped++; return false; } return t >= s && t < e; });
  if (!cohort.length) return insufficient("Aucun prospect créé sur la période");
  const clients = cohort.filter(p => p.status === "client").length;
  return { status: "ok", value: { cohort: cohort.length, clients, rate: Math.round((clients / cohort.length) * 1000) / 10, skippedInvalidDates: skipped } };
}

/** Lit « Ancien → Nouveau » ; null si le texte n'est pas reconnu. */
export function parseStatusChange(content: string | null | undefined): { from: ConvStatus; to: ConvStatus } | null {
  if (!content) return null;
  const parts = content.split("→").map(x => x.trim().toLowerCase());
  if (parts.length !== 2) return null;
  const from = LABEL_TO_STATUS[parts[0] ?? ""], to = LABEL_TO_STATUS[parts[1] ?? ""];
  return from && to && from !== to ? { from, to } : null;
}

export type Transition = { from: ConvStatus; to: ConvStatus; count: number };
/** Changements de statut enregistrés dans l'historique. Aucun historique → « insufficient ». */
export function statusTransitions(events: ConvEvent[]): Metric<{ transitions: Transition[]; prospects: number; unreadable: number }> {
  const changes = events.filter(e => e.type === "changement_statut");
  if (!changes.length) return insufficient("Aucun changement de statut enregistré");
  const map = new Map<string, Transition>(); const ids = new Set<string>(); let unreadable = 0;
  for (const e of changes) {
    const c = parseStatusChange(e.content);
    if (!c) { unreadable++; continue; }
    ids.add(e.prospect_id);
    const k = `${c.from}>${c.to}`;
    const t = map.get(k) ?? { ...c, count: 0 }; t.count++; map.set(k, t);
  }
  if (!map.size) return insufficient("Changements de statut illisibles");
  return { status: "ok", value: { transitions: [...map.values()].sort((a, b) => b.count - a.count), prospects: ids.size, unreadable } };
}

export const STUCK_DAYS = 7;
const ACTIVE: ConvStatus[] = ["nouveau", "contacté", "discussion", "intéressé"];
/**
 * Prospect bloqué : statut actif (ni Client ni Non intéressé) et aucune activité depuis `days` jours.
 * Dernière activité = plus récente date valide parmi : dernier contact, dernier événement, création.
 * Sans aucune date valide, le prospect est classé « inconnu », jamais « bloqué ».
 */
export function stuckProspects(prospects: ConvProspect[], events: ConvEvent[], now: Date, days = STUCK_DAYS) {
  const last = new Map<string, number>();
  for (const e of events) { const t = toTime(e.created_at); if (t !== null && t > (last.get(e.prospect_id) ?? -Infinity)) last.set(e.prospect_id, t); }
  const stuck: { id: string; status: ConvStatus; idleDays: number }[] = []; const unknown: string[] = [];
  const n = now.getTime();
  for (const p of prospects) {
    if (!isStatus(p.status) || !ACTIVE.includes(p.status)) continue;
    const times = [toTime(p.last_contact_date), toTime(p.created_at), last.get(p.id) ?? null].filter((t): t is number => t !== null);
    if (!times.length) { unknown.push(p.id); continue; }
    const idle = Math.floor((n - Math.max(...times)) / 86_400_000);
    if (idle >= days) stuck.push({ id: p.id, status: p.status, idleDays: idle });
  }
  return { stuck: stuck.sort((a, b) => b.idleDays - a.idleDays), unknown, rule: `Statut actif sans activité depuis ${days} jours ou plus` };
}
