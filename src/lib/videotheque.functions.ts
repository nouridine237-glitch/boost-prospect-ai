import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACCEPTED_TYPES, CATEGORIES, PLAY_URL_TTL_S, PLAY_URLS_PER_HOUR, VIDEO_BUCKET, quotaOf, vtError, type SnapshotLesson } from "@/lib/videotheque";
import { hasFeature } from "@/lib/plans";
import { courseProgress, lessonProgress, type ProgressRow } from "@/lib/academy-progress";

type Ctx = { supabase: any; userId: string };
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
const uuid = z.string().uuid();
const catKeys = CATEGORIES.map((c) => c.key) as [string, ...string[]];

async function myPlan(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("effective_plan", { _user_id: ctx.userId });
  if (error) throw new Error("Plan introuvable.");
  return String(data ?? "gratuit");
}
async function names(a: any, ids: string[]) {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return {} as Record<string, string>;
  const { data } = await a.from("profiles").select("id, display_name, full_name").in("id", uniq);
  return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.display_name || p.full_name || "Partenaire"])) as Record<string, string>;
}
async function signThumbs(a: any, paths: (string | null)[]) {
  const ps = paths.filter(Boolean) as string[];
  if (!ps.length) return {} as Record<string, string>;
  const { data } = await a.storage.from(VIDEO_BUCKET).createSignedUrls(ps, 3600);
  return Object.fromEntries((data ?? []).filter((d: any) => d.signedUrl).map((d: any) => [d.path, d.signedUrl])) as Record<string, string>;
}
async function removeFiles(a: any, v: { storage_path: string; thumb_path: string | null }) {
  await a.storage.from(VIDEO_BUCKET).remove([v.storage_path, ...(v.thumb_path ? [v.thumb_path] : [])]);
}
async function progressRows(a: any, userId: string, lessonIds: string[]): Promise<ProgressRow[]> {
  if (!lessonIds.length) return [];
  const { data } = await a.from("academy_lesson_progress")
    .select("lesson_id, status, position_seconds, watched_seconds, duration_seconds, last_activity_at")
    .eq("user_id", userId).in("lesson_id", lessonIds);
  return (data ?? []) as ProgressRow[];
}

/* ---------------- Vidéothèque ---------------- */

export type MyVideo = { id: string; title: string; description: string; category: string; status: string; size: number; duration: number; mime: string; archived: boolean; createdAt: string; thumbUrl: string | null };

export const listMyVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const plan = await myPlan(context);
    const a = await admin();
    // Envois abandonnés depuis plus de 24 h : marqués en échec et nettoyés.
    const { data: stale } = await a.from("user_videos").select("id, storage_path, thumb_path").eq("owner_id", context.userId)
      .eq("status", "envoi").lt("created_at", new Date(Date.now() - 86400000).toISOString());
    for (const s of stale ?? []) { await removeFiles(a, s); await a.from("user_videos").update({ status: "echec" }).eq("id", s.id); }
    const { data, error } = await context.supabase.from("user_videos").select("*").order("created_at", { ascending: false });
    if (error) throw new Error("Vidéos indisponibles.");
    const rows = data ?? [];
    const thumbs = await signThumbs(a, rows.filter((r: any) => r.status === "pret").map((r: any) => r.thumb_path));
    const used = rows.filter((r: any) => r.status !== "echec").reduce((s: number, r: any) => s + Number(r.size_bytes), 0);
    const q = quotaOf(plan);
    return {
      plan, canImport: hasFeature(plan, "videoLibrary"), usedBytes: used, quota: q,
      videos: rows.map((r: any): MyVideo => ({
        id: r.id, title: r.title, description: r.description, category: r.category, status: r.status, size: Number(r.size_bytes),
        duration: r.duration_seconds, mime: r.mime_type, archived: !!r.archived_at, createdAt: r.created_at,
        thumbUrl: r.thumb_path ? thumbs[r.thumb_path] ?? null : null,
      })),
    };
  });

