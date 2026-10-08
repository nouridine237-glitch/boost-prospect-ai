import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentNumbers = {
  orangeNumber: string;
  orangeName: string;
  mtnNumber: string;
  mtnName: string;
};

const EMPTY: PaymentNumbers = { orangeNumber: "", orangeName: "", mtnNumber: "", mtnName: "" };
const KEY = "payment_numbers";

const schema = z.object({
  orangeNumber: z.string().trim().max(40),
  orangeName: z.string().trim().max(80),
  mtnNumber: z.string().trim().max(40),
  mtnName: z.string().trim().max(80),
});

// Lecture pour tout utilisateur connecté (seules les coordonnées de paiement sont exposées).
export const getPaymentNumbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PaymentNumbers> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", KEY).maybeSingle();
    const parsed = schema.safeParse({ ...EMPTY, ...((data?.value as object) ?? {}) });
    return parsed.success ? parsed.data : EMPTY;
  });

// Modification réservée aux admins (RLS app_settings = admin uniquement).
export const savePaymentNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Accès réservé aux administrateurs.");
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: KEY, value: data as any }, { onConflict: "key" });
    if (error) throw new Error("Enregistrement impossible.");
    return { ok: true };
  });
