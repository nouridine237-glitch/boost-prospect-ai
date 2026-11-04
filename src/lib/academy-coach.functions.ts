import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAccessCourse } from "@/lib/academy-video-rules";
import { buildCoachPrompt, buildLessonContext, COACH_SYSTEM, hasCoachContext } from "@/lib/academy-coach";

const schema = z.object({
  lessonId: z.string().uuid(),
  question: z.string().trim().min(3).max(600),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(10).default([]),
});

/** Coach contextuel : contenu de la leçon lu côté serveur après contrôle du plan ; partage le quota IA. */
export const askLessonCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Le service IA n’est pas configuré.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lesson } = await supabaseAdmin.from("academy_lessons")
      .select("title, summary, notes, transcript, course_id").eq("id", data.lessonId).eq("status", "publie").maybeSingle();
    if (!lesson) throw new Error("Leçon introuvable.");
    // Cours lu avec le client de l'utilisateur (RLS : publié seulement).
    const { data: course } = await context.supabase.from("academy_courses").select("min_plan").eq("id", lesson.course_id).eq("status", "publie").maybeSingle();
    if (!course) throw new Error("Leçon introuvable.");
    const { data: plan } = await context.supabase.rpc("effective_plan", { _user_id: context.userId });
    if (!canAccessCourse(String(plan ?? "gratuit"), course.min_plan)) throw new Error("Ce cours n’est pas inclus dans votre plan.");
    if (!hasCoachContext(lesson)) throw new Error("Le coach n’est pas disponible pour cette leçon.");

    const { data: resId, error: resErr } = await context.supabase.rpc("reserve_ai_generation", { _type: "coach_academie" });
    if (resErr) {
      const m = String(resErr.message ?? "").match(/LIMITE_IA:(\d+)/);
      if (m) throw new Error(`Vous avez atteint la limite de ${m[1]} générations IA de votre plan ce mois-ci.`);
      throw new Error("Le coach n’a pas pu démarrer. Réessayez dans un instant.");
    }
    const reservation = String(resId);
    let text = "";
    let result: ReturnType<typeof streamText>;
    try {
      const lovable = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key, headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
      result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system: COACH_SYSTEM,
        prompt: buildCoachPrompt(buildLessonContext(lesson), data.history, data.question),
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
      });
      text = await result.text;
      if (!text.trim()) throw new Error("vide");
    } catch {
      await supabaseAdmin.from("ai_usage_log").delete().eq("id", reservation);
      throw new Error("Le coach n’a pas pu répondre. Votre quota n’a pas été consommé, réessayez.");
    }
    const usage = await Promise.resolve(result.totalUsage).catch(() => undefined);
    const tokens = Number(usage?.totalTokens ?? 0) || Math.ceil(text.length / 3);
    await supabaseAdmin.from("ai_usage_log").update({ credits_estimes: Math.max(0.01, Math.round((tokens / 10000) * 100) / 100) }).eq("id", reservation);
    return { text: text.trim() };
  });
