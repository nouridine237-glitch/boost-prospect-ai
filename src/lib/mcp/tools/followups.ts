import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { COLS, toJson } from "./prospects";

export default defineTool({
  name: "list_followups_today",
  title: "Prospects à relancer aujourd'hui",
  description: "Liste les prospects dont la relance est prévue aujourd'hui ou en retard, du plus en retard au plus récent.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Non authentifié");
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabaseForUser(ctx).from("prospects").select(COLS)
      .eq("user_id", ctx.getUserId()!).lte("next_followup_date", today)
      .not("status", "in", "(client,non_intéressé)").order("next_followup_date", { ascending: true }).limit(100);
    if (error) throw new ToolError(error.message);
    const prospects = (data ?? []).map(toJson);
    return { content: [{ type: "text", text: JSON.stringify(prospects) }], structuredContent: { prospects } };
  },
});
