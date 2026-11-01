import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scoreQuiz } from "@/lib/academy-score";

/** Le navigateur envoie seulement les réponses ; le score est recalculé ici. */
export const submitAcademyQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ level: z.number().int().min(1).max(20), answers: z.array(z.number().int().min(0).max(10)).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = scoreQuiz(data.level, data.answers);
    if (!r) throw new Error("Réponses invalides.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("record_academy_result", {
      _user_id: context.userId, _level: r.level, _score: r.score, _total: r.total, _passed: r.passed,
    });
    if (error) { console.error("record_academy_result", error); throw new Error("Résultat non enregistré, réessaie."); }
    return r;
  });
