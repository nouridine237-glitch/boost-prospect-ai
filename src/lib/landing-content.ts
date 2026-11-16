// Contenu chiffré de la page d'accueil, dérivé des règles de l'app pour ne jamais s'en écarter.
import { PLANS, PLAN_ORDER, PLAN_CARD_ITEMS, hasFeature, type Feature, type PlanCardItem, type PlanKey } from "@/lib/plans";
import { VIDEO_QUOTAS, GB } from "@/lib/videotheque";
import { weekLimit } from "@/lib/content-planner";
import { FREE_ACTIVE_CAMPAIGNS } from "@/lib/campaigns";

export const formatFcfa = (n: number) => `${n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} FCFA`;

/** Lignes des cartes tarifaires de la page : « À relancer » est disponible dès Gratuit, donc pas mis en avant comme avantage payant. */
export function landingCardItems(plan: PlanKey): PlanCardItem[] {
  return PLAN_CARD_ITEMS[plan]
    .filter(item => !/relancer/i.test(item.text))
    .map(item => item.text === "Support prioritaire" ? { ...item, text: "Support prioritaire (service)" } : item);
}

export type CompareCell = string | boolean | "soon";
export type CompareRow = { label: string; cells: CompareCell[] };

const all = (v: CompareCell) => PLAN_ORDER.map(() => v);
const feature = (f: Feature) => PLAN_ORDER.map(k => hasFeature(k, f));

export const COMPARE_ROWS: CompareRow[] = [
  { label: "Prospects", cells: PLAN_ORDER.map(k => PLANS[k].prospects < 0 ? "Illimités" : String(PLANS[k].prospects)) },
  { label: "Générations IA / mois", cells: PLAN_ORDER.map(k => String(PLANS[k].generations)) },
  { label: "Assistant IA 5 modes, scripts, objections, simulateur", cells: all(true) },
  { label: "Suivi des prospects et écran « À relancer »", cells: all(true) },
  { label: "WhatsApp assisté (tu envoies toi-même)", cells: all(true) },
  { label: "Coach du jour, objectifs, centre de commande", cells: all(true) },
  { label: "Statuts planifiés / semaine", cells: PLAN_ORDER.map(k => String(weekLimit(k))) },
  { label: "Campagnes actives", cells: PLAN_ORDER.map(k => k === "gratuit" ? String(FREE_ACTIVE_CAMPAIGNS) : "Sans limite") },
  { label: "Académie", cells: PLAN_ORDER.map(k => PLANS[k].academyLevels >= 6 ? "6 niveaux" : PLANS[k].academyLevels === 2 ? "Niveaux 1 et 2" : `Niveaux 1 à ${PLANS[k].academyLevels}`) },
  { label: "Import / export CSV", cells: PLAN_ORDER.map(k => PLANS[k].csv) },
  { label: "Modèles par entreprise", cells: feature("companyTemplates") },
  { label: "Parcours de duplication 7 jours et kits", cells: feature("duplicationPath") },
  { label: "Plan d'action 30 jours", cells: feature("actionPlan") },
  { label: "Vidéothèque (stockage)", cells: PLAN_ORDER.map(k => hasFeature(k, "videoLibrary") ? `${VIDEO_QUOTAS[k].totalBytes / GB} Go` : false) },
  { label: "Statistiques avancées", cells: feature("advancedStats") },
  { label: "Former ton équipe et lui partager tes formations", cells: feature("teamTraining") },
  { label: "Support prioritaire (service)", cells: PLAN_ORDER.map(k => k === "business") },
  { label: "Rapports hebdomadaires", cells: PLAN_ORDER.map(k => PLANS[k].advancedStats ? "soon" : false) },
  { label: "WhatsApp Business", cells: PLAN_ORDER.map(k => k === "business" ? "soon" : false) },
];
