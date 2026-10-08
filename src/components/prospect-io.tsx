import { useMemo, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Crm, Prospect, Status } from "@/components/crm";

const STATUS_LABELS: Record<string, string> = { nouveau: "Nouveau", "contacté": "Contacté", discussion: "Discussion", "intéressé": "Intéressé", client: "Client", "non_intéressé": "Non intéressé" };
export const SOURCES = ["Facebook", "WhatsApp", "Marché chaud", "Recommandation", "Autre"];
const INTEREST: Record<number, string> = { 3: "Chaud", 2: "Tiède", 1: "Froid" };
const IMPORT_CAP: Record<string, number> = { gratuit: 50, pro: 500 };

export type ImportRow = { name: string; phone: string; source: string; notes: string };
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim()));
}

function toRows(text: string): ImportRow[] {
  const [head, ...body] = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!head) return [];
  const h = head.map(norm);
  const idx = (...keys: string[]) => h.findIndex(x => keys.includes(x));
  const iN = idx("nom", "name"), iP = idx("telephone", "tel", "phone", "numero"), iS = idx("source"), iNo = idx("notes", "note");
  return body.map(r => ({ name: (r[iN < 0 ? 0 : iN] ?? "").trim(), phone: (iP >= 0 ? r[iP] ?? "" : "").trim(), source: (iS >= 0 ? r[iS] ?? "" : "").trim(), notes: (iNo >= 0 ? r[iNo] ?? "" : "").trim() }));
}

