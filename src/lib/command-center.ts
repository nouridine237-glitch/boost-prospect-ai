/** Centre de commande : routeur d'intention local et brief du jour. Pur, déterministe, sans IA ni réseau. */
import { matchObjectionId } from "./coach";
import { hasFeature } from "./plans";

export const MAX_REQUEST = 2000;
export type AssistantMode = "prospection" | "reponse" | "appel" | "post";
export const ASSISTANT_MODES: Record<AssistantMode, string> = {
  prospection: "Message de prospection", reponse: "Réponse à un prospect", appel: "Script d'appel", post: "Post réseau social",
};

export type CommandAction =
  | { id: string; label: string; reason: string; kind: "objection"; objectionId: string | null }
  | { id: string; label: string; reason: string; kind: "assistant"; mode: AssistantMode; context: string }
  | { id: string; label: string; reason: string; kind: "page"; to: "/prospects" | "/academie" | "/duplication" | "/statistiques" | "/abonnement" | "/simulateur" | "/planificateur" | "/campagnes" | "/plan-action"; locked?: boolean };

export type Intent = "plan" | "campagne" | "simulation" | "objection" | "relance" | "post" | "appel" | "message" | "prospect" | "formation" | "equipe" | "stats";

export const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const clampRequest = (v: string) => v.trim().slice(0, MAX_REQUEST);

/** Ordre = priorité : une objection l'emporte sur une demande de rédaction. */
const INTENT_KEYWORDS: [Intent, string[]][] = [
  ["campagne", ["campagne"]],
  ["plan", ["plan d'action", "plan d action", "30 jours", "objectif du mois", "mon plan"]],
  ["simulation", ["entrainer", "entraine", "simul", "s'exercer", "m'exercer", "jeu de role", "pratiquer"]],
  ["objection", ["objection", "il dit", "elle dit", "me dit", "repondre a", "pyramid", "arnaque", "trop cher", "pas le temps", "reflechir", "pas interesse", "interesse pas"]],
  ["relance", ["relance", "relancer", "suivi", "rappeler", "recontacter", "sans reponse", "repond plus", "repond pas"]],
  ["post", ["post", "publication", "publier", "statut", "facebook", "instagram", "tiktok", "story", "reseaux sociaux"]],
  ["appel", ["appel", "appeler", "telephone", "vocal"]],
  ["message", ["message", "ecrire", "rediger", "premier contact", "aborder", "inviter"]],
  ["prospect", ["retrouver", "trouver", "chercher", "fiche", "prospect", "contact", "crm"]],
  ["formation", ["formation", "former", "apprendre", "lecon", "cours", "academie", "video", "quiz", "certificat"]],
  ["equipe", ["equipe", "duplication", "dupliquer", "filleul", "partenaire", "recrue", "leader", "parcours 7"]],
  ["stats", ["statistique", "stats", "chiffre", "conversion", "performance", "resultat", "taux", "progression"]],
];

export function detectIntents(text: string): Intent[] {
  const t = normalize(text);
  if (!t) return [];
  const found = INTENT_KEYWORDS.filter(([, kws]) => kws.some(k => t.includes(k))).map(([i]) => i);
  if (!found.includes("objection") && (matchObjectionId(text) || matchObjectionId(t)) && !found.some(i => i === "post" || i === "formation" || i === "stats" || i === "equipe")) found.unshift("objection");
  return found;
}

/** 1 à 3 actions vers les outils existants. Repli : Assistant IA avec la demande. Rien n'est déclenché ici. */
export function routeRequest(text: string, plan: string): CommandAction[] {
  const request = clampRequest(text);
  const intents = detectIntents(request);
  const out: CommandAction[] = [];
  const objectionId = matchObjectionId(request) ?? matchObjectionId(normalize(request));
  for (const i of intents) {
    if (i === "plan") out.push(hasFeature(plan, "actionPlan")
      ? { id: "plan-action", kind: "page", to: "/plan-action", label: "Ouvrir mon plan d'action 30 jours", reason: "Objectifs de la semaine et suivi du jour" }
      : { id: "plan-action", kind: "page", to: "/abonnement", locked: true, label: "Plan d'action 30 jours (plan Pro)", reason: "Réservé aux plans payants" });
    if (i === "campagne") out.push({ id: "campagnes", kind: "page", to: "/campagnes", label: "Suivre mes campagnes", reason: "Statuts publiés, prospects attribués, conversions réelles" });
    if (i === "simulation") out.push({ id: "simulateur", kind: "page", to: "/simulateur", label: "Ouvrir le Simulateur de conversations", reason: "Entraînement face à un prospect virtuel, sans envoi réel" });
    if (i === "objection") {
      out.push({ id: "objection", kind: "objection", objectionId, label: "Voir la réponse dans le gestionnaire d'objections", reason: objectionId ? "Objection reconnue dans votre demande" : "Réponses éthiques en 3 temps" });
      out.push({ id: "reponse", kind: "assistant", mode: "reponse", context: request, label: "Préparer une réponse avec l'Assistant IA", reason: "Vous relisez avant d'envoyer" });
    }
    if (i === "relance") {
      out.push({ id: "prospects", kind: "page", to: "/prospects", label: "Ouvrir mes prospects à relancer", reason: "Vos relances prévues sont dans le CRM" });
      out.push({ id: "relance-msg", kind: "assistant", mode: "prospection", context: request, label: "Préparer un message de relance", reason: "Brouillon à relire, rien n'est envoyé" });
    }
    if (i === "post") out.push({ id: "post", kind: "assistant", mode: "post", context: request, label: "Écrire une publication avec l'Assistant IA", reason: "Mode « Post réseau social »" });
    if (i === "post") out.push({ id: "planificateur", kind: "page", to: "/planificateur", label: "Planifier mes statuts de la semaine", reason: "Calendrier, brouillons, publication manuelle" });
    if (i === "appel") out.push({ id: "appel", kind: "assistant", mode: "appel", context: request, label: "Préparer un script d'appel", reason: "Mode « Script d'appel »" });
    if (i === "message") out.push({ id: "message", kind: "assistant", mode: "prospection", context: request, label: "Rédiger un message de prospection", reason: "Mode « Message de prospection »" });
    if (i === "prospect") out.push({ id: "prospects", kind: "page", to: "/prospects", label: "Rechercher dans mes prospects", reason: "Recherche et filtres du CRM" });
    if (i === "formation") out.push({ id: "academie", kind: "page", to: "/academie", label: "Ouvrir l'Académie", reason: "Formations et leçons vidéo" });
    if (i === "equipe") {
      const ok = hasFeature(plan, "duplicationPath");
      out.push(ok
        ? { id: "duplication", kind: "page", to: "/duplication", label: "Ouvrir le parcours de duplication", reason: "Parcours 7 jours et kits" }
        : { id: "duplication", kind: "page", to: "/abonnement", locked: true, label: "Parcours de duplication (plan Pro)", reason: "Réservé aux plans payants" });
    }
    if (i === "stats") out.push({ id: "stats", kind: "page", to: "/statistiques", label: "Voir mes statistiques", reason: "Vos chiffres et votre conversion" });
  }
  const seen = new Set<string>();
  const unique = out.filter(a => !seen.has(a.id) && seen.add(a.id)).slice(0, 3);
  if (unique.length) return unique;
  return [{ id: "fallback", kind: "assistant", mode: "prospection", context: request, label: "Ouvrir l'Assistant IA avec ma demande", reason: "Demande non reconnue : l'Assistant vous aide à la formuler" }];
}

