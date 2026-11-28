import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clapperboard, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getAdStudio } from "@/lib/ad-studio.functions";
import type { AdStudioModule } from "@/lib/ad-studio";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudioMfaGate } from "@/components/ad-studio/mfa-gate";
import { UrlAnalyzerPanel } from "@/components/ad-studio/url-analyzer-panel";

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
  const [state, setState] = useState<"loading" | "denied" | "mfa" | "ok">("loading");
  const [modules, setModules] = useState<AdStudioModule[]>([]);

  function refreshAccess() {
    setState("loading");
    fetchStudio().then((r) => { setModules(r.modules); setState(r.mfaRequired ? "mfa" : "ok"); }).catch(() => setState("denied"));
  }
  useEffect(() => { refreshAccess(); }, []);

  return (
    <AppShell user={user} title="Admin Ad Studio">
      <div className="mx-auto max-w-6xl p-5 lg:p-8">
        {state === "loading" && <p className="text-sm text-muted-foreground">Vérification des droits…</p>}
        {state === "denied" && (
          <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Lock className="size-4" />Accès réservé à l'administrateur principal.
          </CardContent></Card>
        )}
        {state === "mfa" && <><h1 className="text-2xl font-bold">MLM Boost AI — Admin Ad Studio</h1><StudioMfaGate onVerified={refreshAccess} /></>}
        {state === "ok" && (
          <>
            <div className="mb-8 flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><Clapperboard className="size-6" /></span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">MLM Boost AI — Admin Ad Studio</h1>
                <p className="mt-1 text-sm text-muted-foreground">Stratégie publicitaire · atelier privé</p>
              </div>
            </div>
            <Tabs defaultValue="analyzer" className="mb-10">
              <TabsList className="mb-6 h-auto max-w-full flex-wrap justify-start gap-1"><TabsTrigger value="analyzer" className="h-10">URL Analyzer</TabsTrigger><TabsTrigger value="director" className="h-10">AI Creative Director</TabsTrigger></TabsList>
              <TabsContent value="analyzer"><UrlAnalyzerPanel /></TabsContent>
              <TabsContent value="director"><section className="border-t border-border py-6"><h2 className="text-xl font-semibold">AI Creative Director</h2><p className="mt-3 max-w-xl text-sm text-muted-foreground">Génération textuelle non activée. Le plafond de crédits par campagne et le contrôle des dépenses restent à valider.</p><Button disabled className="mt-5">Génération indisponible</Button></section></TabsContent>
            </Tabs>
            <h2 className="mb-4 text-lg font-semibold">Prochains modules</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((m) => (
                <Card key={m.key} aria-disabled="true" className="opacity-70">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold">{m.title}</h2>
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">À venir</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>
                    <Button type="button" variant="outline" disabled className="mt-4 h-11 w-full">Indisponible</Button>
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
