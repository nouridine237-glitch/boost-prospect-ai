import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isAdStudioOwner } from "./ad-studio";

/** Only the existing principal owner AND existing admin role may enter the MFA gate. */
export async function assertStudioAccess(
  db: SupabaseClient<Database>, userId: string, assurance: unknown, requireMfa = true,
) {
  if (!isAdStudioOwner(userId)) throw new Error("Accès réservé à l'administrateur principal.");
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Rôle administrateur requis.");
  if (requireMfa && assurance !== "aal2") throw new Error("Double authentification requise pour l'Ad Studio.");
}