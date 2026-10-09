import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, FileText, Pencil, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scriptsOptions } from "@/lib/scripts";
import { saveScript, scriptCategories } from "@/lib/scripts.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/scripts")({
  head: () => ({ meta: [
    { title: "Scripts de prospection — MLM Boost AI" },
    { name: "description", content: "12 modèles en français pour le premier contact, les relances, les objections et le suivi d’équipe." },
    { property: "og:title", content: "Scripts de prospection — MLM Boost AI" },
    { property: "og:description", content: "Votre bibliothèque de messages de prospection éthiques, prêts à personnaliser." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(scriptsOptions(context.user.id)),
  component: ScriptsPage,
});

function ScriptsPage() {
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQuery(scriptsOptions(user.id));
  const [category, setCategory] = useState("Tous");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Tables<"scripts"> | null>(null);
  const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const shown = data.scripts.filter(s => (category === "Tous" || s.category === category) && normalized(`${s.title} ${s.category} ${s.content}`).includes(normalized(query.trim())));
  return <AppShell user={user} title="Scripts">
    <div className="mx-auto max-w-6xl p-5 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><span className="eyebrow">Bibliothèque</span><h1 className="mt-2 text-3xl font-extrabold">Scripts</h1></div>
        <span className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground"><FileText className="size-4 text-primary" />{data.scripts.length} modèles</span>
      </div>
      <label className="relative mt-6 block max-w-lg"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input aria-label="Rechercher un script" placeholder="Rechercher un script…" value={query} onChange={e => setQuery(e.target.value)} className="h-11 pl-10" /></label>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Catégories de scripts">{["Tous", ...scriptCategories].map(c => <Button key={c} variant={category === c ? "default" : "outline"} aria-pressed={category === c} onClick={() => setCategory(c)} className="min-h-11 rounded-full px-4 text-xs">{c}</Button>)}</div>
      <p className="mt-5 text-xs text-muted-foreground">{shown.length} script{shown.length > 1 ? "s" : ""}</p>
      <div className="mt-3 grid items-stretch gap-4 md:grid-cols-2">{shown.map(s => <ScriptCard key={s.id} script={s} onEdit={data.isAdmin ? () => setEditing(s) : undefined} />)}</div>
      {!shown.length && <div className="py-16 text-center"><Search className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">Aucun script trouvé</h2><Button variant="ghost" className="mt-3 min-h-11" onClick={() => { setQuery(""); setCategory("Tous"); }}>Réinitialiser les filtres</Button></div>}
      {editing && <ScriptEditor key={editing.id} script={editing} userId={user.id} onClose={() => setEditing(null)} />}
      <p className="mt-8 text-center text-xs text-muted-foreground">Aucun revenu garanti — outil d'aide à la prospection</p>
    </div>
  </AppShell>;
}

function ScriptCard({ script: s, onEdit }: { script: Tables<"scripts">; onEdit?: (() => void) | undefined }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(s.content); setCopied(true); toast.success("Script copié"); }
    catch { toast.error("La copie a échoué. Sélectionnez le texte pour le copier."); }
  }
  return <article className="surface flex min-w-0 flex-col rounded-lg p-5">
    <div className="flex items-start justify-between gap-3"><div><span className="text-xs font-semibold text-primary">{s.category}</span><h2 className="mt-2 text-base font-bold">{s.title}</h2></div>{onEdit && <Button variant="ghost" size="icon" className="size-11 shrink-0" title="Modifier le script" aria-label={`Modifier ${s.title}`} onClick={onEdit}><Pencil /></Button>}</div>
    <p className="mb-5 mt-4 flex-1 whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">{s.content}</p>
    <div className="flex flex-wrap gap-2 border-t border-border pt-4"><Button variant="outline" className="min-h-11" onClick={copy}>{copied ? <Check /> : <Copy />}Copier</Button><Button asChild className="min-h-11 whitespace-normal text-left"><Link to="/assistant" search={{ script: s.id }}><Sparkles />Personnaliser avec l’IA</Link></Button></div>
  </article>;
}

function ScriptEditor({ script, userId, onClose }: { script: Tables<"scripts">; userId: string; onClose: () => void }) {
  const save = useServerFn(saveScript);
  const client = useQueryClient();
  const [title, setTitle] = useState(script.title);
  const [category, setCategory] = useState(script.category);
  const [content, setContent] = useState(script.content);
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const validCategory = scriptCategories.find(c => c === category);
      if (!validCategory) throw new Error("Choisissez une catégorie.");
      await save({ data: { id: script.id, title, category: validCategory, content } });
      await client.invalidateQueries({ queryKey: scriptsOptions(userId).queryKey });
      toast.success("Script enregistré"); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Modifier le script</DialogTitle></DialogHeader><form onSubmit={submit} className="grid gap-4">
    <label className="grid gap-2 text-sm">Titre<Input value={title} onChange={e => setTitle(e.target.value)} required maxLength={160} /></label>
    <label className="grid gap-2 text-sm">Catégorie<select className="h-11 rounded-md border border-input bg-background px-3" value={category} onChange={e => setCategory(e.target.value)}>{scriptCategories.map(c => <option key={c}>{c}</option>)}</select></label>
    <label className="grid gap-2 text-sm">Texte<Textarea className="min-h-56" value={content} onChange={e => setContent(e.target.value)} required maxLength={3000} /></label>
    <Button className="min-h-11" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
  </form></DialogContent></Dialog>;
}