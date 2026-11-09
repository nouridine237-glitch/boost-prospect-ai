// Contrôle d'accès serveur aux leçons des formations utilisateur (propriétaire ou octroi actif).
import type { SnapshotLesson } from "@/lib/videotheque";

export type LessonAccess = { role: "owner" | "recipient"; videoId: string; ownerId: string };

export async function lessonAccess(admin: any, userId: string, courseId: string, lessonId: string): Promise<LessonAccess | null> {
  const { data: c } = await admin.from("academy_courses").select("id, owner_id").eq("id", courseId).maybeSingle();
  if (!c?.owner_id) return null;
  let videoId: string | null = null;
  let role: LessonAccess["role"];
  if (c.owner_id === userId) {
    role = "owner";
    const { data: l } = await admin.from("academy_lessons").select("user_video_id")
      .eq("id", lessonId).eq("course_id", courseId).is("archived_at", null).maybeSingle();
    videoId = l?.user_video_id ?? null;
  } else {
    role = "recipient";
    const { data: g } = await admin.from("course_grants").select("version_id")
      .eq("course_id", courseId).eq("recipient_id", userId).eq("status", "actif").maybeSingle();
    if (!g) return null;
    const { data: v } = await admin.from("course_versions").select("lessons").eq("id", g.version_id).maybeSingle();
    videoId = ((v?.lessons ?? []) as SnapshotLesson[]).find((x) => x.lesson_id === lessonId)?.video_id ?? null;
  }
  if (!videoId) return null;
  const { data: vid } = await admin.from("user_videos").select("id").eq("id", videoId).is("moderated_at", null).is("deleted_at", null).maybeSingle();
  return vid ? { role, videoId, ownerId: c.owner_id } : null;
}

/** Une vidéo est-elle encore référencée par une version reçue (en attente ou active) ou une leçon vivante ? */
export async function videoReferences(admin: any, videoId: string) {
  const [{ count: lessons }, { data: versions }] = await Promise.all([
    admin.from("academy_lessons").select("id", { count: "exact", head: true }).eq("user_video_id", videoId).is("archived_at", null),
    admin.from("course_versions").select("id").contains("lessons", [{ video_id: videoId }]),
  ]);
  const ids = (versions ?? []).map((v: any) => v.id);
  let grants = 0;
  if (ids.length) {
    const { count } = await admin.from("course_grants").select("id", { count: "exact", head: true }).in("version_id", ids).in("status", ["en_attente", "actif"]);
    grants = count ?? 0;
  }
  return { lessons: lessons ?? 0, grants };
}
