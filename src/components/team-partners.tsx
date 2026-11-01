import { useCallback, useEffect, useState } from "react";
import { Copy, LogOut, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lessons } from "@/lib/academy-content";

type Member = { link_id: string; member_name: string; accepted_at: string | null; levels_passed: number; last_passed_at: string | null };
type Invite = { id: string; invite_code: string; expires_at: string };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

/** Vue leader : partenaires-comptes ayant accepté, avec seulement leur progression Académie. */
export function TeamPartners({ userId }: { userId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [origin, setOrigin] = useState("");
  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.rpc("team_member_progress"),
      supabase.from("team_links").select("id, invite_code, expires_at").eq("leader_id", userId).eq("status", "invite").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    ]);
    setMembers((m.data ?? []) as Member[]);
    setInvites((i.data ?? []) as Invite[]);
  }, [userId]);
  useEffect(() => { setOrigin(window.location.origin); load(); }, [load]);

  const linkFor = (c: string) => `${origin}/rejoindre/${c}`;
  const create = async () => {
    const { data, error } = await supabase.rpc("team_create_invite");
    if (error || !data) { toast.error(error?.message.includes("PLAN") ? "Réservé au plan Business." : "Invitation non créée, réessaie."); return; }
    navigator.clipboard.writeText(linkFor(data)).catch(() => {});
    toast.success("Lien d'invitation copié");
    load();
  };
  const end = async (id: string, label: string) => {
    if (!confirm(label)) return;
    const { error } = await supabase.rpc("team_end_link", { _link_id: id });
    if (error) { toast.error("Action impossible, réessaie."); return; }
    load();
  };

  return (
    <section className="surface mt-6 rounded-lg p-5">
      <h2 className="font-bold">Mes partenaires (comptes MLM Boost AI)</h2>
      <p className="mt-1 text-sm text-muted-foreground">Différent de tes recrues CRM : ici, ce sont des personnes qui ont un compte et ont accepté ton invitation. Tu vois seulement leur progression dans l'Académie, jamais leurs prospects ni leurs messages.</p>
      <button onClick={create} className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
        <UserPlus className="size-4" /> Créer un lien d'invitation
      </button>
      {invites.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Invitations en attente (valables 14 jours, une personne par lien)</p>
          {invites.map((v) => (
            <div key={v.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-primary">{linkFor(v.invite_code)}</span>
              <button aria-label="Copier" onClick={() => { navigator.clipboard.writeText(linkFor(v.invite_code)); toast.success("Lien copié"); }} className="p-1 hover:text-primary"><Copy className="size-4" /></button>
              <button aria-label="Annuler l'invitation" onClick={() => end(v.id, "Annuler cette invitation ?")} className="p-1 hover:text-destructive"><X className="size-4" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 space-y-2">
        {members.length === 0 ? <p className="text-sm text-muted-foreground">Aucun partenaire n'a encore accepté d'invitation.</p> : members.map((m) => (
          <div key={m.link_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{m.member_name}</div>
              <div className="text-xs text-muted-foreground">Dans l'équipe depuis le {fmt(m.accepted_at)} · dernier niveau validé le {fmt(m.last_passed_at)}</div>
            </div>
            <span className="font-bold text-primary">{m.levels_passed}/{lessons.length} niveaux</span>
            <button onClick={() => end(m.link_id, `Retirer ${m.member_name} de ton équipe ? Tu ne verras plus sa progression.`)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"><LogOut className="size-3.5" />Retirer</button>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Vue membre : son leader et le bouton pour quitter l'équipe. */
export function MyLeaderCard() {
  const [leader, setLeader] = useState<{ link_id: string; leader_name: string } | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_team_leader");
    setLeader((data?.[0] as { link_id: string; leader_name: string } | undefined) ?? null);
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!leader) return null;
  const leave = async () => {
    if (!confirm(`Quitter l'équipe de ${leader.leader_name} ? Il ne verra plus ta progression.`)) return;
    const { error } = await supabase.rpc("team_end_link", { _link_id: leader.link_id });
    if (error) { toast.error("Action impossible, réessaie."); return; }
    toast.success("Tu as quitté l'équipe.");
    setLeader(null);
  };
  return (
    <div className="surface mt-5 flex flex-wrap items-center gap-3 rounded-lg p-4 text-sm">
      <span className="flex-1">Tu fais partie de l'équipe de <b>{leader.leader_name}</b>. Ton leader voit seulement le nombre de niveaux que tu as validés.</span>
      <button onClick={leave} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"><LogOut className="size-3.5" />Quitter l'équipe</button>
    </div>
  );
}
