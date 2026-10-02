import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const modeToType = {
  "Message de prospection": "message_prospection",
  "Réponse à un prospect": "reponse_prospect",
  "Script d'appel": "script_appel",
  "Post réseau social": "post_reseau_social",
} as const;

const inputSchema = z.object({
  mode: z.enum(["Message de prospection", "Réponse à un prospect", "Script d'appel", "Post réseau social"]),
  context: z.string().min(8).max(4000),
  prospectId: z.string().uuid().optional(),
});

export const generateProspectingContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Le service IA n’est pas configuré.");

    const { data: subscription } = await context.supabase
      .from("subscriptions")
      .select("limite_generations_ia")
      .eq("user_id", context.userId)
      .maybeSingle();
    const limit = subscription?.limite_generations_ia ?? 5;
    if (limit >= 0) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const { count } = await context.supabase
        .from("ai_generations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart.toISOString());
      if ((count ?? 0) >= limit) {
        throw new Error("Vous avez atteint la limite de générations IA de votre plan actuel pour ce mois. Passez à un plan supérieur pour continuer à générer du contenu.");
      }
    }

    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      system: "Tu es un assistant de prospection MLM éthique. Rédige en français naturel, sans promesse de gains, sans pression, avec une approche humaine, concise et personnalisable.",
      prompt: `Format demandé : ${data.mode}\nContexte : ${data.context}`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const text = await result.text;
    // Estimation : ~1 crédit pour 10 000 tokens, minimum 0,01 par génération.
    const usage = await Promise.resolve(result.totalUsage).catch(() => undefined);
    const tokens = Number(usage?.totalTokens ?? 0) || Math.ceil((data.context.length + text.length) / 3);
    const credits = Math.max(0.01, Math.round((tokens / 10000) * 100) / 100);
    await (context.supabase as any).from("ai_usage_log").insert({
      user_id: context.userId,
      generation_type: modeToType[data.mode],
      credits_estimes: credits,
    });
    const { error } = await context.supabase.from("ai_generations").insert({
      user_id: context.userId,
      generated_content: text,
      generation_type: modeToType[data.mode],
      ...(data.prospectId ? { prospect_id: data.prospectId } : {}),
    });
    if (error) throw new Error("Le contenu a été créé, mais son enregistrement a échoué.");
    return { text };
  });