import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_scripts",
  title: "Bibliothèque de scripts",
  description: "Liste les modèles de scripts de prospection éthiques disponibles.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Non authentifié");
    const { data, error } = await supabaseForUser(ctx).from("scripts").select("*").limit(100);
    if (error) throw new ToolError(error.message);
    const scripts = (data ?? []).map((s: Record<string, unknown>) => ({
      id: String(s["id"]), title: String(s["title"] ?? ""), category: String(s["category"] ?? ""), content: String(s["content"] ?? s["body"] ?? ""),
    }));
    return { content: [{ type: "text", text: JSON.stringify(scripts) }], structuredContent: { scripts } };
  },
});
