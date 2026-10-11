import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type OAuthResult = { data: { redirect_url?: string; redirect_to?: string; client?: { name?: string } } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  head: () => ({ meta: [
    { title: "Autoriser l'accès — MLM Boost AI" },
    { name: "description", content: "Autorisez un assistant IA à accéder à votre compte MLM Boost AI." },
    { property: "og:title", content: "Autoriser l'accès — MLM Boost AI" },
    { property: "og:description", content: "Connexion d'un assistant externe à votre compte." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ]}),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Identifiant d'autorisation manquant.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div className="max-w-md rounded-xl border border-border bg-card p-8">
        <h1 className="text-xl font-bold">Demande d'autorisation invalide</h1>
        <p className="mt-3 text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
        <p className="mt-3 text-sm text-muted-foreground">Relancez la connexion depuis votre assistant.</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? "Un assistant";

  async function decide(approve: boolean) {
    setBusy(true); setError(null);
    try {
      const { data, error } = approve ? await oauth().approveAuthorization(authorization_id) : await oauth().denyAuthorization(authorization_id);
      if (error) throw new Error(error.message);
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) throw new Error("Aucune redirection reçue. Réessayez.");
      window.location.href = target;
    } catch (e) {
      setBusy(false); setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <Brand />
        <h1 className="mt-6 text-2xl font-extrabold">{name} souhaite accéder à votre compte</h1>
        <p className="mt-3 text-sm text-muted-foreground">Il pourra consulter, ajouter et modifier vos prospects, voir vos relances et la bibliothèque de scripts, en agissant en votre nom.</p>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex gap-3">
          <Button className="h-12 flex-1" disabled={busy} onClick={() => decide(true)}>Autoriser</Button>
          <Button className="h-12 flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>Refuser</Button>
        </div>
      </div>
    </main>
  );
}
