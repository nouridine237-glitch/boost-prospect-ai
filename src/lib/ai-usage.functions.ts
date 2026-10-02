import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_LIMIT = 100;

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Accès réservé aux administrateurs.");
}

function monthStartIso() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export const getAiCreditUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const [{ data: logs }, { data: setting }] = await Promise.all([
      sb.from("ai_usage_log").select("credits_estimes").gte("created_at", monthStartIso()).limit(100000),
      sb.from("app_settings").select("value").eq("key", "ai_credit_limit").maybeSingle(),
    ]);
    const used = (logs ?? []).reduce((s: number, r: any) => s + Number(r.credits_estimes ?? 0), 0);
    const limit = Number(setting?.value?.limit ?? DEFAULT_LIMIT);
    return { used: Math.round(used * 100) / 100, limit, count: (logs ?? []).length };
  });

export const setAiCreditLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ limit: z.number().positive().max(10_000_000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("app_settings").upsert({ key: "ai_credit_limit", value: { limit: data.limit } });
    if (error) throw new Error("La limite n’a pas pu être enregistrée.");
    return { limit: data.limit };
  });
