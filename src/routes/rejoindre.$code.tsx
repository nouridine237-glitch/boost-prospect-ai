import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/rejoindre/$code")({
  head: () => ({ meta: [
    { title: "Rejoindre une équipe — MLM Boost AI" },
    { name: "description", content: "Accepte ou refuse l'invitation de ton leader à rejoindre son équipe sur MLM Boost AI." },
    { property: "og:title", content: "Invitation à rejoindre une équipe — MLM Boost AI" },
    { property: "og:description", content: "Ton leader t'invite à suivre ta progression dans l'Académie MLM Boost AI." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: JoinPage,
});

type Info = { leader_name: string; status: string; expired: boolean; is_self: boolean };
const MSG: Record<string, string> = {
  actif: "Bienvenue dans l'équipe !", refuse: "Invitation refusée.", introuvable: "Invitation introuvable.",
  deja_utilisee: "Cette invitation a déjà été utilisée.", expiree: "Cette invitation a expiré.",
  soi_meme: "Tu ne peux pas accepter ta propre invitation.", deja_dans_equipe: "Tu fais déjà partie d'une équipe. Quitte-la d'abord depuis l'Académie.",
};

function JoinPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "signedOut" | "ready">("loading");
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setState("signedOut"); return; }
      const { data: rows } = await supabase.rpc("team_invite_info", { _code: code });
      setInfo((rows?.[0] as Info | undefined) ?? null);
      setState("ready");
    });
  }, [code]);

  const respond = async (accept: boolean) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("team_respond_invite", { _code: code, _accept: accept });
    setBusy(false);
    if (error) return toast.error("Action impossible, réessaie.");
    const r = String(data);
    (r === "actif" || r === "refuse" ? toast.success : toast.error)(MSG[r] ?? "Action impossible.");
    navigate({ to: r === "actif" ? "/academie" : "/dashboard" });
  };

  const usable = info && info.status === "invite" && !info.expired && !info.is_self;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-5 py-4"><div className="mx-auto max-w-[620px]"><Brand /></div></header>
      <main className="mx-auto max-w-[620px] p-5 lg:p-8">
        <h1 className="text-2xl font-extrabold">Invitation à rejoindre une équipe</h1>
        {state === "loading" && <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>}
        {state === "signedOut" && (
          <div className="mt-4 space-y-3 text-sm">
            <p>Connecte-toi ou crée ton compte, puis l'invitation s'ouvrira de nouveau.</p>
            <Link to="/auth" search={{ mode: "signup", next: `/rejoindre/${code}` }} className="inline-block rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground">Se connecter / créer un compte</Link>
          </div>
        )}
        {state === "ready" && !info && <p className="mt-4 text-sm">{MSG.introuvable}</p>}
        {state === "ready" && info && !usable && <p className="mt-4 text-sm">{info.is_self ? MSG.soi_meme : info.expired ? MSG.expiree : MSG.deja_utilisee}</p>}
        {state === "ready" && usable && (
          <section className="surface mt-5 rounded-lg p-5 text-sm">
            <p><b>{info.leader_name}</b> t'invite à rejoindre son équipe.</p>
            <p className="mt-3 font-semibold">Si tu acceptes, ton leader verra uniquement :</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              <li>ton nom affiché ;</li>
              <li>le nombre de niveaux de l'Académie que tu as validés et la date du dernier.</li>
            </ul>
            <p className="mt-2 text-muted-foreground">Il ne verra jamais tes prospects, tes messages ni tes notes. Tu peux quitter l'équipe à tout moment depuis l'Académie.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => respond(true)} className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">J'accepte</button>
              <button disabled={busy} onClick={() => respond(false)} className="rounded-lg border border-border px-5 py-2.5 hover:border-primary/60 disabled:opacity-50">Refuser</button>
            </div>
          </section>
        )}
        <p className="mt-10 text-xs text-muted-foreground">Aucun revenu garanti — outil d’aide à la prospection.</p>
      </main>
    </div>
  );
}
