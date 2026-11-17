// Duplication Hub : règles pures du lien public (1 leçon gratuite sans compte).
export const PUBLIC_EVENT_KINDS = ["vue", "lecture_debut", "lecture_fin", "inscription_debut", "inscription_fin"] as const;
export type PublicEventKind = (typeof PUBLIC_EVENT_KINDS)[number];
export const PUBLIC_PLAY_TTL_S = 600;

/** Jeton : 64 caractères hexadécimaux. Tout autre format est rejeté sans requête. */
export function isValidToken(t: unknown): t is string {
  return typeof t === "string" && /^[0-9a-f]{64}$/.test(t);
}

export type PublicLesson = { id: string; title: string; module: string; duration: number; free: boolean };
export type PublicCourse = { trainer: string; intro: string; whatsapp: string | null; title: string; description: string; freeLessonId: string; lessons: PublicLesson[] };

/** Ne garde que les champs autorisés pour un visiteur anonyme. */
export function toPublicCourse(raw: any): PublicCourse | null {
  if (!raw || typeof raw !== "object" || raw.error || !raw.freeLessonId) return null;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return {
    trainer: str(raw.trainer, 80) || "Ton formateur", intro: str(raw.intro, 400),
    whatsapp: typeof raw.whatsapp === "string" && /^\d{6,15}$/.test(raw.whatsapp) ? raw.whatsapp : null,
    title: str(raw.title, 200), description: str(raw.description, 2000), freeLessonId: String(raw.freeLessonId),
    lessons: (Array.isArray(raw.lessons) ? raw.lessons : []).map((l: any) => ({
      id: String(l.id), title: str(l.title, 200), module: str(l.module, 120), duration: Number(l.duration) || 60, free: l.free === true,
    })),
  };
}

export type ViewerRole = "anonyme" | "owner" | "recipient" | "pending" | "none";
/** Action proposée selon les droits réels de la personne connectée. */
export function viewerAction(role: ViewerRole): { label: string; to: "auth" | "editor" | "reader" | "received" | "request" } {
  switch (role) {
    case "owner": return { label: "Ouvrir dans l'éditeur", to: "editor" };
    case "recipient": return { label: "Continuer le parcours", to: "reader" };
    case "pending": return { label: "Accepter dans Formations reçues", to: "received" };
    case "none": return { label: "Demander l'accès", to: "request" };
    default: return { label: "Créer mon compte pour continuer", to: "auth" };
  }
}

export const PUBLIC_LINK_ERRORS: [string, string][] = [
  ["PLAN_BUSINESS_REQUIS", "Le lien public demande le plan Business."],
  ["PUBLIER_AVANT", "Publie d'abord la formation."],
  ["LECON_INVALIDE", "Choisis une leçon disponible de la dernière version publiée."],
  ["LIMITE_LIENS_JOUR", "Trop de liens créés aujourd'hui. Réessaie demain."],
  ["FORMATION_INTROUVABLE", "Formation introuvable."],
];
export function publicLinkError(e: unknown) {
  const m = e instanceof Error ? e.message : String(e ?? "");
  return PUBLIC_LINK_ERRORS.find(([k]) => m.includes(k))?.[1] ?? "Action impossible pour le moment.";
}
