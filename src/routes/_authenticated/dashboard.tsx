import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CheckCircle2, ContactRound, MessageSquareText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WeeklyGoalsCard } from "@/components/weekly-goals";
import { GettingStartedCard } from "@/components/onboarding";
import { AiAssistantPanel, PendingPaymentBanner, ProspectsPanel, Stat, UsageLine, useCrm } from "@/components/crm";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard — MLM Boost AI" },
    { name: "description", content: "Pilotez vos prospects et créez vos contenus de prospection." },
    { property: "og:title", content: "Dashboard — MLM Boost AI" },
    { property: "og:description", content: "Votre espace de travail pour une prospection organisée." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const crm = useCrm(user);

  return (
    <AppShell user={user} title="Dashboard">
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        <GettingStartedCard />
        <div>
          <span className="eyebrow">Bonjour {crm.displayName.split(" ")[0]}</span>
          <h1 className="mt-2 text-3xl font-extrabold">Votre activité en un coup d’œil.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Gardez le rythme, une conversation à la fois.</p>
        </div>
        <UsageLine crm={crm} />
        <PendingPaymentBanner crm={crm} />
        <WeeklyGoalsCard crm={crm} userId={user.id} />
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={ContactRound} label="Prospects actifs" value={String(crm.prospects.filter(p => p.status !== "client" && p.status !== "non_intéressé").length)} note="En cours de suivi" />
          <Stat icon={MessageSquareText} label="Messages générés" value={String(crm.generationCount)} note="Historique sécurisé" />
          <Stat icon={CheckCircle2} label="Recrues" value={String(crm.clients)} note="Prospects devenus Clients" />
          <Stat icon={BarChart3} label="Taux de conversion" value={`${crm.conversion}%`} note="Prospects devenus clients" />
        </section>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.12fr_.88fr]">
          <ProspectsPanel crm={crm} limit={8} />
          <AiAssistantPanel crm={crm} />
        </div>
      </div>
    </AppShell>
  );
}
