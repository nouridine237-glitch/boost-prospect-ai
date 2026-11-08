// Plan d'action 30 jours : règles pures. Les « réalisés » sont toujours recalculés depuis les données existantes ; rien n'est saisi ni estimé.
import { hasFeature } from "@/lib/plans";
import { localDay, weeklyRecap, type CoachEvent, type CoachProspect } from "@/lib/coach";

export const GOALS = { clients: "Trouver des clients", recruter: "Recruter des partenaires", relancer: "Relancer mes prospects" } as const;
export type Goal = keyof typeof GOALS;
export const TARGET_LABEL: Record<Goal, string> = { clients: "nouveaux clients visés", recruter: "recrues visées (rejoint l'équipe)", relancer: "prospects à relancer" };
export const MINUTES = [15, 30, 60] as const;
export type Minutes = (typeof MINUTES)[number];
/** Actions (contacts + relances) réalistes par jour travaillé selon le temps disponible. */
export const CAPACITY: Record<Minutes, number> = { 15: 3, 30: 6, 60: 10 };
const POSTS_PER_WEEK: Record<Minutes, number> = { 15: 3, 30: 5, 60: 7 };
/** Progression sur 4 semaines (somme = 4). */
export const RAMP = [0.8, 1, 1.1, 1.1] as const;
export const MIN_SAMPLE = 5;
/** Hypothèses prudentes affichées comme telles quand l'historique est insuffisant. */
export const DEFAULT_RATE: Record<"clients" | "recruter", number> = { clients: 1 / 20, recruter: 1 / 40 };
export const ADAPT_THRESHOLD = 0.7;
export const PLAN_DAYS = 28;

export type WeekTargets = { contacts: number; relances: number; posts: number };
export type PlanRow = { id: string; goal: string; target: number; minutes_per_day: number; rest_days: number[]; starts_on: string; ends_on: string; campaign_id: string | null; status: string };
export type WeekRow = { id: string; plan_id: string; week_index: number; contacts_target: number; relances_target: number; posts_target: number; adjusted: boolean; adjust_note: string; reviewed_at: string | null };
export type Rate = { rate: number; personal: boolean; sample: number };

export const canUseActionPlan = (plan: string) => hasFeature(plan, "actionPlan");

const shift = (day: string, n: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return localDay(d); };
const dow = (day: string) => new Date(`${day}T12:00:00`).getDay();
export const addDays = shift;
export function mondayOf(day: string) { return shift(day, -((dow(day) + 6) % 7)); }
export function workDays(restDays: number[]) { return Math.max(1, 7 - new Set(restDays.filter(d => d >= 0 && d <= 6)).size); }
export function weekStart(plan: Pick<PlanRow, "starts_on">, index: number) { return shift(plan.starts_on, (index - 1) * 7); }

/** Taux personnel si au moins 5 prospects et au moins 1 succès ; sinon hypothèse prudente. */
export function conversionRate(goal: Goal, prospects: { status: string; joined_team_at?: string | null }[]): Rate | null {
  if (goal === "relancer") return null;
  const wins = prospects.filter(p => goal === "clients" ? p.status === "client" : !!p.joined_team_at).length;
  if (prospects.length >= MIN_SAMPLE && wins > 0) return { rate: wins / prospects.length, personal: true, sample: prospects.length };
  return { rate: DEFAULT_RATE[goal], personal: false, sample: prospects.length };
}

/** Répartition sur 4 semaines, plafonnée par la capacité réelle (temps × jours travaillés). */
export function buildWeeks(goal: Goal, target: number, minutes: Minutes, restDays: number[], rate: Rate | null): { weeks: WeekTargets[]; capped: boolean } {
  const t = Math.max(1, Math.min(50, Math.round(target)));
  let contactsTotal: number, relancesTotal: number;
  if (goal === "relancer") { relancesTotal = t * 2; contactsTotal = Math.ceil(t / 2); }
  else { contactsTotal = Math.ceil(t / (rate?.rate ?? DEFAULT_RATE[goal])); relancesTotal = Math.ceil(contactsTotal / 2); }
  const cap = CAPACITY[minutes] * workDays(restDays);
  const posts = Math.min(POSTS_PER_WEEK[minutes], workDays(restDays));
  let capped = false;
  const weeks = RAMP.map(r => {
    let c = Math.ceil((contactsTotal / 4) * r), rl = Math.ceil((relancesTotal / 4) * r);
    if (c + rl > cap) { capped = true; const k = cap / (c + rl); c = Math.floor(c * k); rl = Math.max(0, cap - c); }
    return { contacts: c, relances: rl, posts };
  });
  return { weeks, capped };
}

