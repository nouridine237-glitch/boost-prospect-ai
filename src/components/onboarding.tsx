import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Check, ContactRound, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { onboardingOptions } from "@/lib/onboarding";
import { onProspectEvent } from "@/lib/prospect-events";

type OnboardingContextValue = { steps: boolean[]; dismissed: boolean; saving: boolean; dismiss: () => Promise<void> };
const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const options = onboardingOptions(userId);
  const { data } = useSuspenseQuery(options);
  const queryClient = useQueryClient();
  const pathname = useLocation({ select: location => location.pathname });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["onboarding", userId] });
  }, [pathname, queryClient, userId]);

  useEffect(() => onProspectEvent(() => {
    void queryClient.invalidateQueries({ queryKey: ["onboarding", userId] });
  }), [queryClient, userId]);

  async function save(patch: { onboarded?: boolean; onboarding_dismissed?: boolean }) {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({ id: userId, ...patch });
      if (error) throw error;
      queryClient.setQueryData(options.queryKey, old => old ? {
        ...old,
        onboarded: patch.onboarded ?? old.onboarded,
        dismissed: patch.onboarding_dismissed ?? old.dismissed,
      } : old);
    } catch {
      toast.error("Impossible d’enregistrer. Réessaie dans un instant.");
    } finally { setSaving(false); }
  }

  return (
    <OnboardingContext.Provider value={{ steps: data.steps, dismissed: data.dismissed, saving, dismiss: () => save({ onboarding_dismissed: true }) }}>
      {children}
      <Dialog open={!data.onboarded}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-lg sm:max-w-lg motion-reduce:animate-none [&>button]:hidden" onEscapeKeyDown={event => event.preventDefault()} onPointerDownOutside={event => event.preventDefault()}>
          <span className="flex size-12 items-center justify-center rounded-lg bg-primary/15 text-primary"><Sparkles className="size-6" /></span>
          <DialogHeader>
            <DialogTitle className="text-2xl leading-snug">Bienvenue sur MLM Boost AI</DialogTitle>
            <DialogDescription className="sr-only">Ton espace de prospection est prêt.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li className="flex items-center gap-3"><ContactRound className="size-5 shrink-0 text-primary" /> Organise tes prospects et leurs relances.</li>
            <li className="flex items-center gap-3"><Sparkles className="size-5 shrink-0 text-primary" /> Trouve les bons mots avec l’Assistant IA.</li>
            <li className="flex items-center gap-3"><MessageCircle className="size-5 shrink-0 text-primary" /> Prépare tes messages à envoyer sur WhatsApp.</li>
          </ul>
          <Button className="mt-2 min-h-11 w-full" disabled={saving} onClick={() => void save({ onboarded: true })}>{saving ? "Patiente…" : "Commencer"}<ArrowRight /></Button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">MLM Boost AI est un outil d'aide à la prospection. Aucun revenu n'est garanti.</p>
        </DialogContent>
      </Dialog>
    </OnboardingContext.Provider>
  );
}

const stepDefinitions = [
  { label: "Ajouter ton premier prospect", to: "/prospects", icon: ContactRound },
  { label: "Générer ton premier message avec l’Assistant IA", to: "/assistant", icon: Sparkles },
  { label: "L’envoyer sur WhatsApp", to: "/assistant", icon: MessageCircle },
] as const;

export function GettingStartedCard() {
  const onboarding = useContext(OnboardingContext);
  const count = onboarding?.steps.filter(Boolean).length ?? 0;
  const dismiss = onboarding?.dismiss;
  const dismissed = onboarding?.dismissed;
  const saving = onboarding?.saving;
  useEffect(() => {
    if (count !== 3 || dismissed || saving || !dismiss) return;
    const timer = setTimeout(() => { void dismiss(); }, 4500);
    return () => clearTimeout(timer);
  }, [count, dismissed, saving, dismiss]);

  if (!onboarding || onboarding.dismissed) return null;
  return (
    <section aria-label="Démarrer en 3 étapes" className="mb-6 rounded-lg border border-primary/30 bg-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold sm:text-lg">Démarrer en 3 étapes</h2>
        <Button variant="ghost" className="min-h-11 shrink-0 text-muted-foreground" disabled={onboarding.saving} onClick={() => void onboarding.dismiss()}>Masquer</Button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <p aria-live="polite" className={count === 3 ? "font-semibold text-success" : "text-muted-foreground"}>{count === 3 ? "Bravo, tu es prêt 🎉" : "Tes premiers pas"}</p>
        <span className="font-semibold text-primary">{count}/3</span>
      </div>
      <div role="progressbar" aria-label="Étapes terminées" aria-valuenow={count} aria-valuemin={0} aria-valuemax={3} className="mt-3 grid h-2 grid-cols-3 gap-1 overflow-hidden rounded-full bg-secondary">
        {onboarding.steps.map((done, index) => <span key={index} className={done ? "bg-primary transition-colors duration-300 motion-reduce:transition-none" : "bg-secondary"} />)}
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        {stepDefinitions.map((step, index) => <Button key={step.label} asChild variant="ghost" className="h-auto min-h-14 justify-start gap-3 whitespace-normal px-3 py-3 text-left">
          <Link to={step.to}>
            <span className={onboarding.steps[index] ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success" : "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"}>{onboarding.steps[index] ? <Check /> : <step.icon />}</span>
            <span className="flex-1 text-sm leading-relaxed"><span className="block text-xs text-muted-foreground">Étape {index + 1}{onboarding.steps[index] ? " · Terminée" : ""}</span>{step.label}</span>
            <ArrowRight className="shrink-0 text-muted-foreground" />
          </Link>
        </Button>)}
      </div>
    </section>
  );
}