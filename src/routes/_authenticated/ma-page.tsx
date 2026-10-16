import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Eye, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/crm";
import { useCapturePage } from "@/components/capture-settings";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ma-page")({
  head: () => ({ meta: [
    { title: "Ma page — MLM Boost AI" },
    { name: "description", content: "Ta page publique de capture : lien, partage et résultats." },
    { property: "og:title", content: "Ma page — MLM Boost AI" },
    { property: "og:description", content: "Partage ta page de capture et suis les prospects reçus." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: MaPage,
});

function MaPage() {
  const { user } = Route.useRouteContext();
  const { page, loaded } = useCapturePage(user.id);
  const [leads, setLeads] = useState(0);
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    supabase.from("prospects").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("source", "Page de capture").then(({ count }) => setLeads(count ?? 0));
  }, [user.id]);
  const url = page ? `${origin}/p/${page.slug}` : "";

  return (
    <AppShell user={user} title="Ma page">
      <div className="mx-auto max-w-[760px] p-5 lg:p-8">
        <span className="eyebrow">Capture</span>
        <h1 className="mt-2 text-3xl font-extrabold">Ma page.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Partage ta page : chaque contact reçu arrive directement dans tes prospects.</p>
        {loaded && !page && (
          <section className="surface mt-6 rounded-lg p-5">
            <p className="text-sm">Tu n'as pas encore créé ta page.</p>
            <Link to="/parametres" className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Créer ma page dans Paramètres</Link>
          </section>
        )}
        {page && (<>
          <section className="surface mt-6 rounded-lg p-5">
            <h2 className="font-bold">Mon lien</h2>
            <p className="mt-2 break-all rounded-md bg-background px-3 py-2 text-sm">{url}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(url); toast.success("Lien copié"); }}><Copy /> Copier</Button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Découvre ma page et laisse-moi tes coordonnées : ${url}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md bg-[#25D366] px-4 text-sm font-medium text-[#0b2e1a]">Partager sur WhatsApp</a>
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center px-2 text-sm text-primary">Voir ma page</a>
            </div>
          </section>
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <Stat icon={Eye} label="Visites" value={String(page.visits)} note="Depuis la création" />
            <Stat icon={Users} label="Prospects reçus" value={String(leads)} note="Via le formulaire" />
          </section>
          <Link to="/parametres" className="mt-6 inline-block text-sm text-primary">Modifier ma page</Link>
        </>)}
      </div>
    </AppShell>
  );
}