export type Actuals = { contacts: number; relances: number; posts: number; clients: number; recrues: number };
/** Réalisé d'une semaine : mêmes règles que le bilan du Coach + statuts publiés + recrues (rejoint l'équipe). */
export function weekActuals(monday: string, prospects: (CoachProspect & { joined_team_at?: string | null })[], events: CoachEvent[], posts: { published_at: string | null }[]): Actuals {
  const end = shift(monday, 7);
  const inWeek = (iso: string | null | undefined) => { if (!iso) return false; const d = localDay(new Date(iso)); return d >= monday && d < end; };
  const r = weeklyRecap(prospects, events, monday);
  return { contacts: r.contacts, relances: r.relances, posts: posts.filter(p => inWeek(p.published_at)).length, clients: r.recrues, recrues: prospects.filter(p => inWeek(p.joined_team_at)).length };
}

export type DayProgress = { day: number; weekIndex: number; status: "a_venir" | "en_cours" | "fini"; remaining: WeekTargets; today: WeekTargets; workDaysLeft: number };
export function dayProgress(today: string, plan: Pick<PlanRow, "starts_on" | "rest_days">, week: WeekTargets | null, actual: Pick<Actuals, "contacts" | "relances" | "posts">): DayProgress {
  const diff = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${plan.starts_on}T12:00:00`)) / 86400000);
  const zero = { contacts: 0, relances: 0, posts: 0 };
  if (diff < 0) return { day: 0, weekIndex: 0, status: "a_venir", remaining: week ?? zero, today: zero, workDaysLeft: 0 };
  if (diff >= PLAN_DAYS) return { day: PLAN_DAYS, weekIndex: 4, status: "fini", remaining: zero, today: zero, workDaysLeft: 0 };
  const weekIndex = Math.floor(diff / 7) + 1;
  const end = shift(plan.starts_on, weekIndex * 7);
  let left = 0;
  for (let d = today; d < end; d = shift(d, 1)) if (!plan.rest_days.includes(dow(d))) left++;
  const t = week ?? zero;
  const remaining = { contacts: Math.max(0, t.contacts - actual.contacts), relances: Math.max(0, t.relances - actual.relances), posts: Math.max(0, t.posts - actual.posts) };
  const share = (n: number) => left ? Math.ceil(n / left) : 0;
  return { day: diff + 1, weekIndex, status: "en_cours", remaining, today: { contacts: share(remaining.contacts), relances: share(remaining.relances), posts: share(remaining.posts) }, workDaysLeft: left };
}

/** Proposition pour la semaine suivante. Ne touche jamais au réalisé ; l'utilisateur accepte, modifie ou garde. */
export function adaptNext(planned: WeekTargets, actual: Pick<Actuals, "contacts" | "relances" | "posts">, next: WeekTargets, capacity: number): { proposal: WeekTargets; note: string; changed: boolean } {
  const adj = (p: number, a: number, n: number) => {
    if (p <= 0) return n;
    if (a / p < ADAPT_THRESHOLD) return Math.min(n, Math.max(Math.ceil(p * 0.85), Math.ceil(a * 1.2)));
    if (a >= p) return Math.max(n, Math.min(1000, Math.max(p + 1, Math.ceil(p * 1.1))));
    return n;
  };
  let c = adj(planned.contacts, actual.contacts, next.contacts), r = adj(planned.relances, actual.relances, next.relances);
  if (c + r > capacity) { const k = capacity / (c + r); c = Math.floor(c * k); r = Math.max(0, capacity - c); }
  const proposal = { contacts: c, relances: r, posts: adj(planned.posts, actual.posts, next.posts) };
  const changed = proposal.contacts !== next.contacts || proposal.relances !== next.relances || proposal.posts !== next.posts;
  const below = (["contacts", "relances", "posts"] as const).filter(k => planned[k] > 0 && actual[k] / planned[k] < ADAPT_THRESHOLD);
  const note = !changed ? "Rythme conservé." : below.length ? "Objectifs ajustés à votre rythme réel de la semaine." : "Objectifs atteints : légère hausse proposée.";
  return { proposal, note, changed };
}

export function capacityOf(plan: Pick<PlanRow, "minutes_per_day" | "rest_days">) { return (CAPACITY[plan.minutes_per_day as Minutes] ?? 6) * workDays(plan.rest_days); }
export const toTargets = (w: Pick<WeekRow, "contacts_target" | "relances_target" | "posts_target">): WeekTargets => ({ contacts: w.contacts_target, relances: w.relances_target, posts: w.posts_target });

export function planDbError(message: string) {
  if (/PLAN_PAYANT_REQUIS/.test(message)) return "Le plan d'action est réservé aux plans payants.";
  if (/PLAN_DEJA_ACTIF/.test(message)) return "Vous avez déjà un plan actif. Terminez-le ou abandonnez-le d'abord.";
  if (/DEBUT_LUNDI/.test(message)) return "Le plan doit commencer un lundi.";
  if (/SEMAINE_VALIDEE/.test(message)) return "Cette semaine est déjà validée.";
  if (/CAMPAGNE_INVALIDE/.test(message)) return "Campagne introuvable.";
  return "Enregistrement impossible. Réessayez.";
}

export const actionPlanKey = (userId: string) => ["action-plan", userId] as const;
