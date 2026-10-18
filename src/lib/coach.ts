/** Coach du jour : calculs purs, sans IA. Les dates « jour » sont en heure locale (AAAA-MM-JJ). */
export type CoachProspect = {
  id: string; name: string; status: string; interest_level: number | null;
  next_followup_date: string | null; last_contact_date: string | null; created_at: string;
};
export type CoachEvent = { type: string; prospect_id: string; content?: string; created_at: string };
export type MissionKind = "relance" | "premier_contact" | "chaud";
export type Mission = { prospectId: string; name: string; kind: MissionKind; reason: string; done: boolean; skipped: boolean };

export const MAX_MISSIONS = 5;
const CLOSED = new Set(["client", "non_intéressé"]);
const DAY = 86400000;

export function localDay(d: Date = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const dayDiff = (from: string, to: string) => Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / DAY);

/** Relance prévue aujourd'hui ou en retard (même règle que la file « À relancer »). */
export function isFollowupDue(p: { next_followup_date: string | null }, today: string) {
  return !!p.next_followup_date && p.next_followup_date <= today;
}

export function buildDailyMissions(prospects: CoachProspect[], events: CoachEvent[], today: string, max = MAX_MISSIONS): Mission[] {
  const todays = events.filter(e => localDay(new Date(e.created_at)) === today);
  const done = new Set(todays.filter(e => e.type === "mission_faite").map(e => e.prospect_id));
  const skipped = new Set(todays.filter(e => e.type === "mission_passée").map(e => e.prospect_id));
  const open = prospects.filter(p => !CLOSED.has(p.status));
  const picked: Mission[] = [];
  const seen = new Set<string>();
  const add = (p: CoachProspect, kind: MissionKind, reason: string) => {
    if (seen.has(p.id) || picked.length >= max) return;
    seen.add(p.id);
    picked.push({ prospectId: p.id, name: p.name, kind, reason, done: done.has(p.id), skipped: skipped.has(p.id) });
  };
  open.filter(p => isFollowupDue(p, today))
    .sort((a, b) => a.next_followup_date! < b.next_followup_date! ? -1 : a.next_followup_date! > b.next_followup_date! ? 1 : 0)
    .forEach(p => { const late = dayDiff(p.next_followup_date!, today); add(p, "relance", late > 0 ? `Relance prévue il y a ${late} jour${late > 1 ? "s" : ""}` : "Relance prévue aujourd'hui"); });
  open.filter(p => p.status === "nouveau" && !p.last_contact_date)
    .sort((a, b) => a.created_at < b.created_at ? -1 : 1)
    .forEach(p => add(p, "premier_contact", "Jamais contacté"));
  open.filter(p => p.interest_level === 3 && (!p.last_contact_date || dayDiff(localDay(new Date(p.last_contact_date)), today) >= 3))
    .forEach(p => add(p, "chaud", p.last_contact_date ? `Prospect chaud, sans contact depuis ${dayDiff(localDay(new Date(p.last_contact_date)), today)} jours` : "Prospect chaud, jamais contacté"));
  return picked;
}

export type DailyRecap = { contacts: number; relances: number; nouveaux: number; missionsFaites: number; contactsGoal: number; relancesGoal: number };

/** Bilan du jour fondé uniquement sur les données réelles ; objectif hebdo ramené à la journée (÷5, arrondi au-dessus). */
export function dailyRecap(prospects: CoachProspect[], events: CoachEvent[], goals: { contacts_goal: number; relances_goal: number }, today: string): DailyRecap {
  const todays = events.filter(e => localDay(new Date(e.created_at)) === today);
  const sent = todays.filter(e => e.type === "message_envoyé");
  const createdBefore = new Set(prospects.filter(p => localDay(new Date(p.created_at)) < today).map(p => p.id));
  return {
    contacts: new Set(sent.map(e => e.prospect_id)).size,
    relances: sent.filter(e => createdBefore.has(e.prospect_id)).length + todays.filter(e => e.type === "relance_reportée").length,
    nouveaux: prospects.filter(p => localDay(new Date(p.created_at)) === today).length,
    missionsFaites: new Set(todays.filter(e => e.type === "mission_faite").map(e => e.prospect_id)).size,
    contactsGoal: Math.ceil(goals.contacts_goal / 5),
    relancesGoal: Math.ceil(goals.relances_goal / 5),
  };
}

const CHEERS = [
  "Une conversation à la fois : c'est la régularité qui compte.",
  "Chaque relance faite est une porte laissée ouverte.",
  "Prends le temps d'écouter : la qualité passe avant la quantité.",
  "Bon rythme aujourd'hui. Reste humain et sincère.",
];
export function cheer(today: string) { return CHEERS[Number(today.replaceAll("-", "")) % CHEERS.length]!; }