/** Déclare l'envoi (quotas vérifiés en base) ; le fichier est ensuite envoyé par morceaux depuis le navigateur. */
export const createVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1000),
    category: z.enum(catKeys),
    mime: z.enum(Object.keys(ACCEPTED_TYPES) as [string, ...string[]]),
    size: z.number().int().positive().max(524288000),
    duration: z.number().min(1).max(3600),
    withThumb: z.boolean(),
    rights: z.literal(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const id = crypto.randomUUID();
    const ext = ACCEPTED_TYPES[data.mime as keyof typeof ACCEPTED_TYPES];
    const storage_path = `${context.userId}/${id}.${ext}`;
    const thumb_path = data.withThumb ? `${context.userId}/${id}.jpg` : null;
    const { error } = await context.supabase.from("user_videos").insert({
      id, owner_id: context.userId, title: data.title, description: data.description, category: data.category,
      storage_path, thumb_path, mime_type: data.mime, size_bytes: data.size, duration_seconds: Math.round(data.duration), rights_confirmed: true,
    });
    if (error) throw new Error(vtError(error.message, "Envoi refusé."));
    return { id, path: storage_path, thumbPath: thumb_path };
  });

/** Vérifie le fichier réellement reçu (taille, type) avant de le rendre disponible. */
export const finalizeVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: v } = await context.supabase.from("user_videos").select("*").eq("id", data.id).maybeSingle();
    if (!v || v.status !== "envoi") return { status: v?.status ?? "introuvable" };
    const a = await admin();
    const { data: files } = await a.storage.from(VIDEO_BUCKET).list(context.userId, { search: data.id });
    const file = (files ?? []).find((f: any) => `${context.userId}/${f.name}` === v.storage_path);
    const thumb = (files ?? []).find((f: any) => `${context.userId}/${f.name}` === v.thumb_path);
    const size = Number(file?.metadata?.size ?? 0);
    const mime = String(file?.metadata?.mimetype ?? "");
    const ok = file && size > 0 && size <= Number(v.size_bytes) && (mime === v.mime_type || mime === "application/octet-stream" || mime === "");
    if (!ok) {
      await removeFiles(a, v);
      await a.from("user_videos").update({ status: "echec" }).eq("id", v.id);
      return { status: "echec" };
    }
    if (thumb && Number(thumb.metadata?.size ?? 0) > 300 * 1024) await a.storage.from(VIDEO_BUCKET).remove([v.thumb_path]);
    await a.from("user_videos").update({ status: "pret", thumb_path: thumb && Number(thumb.metadata?.size ?? 0) <= 300 * 1024 ? v.thumb_path : null }).eq("id", v.id);
    return { status: "pret" };
  });

export const markUploadFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: v } = await context.supabase.from("user_videos").select("id, status, storage_path, thumb_path").eq("id", data.id).maybeSingle();
    if (!v || v.status !== "envoi") return { ok: false };
    const a = await admin();
    await removeFiles(a, v);
    await a.from("user_videos").update({ status: "echec", deleted_at: new Date().toISOString() }).eq("id", v.id);
    return { ok: true };
  });

export const updateVideoMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, title: z.string().trim().min(3).max(120), description: z.string().trim().max(1000), category: z.enum(catKeys) }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...row } = data;
    const { error } = await context.supabase.from("user_videos").update(row).eq("id", id);
    if (error) throw new Error("Modification non enregistrée.");
    return { ok: true };
  });

/** Archive ; suppression physique seulement si plus personne ne peut la regarder. */
export const archiveVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: v } = await context.supabase.from("user_videos").select("id, status, storage_path, thumb_path").eq("id", data.id).maybeSingle();
    if (!v) throw new Error("Vidéo introuvable.");
    const a = await admin();
    const { videoReferences } = await import("@/lib/videotheque-access.server");
    const refs = await videoReferences(a, v.id);
    if (refs.lessons > 0) throw new Error("Cette vidéo est utilisée dans une leçon. Retire-la d'abord de tes formations.");
    if (refs.grants > 0 || v.status === "envoi") {
      const { error } = await context.supabase.from("user_videos").update({ archived_at: new Date().toISOString() }).eq("id", v.id);
      if (error) throw new Error("Archivage impossible.");
      return { deleted: false, keptFor: refs.grants };
    }
    await removeFiles(a, v);
    await a.from("user_videos").update({ deleted_at: new Date().toISOString(), archived_at: new Date().toISOString() }).eq("id", v.id);
    return { deleted: true, keptFor: 0 };
  });

