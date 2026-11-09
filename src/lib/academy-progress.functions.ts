import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAccessCourse } from "@/lib/academy-video-rules";

/** Enregistre la position et l'état de lecture ; le temps visionné est calculé en base avec l'horloge serveur. */
export const saveLessonProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    lessonId: z.string().uuid(),
    position: z.number().min(0).max(86400),
    playing: z.boolean(),
    duration: z.number().min(0).max(86400).nullable(),
    manual: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lesson } = await supabaseAdmin.from("academy_lessons")
      .select("id, status, course_id, academy_courses!inner(min_plan, status, owner_id)")
      .eq("id", data.lessonId).maybeSingle();
    const course = (lesson as any)?.academy_courses;
    if (course?.owner_id) {
      // Formation utilisateur : propriétaire ou octroi actif ; progression toujours au nom de la personne qui regarde.
      const { lessonAccess } = await import("@/lib/videotheque-access.server");
      if (!(await lessonAccess(supabaseAdmin, context.userId, (lesson as any).course_id, data.lessonId))) return { status: "indisponible" as const };
    } else {
      if (!lesson || lesson.status !== "publie" || course?.status !== "publie") return { status: "indisponible" as const };
      const { data: plan, error: planErr } = await context.supabase.rpc("effective_plan", { _user_id: context.userId });
      if (planErr) throw new Error("Plan introuvable.");
      if (!canAccessCourse(String(plan ?? "gratuit"), course.min_plan)) return { status: "verrouille" as const };
    }
    const { data: status, error } = await supabaseAdmin.rpc("record_lesson_progress", {
      _user_id: context.userId, _lesson_id: data.lessonId, _position: Math.floor(data.position),
      _playing: data.playing, _player_duration: data.duration ? Math.floor(data.duration) : 0, _manual: data.manual,
    });
    if (error) { console.error("record_lesson_progress", error); throw new Error("Progression non enregistrée."); }
    return { status: String(status) as "en_cours" | "terminee" | "indisponible" };
  });
