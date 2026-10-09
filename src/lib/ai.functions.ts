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
  "Message d'accueil / encouragement": "message_prospection",
} as const;

const inputSchema = z.object({
  mode: z.enum(["Message de prospection", "Réponse à un prospect", "Script d'appel", "Post réseau social", "Message d'accueil / encouragement"]),
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
const suggestSchema = z.object({ prospectId: z.string().uuid() });

export const suggestNextAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => suggestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Le service IA n’est pas configuré.");
    const { data: subscription } = await context.supabase.from("subscriptions").select("limite_generations_ia").eq("user_id", context.userId).maybeSingle();
    const limit = subscription?.limite_generations_ia ?? 5;
    if (limit >= 0) {
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const { count } = await context.supabase.from("ai_generations").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString());
      if ((count ?? 0) >= limit) throw new Error("LIMIT_REACHED");
    }
    const { data: p } = await context.supabase.from("prospects").select("name, status, interest_level, source, product_interest, main_objection, notes, last_contact_date, next_followup_date").eq("id", data.prospectId).maybeSingle();
    if (!p) throw new Error("Prospect introuvable.");
    const interest = ({ 3: "Chaud", 2: "Tiède", 1: "Froid" } as Record<number, string>)[p.interest_level ?? 0] ?? "non renseigné";
    const lovable = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key, headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      system: "Tu es un coach de prospection MLM éthique. Tu réponds en français. Ne promets JAMAIS de gains, de revenus ou de résultats financiers garantis. Pas de pression. Réponds EXACTEMENT sous ce format, sur trois lignes :\nACTION: <action recommandée en une phrase>\nMOMENT: <meilleur moment pour la faire>\nMESSAGE: <message WhatsApp court (2 à 4 phrases), naturel, tutoiement, prêt à envoyer ; s'il y a une objection principale, y répondre avec empathie>",
      prompt: `Prénom/nom : ${p.name}\nStatut : ${p.status}\nNiveau d'intérêt : ${interest}\nSource : ${p.source || "non renseignée"}\nProduit d'intérêt : ${p.product_interest || "non renseigné"}\nObjection principale : ${p.main_objection || "aucune"}\nNotes : ${p.notes || "aucune"}\nDernier contact : ${p.last_contact_date ? String(p.last_contact_date).slice(0, 10) : "inconnu"}\nProchaine relance prévue : ${p.next_followup_date ?? "aucune"}\nDate du jour : ${new Date().toISOString().slice(0, 10)}`,
      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
    });
    const text = await result.text;
    const pick = (label: string) => text.match(new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=\\n(?:ACTION|MOMENT|MESSAGE)\\s*:|$)`, "i"))?.[1]?.trim() ?? "";
    const suggestion = { action: pick("ACTION"), moment: pick("MOMENT"), message: pick("MESSAGE") || text.trim() };
    const usage = await Promise.resolve(result.totalUsage).catch(() => undefined);
    const tokens = Number(usage?.totalTokens ?? 0) || Math.ceil(text.length / 3);
    await (context.supabase as any).from("ai_usage_log").insert({ user_id: context.userId, generation_type: "message_prospection", credits_estimes: Math.max(0.01, Math.round((tokens / 10000) * 100) / 100) });
    await context.supabase.from("ai_generations").insert({ user_id: context.userId, generated_content: suggestion.message, generation_type: "message_prospection", prospect_id: data.prospectId });
    return suggestion;
  });
