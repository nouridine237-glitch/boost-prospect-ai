import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowRight, BellRing, Bot, Check, CheckCheck, ChevronDown, Clock3, ContactRound, GraduationCap, LayoutList, Mail, Menu, MessageCircle, MessageSquareText, Plus, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { LandingPhone } from "@/components/landing-phone";
import { supabase } from "@/integrations/supabase/client";
import workspace from "@/assets/landing-workspace.jpg";

const shareImage = "https://networker-ai-buddy.lovable.app/mlm-boost-share.jpg";
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "MLM Boost AI — Organise ta prospection MLM" },
    { name: "description", content: "L’assistant IA et CRM pensé pour les entrepreneurs MLM et vente directe en Afrique. Prépare tes messages, relance sur WhatsApp et suis tes prospects. Gratuit pour démarrer." },
    { property: "og:title", content: "MLM Boost AI — Relance mieux. Avance chaque jour." },
    { property: "og:description", content: "Organise ta prospection MLM avec un assistant IA, un CRM et tes relances WhatsApp. Gratuit pour démarrer, sans carte bancaire." },
    { property: "og:type", content: "website" }, { property: "og:url", content: "https://networker-ai-buddy.lovable.app/" },
    { property: "og:image", content: shareImage }, { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: shareImage },
  ], links: [{ rel: "canonical", href: "https://networker-ai-buddy.lovable.app/" }] }),
  component: Landing,
});

const plans = [
  { name: "Gratuit", price: "0 FCFA", usd: "0", sub: "Pour démarrer", items: ["10 prospects maximum", "5 générations IA / mois", "1 utilisateur"] },
  { name: "Pro", price: "5 000 FCFA", usd: "8", sub: "Pour les networkers actifs", popular: true, items: ["Prospects illimités", "100 générations IA / mois", "Historique complet", "Relances automatiques", "1 utilisateur"] },
  { name: "Expert", price: "12 000 FCFA", usd: "20", sub: "Pour passer à l’échelle", items: ["Tout le plan Pro", "Générations IA illimitées", "Académie", "Rapports hebdomadaires", "Export CSV"] },
  { name: "Business", price: "25 000 FCFA", usd: "41", sub: "Pour les équipes", items: ["Tout le plan Expert", "Gestion d’équipe", "Templates par entreprise", "WhatsApp Business", "Support prioritaire"] },
];
const features = [
  { icon: Bot, title: "Assistant IA à 4 modes", text: "Premier message, réponse, script d’appel ou post : trouve les mots qui te ressemblent." },
  { icon: LayoutList, title: "CRM et pipeline", text: "Garde chaque contact et son contexte. Vois où en est chaque conversation." },
  { icon: BellRing, title: "Relances du jour", text: "Retrouve les contacts à relancer aujourd’hui, sans fouiller dans tes conversations." },
  { icon: MessageCircle, title: "Envoi WhatsApp assisté", text: "Prépare ton message, vérifie-le et envoie-le toi-même sur WhatsApp." },
  { icon: Users, title: "Mon équipe", text: "Retrouve tes recrues, leurs notes et les prochaines actions pour les accompagner." },
  { icon: GraduationCap, title: "Scripts et Académie MLM", text: "Pars d’un modèle prêt à l’emploi et progresse avec les 6 niveaux de l’Académie." },
];
const faqs = [
  ["C’est vraiment gratuit pour démarrer ?", "Oui. Le plan Gratuit te permet de gérer jusqu’à 10 prospects et de générer 5 contenus IA par mois. Aucune carte bancaire n’est demandée. Tu choisis un plan payant seulement si tu en as besoin."],
  ["Comment je paie (Orange Money, MTN) ?", "Le paiement se fait manuellement par Mobile Money. La page Abonnement affiche les moyens disponibles et les coordonnées à utiliser : Orange Money, et MTN lorsque celui-ci est renseigné. Tu envoies ensuite la référence et une preuve de paiement ; ton abonnement est activé après vérification."],
  ["Est-ce que l’app envoie des messages à ma place ?", "Non. L’app prépare le message et ouvre WhatsApp. Tu le relis, tu le valides et tu l’envoies toi-même. Aucun message ne part automatiquement à ta place."],
  ["Est-ce que ça garantit des revenus ?", "Non. MLM Boost AI est un outil d’aide à la prospection et à la productivité, pas une promesse de revenus. Tes résultats dépendent de nombreux facteurs, et aucun gain n’est garanti."],
  ["Mes données sont-elles privées ?", "Oui. Tes prospects, tes notes et tes messages sont liés à ton compte. Les autres utilisateurs ne peuvent pas accéder à ton CRM. Ne partage pas ton mot de passe et n’ajoute que les informations nécessaires à ton suivi."],
  ["Pour quelles entreprises MLM ça marche ?", "L’outil n’est pas lié à une entreprise particulière. Il s’adapte à ton produit et à ton contexte en MLM ou en vente directe. Vérifie toujours la légalité de ton activité, les règles de ton entreprise et le consentement de tes contacts."],
];
const delay = (i: number) => ({ "--lp-delay": `${i * 80}ms` }) as CSSProperties;

