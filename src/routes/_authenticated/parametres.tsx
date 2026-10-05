import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { countryCodes, setCachedCountryCode } from "@/components/whatsapp-actions";

export const Route = createFileRoute("/_authenticated/parametres")({
  head: () => ({ meta: [
    { title: "Paramètres — MLM Boost AI" },
    { name: "description", content: "Gérez votre nom affiché, votre compte et votre abonnement." },
    { property: "og:title", content: "Paramètres — MLM Boost AI" },
    { property: "og:description", content: "Vos informations de compte MLM Boost AI." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(String(user.user_metadata?.["full_name"] ?? ""));
  const [plan, setPlan] = useState("gratuit");
  const [countryCode, setCountryCode] = useState("237");
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle().then(({ data }) => { if (data?.plan) setPlan(data.plan); });
    supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle().then(({ data }) => {
      const pr = (data?.preferences ?? {}) as Record<string, unknown>;
      setPrefs(pr);
      if (typeof pr["default_country_code"] === "string") setCountryCode(pr["default_country_code"] as string);
    });
  }, [user.id]);

  async function save() {
    setSaving(true); setSaved(false);
    await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
    await supabase.from("profiles").upsert({ id: user.id, full_name: fullName.trim(), preferences: { ...prefs, default_country_code: countryCode } as never });
    setCachedCountryCode(countryCode);
    setSaving(false); setSaved(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell user={user} title="Paramètres">
      <div className="mx-auto max-w-[760px] p-5 lg:p-8">
        <span className="eyebrow">Compte</span>
        <h1 className="mt-2 text-3xl font-extrabold">Paramètres.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Vos informations personnelles et votre abonnement.</p>

        <section className="surface mt-8 rounded-lg p-5">
          <h2 className="font-bold">Profil</h2>
          <label className="mt-4 grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Nom affiché</span><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Votre nom" /></label>
          <label className="mt-4 grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Adresse e-mail</span><Input value={user.email ?? ""} readOnly disabled /></label>
          <label className="mt-4 grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Indicatif pays par défaut</span><select value={countryCode} onChange={e => setCountryCode(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring">{countryCodes.map(c => <option key={c.label} value={c.value}>{c.label}</option>)}</select></label>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
            {saved && <span className="text-xs text-primary">Modifications enregistrées.</span>}
          </div>
        </section>

        <section className="surface mt-6 rounded-lg p-5">
          <h2 className="font-bold">Abonnement</h2>
          <p className="mt-2 text-sm text-muted-foreground">Plan actuel : <span className="font-semibold capitalize text-foreground">{plan}</span></p>
          <Link to="/abonnement" className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Gérer mon abonnement</Link>
        </section>

        <section className="surface mt-6 rounded-lg p-5">
          <h2 className="font-bold">Session</h2>
          <Button variant="ghost" onClick={signOut} className="mt-3 text-muted-foreground"><LogOut /> Se déconnecter</Button>
        </section>
      </div>
    </AppShell>
  );
}
