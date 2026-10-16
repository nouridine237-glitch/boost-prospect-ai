import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, Gift, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { getMyReferral } from "@/lib/referral.functions";

export const Route = createFileRoute("/_authenticated/parrainage")({
  head: () => ({ meta: [
    { title: "Parrainage — MLM Boost AI" },
    { name: "description", content: "Invite tes contacts sur MLM Boost AI et gagne des jours Pro ou des jours d'abonnement." },
    { property: "og:title", content: "Parrainage — MLM Boost AI" },
    { property: "og:description", content: "Ton lien de parrainage, tes filleuls et tes récompenses." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: ParrainagePage,
});

const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

function ParrainagePage() {
  const { user } = Route.useRouteContext();
  const fetchRef = useServerFn(getMyReferral);
  const { data, isLoading, error } = useQuery({ queryKey: ["referral", user.id], queryFn: () => fetchRef() });
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = data ? `${origin}/?ref=${data.code}` : "";
  const msg = `Salut ! J'utilise MLM Boost AI pour organiser ma prospection (CRM + assistant IA). C'est gratuit pour démarrer : ${link}`;
  const capped = data && data.stats.rewardsMonth >= data.stats.rewardsCap;

  return (
    <AppShell user={user} title="Parrainage">
      <div className="mx-auto max-w-[780px] p-5 lg:p-8">
        <span className="eyebrow">Parrainage</span>
        <h1 className="mt-2 text-3xl font-extrabold">Invite, et gagne du temps Pro.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Un filleul est validé quand il ajoute son premier prospect. Plan Gratuit : 15 jours de fonctions Pro (sans IA) + 10 générations IA bonus. Abonné : +7 jours sur ton échéance. Si ton filleul passe sur un plan payant : +1 mois.</p>

        {isLoading ? <p className="mt-6 text-sm text-muted-foreground">Chargement…</p> : error || !data ? <p className="mt-6 text-sm text-destructive">Impossible de charger ton parrainage.</p> : <>
          <section className="surface mt-6 rounded-lg p-5">
            <label className="text-sm font-semibold">Mon lien de parrainage</label>
            <div className="mt-1 break-all rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary">{link}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Lien copié"); }} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:border-primary/60">
                <Copy className="size-4" /> Copier
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90">
                <MessageCircle className="size-4" /> Partager sur WhatsApp
              </a>
            </div>
            {data.trialUntil && <p className="mt-4 text-sm text-success"><Gift className="mr-1 inline size-4" /> Fonctions Pro débloquées jusqu'au {fmt(data.trialUntil)}.</p>}
          </section>

          <section className="mt-4 grid grid-cols-3 gap-3">
            {[["Inscrits", String(data.stats.inscrits)], ["Validés", String(data.stats.valides)], ["Récompenses ce mois", `${data.stats.rewardsMonth}/${data.stats.rewardsCap}`]].map(([l, v]) => (
              <div key={l} className="surface rounded-lg p-4"><p className="text-2xl font-extrabold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
            ))}
          </section>
          <p className="mt-2 text-xs text-muted-foreground">IA bonus reçues ce mois : {data.stats.bonusMonth}/{data.stats.bonusCap}.</p>
          {capped && <p className="mt-3 rounded-lg border border-border p-3 text-sm text-muted-foreground">Tu as atteint le plafond de {data.stats.rewardsCap} filleuls récompensés ce mois. Les nouveaux parrainages restent comptés, mais sans récompense jusqu'au mois prochain.</p>}

          <section className="surface mt-4 rounded-lg p-5">
            <h2 className="font-bold">Mes filleuls</h2>
            {!data.referrals.length ? <p className="mt-2 text-sm text-muted-foreground">Aucun filleul pour l'instant. Partage ton lien pour commencer.</p> : (
              <ul className="mt-3 divide-y divide-border">
                {data.referrals.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div><p className="font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">Inscrit le {fmt(r.createdAt)}</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === "valide" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {r.status === "valide" ? (r.rewarded ? "Validé · récompensé" : r.capped ? "Validé · plafond atteint" : "Validé") : "Inscrit"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>}
      </div>
    </AppShell>
  );
}
