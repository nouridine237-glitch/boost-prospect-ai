import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { BarChart3, Bot, CalendarClock, CheckCircle2, ChevronDown, ContactRound, MessageSquareText, NotebookPen, Plus, Search, Sparkles, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateProspectingContent } from "@/lib/ai.functions";
import { getMyPaymentStatus } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

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

type Prospect = Tables<"prospects">;
type Status = Prospect["status"];
const statuses = ["nouveau", "contacté", "discussion", "intéressé", "client", "non_intéressé"] as const satisfies readonly Status[];
const statusLabels: Record<Status, string> = { nouveau: "Nouveau", "contacté": "Contacté", discussion: "Discussion", "intéressé": "Intéressé", client: "Client", "non_intéressé": "Non intéressé" };
const modes = ["Message de prospection", "Réponse à un prospect", "Script d'appel", "Post réseau social"] as const;
const planLabels: Record<string, string> = { gratuit: "Gratuit", pro: "Pro", expert: "Expert", business: "Business" };
function usageLabel(used: number, limit: number) { return limit < 0 ? `${used} (illimité)` : `${used}/${limit}`; }

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const generate = useServerFn(generateProspectingContent);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [generationCount, setGenerationCount] = useState(0);
  const [monthlyGenerations, setMonthlyGenerations] = useState(0);
  const [limits, setLimits] = useState<{ plan: string; prospects: number; generations: number }>({ plan: "gratuit", prospects: 10, generations: 5 });
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false); const [query, setQuery] = useState("");
  const [mode, setMode] = useState<(typeof modes)[number]>(modes[0]); const [context, setContext] = useState("");
  const [result, setResult] = useState(""); const [generating, setGenerating] = useState(false); const [error, setError] = useState("");
  const paymentStatusFn = useServerFn(getMyPaymentStatus);
  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const displayName = String(user.user_metadata?.["full_name"] ?? user.email?.split("@")[0] ?? "Networker");

  useEffect(() => {
    supabase.from("profiles").upsert({ id: user.id, full_name: displayName });
    supabase.from("prospects").select("*").order("created_at", { ascending: false }).then(({ data }) => setProspects(data ?? []));
    supabase.from("ai_generations").select("id", { count: "exact", head: true }).then(({ count }) => setGenerationCount(count ?? 0));
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    supabase.from("ai_generations").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()).then(({ count }) => setMonthlyGenerations(count ?? 0));
    supabase.from("subscriptions").select("plan, limite_prospects, limite_generations_ia").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setLimits({ plan: data.plan, prospects: data.limite_prospects, generations: data.limite_generations_ia });
    });
  }, [displayName, user.id]);

  const filtered = useMemo(() => prospects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || (p.phone ?? "").includes(query)), [prospects, query]);
  const clients = prospects.filter(p => p.status === "client").length;
  const conversion = prospects.length ? Math.round((clients / prospects.length) * 100) : 0;

  async function addProspect(event: FormEvent) {
    event.preventDefault(); if (!name.trim()) return;
    if (limits.prospects >= 0 && prospects.length >= limits.prospects) {
      setError(`Vous avez atteint la limite de votre plan actuel ${planLabels[limits.plan] ?? limits.plan} (${limits.prospects} prospects). Passez à un plan supérieur pour ajouter plus de prospects.`);
      return;
    }
    const { data, error: insertError } = await supabase.from("prospects").insert({ user_id: user.id, name: name.trim(), phone: phone.trim() }).select().single();
    if (insertError) setError(insertError.message); else if (data) { setProspects(p => [data, ...p]); setName(""); setPhone(""); setAdding(false); }
  }
  async function changeStatus(id: string, status: Status) {
    const { error: updateError } = await supabase.from("prospects").update({ status }).eq("id", id);
    if (updateError) setError(updateError.message); else setProspects(items => items.map(p => p.id === id ? { ...p, status } : p));
  }
  async function updateProspect(id: string, patch: { notes?: string; next_followup_date?: string | null }) {
    const { error: updateError } = await supabase.from("prospects").update(patch).eq("id", id);
    if (updateError) setError(updateError.message); else setProspects(items => items.map(p => p.id === id ? { ...p, ...patch } : p));
  }
  async function runGeneration() {
    if (context.trim().length < 8) { setError("Ajoutez un peu plus de contexte."); return; }
    setGenerating(true); setError("");
    if (limits.generations >= 0 && monthlyGenerations >= limits.generations) { setError(`Vous avez atteint la limite de générations IA de votre plan ${planLabels[limits.plan] ?? limits.plan} pour ce mois. Passez à un plan supérieur pour continuer.`); setGenerating(false); return; }
    try { const response = await generate({ data: { mode, context } }); setResult(response.text); setGenerationCount(value => value + 1); setMonthlyGenerations(value => value + 1); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "La génération a échoué."); }
    finally { setGenerating(false); }
  }
  async function signOut() { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  return (
    <AppShell user={user} title="Dashboard">
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Bonjour {displayName.split(" ")[0]}</span>
            <h1 className="mt-2 text-3xl font-extrabold">Votre activité en un coup d’œil.</h1>
            <p className="mt-2 text-sm text-muted-foreground">Gardez le rythme, une conversation à la fois.</p>
          </div>
          <Button onClick={() => setAdding(!adding)}><Plus /> Ajouter un prospect</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Plan {planLabels[limits.plan] ?? limits.plan} — {usageLabel(prospects.length, limits.prospects)} prospects utilisés · {usageLabel(monthlyGenerations, limits.generations)} générations IA ce mois</p>
        {pendingPayment && (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <strong>Paiement en cours de vérification.</strong> Votre demande pour le plan{" "}
            <span className="font-semibold capitalize">{pendingPayment.plan_demande}</span> est en attente de validation. Votre compte reste sur le plan Gratuit jusqu’à la confirmation.
          </div>
        )}
        {adding && <form onSubmit={addProspect} className="surface mt-5 grid gap-3 rounded-lg p-4 sm:grid-cols-[1fr_1fr_auto]"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom du prospect" required /><Input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Téléphone" /><Button>Enregistrer</Button></form>}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat icon={ContactRound} label="Prospects actifs" value={String(prospects.filter(p=>p.status!=="client"&&p.status!=="non_intéressé").length)} note="En cours de suivi"/><Stat icon={MessageSquareText} label="Messages générés" value={String(generationCount)} note="Historique sécurisé"/><Stat icon={CheckCircle2} label="Clients ce mois" value={String(clients)} note="Conversion actuelle"/><Stat icon={BarChart3} label="Taux de conversion" value={`${conversion}%`} note="Prospects devenus clients"/></section>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.12fr_.88fr]">
          <section className="surface min-w-0 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
              <div><h2 className="font-bold">Prospects récents</h2><p className="mt-1 text-xs text-muted-foreground">{prospects.length} contacts dans votre pipeline</p></div>
              <label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input className="w-56 pl-9" placeholder="Rechercher…" value={query} onChange={e=>setQuery(e.target.value)} /></label>
            </div>
            <div className="divide-y divide-border">{filtered.length ? filtered.slice(0,8).map(p=><ProspectCard key={p.id} prospect={p} onChangeStatus={changeStatus} onUpdate={updateProspect} />) : <div className="p-10 text-center"><ContactRound className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 text-sm font-semibold">Aucun prospect pour le moment</p><p className="mt-1 text-xs text-muted-foreground">Ajoutez votre premier contact pour commencer.</p></div>}</div>
          </section>
          <section className="surface rounded-lg p-5">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary"><Sparkles className="size-5"/></span><div><h2 className="font-bold">Assistant IA</h2><p className="text-xs text-muted-foreground">Créez un contenu adapté à votre situation.</p></div></div>
            <div className="mt-5 grid grid-cols-2 gap-2">{modes.map(item=><button key={item} onClick={()=>setMode(item)} className={`min-h-12 rounded-md border px-3 text-left text-xs font-semibold transition-colors ${mode===item?"border-primary bg-primary/12 text-primary":"border-border bg-secondary text-muted-foreground hover:text-foreground"}`}>{item}</button>)}</div>
            <Textarea className="mt-4 min-h-32 resize-none" placeholder="Décrivez le prospect, le contexte et le ton souhaité…" value={context} onChange={e=>setContext(e.target.value)} />
            <Button className="mt-3 w-full" onClick={runGeneration} disabled={generating}><Sparkles />{generating?"Génération…":"Générer"}</Button>
            {error&&<p className="mt-3 text-xs text-destructive">{error}</p>}
            {result&&<div className="prose prose-invert mt-4 max-h-72 overflow-y-auto rounded-md border border-border bg-secondary p-4 text-sm leading-6"><ReactMarkdown>{result}</ReactMarkdown></div>}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function ProspectCard({ prospect: p, onChangeStatus, onUpdate }: { prospect: Prospect; onChangeStatus: (id: string, status: Status) => void; onUpdate: (id: string, patch: { notes?: string; next_followup_date?: string | null }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(p.notes ?? "");
  const [followup, setFollowup] = useState(p.next_followup_date ?? "");
  const [saving, setSaving] = useState(false);
  const overdue = p.next_followup_date && p.next_followup_date < new Date().toISOString().slice(0, 10);
  async function save() { setSaving(true); await onUpdate(p.id, { notes: notes.trim(), next_followup_date: followup || null }); setSaving(false); }
  return <div className="p-4">
    <div className="flex flex-wrap items-center gap-3">
      <span className="grid size-10 place-items-center rounded-full bg-secondary font-bold text-primary">{p.name.charAt(0).toUpperCase()}</span>
      <div className="min-w-32 flex-1"><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.phone || "Téléphone non renseigné"}</p>{p.next_followup_date && <p className={`mt-1 flex items-center gap-1 text-[11px] ${overdue ? "text-destructive" : "text-primary"}`}><CalendarClock className="size-3" /> Relance le {new Date(p.next_followup_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</p>}</div>
      <span className={`status status-${slugStatus(p.status)}`}>{statusLabels[p.status]}</span>
      <label className="relative"><select aria-label={`Changer le statut de ${p.name}`} value={p.status} onChange={e=>onChangeStatus(p.id,e.target.value as Status)} className="h-8 appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-xs outline-none focus:ring-1 focus:ring-ring">{statuses.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-2 size-3 text-muted-foreground"/></label>
      <Button variant="ghost" size="icon" aria-label={`Notes et relance pour ${p.name}`} onClick={() => setOpen(!open)} className={open ? "text-primary" : "text-muted-foreground"}><NotebookPen /></Button>
    </div>
    {open && <div className="mt-4 grid gap-3 rounded-md border border-border bg-secondary/50 p-3">
      <label className="grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Notes</span><Textarea className="min-h-20 resize-none bg-background" placeholder="Contexte, échanges, prochaines étapes…" value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <label className="grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Prochaine relance</span><Input type="date" className="w-44 bg-background" value={followup} onChange={e=>setFollowup(e.target.value)} /></label>
      <div className="flex justify-end"><Button size="sm" onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></div>
    </div>}
  </div>;
}
function Stat({icon:Icon,label,value,note}:{icon:typeof UserRound;label:string;value:string;note:string}) { return <article className="surface rounded-lg p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><span className="grid size-8 place-items-center rounded-md bg-primary/12 text-primary"><Icon className="size-4"/></span></div><p className="mt-4 text-3xl font-extrabold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></article>; }
function slugStatus(status:string){ return status.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replaceAll(" ","-").replaceAll("_","-"); }