export const EXAMPLES = [
  "Répondre à une objection", "Préparer une relance", "Écrire une publication", "Retrouver un prospect",
  "Reprendre une formation", "Développer mon équipe", "Comprendre mes statistiques", "M'entraîner à une conversation",
];

// ---------- Brief du jour ----------
export type BriefItem =
  | { id: "coach"; title: string; reason: string; prospectId: string; context: string }
  | { id: "inactif"; title: string; reason: string; prospectId: string }
  | { id: "lecon"; title: string; reason: string; slug: string; lesson: string }
  | { id: "duplication"; title: string; reason: string; day: number }
  | { id: "statut"; title: string; reason: string }
  | { id: "plan"; title: string; reason: string };

export type BriefInput = {
  mission?: { prospectId: string; name: string; reason: string } | null;
  stuck?: { id: string; name: string; idleDays: number }[] | null;
  course?: { slug: string; title: string; percent: number; resumeSlug: string | null; unlocked: boolean }[] | null;
  statut?: { title: string; reason: string } | null;
  plan?: { day: number; remaining: number; reviewPending: boolean } | null;
  duplication?: { allowed: boolean; days: { day: number; title: string }[]; progress: { day: number; completed_at: string | null }[] } | null;
};

/** Au plus 3 recommandations, une par source, sans doublon de prospect. Sources absentes ignorées. */
export function buildBrief(input: BriefInput): BriefItem[] {
  const items: BriefItem[] = [];
  const pl = input.plan;
  if (pl?.reviewPending) items.push({ id: "plan", title: "Bilan de semaine à valider", reason: "Plan d'action 30 jours : comparez prévu et réalisé" });
  else if (pl && pl.remaining > 0) items.push({ id: "plan", title: `Plan 30 jours : ${pl.remaining} action${pl.remaining > 1 ? "s" : ""} aujourd'hui`, reason: `Jour ${pl.day}/28 · contacts, relances et statuts` });
  const m = input.mission;
  if (m) items.push({ id: "coach", prospectId: m.prospectId, title: `Contacter ${m.name}`, reason: `Priorité du Coach : ${m.reason.charAt(0).toLowerCase()}${m.reason.slice(1)}`, context: `Message pour ${m.name}. ${m.reason}.` });
  if (input.statut) items.push({ id: "statut", title: input.statut.title, reason: input.statut.reason });
  const s = (input.stuck ?? []).find(x => x.id !== m?.prospectId);
  if (s) items.push({ id: "inactif", prospectId: s.id, title: `Reprendre contact avec ${s.name}`, reason: `Aucune activité depuis ${s.idleDays} jours` });
  const c = (input.course ?? []).find(x => x.unlocked && x.resumeSlug && x.percent > 0 && x.percent < 100);
  if (c && c.resumeSlug) items.push({ id: "lecon", slug: c.slug, lesson: c.resumeSlug, title: `Reprendre « ${c.title} »`, reason: `Cours commencé, ${c.percent} % terminé` });
  else {
    const d = input.duplication;
    if (d?.allowed && d.days.length) {
      const done = new Set(d.progress.filter(p => p.completed_at).map(p => p.day));
      const next = d.days.find(x => !done.has(x.day));
      if (next) items.push({ id: "duplication", day: next.day, title: `Jour ${next.day} : ${next.title}`, reason: done.size ? `${done.size} jour${done.size > 1 ? "s" : ""} terminé${done.size > 1 ? "s" : ""} sur ${d.days.length}` : "Parcours de duplication à commencer" });
    }
  }
  return items.slice(0, 3);
}
