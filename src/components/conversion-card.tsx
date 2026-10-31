import { useEffect, useMemo, useState } from "react";
import { History, TrendingUp, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { statusLabels, slugStatus, type Prospect } from "@/components/crm";
import { CONVERSION_STATUSES, STUCK_DAYS, cohortConversion, conversionRate, statusDistribution, statusTransitions, stuckProspects, type ConvEvent } from "@/lib/conversion";

const EVENTS_DAYS = 90;
const EVENTS_LIMIT = 2000;

/** Carte « Conversion commerciale ». À ne monter que si l'utilisateur a accès aux statistiques avancées. */
export function ConversionCard({ userId, prospects }: { userId: string; prospects: Prospect[] }) {
  const [events, setEvents] = useState<ConvEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const since = new Date(Date.now() - EVENTS_DAYS * 86_400_000).toISOString();
    supabase.from("prospect_events").select("prospect_id, type, content, created_at").eq("user_id", userId).gte("created_at", since)
      .order("created_at", { ascending: false }).limit(EVENTS_LIMIT)
      .then(({ data, error }) => { if (error) setFailed(true); else setEvents(data ?? []); });
  }, [userId]);

  const now = useMemo(() => new Date(), []);
  const dist = useMemo(() => statusDistribution(prospects), [prospects]);
  const rate = useMemo(() => conversionRate(prospects), [prospects]);
  const cohort = useMemo(() => cohortConversion(prospects, new Date(now.getTime() - 30 * 86_400_000), now), [prospects, now]);
  const transitions = useMemo(() => events ? statusTransitions(events) : null, [events]);
  const stuck = useMemo(() => events ? stuckProspects(prospects, events, now) : null, [prospects, events, now]);
  const names = useMemo(() => new Map(prospects.map(p => [p.id, p.name])), [prospects]);

  return (
    <section className="surface mt-6 rounded-lg p-5">
      <h2 className="flex items-center gap-2 font-bold"><TrendingUp className="size-4 text-primary" />Conversion commerciale</h2>

      {!dist.total ? <p className="mt-4 text-sm text-muted-foreground">Ajoute tes premiers prospects pour voir ta conversion.</p> : (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-3xl font-extrabold">{rate.status === "ok" ? `${rate.value.rate} %` : "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Taux actuel = prospects au statut Client ({rate.status === "ok" ? rate.value.clients : 0}) ÷ tous tes prospects ({dist.total}).</p>
            {cohort.status === "ok" && <p className="mt-3 text-sm">30 derniers jours : <b>{cohort.value.clients}</b> client(s) sur <b>{cohort.value.cohort}</b> prospect(s) ajouté(s), soit <b>{cohort.value.rate} %</b>.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {CONVERSION_STATUSES.map(s => <span key={s} className={`status status-${slugStatus(s)}`}>{statusLabels[s]} · {dist.counts[s]}</span>)}
            </div>
          </div>

          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-bold"><History className="size-3.5" />Changements de statut ({EVENTS_DAYS} derniers jours)</h3>
            {failed ? <p className="mt-2 text-sm text-muted-foreground">Historique indisponible pour le moment.</p>
              : !transitions ? <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>
              : transitions.status === "insufficient" ? <p className="mt-2 text-sm text-muted-foreground">Aucun changement de statut enregistré pour l'instant.</p>
              : <ul className="mt-2 grid gap-1 text-sm">{transitions.value.transitions.slice(0, 8).map(t => <li key={`${t.from}-${t.to}`} className="flex justify-between gap-2"><span>{statusLabels[t.from]} → {statusLabels[t.to]}</span><b>{t.count}</b></li>)}</ul>}
            <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />L'historique des étapes peut être incomplet pour les anciens prospects et les imports.</p>
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-sm font-bold">Prospects actifs sans activité depuis {STUCK_DAYS} jours</h3>
            {failed ? <p className="mt-2 text-sm text-muted-foreground">Impossible de vérifier l'activité pour le moment.</p>
              : !stuck ? <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>
              : !stuck.stuck.length ? <p className="mt-2 text-sm text-muted-foreground">Aucun prospect bloqué. Bravo !</p>
              : <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{stuck.stuck.slice(0, 10).map(s => <li key={s.id} className="flex justify-between gap-2 rounded-md bg-secondary px-3 py-2"><span className="truncate">{names.get(s.id)}</span><span className="shrink-0 text-muted-foreground">{statusLabels[s.status]} · {s.idleDays} j</span></li>)}</ul>}
            {stuck && stuck.stuck.length > 10 && <p className="mt-1 text-xs text-muted-foreground">+ {stuck.stuck.length - 10} autre(s)</p>}
          </div>
        </div>
      )}
    </section>
  );
}
