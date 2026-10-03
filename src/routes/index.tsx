import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, BarChart3, Bot, Check, ContactRound, MessageSquareText, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "MLM Boost AI — Prospectez mieux, avancez plus vite" },
    { name: "description", content: "Assistant IA et suivi de prospects pour organiser une prospection MLM humaine et efficace." },
    { property: "og:title", content: "MLM Boost AI — Votre copilote de prospection" },
    { property: "og:description", content: "Créez vos messages, suivez vos contacts et améliorez votre régularité." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Landing,
});

const features = [
  { icon: Bot, title: "Assistant IA", text: "Un copilote conversationnel qui vous aide à répondre avec justesse, sans perdre votre voix." },
  { icon: MessageSquareText, title: "Contenus qui vous ressemblent", text: "Messages, scripts d’appel et publications adaptés à votre contexte en quelques secondes." },
  { icon: ContactRound, title: "CRM simple et clair", text: "Chaque prospect, chaque échange et chaque prochaine étape réunis au même endroit." },
  { icon: BarChart3, title: "Progression mesurable", text: "Visualisez votre activité et identifiez ce qui transforme une conversation en relation durable." },
];

const plans = [
  { name: "Gratuit", price: "0 FCFA", usd: "0", sub: "Pour démarrer", items: ["10 prospects maximum", "5 générations IA / mois", "1 utilisateur"] },
  { name: "Pro", price: "5 000 FCFA", usd: "8", sub: "Pour les networkers actifs", popular: true, items: ["Prospects illimités", "100 générations IA / mois", "Historique complet", "Relances automatiques", "1 utilisateur"] },
  { name: "Expert", price: "12 000 FCFA", usd: "20", sub: "Pour passer à l’échelle", items: ["Tout le plan Pro", "Générations IA illimitées", "Académie", "Rapports hebdomadaires", "Export CSV"] },
  { name: "Business", price: "25 000 FCFA", usd: "41", sub: "Pour les équipes", items: ["Tout le plan Expert", "Gestion d’équipe", "Templates par entreprise", "WhatsApp Business", "Support prioritaire"] },
];

function Landing() {
  const navigate = useNavigate();
  // Un utilisateur déjà connecté (ex. retour de la connexion Google sur "/")
  // est renvoyé directement vers son espace de travail.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);
  return <main className="min-h-screen overflow-hidden bg-background">
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5"><Brand /><nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"><a href="#features" className="hover:text-foreground">Fonctionnalités</a><a href="#pricing" className="hover:text-foreground">Tarifs</a><Link to="/auth" className="hover:text-foreground">Connexion</Link></nav><Button asChild size="sm"><Link to="/auth">Essayer gratuitement <ArrowRight /></Link></Button></div></header>
    <section className="relative flex min-h-[760px] items-center pt-24"><div className="hero-grid absolute inset-0 opacity-60" /><div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-[1.05fr_.95fr]"><div><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"><Sparkles className="size-3.5" /> L’IA au service de relations authentiques</div><h1 className="max-w-3xl text-5xl font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">Prospectez mieux.<br/><span className="text-primary">Avancez plus vite.</span></h1><p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">Un espace intelligent pour préparer vos conversations, suivre vos prospects et transformer votre régularité en progression.</p><div className="mt-9 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/auth">Commencer gratuitement <ArrowRight /></Link></Button><Button asChild variant="outline" size="lg"><a href="#features">Découvrir la plateforme</a></Button></div><div className="mt-7 flex flex-wrap gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Check className="size-4 text-success" /> Sans carte bancaire</span><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" /> Données privées</span></div></div><div className="relative"><div className="surface relative rounded-xl p-3"><div className="rounded-lg bg-secondary p-5"><div className="mb-5 flex items-center justify-between"><span className="text-sm font-bold">Vue d’ensemble</span><span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success">+18% ce mois</span></div><div className="grid grid-cols-2 gap-3"><Metric label="Prospects actifs" value="48" /><Metric label="Messages créés" value="126" /></div><div className="mt-4 rounded-lg border border-border bg-card p-4"><div className="mb-4 flex items-center justify-between text-xs"><span className="font-semibold">Progression hebdomadaire</span><span className="text-muted-foreground">7 jours</span></div><div className="flex h-28 items-end gap-2">{[35,56,42,72,61,88,76].map((h,i)=><span key={i} className="flex-1 rounded-t bg-primary/80" style={{height:`${h}%`}} />)}</div></div></div></div><div className="absolute -bottom-7 -left-6 hidden rounded-lg border border-border bg-card p-4 shadow-card sm:block"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary"><Zap className="size-4" /></span><div><p className="text-xs font-bold">Message prêt</p><p className="text-[11px] text-muted-foreground">Personnalisé en 8 secondes</p></div></div></div></div></div></section>
    <section id="features" className="border-y border-border bg-secondary/40 py-24"><div className="mx-auto max-w-7xl px-5"><span className="eyebrow">Tout au même endroit</span><h2 className="mt-3 max-w-xl text-3xl font-extrabold sm:text-4xl">Votre méthode, amplifiée par les bons outils.</h2><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{features.map(({icon:Icon,title,text},i)=><article key={title} className="surface rounded-lg p-6 transition-transform hover:-translate-y-1"><span className="mb-7 grid size-11 place-items-center rounded-lg bg-primary/12 text-primary"><Icon /></span><span className="text-xs text-muted-foreground">0{i+1}</span><h3 className="mt-2 font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></article>)}</div></div></section>
    <section id="pricing" className="py-24"><div className="mx-auto max-w-7xl px-5 text-center"><span className="eyebrow">Des tarifs transparents</span><h2 className="mt-3 text-4xl font-extrabold">Un plan pour chaque ambition.</h2><p className="mt-3 text-muted-foreground">Commencez gratuitement, évoluez quand vous êtes prêt.</p><div className="mt-12 grid gap-4 text-left md:grid-cols-2 lg:grid-cols-4">{plans.map(plan=><article key={plan.name} className={`relative rounded-lg border p-6 ${plan.popular ? "border-primary bg-primary/8 shadow-glow" : "border-border bg-card"}`}>{plan.popular && <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold text-primary-foreground">POPULAIRE</span>}<h3 className="font-bold">{plan.name}</h3><p className="mt-1 text-xs text-muted-foreground">{plan.sub}</p><p className="mt-6 text-3xl font-extrabold">{plan.price}<span className="text-xs font-normal text-muted-foreground"> / mois</span></p><p className="text-xs text-muted-foreground">≈ {plan.usd} $ / mois</p><Button asChild variant={plan.popular ? "default" : "outline"} className="mt-6 w-full"><Link to="/auth">Choisir {plan.name}</Link></Button><ul className="mt-6 space-y-3">{plan.items.map(item=><li key={item} className="flex gap-2 text-sm text-muted-foreground"><Check className="size-4 shrink-0 text-success" />{item}</li>)}</ul></article>)}</div></div></section>
    <footer className="border-t border-border bg-secondary/40"><div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-10 sm:flex-row sm:items-center sm:justify-between"><Brand /><div className="flex gap-6 text-xs text-muted-foreground"><a href="#features">Fonctionnalités</a><a href="#pricing">Tarifs</a><Link to="/auth">Connexion</Link></div><p className="max-w-xs text-xs leading-5 text-muted-foreground">Aucun revenu garanti — outil d’aide à la prospection.</p></div></footer>
  </main>;
}

function Metric({label,value}:{label:string;value:string}) { return <div className="rounded-lg border border-border bg-card p-4"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></div>; }