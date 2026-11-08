// Planificateur de statuts : règles pures (semaine locale, validation, limites, rappel). Miroir des contrôles en base.
import { planDef } from "@/lib/plans";

export const CHANNELS = { whatsapp: "Statut WhatsApp", facebook: "Facebook", autre: "Autre" } as const;
export const OBJECTIVES = { notoriete: "Notoriété", produit: "Produit", temoignage: "Témoignage", invitation: "Invitation", education: "Éducation" } as const;
export const SLOTS = { matin: "Matin", midi: "Midi", soir: "Soir" } as const;
export const STATUSES = { brouillon: "Brouillon", prevu: "Prévu", publie: "Publié" } as const;
export type Channel = keyof typeof CHANNELS;
export type Objective = keyof typeof OBJECTIVES;
export type Slot = keyof typeof SLOTS;
export type PostStatus = keyof typeof STATUSES;
export const MAX_BODY = 2000;
export const FREE_WEEK_LIMIT = 7;
export const PAID_WEEK_LIMIT = 60;

export type PostDraft = { channel: string; objective: string; body: string; planned_on: string; slot: string; status: string; campaign_id?: string | null };
export type Post = PostDraft & { id: string; published_at: string | null };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(day: string, n: number) { const d = toUtc(day); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }
/** Lundi de la semaine d'une date locale « AAAA-MM-JJ » (même règle que date_trunc('week') en base). */
export function mondayOf(day: string) { const dow = (toUtc(day).getUTCDay() + 6) % 7; return addDays(day, -dow); }
export function weekDays(monday: string) { return Array.from({ length: 7 }, (_, i) => addDays(monday, i)); }
export function dayLabel(day: string) { return toUtc(day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); }

export function weekLimit(plan: string) { return planDef(plan).key === "gratuit" ? FREE_WEEK_LIMIT : PAID_WEEK_LIMIT; }
/** Peut-on placer un statut de plus dans la semaine de `day` ? (`ignoreId` : statut déplacé lui-même) */
export function canPlace(posts: Pick<Post, "id" | "planned_on">[], day: string, plan: string, ignoreId?: string) {
  const mon = mondayOf(day), end = addDays(mon, 7);
  return posts.filter(p => p.id !== ignoreId && p.planned_on >= mon && p.planned_on < end).length < weekLimit(plan);
}

export function validatePost(p: PostDraft): string | null {
  if (!(p.channel in CHANNELS)) return "Canal invalide.";
  if (!(p.objective in OBJECTIVES)) return "Objectif invalide.";
  if (!(p.slot in SLOTS)) return "Créneau invalide.";
  if (!(p.status in STATUSES)) return "Statut invalide.";
  if (!DAY_RE.test(p.planned_on) || Number.isNaN(toUtc(p.planned_on).getTime())) return "Date invalide.";
  if (p.body.length > MAX_BODY) return `Texte trop long (${MAX_BODY} caractères maximum).`;
  if (p.status !== "brouillon" && !p.body.trim()) return "Ajoutez un texte avant de prévoir ou publier ce statut.";
  return null;
}

/** Transitions autorisées : tout statut peut redevenir brouillon ; publier exige un texte. */
export function canTransition(from: PostStatus, to: PostStatus, body: string) {
  if (from === to) return false;
  if (to !== "brouillon" && !body.trim()) return false;
  return true;
}

/** Rappel du jour : statuts prévus aujourd'hui et non publiés. */
export function todayReminder(posts: Pick<Post, "planned_on" | "status" | "slot">[], today: string) {
  const due = posts.filter(p => p.planned_on === today && p.status === "prevu");
  if (!due.length) return null;
  const order: Slot[] = ["matin", "midi", "soir"];
  const first = order.find(s => due.some(p => p.slot === s)) ?? "matin";
  return { count: due.length, title: due.length > 1 ? `${due.length} statuts à publier aujourd'hui` : "1 statut à publier aujourd'hui", reason: `Premier créneau : ${SLOTS[first].toLowerCase()} · publication manuelle` };
}

/** Contexte envoyé au mode « Post réseau social » existant (≥ 8 caractères exigés côté serveur). */
export function generationContext(p: Pick<PostDraft, "channel" | "objective" | "body">, idea: string) {
  const base = `${CHANNELS[p.channel as Channel] ?? "Statut"} — objectif : ${OBJECTIVES[p.objective as Objective] ?? "notoriété"}. Texte court, naturel, sans promesse de revenus ni allégation médicale.`;
  const extra = idea.trim() || p.body.trim();
  return `${base}${extra ? `\nIdée : ${extra}` : ""}`.slice(0, 4000);
}

export function dbError(message: string) {
  const m = message.match(/LIMITE_STATUTS:(\d+)/);
  if (m) return `Limite de ${m[1]} statuts par semaine atteinte pour votre plan.`;
  if (/TEXTE_REQUIS/.test(message)) return "Ajoutez un texte avant de prévoir ce statut.";
  return "Enregistrement impossible. Réessayez.";
}

export const contentPostsKey = (userId: string) => ["content-posts", userId] as const;