export const restoreVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_videos").update({ archived_at: null }).eq("id", data.id);
    if (error) throw new Error("Restauration impossible.");
    return { ok: true };
  });

/** Aperçu par le propriétaire de sa propre vidéo. */
export const getOwnVideoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: v } = await context.supabase.from("user_videos").select("storage_path, status").eq("id", data.id).maybeSingle();
    if (!v || v.status !== "pret") throw new Error("Vidéo indisponible.");
    const a = await admin();
    const { data: s } = await a.storage.from(VIDEO_BUCKET).createSignedUrl(v.storage_path, PLAY_URL_TTL_S);
    if (!s?.signedUrl) throw new Error("Lecture impossible.");
    return { url: s.signedUrl as string };
  });

/* ---------------- Formations ---------------- */

export const listMyCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const plan = await myPlan(context);
    const { data: courses } = await context.supabase.from("academy_courses").select("id, title, description, status, archived_at, updated_at")
      .eq("owner_id", context.userId).order("updated_at", { ascending: false });
    const ids = (courses ?? []).map((c: any) => c.id);
    const [{ data: lessons }, { data: versions }, { data: grants }] = ids.length ? await Promise.all([
      context.supabase.from("academy_lessons").select("course_id").in("course_id", ids).is("archived_at", null),
      context.supabase.from("course_versions").select("course_id, version").in("course_id", ids),
      context.supabase.from("course_grants").select("course_id, status").in("course_id", ids).in("status", ["en_attente", "actif"]),
    ]) : [{ data: [] }, { data: [] }, { data: [] }];
    return {
      canCreate: hasFeature(plan, "videoLibrary"), canShare: hasFeature(plan, "teamTraining"),
      courses: (courses ?? []).map((c: any) => ({
        id: c.id as string, title: c.title as string, description: c.description as string, archived: !!c.archived_at,
        lessons: (lessons ?? []).filter((l: any) => l.course_id === c.id).length,
        version: Math.max(0, ...(versions ?? []).filter((v: any) => v.course_id === c.id).map((v: any) => v.version)),
        recipients: (grants ?? []).filter((g: any) => g.course_id === c.id).length,
      })),
    };
  });

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().trim().min(3).max(120), description: z.string().trim().max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!hasFeature(await myPlan(context), "videoLibrary")) throw new Error("Créer une formation est disponible à partir du plan Pro.");
    const slug = `u-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const { data: c, error } = await context.supabase.from("academy_courses").insert({
      owner_id: context.userId, slug, title: data.title, description: data.description, min_plan: "gratuit", source_type: "interne", status: "brouillon", sort_order: 0,
    }).select("id").single();
    if (error) throw new Error("Formation non créée.");
    return { id: c.id as string };
  });

export const getCourseEditor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase.from("academy_courses").select("id, title, description, status, archived_at")
      .eq("id", data.id).eq("owner_id", context.userId).maybeSingle();
    if (!c) return null;
    const plan = await myPlan(context);
    const a = await admin();
    const [{ data: lessons }, { data: videos }, { data: versions }, { data: grants }] = await Promise.all([
      context.supabase.from("academy_lessons").select("id, title, summary, module_title, user_video_id, sort_order, updated_at").eq("course_id", c.id).is("archived_at", null).order("sort_order").order("created_at"),
      context.supabase.from("user_videos").select("id, title, duration_seconds, thumb_path, status, archived_at").eq("status", "pret").is("archived_at", null).order("created_at", { ascending: false }),
      context.supabase.from("course_versions").select("id, version, created_at").eq("course_id", c.id).order("version", { ascending: false }),
      context.supabase.from("course_grants").select("id, recipient_id, grantor_id, status, can_reshare, origin, created_at, accepted_at, version_id").eq("course_id", c.id).order("created_at", { ascending: false }),
    ]);
    const vids = videos ?? [];
    const thumbs = await signThumbs(a, vids.map((v: any) => v.thumb_path));
    const n = await names(a, (grants ?? []).flatMap((g: any) => [g.recipient_id, g.grantor_id]));
    // Agrégat seulement : nombre de leçons terminées par destinataire (jamais le détail).
    const lessonIds = (lessons ?? []).map((l: any) => l.id);
    const recipients = (grants ?? []).filter((g: any) => g.status === "actif").map((g: any) => g.recipient_id);
    const { data: prog } = lessonIds.length && recipients.length
      ? await a.from("academy_lesson_progress").select("user_id").eq("course_id", c.id).eq("status", "terminee").in("user_id", recipients)
      : { data: [] };
    const latest = (versions ?? [])[0];
    const changedSince = latest ? (lessons ?? []).some((l: any) => new Date(l.updated_at) > new Date(latest.created_at)) : true;
    return {
      canShare: hasFeature(plan, "teamTraining"),
      course: { id: c.id as string, title: c.title as string, description: c.description as string, archived: !!c.archived_at, published: c.status === "publie" },
      version: latest ? { number: latest.version as number, at: latest.created_at as string } : null,
      draftChanges: changedSince,
      lessons: (lessons ?? []).map((l: any) => {
        const v = vids.find((x: any) => x.id === l.user_video_id);
        return { id: l.id as string, title: l.title as string, summary: l.summary as string, module: l.module_title as string, videoId: l.user_video_id as string, sort: l.sort_order as number,
          duration: v?.duration_seconds ?? 0, thumbUrl: v?.thumb_path ? thumbs[v.thumb_path] ?? null : null };
      }),
      videos: vids.map((v: any) => ({ id: v.id as string, title: v.title as string, duration: v.duration_seconds as number, thumbUrl: v.thumb_path ? thumbs[v.thumb_path] ?? null : null })),
      grants: (grants ?? []).map((g: any) => ({
        id: g.id as string, recipient: n[g.recipient_id] ?? "Partenaire", grantor: g.grantor_id === context.userId ? null : n[g.grantor_id] ?? "Partenaire",
        status: g.status as string, canReshare: g.can_reshare as boolean, createdAt: g.created_at as string, direct: g.grantor_id === context.userId,
        done: (prog ?? []).filter((p: any) => p.user_id === g.recipient_id).length, total: lessonIds.length,
      })),
    };
  });

export const saveCourseMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, title: z.string().trim().min(3).max(120), description: z.string().trim().max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("academy_courses").update({ title: data.title, description: data.description }).eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw new Error("Formation non enregistrée.");
    return { ok: true };
  });

export const saveCourseLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: uuid.optional(), courseId: uuid, title: z.string().trim().min(3).max(120), summary: z.string().trim().max(1000),
    module: z.string().trim().max(80), videoId: uuid,
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row = { title: data.title, summary: data.summary, module_title: data.module, user_video_id: data.videoId, video_provider: "fichier", video_id: data.videoId };
    if (data.id) {
      const { error } = await context.supabase.from("academy_lessons").update(row).eq("id", data.id).eq("course_id", data.courseId);
      if (error) throw new Error(vtError(error.message, "Leçon non enregistrée."));
      return { ok: true };
    }
    const { data: last } = await context.supabase.from("academy_lessons").select("sort_order").eq("course_id", data.courseId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { error } = await context.supabase.from("academy_lessons").insert({
      ...row, course_id: data.courseId, slug: `l-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, sort_order: (last?.sort_order ?? 0) + 10, status: "brouillon",
    });
    if (error) throw new Error(vtError(error.message, "Leçon non ajoutée."));
    return { ok: true };
  });

