import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Check, ChevronDown, Eye, Film, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDuration, formatTotal } from "@/lib/videotheque";
import { CourseStatusBadge } from "./ui-bits";

export type EditorLesson = { id: string; title: string; duration: number; thumbUrl: string | null; available?: boolean };

/** Miniature 16:9 avec repli icône. */
export function Thumb({ url, className = "" }: { url: string | null; className?: string }) {
  return (
    <span className={`relative block aspect-video shrink-0 overflow-hidden rounded-lg bg-muted ${className}`}>
      {url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : <Film className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />}
    </span>
  );
}

/** Module repliable : titre, nombre de leçons, durée, et « + Leçon dans ce module ». */
export function ModuleSection({ index, name, items, children, onAdd }: {
  index: number; name: string; items: { duration: number }[]; children: React.ReactNode; onAdd?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(true);
  const total = items.reduce((s, l) => s + l.duration, 0);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="surface overflow-hidden rounded-2xl">
      <CollapsibleTrigger className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/40">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-xs font-bold text-primary tabular-nums">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name || "Sans module"}</span>
          <span className="text-xs text-muted-foreground">{items.length} leçon{items.length > 1 ? "s" : ""} · {formatTotal(total)}</span>
        </span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y divide-border/50 border-t border-border/50">{children}</ul>
        {onAdd && (
          <button type="button" onClick={onAdd} className="flex min-h-11 w-full items-center gap-2 border-t border-border/50 px-4 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary/5">
            <Plus className="size-4" />Leçon dans ce module
          </button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Ligne de leçon : numéro, miniature, titre, durée, flèches d'ordre et menu « … ». */
export function LessonRow({ number, lesson, canUp, canDown, onUp, onDown, onEdit, onRemove }: {
  number: number; lesson: EditorLesson; canUp: boolean; canDown: boolean;
  onUp?: (() => void) | undefined; onDown?: (() => void) | undefined; onEdit?: (() => void) | undefined; onRemove?: (() => void) | undefined;
}) {
  const editable = !!onEdit;
  return (
    <li className="flex items-center gap-2.5 py-2 pl-3 pr-1 transition-colors sm:gap-3 duration-150 hover:bg-muted/30">
      <span className="hidden w-5 shrink-0 text-center text-xs sm:block font-semibold tabular-nums text-muted-foreground">{number}</span>
      <Thumb url={lesson.thumbUrl} className="w-16 sm:w-24" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold leading-snug"><span className="text-muted-foreground tabular-nums sm:hidden">{number}. </span>{lesson.title}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{formatDuration(lesson.duration)}</span>
        {lesson.available === false && <span className="ml-2 rounded-full border border-destructive/40 px-2 py-0.5 text-[11px] font-medium text-destructive">Vidéo indisponible</span>}
      </span>
      {editable && (
        <span className="flex shrink-0 items-center">
          <span className="flex flex-col sm:flex-row">
            <button type="button" disabled={!canUp} onClick={onUp} className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-30" aria-label={`Monter « ${lesson.title} »`}><ArrowUp className="size-4" /></button>
            <button type="button" disabled={!canDown} onClick={onDown} className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-30" aria-label={`Descendre « ${lesson.title} »`}><ArrowDown className="size-4" /></button>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:text-foreground" aria-label={`Actions pour « ${lesson.title} »`}><MoreHorizontal className="size-5" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="size-4" />Modifier</DropdownMenuItem>
              <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive"><Trash2 className="size-4" />Retirer la leçon</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      )}
    </li>
  );
}

/** Choix d'une vidéo : recherche + grille de miniatures, sélection marquée d'un anneau et d'une coche. */
export function VideoPicker({ videos, value, onChange }: {
  videos: { id: string; title: string; duration: number; thumbUrl: string | null }[]; value: string; onChange: (id: string, title: string) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => videos.filter((v) => !q.trim() || v.title.toLowerCase().includes(q.trim().toLowerCase())), [videos, q]);
  return (
    <div>
      <span className="text-sm font-medium">Vidéo</span>
      {videos.length > 4 && (
        <label className="relative mt-2 block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une vidéo" className="min-h-11 pl-9" aria-label="Rechercher une vidéo" /></label>
      )}
      <ul className="mt-2 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto p-0.5 sm:grid-cols-3">
        {list.map((v) => {
          const on = value === v.id;
          return (
            <li key={v.id}>
              <button type="button" onClick={() => onChange(v.id, v.title)} aria-pressed={on}
                className={`w-full overflow-hidden rounded-xl border text-left transition-colors duration-150 ${on ? "border-primary ring-2 ring-primary/60" : "border-border/60 hover:border-primary/40"}`}>
                <span className="relative block">
                  <Thumb url={v.thumbUrl} className="w-full rounded-none" />
                  <span className="absolute bottom-1 right-1 rounded bg-background/85 px-1 text-[11px] font-semibold tabular-nums">{formatDuration(v.duration)}</span>
                  {on && <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" aria-hidden /></span>}
                </span>
                <span className="block truncate p-2 text-xs font-medium">{v.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {!list.length && <p className="mt-2 text-xs text-muted-foreground">Aucune vidéo ne correspond.</p>}
    </div>
  );
}

/** Barre fixée en bas : statut, Aperçu, Publier. Au-dessus de la navigation sur mobile. */
export function PublishBar({ courseId, version, changed, canPublish, onPublish, busy }: {
  courseId: string; version: number | null | undefined; changed: boolean; canPublish: boolean; onPublish: () => void; busy: boolean;
}) {
  const hint = !version ? "Pas encore visible par ton équipe" : changed ? "Modifications non publiées" : "À jour";
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border/60 bg-background/95 backdrop-blur lg:bottom-0 lg:left-64">
      <div className="mx-auto flex max-w-[1100px] items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-5">
        <span className="min-w-0 flex-1">
          <CourseStatusBadge version={version} changed={changed} />
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{hint}</span>
        </span>
        <Link to="/academie/lecture/$courseId" params={{ courseId }} className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border/60 px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground">
          <Eye className="size-4" /><span className="hidden sm:inline">Aperçu</span><span className="sr-only sm:hidden">Aperçu</span>
        </Link>
        <Button className="min-h-11 px-5" disabled={!canPublish || busy} onClick={onPublish}>Publier</Button>
      </div>
    </div>
  );
}
