import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export const STATUSES = ["nouveau", "contacté", "discussion", "intéressé", "client", "non_intéressé"] as const;

type Row = {
  id: string; name: string; status: string; phone: string | null; interest_level: number | null;
  source: string; product_interest: string; main_objection: string; notes: string | null;
  next_followup_date: string | null; last_contact_date: string | null;
};
export const COLS = "id, name, status, phone, interest_level, source, product_interest, main_objection, notes, next_followup_date, last_contact_date";
export const toJson = (p: Row) => ({
  id: p.id, name: p.name, status: p.status, phone: p.phone, interest_level: p.interest_level,
  source: p.source, product_interest: p.product_interest, main_objection: p.main_objection,
  notes: p.notes, next_followup_date: p.next_followup_date, last_contact_date: p.last_contact_date,
});

export default defineTool({
  name: "list_prospects",
  title: "Lister mes prospects",
  description: "Liste les prospects de l'utilisateur connecté, avec filtre optionnel par statut ou recherche par nom.",
  inputSchema: {
    status: z.enum(STATUSES).optional().describe("Filtrer par statut."),
    search: z.string().max(100).optional().describe("Recherche dans le nom."),
    limit: z.number().int().min(1).max(100).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Non authentifié");
    let q = supabaseForUser(ctx).from("prospects").select(COLS).eq("user_id", ctx.getUserId()!).order("updated_at", { ascending: false }).limit(limit);
    if (status) q = q.eq("status", status);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const prospects = (data as Row[]).map(toJson);
    return { content: [{ type: "text", text: JSON.stringify(prospects) }], structuredContent: { prospects } };
  },
});
