import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import { BarChart3, Bot, CheckCircle2, ChevronDown, ContactRound, CreditCard, GraduationCap, LayoutDashboard, LogOut, Menu, MessageSquareText, Plus, Search, Settings, Sparkles, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateProspectingContent } from "@/lib/ai.functions";
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
const statuses = ["Nouveau", "Contacté", "Discussion", "Intéressé", "Client", "Non intéressé"] as const;
const modes = ["Message de prospection", "Réponse à un prospect", "Script d'appel", "Post réseau social"] as const;
const nav = [{ icon: LayoutDashboard, label: "Dashboard" }, { icon: ContactRound, label: "Prospects" }, { icon: Bot, label: "Assistant IA" }, { icon: BarChart3, label: "Statistiques" }, { icon: GraduationCap, label: "Académie" }, { icon: CreditCard, label: "Abonnement" }, { icon: Settings, label: "Paramètres" }];

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const generate = useServerFn(generateProspectingContent);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [generationCount, setGenerationCount] = useState(0);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false); const [query, setQuery] = useState("");
  const [mode, setMode] = useState<(typeof modes)[number]>(modes[0]); const [context, setContext] = useState("");
  const [result, setResult] = useState(""); const [generating, setGenerating] = useState(false); const [error, setError] = useState("");
  const displayName = String(user.user_metadata?.["full_name"] ?? user.email?.split("@")[0] ?? "Networker");

  useEffect(() => {
    supabase.from("profiles").upsert({ id: user.id, full_name: displayName });
    supabase.from("prospects").select("*").order("created_at", { ascending: false }).then(({ data }) => setProspects(data ?? []));
    supabase.from("ai_generations").select("id", { count: "exact", head: true }).then(({ count }) => setGenerationCount(count ?? 0));
  }, [displayName, user.id]);

  const filtered = useMemo(() => prospects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.phone.includes(query)), [prospects, query]);
  const clients = prospects.filter(p => p.status === "Client").length;
  const conversion = prospects.length ? Math.round((clients / prospects.length) * 100) : 0;

  async function addProspect(event: FormEvent) {
    event.preventDefault(); if (!name.trim()) return;
    const { data, error: insertError } = await supabase.from("prospects").insert({ user_id: user.id, name: name.trim(), phone: phone.trim() }).select().single();
    if (insertError) setError(insertError.message); else if (data) { setProspects(p => [data, ...p]); setName(""); setPhone(""); setAdding(false); }
  }
  async function changeStatus(id: string, status: string) {
    const { error: updateError } = await supabase.from("prospects").update({ status }).eq("id", id);
    if (updateError) setError(updateError.message); else setProspects(items => items.map(p => p.id === id ? { ...p, status } : p));
  }
  async function runGeneration() {
    if (context.trim().length < 8) { setError("Ajoutez un peu plus de contexte."); return; }
    setGenerating(true); setError("");
    try { const response = await generate({ data: { mode, context } }); setResult(response.text); setGenerationCount(value => value + 1); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "La génération a échoué."); }
    finally { setGenerating(false); }
  }
  async function signOut() { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  return <main className="min-h-screen bg-background pb-20 lg:pl-64 lg:pb-0">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex"><div className="p-6"><Brand /></div><nav className="mt-4 flex-1 space-y-1 px-3">{nav.map(({icon:Icon,label},i)=><button key={label} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${i === 0 ? "bg-primary/12 font-semibold text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Icon className="size-4" />{label}</button>)}</nav><button onClick={signOut} className="m-4 flex items-center gap-3 rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"><LogOut className="size-4" /> Se déconnecter</button></aside>
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl"><div className="flex h-16 items-center justify-between px-5 lg:px-8"><div className="flex items-center gap-3 lg:hidden"><Menu className="size-5 text-muted-foreground" /><Brand compact /></div><div className="hidden lg:block"><p className="text-xs text-muted-foreground">Espace de travail</p><p className="text-sm font-bold">Dashboard</p></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-semibold">{displayName}</p><p className="text-xs text-muted-foreground">Compte Pro</p></div><span className="grid size-9 place-items-center rounded-full bg-primary/15 font-bold text-primary">{displayName.charAt(0).toUpperCase()}</span></div></div></header>
    <div className="mx-auto max-w-[1500px] p-5 lg:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><span className="eyebrow">Bonjour {displayName.split(" ")[0]}</span><h1 className="mt-2 text-3xl font-extrabold">Votre activité en un coup d’œil.</h1><p className="mt-2 text-sm text-muted-foreground">Gardez le rythme, une conversation à la fois.</p></div><Button onClick={() => setAdding(!adding)}><Plus /> Ajouter un prospect</Button></div>
      {adding && <form onSubmit={addProspect} className="surface mt-5 grid gap-3 rounded-lg p-4 sm:grid-cols-[1fr_1fr_auto]"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom du prospect" required /><Input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Téléphone" /><Button>Enregistrer</Button></form>}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat icon={ContactRound} label="Prospects actifs" value={String(prospects.filter(p=>p.status!=="Client"&&p.status!=="Non intéressé").length)} note="En cours de suivi"/><Stat icon={MessageSquareText} label="Messages générés" value={String(generationCount)} note="Historique sécurisé"/><Stat icon={CheckCircle2} label="Clients ce mois" value={String(clients)} note="Conversion actuelle"/><Stat icon={BarChart3} label="Taux de conversion" value={`${conversion}%`} note="Prospects devenus clients"/></section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.12fr_.88fr]"><section className="surface min-w-0 rounded-lg"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="font-bold">Prospects récents</h2><p className="mt-1 text-xs text-muted-foreground">{prospects.length} contacts dans votre pipeline</p></div><label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input className="w-56 pl-9" placeholder="Rechercher…" value={query} onChange={e=>setQuery(e.target.value)} /></label></div><div className="divide-y divide-border">{filtered.length ? filtered.slice(0,8).map(p=><div key={p.id} className="flex flex-wrap items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-full bg-secondary font-bold text-primary">{p.name.charAt(0).toUpperCase()}</span><div className="min-w-32 flex-1"><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.phone || "Téléphone non renseigné"}</p></div><span className={`status status-${slugStatus(p.status)}`}>{p.status}</span><label className="relative"><select aria-label={`Changer le statut de ${p.name}`} value={p.status} onChange={e=>changeStatus(p.id,e.target.value)} className="h-8 appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-xs outline-none focus:ring-1 focus:ring-ring">{statuses.map(s=><option key={s}>{s}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-2 size-3 text-muted-foreground"/></label></div>) : <div className="p-10 text-center"><ContactRound className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 text-sm font-semibold">Aucun prospect pour le moment</p><p className="mt-1 text-xs text-muted-foreground">Ajoutez votre premier contact pour commencer.</p></div>}</div></section>
        <section className="surface rounded-lg p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary"><Sparkles className="size-5"/></span><div><h2 className="font-bold">Assistant IA</h2><p className="text-xs text-muted-foreground">Créez un contenu adapté à votre situation.</p></div></div><div className="mt-5 grid grid-cols-2 gap-2">{modes.map(item=><button key={item} onClick={()=>setMode(item)} className={`min-h-12 rounded-md border px-3 text-left text-xs font-semibold transition-colors ${mode===item?"border-primary bg-primary/12 text-primary":"border-border bg-secondary text-muted-foreground hover:text-foreground"}`}>{item}</button>)}</div><Textarea className="mt-4 min-h-32 resize-none" placeholder="Décrivez le prospect, le contexte et le ton souhaité…" value={context} onChange={e=>setContext(e.target.value)} /><Button className="mt-3 w-full" onClick={runGeneration} disabled={generating}><Sparkles />{generating?"Génération…":"Générer"}</Button>{error&&<p className="mt-3 text-xs text-destructive">{error}</p>}{result&&<div className="prose prose-invert mt-4 max-h-72 overflow-y-auto rounded-md border border-border bg-secondary p-4 text-sm leading-6"><ReactMarkdown>{result}</ReactMarkdown></div>}</section></div>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-card/95 backdrop-blur-xl lg:hidden">{nav.slice(0,5).map(({icon:Icon,label},i)=><button key={label} aria-label={label} className={`flex w-16 flex-col items-center gap-1 text-[10px] ${i===0?"text-primary":"text-muted-foreground"}`}><Icon className="size-5"/><span>{label === "Assistant IA" ? "Assistant" : label}</span></button>)}</nav>
  </main>;
}

function Stat({icon:Icon,label,value,note}:{icon:typeof UserRound;label:string;value:string;note:string}) { return <article className="surface rounded-lg p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{label}</span><span className="grid size-8 place-items-center rounded-md bg-primary/12 text-primary"><Icon className="size-4"/></span></div><p className="mt-4 text-3xl font-extrabold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></article>; }
function slugStatus(status:string){ return status.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replaceAll(" ","-"); }