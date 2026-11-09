import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAccessCourse, canPublishCourse, parseYouTubeId } from "@/lib/academy-video-rules";
import { courseProgress, lessonProgress, resumeLesson, type ProgressRow } from "@/lib/academy-progress";

async function myRows(context: Ctx, courseIds: string[]): Promise<ProgressRow[]> {
  if (!courseIds.length) return [];
  const { data } = await context.supabase.from("academy_lesson_progress")
    .select("lesson_id, status, position_seconds, watched_seconds, duration_seconds, last_activity_at")
    .eq("user_id", context.userId).in("course_id", courseIds);
  return (data ?? []) as ProgressRow[];
}

type Ctx = { supabase: any; userId: string };

async function myPlan(context: Ctx) {
  const { data, error } = await context.supabase.rpc("effective_plan", { _user_id: context.userId });
  if (error) throw new Error("Plan introuvable.");
  return String(data ?? "gratuit");
}
async function isAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return !!data;
}
async function assertAdmin(context: Ctx) {
  if (!(await isAdmin(context))) throw new Error("Accès réservé aux administrateurs.");
}

export type VideoCourseCard = { id: string; slug: string; title: string; description: string; minPlan: string; unlocked: boolean; lessons: number; minutes: number; external: boolean; author: string; done: number; percent: number; resumeSlug: string | null };

/** Catalogue publié (cours visibles même verrouillés ; contenu jamais envoyé ici). */
export const listVideoCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const plan = await myPlan(context);
    const { data: courses, error } = await context.supabase
      .from("academy_courses").select("id, slug, title, description, min_plan, source_type, source_author")
      .eq("status", "publie").is("owner_id", null).order("sort_order").order("created_at");
    if (error) throw new Error("Cours indisponibles.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = (courses ?? []).map((c: any) => c.id);
    const { data: lessons } = ids.length
      ? await supabaseAdmin.from("academy_lessons").select("id, slug, course_id, duration_minutes").order("sort_order").order("created_at").eq("status", "publie").in("course_id", ids)
      : { data: [] as any[] };
    const rows = await myRows(context, ids);
    return (courses ?? []).map((c: any): VideoCourseCard => {
      const ls = (lessons ?? []).filter((l: any) => l.course_id === c.id);
      const lids = ls.map((l: any) => l.id as string);
      const cp = courseProgress(lids, rows);
      const rid = resumeLesson(lids, rows);
      return {
        id: c.id, slug: c.slug, title: c.title, description: c.description, minPlan: c.min_plan,
        unlocked: canAccessCourse(plan, c.min_plan), lessons: ls.length,
        minutes: ls.reduce((s: number, l: any) => s + l.duration_minutes, 0),
        external: c.source_type === "externe", author: c.source_author,
        done: cp.done, percent: cp.percent, resumeSlug: rid ? (ls.find((l: any) => l.id === rid)?.slug ?? null) : null,
      };
    }).filter((c: VideoCourseCard) => c.lessons > 0);
  });

/** Un cours et ses leçons publiées ; vidéo, notes et transcription seulement si le plan le permet. */
export const getVideoCourse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{3,60}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase.from("academy_courses")
      .select("id, slug, title, description, min_plan, source_type, source_author, source_url")
      .eq("slug", data.slug).eq("status", "publie").is("owner_id", null).maybeSingle();
    if (!c) return null;
    const unlocked = canAccessCourse(await myPlan(context), c.min_plan);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lessons } = await supabaseAdmin.from("academy_lessons")
      .select("id, slug, title, summary, video_id, duration_minutes, notes, transcript")
      .eq("course_id", c.id).eq("status", "publie").order("sort_order").order("created_at");
    const rows = await myRows(context, [c.id]);
    const lids = (lessons ?? []).map((l: any) => l.id as string);
    return {
      progress: { ...courseProgress(lids, rows), resumeLessonId: resumeLesson(lids, rows) },
      course: { slug: c.slug, title: c.title, description: c.description, minPlan: c.min_plan as string, external: c.source_type === "externe", author: c.source_author, sourceUrl: c.source_url },
      unlocked,
      lessons: (lessons ?? []).map((l: any) => ({
        id: l.id as string, slug: l.slug as string, title: l.title as string, summary: l.summary as string, minutes: l.duration_minutes as number,
        videoId: unlocked ? (l.video_id as string) : null,
        notes: unlocked ? (l.notes as string) : "",
        transcript: unlocked ? (l.transcript as string) : "",
        progress: lessonProgress(rows.find((r) => r.lesson_id === l.id), (l.duration_minutes as number) * 60),
      })),
    };
  });

/* ---------- Administration ---------- */

export const adminListAcademy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [{ data: courses }, { data: lessons }] = await Promise.all([
      context.supabase.from("academy_courses").select("*").is("owner_id", null).order("sort_order").order("created_at"),
      context.supabase.from("academy_lessons").select("*").eq("video_provider", "youtube").order("sort_order").order("created_at"),
    ]);
    return { courses: courses ?? [], lessons: lessons ?? [] };
  });

const courseSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/, "Identifiant : minuscules, chiffres et tirets."),
  title: z.string().trim().min(3).max(120),
  description: z.string().max(2000),
  min_plan: z.enum(["gratuit", "pro", "expert", "business"]),
  source_type: z.enum(["interne", "externe"]),
  source_author: z.string().max(200),
  source_url: z.string().max(500),
  authorization_note: z.string().max(2000),
  authorized_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(["brouillon", "publie"]),
  sort_order: z.number().int().min(0).max(9999),
});

export const adminSaveCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => courseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.status === "publie" && !canPublishCourse(data)) throw new Error("Formation externe : auteur, preuve et date d’autorisation obligatoires avant publication.");
    const { id, ...row } = data;
    const q = id ? context.supabase.from("academy_courses").update(row).eq("id", id) : context.supabase.from("academy_courses").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.code === "23505" ? "Cet identifiant existe déjà." : "Cours non enregistré.");
    return { ok: true };
  });

const lessonSchema = z.object({
  id: z.string().uuid().optional(),
  course_id: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/, "Identifiant : minuscules, chiffres et tirets."),
  title: z.string().trim().min(3).max(120),
  summary: z.string().max(1000),
  video: z.string().max(300),
  duration_minutes: z.number().int().min(1).max(600),
  notes: z.string().max(20000),
  transcript: z.string().max(60000),
  status: z.enum(["brouillon", "publie"]),
  sort_order: z.number().int().min(0).max(9999),
});

export const adminSaveLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lessonSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const video_id = parseYouTubeId(data.video);
    if (!video_id) throw new Error("Lien YouTube invalide.");
    const { id, video: _v, ...rest } = data;
    const row = { ...rest, video_id };
    const q = id ? context.supabase.from("academy_lessons").update(row).eq("id", id) : context.supabase.from("academy_lessons").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.code === "23505" ? "Cet identifiant existe déjà dans ce cours." : "Leçon non enregistrée.");
    return { ok: true };
  });
