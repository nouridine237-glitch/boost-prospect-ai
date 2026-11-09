import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, Inbox, Layers, Play, Share2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AcademyTabs, EmptyState, ErrorLine } from "@/components/videotheque/academy-tabs";
import { StatusBadge } from "@/components/videotheque/ui-bits";
import { ShareSheet } from "@/components/videotheque/share-sheet";
import { Button } from "@/components/ui/button";
import { listReceived, respondGrant } from "@/lib/videotheque.functions";

export const Route = createFileRoute("/_authenticated/academie_/recues")({
  head: () => ({ meta: [
    { title: "Formations reçues — Académie MLM Boost AI" },
    { name: "description", content: "Les formations vidéo partagées avec toi par ton équipe." },
    { property: "og:title", content: "Formations reçues — MLM Boost AI" },
    { property: "og:description", content: "Regarde les formations de ton leader, à ton rythme." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: ReceivedPage,
});

function ReceivedPage() {
  const { user } = Route.useRouteContext();
  const fetchList = useServerFn(listReceived);
  const respond = useServerFn(respondGrant);
  const q = useQuery({ queryKey: ["videotheque", "received"], queryFn: () => fetchList() });
  const qc = useQueryClient();
  const [share, setShare] = useState<string | null>(null);
  const pending = (q.data ?? []).filter((g) => g.status === "en_attente");
  const active = (q.data ?? []).filter((g) => g.status === "actif");
  const answer = async (id: string, accept: boolean) => {
    try { await respond({ data: { id, accept } }); toast.success(accept ? "Formation ajoutée ✓" : "Invitation refusée"); qc.invalidateQueries({ queryKey: ["videotheque"] }); }
    catch { toast.error("Réponse non enregistrée."); }
  };

  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[1000px] p-5 lg:p-8">
        <span className="eyebrow">Académie</span>
        <h1 className="mt-2 text-3xl font-extrabold">Formations reçues</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ce qu'on a partagé avec toi. Une fois acceptée, une formation reste à toi, même si tu changes d'équipe.</p>
        <AcademyTabs />
        {q.isLoading ? <div className="mt-6 space-y-3">{[0, 1].map((i) => <div key={i} className="surface h-24 animate-pulse rounded-2xl" />)}</div>
          : q.isError ? <ErrorLine text="Formations indisponibles." onRetry={() => q.refetch()} /> : (
          <>
            {pending.map((g) => (
              <div key={g.grantId} role="region" aria-label="Invitation" className="fade-in mt-5 rounded-2xl border border-primary/40 bg-primary/8 p-4">
                <p className="text-sm"><span className="font-semibold">{g.via ?? g.author}</span> te partage <span className="font-semibold">« {g.title} »</span>{g.via ? <span className="text-muted-foreground"> (formation de {g.author})</span> : null}</p>
                <p className="mt-1 text-xs text-muted-foreground">{g.lessons} leçon{g.lessons > 1 ? "s" : ""} · {g.minutes} min</p>
                <div className="mt-3 flex gap-2">
                  <Button className="min-h-11 flex-1 sm:flex-none" onClick={() => answer(g.grantId, true)}>Accepter</Button>
                  <Button variant="outline" className="min-h-11" onClick={() => answer(g.grantId, false)}>Refuser</Button>
                </div>
              </div>
            ))}
            {!active.length && !pending.length ? (
              <EmptyState icon={Inbox} title="Aucune formation reçue pour l'instant" text="Quand ton leader partagera une formation avec toi, elle apparaîtra ici." />
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {active.map((g) => (
                  <li key={g.grantId} className="surface flex flex-col rounded-2xl p-4 transition-colors duration-200 hover:border-primary/40">
                    <Link to="/academie/lecture/$courseId" params={{ courseId: g.courseId }} className="flex-1">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground"><Layers className="size-3.5 text-primary" />De {g.author}{g.newerVersion && <span className="rounded-full border border-border/60 px-2 py-0.5">Version {g.version} · mise à jour disponible</span>}</span>
                      <h2 className="mt-2 font-bold">{g.title}</h2>
                      <div className="mt-2"><StatusBadge tone="success" icon={ShieldCheck}>Accès durable</StatusBadge></div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" />{g.lessons} leçon{g.lessons > 1 ? "s" : ""} · {g.minutes} min</p>
                      <div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{g.progress.done}/{g.progress.total} terminées</span><span className="font-semibold text-foreground">{g.progress.percent} %</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${g.progress.percent}%` }} /></div>
                    </Link>
                    <Button asChild variant={g.progress.percent > 0 && g.progress.percent < 100 ? "default" : "outline"} className="mt-4 min-h-11 w-full">
                      <Link to="/academie/lecture/$courseId" params={{ courseId: g.courseId }}><Play className="size-4" />{g.progress.percent === 0 ? "Commencer" : g.progress.percent >= 100 ? "Revoir" : "Reprendre"}</Link>
                    </Button>
                    {g.canReshare && <button type="button" onClick={() => setShare(g.courseId)} className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><Share2 className="size-4" />Repartager</button>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {share && <ShareSheet courseId={share} open={!!share} onOpenChange={(o) => !o && setShare(null)} />}
      </div>
    </AppShell>
  );
}
