import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/abonnement")({
  head: () => ({ meta: [
    { title: "Abonnement — MLM Boost AI" },
    { name: "description", content: "Choisissez le plan qui correspond à votre activité de prospection." },
    { property: "og:title", content: "Abonnement — MLM Boost AI" },
    { property: "og:description", content: "Plans Gratuit, Pro, Expert et Business." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Abonnement,
});

// ← Remplacez ces deux numéros par vos vrais numéros de paiement.
const MOBILE_MONEY_NUMBER = "+225 07 XX XX XX";
const WHATSAPP_NUMBER = "+225 07 XX XX XX";

const plans = [
  { key: "gratuit", name: "Gratuit", price: "0 FCFA", prospects: 10, generations: 5, popular: false },
  { key: "pro", name: "Pro", price: "5 000 FCFA/mois", prospects: 50, generations: 30, popular: true },
  { key: "expert", name: "Expert", price: "12 000 FCFA/mois", prospects: 200, generations: 100, popular: false },
  { key: "business", name: "Business", price: "25 000 FCFA/mois", prospects: -1, generations: -1, popular: false },
];

function limitLabel(value: number) {
  return value < 0 ? "Illimité" : `${value} / mois`;
}

function Abonnement() {
  const { user } = Route.useRouteContext();
  const [selected, setSelected] = useState<{ name: string; price: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function choose(plan: typeof plans[number]) {
    if (plan.key === "gratuit") {
      setSelected(null);
      setConfirmed(true);
      return;
    }
    setSelected({ name: plan.name, price: plan.price });
  }

  return (
    <AppShell user={user} title="Abonnement">
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        <div className="mb-8 max-w-2xl">
          <span className="eyebrow">Tarifs</span>
          <h1 className="mt-2 text-3xl font-extrabold">Choisissez votre plan.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Évoluez en fonction de votre rythme de prospection.</p>
        </div>

        {confirmed && (
          <div className="surface mb-6 rounded-lg p-4 text-sm">
            Votre demande a été prise en compte. Pour les plans payants, suivez les instructions de paiement affichées dans la fenêtre.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <Card key={plan.key} className={`relative flex flex-col border bg-card ${plan.popular ? "border-primary shadow-glow" : "border-border"}`}>
              {plan.popular && (
                <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold text-primary-foreground">
                  POPULAIRE
                </span>
              )}
              <CardHeader className="pb-2">
                <p className="text-xs font-semibold text-muted-foreground">{plan.name}</p>
                <p className="text-2xl font-extrabold">{plan.price}</p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> <span>{plan.prospects < 0 ? "Prospects illimités" : `${plan.prospects} prospects maximum`}</span></li>
                  <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> <span>{plan.generations < 0 ? "Générations IA illimitées" : `${plan.generations} générations IA / mois`}</span></li>
                  <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> <span>Support par WhatsApp</span></li>
                </ul>
              </CardContent>
              <div className="p-6 pt-0">
                <Button onClick={() => choose(plan)} variant={plan.popular ? "default" : "outline"} className="w-full">
                  {plan.key === "gratuit" ? "Continuer gratuitement" : "Choisir ce plan"}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          <CreditCard className="mt-0.5 size-4 text-primary" />
          <p>Les paiements se font manuellement par Mobile Money. Votre plan sera activé sous 24h après réception de la confirmation.</p>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Paiement manuel</DialogTitle>
            <DialogDescription>
              Vous avez choisi le plan <strong>{selected?.name}</strong> ({selected?.price}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p>Envoyez le montant au numéro Mobile Money ci-dessous, puis envoyez la capture de confirmation par WhatsApp.</p>
            <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-2">
              <p className="flex justify-between"><span className="text-muted-foreground">Mobile Money</span> <span className="font-semibold">{MOBILE_MONEY_NUMBER}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">WhatsApp</span> <span className="font-semibold">{WHATSAPP_NUMBER}</span></p>
            </div>
            <p className="text-xs text-muted-foreground">Votre plan sera activé sous 24h après vérification de la transaction.</p>
            <Button className="w-full" onClick={() => setSelected(null)}>J’ai compris</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
