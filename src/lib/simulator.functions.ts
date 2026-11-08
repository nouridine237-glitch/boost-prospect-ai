import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  cleanReply, configSchema, isAlternating, MAX_MESSAGE, MAX_TURNS, MIN_TURNS_FOR_REVIEW, parseReview, prospectPrompt,
  prospectSystem, reviewSystem, transcriptSchema, userTurns, type SimMessage,
} from "@/lib/simulator";

// Chaque réplique et le bilan consomment 1 génération du quota IA existant (reserve_ai_generation), remboursée en cas d'échec.
async function runAI(context: { supabase: any }, system: string, prompt: string): Promise<{ text: string; settle: (ok: boolean) => Promise<void> }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Le service IA n’est pas configuré.");
  const { data: resId, error } = await context.supabase.rpc("reserve_ai_generation", { _type: "reponse_prospect" });
  if (error) {
    const m = String(error.message ?? "").match(/LIMITE_IA:(\d+)/);
    if (m) throw new Error(`Vous avez atteint la limite de ${m[1]} générations IA de votre plan ce mois-ci. Passez à un plan supérieur sur la page Abonnement pour continuer.`);
    throw new Error("La simulation n’a pas pu démarrer. Réessayez dans un instant.");
  }
  const reservation = String(resId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const refund = () => supabaseAdmin.from("ai_usage_log").delete().eq("id", reservation).then(() => undefined);
  let text = "";
  let result: ReturnType<typeof streamText>;
  try {
    const lovable = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key, headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
    result = streamText({
      model: lovable.responses("openai/gpt-6-astra"), system, prompt, maxRetries: 0,
      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
    });
    text = await result.text;
    if (!text.trim()) throw new Error("vide");
  } catch {
    await refund();
    throw new Error("Le prospect virtuel n’a pas pu répondre. Votre quota n’a pas été consommé, réessayez.");
  }
  return {
    text,
    settle: async ok => {
      if (!ok) return refund();
      const usage = await Promise.resolve(result.totalUsage).catch(() => undefined);
      const tokens = Number(usage?.totalTokens ?? 0) || Math.ceil(text.length / 3);
      await supabaseAdmin.from("ai_usage_log").update({ credits_estimes: Math.max(0.01, Math.round((tokens / 10000) * 100) / 100) }).eq("id", reservation);
    },
  };
}

const replySchema = z.object({ config: configSchema, messages: transcriptSchema });

export const simulatorReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => replySchema.parse(d))
  .handler(async ({ data, context }) => {
    const m = data.messages as SimMessage[];
    const last = m.at(-1);
    if (!last || last.role !== "user" || last.text.length > MAX_MESSAGE) throw new Error("Message invalide.");
    if (!isAlternating(m) || userTurns(m) > MAX_TURNS) throw new Error("Conversation invalide. Recommencez la simulation.");
    const ai = await runAI(context, prospectSystem(data.config), prospectPrompt(m));
    const reply = cleanReply(ai.text);
    await ai.settle(true);
    return { reply };
  });

export const simulatorReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => replySchema.parse(d))
  .handler(async ({ data, context }) => {
    const m = data.messages as SimMessage[];
    if (!isAlternating(m) || userTurns(m) < MIN_TURNS_FOR_REVIEW) throw new Error(`Échangez au moins ${MIN_TURNS_FOR_REVIEW} messages avant le bilan.`);
    const ai = await runAI(context, reviewSystem(data.config), `<conversation>\n${m.map(x => `${x.role === "user" ? "ENTREPRENEUR" : "PROSPECT"}: ${x.text}`).join("\n")}\n</conversation>\nProduis le bilan JSON.`);
    const review = parseReview(ai.text);
    if (!review) console.error("[simulateur] bilan illisible:", ai.text.slice(0, 1500));
    await ai.settle(!!review);
    if (!review) throw new Error("Le bilan n’a pas pu être généré. Votre quota n’a pas été consommé, réessayez.");
    return { review };
  });
