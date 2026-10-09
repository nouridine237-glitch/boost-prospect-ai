import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PendingPaymentBanner, ProspectsPanel, UsageLine, useCrm } from "@/components/crm";
import { FollowupQueue, ProspectSheet } from "@/components/prospect-tools";
import { TeamPanel, TeamTabs } from "@/components/team";
import { PipelineBoard, ViewToggle } from "@/components/pipeline";

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
  const [tab, setTab] = useState<"prospects" | "team">("prospects");
  const crm = useCrm(user, {
    onJoinTeam: p => toast.success(`🎉 ${p.name} a rejoint ton équipe !`, { duration: 6000, action: { label: "Voir l'équipe", onClick: () => setTab("team") } }),
  });
  const [view, setView] = useState<"liste" | "pipeline">("liste");
  const [openId, setOpenId] = useState<string | null>(null);
  const [autoSuggest, setAutoSuggest] = useState(false);
  const openSheet = (p: { id: string }, s?: boolean) => { setAutoSuggest(!!s); setOpenId(p.id); };
  const opened = crm.prospects.find(p => p.id === openId) ?? null;
  const teamCount = crm.prospects.filter(p => p.status === "client").length;

  return (
    <AppShell user={user} title="Prospects">
      <div className="mx-auto max-w-[1100px] p-5 lg:p-8">
        <div className="mb-4 flex justify-end"><ViewToggle view={view} onChange={v => { setView(v); if (v === "pipeline") setTab("prospects"); }} /></div>
        <span className="eyebrow">CRM</span>
        <h1 className="mt-2 text-3xl font-extrabold">{tab === "team" ? "Tes recrues." : "Vos prospects."}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{tab === "team" ? "Les prospects devenus Clients, à accompagner." : "Statut, notes et prochaine relance pour chaque contact."}</p>
        <UsageLine crm={crm} />
        <PendingPaymentBanner crm={crm} />
        <div className="mt-6"><FollowupQueue crm={crm} /></div>
        <div><TeamTabs tab={tab} onChange={setTab} count={teamCount} /></div>
        <div className="mt-6">{view === "pipeline" && tab === "prospects" ? <PipelineBoard crm={crm} onOpen={openSheet} /> : tab === "team" ? <TeamPanel crm={crm} /> : <ProspectsPanel crm={crm} excludeClients onOpen={openSheet} />}</div>
        <ProspectSheet prospect={opened} autoSuggest={autoSuggest} crm={crm} onClose={() => setOpenId(null)} />
      </div>
    </AppShell>
  );
}
