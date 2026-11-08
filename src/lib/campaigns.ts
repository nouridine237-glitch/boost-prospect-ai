// Suivi des campagnes : règles pures. Attribution 100 % manuelle ; aucune vue, clic ou revenu n'est calculé.
import { OBJECTIVES } from "@/lib/content-planner";
import { planDef } from "@/lib/plans";

export const CAMPAIGN_CHANNELS = { whatsapp: "WhatsApp", facebook: "Facebook", autre: "Autre", multi: "Plusieurs canaux" } as const;
export type CampaignChannel = keyof typeof CAMPAIGN_CHANNELS;
export const MAX_NAME = 80;
export const MAX_NOTE = 500;
export const FREE_ACTIVE_CAMPAIGNS = 1;
/** Seuil minimal de prospects attribués avant toute comparaison ou conclusion. */
export const MIN_SAMPLE = 5;

export type CampaignDraft = { name: string; objective: string; channel: string; starts_on: string; ends_on: string; note: string };
export type Campaign = CampaignDraft & { id: string; archived: boolean };
export type CPost = { id: string; status: string; campaign_id: string | null; published_at: string | null };
export type CProspect = { id: string; status: string; campaign_id: string | null; joined_team_at?: string | null };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (d: string) => DAY_RE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

export function validateCampaign(c: CampaignDraft): string | null {
  const name = c.name.trim();
  if (!name) return "Donnez un nom à la campagne.";
  if (name.length > MAX_NAME) return `Nom trop long (${MAX_NAME} caractères maximum).`;
  if (!(c.objective in OBJECTIVES)) return "Objectif invalide.";
  if (!(c.channel in CAMPAIGN_CHANNELS)) return "Canal invalide.";
  if (!validDay(c.starts_on) || !validDay(c.ends_on)) return "Dates invalides.";
  if (c.ends_on < c.starts_on) return "La date de fin doit être après la date de début.";
  if (c.note.length > MAX_NOTE) return `Note trop longue (${MAX_NOTE} caractères maximum).`;
  return null;
}

/** Même règle que le trigger : active = non archivée et pas encore terminée. */
export function isActive(c: Pick<Campaign, "archived" | "ends_on">, today: string) { return !c.archived && c.ends_on >= today; }
export function phase(c: Pick<Campaign, "archived" | "starts_on" | "ends_on">, today: string): "archivee" | "a_venir" | "en_cours" | "terminee" {
  if (c.archived) return "archivee";
  if (c.starts_on > today) return "a_venir";
  return c.ends_on >= today ? "en_cours" : "terminee";
}
export const PHASE_LABELS = { archivee: "Archivée", a_venir: "À venir", en_cours: "En cours", terminee: "Terminée" } as const;

export function canCreateActive(campaigns: Pick<Campaign, "id" | "archived" | "ends_on">[], plan: string, today: string, ignoreId?: string) {
  if (planDef(plan).key !== "gratuit") return true;
  return campaigns.filter(c => c.id !== ignoreId && isActive(c, today)).length < FREE_ACTIVE_CAMPAIGNS;
}

export type Metrics = { published: number; prospects: number; clients: number; joined: number; rate: number | null };
/** Indicateurs réels d'une campagne. rate = null tant qu'aucun prospect n'est attribué. */
export function campaignMetrics(campaignId: string, posts: CPost[], prospects: CProspect[]): Metrics {
  const published = posts.filter(p => p.campaign_id === campaignId && p.status === "publie").length;
  const mine = prospects.filter(p => p.campaign_id === campaignId);
  const clients = mine.filter(p => p.status === "client").length;
  const joined = mine.filter(p => !!p.joined_team_at).length;
  return { published, prospects: mine.length, clients, joined, rate: mine.length ? Math.round((clients / mine.length) * 1000) / 10 : null };
}

export type CampaignFilters = { phase: "toutes" | "en_cours" | "terminees" | "archivees"; channel: "" | CampaignChannel; from: string; to: string };
export const emptyCampaignFilters: CampaignFilters = { phase: "en_cours", channel: "", from: "", to: "" };
export function filterCampaigns<T extends Campaign>(list: T[], f: CampaignFilters, today: string): T[] {
  return list.filter(c => {
    const ph = phase(c, today);
    if (f.phase === "en_cours" && ph !== "en_cours" && ph !== "a_venir") return false;
    if (f.phase === "terminees" && ph !== "terminee") return false;
    if (f.phase === "archivees" && ph !== "archivee") return false;
    if (f.phase !== "archivees" && f.phase !== "toutes" && c.archived) return false;
    if (f.channel && c.channel !== f.channel) return false;
    // Chevauchement avec la période choisie.
    if (f.from && c.ends_on < f.from) return false;
    if (f.to && c.starts_on > f.to) return false;
    return true;
  });
}

export type Reco = { id: string; text: string; to?: "/planificateur" | "/prospects" | "/objections" };
/** Recommandations fondées uniquement sur les chiffres affichés. */
export function recommendations(c: Campaign, m: Metrics, prospects: CProspect[], today: string): Reco[] {
  const out: Reco[] = [];
  if (m.published === 0) out.push({ id: "publier", text: "Aucun statut publié pour cette campagne. Planifiez-en un et reliez-le à la campagne.", to: "/planificateur" });
  if (m.published > 0 && m.prospects === 0) out.push({ id: "attribuer", text: "Des statuts sont publiés mais aucun prospect n'est attribué. Indiquez la campagne dans la fiche des prospects qui vous ont contacté.", to: "/prospects" });
  if (m.prospects >= MIN_SAMPLE && m.clients === 0) out.push({ id: "objections", text: `${m.prospects} prospects attribués et aucun client pour l'instant : travaillez vos relances et les objections fréquentes.`, to: "/objections" });
  const warm = prospects.filter(p => p.campaign_id === c.id && (p.status === "discussion" || p.status === "intéressé")).length;
  const daysLeft = Math.round((Date.parse(`${c.ends_on}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (!c.archived && daysLeft >= 0 && daysLeft <= 3 && warm > 0) out.push({ id: "relancer", text: `La campagne se termine bientôt et ${warm} prospect${warm > 1 ? "s sont" : " est"} en discussion ou intéressé${warm > 1 ? "s" : ""} : pensez à les relancer.`, to: "/prospects" });
  return out;
}

/** Comparaison entre campagnes : seulement celles avec un échantillon suffisant. */
export function bestCampaign(rows: { campaign: Campaign; m: Metrics }[]) {
  const eligible = rows.filter(r => r.m.prospects >= MIN_SAMPLE && r.m.rate !== null);
  if (eligible.length < 2) return null;
  const best = [...eligible].sort((a, b) => (b.m.rate ?? 0) - (a.m.rate ?? 0))[0]!;
  return { name: best.campaign.name, clients: best.m.clients, prospects: best.m.prospects };
}

export function campaignDbError(message: string) {
  if (/LIMITE_CAMPAGNES/.test(message)) return "Le plan Gratuit permet 1 campagne active à la fois.";
  if (/CAMPAGNE_INVALIDE/.test(message)) return "Campagne introuvable.";
  if (/CONTENU_AUTRE_CAMPAGNE/.test(message)) return "Ce statut est relié à une autre campagne.";
  if (/CONTENU_INVALIDE/.test(message)) return "Seul un statut publié peut être choisi comme contenu source.";
  return "Enregistrement impossible. Réessayez.";
}

export const campaignsKey = (userId: string) => ["campaigns", userId] as const;
