import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  mode: z.enum(["Message de prospection", "Réponse à un prospect", "Script d'appel", "Post réseau social"]),
  context: z.string().min(8).max(4000),
});

export const generateProspectingContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Le service IA n’est pas configuré.");

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
    const { error } = await context.supabase.from("ai_generations").insert({
      user_id: context.userId,
      generated_content: text,
    });
    if (error) throw new Error("Le contenu a été créé, mais son enregistrement a échoué.");
    return { text };
  });