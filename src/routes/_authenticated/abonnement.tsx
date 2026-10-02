import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, CreditCard, Loader2, Sparkles, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { createPaymentRequest, getMyPaymentStatus, PAID_PLANS, type PaidPlanKey } from "@/lib/payments.functions";

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

// ← Remplacez ces numéros par vos vrais numéros de paiement.
const ORANGE_MONEY_NUMBER = "+237 6XX XX XX XX";
const MTN_MOMO_NUMBER = "+237 6XX XX XX XX";

const plans = [
  { key: "gratuit", name: "Gratuit", fcfa: 0, usd: 0, popular: false, items: ["10 prospects maximum", "5 générations IA / mois", "1 utilisateur"] },
  { key: "pro", name: "Pro", fcfa: PAID_PLANS.pro.fcfa, usd: PAID_PLANS.pro.usd, popular: true, items: ["Prospects illimités", "100 générations IA / mois", "Historique complet", "Relances automatiques"] },
  { key: "expert", name: "Expert", fcfa: PAID_PLANS.expert.fcfa, usd: PAID_PLANS.expert.usd, popular: false, items: ["Tout le plan Pro", "Générations IA illimitées", "Académie complète", "Rapports hebdomadaires", "Export CSV"] },
  { key: "business", name: "Business", fcfa: PAID_PLANS.business.fcfa, usd: PAID_PLANS.business.usd, popular: false, items: ["Tout le plan Expert", "Gestion d’équipe", "Templates par entreprise", "WhatsApp Business", "Support prioritaire"] },
] as const;

function priceLabel(fcfa: number, usd: number) {
  if (fcfa === 0) return "0 FCFA";
  return `${fcfa.toLocaleString("fr-FR")} FCFA`;
}

function Abonnement() {
  const { user } = Route.useRouteContext();
  const createFn = useServerFn(createPaymentRequest);
  const statusFn = useServerFn(getMyPaymentStatus);

  const [selected, setSelected] = useState<{ key: PaidPlanKey; name: string } | null>(null);
  const [devise, setDevise] = useState<"FCFA" | "USD">("FCFA");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [pending, setPending] = useState<any>(null);

  useEffect(() => {
    statusFn({}).then(({ request }) => setPending(request?.statut === "en_attente" ? request : null)).catch(() => {});
  }, []);

  function choose(planKey: string, name: string) {
    setError("");
    if (planKey === "gratuit") {
      setBanner("Vous utilisez déjà le plan Gratuit. Aucun paiement n’est nécessaire.");
      return;
    }
    setReference("");
    setFile(null);
    setDevise("FCFA");
    setSelected({ key: planKey as PaidPlanKey, name });
  }

  async function submit() {
    if (!selected) return;
    if (reference.trim().length < 3) {
      setError("Indiquez la référence (ID) de votre transaction Mobile Money.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      let capturePath: string | undefined;
      if (file) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: false });
        if (upErr) throw new Error("upload");
        capturePath = path;
      }
      const res = await createFn({ data: { plan: selected.key, devise, reference: reference.trim(), capturePath } as any });
      if (!res.ok) {
        setError("Une demande est déjà en cours de vérification. Patientez jusqu’à sa validation.");
        return;
      }
      setSelected(null);
      setPending({ plan_demande: selected.key, statut: "en_attente" });
      setBanner("Votre preuve de paiement a bien été envoyée. Votre plan sera activé après vérification (sous 24h).");
    } catch {
      setError("L’envoi a échoué. Vérifiez votre connexion et réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  const amount = selected
    ? devise === "USD"
      ? `${PAID_PLANS[selected.key].usd} USD`
      : `${PAID_PLANS[selected.key].fcfa.toLocaleString("fr-FR")} FCFA`
    : "";

  return (
    <AppShell user={user} title="Abonnement">
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        <div className="mb-8 max-w-2xl">
          <span className="eyebrow">Tarifs</span>
          <h1 className="mt-2 text-3xl font-extrabold">Choisissez votre plan.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Évoluez en fonction de votre rythme de prospection.</p>
        </div>

        {pending && (
          <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <strong>Paiement en cours de vérification.</strong> Votre demande pour le plan{" "}
            <span className="font-semibold capitalize">{pending.plan_demande}</span> est en attente de validation par l’administrateur.
          </div>
        )}

        {banner && <div className="surface mb-6 rounded-lg p-4 text-sm">{banner}</div>}

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
                <p className="text-2xl font-extrabold">{priceLabel(plan.fcfa, plan.usd)}</p>
                <p className="text-xs text-muted-foreground">{plan.usd === 0 ? "≈ 0 USD" : `≈ ${plan.usd} USD / mois`}</p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> <span>{item}</span></li>
                  ))}
                </ul>
              </CardContent>
              <div className="p-6 pt-0">
                <Button onClick={() => choose(plan.key, plan.name)} variant={plan.popular ? "default" : "outline"} className="w-full">
                  {plan.key === "gratuit" ? "Continuer gratuitement" : "Choisir ce plan"}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          <CreditCard className="mt-0.5 size-4 text-primary" />
          <p>Les paiements se font par Mobile Money (Orange Money ou MTN MoMo). Votre plan est activé après vérification de votre preuve de paiement, sous 24h.</p>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Paiement Mobile Money</DialogTitle>
            <DialogDescription>
              Plan <strong>{selected?.name}</strong> — montant à envoyer : <strong>{amount}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="flex gap-2">
              {(["FCFA", "USD"] as const).map((d) => (
                <Button key={d} type="button" size="sm" variant={devise === d ? "default" : "outline"} onClick={() => setDevise(d)}>
                  {d}
                </Button>
              ))}
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-4">
              <p className="flex justify-between"><span className="text-muted-foreground">Orange Money</span> <span className="font-semibold">{ORANGE_MONEY_NUMBER}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">MTN MoMo</span> <span className="font-semibold">{MTN_MOMO_NUMBER}</span></p>
              <p className="flex justify-between border-t border-border pt-2"><span className="text-muted-foreground">Montant exact</span> <span className="font-extrabold text-primary">{amount}</span></p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Capture d’écran de la transaction</label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-secondary/40 px-3 py-3 text-sm text-muted-foreground hover:bg-accent">
                <Upload className="size-4" />
                <span className="truncate">{file ? file.name : "Choisir une image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="ref">ID / référence de la transaction</label>
              <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. MP2609.1432.B45782" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" onClick={submit} disabled={submitting}>
              {submitting ? <><Loader2 className="size-4 animate-spin" /> Envoi…</> : "J’ai effectué le paiement"}
            </Button>
            <p className="text-xs text-muted-foreground">Votre plan sera activé sous 24h après vérification de la transaction.</p>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
