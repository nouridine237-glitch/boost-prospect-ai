import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { COMPARE_ROWS, formatFcfa, landingCardItems, type CompareCell } from "@/lib/landing-content";
import { captureRefFromUrl } from "@/lib/referral-capture";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowRight, BarChart3, BellRing, BookOpenCheck, Check, CheckCheck, ChevronDown, Clock3, ContactRound, CreditCard, EyeOff, Facebook, GraduationCap, Lock, Mail, Menu, MessageCircle, MessageSquareText, Minus, PenLine, Plus, Send, ShieldCheck, Sparkles, Target, Users, Video, X, LayoutList, Ban, Hourglass } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { LandingPhone } from "@/components/landing-phone";
import { supabase } from "@/integrations/supabase/client";
import workspace from "@/assets/landing-workspace.jpg";
import workspaceWebp from "@/assets/landing-workspace.webp";
import workspaceWebpSm from "@/assets/landing-workspace-768.webp";

const siteUrl = "https://www.mlmboostai.app/";
const shareImage = "https://www.mlmboostai.app/mlm-boost-share.jpg";
const whatsappLink = `https://wa.me/237641313407?text=${encodeURIComponent("Bonjour, j'ai une question sur MLM Boost AI")}`;
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "MLM Boost AI — Construis. Prospecte. Forme. Duplique." },
    { name: "description", content: "Ton activité MLM pilotée depuis un seul espace : assistant IA, suivi des prospects, coach du jour, Académie et formation d'équipe. Tu envoies toi-même chaque message. Gratuit pour démarrer." },
    { property: "og:title", content: "MLM Boost AI — Construis. Prospecte. Forme. Duplique." },
    { property: "og:description", content: "Écris tes messages avec l'IA, suis tes prospects et forme ton équipe. Gratuit pour démarrer, sans carte bancaire. Aucun revenu garanti." },
    { property: "og:type", content: "website" }, { property: "og:url", content: siteUrl },
    { property: "og:image", content: shareImage }, { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:image", content: shareImage },
  ], links: [{ rel: "canonical", href: siteUrl }] }),
  component: Landing,
});

const planSubs: Record<string, string> = { gratuit: "Pour démarrer", pro: "Pour les networkers actifs", expert: "Pour aller plus loin", business: "Pour les leaders d'équipe" };
const plans = PLAN_ORDER.map((k) => ({ key: k, name: PLANS[k].label, price: formatFcfa(PLANS[k].fcfa), usd: String(PLANS[k].usd), sub: planSubs[k], popular: k === "pro", items: landingCardItems(k) }));

