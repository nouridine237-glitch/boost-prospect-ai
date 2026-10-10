import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clock, ShieldCheck, Users, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin, listAdminUsers, updateUserSubscription, PLAN_LIMITS, type AdminUserRow } from "@/lib/admin.functions";
import { listPaymentRequests, reviewPaymentRequest, type AdminPaymentRow } from "@/lib/payments.functions";
import { getAiCreditUsage, setAiCreditLimit } from "@/lib/ai-usage.functions";
import { getPaymentNumbers, savePaymentNumbers, type PaymentNumbers } from "@/lib/payment-settings.functions";

function PaymentNumbersSection() {
  const getFn = useServerFn(getPaymentNumbers);
  const saveFn = useServerFn(savePaymentNumbers);
  const [form, setForm] = useState<PaymentNumbers>({ orangeNumber: "", orangeName: "", mtnNumber: "", mtnName: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { getFn({}).then(setForm).catch(() => setMsg("Impossible de charger les numéros.")); }, []);

  async function save() {
    setSaving(true); setMsg("");
    try { await saveFn({ data: form }); setMsg("Numéros enregistrés."); }
    catch { setMsg("Les numéros n’ont pas pu être enregistrés."); }
    finally { setSaving(false); }
  }

  const field = (k: keyof PaymentNumbers, label: string, ph: string) => (
    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
      <span>{label}</span>
      <input value={form[k]} placeholder={ph} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" />
    </label>
  );

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-bold">Numéros de paiement Mobile Money</h2>
      <Card className="border-border bg-card">
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("orangeNumber", "Orange Money — numéro", "237…")}
            {field("orangeName", "Orange Money — nom du titulaire", "Nom")}
            {field("mtnNumber", "MTN MoMo — numéro (vide = masqué)", "237…")}
            {field("mtnName", "MTN MoMo — nom du titulaire", "Nom")}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
            {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function AiCreditsSection() {
  const getFn = useServerFn(getAiCreditUsage);
  const setFn = useServerFn(setAiCreditLimit);
  const [data, setData] = useState<{ used: number; limit: number; count: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getFn({}).then((d) => { setData(d); setDraft(String(d.limit)); }).catch(() => setMsg("Impossible de charger le suivi des crédits."));
  }, []);

  async function saveLimit() {
    const n = Number(draft.replace(",", "."));
    if (!(n > 0)) { setMsg("Entrez une limite supérieure à 0."); return; }
    setSaving(true); setMsg("");
    try {
      await setFn({ data: { limit: n } });
      setData((d) => (d ? { ...d, limit: n } : d));
      setMsg("Limite enregistrée.");
    } catch { setMsg("La limite n’a pas pu être enregistrée."); }
    finally { setSaving(false); }
  }

  const pct = data && data.limit > 0 ? (data.used / data.limit) * 100 : 0;
  const level = pct >= 95 ? "danger" : pct >= 80 ? "warn" : "ok";
  const monthLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <section className="mt-10">
      <h2 id="credits-ia" className="mb-3 text-lg font-bold">Suivi des crédits IA</h2>
      {level !== "ok" && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${level === "danger" ? "border-destructive bg-destructive/15 text-destructive" : "border-warning bg-warning/15 text-warning"}`}>
          {level === "danger"
            ? `Alerte critique : ${pct.toFixed(0)} % de la limite mensuelle de crédits IA est consommée.`
            : `Attention : ${pct.toFixed(0)} % de la limite mensuelle de crédits IA est consommée.`}
        </div>
      )}
      <Card className="border-border bg-card">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Consommé depuis le 1er {monthLabel} (tous utilisateurs)</p>
              <p className="text-3xl font-extrabold">{data ? data.used.toLocaleString("fr-FR") : "…"} <span className="text-base font-semibold text-muted-foreground">/ {data?.limit.toLocaleString("fr-FR") ?? "…"} crédits</span></p>
              <p className="text-xs text-muted-foreground">{data?.count ?? 0} générations ce mois · remise à zéro automatique le 1er du mois</p>
            </div>
            <p className="text-2xl font-bold">{pct.toFixed(1)} %</p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full transition-all ${level === "danger" ? "bg-destructive" : level === "warn" ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="ai-limit" className="text-sm text-muted-foreground">Limite mensuelle du plan Lovable :</label>
            <input id="ai-limit" type="number" min="1" step="any" value={draft} onChange={(e) => setDraft(e.target.value)}
              className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm" />
            <Button size="sm" onClick={saveLimit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
            {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Panel Admin — MLM Boost AI" },
    { name: "description", content: "Gestion des utilisateurs et des abonnements de MLM Boost AI." },
    { property: "og:title", content: "Panel Admin — MLM Boost AI" },
    { property: "og:description", content: "Utilisateurs, plans et revenus estimés." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: AdminPage,
});

const planLabels: Record<string, string> = { gratuit: "Gratuit", pro: "Pro", expert: "Expert", business: "Business" };
const statusLabels: Record<string, string> = { actif: "Actif", expire: "Expiré", en_attente: "En attente" };
const plans = ["gratuit", "pro", "expert", "business"] as const;
const statuses = ["actif", "expire", "en_attente"] as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function AdminPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const isAdminFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listAdminUsers);
  const updateFn = useServerFn(updateUserSubscription);
  const listPaymentsFn = useServerFn(listPaymentRequests);
  const reviewFn = useServerFn(reviewPaymentRequest);


  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [adminName, setAdminName] = useState({ fullName: "", displayName: "" });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { isAdmin } = await isAdminFn({});
        if (!active) return;
        if (!isAdmin) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        setAllowed(true);
        const [{ users }, profile] = await Promise.all([
          listFn({}),
          supabase.from("profiles").select("full_name, display_name").eq("id", user.id).maybeSingle(),
        ]);
        if (!active) return;
        setRows(users);
        listPaymentsFn({}).then(({ requests }) => { if (active) setPayments(requests); }).catch(() => {});
        setAdminName({
          fullName: (profile.data as any)?.full_name || String(user.user_metadata?.["full_name"] ?? user.email ?? ""),
          displayName: (profile.data as any)?.display_name || "",
        });
      } catch {
        if (active) navigate({ to: "/dashboard", replace: true });
      }
    })();
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => {
    const byPlan: Record<string, number> = { gratuit: 0, pro: 0, expert: 0, business: 0 };
    let revenue = 0;
    for (const r of rows) {
      byPlan[r.plan] = (byPlan[r.plan] ?? 0) + 1;
      if (r.status === "actif") revenue += PLAN_LIMITS[r.plan]?.price ?? 0;
    }
    return { total: rows.length, byPlan, revenue };
  }, [rows]);

  async function save(row: AdminUserRow, plan: string, status: string) {
    setSavingId(row.id);
    setError("");
    try {
      const res = await updateFn({ data: { userId: row.id, plan, status } as any });
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, plan, status, updatedAt: res.updatedAt } : r)));
    } catch {
      setError("La modification n’a pas pu être enregistrée.");
    } finally {
      setSavingId(null);
    }
  }

  const pendingCount = payments.filter((p) => p.statut === "en_attente").length;

  async function review(row: AdminPaymentRow, decision: "valide" | "refuse") {
    setReviewingId(row.id);
    setError("");
    try {
      await reviewFn({ data: { id: row.id, decision } as any });
      setPayments((prev) => prev.map((p) => (p.id === row.id ? { ...p, statut: decision } : p)));
      if (decision === "valide") {
        setRows((prev) => prev.map((r) => (r.id === row.userId ? { ...r, plan: row.plan, status: "actif", updatedAt: new Date().toISOString() } : r)));
      }
    } catch {
      setError("La décision n’a pas pu être enregistrée.");
    } finally {
      setReviewingId(null);
    }
  }

  if (allowed !== true) {
    return (
      <AppShell user={user} title="Admin">
        <div className="p-8 text-sm text-muted-foreground">Vérification des droits…</div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} title="Panel Admin">
      <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary"><ShieldCheck className="size-5" /></span>
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">{adminName.fullName || "Administrateur"}</h1>
            {adminName.displayName && (
              <span className="mt-1 inline-block rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                {adminName.displayName}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className={pendingCount > 0 ? "border-warning bg-card" : "border-border bg-card"}>
            <CardHeader className="pb-2"><p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Clock className="size-4" /> Paiements en attente</p></CardHeader>
            <CardContent>
              <p className="text-3xl font-extrabold">{pendingCount}</p>
              <a href="#paiements" className="mt-1 inline-block text-xs text-primary hover:underline">Voir les demandes</a>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2"><p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Users className="size-4" /> Utilisateurs inscrits</p></CardHeader>
            <CardContent><p className="text-3xl font-extrabold">{summary.total}</p></CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2"><p className="text-xs font-semibold text-muted-foreground">Répartition par plan</p></CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {plans.map((p) => <p key={p} className="flex justify-between"><span>{planLabels[p]}</span><span className="font-semibold text-foreground">{summary.byPlan[p] ?? 0}</span></p>)}
            </CardContent>
          </Card>
          <Card className="border-primary bg-card">
            <CardHeader className="pb-2"><p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Wallet className="size-4" /> Revenu mensuel estimé</p></CardHeader>
            <CardContent>
              <p className="text-3xl font-extrabold">{summary.revenue.toLocaleString("fr-FR")} FCFA</p>
              <p className="mt-1 text-xs text-muted-foreground">Somme des plans actifs</p>
            </CardContent>
          </Card>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <PaymentNumbersSection />
        <AiCreditsSection />


        <h2 id="paiements" className="mt-10 mb-3 text-lg font-bold">Paiements en attente</h2>
        <div className="space-y-3">
          {payments.map((p) => (
            <Card key={p.id} className={p.statut === "en_attente" ? "border-warning/60 bg-card" : "border-border bg-card"}>
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  {p.captureUrl ? (
                    <button type="button" onClick={() => setZoom(p.captureUrl)} className="shrink-0">
                      <img src={p.captureUrl} alt="Capture de paiement" className="size-16 rounded-md border border-border object-cover" />
                    </button>
                  ) : (
                    <span className="grid size-16 shrink-0 place-items-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">Aucune capture</span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.userName}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Plan {planLabels[p.plan] ?? p.plan} · {p.montant.toLocaleString("fr-FR")} {p.devise} · Réf. {p.reference || "—"} · {formatDate(p.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                    Méthode : {p.method === "saspay" ? "SasPay" : "Manuel"}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.statut === "en_attente" ? "bg-warning/15 text-warning" : p.statut === "valide" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {p.statut === "en_attente" ? "En attente" : p.statut === "valide" ? (p.method === "saspay" ? "Validé automatiquement" : "Validé") : p.statut === "echoue" ? "Échoué" : "Refusé"}
                  </span>
                  {p.statut === "en_attente" && p.method !== "saspay" && (
                    <>
                      <Button size="sm" disabled={reviewingId === p.id} onClick={() => review(p, "valide")}>Valider</Button>
                      <Button size="sm" variant="outline" disabled={reviewingId === p.id} onClick={() => review(p, "refuse")}>Refuser</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {payments.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande de paiement pour le moment.</p>}
        </div>

        {zoom && (
          <button type="button" onClick={() => setZoom(null)} className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-6">
            <img src={zoom} alt="Capture de paiement agrandie" className="max-h-[85vh] max-w-full rounded-lg border border-border" />
          </button>
        )}

        <h2 className="mt-10 mb-3 text-lg font-bold">Utilisateurs & abonnements</h2>
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="border-border bg-card">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.fullName || row.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Inscrit le {formatDate(row.createdAt)} · Dernière modification : {formatDate(row.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={row.plan}
                    onChange={(e) => save(row, e.target.value, row.status)}
                    disabled={savingId === row.id}
                    className="h-9 rounded-md border border-border bg-secondary/50 px-3 text-sm"
                    aria-label={`Plan de ${row.email}`}
                  >
                    {plans.map((p) => <option key={p} value={p}>{planLabels[p]}</option>)}
                  </select>
                  <select
                    value={row.status}
                    onChange={(e) => save(row, row.plan, e.target.value)}
                    disabled={savingId === row.id}
                    className="h-9 rounded-md border border-border bg-secondary/50 px-3 text-sm"
                    aria-label={`Statut de ${row.email}`}
                  >
                    {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
                  </select>
                  <Button variant="outline" size="sm" disabled={savingId === row.id} onClick={() => save(row, row.plan, row.status)}>
                    {savingId === row.id ? "Enregistrement…" : "Appliquer"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucun utilisateur.</p>}
        </div>
      </div>
    </AppShell>
  );
}
