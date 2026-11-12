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

/** Une vidéo est-elle encore référencée par une leçon vivante, un accès en cours, ou la dernière version publiée d'une formation active ? */
export async function videoReferences(admin: any, videoId: string) {
  const [{ count: lessons }, { data: versions }] = await Promise.all([
    admin.from("academy_lessons").select("id", { count: "exact", head: true }).eq("user_video_id", videoId).is("archived_at", null),
    admin.from("course_versions").select("id, course_id, version").contains("lessons", [{ video_id: videoId }]),
  ]);
  const vs = (versions ?? []) as { id: string; course_id: string; version: number }[];
  let grants = 0, latestVersions = 0;
  if (vs.length) {
    const courseIds = [...new Set(vs.map((v) => v.course_id))];
    const [{ count }, { data: all }, { data: courses }] = await Promise.all([
      admin.from("course_grants").select("id", { count: "exact", head: true }).in("version_id", vs.map((v) => v.id)).in("status", ["en_attente", "actif"]),
      admin.from("course_versions").select("course_id, version").in("course_id", courseIds),
      admin.from("academy_courses").select("id").in("id", courseIds).is("archived_at", null),
    ]);
    grants = count ?? 0;
    const active = new Set((courses ?? []).map((c: any) => c.id));
    latestVersions = vs.filter((v) => active.has(v.course_id)
      && v.version === Math.max(...(all ?? []).filter((x: any) => x.course_id === v.course_id).map((x: any) => x.version))).length;
  }
  return { lessons: lessons ?? 0, grants, latestVersions };
}