export const archiveCourseLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, courseId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("academy_lessons").update({ archived_at: new Date().toISOString() }).eq("id", data.id).eq("course_id", data.courseId);
    if (error) throw new Error("Leçon non retirée.");
    return { ok: true };
  });

export const moveCourseLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: uuid, order: z.array(uuid).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    for (const [i, id] of data.order.entries()) {
      const { error } = await context.supabase.from("academy_lessons").update({ sort_order: (i + 1) * 10 }).eq("id", id).eq("course_id", data.courseId);
      if (error) throw new Error("Ordre non enregistré.");
    }
    return { ok: true };
  });

export const publishCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: v, error } = await context.supabase.rpc("course_publish_version", { _course_id: data.id });
    if (error) throw new Error(vtError(error.message, "Publication impossible."));
    return { version: Number(v) };
  });

export const archiveCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, archived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("academy_courses").update({ archived_at: data.archived ? new Date().toISOString() : null }).eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw new Error("Action impossible.");
    return { ok: true };
  });

/* ---------------- Partage ---------------- */

/** Personnes à qui l'utilisateur peut partager cette formation (même règle que grant_share). */
export const shareTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await admin();
    const { data: c } = await a.from("academy_courses").select("owner_id").eq("id", data.courseId).maybeSingle();
    if (!c?.owner_id) return { mode: "none" as const, members: [] };
    const isOwner = c.owner_id === context.userId;
    let leaders = [context.userId];
    if (!isOwner) {
      const { data: g } = await a.from("course_grants").select("can_reshare").eq("course_id", data.courseId).eq("recipient_id", context.userId).eq("status", "actif").maybeSingle();
      const { data: link } = await a.from("team_links").select("id").eq("leader_id", c.owner_id).eq("member_id", context.userId).eq("status", "actif").maybeSingle();
      if (!g?.can_reshare || !link) return { mode: "none" as const, members: [] };
      leaders = [context.userId, c.owner_id];
    }
    const { data: links } = await a.from("team_links").select("member_id, leader_id").in("leader_id", leaders).eq("status", "actif");
    const ids = [...new Set((links ?? []).map((l: any) => l.member_id as string))].filter((id) => id !== context.userId && id !== c.owner_id);
    const { data: existing } = ids.length ? await a.from("course_grants").select("recipient_id, status").eq("course_id", data.courseId).in("recipient_id", ids) : { data: [] };
    const n = await names(a, ids);
    return {
      mode: isOwner ? ("owner" as const) : ("reshare" as const),
      members: ids.map((id) => ({
        id, name: n[id] ?? "Partenaire",
        group: (links ?? []).some((l: any) => l.member_id === id && l.leader_id === context.userId) ? "Mon équipe" : "Équipe de mon leader",
        status: ((existing ?? []).find((e: any) => e.recipient_id === id)?.status ?? null) as string | null,
      })),
    };
  });

