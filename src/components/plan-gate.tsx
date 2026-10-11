import { Link } from "@tanstack/react-router";
import { AlertTriangle, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { graceEnd, type PlanInfo } from "@/hooks/use-plan";
import { PLANS, type PlanKey } from "@/lib/plans";

export function UpgradeCard({ minPlan, children }: { minPlan: PlanKey; children?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center gap-3 rounded-lg p-6 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-primary/12 text-primary"><Lock className="size-5" /></span>
      <p className="font-bold">Disponible avec le plan {PLANS[minPlan].label}</p>
      {children && <p className="max-w-md text-sm text-muted-foreground">{children}</p>}
      <Button asChild className="min-h-11"><Link to="/abonnement">Voir les plans</Link></Button>
    </div>
  );
}

export function UpgradeDialog({ open, onOpenChange, minPlan, children }: { open: boolean; onOpenChange: (o: boolean) => void; minPlan: PlanKey; children?: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="size-4 text-primary" /> Disponible avec le plan {PLANS[minPlan].label}</DialogTitle>
          {children && <DialogDescription>{children}</DialogDescription>}
        </DialogHeader>
        <Button asChild className="min-h-11 w-full"><Link to="/abonnement">Voir les plans</Link></Button>
      </DialogContent>
    </Dialog>
  );
}

const fmt = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

export function PlanBanner({ info }: { info: PlanInfo }) {
  if (info.loading) return null;
  const label = PLANS[info.rawPlan].label;
  let tone = "border-warning/40 bg-warning/10";
  let text: string | null = null;
  if (info.phase === "expiring" && info.renewal) text = `Ton plan ${label} se termine le ${fmt(info.renewal)}. Renouvelle pour garder tes fonctionnalités.`;
  else if (info.phase === "grace" && info.renewal) text = `Ton plan ${label} est arrivé à échéance le ${fmt(info.renewal)}. Il reste actif jusqu’au ${fmt(graceEnd(info.renewal))} : renouvelle maintenant pour ne pas revenir au plan Gratuit.`;
  else if (info.phase === "expired") { text = "Ton plan a expiré, tu es revenu au plan Gratuit. Tes données sont conservées."; tone = "border-destructive/40 bg-destructive/10"; }
  if (!text) return null;
  return (
    <div className={`mb-4 flex flex-col gap-3 rounded-lg border p-4 text-sm sm:flex-row sm:items-center sm:justify-between ${tone}`}>
      <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{text}</span></p>
      <Button asChild size="sm" className="min-h-10 shrink-0"><Link to="/abonnement">Renouveler</Link></Button>
    </div>
  );
}

export function LimitError({ message }: { message: string }) {
  const isLimit = /limite/i.test(message);
  return (
    <div className="flex flex-col gap-2 border-b border-border p-4 text-xs text-destructive sm:flex-row sm:items-center sm:justify-between">
      <p>{message}</p>
      {isLimit && <Button asChild size="sm" variant="outline" className="shrink-0"><Link to="/abonnement">Voir les plans</Link></Button>}
    </div>
  );
}
