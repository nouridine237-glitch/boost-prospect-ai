import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { COLS, STATUSES, toJson } from "./prospects";

export default defineTool({
  name: "update_prospect",
  title: "Mettre à jour un prospect",
  description: "Modifie le statut, les notes ou la date de relance d'un prospect de l'utilisateur.",
  inputSchema: {
    id: z.string().uuid(),
    status: z.enum(STATUSES).optional(),
    notes: z.string().max(4000).optional(),
    next_followup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Non authentifié");
    const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(changes).length) throw new ToolError("Aucune modification fournie.");
    const { data, error } = await supabaseForUser(ctx).from("prospects").update(changes)
      .eq("id", id).eq("user_id", ctx.getUserId()!).select(COLS).maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Prospect introuvable.");
    const prospect = toJson(data);
    return { content: [{ type: "text", text: `Prospect mis à jour : ${prospect.name}` }], structuredContent: { prospect } };
  },
});