const pledges = [
  { icon: Send, text: "Aucun message envoyé à ta place" },
  { icon: Lock, text: "Tes prospects restent privés" },
  { icon: CreditCard, text: "SasPay et Mobile Money" },
  { icon: ShieldCheck, text: "Aucun revenu garanti" },
];
const day = [
  { icon: Plus, title: "Ajoute un prospect", text: "Un nom, un numéro, quelques notes. Son suivi commence ici." },
  { icon: Sparkles, title: "Écris ton message avec l'IA", text: "Donne le contexte. L'IA te propose un message naturel que tu ajustes." },
  { icon: MessageCircle, title: "Envoie-le toi-même sur WhatsApp", text: "L'app ouvre WhatsApp avec le message prêt. Tu relis, tu envoies." },
  { icon: BellRing, title: "Le coach te rappelle qui relancer", text: "Chaque jour, tes relances et tes priorités t'attendent." },
];
const pillars = [
  { icon: PenLine, title: "Écris sans partir de zéro", text: "Assistant IA à 5 modes, 12 scripts, réponses aux objections, trames vocales et simulateur de conversation.", badges: ["Dès Gratuit"] },
  { icon: ContactRound, title: "Ne perds plus un prospect", text: "Fiche, historique, étapes, prochaines relances, écran « À relancer » et suivi de tes campagnes.", badges: ["Dès Gratuit · 10 prospects"] },
  { icon: GraduationCap, title: "Apprends et transmets", text: "Académie MLM, parcours de duplication 7 jours et tes propres formations vidéo.", badges: ["Niveaux 1-2 gratuits", "Complet dès Pro"] },
  { icon: BarChart3, title: "Vois où tu en es", text: "Tableau de bord, objectifs de la semaine, coach du jour, plan d'action 30 jours et statistiques.", badges: ["Plan 30 jours : Pro", "Statistiques : Expert"] },
];
const duplication = [
  { icon: BookOpenCheck, title: "Parcours 7 jours et kits", text: "Un chemin clair pour démarrer tes nouvelles recrues.", badge: "Pro" },
  { icon: Video, title: "Tes formations vidéo", text: "Importe tes vidéos et organise-les en modules et leçons.", badge: "Pro" },
  { icon: GraduationCap, title: "Lien de formation et certificat", text: "Ton équipe suit l'Académie, passe les quiz et obtient son certificat.", badge: "Business" },
  { icon: Users, title: "Partage à ton équipe", text: "Un seul niveau de repartage. L'accès reste acquis une fois l'invitation acceptée.", badge: "Business" },
];
const faqs = [
  ["C'est vraiment gratuit pour démarrer ?", "Oui. Le forfait Gratuit permet de suivre jusqu'à 10 prospects et de générer 5 contenus IA par mois. Aucune carte bancaire n'est demandée. Tu passes à un forfait payant seulement si tu en as besoin."],
  ["Je débute en MLM, c'est pour moi ?", "Oui. Les scripts, les réponses aux objections et l'Académie (niveaux 1 et 2 gratuits) t'aident à démarrer. Le coach du jour te dit simplement qui contacter aujourd'hui."],
  ["Ça marche pour toutes les entreprises MLM et tous les pays ?", "L'outil n'est lié à aucune entreprise : il s'adapte à ton produit et à ton contexte. Des modèles par entreprise existent dès Pro, par exemple pour Longrich. Il est pensé d'abord pour l'Afrique francophone, mais utilisable partout. Vérifie toujours les règles de ton entreprise et le consentement de tes contacts."],
  ["Que se passe-t-il quand j'atteins une limite ?", "L'app te prévient et la fonction concernée s'arrête jusqu'au mois suivant ou jusqu'à un changement de forfait. Tes prospects et ton historique restent accessibles."],
  ["Est-ce que l'app envoie des messages à ma place ?", "Non. L'app prépare le message et ouvre WhatsApp. Tu le relis, tu le valides et tu l'envoies toi-même. Aucun message ni aucune relance ne part automatiquement."],
  ["Est-ce que ça garantit des revenus ?", "Non. MLM Boost AI est un outil d'aide à la prospection et à la productivité, pas une promesse de revenus. Tes résultats dépendent de nombreux facteurs, et aucun gain n'est garanti."],
  ["Mes données sont-elles privées ?", "Oui. Tes prospects, tes notes et tes messages sont liés à ton compte. Les autres utilisateurs, y compris ton leader ou tes membres, ne voient pas ton suivi."],
  ["Comment je paie ?", "Depuis la page Abonnement : en ligne via SasPay (Mobile Money ou carte), ou par Mobile Money manuel (Orange Money, et MTN lorsqu'il est indiqué). Avec le paiement manuel, ton abonnement est activé après vérification, en général sous 24 h."],
  ["Comment je partage mes formations à mon équipe ?", "Avec le forfait Business, tu invites les membres de ton équipe directe. Tu peux autoriser certains d'entre eux à repartager, sur un seul niveau. Une fois l'invitation acceptée, l'accès reste acquis."],
];
const delay = (i: number) => ({ "--lp-delay": `${i * 80}ms` }) as CSSProperties;

