import { PLAN_ORDER, planDef } from "@/lib/plans";

/** Un plan accède à un cours si son rang est au moins celui du plan minimal. */
export function canAccessCourse(plan: string, minPlan: string) {
  return PLAN_ORDER.indexOf(planDef(plan).key) >= PLAN_ORDER.indexOf(planDef(minPlan).key);
}

/** Extrait l'identifiant YouTube (11 caractères) d'une URL ou d'un identifiant brut. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export type CourseSource = { source_type: string; source_author: string; authorization_note: string; authorized_at: string | null };

/** Une formation externe ne se publie qu'avec auteur, preuve et date d'autorisation. */
export function canPublishCourse(c: CourseSource) {
  if (c.source_type === "interne") return true;
  return !!c.authorized_at && c.source_author.trim().length > 0 && c.authorization_note.trim().length > 0;
}
