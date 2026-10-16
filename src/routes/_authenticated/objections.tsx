import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, MessageCircle, Search, ShieldQuestion, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fullAnswer, objectionCategories, objections, type Objection } from "@/lib/objections";

export const Route = createFileRoute("/_authenticated/objections")({
  head: () => ({ meta: [
    { title: "Gestionnaire d'objections — MLM Boost AI" },
    { name: "description", content: "Réponses éthiques en 3 temps aux objections les plus fréquentes des prospects." },
    { property: "og:title", content: "Gestionnaire d'objections — MLM Boost AI" },
    { property: "og:description", content: "Empathie, recadrage, question : répondez sereinement à chaque objection." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ObjectionsPage,
});

const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function ObjectionsPage() {
  const { user } = Route.useRouteContext();
  const [category, setCategory] = useState("Toutes");
  const [query, setQuery] = useState("");
  const shown = objections.filter(o => (category === "Toutes" || o.category === category) && norm(`${o.objection} ${o.meaning} ${o.short}`).includes(norm(query.trim())));
  return <AppShell user={user} title="Objections">
    <div className="mx-auto max-w-6xl p-5 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><span className="eyebrow">Terrain</span><h1 className="mt-2 text-3xl font-extrabold">Gestionnaire d'objections</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Chaque réponse suit 3 temps : empathie, recadrage, question ouverte. Jamais de pression, jamais de promesse de revenu.</p></div>
        <span className="hidden items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground sm:flex"><ShieldQuestion className="size-4 text-primary" />{objections.length} objections</span>
      </div>
      <label className="relative mt-6 block max-w-lg"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input aria-label="Rechercher une objection" placeholder="Ex. : arnaque, argent, temps…" value={query} onChange={e => setQuery(e.target.value)} className="h-11 pl-10" /></label>
      <div className="mt-4 flex flex-wrap gap-2">{["Toutes", ...objectionCategories].map(c => <Button key={c} variant={category === c ? "default" : "outline"} aria-pressed={category === c} onClick={() => setCategory(c)} className="min-h-11 rounded-full px-4 text-xs">{c}</Button>)}</div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">{shown.map(o => <ObjectionCard key={o.id} o={o} />)}</div>
      {!shown.length && <div className="py-16 text-center"><h2 className="font-semibold">Aucune objection trouvée</h2><Button variant="ghost" className="mt-3 min-h-11" onClick={() => { setQuery(""); setCategory("Toutes"); }}>Réinitialiser</Button></div>}
      <p className="mt-8 text-center text-xs text-muted-foreground">Aucun revenu garanti — outil d'aide à la prospection</p>
    </div>
  </AppShell>;
}

function ObjectionCard({ o }: { o: Objection }) {
  const [version, setVersion] = useState<"short" | "full">("short");
  const [copied, setCopied] = useState(false);
  const text = version === "short" ? o.short : fullAnswer(o);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); toast.success("Réponse copiée"); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("La copie a échoué."); }
  }
  const aiContext = `Mon prospect m'a dit : « ${o.objection} »\nAide-moi à lui répondre avec empathie, un recadrage honnête et une question ouverte, sans pression ni promesse de revenu.\nBase : ${o.short}`;
  return <article className="surface flex min-w-0 flex-col rounded-lg p-5">
    <span className="text-xs font-semibold text-primary">{o.category}</span>
    <h2 className="mt-2 text-base font-bold">« {o.objection} »</h2>
    <p className="mt-2 text-xs text-muted-foreground"><strong className="text-foreground">Ce que ça veut dire :</strong> {o.meaning}</p>
    <ol className="mt-4 space-y-3 text-sm leading-6">
      <li><span className="text-xs font-bold text-primary">1. Empathie</span><p className="text-muted-foreground">{o.empathy}</p></li>
      <li><span className="text-xs font-bold text-primary">2. Recadrage</span><p className="text-muted-foreground">{o.reframe}</p></li>
      <li><span className="text-xs font-bold text-primary">3. Question</span><p className="text-muted-foreground">{o.question}</p></li>
    </ol>
    <div className="mt-4 flex gap-2">
      <Button size="sm" variant={version === "short" ? "default" : "outline"} className="min-h-9 rounded-full text-xs" onClick={() => setVersion("short")}>Message WhatsApp</Button>
      <Button size="sm" variant={version === "full" ? "default" : "outline"} className="min-h-9 rounded-full text-xs" onClick={() => setVersion("full")}>Version conversation</Button>
    </div>
    <p className="mt-3 flex-1 whitespace-pre-line rounded-md bg-secondary p-3 text-sm leading-6">{text}</p>
    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
      <Button variant="outline" className="min-h-11" onClick={copy}>{copied ? <Check /> : <Copy />}Copier</Button>
      <Button variant="outline" className="min-h-11" asChild><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle />WhatsApp</a></Button>
      <Button className="min-h-11" asChild><Link to="/assistant" search={{ context: aiContext }}><Sparkles />Adapter avec l'IA</Link></Button>
    </div>
  </article>;
}
