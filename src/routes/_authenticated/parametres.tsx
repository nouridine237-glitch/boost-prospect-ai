import { usePlan } from "@/hooks/use-plan";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DEFAULT_COACH, readCoachSettings, type CoachSettings } from "@/lib/coach";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { countryCodes, setCachedCountryCode } from "@/components/whatsapp-actions";
import { CaptureSettings } from "@/components/capture-settings";

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
  const { plan } = usePlan(user.id);
  const [countryCode, setCountryCode] = useState("237");
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [coach, setCoach] = useState<CoachSettings>(DEFAULT_COACH);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle().then(({ data }) => {
      const pr = (data?.preferences ?? {}) as Record<string, unknown>;
      setPrefs(pr);
      setCoach(readCoachSettings(pr));
      if (typeof pr["default_country_code"] === "string") setCountryCode(pr["default_country_code"] as string);
    });
  }, [user.id]);

  async function save() {
    setSaving(true); setSaved(false);
    await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
    await supabase.from("profiles").upsert({ id: user.id, full_name: fullName.trim(), preferences: { ...prefs, default_country_code: countryCode, coach } as never });
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
          <h2 className="font-bold">Coach du jour</h2>
          <p className="mt-1 text-xs text-muted-foreground">Enregistré avec le bouton « Enregistrer » du profil.</p>
          <label className="mt-4 grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Missions par jour</span>
            <select value={coach.missions} onChange={e => setCoach(c => ({ ...c, missions: Number(e.target.value) as 3 | 5 | 8 }))} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {[3, 5, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select></label>
          <div className="mt-4"><span className="text-xs font-semibold text-muted-foreground">Jours de repos</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((d, i) => {
                const on = coach.restDays.includes(i);
                return <button key={d} type="button" onClick={() => setCoach(c => ({ ...c, restDays: on ? c.restDays.filter(x => x !== i) : [...c.restDays, i] }))}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{d}</button>;
              })}
            </div></div>
          <label className="mt-4 grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Ton des messages préparés</span>
            <select value={coach.tone} onChange={e => setCoach(c => ({ ...c, tone: e.target.value === "professionnel" ? "professionnel" : "amical" }))} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="amical">Amical</option><option value="professionnel">Professionnel</option>
            </select></label>
          <div className="mt-4"><Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></div>
        </section>

        <CaptureSettings userId={user.id} />

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