export const shareCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: uuid, recipients: z.array(uuid).min(1).max(200), canReshare: z.boolean(), origin: z.enum(["direct", "equipe"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: n, error } = await context.supabase.rpc("grant_share", { _course_id: data.courseId, _recipients: data.recipients, _can_reshare: data.canReshare, _origin: data.origin });
    if (error) throw new Error(vtError(error.message, "Partage impossible."));
    return { invited: Number(n) };
  });

export const revokeGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("grant_revoke", { _grant_id: data.id });
    if (error) throw new Error("Retrait impossible.");
    return { result: String(r) };
  });

export const setGrantReshare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, value: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("grant_set_reshare", { _grant_id: data.id, _value: data.value });
    if (error || r !== "ok") throw new Error("Modification impossible.");
    return { ok: true };
  });

/* ---------------- Formations reçues ---------------- */

export const listReceived = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: grants } = await context.supabase.from("course_grants")
      .select("id, course_id, owner_id, grantor_id, status, can_reshare, version_id, created_at")
      .eq("recipient_id", context.userId).in("status", ["en_attente", "actif"]).order("created_at", { ascending: false });
    const gs = grants ?? [];
    if (!gs.length) return [];
    const a = await admin();
    const [{ data: versions }, { data: latest }] = await Promise.all([
      a.from("course_versions").select("id, version, title, description, lessons").in("id", gs.map((g: any) => g.version_id)),
      a.from("course_versions").select("course_id, version").in("course_id", gs.map((g: any) => g.course_id)),
    ]);
    const n = await names(a, gs.flatMap((g: any) => [g.owner_id, g.grantor_id]));
    const allLessons = (versions ?? []).flatMap((v: any) => (v.lessons as SnapshotLesson[]).map((l) => l.lesson_id));
    const rows = await progressRows(a, context.userId, allLessons);
    return gs.map((g: any) => {
      const v = (versions ?? []).find((x: any) => x.id === g.version_id);
      const ls = (v?.lessons ?? []) as SnapshotLesson[];
      const newest = Math.max(0, ...(latest ?? []).filter((x: any) => x.course_id === g.course_id).map((x: any) => x.version));
      return {
        grantId: g.id as string, courseId: g.course_id as string, status: g.status as string, canReshare: g.can_reshare as boolean,
        title: v?.title ?? "Formation", description: v?.description ?? "", author: n[g.owner_id] ?? "Partenaire",
        via: g.grantor_id !== g.owner_id ? n[g.grantor_id] ?? null : null,
        lessons: ls.length, minutes: Math.ceil(ls.reduce((s, l) => s + l.duration, 0) / 60), version: v?.version ?? 1, newerVersion: newest > (v?.version ?? 1),
        progress: courseProgress(ls.map((l) => l.lesson_id), rows), receivedAt: g.created_at as string,
      };
    });
  });

