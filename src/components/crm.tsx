import { useEffect, useMemo, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ChevronDown, ContactRound, NotebookPen, Plus, Search, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateProspectingContent } from "@/lib/ai.functions";
import { getMyPaymentStatus } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { User } from "@supabase/supabase-js";
import { WhatsAppActions } from "@/components/whatsapp-actions";
import { toast } from "sonner";

export type Prospect = Tables<"prospects"> & { joined_team_at?: string | null };
export type Status = Prospect["status"];
export type ProspectPatch = Partial<Pick<Prospect, "name" | "phone" | "notes" | "next_followup_date" | "source" | "product_interest" | "main_objection" | "interest_level" | "first_contact_at">>;
export const statuses = ["nouveau", "contacté", "discussion", "intéressé", "client", "non_intéressé"] as const satisfies readonly Status[];
export const statusLabels: Record<Status, string> = { nouveau: "Nouveau", "contacté": "Contacté", discussion: "Discussion", "intéressé": "Intéressé", client: "Client", "non_intéressé": "Non intéressé" };
export const baseModes = ["Message de prospection", "Réponse à un prospect", "Script d'appel", "Post réseau social"] as const;
export const welcomeMode = "Message d'accueil / encouragement";
export const modes = [...baseModes, welcomeMode] as const;
export const planLabels: Record<string, string> = { gratuit: "Gratuit", pro: "Pro", expert: "Expert", business: "Business" };
export function usageLabel(used: number, limit: number) { return limit < 0 ? `${used} (illimité)` : `${used}/${limit}`; }
export function slugStatus(status: string) { return status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replaceAll(" ", "-").replaceAll("_", "-"); }

