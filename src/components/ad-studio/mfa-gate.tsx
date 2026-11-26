import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StudioMfaGate({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.auth.mfa.listFactors().then(({ data, error: failure }) => {
      if (!alive) return;
      if (failure) setError("Impossible de consulter la double authentification.");
      else setFactorId(data?.totp.find((factor) => factor.status === "verified")?.id ?? null);
    });
    return () => { alive = false; };
  }, []);

  async function enroll() {
    setBusy(true); setError("");
    try {
      const { data, error: failure } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Admin Ad Studio" });
      if (failure || !data) throw new Error("Impossible de préparer l'authentification. Réessaie ou vérifie tes facteurs existants.");
      setFactorId(data.id); setQr(data.totp.qr_code);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Activation impossible."); }
    finally { setBusy(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true); setError("");
    try {
      const { error: failure } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (failure) throw new Error("Code refusé ou expiré. Saisis le code actuel de ton application d'authentification.");
      setQr(null); setCode(""); onVerified();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérification impossible."); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-lg border-t border-border py-8">
    <ShieldCheck className="mb-4 size-9 text-primary" />
    <h2 className="text-xl font-semibold">Double authentification requise</h2>
    <p className="mt-2 text-sm text-muted-foreground">L'accès à l'atelier publicitaire nécessite un code d'une application d'authentification.</p>
    {qr && <div className="my-5"><img src={qr} alt="QR code privé de configuration de l'authentification" className="size-52 max-w-full rounded-md" /><p className="mt-2 text-xs text-muted-foreground">Scanne ce code dans ton application d'authentification. Ne le partage pas.</p></div>}
    {!factorId ? <Button onClick={enroll} disabled={busy} className="mt-5 h-11">{busy && <Loader2 className="animate-spin" />}Configurer la double authentification</Button> :
      <form onSubmit={verify} className="mt-5 space-y-3">
        <label htmlFor="studio-mfa" className="block text-sm font-medium">Code à 6 chiffres</label>
        <Input id="studio-mfa" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required className="h-11" />
        <Button type="submit" disabled={busy || code.length !== 6} className="h-11">{busy && <Loader2 className="animate-spin" />}Vérifier et ouvrir l'atelier</Button>
      </form>}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  </section>;
}