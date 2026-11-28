import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, History, Loader2, RefreshCw, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getUrlAnalysis, listUrlAnalyses, listAnalysisRevisions, saveAnalysisNotes } from "@/lib/ad-studio.functions";
import { AnalysisReportView } from "./analysis-report";

export function UrlAnalyzerPanel() {
  const list = useServerFn(listUrlAnalyses);
  const detail = useServerFn(getUrlAnalysis);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const history = useQuery({ queryKey: ["ad-studio", "analyses"], queryFn: () => list(), retry: false });
  const analysis = useQuery({ queryKey: ["ad-studio", "analysis", selected], queryFn: () => selected ? detail({ data: { id: selected } }) : null, enabled: selected !== null, retry: false });
  const statuses: Record<string, string> = { en_cours: "En cours · état enregistré", termine: "Terminé", echec: "Erreur" };
  const rows = (history.data?.rows ?? []).filter((row) => row.url.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || row.status === filter));

  if (selected) return <div className="space-y-5">
    <Button variant="ghost" onClick={() => setSelected(null)}><ArrowLeft />Historique</Button>
    {analysis.isPending && <p className="text-sm text-muted-foreground">Chargement du rapport…</p>}
    {analysis.error && <p role="alert" className="text-sm text-destructive">{analysis.error.message}</p>}
    {analysis.data && !analysis.data.row && <p className="text-sm text-muted-foreground">Analyse introuvable.</p>}
    {analysis.data?.row && <>
      <div className="border-b border-border pb-4"><h2 className="break-all text-lg font-semibold">{analysis.data.row.url}</h2><p className="mt-1 text-xs text-muted-foreground">{statuses[analysis.data.row.status]}</p></div>
      {analysis.data.row.error && <p role="alert" className="text-sm text-destructive">{analysis.data.row.error}</p>}
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        {analysis.data.row.report ? <AnalysisReportView report={analysis.data.row.report} /> : <p className="text-sm text-muted-foreground">Aucun rapport enregistré. Aucune analyse n'est simulée.</p>}
        <AnalysisNotes key={selected} id={selected} initialNotes={analysis.data.row.admin_notes} initialVersion={analysis.data.row.edit_version} />
      </div>
    </>}
  </div>;

  return <div className="space-y-6">
    <section className="border-b border-border pb-6">
      <h2 className="text-xl font-semibold">URL Analyzer</h2>
      <label htmlFor="studio-url" className="mt-5 block text-sm font-medium">Adresse publique</label>
      <Input id="studio-url" type="url" defaultValue="https://mlmboostai.app" disabled className="mt-2 h-11" />
      <Button className="mt-3 h-11" disabled>Analyse temporairement indisponible</Button>
      <p className="mt-4 flex items-start gap-2 text-sm text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>Firecrawl est connecté. Les garanties de sécurité des destinations et redirections restent à vérifier. Aucun appel facturé n'est lancé.</span></p>
    </section>
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><History className="size-4" />Analyses précédentes</h3><Button variant="ghost" size="icon" title="Actualiser l'historique" aria-label="Actualiser l'historique" onClick={() => history.refetch()} disabled={history.isFetching}><RefreshCw className={history.isFetching ? "animate-spin" : ""} /></Button></div>
      <div className="mt-4 flex flex-wrap gap-3"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Rechercher une analyse" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une URL" className="h-11 pl-9" /></div><select aria-label="Filtrer l'état" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 max-w-full rounded-md border border-input bg-background px-3 text-sm"><option value="all">Tous les états</option><option value="termine">Terminé</option><option value="en_cours">En cours</option><option value="echec">Erreur</option></select></div>
      {history.isPending && <p className="mt-5 text-sm text-muted-foreground">Chargement de l'historique…</p>}
      {history.error && <p role="alert" className="mt-5 text-sm text-destructive">{history.error.message}</p>}
      {!history.isPending && !history.error && rows.length === 0 && <p className="py-10 text-sm text-muted-foreground">{search || filter !== "all" ? "Aucun résultat pour ces filtres." : "Aucune analyse enregistrée."}</p>}
      <div className="mt-4 divide-y divide-border">{rows.map((row) => <Button key={row.id} variant="ghost" className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none py-4 text-left" onClick={() => setSelected(row.id)}><span className="min-w-0"><span className="block truncate text-sm">{row.url}</span><span className="mt-1 block text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("fr-FR")}</span></span><span className="shrink-0 text-xs text-muted-foreground">{statuses[row.status]}</span></Button>)}</div>
    </section>
  </div>;
}

function AnalysisNotes({ id, initialNotes, initialVersion }: { id: string; initialNotes: string; initialVersion: number }) {
  const save = useServerFn(saveAnalysisNotes);
  const list = useServerFn(listAnalysisRevisions);
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(initialNotes);
  const [version, setVersion] = useState(initialVersion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ notes: string; version: number } | null>(null);
  const revisions = useQuery({ queryKey: ["ad-studio", "versions", id], queryFn: () => list({ data: { id } }), retry: false });
  async function persist(text: string) {
    setBusy(true); setError("");
    try {
      const result = await save({ data: { id, notes: text, version } });
      setVersion(result.version); setSaved(text); await revisions.refetch();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Notes non enregistrées."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (notes === saved || busy || error || preview) return;
    const timeout = setTimeout(() => { void persist(notes); }, 1200);
    return () => clearTimeout(timeout);
  }, [notes, saved, busy, error, preview]);
  return <section className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
    <h2 className="text-lg font-semibold">Fiche stratégique · notes admin</h2>
    <p className="text-xs text-muted-foreground">Corrections, cible, arguments et positionnement validés. Le rapport source reste inchangé.</p>
    <Textarea aria-label="Notes stratégiques" value={notes} maxLength={12000} onChange={(event) => { setNotes(event.target.value); }} className="min-h-64" />
    <div className="flex flex-wrap items-center gap-3"><Button onClick={() => persist(notes)} disabled={busy || notes === saved}><Save />Enregistrer</Button><span role="status" className="text-xs text-muted-foreground">{busy ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" />Enregistrement…</span> : notes !== saved ? "Modifications non enregistrées" : `Enregistré · version ${version}`}</span></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="border-t border-border pt-4"><h3 className="text-sm font-semibold">Versions des notes</h3>
      {revisions.error && <p className="mt-2 text-sm text-destructive">{revisions.error.message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{revisions.data?.rows.map((revision) => <Button key={revision.id} variant="outline" size="sm" onClick={() => setPreview(revision)}>Voir v{revision.version}</Button>)}</div>
      {revisions.data?.rows.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Les versions apparaîtront après la première modification.</p>}
      {preview && <section className="mt-4 border-l-2 border-primary pl-4"><h4 className="text-sm font-semibold">Aperçu · version {preview.version}</h4><p className="my-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{preview.notes || "Notes vides"}</p><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => { const text = preview.notes; setNotes(text); setPreview(null); void persist(text); }} disabled={busy}>Restaurer cette version</Button><Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Fermer</Button></div></section>}
    </div>
  </section>;
}