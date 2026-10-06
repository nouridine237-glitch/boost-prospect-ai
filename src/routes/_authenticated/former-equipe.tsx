import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/former-equipe")({
  head: () => ({ meta: [
    { title: "Former mon équipe — MLM Boost AI" },
    { name: "description", content: "Partage la formation en 6 niveaux avec quiz et certificat à tes filleuls." },
    { property: "og:title", content: "Former mon équipe — MLM Boost AI" },
    { property: "og:description", content: "Un lien à envoyer à tes filleuls : 6 niveaux, quiz et certificat." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: FormerEquipePage,
});

function FormerEquipePage() {
  const { user } = Route.useRouteContext();
  const [sponsor, setSponsor] = useState(String(user.user_metadata?.["full_name"] ?? ""));
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/formation${sponsor.trim() ? `?parrain=${encodeURIComponent(sponsor.trim())}` : ""}`;
  const msg = `Salut ! Voici ta formation de démarrage en 6 niveaux, avec quiz et certificat à la fin : ${link}`;

  return (
    <AppShell user={user} title="Former mon équipe">
      <div className="mx-auto max-w-[780px] p-5 lg:p-8">
        <span className="eyebrow">Équipe</span>
        <h1 className="mt-2 text-3xl font-extrabold">Former mon équipe.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Envoie ce lien à tes filleuls : ils suivent les 6 niveaux de l'Académie sans créer de compte, valident un quiz par niveau (80 %) et téléchargent leur certificat.</p>
        <section className="surface mt-6 rounded-lg p-5">
          <label className="text-sm font-semibold">Ton nom (affiché comme parrain)</label>
          <input value={sponsor} onChange={(e) => setSponsor(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <label className="mt-4 block text-sm font-semibold">Lien de la formation</label>
          <div className="mt-1 break-all rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary">{link}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90">
              <Users className="size-4" /> Envoyer via WhatsApp
            </a>
            <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Lien copié"); }}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:border-primary/60">
              <Copy className="size-4" /> Copier le lien
            </button>
            <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm hover:border-primary/60">
              <ExternalLink className="size-4" /> Aperçu
            </a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
