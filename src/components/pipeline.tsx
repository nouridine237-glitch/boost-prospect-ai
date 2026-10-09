import { CalendarClock, MoreHorizontal } from "lucide-react";
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
          className={`min-h-9 rounded-full px-5 text-sm font-semibold transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {v === "liste" ? "Liste" : "Pipeline"}
        </button>
      ))}
    </div>
  );
}

function PipelineCard({ p, crm, onOpen }: { p: Prospect; crm: Crm; onOpen: (p: Prospect) => void }) {
  const lvl = interestLevels.find(l => l.value === p.interest_level);
  const d = p.next_followup_date ? daysUntil(p.next_followup_date) : null;
  const followTxt = d === null ? "Pas de relance" : d < 0 ? `${-d} j de retard` : d === 0 ? "Relance aujourd'hui" : `Relance dans ${d} j`;
  const followCls = d === null ? "text-muted-foreground" : d < 0 ? "text-destructive" : d === 0 ? "text-warning" : "text-primary";
  return (
    <article className="rounded-md border border-border bg-background p-3">
      <div className="flex items-start gap-2">
        <button className="min-w-0 flex-1 text-left text-sm font-semibold hover:text-primary" onClick={() => onOpen(p)} aria-label={`Ouvrir la fiche de ${p.name}`}>{p.name}</button>
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
  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-3 lg:mx-0 lg:px-0">
      <div className="grid min-w-max auto-cols-[240px] grid-flow-col gap-3 xl:min-w-0 xl:auto-cols-fr">
        {statuses.map(s => {
          const items = crm.prospects.filter(p => p.status === s);
          return (
            <section key={s} className="surface flex min-h-48 flex-col rounded-lg" aria-label={`Colonne ${statusLabels[s]}`}>
              <header className="flex items-center justify-between gap-2 border-b border-border p-3">
                <span className={`status status-${slugStatus(s)}`}>{statusLabels[s]}</span>
                <span className="grid min-w-6 place-items-center rounded-full bg-secondary px-2 text-xs font-bold">{items.length}</span>
              </header>
              <div className="grid content-start gap-2 p-2">
                {items.length ? items.map(p => <PipelineCard key={p.id} p={p} crm={crm} onOpen={onOpen} />) : <p className="p-3 text-center text-xs text-muted-foreground">Aucun prospect</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
