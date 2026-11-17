import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PUBLIC_EVENT_KINDS, PUBLIC_PLAY_TTL_S, isValidToken, toPublicCourse, type ViewerRole } from "@/lib/duplication-hub";
import { VIDEO_BUCKET } from "@/lib/videotheque";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
const token = z.string().max(80);
async function ipHash() {
  const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`dup:${ip}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(t: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- Public (visiteur anonyme) ---------- */

export const resolvePublicLink = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    if (!isValidToken(data.token)) return null;
    const a = await admin();
    const { data: r } = await a.rpc("public_link_resolve", { _token: data.token, _ip_hash: await ipHash() });
    return toPublicCourse(r);
  });

export const publicLessonPlayUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    if (!isValidToken(data.token)) throw new Error("Vidéo indisponible.");
    const a = await admin();
    const { data: path } = await a.rpc("public_link_play", { _token: data.token, _ip_hash: await ipHash() });
    if (path === "rate_limited") throw new Error("Trop de lectures en peu de temps. Réessaie dans un moment.");
    if (!path) throw new Error("Vidéo indisponible.");
    const { data: s } = await a.storage.from(VIDEO_BUCKET).createSignedUrl(path, PUBLIC_PLAY_TTL_S);
    if (!s?.signedUrl) throw new Error("Vidéo indisponible.");
    return { url: s.signedUrl as string };
  });

export const trackPublicLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token, kind: z.enum(PUBLIC_EVENT_KINDS) }).parse(d))
  .handler(async ({ data }) => {
    if (!isValidToken(data.token)) return { ok: true };
    const a = await admin();
    await a.rpc("public_link_event", { _token: data.token, _kind: data.kind, _ip_hash: await ipHash() });
    return { ok: true };
  });

/* ---------- Connecté : droits réels sur la formation du lien ---------- */

export const publicLinkAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token }).parse(d))
  .handler(async ({ data, context }): Promise<{ role: ViewerRole; courseId: string | null }> => {
    if (!isValidToken(data.token)) return { role: "none", courseId: null };
    const a = await admin();
    const { data: l } = await a.from("duplication_public_links").select("owner_id, course_id, status")
      .eq("token_hash", await sha256(data.token)).maybeSingle();
    if (!l || l.status !== "actif") return { role: "none", courseId: null };
    if (l.owner_id === context.userId) return { role: "owner", courseId: l.course_id };
    const { data: g } = await a.from("course_grants").select("status").eq("course_id", l.course_id).eq("recipient_id", context.userId).maybeSingle();
    if (g?.status === "actif") return { role: "recipient", courseId: l.course_id };
    if (g?.status === "en_attente") return { role: "pending", courseId: null };
    return { role: "none", courseId: null };
  });

/* ---------- Formateur ---------- */

export const getPublicLinkPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: link } = await sb.from("duplication_public_links").select("id, free_lesson_id, intro, show_whatsapp, expires_at, created_at")
      .eq("course_id", data.courseId).eq("status", "actif").maybeSingle();
    const { data: canLead } = await sb.rpc("_can_lead", { _u: context.userId });
    let stats: Record<string, number> = {};
    if (link) {
      const { data: ev } = await sb.from("duplication_public_events").select("kind, count").eq("link_id", link.id);
      for (const e of ev ?? []) stats[e.kind] = (stats[e.kind] ?? 0) + e.count;
    }
    return { canLead: !!canLead, link: link ? { id: link.id as string, freeLessonId: link.free_lesson_id as string, intro: link.intro as string,
      showWhatsapp: link.show_whatsapp as boolean, expiresAt: link.expires_at as string | null, createdAt: link.created_at as string } : null, stats };
  });

export const createPublicLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid(), lessonId: z.string().uuid(), intro: z.string().max(400),
    showWhatsapp: z.boolean(), expiresDays: z.number().int().min(1).max(365).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: tok, error } = await context.supabase.rpc("public_link_create", { _course_id: data.courseId, _lesson_id: data.lessonId,
      _intro: data.intro, _show_whatsapp: data.showWhatsapp, _expires_days: data.expiresDays as any });
    if (error) throw new Error(error.message);
    return { token: tok as string };
  });

export const revokePublicLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("public_link_revoke", { _link_id: data.id });
    if (error) throw new Error(error.message);
    return { result: r as string };
  });
