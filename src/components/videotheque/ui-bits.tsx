import { AlertTriangle, Archive, CheckCircle2, Eye, Loader2, Repeat, ShieldCheck, type LucideIcon } from "lucide-react";
import { formatBytes } from "@/lib/videotheque";

type Tone = "primary" | "success" | "destructive" | "muted";
const TONE: Record<Tone, string> = {
  primary: "border-primary/30 bg-primary/12 text-primary",
  success: "border-success/30 bg-success/12 text-success",
  destructive: "border-destructive/30 bg-destructive/12 text-destructive",
  muted: "border-border/60 bg-muted/80 text-muted-foreground",
};

/** Pastille de statut : toujours icône + texte, jamais la couleur seule. */
export function StatusBadge({ tone, icon: Icon, children, className = "" }: { tone: Tone; icon?: LucideIcon; children: React.ReactNode; className?: string | undefined }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${TONE[tone]} ${className}`}>
      {Icon && <Icon className="size-3" aria-hidden />}{children}
    </span>
  );
}

export function VideoStatusBadge({ status, archived, className }: { status: string; archived?: boolean; className?: string | undefined }) {
  if (archived) return <StatusBadge tone="muted" icon={Archive} className={className}>Archivée</StatusBadge>;
  if (status === "pret") return <StatusBadge tone="success" icon={CheckCircle2} className={className}>Prête</StatusBadge>;
  if (status === "echec") return <StatusBadge tone="destructive" icon={AlertTriangle} className={className}>Échec</StatusBadge>;
  return <StatusBadge tone="primary" icon={Loader2} className={className}>Envoi</StatusBadge>;
}

/** Jauge d'espace : orange dès 80 %, rouge dès 95 %. */
export function StorageMeter({ used, total }: { used: number; total: number }) {
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const bar = pct >= 95 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div className="min-w-0 flex-1">
      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>Espace utilisé</span>
        <span className="font-semibold tabular-nums text-foreground">{formatBytes(used)} / {formatBytes(total)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Espace utilisé">
        <div className={`h-full rounded-full transition-[width] duration-300 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 95 && <p className="mt-1.5 text-xs text-destructive">Espace presque plein : archive des vidéos ou passe à un plan supérieur.</p>}
    </div>
  );
}

export function PermissionBadges({ reshare }: { reshare: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone="muted" icon={Eye}>Regarder</StatusBadge>
      {reshare && <StatusBadge tone="primary" icon={Repeat}>Repartager</StatusBadge>}
      <StatusBadge tone="success" icon={ShieldCheck}>Accès durable</StatusBadge>
    </div>
  );
}

/** Résumé en clair de ce que le destinataire pourra faire. */
export function ShareSummary({ count, reshare }: { count: number; reshare: boolean }) {
  const who = count > 1 ? `Ces ${count} personnes` : count === 1 ? "Cette personne" : "Les personnes choisies";
  return (
    <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed">
      <p className="mb-2 font-semibold text-foreground">Ce qu'elles pourront faire</p>
      <PermissionBadges reshare={reshare} />
      <p className="mt-2 text-muted-foreground">
        {who} pourront regarder la version publiée actuelle{reshare ? " et la repartager une fois, sans transmettre ce droit" : ""}. Elles la garderont même si tu changes de forfait. Tu peux retirer l'accès seulement pendant 7 jours.
      </p>
    </div>
  );
}
