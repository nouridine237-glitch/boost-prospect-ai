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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