export const respondGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("grant_respond", { _grant_id: data.id, _accept: data.accept });
    if (error) throw new Error("Réponse non enregistrée.");
    return { result: String(r) };
  });

export const updateGrantVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("grant_update_version", { _grant_id: data.id });
    if (error) throw new Error("Mise à jour impossible.");
    return { result: String(r) };
  });

/** Lecture : version reçue pour un destinataire, version de travail pour le propriétaire. */
export const getCourseReader = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await admin();
    const { data: c } = await a.from("academy_courses").select("id, owner_id, title, description").eq("id", data.courseId).maybeSingle();
    if (!c?.owner_id) return null;
    let role: "owner" | "recipient" = "owner";
    let lessons: SnapshotLesson[] = [];
    let title = c.title as string, description = c.description as string, grantId: string | null = null, canReshare = false, version: number | null = null;
    if (c.owner_id === context.userId) {
      const { data: ls } = await a.from("academy_lessons").select("id, title, summary, module_title, user_video_id, user_videos(duration_seconds)")
        .eq("course_id", c.id).is("archived_at", null).order("sort_order").order("created_at");
      lessons = (ls ?? []).map((l: any) => ({ lesson_id: l.id, title: l.title, summary: l.summary, module: l.module_title, video_id: l.user_video_id, duration: l.user_videos?.duration_seconds ?? 60 }));
    } else {
      role = "recipient";
      const { data: g } = await a.from("course_grants").select("id, version_id, can_reshare").eq("course_id", c.id).eq("recipient_id", context.userId).eq("status", "actif").maybeSingle();
      if (!g) return null;
      const { data: v } = await a.from("course_versions").select("version, title, description, lessons").eq("id", g.version_id).maybeSingle();
      if (!v) return null;
      lessons = v.lessons as SnapshotLesson[]; title = v.title; description = v.description; grantId = g.id; canReshare = g.can_reshare; version = v.version;
    }
    const vids = [...new Set(lessons.map((l) => l.video_id))];
    const { data: alive } = vids.length ? await a.from("user_videos").select("id").in("id", vids).is("moderated_at", null).is("deleted_at", null) : { data: [] };
    const ok = new Set((alive ?? []).map((v: any) => v.id));
    const rows = await progressRows(a, context.userId, lessons.map((l) => l.lesson_id));
    const { data: owner } = await a.from("profiles").select("display_name, full_name").eq("id", c.owner_id).maybeSingle();
    return {
      role, grantId, canReshare, version, courseId: c.id as string, title, description, author: owner?.display_name || owner?.full_name || "Partenaire",
      progress: courseProgress(lessons.map((l) => l.lesson_id), rows),
      lessons: lessons.map((l) => ({ id: l.lesson_id, title: l.title, summary: l.summary, module: l.module, duration: l.duration, available: ok.has(l.video_id),
        progress: lessonProgress(rows.find((r) => r.lesson_id === l.lesson_id), l.duration) })),
    };
  });

