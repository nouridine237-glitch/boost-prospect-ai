import { Link, useLocation } from "@tanstack/react-router";
import { BookOpen, Film, Inbox, Layers } from "lucide-react";

const TABS = [
  { to: "/academie", label: "Catalogue", icon: BookOpen, exact: true },
  { to: "/academie/videos", label: "Ma vidéothèque", icon: Film },
  { to: "/academie/mes-formations", label: "Mes formations", icon: Layers },
  { to: "/academie/recues", label: "Formations reçues", icon: Inbox },
] as const;

/** Onglets de l'Académie, défilants sur mobile. */
export function AcademyTabs() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Académie" className="-mx-5 mt-4 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <ul className="flex w-max gap-2">
        {TABS.map((t) => {
          const active = "exact" in t ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <li key={t.to}>
              <Link to={t.to} aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-200 ${active ? "border-primary/60 bg-primary/12 text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
                <t.icon className={`size-4 ${active ? "text-primary" : ""}`} />{t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="surface mt-6 flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-primary/12 text-primary"><Icon className="size-6" /></span>
      <h2 className="font-bold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function CardSkeletons({ n = 4 }: { n?: number }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="surface overflow-hidden rounded-2xl">
          <div className="aspect-video animate-pulse bg-muted" />
          <div className="space-y-2 p-4"><div className="h-4 w-3/4 animate-pulse rounded bg-muted" /><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /></div>
        </div>
      ))}
    </div>
  );
}

export function ErrorLine({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="surface mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-destructive/40 p-4 text-sm">
      <span>{text}</span>
      <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-border px-4 font-semibold">Réessayer</button>
    </div>
  );
}
