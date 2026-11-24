import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AD_STUDIO_MODULES, isAdStudioOwner } from "./ad-studio";
import { validatePublicUrl, type AnalysisReport } from "./url-analyzer";

function assertOwner(userId: string) {
  if (!isAdStudioOwner(userId)) throw new Response("Forbidden", { status: 403 });
}

/** Renvoie le tableau de bord uniquement à l'administrateur principal (UUID vérifié côté serveur). */
export const getAdStudio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertOwner(context.userId);
    return { modules: AD_STUDIO_MODULES.map((m) => ({ ...m })) };
  });

export type UrlAnalysisRow = {
  id: string;
  url: string;
  status: "en_cours" | "termine" | "echec";
  error: string;
  created_at: string;
  finished_at: string | null;
};

const STALE_MS = 3 * 60 * 1000;

/** Lance une analyse (une seule à la fois). Contrôle UUID serveur + RLS sur chaque lecture/écriture. */
export const runUrlAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().max(2048) }).parse(input))
  .handler(async ({ data, context }) => {
    assertOwner(context.userId);
    const check = validatePublicUrl(data.url);
    if (!check.ok) return { ok: false as const, error: check.error, id: null };
    const db = context.supabase;
    await db.from("ad_studio_url_analyses")
      .update({ status: "echec", error: "Analyse interrompue.", finished_at: new Date().toISOString() })
      .eq("owner_id", context.userId).eq("status", "en_cours").lt("created_at", new Date(Date.now() - STALE_MS).toISOString());
    const { data: row, error: insErr } = await db.from("ad_studio_url_analyses")
      .insert({ owner_id: context.userId, url: check.url, status: "en_cours" }).select("id").single();
    if (insErr || !row) {
      if (insErr?.code === "23505") return { ok: false as const, error: "Une analyse est déjà en cours. Attends qu'elle se termine.", id: null };
      console.error("url analysis insert failed", insErr?.code);
      return { ok: false as const, error: "Impossible d'enregistrer l'analyse.", id: null };
    }
    const { analyzePublicUrl, AnalyzerError } = await import("./url-analyzer.server");
    try {
      const report = await analyzePublicUrl(check.url);
      await db.from("ad_studio_url_analyses")
        .update({ status: "termine", report: report as never, finished_at: new Date().toISOString() }).eq("id", row.id);
      return { ok: true as const, error: "", id: row.id as string };
    } catch (e) {
      const msg = e instanceof AnalyzerError ? e.message : "Erreur inattendue pendant l'analyse.";
      if (!(e instanceof AnalyzerError)) console.error("url analysis failed", e instanceof Error ? e.name : "unknown");
      await db.from("ad_studio_url_analyses")
        .update({ status: "echec", error: msg.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", row.id);
      return { ok: false as const, error: msg, id: row.id as string };
    }
  });

export const listUrlAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertOwner(context.userId);
    const { data, error } = await context.supabase.from("ad_studio_url_analyses")
      .select("id, url, status, error, created_at, finished_at")
      .eq("owner_id", context.userId).order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("Historique indisponible.");
    return { rows: (data ?? []) as UrlAnalysisRow[] };
  });

export const getUrlAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertOwner(context.userId);
    const { data: row, error } = await context.supabase.from("ad_studio_url_analyses")
      .select("id, url, status, error, created_at, finished_at, report")
      .eq("id", data.id).eq("owner_id", context.userId).maybeSingle();
    if (error) throw new Error("Analyse indisponible.");
    if (!row) return { row: null };
    const { report, ...rest } = row;
    return { row: { ...(rest as UrlAnalysisRow), report: (report ?? null) as AnalysisReport | null } };
  });
