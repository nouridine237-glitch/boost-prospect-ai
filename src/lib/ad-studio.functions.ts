import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AD_STUDIO_MODULES, isAdStudioOwner } from "./ad-studio";

/** Renvoie le tableau de bord uniquement à l'administrateur principal (UUID vérifié côté serveur). */
export const getAdStudio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isAdStudioOwner(context.userId)) throw new Response("Forbidden", { status: 403 });
    return { modules: AD_STUDIO_MODULES.map((m) => ({ ...m })) };
  });
