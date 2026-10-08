import { useEffect, useRef, useState } from "react";
import { BellRing, CalendarClock, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WhatsAppActions } from "@/components/whatsapp-actions";
import { slugStatus, statusLabels, type Crm, type Prospect, type ProspectPatch } from "@/components/crm";

export const sources = ["Facebook", "WhatsApp", "Marché chaud", "Recommandation", "Autre"] as const;
export const interestLevels = [
  { value: 3, label: "Chaud", cls: "bg-destructive/15 text-destructive border-destructive/50" },
  { value: 2, label: "Tiède", cls: "bg-warning/15 text-warning border-warning/50" },
  { value: 1, label: "Froid", cls: "bg-primary/15 text-primary border-primary/50" },
] as const;

function todayStr() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function addDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function daysLate(date: string) { return Math.round((new Date(todayStr() + "T00:00:00").getTime() - new Date(date + "T00:00:00").getTime()) / 86400000); }

export function FollowupQueue({ crm }: { crm: Crm }) {
  const today = todayStr();
  const due = crm.prospects
    .filter(p => p.next_followup_date && p.next_followup_date <= today)
    .sort((a, b) => (a.next_followup_date! < b.next_followup_date! ? -1 : 1));

  return (
    <section className="surface mb-6 rounded-lg">
      <div className="flex items-center gap-3 border-b border-border p-5">
        <span className="grid size-9 place-items-center rounded-md bg-primary/12 text-primary"><BellRing className="size-4" /></span>
        <div><h2 className="font-bold">À relancer aujourd'hui</h2><p className="text-xs text-muted-foreground">{due.length ? `${due.length} relance${due.length > 1 ? "s" : ""} en attente` : "Aucune relance en attente"}</p></div>
      </div>
      {due.length === 0 ? <p className="p-6 text-center text-sm font-semibold">Tout est à jour 🎉</p> : (
        <div className="divide-y divide-border">
          {due.map(p => {
            const late = daysLate(p.next_followup_date!);
            const msg = crm.lastMessages[p.id] ?? `Bonjour ${p.name}, je reviens vers toi comme convenu. As-tu eu le temps d'y réfléchir ?`;
            return (
              <div key={p.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 text-sm font-semibold">{p.name}</p>
                  <span className={`status status-${slugStatus(p.status)}`}>{statusLabels[p.status]}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${late > 0 ? "border-destructive/50 bg-destructive/15 text-destructive" : "border-warning/50 bg-warning/15 text-warning"}`}>
                    {late > 0 ? `${late} j de retard` : "Aujourd'hui"}
                  </span>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1"><WhatsAppActions message={msg} phone={p.phone} prospectStatus={p.status} onMarkContacted={() => crm.markContacted(p.id)} /></div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="mt-3"><CalendarClock /> Reporter</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {[["Demain", 1], ["+3 jours", 3], ["+7 jours", 7]].map(([l, n]) => (
                        <DropdownMenuItem key={l} onClick={() => crm.updateProspect(p.id, { next_followup_date: addDays(n as number) })}>{l}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

type Draft = { name: string; phone: string; source: string; product_interest: string; main_objection: string; interest_level: number | null; first_contact_at: string; next_followup_date: string; notes: string };
function toDraft(p: Prospect): Draft {
  return { name: p.name, phone: p.phone ?? "", source: p.source ?? "", product_interest: p.product_interest ?? "", main_objection: p.main_objection ?? "", interest_level: p.interest_level ?? null, first_contact_at: p.first_contact_at ?? "", next_followup_date: p.next_followup_date ?? "", notes: p.notes ?? "" };
}

export function ProspectSheet({ prospect, crm, onClose }: { prospect: Prospect | null; crm: Crm; onClose: () => void }) {
  return (
    <Sheet open={!!prospect} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {prospect && <SheetBody key={prospect.id} prospect={prospect} crm={crm} />}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ prospect, crm }: { prospect: Prospect; crm: Crm }) {
  const [d, setD] = useState<Draft>(() => toDraft(prospect));
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!d.name.trim()) return;
    setState("saving");
    const t = setTimeout(async () => {
      const patch: ProspectPatch = { name: d.name.trim(), phone: d.phone.trim(), source: d.source, product_interest: d.product_interest.trim(), main_objection: d.main_objection.trim(), interest_level: d.interest_level, first_contact_at: d.first_contact_at || null, next_followup_date: d.next_followup_date || null, notes: d.notes };
      await crm.updateProspect(prospect.id, patch);
      setState("saved");
    }, 600);
    return () => clearTimeout(t);
  }, [d]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));
  const label = "grid gap-1.5 text-xs font-semibold text-muted-foreground";
  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

  return (
    <>
      <SheetHeader>
        <SheetTitle>{d.name || "Prospect"}</SheetTitle>
        <SheetDescription className="flex items-center gap-1 text-xs">
          {state === "saving" ? <><Loader2 className="size-3 animate-spin" /> Enregistrement…</> : state === "saved" ? <><Check className="size-3 text-success" /> Enregistré automatiquement</> : "Les modifications sont enregistrées automatiquement."}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-5 grid gap-4">
        <label className={label}>Nom<Input value={d.name} onChange={e => set("name", e.target.value)} /></label>
        <label className={label}>Téléphone<Input value={d.phone} onChange={e => set("phone", e.target.value)} /></label>
        <label className={label}>Source
          <select className={sel} value={d.source} onChange={e => set("source", e.target.value)}>
            <option value="">—</option>{sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className={label}>Produit d'intérêt<Input value={d.product_interest} onChange={e => set("product_interest", e.target.value)} /></label>
        <label className={label}>Objection principale<Input value={d.main_objection} onChange={e => set("main_objection", e.target.value)} /></label>
        <div className={label}>Niveau d'intérêt
          <div className="flex gap-2">
            {interestLevels.map(l => (
              <button key={l.value} type="button" onClick={() => set("interest_level", d.interest_level === l.value ? null : l.value)}
                className={`min-h-10 flex-1 rounded-full border px-3 text-sm font-bold transition-colors ${d.interest_level === l.value ? l.cls : "border-border bg-secondary text-muted-foreground"}`}>{l.label}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Premier contact<Input type="date" value={d.first_contact_at} onChange={e => set("first_contact_at", e.target.value)} /></label>
          <label className={label}>Prochaine relance<Input type="date" value={d.next_followup_date} onChange={e => set("next_followup_date", e.target.value)} /></label>
        </div>
        <label className={label}>Notes<Textarea className="min-h-28 resize-none" value={d.notes} onChange={e => set("notes", e.target.value)} /></label>
      </div>
    </>
  );
}
