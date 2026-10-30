// Source unique des plans : limites, fonctionnalités, prix et textes des cartes.
export type PlanKey = "gratuit" | "pro" | "expert" | "business";
export type PaidPlanKey = Exclude<PlanKey, "gratuit">;

export type PlanDef = {
  key: PlanKey;
  label: string;
  fcfa: number;
  usd: number;
  /** -1 = illimité */
  prospects: number;
  /** générations IA par mois */
  generations: number;
  academyLevels: number;
  csv: boolean;
  /** -1 = illimité, 0 = interdit */
  importMax: number;
  advancedStats: boolean;
  teamTraining: boolean;
};

export const PLANS: Record<PlanKey, PlanDef> = {
  gratuit: { key: "gratuit", label: "Gratuit", fcfa: 0, usd: 0, prospects: 10, generations: 5, academyLevels: 2, csv: false, importMax: 0, advancedStats: false, teamTraining: false },
  pro: { key: "pro", label: "Pro", fcfa: 5000, usd: 8, prospects: -1, generations: 100, academyLevels: 6, csv: true, importMax: -1, advancedStats: false, teamTraining: false },
  expert: { key: "expert", label: "Expert", fcfa: 12000, usd: 20, prospects: -1, generations: 500, academyLevels: 6, csv: true, importMax: -1, advancedStats: true, teamTraining: false },
  business: { key: "business", label: "Business", fcfa: 25000, usd: 41, prospects: -1, generations: 500, academyLevels: 6, csv: true, importMax: -1, advancedStats: true, teamTraining: true },
};

export const PLAN_ORDER: PlanKey[] = ["gratuit", "pro", "expert", "business"];
export const GRACE_DAYS = 3;
export const RENEW_WARNING_DAYS = 5;

export function planDef(key: string | null | undefined): PlanDef {
  return PLANS[(key as PlanKey) in PLANS ? (key as PlanKey) : "gratuit"];
}

export type Feature = "academyFull" | "csv" | "advancedStats" | "teamTraining" | "companyTemplates";
export const FEATURE_MIN_PLAN: Record<Feature, PlanKey> = { academyFull: "pro", csv: "pro", advancedStats: "expert", teamTraining: "business", companyTemplates: "business" };

export function hasFeature(plan: string, feature: Feature) {
  const d = planDef(plan);
  if (feature === "academyFull") return d.academyLevels >= 6;
  if (feature === "csv") return d.csv;
  if (feature === "advancedStats") return d.advancedStats;
  if (feature === "companyTemplates") return d.key === "business";
  return d.teamTraining;
}

export function canAccessAcademyLevel(plan: string, level: number) {
  return level <= planDef(plan).academyLevels;
}

/** Même règle que la fonction SQL effective_plan. */
export function computeEffectivePlan(sub: { plan?: string | null; status?: string | null; date_renouvellement?: string | null } | null, now = new Date()): PlanKey {
  if (!sub || sub.status !== "actif") return "gratuit";
  if (!sub.date_renouvellement) return planDef(sub.plan).key;
  const end = new Date(sub.date_renouvellement).getTime() + GRACE_DAYS * 86400000;
  return now.getTime() <= end ? planDef(sub.plan).key : "gratuit";
}

/** Nouvelle échéance : max(échéance future, maintenant) + 1 mois. */
export function nextRenewalDate(current: string | null | undefined, now = new Date()) {
  const cur = current ? new Date(current) : null;
  const base = cur && cur.getTime() > now.getTime() ? new Date(cur) : new Date(now);
  base.setMonth(base.getMonth() + 1);
  return base;
}

export type PlanCardItem = { text: string; soon?: boolean };
export const PLAN_CARD_ITEMS: Record<PlanKey, PlanCardItem[]> = {
  gratuit: [{ text: "10 prospects maximum" }, { text: "5 générations IA / mois" }, { text: "Académie niveaux 1 et 2" }, { text: "1 utilisateur" }],
  pro: [{ text: "Prospects illimités" }, { text: "100 générations IA / mois" }, { text: "Académie complète (6 niveaux)" }, { text: "Import / export CSV" }, { text: "File « À relancer aujourd'hui »" }],
  expert: [{ text: "Tout le plan Pro" }, { text: "Générations IA étendues (jusqu'à 500 / mois)" }, { text: "Statistiques avancées" }, { text: "Rapports hebdomadaires", soon: true }],
  business: [{ text: "Tout le plan Expert" }, { text: "Formation de l'équipe" }, { text: "Templates par entreprise" }, { text: "WhatsApp Business", soon: true }, { text: "Support prioritaire" }],
};
