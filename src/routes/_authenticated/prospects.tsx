import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PendingPaymentBanner, ProspectsPanel, UsageLine, useCrm } from "@/components/crm";

export const Route = createFileRoute("/_authenticated/prospects")({
  head: () => ({ meta: [
    { title: "Prospects — MLM Boost AI" },
    { name: "description", content: "Suivez tous vos prospects, leurs statuts, notes et relances." },
    { property: "og:title", content: "Prospects — MLM Boost AI" },
    { property: "og:description", content: "Votre CRM de prospection, organisé et à jour." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: ProspectsPage,
});

function ProspectsPage() {
  const { user } = Route.useRouteContext();
  const crm = useCrm(user);

  return (
    <AppShell user={user} title="Prospects">
      <div className="mx-auto max-w-[1100px] p-5 lg:p-8">
        <span className="eyebrow">CRM</span>
        <h1 className="mt-2 text-3xl font-extrabold">Vos prospects.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Statut, notes et prochaine relance pour chaque contact.</p>
        <UsageLine crm={crm} />
        <PendingPaymentBanner crm={crm} />
        <div className="mt-6"><ProspectsPanel crm={crm} /></div>
      </div>
    </AppShell>
  );
}
