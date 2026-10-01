import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CheckCircle2, ContactRound, MessageSquareText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Stat, UsageLine, statusLabels, statuses, slugStatus, useCrm } from "@/components/crm";

export const Route = createFileRoute("/_authenticated/statistiques")({
  head: () => ({ meta: [
    { title: "Statistiques — MLM Boost AI" },
    { name: "description", content: "Suivez vos performances de prospection : pipeline, conversions, contenus générés." },
    { property: "og:title", content: "Statistiques — MLM Boost AI" },
    { property: "og:description", content: "Vos indicateurs de prospection en un coup d'œil." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: StatsPage,
});

function StatsPage() {
  const { user } = Route.useRouteContext();
  const crm = useCrm(user);
  const total = crm.prospects.length;

  return (
    <AppShell user={user} title="Statistiques">
      <div className="mx-auto max-w-[1100px] p-5 lg:p-8">
        <span className="eyebrow">Performance</span>
        <h1 className="mt-2 text-3xl font-extrabold">Vos statistiques.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Une lecture simple de votre activité de prospection.</p>
        <UsageLine crm={crm} />
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={ContactRound} label="Prospects au total" value={String(total)} note="Dans votre pipeline" />
          <Stat icon={MessageSquareText} label="Contenus générés" value={String(crm.generationCount)} note={`${crm.monthlyGenerations} ce mois-ci`} />
          <Stat icon={CheckCircle2} label="Clients" value={String(crm.clients)} note="Prospects convertis" />
          <Stat icon={BarChart3} label="Taux de conversion" value={`${crm.conversion}%`} note="Clients / prospects" />
        </section>
        <section className="surface mt-6 rounded-lg p-5">
          <h2 className="font-bold">Répartition par statut</h2>
          <div className="mt-5 grid gap-4">
            {statuses.map(s => {
              const count = crm.prospects.filter(p => p.status === s).length;
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={s}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`status status-${slugStatus(s)}`}>{statusLabels[s]}</span>
                    <span className="text-muted-foreground">{count} · {pct}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
