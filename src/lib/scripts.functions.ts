import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const scriptCategories = ["Premier contact", "Relance", "Objections", "Invitation", "Suivi d’équipe"] as const;

export const getScripts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data, error }, role] = await Promise.all([
      context.supabase.from("scripts").select("*").order("sort_order"),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (error) throw new Error("Impossible de charger les scripts. Réessayez.");
    return { scripts: data ?? [], isAdmin: role.data === true };
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