import { Bell, Bot, Check, ChevronRight, ContactRound, MessageCircle, Plus, Sparkles } from "lucide-react";

/** Maquette illustrative du tableau de bord (contacts fictifs), en attendant de vraies captures d'un compte de démonstration. */
export function LandingPhone({ compact = false }: { compact?: boolean }) {
  return <div className={`lp-phone ${compact ? "lp-phone-compact" : ""}`} role="img" aria-label="Maquette illustrative du tableau de bord">
    <div className="lp-island" /><div className="lp-phone-status"><span>9:41</span><span>••• ▰</span></div>
    <div className="lp-screen">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-4"><span className="flex items-center gap-2 text-xs font-bold"><span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground"><Sparkles className="size-3" /></span>MLM Boost AI</span><Bell className="size-4 text-muted-foreground" /></div>
      <div className="lp-screen-item mt-5"><span className="text-[10px] text-muted-foreground">TON ESPACE DE TRAVAIL</span><h3 className="mt-1 text-lg font-bold">Chaque jour, un pas de plus.</h3></div>
      <div className="lp-screen-item lp-demo-block mt-4"><span className="text-xs font-semibold">Démarrer en 3 étapes</span><div className="mt-3 flex items-center gap-2 text-[11px]"><Check className="size-4 text-success" />Ajouter ton premier prospect</div><div className="mt-2 flex items-center gap-2 text-[11px]"><Check className="size-4 text-success" />Générer ton premier message</div><div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"><MessageCircle className="size-4 text-primary" />L'envoyer sur WhatsApp</div></div>
      <div className="lp-screen-item mt-4 flex items-center justify-between text-xs font-bold"><span>À relancer aujourd'hui</span><span className="size-6 rounded-md bg-primary/15 p-1 text-center text-primary">2</span></div>
      <DemoContact name="Amina" label="Intéressé" /><DemoContact name="Yannick" label="Discussion" />
    </div>
    <div className="lp-phone-nav"><ContactRound /><Plus /><Bot /><ChevronRight /></div>
  </div>;
}

function DemoContact({ name, label }: { name: string; label: string }) {
  return <div className="lp-screen-item mt-3 flex min-w-0 items-center gap-2 rounded-md border border-border bg-card/70 p-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-info/15 text-xs font-bold text-info">{name[0]}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{name}</p><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div><ChevronRight className="size-3 shrink-0 text-primary" /></div>;
}
