import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasFeature } from "./plans";
import { KIT_IDS } from "./duplication-rules";

export const getDuplication = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: plan, error } = await context.supabase.rpc("effective_plan", { _user_id: context.userId });
  if (error || !plan) throw new Error("Impossible de vérifier votre accès. Réessayez.");
  if (!hasFeature(plan, "duplicationPath") || !hasFeature(plan, "duplicationKits")) return { allowed: false, days: [], kits: [], progress: [] };
  const { data: progress, error: readError } = await context.supabase.from("duplication_progress").select("track, day, checked_actions, completed_at").eq("user_id", context.userId).order("day");
  if (readError) throw new Error("Impossible de charger votre progression. Réessayez.");
  const { duplicationDays, duplicationKits } = await import("./duplication-catalog.server");
  return { allowed: true, days: duplicationDays, kits: duplicationKits, progress: progress ?? [] };
});

export const saveDuplication = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ track: z.enum(["path", ...KIT_IDS]), day: z.number().int().min(1).max(7), actions: z.array(z.number().int().min(0).max(3)).max(4), complete: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("save_duplication_progress", { _track: data.track, _day: data.day, _actions: data.actions, _complete: data.complete });
    if (error) throw new Error("Enregistrement impossible. Vérifiez votre plan, les journées précédentes et la checklist, puis réessayez.");
    return { saved: true };
  });