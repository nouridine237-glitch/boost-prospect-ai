import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const scriptCategories = ["Premier contact", "Relance", "Objections", "Invitation", "Suivi d’équipe"] as const;

export const getScripts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // RLS only returns company templates in full to Business (effective_plan) or admin.
    const [{ data, error }, role, teasers] = await Promise.all([
      context.supabase.from("scripts").select("*").order("sort_order"),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("company_script_teasers"),
    ]);
    if (error) throw new Error("Impossible de charger les scripts. Réessayez.");
    const full = (data ?? []).map(s => ({ ...s, locked: false }));
    const ids = new Set(full.map(s => s.id));
    const locked = (teasers.data ?? []).filter(t => !ids.has(t.id)).map(t => ({ id: t.id, title: t.title, category: t.category, company: t.company, sort_order: t.sort_order, content: "", created_at: "", updated_at: "", locked: true }));
    return { scripts: [...full, ...locked].sort((a, b) => a.sort_order - b.sort_order), isAdmin: role.data === true };
  });

export const saveScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(), title: z.string().trim().min(1).max(160),
    category: z.enum(scriptCategories), content: z.string().trim().min(8).max(3000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !admin) throw new Error("Modification réservée à l’administrateur.");
    const { error } = await context.supabase.from("scripts").update({ title: data.title, category: data.category, content: data.content }).eq("id", data.id);
    if (error) throw new Error("Le script n’a pas pu être enregistré.");
    return { saved: true };
  });