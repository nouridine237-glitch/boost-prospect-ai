import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AD_STUDIO_MODULES } from "./ad-studio";
import { validatePublicUrl, type AnalysisReport } from "./url-analyzer";
import { analysisReportSchema, saveAnalysisNotesSchema } from "./ad-studio.schemas";

/** Renvoie le tableau de bord uniquement à l'administrateur principal (UUID vérifié côté serveur). */
export const getAdStudio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStudioAccess } = await import("./ad-studio-access.server");
    await assertStudioAccess(context.supabase, context.userId, context.claims["aal"], false);
    const mfaRequired = context.claims["aal"] !== "aal2";
    return {
      mfaRequired,
      modules: mfaRequired ? [] : AD_STUDIO_MODULES.map((m) => ({ ...m })),
      analyzerAvailable: false,
      analyzerBlockReason: "Firecrawl est connecté. La vérification des protections contre les destinations privées et les redirections reste nécessaire avant activation.",
    };
  });

export type UrlAnalysisRow = {
  id: string;
  url: string;
  status: "en_cours" | "termine" | "echec";
  error: string;
  created_at: string;
  finished_at: string | null;
};

/** Fail closed until the connected transport's SSRF guarantees have been verified. */
export const runUrlAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().max(2048) }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertStudioAccess } = await import("./ad-studio-access.server");
    await assertStudioAccess(context.supabase, context.userId, context.claims["aal"]);
    const check = validatePublicUrl(data.url);
    if (!check.ok) return { ok: false as const, error: check.error, id: null };
    return { ok: false as const, error: "Analyse suspendue : les garanties de sécurité du transport web ne sont pas encore vérifiées. Aucun appel facturé n'a été lancé.", id: null };
  });

export const listUrlAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStudioAccess } = await import("./ad-studio-access.server");
    await assertStudioAccess(context.supabase, context.userId, context.claims["aal"]);
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
    const { assertStudioAccess } = await import("./ad-studio-access.server");
    await assertStudioAccess(context.supabase, context.userId, context.claims["aal"]);
    const { data: row, error } = await context.supabase.from("ad_studio_url_analyses")
      .select("id, url, status, error, created_at, finished_at, report, admin_notes, edit_version")
      .eq("id", data.id).eq("owner_id", context.userId).maybeSingle();
    if (error) throw new Error("Analyse indisponible.");
    if (!row) return { row: null };
    const { report, ...rest } = row;
    const parsed = report === null ? null : analysisReportSchema.safeParse(report);
    if (parsed && !parsed.success) throw new Error("Le rapport enregistré est invalide. L'original est conservé.");
    return { row: { ...rest, status: rest.status as UrlAnalysisRow["status"], report: parsed?.success ? parsed.data as AnalysisReport : null } };
  });

export const saveAnalysisNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveAnalysisNotesSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { assertStudioAccess } = await import("./ad-studio-access.server");
    await assertStudioAccess(context.supabase, context.userId, context.claims["aal"]);
    const { data: row, error } = await context.supabase.from("ad_studio_url_analyses")
      .update({ admin_notes: data.notes }).eq("id", data.id).eq("owner_id", context.userId)
      .eq("edit_version", data.version).select("edit_version").maybeSingle();
    if (error) throw new Error("Notes non enregistrées. Le texte reste dans l'éditeur.");
    if (!row) throw new Error("Cette fiche a changé dans une autre session. Recharge sa dernière version avant de l'écraser.");
    return { version: row.edit_version };
  });

export const listAnalysisRevisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { assertStudioAccess } = await import("./ad-studio-access.server");
    await assertStudioAccess(context.supabase, context.userId, context.claims["aal"]);
    const { data: rows, error } = await context.supabase.from("ad_studio_analysis_revisions")
      .select("id, version, notes, created_at").eq("analysis_id", data.id).eq("owner_id", context.userId)
      .order("version", { ascending: false }).limit(100);
    if (error) throw new Error("Versions indisponibles.");
    return { rows: rows ?? [] };
  });
