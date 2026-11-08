import { PlanBanner } from "@/components/plan-gate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, BellRing, CheckCircle2, ContactRound, MessagesSquare, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isFollowupDue, localDay } from "@/lib/coach";
import { AppShell } from "@/components/app-shell";
import { WeeklyGoalsCard } from "@/components/weekly-goals";
import { GettingStartedCard } from "@/components/onboarding";
import { AiAssistantPanel, PendingPaymentBanner, ProspectsPanel, Stat, UsageLine, useCrm } from "@/components/crm";
import { CaptureLeadsNotice } from "@/components/capture-settings";
import { CoachCard } from "@/components/coach-card";
import { CoachWeekCard } from "@/components/coach-week";
import { CommandCenter } from "@/components/command-center";

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

  const active = crm.prospects.filter(p => p.status !== "client" && p.status !== "non_intéressé");
  const today = localDay();
  const due = crm.prospects.filter(p => isFollowupDue(p, today)).length;
  const month = today.slice(0, 7);
  const monthClients = crm.prospects.filter(p => p.status === "client" && (p.joined_team_at ?? "").slice(0, 7) === month).length;
  const first = crm.displayName.split(" ")[0];
  const empty = crm.loaded && crm.prospects.length === 0;

  return (
    <AppShell user={user} title="Dashboard">
      <div className="mx-auto max-w-[1500px] p-4 sm:p-5 lg:p-8">
        <PlanBanner info={crm.planInfo} />
        <CaptureLeadsNotice userId={user.id} />
        <GettingStartedCard />
        <section className="card-hero fade-in p-5 sm:p-7" aria-labelledby="hello">
          <p className="text-sm text-muted-foreground">Bonjour {first} 👋</p>
          <h1 id="hello" className="mt-1 text-2xl font-extrabold sm:text-3xl">{!crm.loaded ? "Préparation de ton brief…" : empty ? "Commence par ton premier prospect." : due ? `${due} relance${due > 1 ? "s" : ""} t'attend${due > 1 ? "ent" : ""} aujourd'hui.` : "Tout est à jour. Avance une conversation."}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Une conversation à la fois, à ton rythme.</p>
          <Button asChild size="lg" className="mt-5 h-12 w-full rounded-xl text-base shadow-[var(--shadow-glow)] sm:w-auto">
            <Link to="/prospects">{empty ? <><UserPlus /> Ajouter un prospect</> : due ? <><BellRing /> Relancer mes prospects</> : <><ContactRound /> Voir mes prospects</>}<ArrowRight /></Link>
          </Button>
          <UsageLine crm={crm} />
        </section>
        <PendingPaymentBanner crm={crm} />
        <section className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Chiffres clés">
          {!crm.loaded ? Array.from({ length: 4 }, (_, i) => <span key={i} className="skeleton h-[104px]" />) : <>
            <Stat icon={ContactRound} label="Prospects actifs" value={String(active.length)} />
            <Stat icon={BellRing} label="À relancer" value={String(due)} />
            <Stat icon={CheckCircle2} label="Clients du mois" value={String(monthClients)} />
            <Stat icon={BarChart3} label="Taux de conversion" value={`${crm.conversion}%`} />
          </>}
        </section>
        <CommandCenter crm={crm} userId={user.id} />
        <CoachCard crm={crm} userId={user.id} />
        <CoachWeekCard crm={crm} userId={user.id} />
        <WeeklyGoalsCard crm={crm} userId={user.id} />
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.12fr_.88fr]">
          <ProspectsPanel crm={crm} limit={8} />
          <AiAssistantPanel crm={crm} />
        </div>
        <section className="mt-6" aria-labelledby="shortcuts">
          <h2 id="shortcuts" className="text-sm font-bold text-muted-foreground">Raccourcis</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {([["/prospects", UserPlus, "Ajouter un prospect"], ["/assistant", Sparkles, "Assistant IA"], ["/simulateur", MessagesSquare, "Simulateur"]] as const).map(([to, Icon, label]) => (
              <Link key={to} to={to} className="card-premium card-hover flex min-h-24 flex-col items-center justify-center gap-2 p-3 text-center text-xs font-semibold sm:text-sm">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary"><Icon className="size-5" /></span>{label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
