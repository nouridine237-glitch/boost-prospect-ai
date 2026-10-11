import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProspects from "./tools/prospects";
import followups from "./tools/followups";
import createProspect from "./tools/create-prospect";
import updateProspect from "./tools/update-prospect";
import listScripts from "./tools/scripts";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "boost-prospect-ai",
  title: "Boost Prospect AI",
  version: "0.1.0",
  instructions: "Outils du CRM de prospection MLM Boost AI : consulter, ajouter et mettre à jour ses prospects, voir les relances du jour et la bibliothèque de scripts éthiques. Ne jamais promettre de revenus.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [listProspects, followups, createProspect, updateProspect, listScripts],
});