function Landing() {
  const navigate = useNavigate();
  const root = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [compare, setCompare] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [pricingInView, setPricingInView] = useState(false);
  useEffect(() => {
    captureRefFromUrl();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onScroll = () => {
      setScrolled(window.scrollY > 16);
      const heroEl = document.getElementById("top");
      const pricingEl = document.getElementById("pricing");
      if (heroEl) setPastHero(heroEl.getBoundingClientRect().bottom <= window.innerHeight * 0.3);
      if (pricingEl) {
        const rect = pricingEl.getBoundingClientRect();
        setPricingInView(rect.top < window.innerHeight && rect.bottom > 0);
      }
    };
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    if (reduced) return () => window.removeEventListener("scroll", onScroll);
    element.classList.add("lp-motion");
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("lp-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.08 });
    element.querySelectorAll(".lp-reveal").forEach(el => observer.observe(el));
    return () => { observer.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, []);

  const navLinks: [string, string][] = [["Plateforme", "#platform"], ["Forfaits", "#pricing"], ["FAQ", "#faq"]];
  const headline = ["Construis.", "Prospecte.", "Forme.", "Duplique."];

  return <main ref={root} className="lp-root min-h-screen overflow-clip bg-background">
    <header className={`lp-nav ${scrolled || menu ? "lp-nav-scrolled" : ""}`}><div className="lp-container grid h-[72px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <a href="#top" aria-label="MLM Boost AI, accueil" className="min-w-0"><Brand /></a>
      <div className="flex shrink-0 items-center gap-2"><nav className="mr-5 hidden items-center gap-7 text-sm text-muted-foreground lg:flex">{navLinks.map(([name, href]) => <a key={href} href={href}>{name}</a>)}<Link to="/auth">Connexion</Link></nav><Button asChild className="lp-button hidden sm:inline-flex"><Link to="/auth" search={{ mode: "signup" }}>Commencer gratuitement <ArrowRight /></Link></Button><Button variant="ghost" size="icon" className="size-12 lg:hidden" aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</Button></div>
    </div>{menu && <nav className="lp-container grid gap-1 border-t border-border pb-4 lg:hidden">{navLinks.map(([name, href]) => <a key={href} href={href} onClick={() => setMenu(false)} className="flex min-h-12 items-center text-base">{name}</a>)}<Link to="/auth" className="flex min-h-12 items-center text-base">Connexion</Link><Button asChild className="lp-button mt-2"><Link to="/auth" search={{ mode: "signup" }}>Commencer gratuitement</Link></Button></nav>}</header>

    <section id="top" className="lp-hero relative isolate">
      <picture><source type="image/webp" srcSet={`${workspaceWebpSm} 768w, ${workspaceWebp} 1536w`} sizes="100vw" /><img src={workspace} alt="" width={1536} height={1024} fetchPriority="high" decoding="async" className="lp-hero-photo" /></picture>
      <div className="lp-ambient" aria-hidden="true" />
      <div className="lp-container relative grid items-center gap-10 pt-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:pt-32">
        <div className="text-center lg:text-left">
          <div className="lp-hero-intro mb-5 inline-flex items-center gap-2 rounded-full border border-info/30 bg-info/10 px-3 py-1.5 text-xs font-semibold text-info"><Sparkles className="size-4" />Assistant IA · Suivi · Formation</div>
          <h1 className="lp-headline">{headline.map((word, i) => <Fragment key={word}><span className={`lp-hw ${i === 3 ? "lp-hw-accent" : ""}`} style={{ "--lp-delay": `${i * 90}ms` } as CSSProperties}>{word}</span>{i === 1 ? <br className="lp-hw-break" /> : " "}</Fragment>)}</h1>
          <p className="lp-hero-sub mt-5 text-lg font-semibold sm:text-xl">Ton activité MLM, pilotée depuis un seul espace.</p>
          <p className="lp-hero-sub mx-auto mt-3 max-w-xl text-base leading-7 text-muted-foreground lg:mx-0">Écris tes messages avec l'IA, suis tes prospects, forme ton équipe. Tu envoies toi-même chaque message.</p>
          <div className="lp-hero-actions mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"><Button asChild className="lp-button lp-primary-cta w-full sm:w-auto"><Link to="/auth" search={{ mode: "signup" }}>Commencer gratuitement <ArrowRight /></Link></Button><Button asChild variant="outline" className="lp-button w-full bg-background/60 sm:w-auto"><a href="#platform">Découvrir la plateforme <ArrowDown /></a></Button></div>
          <p className="lp-hero-actions mt-4 text-sm text-muted-foreground">Gratuit pour démarrer · Sans carte bancaire</p>
        </div>
        <figure className="lp-hero-demo mx-auto"><div className="lp-float"><LandingPhone compact /></div><figcaption className="mt-4 text-center text-xs text-muted-foreground">Aperçu illustratif · contacts fictifs</figcaption></figure>
      </div>
      <div className="lp-container relative mt-12"><ul className="lp-reveal lp-pledges">{pledges.map(({ icon: Icon, text }) => <li key={text}><Icon className="size-5 shrink-0 text-info" /><span>{text}</span></li>)}</ul></div>
    </section>

    <section className="lp-section"><div className="lp-container"><SectionTitle eyebrow="ÇA TE PARLE ?" title="La prospection ne devrait pas te disperser." /><div className="mt-10 grid gap-4 md:grid-cols-3">{[
      { icon: Clock3, title: "Tu perds des prospects par oubli", text: "Un message oublié, une relance trop tard… et la conversation s'arrête." },
      { icon: MessageSquareText, title: "Tu ne sais jamais quoi écrire", text: "Tu passes plus de temps à chercher tes mots qu'à échanger." },
      { icon: LayoutList, title: "Tu n'as aucune vision claire", text: "Des contacts partout, sans savoir qui relancer ni où tu en es." },
    ].map(({ icon: Icon, title, text }, i) => <article key={title} style={delay(i)} className="lp-reveal lp-card p-6"><Icon className="size-6 text-info" /><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 text-base leading-7 text-muted-foreground">{text}</p></article>)}</div></div></section>

    <section id="how" className="lp-section lp-band"><div className="lp-container"><SectionTitle eyebrow="TA JOURNÉE" title="Quatre gestes. Une routine plus simple." /><div className="lp-reveal lp-steps mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">{day.map(({ icon: Icon, title, text }, i) => <article className="lp-reveal relative" style={delay(i)} key={title}><span className="lp-step-icon"><Icon /><span>{i + 1}</span></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 max-w-sm text-base leading-7 text-muted-foreground">{text}</p></article>)}</div></div></section>

    <section id="platform" className="lp-section"><div className="lp-container"><SectionTitle eyebrow="LA PLATEFORME" title="Quatre piliers pour faire avancer ton activité." /><p className="lp-reveal mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground">Chaque pilier indique à partir de quel forfait il est disponible.</p><div className="lp-carousel mt-10" role="list">{pillars.map(({ icon: Icon, title, text, badges }, i) => <article role="listitem" key={title} style={delay(i)} className="lp-reveal lp-card lp-lift flex flex-col p-6"><span className="lp-caption-icon"><Icon /></span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 flex-1 text-base leading-7 text-muted-foreground">{text}</p><div className="mt-5 flex flex-wrap gap-2">{badges.map(b => <span key={b} className="lp-pill">{b}</span>)}</div></article>)}</div><p className="mt-3 text-center text-xs text-muted-foreground md:hidden">Fais glisser pour voir les 4 piliers</p></div></section>

    <section id="coach" className="lp-section lp-band lp-deferred"><div className="lp-container grid items-center gap-10 lg:grid-cols-2">
      <div className="lp-reveal"><span className="text-xs font-semibold text-info">COACH DU JOUR</span><h2 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">Chaque matin, tes priorités.</h2><p className="mt-5 text-base leading-7 text-muted-foreground">Le coach classe tes missions selon les relances en retard, les contacts jamais joints et l'intérêt de chaque prospect. Tu choisis 3, 5 ou 8 missions par jour et tes jours de repos.</p><ul className="mt-6 space-y-3 text-base">{["Séries de jours actifs et bilan de la semaine", "Conseil IA seulement quand tu le demandes", "Tu valides chaque action toi-même"].map(t => <li key={t} className="flex gap-3"><Check className="mt-1 size-5 shrink-0 text-info" />{t}</li>)}</ul></div>
      <figure className="lp-reveal" style={delay(1)}><div className="lp-card lp-coach p-5 sm:p-6"><div className="flex items-center justify-between"><span className="flex items-center gap-2 font-bold"><Target className="size-5 text-info" />Tes missions du jour</span><span className="lp-pill">1 / 3</span></div><ul className="mt-5 space-y-3">{[
        { name: "Amina", reason: "Relance prévue il y a 2 jours", tag: "Priorité haute", done: true },
        { name: "Yannick", reason: "Prospect chaud, sans contact depuis 4 jours", tag: "Priorité haute", done: false },
        { name: "Grâce", reason: "Jamais contacté", tag: "À démarrer", done: false },
      ].map(m => <li key={m.name} className={`lp-mission ${m.done ? "lp-mission-done" : ""}`}><span className="lp-mission-check">{m.done && <Check className="size-4" />}</span><div className="min-w-0 flex-1"><p className="font-semibold">{m.name}</p><p className="mt-0.5 text-sm text-muted-foreground">{m.reason}</p></div><span className="hidden text-xs text-info sm:inline">{m.tag}</span></li>)}</ul></div><figcaption className="mt-3 text-center text-xs text-muted-foreground">Exemple illustratif · contacts fictifs</figcaption></figure>
    </div></section>

    <section id="duplication" className="lp-section lp-deferred"><div className="lp-container"><SectionTitle eyebrow="FORMATION ET DUPLICATION" title="Transmets ce qui marche, sans perdre la main." /><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{duplication.map(({ icon: Icon, title, text, badge }, i) => <article key={title} style={delay(i)} className="lp-reveal lp-card p-6"><div className="flex items-start justify-between gap-3"><span className="lp-caption-icon"><Icon /></span><span className="lp-pill">Dès {badge}</span></div><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 text-base leading-7 text-muted-foreground">{text}</p></article>)}</div><p className="lp-reveal mx-auto mt-8 flex max-w-xl items-center justify-center gap-2 text-center text-base font-semibold"><EyeOff className="size-5 shrink-0 text-info" />Tu ne vois pas les prospects de tes membres.</p></div></section>

    <section id="transparency" className="lp-section lp-band lp-deferred"><div className="lp-container"><SectionTitle eyebrow="EN TOUTE TRANSPARENCE" title="Ce que l'outil fait, et ce qu'il ne fait pas." /><div className="mt-10 grid gap-4 md:grid-cols-2">
      <article className="lp-reveal lp-card p-6"><h3 className="flex items-center gap-2 text-lg font-bold"><Ban className="size-5 text-info" />Ce que MLM Boost AI ne fait pas</h3><ul className="mt-5 space-y-3 text-base text-muted-foreground">{["Aucun message ni aucune relance envoyés automatiquement", "Aucune promesse de gains ou de revenus", "Aucun accès aux prospects et notes de ton équipe", "Aucun faux avis ni chiffre inventé sur cette page"].map(t => <li key={t} className="flex gap-3"><Minus className="mt-1 size-4 shrink-0" />{t}</li>)}</ul></article>
      <article className="lp-reveal lp-card p-6" style={delay(1)}><h3 className="flex items-center gap-2 text-lg font-bold"><Hourglass className="size-5 text-info" />Bientôt, pas encore disponible</h3><ul className="mt-5 space-y-3 text-base text-muted-foreground"><li className="flex gap-3"><span className="lp-pill">Bientôt</span>Rapports hebdomadaires (Expert)</li><li className="flex gap-3"><span className="lp-pill">Bientôt</span>WhatsApp Business (Business)</li></ul><p className="mt-5 text-sm leading-6 text-muted-foreground">Ces fonctions ne sont pas incluses aujourd'hui. Elles apparaîtront ici quand elles seront prêtes.</p></article>
    </div></div></section>

    <section id="founder" className="lp-section lp-deferred"><div className="lp-container max-w-3xl"><SectionTitle eyebrow="DERRIÈRE L'OUTIL" title="Qui est derrière MLM Boost AI ?" /><div className="lp-reveal lp-card mt-10 flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:gap-7 sm:p-8 sm:text-left"><span aria-hidden="true" className="lp-founder-photo">N</span><div className="min-w-0"><h3 className="text-lg font-bold">Nouridine, Nkongsamba (Cameroun)</h3><p className="mt-3 text-base leading-7 text-muted-foreground">MLM Boost AI vient tout juste de naître. Pas d'ancienneté, pas de chiffres à te vendre : c'est un jeune outil, construit au grand jour.</p><p className="mt-2 text-base leading-7 text-muted-foreground">Il se construit avec les retours des premiers utilisateurs, une suggestion après l'autre, pour rester simple et honnête.</p></div></div></div></section>

    <section id="pricing" className="lp-section lp-band"><div className="lp-container"><SectionTitle eyebrow="FORFAITS" title="Commence petit. Évolue à ton rythme." /><p className="lp-reveal mt-4 text-center text-base text-muted-foreground">Sans carte bancaire pour démarrer. Des prix clairs en FCFA, par mois.</p><div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan, i) => <article key={plan.key} style={delay(i)} className={`lp-reveal lp-card lp-lift relative flex flex-col p-6 ${plan.popular ? "lp-plan-pro" : ""}`}>{plan.popular && <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Populaire</span>}<h3 className="text-xl font-bold">{plan.name}</h3><p className="mt-2 text-sm text-muted-foreground">{plan.sub}</p><p className="mt-6 whitespace-nowrap text-3xl font-extrabold">{plan.price}</p><p className="mt-2 text-sm text-muted-foreground">par mois · ≈ {plan.usd} $</p><Button asChild variant={plan.popular ? "default" : "outline"} className="lp-button mt-6 w-full"><Link to="/auth" search={plan.key === "gratuit" ? { mode: "signup" } : { mode: "signup", next: "/abonnement" }}>{plan.key === "gratuit" ? "Commencer gratuitement" : `Choisir ${plan.name}`}</Link></Button><ul className="mb-2 mt-6 space-y-3">{plan.items.map(item => <li key={item.text} className="flex gap-2 text-sm leading-6 text-muted-foreground"><Check className="mt-0.5 size-4 shrink-0 text-info" /><span>{item.text}{item.soon && <span className="lp-pill ml-1.5">Bientôt</span>}</span></li>)}</ul></article>)}</div>
      <div className="mt-8 text-center"><Button variant="outline" className="lp-button bg-background/60" aria-expanded={compare} aria-controls="compare-table" onClick={() => setCompare(!compare)}>{compare ? "Masquer la comparaison" : "Comparer les forfaits"}<ChevronDown className={`transition-transform ${compare ? "rotate-180" : ""}`} /></Button></div>
      {compare && <p className="mt-6 text-center text-xs text-muted-foreground md:hidden">Fais glisser le tableau pour voir les 4 forfaits</p>}{compare && <div id="compare-table" className="lp-compare mt-3 md:mt-6"><table><caption className="sr-only">Comparaison des forfaits</caption><thead><tr><th scope="col">Fonction</th>{plans.map(p => <th scope="col" key={p.key} className={p.popular ? "lp-compare-pro" : ""}>{p.name}</th>)}</tr></thead><tbody>{COMPARE_ROWS.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{row.cells.map((c, i) => <td key={i} className={plans[i]?.popular ? "lp-compare-pro" : ""}><Cell value={c} /></td>)}</tr>)}</tbody></table></div>}
      <p className="lp-reveal mx-auto mt-8 max-w-2xl text-center text-sm leading-6 text-muted-foreground">Paiement en ligne via SasPay ou par Mobile Money. Avec le Mobile Money manuel, l'abonnement est activé après vérification, en général sous 24 h.</p></div></section>

    <section id="faq" className="lp-section lp-deferred"><div className="lp-container max-w-3xl"><SectionTitle eyebrow="ON TE RÉPOND" title="Tes questions, simplement." /><Accordion type="single" collapsible className="lp-reveal lp-faq mt-10">{faqs.map(([q, a], i) => <AccordionItem key={q} value={`faq-${i}`}><AccordionTrigger className="min-h-16 gap-4 py-5 text-left text-base font-semibold hover:no-underline">{q}</AccordionTrigger><AccordionPrimitive.Content className="lp-faq-content"><p className="pb-5 text-base leading-7 text-muted-foreground">{a}</p></AccordionPrimitive.Content></AccordionItem>)}</Accordion></div></section>

    <section className="lp-final relative border-y border-primary/20"><div className="lp-container lp-reveal py-16 text-center"><span className="mx-auto mb-6 grid size-12 place-items-center rounded-lg bg-primary/15 text-info"><CheckCheck /></span><h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">Prends 10 minutes pour organiser ta prospection.</h2><p className="mt-5 text-base text-muted-foreground">Ton prochain échange mérite un peu de clarté.</p><div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"><Button asChild className="lp-button w-full sm:w-auto"><Link to="/auth" search={{ mode: "signup" }}>Commencer gratuitement <ArrowRight /></Link></Button><Button asChild variant="outline" className="lp-button w-full bg-background/60 sm:w-auto"><a href="#pricing">Découvrir les forfaits</a></Button></div><p className="mt-4 text-sm text-muted-foreground">Gratuit pour démarrer · Sans carte bancaire</p></div></section>

    <footer className="lp-container py-10"><div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_auto]"><Brand /><nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><a className="flex min-h-12 items-center" href="#platform">Plateforme</a><a className="flex min-h-12 items-center" href="#pricing">Forfaits</a><a className="flex min-h-12 items-center" href="#faq">FAQ</a><Link className="flex min-h-12 items-center" to="/formation">Formation</Link><Link className="flex min-h-12 items-center" to="/auth">Connexion</Link><a className="flex min-h-12 items-center gap-2" href="https://www.facebook.com/profile.php?id=61595200864491" target="_blank" rel="noopener noreferrer"><Facebook className="size-4" />Facebook</a></nav></div><div className="mt-7 flex flex-col gap-5 border-t border-border pt-7 text-xs leading-6 text-muted-foreground"><a href="mailto:nouridine237@gmail.com" className="flex min-h-12 items-center gap-2 self-start"><Mail className="size-4" />nouridine237@gmail.com</a><p>MLM Boost AI est un outil d'aide à la prospection et à la productivité. Aucun revenu n'est garanti.</p></div></footer>
    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" aria-label="Écrire sur WhatsApp" className={`lp-wa-fab ${pastHero && !pricingInView ? "lp-wa-raised" : ""}`}><MessageCircle /></a>
    <div className={`lp-cta-bar md:hidden ${pastHero && !pricingInView ? "lp-cta-visible" : ""}`} aria-hidden={!pastHero || pricingInView}><div className="lp-container lp-cta-inner"><Button asChild className="lp-button lp-primary-cta w-full"><Link to="/auth" search={{ mode: "signup" }} tabIndex={pastHero && !pricingInView ? 0 : -1}>Commencer gratuitement</Link></Button></div></div>
  </main>;
}

function Cell({ value }: { value: CompareCell }): ReactNode {
  if (value === "soon") return <span className="lp-pill">Bientôt</span>;
  if (value === true) return <><Check className="mx-auto size-4 text-info" aria-hidden="true" /><span className="sr-only">Inclus</span></>;
  if (value === false) return <><Minus className="mx-auto size-4 text-muted-foreground/60" aria-hidden="true" /><span className="sr-only">Non inclus</span></>;
  return <span className="font-semibold">{value}</span>;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="lp-reveal text-center"><span className="text-xs font-semibold text-info">{eyebrow}</span><h2 className="mx-auto mt-3 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h2></div>;
}
