import { useState } from "react";
import { CalendarClock, MoreHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { slugStatus, statusLabels, statuses, type Crm, type Prospect } from "@/components/crm";
import { interestLevels } from "@/components/prospect-tools";

function daysUntil(date: string) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(date + "T00:00:00").getTime() - t.getTime()) / 86400000);
}

export function ViewToggle({ view, onChange }: { view: "liste" | "pipeline"; onChange: (v: "liste" | "pipeline") => void }) {
  return (
    <div className="inline-flex rounded-full border border-border bg-secondary/50 p-1" role="tablist" aria-label="Affichage des prospects">
      {(["liste", "pipeline"] as const).map(v => (
        <button key={v} role="tab" aria-selected={view === v} onClick={() => onChange(v)}
          className={`min-h-11 rounded-full px-5 transition-colors duration-150 text-sm font-semibold transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {v === "liste" ? "Liste" : "Pipeline"}
        </button>
      ))}
    </div>
  );
}

function PipelineCard({ p, crm, onOpen }: { p: Prospect; crm: Crm; onOpen: (p: Prospect, suggest?: boolean) => void }) {
  const lvl = interestLevels.find(l => l.value === p.interest_level);
  const d = p.next_followup_date ? daysUntil(p.next_followup_date) : null;
  const followTxt = d === null ? "Pas de relance" : d < 0 ? `${-d} j de retard` : d === 0 ? "Relance aujourd'hui" : `Relance dans ${d} j`;
  const followCls = d === null ? "text-muted-foreground" : d < 0 ? "text-destructive" : d === 0 ? "text-warning" : "text-primary";
  return (
    <article draggable onDragStart={e => { e.dataTransfer.setData("text/plain", p.id); e.dataTransfer.effectAllowed = "move"; e.currentTarget.classList.add("opacity-50"); }} onDragEnd={e => e.currentTarget.classList.remove("opacity-50")} className="card-premium card-hover cursor-grab p-3 active:cursor-grabbing">
      <div className="flex items-start gap-2">
        <button className="min-w-0 flex-1 text-left text-sm font-semibold hover:text-primary" onClick={() => onOpen(p)} aria-label={`Ouvrir la fiche de ${p.name}`}>{p.name}</button>
        <Button size="icon" variant="ghost" className="size-8 shrink-0 text-primary" title="Suggérer la prochaine action" aria-label={`Suggérer la prochaine action pour ${p.name}`} onClick={() => onOpen(p, true)}><Sparkles /></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Déplacer ${p.name} vers…`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Déplacer vers…</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {statuses.filter(s => s !== p.status).map(s => <DropdownMenuItem key={s} onClick={() => void crm.changeStatus(p.id, s)}>{statusLabels[s]}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {lvl ? <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${lvl.cls}`}>{lvl.label}</span> : <span className="text-[11px] text-muted-foreground">Intérêt non renseigné</span>}
      </div>
      <p className={`mt-2 flex items-center gap-1 text-[11px] font-semibold ${followCls}`}><CalendarClock className="size-3" /> {followTxt}</p>
    </article>
  );
}

export function PipelineBoard({ crm, onOpen }: { crm: Crm; onOpen: (p: Prospect) => void }) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-3 lg:mx-0 lg:px-0">
      <p className="mb-3 text-xs text-muted-foreground">Glisse une carte vers une autre colonne, ou utilise le menu « … » sur mobile.</p>
      <div className="grid min-w-max auto-cols-[248px] grid-flow-col gap-3 xl:min-w-0 xl:auto-cols-fr">
        {statuses.map(s => {
          const items = crm.prospects.filter(p => p.status === s);
          return (
            <section key={s} aria-label={`Colonne ${statusLabels[s]}`}
              onDragOver={e => { e.preventDefault(); if (over !== s) setOver(s); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
              onDrop={e => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); const p = crm.prospects.find(x => x.id === id); if (p && p.status !== s) void crm.changeStatus(id, s); }}
              className={`card-premium col-${slugStatus(s)} flex min-h-48 flex-col transition-colors duration-200 ${over === s ? "drop-target" : ""}`}>
              <header className="col-head flex items-center justify-between gap-2 p-3">
                <span className={`status status-${slugStatus(s)}`}>{statusLabels[s]}</span>
                <span className="grid min-w-6 place-items-center rounded-full bg-secondary px-2 text-xs font-bold">{items.length}</span>
              </header>
              <div className="grid content-start gap-2 p-2">
                {!crm.loaded ? <><span className="skeleton h-20" /><span className="skeleton h-20" /></> : items.length ? items.map(p => <div key={p.id} className="fade-in"><PipelineCard p={p} crm={crm} onOpen={onOpen} /></div>) : <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">Dépose un prospect ici</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