function csvCell(v: unknown) { const s = String(v ?? ""); return /[",;\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }

export function exportProspects(prospects: Prospect[]) {
  const header = ["nom", "téléphone", "statut", "source", "niveau d'intérêt", "produit d'intérêt", "objection principale", "premier contact", "prochaine relance", "notes", "ajouté le"];
  const lines = prospects.map(p => [p.name, p.phone, STATUS_LABELS[p.status] ?? p.status, p.source, p.interest_level ? INTEREST[p.interest_level] : "", p.product_interest, p.main_objection, p.first_contact_at, p.next_followup_date, p.notes, p.created_at.slice(0, 10)].map(csvCell).join(","));
  const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  toast.success(`${prospects.length} prospects exportés`);
}

export function ImportExportButtons({ crm }: { crm: Crm }) {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const cap = IMPORT_CAP[crm.limits.plan] ?? -1;

  const preview = useMemo(() => {
    if (!rows) return [];
    const seen = new Set(crm.prospects.map(p => digits(p.phone)).filter(Boolean));
    let room = cap < 0 ? Infinity : Math.max(0, cap - crm.prospects.length);
    return rows.map(r => {
      const d = digits(r.phone);
      if (!r.name) return { ...r, reason: "Nom manquant" };
      if (d && seen.has(d)) return { ...r, reason: "Doublon (numéro)" };
      if (room <= 0) return { ...r, reason: "Limite du plan" };
      if (d) seen.add(d); room--;
      return { ...r, reason: "" };
    });
  }, [rows, crm.prospects, cap]);
  const valid = preview.filter(r => !r.reason);

  async function onFile(f: File | undefined) {
    if (!f) return;
    const parsed = toRows(await f.text());
    if (!parsed.length) toast.error("Fichier vide ou illisible"); else setRows(parsed);
    if (input.current) input.current.value = "";
  }
  async function confirm() {
    setBusy(true);
    const n = await crm.importProspects(valid.map(({ reason: _r, ...r }) => r));
    setBusy(false);
    if (n >= 0) { toast.success(`${n} importés, ${preview.length - n} ignorés`); setRows(null); }
  }

  return <>
    <input ref={input} type="file" accept=".csv,text/csv" className="hidden" aria-label="Fichier CSV" onChange={e => onFile(e.target.files?.[0])} />
    <Button size="sm" variant="outline" onClick={() => input.current?.click()}><Upload /> Importer</Button>
    <Button size="sm" variant="outline" onClick={() => exportProspects(crm.prospects)} disabled={!crm.prospects.length}><Download /> Exporter</Button>
    <Dialog open={!!rows} onOpenChange={o => !o && setRows(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aperçu de l'import</DialogTitle>
          <DialogDescription>{valid.length} à importer · {preview.length - valid.length} ignorés · limite d'import du plan {cap < 0 ? "illimitée" : `${cap} prospects`}</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-secondary"><tr><th className="p-2">Nom</th><th className="p-2">Téléphone</th><th className="p-2">Source</th><th className="p-2">Notes</th><th className="p-2">État</th></tr></thead>
            <tbody>{preview.map((r, i) => <tr key={i} className={`border-t border-border ${r.reason ? "opacity-50" : ""}`}><td className="p-2 font-semibold">{r.name || "—"}</td><td className="p-2">{r.phone}</td><td className="p-2">{r.source}</td><td className="max-w-40 truncate p-2">{r.notes}</td><td className={`p-2 ${r.reason ? "text-destructive" : "text-primary"}`}>{r.reason || "OK"}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setRows(null)}>Annuler</Button><Button onClick={confirm} disabled={busy || !valid.length}>{busy ? "Import…" : `Importer ${valid.length} contacts`}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}

export type Filters = { status: Status | ""; interest: string; source: string; overdue: boolean; sort: "created" | "followup" | "name" };
export const emptyFilters: Filters = { status: "", interest: "", source: "", overdue: false, sort: "created" };

export function applyFilters(list: Prospect[], f: Filters) {
  const today = new Date().toISOString().slice(0, 10);
  const out = list.filter(p => (!f.status || p.status === f.status) && (!f.interest || String(p.interest_level ?? "") === f.interest) && (!f.source || norm(p.source ?? "") === norm(f.source)) && (!f.overdue || (!!p.next_followup_date && p.next_followup_date < today)));
  return [...out].sort((a, b) => f.sort === "name" ? a.name.localeCompare(b.name, "fr") : f.sort === "followup" ? (a.next_followup_date ?? "9999").localeCompare(b.next_followup_date ?? "9999") : b.created_at.localeCompare(a.created_at));
}

const sel = "h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring";
export function FilterBar({ f, set, statuses }: { f: Filters; set: (f: Filters) => void; statuses: readonly Status[] }) {
  const chips: { label: string; clear: Partial<Filters> }[] = [];
  if (f.status) chips.push({ label: `Statut : ${STATUS_LABELS[f.status]}`, clear: { status: "" } });
  if (f.interest) chips.push({ label: `Intérêt : ${INTEREST[Number(f.interest)]}`, clear: { interest: "" } });
  if (f.source) chips.push({ label: `Source : ${f.source}`, clear: { source: "" } });
  if (f.overdue) chips.push({ label: "Relance en retard", clear: { overdue: false } });
  return <div className="grid gap-3 border-b border-border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Filtrer par statut" className={sel} value={f.status} onChange={e => set({ ...f, status: e.target.value as Status | "" })}><option value="">Tous statuts</option>{statuses.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select>
      <select aria-label="Filtrer par intérêt" className={sel} value={f.interest} onChange={e => set({ ...f, interest: e.target.value })}><option value="">Tout intérêt</option><option value="3">Chaud</option><option value="2">Tiède</option><option value="1">Froid</option></select>
      <select aria-label="Filtrer par source" className={sel} value={f.source} onChange={e => set({ ...f, source: e.target.value })}><option value="">Toutes sources</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
      <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-xs"><input type="checkbox" checked={f.overdue} onChange={e => set({ ...f, overdue: e.target.checked })} className="accent-primary" /> Relance en retard</label>
      <select aria-label="Trier" className={`${sel} ml-auto`} value={f.sort} onChange={e => set({ ...f, sort: e.target.value as Filters["sort"] })}><option value="created">Tri : date d'ajout</option><option value="followup">Tri : date de relance</option><option value="name">Tri : nom</option></select>
    </div>
    {chips.length > 0 && <div className="flex flex-wrap gap-2">{chips.map(c => <button key={c.label} onClick={() => set({ ...f, ...c.clear })} className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20" aria-label={`Retirer le filtre ${c.label}`}>{c.label} <X className="size-3" /></button>)}<button onClick={() => set({ ...emptyFilters, sort: f.sort })} className="px-2 text-xs text-muted-foreground hover:text-foreground">Tout effacer</button></div>}
  </div>;
}