function Landing() {
  const navigate = useNavigate();
  const root = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    if (reduced || !("IntersectionObserver" in window)) return () => window.removeEventListener("scroll", onScroll);
    element.classList.add("lp-motion");
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("lp-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.08 });
    element.querySelectorAll(".lp-reveal").forEach(el => observer.observe(el));
    return () => { observer.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, []);

  return <main ref={root} className="lp-root min-h-screen overflow-clip bg-background">
    <header className={`lp-nav ${scrolled ? "lp-nav-scrolled" : ""}`}><div className="lp-container grid h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <a href="#top" aria-label="MLM Boost AI, accueil" className="min-w-0"><Brand /></a>
      <div className="flex shrink-0 items-center gap-2"><nav className="mr-5 hidden items-center gap-7 text-sm text-muted-foreground lg:flex"><a href="#how">Comment ça marche</a><a href="#features">Fonctionnalités</a><a href="#pricing">Tarifs</a><Link to="/auth">Connexion</Link></nav><Button asChild className="lp-button hidden sm:inline-flex"><Link to="/auth">Commencer <ArrowRight /></Link></Button><Button variant="ghost" size="icon" className="size-12 lg:hidden" aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</Button></div>
    </div>{menu && <nav className="lp-container grid gap-1 border-t border-border pb-4 lg:hidden">{[["Comment ça marche", "#how"], ["Fonctionnalités", "#features"], ["Tarifs", "#pricing"], ["Questions fréquentes", "#faq"]].map(([name, href]) => <a key={href} href={href} onClick={() => setMenu(false)} className="flex min-h-12 items-center text-sm">{name}</a>)}<Button asChild className="lp-button"><Link to="/auth">Commencer gratuitement</Link></Button></nav>}</header>

    <section id="top" className="lp-hero relative isolate">
      <img src={workspace} alt="Un téléphone et un carnet pour organiser sa prospection" width={1536} height={1024} fetchPriority="high" className="lp-hero-photo" />
      <div className="lp-ambient" aria-hidden="true" />
      <div className="lp-container relative pt-28 text-center lg:pt-32">
        <div className="lp-hero-intro mb-5 flex items-center justify-center gap-2 text-xs font-semibold text-info"><span className="h-px w-6 bg-info" /><Sparkles className="size-4" />MOINS D’OUBLIS. PLUS DE CLARTÉ.<span className="h-px w-6 bg-info" /></div>
        <p className="mb-3 text-sm font-semibold text-foreground">MLM Boost AI</p>
        <h1 className="lp-headline mx-auto max-w-5xl">{["Organise ta prospection MLM.", "Relance mieux.", "Avance chaque jour."].map((line, j) => <span key={line} className={`block ${j === 2 ? "text-info" : ""}`}>{line.split(" ").map((word, i) => <span className="lp-word" style={{ "--lp-delay": `${Math.min(560, (j * 4 + i) * 45)}ms` } as CSSProperties} key={i}>{word}{" "}</span>)}</span>)}</h1>
        <p className="lp-hero-sub mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">L'assistant IA + CRM pensé pour les entrepreneurs MLM et vente directe en Afrique</p>
        <div className="lp-hero-actions mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"><Button asChild className="lp-button lp-primary-cta w-full sm:w-auto"><Link to="/auth">Commencer gratuitement <ArrowRight /></Link></Button><Button asChild variant="outline" className="lp-button w-full bg-background/60 sm:w-auto"><a href="#how">Voir comment ça marche <ArrowDown /></a></Button></div>
        <p className="lp-hero-actions mt-4 text-xs text-muted-foreground">Gratuit pour démarrer · Sans carte bancaire</p>
        <div className="lp-hero-demo relative mx-auto mt-8 flex max-w-3xl items-center justify-center gap-10">
          <div className="hidden max-w-40 text-left md:block"><span className="lp-caption-icon"><ContactRound /></span><p className="mt-3 text-sm font-semibold">Tes contacts.<br />Enfin au même endroit.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Du premier échange à la prochaine relance.</p></div>
          <div className="lp-float"><LandingPhone compact /></div>
          <div className="hidden max-w-40 text-left md:block"><span className="lp-caption-icon"><MessageSquareText /></span><p className="mt-3 text-sm font-semibold">Les bons mots.<br />À ta façon.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">L’IA t’aide. Tu gardes la main.</p></div>
        </div>
      </div>
    </section>

    <section className="lp-section lp-problem"><div className="lp-container"><SectionTitle eyebrow="ÇA TE PARLE ?" title="La prospection ne devrait pas te disperser." /><div className="mt-8 grid gap-4 md:grid-cols-3">{[
      { icon: Clock3, title: "Tu perds des prospects par oubli", text: "Un message oublié, une relance trop tard… et la conversation s’arrête." },
      { icon: MessageSquareText, title: "Tu ne sais jamais quoi écrire", text: "Tu passes plus de temps à chercher tes mots qu’à échanger." },
      { icon: LayoutList, title: "Tu n’as aucune vue sur tes résultats", text: "Des contacts partout, mais pas de vision claire de tes prochaines actions." },
    ].map(({ icon: Icon, title, text }, i) => <article key={title} style={delay(i)} className="lp-reveal lp-card p-6"><Icon className="size-6 text-info" /><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></article>)}</div></div></section>

    <section id="how" className="lp-section"><div className="lp-container"><SectionTitle eyebrow="COMMENT ÇA MARCHE" title="Trois étapes. Une routine plus simple." /><div className="lp-reveal lp-steps mt-12 grid gap-10 md:grid-cols-3">{[
      { icon: Plus, title: "Ajoute tes prospects", text: "Un nom, un numéro, quelques notes. Ton suivi commence ici." },
      { icon: Sparkles, title: "Génère ton message avec l’IA", text: "Choisis un contact et donne le contexte. L’IA te propose un message naturel." },
      { icon: MessageCircle, title: "Envoie sur WhatsApp et suis la relance", text: "Tu relis, tu envoies toi-même, puis tu fixes ta prochaine relance." },
    ].map(({ icon: Icon, title, text }, i) => <article className="lp-reveal relative" style={delay(i)} key={title}><span className="lp-step-icon"><Icon /><span>{i + 1}</span></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{text}</p></article>)}</div></div></section>

    <section id="features" className="lp-section lp-band"><div className="lp-container"><SectionTitle eyebrow="TON NOUVEAU POINT DE REPÈRE" title="Tout ton suivi. Un seul espace." /><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{features.map(({ icon: Icon, title, text }, i) => <article key={title} style={delay(i)} className="lp-reveal lp-card lp-lift p-6"><span className="lp-caption-icon"><Icon /></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></article>)}</div></div></section>

    <section id="previews" className="lp-section"><div className="lp-container"><SectionTitle eyebrow="À L’INTÉRIEUR" title="Moins de chaos. Plus de prochaines actions." /><p className="lp-reveal mt-4 text-center text-sm text-muted-foreground">Aperçus illustratifs avec des contacts d’exemple.</p><div className="mt-12 grid justify-items-center gap-12 md:grid-cols-3">{[
      { view: "followups" as const, title: "N’oublie plus une relance", label: "01 / RELANCES DU JOUR" },
      { view: "prospect" as const, title: "Retrouve tout le contexte", label: "02 / FICHE PROSPECT" },
      { view: "assistant" as const, title: "Écris sans partir de zéro", label: "03 / ASSISTANT IA" },
    ].map(({ view, title, label }, i) => <figure key={view} style={delay(i)} className="lp-reveal min-w-0"><LandingPhone view={view} /><figcaption className="mt-6 text-center"><span className="text-[11px] font-semibold text-info">{label}</span><h3 className="mt-2 text-base font-bold">{title}</h3></figcaption></figure>)}</div></div></section>

    <section id="pricing" className="lp-section lp-band"><div className="lp-container"><SectionTitle eyebrow="DES TARIFS TRANSPARENTS" title="Commence petit. Évolue à ton rythme." /><p className="lp-reveal mt-4 text-center text-sm text-muted-foreground">Sans carte bancaire pour démarrer. Des prix clairs en FCFA.</p><div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan, i) => <article key={plan.name} style={delay(i)} className={`lp-reveal lp-card lp-lift relative flex flex-col p-6 ${plan.popular ? "lp-plan-pro" : ""}`}>{plan.popular && <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Populaire</span>}<h3 className="text-xl font-bold">{plan.name}</h3><p className="mt-2 text-xs text-muted-foreground">{plan.sub}</p><p className="mt-7 whitespace-nowrap text-3xl font-extrabold">{plan.price}</p><p className="mt-2 text-xs text-muted-foreground">par mois · ≈ {plan.usd} $</p><Button asChild variant={plan.popular ? "default" : "outline"} className="lp-button mt-6 w-full"><Link to="/auth">{plan.name === "Gratuit" ? "Commencer gratuitement" : `Choisir ${plan.name}`}</Link></Button><ul className="mb-2 mt-6 space-y-4">{plan.items.map(item => <li key={item} className="flex gap-2 text-sm leading-5 text-muted-foreground"><Check className="size-4 shrink-0 text-info" />{item}</li>)}</ul></article>)}</div></div></section>

    <section id="faq" className="lp-section"><div className="lp-container max-w-3xl"><SectionTitle eyebrow="ON TE RÉPOND" title="Tes questions, simplement." /><Accordion type="single" collapsible className="lp-reveal lp-faq mt-10">{faqs.map(([q, a], i) => <AccordionItem key={q} value={`faq-${i}`}><AccordionTrigger className="min-h-16 gap-4 py-5 text-base font-semibold hover:no-underline">{q}</AccordionTrigger><AccordionPrimitive.Content className="lp-faq-content"><p className="pb-5 text-sm leading-7 text-muted-foreground">{a}</p></AccordionPrimitive.Content></AccordionItem>)}</Accordion></div></section>

    <section className="lp-final relative border-y border-primary/20"><div className="lp-container lp-reveal py-16 text-center"><span className="mx-auto mb-6 grid size-12 place-items-center rounded-lg bg-primary/15 text-info"><CheckCheck /></span><h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">Prends 10 minutes pour organiser ta prospection</h2><p className="mt-5 text-sm text-muted-foreground">Ton prochain échange mérite un peu de clarté.</p><Button asChild className="lp-button mt-7"><Link to="/auth">Commencer gratuitement <ArrowRight /></Link></Button><p className="mt-4 text-xs text-muted-foreground">Gratuit pour démarrer · Sans carte bancaire</p></div></section>

    <footer className="lp-container py-10"><div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_auto]"><Brand /><nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><a className="flex min-h-12 items-center" href="#features">Fonctionnalités</a><a className="flex min-h-12 items-center" href="#pricing">Tarifs</a><a className="flex min-h-12 items-center" href="#faq">FAQ</a><Link className="flex min-h-12 items-center" to="/formation">Formation</Link><Link className="flex min-h-12 items-center" to="/auth">Connexion</Link></nav></div><div className="mt-7 flex flex-col gap-5 border-t border-border pt-7 text-xs leading-6 text-muted-foreground"><a href="mailto:nouridine237@gmail.com" className="flex min-h-12 items-center gap-2 self-start"><Mail className="size-4" />nouridine237@gmail.com</a><p>MLM Boost AI est un outil d'aide à la prospection et à la productivité. Aucun revenu n'est garanti.</p><p>Aucun revenu garanti — outil d'aide à la prospection</p></div></footer>
  </main>;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="lp-reveal text-center"><span className="text-xs font-semibold text-info">{eyebrow}</span><h2 className="mx-auto mt-3 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h2></div>;
}