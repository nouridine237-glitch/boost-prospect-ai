import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { COLS, STATUSES, toJson } from "./prospects";

export default defineTool({
  name: "create_prospect",
  title: "Ajouter un prospect",
  description: "Ajoute un prospect au CRM de l'utilisateur (la limite de prospects de son plan s'applique).",
  inputSchema: {
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(40).optional(),
    status: z.enum(STATUSES).default("nouveau"),
    source: z.string().trim().max(120).optional(),
    product_interest: z.string().trim().max(200).optional(),
    notes: z.string().max(4000).optional(),
    next_followup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Date AAAA-MM-JJ."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Non authentifié");
    const { data, error } = await supabaseForUser(ctx).from("prospects").insert({
      user_id: ctx.getUserId()!, name: input.name, phone: input.phone ?? null, status: input.status,
      source: input.source ?? "", product_interest: input.product_interest ?? "", notes: input.notes ?? null,
      next_followup_date: input.next_followup_date ?? null,
    }).select(COLS).single();
    if (error) throw new ToolError(error.message);
    const prospect = toJson(data);
    return { content: [{ type: "text", text: `Prospect ajouté : ${prospect.name}` }], structuredContent: { prospect } };
  },
});
