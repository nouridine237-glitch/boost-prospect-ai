import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ChevronDown, Lightbulb, Loader2, Megaphone, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UpgradeCard } from "@/components/plan-gate";
import { useCampaigns } from "@/components/campaign-picker";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/use-plan";
import { localDay } from "@/lib/coach";
import { hasFeature } from "@/lib/plans";
import { OBJECTIVES } from "@/lib/content-planner";
import {
  bestCampaign, CAMPAIGN_CHANNELS, campaignDbError, campaignMetrics, campaignsKey, canCreateActive, emptyCampaignFilters, filterCampaigns,
  MAX_NAME, MAX_NOTE, PHASE_LABELS, phase, recommendations, validateCampaign, type Campaign, type CampaignDraft, type CampaignFilters, type CPost, type CProspect, type Metrics,
} from "@/lib/campaigns";

export const Route = createFileRoute("/_authenticated/campagnes")({
  head: () => ({ meta: [
    { title: "Suivi des campagnes — MLM Boost AI" },
    { name: "description", content: "Organisez vos campagnes et suivez les statuts publiés, prospects attribués et conversions réelles." },
    { property: "og:title", content: "Suivi des campagnes — MLM Boost AI" },
    { property: "og:description", content: "Des chiffres réels, saisis par vous : statuts publiés, prospects, clients." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CampaignsPage,
});

type LinkedPost = CPost & { body: string; planned_on: string };
type LinkedProspect = CProspect & { name: string };

function CampaignsPage() {
  const { user } = Route.useRouteContext();
  const plan = usePlan(user.id);
  const qc = useQueryClient();
  const today = localDay();
  const advanced = !plan.loading && hasFeature(plan.plan, "advancedStats");
  const [filters, setFilters] = useState<CampaignFilters>(emptyCampaignFilters);
  const [editing, setEditing] = useState<(CampaignDraft & { id?: string; archived?: boolean }) | null>(null);
  const campaigns = useCampaigns(user.id);
  const linked = useQuery({
    queryKey: [...campaignsKey(user.id), "linked"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("content_posts").select("id, status, campaign_id, published_at, body, planned_on").eq("user_id", user.id).not("campaign_id", "is", null),
        supabase.from("prospects").select("id, name, status, campaign_id, joined_team_at").eq("user_id", user.id).not("campaign_id", "is", null),
      ]);
      if (p.error) throw p.error;
      if (r.error) throw r.error;
      return { posts: (p.data ?? []) as LinkedPost[], prospects: (r.data ?? []) as LinkedProspect[] };
    },
  });
  const all = campaigns.data ?? [];
  const posts = linked.data?.posts ?? [];
  const prospects = linked.data?.prospects ?? [];
  // Les dates personnalisées et le multi-canal relèvent des statistiques avancées.
  const effective = advanced ? filters : { ...filters, from: "", to: "" };
  const shown = filterCampaigns(all, effective, today);
  const rows = useMemo(() => shown.map(c => ({ campaign: c, m: campaignMetrics(c.id, posts, prospects) })), [shown, posts, prospects]);
  const best = advanced ? bestCampaign(rows) : null;
  const canCreate = canCreateActive(all, plan.plan, today);
  const refresh = () => qc.invalidateQueries({ queryKey: campaignsKey(user.id) });

  async function toggleArchive(c: Campaign) {
    const { error } = await supabase.from("campaigns").update({ archived: !c.archived }).eq("id", c.id).eq("user_id", user.id);
    if (error) { toast.error(campaignDbError(error.message)); return; }
    toast.success(c.archived ? "Campagne restaurée" : "Campagne archivée"); void refresh();
  }

  const sel = "h-11 rounded-md border border-input bg-background px-3 text-sm";
  return <AppShell user={user} title="Campagnes">
    <div className="mx-auto max-w-3xl p-5 lg:p-8">
      <span className="eyebrow">Suivi</span>
      <h1 className="mt-2 text-3xl font-extrabold">Suivi des campagnes</h1>
      <p className="mt-2 text-sm text-muted-foreground">Regroupez vos statuts publiés et les prospects qu'ils vous ont amenés. Les chiffres viennent uniquement de ce que vous indiquez : aucune vue, aucun clic ni revenu n'est estimé.</p>

      <div className="mt-5 flex flex-wrap items-end gap-2">
        <select aria-label="Période" className={sel} value={filters.phase} onChange={e => setFilters({ ...filters, phase: e.target.value as CampaignFilters["phase"] })}>
          <option value="en_cours">En cours et à venir</option><option value="terminees">Terminées</option><option value="archivees">Archivées</option><option value="toutes">Toutes</option>
        </select>
        <select aria-label="Canal" className={sel} value={filters.channel} onChange={e => setFilters({ ...filters, channel: e.target.value as CampaignFilters["channel"] })}>
          <option value="">Tous canaux</option>{Object.entries(CAMPAIGN_CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {advanced && <>
          <label className="text-xs font-semibold">Du<input type="date" className={`${sel} block`} value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} /></label>
          <label className="text-xs font-semibold">Au<input type="date" className={`${sel} block`} value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} /></label>
        </>}
        <Button className="ml-auto min-h-11" disabled={!canCreate || plan.loading} onClick={() => setEditing({ name: "", objective: "produit", channel: "whatsapp", starts_on: today, ends_on: today, note: "" })}><Plus className="size-4" />Nouvelle campagne</Button>
      </div>
      {!canCreate && !plan.loading && <div className="mt-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">Le plan Gratuit permet 1 campagne active à la fois. Archivez-la ou <Link to="/abonnement" className="font-semibold text-primary underline">voyez les plans</Link>.</div>}

      {best && <p className="mt-4 rounded-md border border-border p-3 text-sm"><Lightbulb className="mr-1 inline size-4 text-primary" />Parmi les campagnes affichées, <b>{best.name}</b> a le meilleur taux ({best.clients}/{best.prospects} clients). Échantillon petit : à confirmer dans le temps.</p>}
      {!advanced && !plan.loading && all.length > 1 && <div className="mt-4"><UpgradeCard minPlan="expert">Comparaison entre campagnes et filtres par dates : plan Expert.</UpgradeCard></div>}

      {(campaigns.isError || linked.isError) && <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Impossible de charger vos campagnes. <button className="underline" onClick={() => void refresh()}>Réessayer</button></p>}
      {campaigns.isLoading ? <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
        : !rows.length ? <div className="surface mt-6 rounded-lg p-8 text-center"><Megaphone className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Aucune campagne ici</p><p className="mt-1 text-xs text-muted-foreground">Créez une campagne, reliez-y vos statuts dans le Planificateur, puis indiquez-la dans la fiche des prospects concernés.</p></div>
        : <ul className="mt-6 space-y-3">{rows.map(({ campaign: c, m }) => <CampaignCard key={c.id} c={c} m={m} today={today}
            posts={posts.filter(p => p.campaign_id === c.id)} prospects={prospects.filter(p => p.campaign_id === c.id)}
            onEdit={() => setEditing(c)} onArchive={() => void toggleArchive(c)} />)}</ul>}
      <p className="mt-8 text-center text-xs text-muted-foreground">Taux = prospects attribués au statut Client aujourd'hui ÷ prospects attribués. Aucun revenu garanti.</p>
    </div>
    {editing && <CampaignEditor userId={user.id} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />}
  </AppShell>;
}

function Num({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md bg-secondary/50 p-2 text-center"><p className="text-lg font-extrabold">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>;
}

function CampaignCard({ c, m, today, posts, prospects, onEdit, onArchive }: { c: Campaign; m: Metrics; today: string; posts: LinkedPost[]; prospects: LinkedProspect[]; onEdit: () => void; onArchive: () => void }) {
  const [open, setOpen] = useState(false);
  const ph = phase(c, today);
  const recos = recommendations(c, m, prospects, today);
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  return <li className="surface rounded-lg p-4">
    <div className="flex items-start justify-between gap-2">
      <div><p className="font-semibold">{c.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{fmt(c.starts_on)} → {fmt(c.ends_on)} · {CAMPAIGN_CHANNELS[c.channel as keyof typeof CAMPAIGN_CHANNELS]} · {OBJECTIVES[c.objective as keyof typeof OBJECTIVES]}</p></div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ph === "en_cours" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>{PHASE_LABELS[ph]}</span>
    </div>
    <div className="mt-3 grid grid-cols-4 gap-2">
      <Num label="Statuts publiés" value={m.published} /><Num label="Prospects" value={m.prospects} /><Num label="Clients" value={m.clients} />
      <Num label="Taux" value={m.rate === null ? "—" : `${m.rate} %`} />
    </div>
    {m.joined > 0 && <p className="mt-2 text-xs text-muted-foreground">{m.joined} prospect{m.joined > 1 ? "s ont" : " a"} rejoint l'équipe (compté à part).</p>}
    {recos.length > 0 && <ul className="mt-3 space-y-1">{recos.map(r => <li key={r.id} className="text-xs"><Lightbulb className="mr-1 inline size-3.5 text-primary" />{r.text} {r.to && <Link to={r.to} className="font-semibold text-primary underline">Ouvrir</Link>}</li>)}</ul>}
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="min-h-11" onClick={() => setOpen(o => !o)} aria-expanded={open}><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />Détail</Button>
      <Button size="sm" variant="ghost" className="min-h-11" onClick={onEdit}><Pencil className="size-4" />Modifier</Button>
      <Button size="sm" variant="ghost" className="min-h-11" onClick={onArchive}>{c.archived ? <><ArchiveRestore className="size-4" />Restaurer</> : <><Archive className="size-4" />Archiver</>}</Button>
    </div>
    {open && <div className="mt-3 grid gap-3 text-sm">
      {c.note && <p className="whitespace-pre-wrap text-muted-foreground">{c.note}</p>}
      <div><p className="text-xs font-bold uppercase text-muted-foreground">Statuts liés ({posts.length})</p>
        {posts.length ? <ul className="mt-1 space-y-1">{posts.map(p => <li key={p.id} className="truncate text-xs">{p.status === "publie" ? "✓ Publié" : "• Non publié"} · {fmt(p.planned_on)} — {p.body || "Brouillon sans texte"}</li>)}</ul> : <p className="text-xs text-muted-foreground">Aucun. Reliez un statut depuis le Planificateur.</p>}</div>
      <div><p className="text-xs font-bold uppercase text-muted-foreground">Prospects attribués ({prospects.length})</p>
        {prospects.length ? <ul className="mt-1 space-y-1">{prospects.map(p => <li key={p.id} className="text-xs">{p.name} · {p.status === "client" ? "Client" : p.status}</li>)}</ul> : <p className="text-xs text-muted-foreground">Aucun. Indiquez la campagne dans la fiche d'un prospect.</p>}</div>
    </div>}
  </li>;
}

function CampaignEditor({ userId, initial, onClose, onSaved }: { userId: string; initial: CampaignDraft & { id?: string }; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<CampaignDraft>({ name: initial.name, objective: initial.objective, channel: initial.channel, starts_on: initial.starts_on, ends_on: initial.ends_on, note: initial.note });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => setD(x => ({ ...x, [k]: v }));
  const field = "mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-normal";
  async function onSave() {
    if (saving) return;
    const err = validateCampaign(d);
    if (err) { setError(err); return; }
    setSaving(true); setError(null);
    const row = { ...d, name: d.name.trim() };
    const { error: e } = initial.id
      ? await supabase.from("campaigns").update(row).eq("id", initial.id).eq("user_id", userId)
      : await supabase.from("campaigns").insert({ ...row, user_id: userId });
    setSaving(false);
    if (e) { setError(campaignDbError(e.message)); return; }
    toast.success("Campagne enregistrée"); onSaved();
  }
  return <Dialog open onOpenChange={o => { if (!o && !saving) onClose(); }}>
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Megaphone className="size-4 text-primary" />{initial.id ? "Modifier la campagne" : "Nouvelle campagne"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <label className="block text-sm font-semibold">Nom<input value={d.name} maxLength={MAX_NAME} onChange={e => set("name", e.target.value)} placeholder="Ex. : Lancement gamme soin novembre" className={field} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold">Objectif<select value={d.objective} onChange={e => set("objective", e.target.value)} className={field}>{Object.entries(OBJECTIVES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="block text-sm font-semibold">Canal<select value={d.channel} onChange={e => set("channel", e.target.value)} className={field}>{Object.entries(CAMPAIGN_CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="block text-sm font-semibold">Début<input type="date" value={d.starts_on} onChange={e => set("starts_on", e.target.value)} className={field} /></label>
          <label className="block text-sm font-semibold">Fin<input type="date" value={d.ends_on} onChange={e => set("ends_on", e.target.value)} className={field} /></label>
        </div>
        <label className="block text-sm font-semibold">Note (facultatif)<Textarea value={d.note} maxLength={MAX_NOTE} rows={3} onChange={e => set("note", e.target.value)} className="mt-1 font-normal" /></label>
        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}{/plan/i.test(error) && <> <Link to="/abonnement" className="font-semibold underline">Voir les plans</Link></>}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="min-h-11" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button className="min-h-11" onClick={() => void onSave()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Enregistrer</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