/** URL signée d'une heure, après contrôle de l'accès ; 60 lectures par heure au maximum. */
export const getLessonPlayUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: uuid, lessonId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await admin();
    const { lessonAccess } = await import("@/lib/videotheque-access.server");
    const acc = await lessonAccess(a, context.userId, data.courseId, data.lessonId);
    if (!acc) throw new Error("Vidéo indisponible.");
    const { count } = await a.from("video_views").select("id", { count: "exact", head: true }).eq("viewer_id", context.userId).gt("created_at", new Date(Date.now() - 3600000).toISOString());
    if ((count ?? 0) >= PLAY_URLS_PER_HOUR) throw new Error("Trop de lectures en peu de temps. Réessaie dans un moment.");
    const { data: v } = await a.from("user_videos").select("storage_path").eq("id", acc.videoId).maybeSingle();
    const { data: s } = await a.storage.from(VIDEO_BUCKET).createSignedUrl(v.storage_path, PLAY_URL_TTL_S);
    if (!s?.signedUrl) throw new Error("Lecture impossible.");
    await a.from("video_views").insert({ viewer_id: context.userId, video_id: acc.videoId });
    return { url: s.signedUrl as string };
  });

export const reportLessonVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courseId: uuid, lessonId: uuid, reason: z.string().trim().min(5).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await admin();
    const { lessonAccess } = await import("@/lib/videotheque-access.server");
    const acc = await lessonAccess(a, context.userId, data.courseId, data.lessonId);
    if (!acc || acc.role !== "recipient") throw new Error("Signalement impossible.");
    const { error } = await context.supabase.from("video_reports").insert({ reporter_id: context.userId, video_id: acc.videoId, reason: data.reason });
    if (error) throw new Error(error.code === "23505" ? "Tu as déjà signalé cette vidéo." : "Signalement non envoyé.");
    return { ok: true };
  });

/* ---------------- Modération (admin) ---------------- */

export const adminListVideoReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Accès réservé aux administrateurs.");
    const { data } = await context.supabase.from("video_reports").select("id, video_id, reason, status, created_at").eq("status", "ouvert").order("created_at");
    const a = await admin();
    const ids = (data ?? []).map((r: any) => r.video_id);
    const { data: vids } = ids.length ? await a.from("user_videos").select("id, title, owner_id").in("id", ids) : { data: [] };
    const n = await names(a, (vids ?? []).map((v: any) => v.owner_id));
    return (data ?? []).map((r: any) => {
      const v = (vids ?? []).find((x: any) => x.id === r.video_id);
      return { id: r.id as string, videoId: r.video_id as string, title: v?.title ?? "?", owner: n[v?.owner_id] ?? "?", reason: r.reason as string, at: r.created_at as string };
    });
  });

export const adminModerateVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ videoId: uuid, reason: z.string().trim().min(5).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("moderate_video", { _video_id: data.videoId, _reason: data.reason });
    if (error) throw new Error("Retrait impossible.");
    if (r === "retire") {
      const a = await admin();
      const { data: v } = await a.from("user_videos").select("storage_path, thumb_path").eq("id", data.videoId).maybeSingle();
      if (v) await removeFiles(a, v);
    }
    return { result: String(r) };
  });

export const adminDismissReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Accès réservé aux administrateurs.");
    const a = await admin();
    await a.from("video_reports").update({ status: "rejete" }).eq("id", data.id);
    return { ok: true };
  });
