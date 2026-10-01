import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AiAssistantPanel, PendingPaymentBanner, UsageLine, useCrm } from "@/components/crm";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [
    { title: "Assistant IA — MLM Boost AI" },
    { name: "description", content: "Générez messages de prospection, réponses, scripts d'appel et posts." },
    { property: "og:title", content: "Assistant IA — MLM Boost AI" },
    { property: "og:description", content: "Un contenu de prospection adapté à chaque situation." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: AssistantPage,
});

function AssistantPage() {
  const { user } = Route.useRouteContext();
  const crm = useCrm(user);

  return (
    <AppShell user={user} title="Assistant IA">
      <div className="mx-auto max-w-[760px] p-5 lg:p-8">
        <span className="eyebrow">Assistant</span>
        <h1 className="mt-2 text-3xl font-extrabold">Créez votre message.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choisissez un mode, décrivez le contexte, générez.</p>
        <UsageLine crm={crm} />
        <PendingPaymentBanner crm={crm} />
        <div className="mt-6"><AiAssistantPanel crm={crm} /></div>
      </div>
    </AppShell>
  );
}
