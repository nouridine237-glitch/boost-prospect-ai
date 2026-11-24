import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clapperboard, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getAdStudio } from "@/lib/ad-studio.functions";
import type { AdStudioModule } from "@/lib/ad-studio";

export const Route = createFileRoute("/_authenticated/admin_/ad-studio")({
  head: () => ({ meta: [
    { title: "Admin Ad Studio — MLM Boost AI" },
    { name: "description", content: "Atelier publicitaire réservé à l'administrateur principal de MLM Boost AI." },
    { property: "og:title", content: "Admin Ad Studio — MLM Boost AI" },
    { property: "og:description", content: "Atelier publicitaire interne, accès restreint." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ]}),
  component: AdStudioPage,
});

function AdStudioPage() {
  const { user } = Route.useRouteContext();
  const fetchStudio = useServerFn(getAdStudio);
  const [state, setState] = useState<"loading" | "denied" | "ok">("loading");
  const [modules, setModules] = useState<AdStudioModule[]>([]);

  useEffect(() => {
    fetchStudio().then((r) => { setModules(r.modules); setState("ok"); }).catch(() => setState("denied"));
  }, []);

  return (
    <AppShell user={user} title="Admin Ad Studio">
      <div className="mx-auto max-w-6xl p-5 lg:p-8">
        {state === "loading" && <p className="text-sm text-muted-foreground">Vérification des droits…</p>}
        {state === "denied" && (
          <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Lock className="size-4" />Accès réservé à l'administrateur principal.
          </CardContent></Card>
        )}
        {state === "ok" && (
          <>
            <div className="mb-8 flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><Clapperboard className="size-6" /></span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">MLM Boost AI — Admin Ad Studio</h1>
                <p className="mt-1 text-sm text-muted-foreground">Atelier publicitaire interne. Aucun module n'est encore actif.</p>
              </div>
            </div>
            <Card className="mb-6 border-dashed"><CardContent className="p-6 text-sm text-muted-foreground">
              Aucune création, aucune campagne et aucune dépense pour l'instant. Les modules ci-dessous seront ouverts lors des prochains lots.
            </CardContent></Card>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((m) => (
                <Card key={m.key} aria-disabled="true" className="opacity-70">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold">{m.title}</h2>
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">À venir</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>
                    <button type="button" disabled className="mt-4 h-11 w-full cursor-not-allowed rounded-md border border-border text-sm text-muted-foreground">Indisponible</button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
