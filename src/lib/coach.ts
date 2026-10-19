/** Coach du jour : calculs purs, sans IA. Les dates « jour » sont en heure locale (AAAA-MM-JJ). */
export type CoachProspect = {
  id: string; name: string; status: string; interest_level: number | null; main_objection?: string | null;
  next_followup_date: string | null; last_contact_date: string | null; created_at: string;
};
export type CoachEvent = { type: string; prospect_id: string; content?: string; created_at: string };
export type MissionKind = "relance" | "premier_contact" | "chaud";
export type Priority = "haute" | "moyenne" | "normale";
export type Mission = { prospectId: string; name: string; kind: MissionKind; reason: string; done: boolean; skipped: boolean; score: number; priority: Priority };
export type CoachSettings = { missions: 3 | 5 | 8; restDays: number[]; tone: "amical" | "professionnel" };
export const DEFAULT_COACH: CoachSettings = { missions: 5, restDays: [], tone: "amical" };

/** Lit les réglages du coach depuis profiles.preferences.coach en ignorant les valeurs invalides. */
export function readCoachSettings(prefs: unknown): CoachSettings {
  const c = (prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>)["coach"] : null) as Record<string, unknown> | null;
  if (!c || typeof c !== "object") return DEFAULT_COACH;
  const missions = [3, 5, 8].includes(Number(c["missions"])) ? Number(c["missions"]) as 3 | 5 | 8 : DEFAULT_COACH.missions;
  const restDays = Array.isArray(c["restDays"]) ? [...new Set((c["restDays"] as unknown[]).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
  const tone = c["tone"] === "professionnel" ? "professionnel" : "amical";
  return { missions, restDays, tone };
}
/** Jour de la semaine (0 = dimanche) d'une date AAAA-MM-JJ. */
export function weekday(day: string) { return new Date(day + "T12:00:00").getDay(); }
export function isRestDay(day: string, settings: CoachSettings) { return settings.restDays.includes(weekday(day)); }

/** Score sans IA : retard de relance, intérêt, ancienneté du contact, statut avancé, objection notée. */
export function priorityScore(p: CoachProspect, today: string) {
  let s = 0;
  if (p.next_followup_date && p.next_followup_date <= today) s += 20 + Math.min(30, dayDiff(p.next_followup_date, today) * 10);
  s += p.interest_level === 3 ? 30 : p.interest_level === 2 ? 15 : 0;
  s += p.last_contact_date ? Math.min(20, Math.max(0, dayDiff(localDay(new Date(p.last_contact_date)), today)) * 2) : 10;
  if (p.status === "intéressé" || p.status === "discussion") s += 10;
  if (p.main_objection?.trim()) s += 5;
  return s;
}
export function priorityOf(score: number): Priority { return score >= 50 ? "haute" : score >= 25 ? "moyenne" : "normale"; }

const OBJECTION_KEYWORDS: [string, string[]][] = [
  ["pyramide", ["pyramid", "arnaque"]], ["premiers", ["premiers"]], ["echec", ["essayé", "deja fait", "déjà fait"]],
  ["cher", ["cher", "prix"]], ["argent", ["argent", "budget", "moyens"]], ["conjoint", ["conjoint", "mari", "femme", "famille"]],
  ["entourage", ["les gens", "penser", "regard"]], ["vendre", ["vendre", "vente"]], ["personne", ["connais personne", "pas de contacts", "réseau"]],
  ["efficace", ["marche", "efficace", "fonctionne"]], ["travail", ["travail", "boulot", "emploi"]], ["plus-tard", ["plus tard", "recontacte"]],
  ["reflechir", ["réfléchir", "reflechir"]], ["pas-interesse", ["intéresse pas", "interesse pas"]], ["temps", ["temps", "occupé", "occupe"]],
];
/** Associe l'objection notée sur la fiche à une objection du Gestionnaire (par mots-clés), sinon null. */
export function matchObjectionId(text: string | null | undefined): string | null {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return null;
  return OBJECTION_KEYWORDS.find(([, kws]) => kws.some(k => t.includes(k)))?.[0] ?? null;
}

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

export function buildDailyMissions(prospects: CoachProspect[], events: CoachEvent[], today: string, max = MAX_MISSIONS, settings?: CoachSettings): Mission[] {
  if (settings && isRestDay(today, settings)) return [];
  if (settings) max = settings.missions;
  const todays = events.filter(e => localDay(new Date(e.created_at)) === today);
  const done = new Set(todays.filter(e => e.type === "mission_faite").map(e => e.prospect_id));
  const skipped = new Set(todays.filter(e => e.type === "mission_passée").map(e => e.prospect_id));
  const open = prospects.filter(p => !CLOSED.has(p.status));
  const picked: Mission[] = [];
  const seen = new Set<string>();
  const add = (p: CoachProspect, kind: MissionKind, reason: string) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    const score = priorityScore(p, today);
    picked.push({ prospectId: p.id, name: p.name, kind, reason, done: done.has(p.id), skipped: skipped.has(p.id), score, priority: priorityOf(score) });
  };
  open.filter(p => isFollowupDue(p, today))
    .sort((a, b) => a.next_followup_date! < b.next_followup_date! ? -1 : a.next_followup_date! > b.next_followup_date! ? 1 : 0)
    .forEach(p => { const late = dayDiff(p.next_followup_date!, today); add(p, "relance", late > 0 ? `Relance prévue il y a ${late} jour${late > 1 ? "s" : ""}` : "Relance prévue aujourd'hui"); });
  open.filter(p => p.status === "nouveau" && !p.last_contact_date)
    .sort((a, b) => a.created_at < b.created_at ? -1 : 1)
    .forEach(p => add(p, "premier_contact", "Jamais contacté"));
  open.filter(p => p.interest_level === 3 && (!p.last_contact_date || dayDiff(localDay(new Date(p.last_contact_date)), today) >= 3))
    .forEach(p => add(p, "chaud", p.last_contact_date ? `Prospect chaud, sans contact depuis ${dayDiff(localDay(new Date(p.last_contact_date)), today)} jours` : "Prospect chaud, jamais contacté"));
  // Tri stable par score décroissant (égalité : ordre des catégories), puis plafond.
  return picked.map((m, i) => ({ m, i })).sort((a, b) => b.m.score - a.m.score || a.i - b.i).slice(0, max).map(x => x.m);
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