export function useCrm(user: User, opts?: { onJoinTeam?: (p: Prospect) => void }) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [generationCount, setGenerationCount] = useState(0);
  const [monthlyGenerations, setMonthlyGenerations] = useState(0);
  const [limits, setLimits] = useState<{ plan: string; prospects: number; generations: number }>({ plan: "gratuit", prospects: 10, generations: 5 });
  const [pendingPayment, setPendingPayment] = useState<{ plan_demande: string } | null>(null);
  const [error, setError] = useState("");
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});
  const paymentStatusFn = useServerFn(getMyPaymentStatus);
  const displayName = String(user.user_metadata?.["full_name"] ?? user.email?.split("@")[0] ?? "Networker");

  useEffect(() => {
    supabase.from("profiles").upsert({ id: user.id, full_name: displayName });
    supabase.from("prospects").select("*").order("created_at", { ascending: false }).then(({ data }) => setProspects(data ?? []));
    supabase.from("ai_generations").select("id", { count: "exact", head: true }).then(({ count }) => setGenerationCount(count ?? 0));
    supabase.from("ai_generations").select("prospect_id, generated_content").not("prospect_id", "is", null).order("created_at", { ascending: true }).then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach(g => { if (g.prospect_id) map[g.prospect_id] = g.generated_content; });
      setLastMessages(map);
    });
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    supabase.from("ai_generations").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()).then(({ count }) => setMonthlyGenerations(count ?? 0));
    supabase.from("subscriptions").select("plan, limite_prospects, limite_generations_ia").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setLimits({ plan: data.plan, prospects: data.limite_prospects, generations: data.limite_generations_ia });
    });
    paymentStatusFn({}).then(({ request }) => setPendingPayment((request as { statut?: string; plan_demande: string } | null)?.statut === "en_attente" ? (request as { plan_demande: string }) : null)).catch(() => {});
  }, [displayName, user.id]);

  const clients = prospects.filter(p => p.status === "client").length;
  const conversion = prospects.length ? Math.round((clients / prospects.length) * 100) : 0;

  async function addProspect(name: string, phone: string) {
    if (limits.prospects >= 0 && prospects.length >= limits.prospects) {
      setError(`Vous avez atteint la limite de votre plan actuel ${planLabels[limits.plan] ?? limits.plan} (${limits.prospects} prospects). Passez à un plan supérieur pour ajouter plus de prospects.`);
      return false;
    }
    const { data, error: insertError } = await supabase.from("prospects").insert({ user_id: user.id, name: name.trim(), phone: phone.trim() }).select().single();
    if (insertError) { setError(insertError.message); return false; }
    if (data) setProspects(p => [data, ...p]);
    return true;
  }
  async function changeStatus(id: string, status: Status) {
    const before = prospects.find(p => p.id === id);
    const { error: e } = await supabase.from("prospects").update({ status }).eq("id", id);
    if (e) { setError(e.message); return; }
    const joining = status === "client" && before?.status !== "client";
    setProspects(items => items.map(p => p.id === id ? { ...p, status, ...(joining ? { joined_team_at: new Date().toISOString() } : {}) } : p));
    if (joining && before) {
      if (opts?.onJoinTeam) opts.onJoinTeam(before);
      else toast.success(`🎉 ${before.name} a rejoint ton équipe !`);
    }
  }
  async function updateProspect(id: string, patch: ProspectPatch) {
    const { error: e } = await supabase.from("prospects").update(patch).eq("id", id);
    if (e) setError(e.message); else setProspects(items => items.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  async function markContacted(id: string) {
    const patch = { status: "contacté" as Status, last_contact_date: new Date().toISOString() };
    const { error: e } = await supabase.from("prospects").update(patch).eq("id", id);
    if (e) setError(e.message); else setProspects(items => items.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  return { lastMessages, setLastMessages, markContacted, prospects, generationCount, monthlyGenerations, setMonthlyGenerations, setGenerationCount, limits, pendingPayment, error, setError, displayName, clients, conversion, addProspect, changeStatus, updateProspect };
}

export type Crm = ReturnType<typeof useCrm>;

export function UsageLine({ crm }: { crm: Crm }) {
  return <p className="mt-3 text-xs text-muted-foreground">Plan {planLabels[crm.limits.plan] ?? crm.limits.plan} — {usageLabel(crm.prospects.length, crm.limits.prospects)} prospects utilisés · {usageLabel(crm.monthlyGenerations, crm.limits.generations)} générations IA ce mois</p>;
}

export function PendingPaymentBanner({ crm }: { crm: Crm }) {
  if (!crm.pendingPayment) return null;
  return (
    <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
      <strong>Paiement en cours de vérification.</strong> Votre demande pour le plan{" "}
      <span className="font-semibold capitalize">{crm.pendingPayment.plan_demande}</span> est en attente de validation. Votre compte reste sur le plan Gratuit jusqu’à la confirmation.
    </div>
  );
}

export function Stat({ icon: Icon, label, value, note }: { icon: typeof UserRound; label: string; value: string; note: string }) {
  return <article className="surface rounded-lg p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><span className="grid size-8 place-items-center rounded-md bg-primary/12 text-primary"><Icon className="size-4" /></span></div><p className="mt-4 text-3xl font-extrabold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></article>;
}

export function ProspectsPanel({ crm, limit, excludeClients, onOpen }: { crm: Crm; limit?: number; excludeClients?: boolean; onOpen?: (p: Prospect) => void }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const filtered = useMemo(() => crm.prospects.filter(p => (!excludeClients || p.status !== "client") && (p.name.toLowerCase().includes(query.toLowerCase()) || (p.phone ?? "").includes(query))), [crm.prospects, query, excludeClients]);
  const shown = limit ? filtered.slice(0, limit) : filtered;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const ok = await crm.addProspect(name, phone);
    if (ok) { setName(""); setPhone(""); setAdding(false); }
  }

  return (
    <section className="surface min-w-0 rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div><h2 className="font-bold">Prospects</h2><p className="mt-1 text-xs text-muted-foreground">{crm.prospects.length} contacts dans votre pipeline</p></div>
        <div className="flex items-center gap-2">
          <label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="w-48 pl-9" placeholder="Rechercher…" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <Button size="sm" onClick={() => setAdding(!adding)}><Plus /> Ajouter</Button>
        </div>
      </div>
      {adding && <form onSubmit={submit} className="grid gap-3 border-b border-border p-4 sm:grid-cols-[1fr_1fr_auto]"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du prospect" required /><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Téléphone" /><Button>Enregistrer</Button></form>}
      {crm.error && <p className="border-b border-border p-4 text-xs text-destructive">{crm.error}</p>}
      <div className="divide-y divide-border">{shown.length ? shown.map(p => <ProspectCard key={p.id} prospect={p} onOpen={onOpen} onChangeStatus={crm.changeStatus} onUpdate={crm.updateProspect} />) : <div className="p-10 text-center"><ContactRound className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Aucun prospect pour le moment</p><p className="mt-1 text-xs text-muted-foreground">Ajoutez votre premier contact pour commencer.</p></div>}</div>
    </section>
  );
}

export function ProspectCard({ prospect: p, onChangeStatus, onUpdate, onOpen }: { prospect: Prospect; onChangeStatus: (id: string, status: Status) => void; onUpdate: (id: string, patch: ProspectPatch) => Promise<void>; onOpen?: ((p: Prospect) => void) | undefined }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(p.notes ?? "");
  const [followup, setFollowup] = useState(p.next_followup_date ?? "");
  const [saving, setSaving] = useState(false);
  const overdue = p.next_followup_date && p.next_followup_date < new Date().toISOString().slice(0, 10);
  async function save() { setSaving(true); await onUpdate(p.id, { notes: notes.trim(), next_followup_date: followup || null }); setSaving(false); }
  return <div className="p-4">
    <div className="flex flex-wrap items-center gap-3">
      <span className="grid size-10 place-items-center rounded-full bg-secondary font-bold text-primary">{p.name.charAt(0).toUpperCase()}</span>
      <div className={`min-w-32 flex-1 ${onOpen ? "cursor-pointer" : ""}`} onClick={onOpen ? () => onOpen(p) : undefined} role={onOpen ? "button" : undefined} aria-label={onOpen ? `Ouvrir la fiche de ${p.name}` : undefined}><p className={`text-sm font-semibold ${onOpen ? "hover:text-primary" : ""}`}>{p.name}</p><p className="text-xs text-muted-foreground">{p.phone || "Téléphone non renseigné"}</p>{p.next_followup_date && <p className={`mt-1 flex items-center gap-1 text-[11px] ${overdue ? "text-destructive" : "text-primary"}`}><CalendarClock className="size-3" /> Relance le {new Date(p.next_followup_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</p>}</div>
      <span className={`status status-${slugStatus(p.status)}`}>{statusLabels[p.status]}</span>
      <label className="relative"><select aria-label={`Changer le statut de ${p.name}`} value={p.status} onChange={e => onChangeStatus(p.id, e.target.value as Status)} className="h-8 appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-xs outline-none focus:ring-1 focus:ring-ring">{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-2 size-3 text-muted-foreground" /></label>
      <Button variant="ghost" size="icon" aria-label={`Notes et relance pour ${p.name}`} onClick={() => setOpen(!open)} className={open ? "text-primary" : "text-muted-foreground"}><NotebookPen /></Button>
    </div>
    {open && <div className="mt-4 grid gap-3 rounded-md border border-border bg-secondary/50 p-3">
      <label className="grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Notes</span><Textarea className="min-h-20 resize-none bg-background" placeholder="Contexte, échanges, prochaines étapes…" value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <label className="grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Prochaine relance</span><Input type="date" className="w-44 bg-background" value={followup} onChange={e => setFollowup(e.target.value)} /></label>
      <div className="flex justify-end"><Button size="sm" onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></div>
    </div>}
  </div>;
}

export function AiAssistantPanel({ crm }: { crm: Crm }) {
  const generate = useServerFn(generateProspectingContent);
  const [mode, setMode] = useState<(typeof modes)[number]>(modes[0]);
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [prospectId, setProspectId] = useState("");
  const [resultProspectId, setResultProspectId] = useState("");
  const target = crm.prospects.find(p => p.id === resultProspectId);
  const selected = crm.prospects.find(p => p.id === prospectId);
  const availableModes: readonly (typeof modes)[number][] = selected?.status === "client" ? modes : baseModes;

  async function runGeneration() {
    if (context.trim().length < 8) { setError("Ajoutez un peu plus de contexte."); return; }
    setGenerating(true); setError("");
    if (crm.limits.generations >= 0 && crm.monthlyGenerations >= crm.limits.generations) {
      setError(`Vous avez atteint la limite de générations IA de votre plan ${planLabels[crm.limits.plan] ?? crm.limits.plan} pour ce mois. Passez à un plan supérieur pour continuer.`);
      setGenerating(false); return;
    }
    try {
      const response = await generate({ data: { mode, context, ...(prospectId ? { prospectId } : {}) } });
      setResult(response.text);
      setResultProspectId(prospectId);
      if (prospectId) crm.setLastMessages(m => ({ ...m, [prospectId]: response.text }));
      crm.setGenerationCount(v => v + 1);
      crm.setMonthlyGenerations(v => v + 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "La génération a échoué."); }
    finally { setGenerating(false); }
  }

  return (
    <section className="surface rounded-lg p-5">
      <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary"><Sparkles className="size-5" /></span><div><h2 className="font-bold">Assistant IA</h2><p className="text-xs text-muted-foreground">Créez un contenu adapté à votre situation.</p></div></div>
      <div className="mt-5 grid grid-cols-2 gap-2">{availableModes.map(item => <button key={item} onClick={() => setMode(item)} className={`min-h-12 rounded-md border px-3 text-left text-xs font-semibold transition-colors ${mode === item ? "border-primary bg-primary/12 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground"}`}>{item}</button>)}</div>
      <label className="relative mt-4 block"><select aria-label="Prospect concerné" value={prospectId} onChange={e => { const id = e.target.value; setProspectId(id); const s = crm.prospects.find(p => p.id === id); if (s?.status === "client") setMode(welcomeMode); else if (mode === welcomeMode) setMode(modes[0]); }} className="h-9 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm outline-none focus:ring-1 focus:ring-ring"><option value="">Aucun prospect (message général)</option><optgroup label="Prospects">{crm.prospects.filter(p => p.status !== "client").map(p => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` — ${p.phone}` : ""}</option>)}</optgroup><optgroup label="Mes recrues">{crm.prospects.filter(p => p.status === "client").map(p => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` — ${p.phone}` : ""}</option>)}</optgroup></select><ChevronDown className="pointer-events-none absolute right-2 top-3 size-3 text-muted-foreground" /></label>
      <Textarea className="mt-3 min-h-32 resize-none" placeholder="Décrivez le prospect, le contexte et le ton souhaité…" value={context} onChange={e => setContext(e.target.value)} />
      <Button className="mt-3 w-full" onClick={runGeneration} disabled={generating}><Sparkles />{generating ? "Génération…" : "Générer"}</Button>
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      {result && <div className="prose prose-invert mt-4 max-h-72 overflow-y-auto rounded-md border border-border bg-secondary p-4 text-sm leading-6"><ReactMarkdown>{result}</ReactMarkdown></div>}
      {result && <WhatsAppActions message={result} phone={target?.phone} prospectStatus={target?.status} onMarkContacted={target ? () => crm.markContacted(target.id) : undefined} />}
    </section>
  );
}
