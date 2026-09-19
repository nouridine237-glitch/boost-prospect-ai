import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nouveau mot de passe — MLM Boost AI" }, { name: "description", content: "Définissez un nouveau mot de passe sécurisé." }, { property: "og:title", content: "Nouveau mot de passe — MLM Boost AI" }, { property: "og:description", content: "Sécurisez votre compte MLM Boost AI." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate(); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); const password = String(new FormData(event.currentTarget).get("password") ?? ""); const { error: updateError } = await supabase.auth.updateUser({ password }); setLoading(false); if (updateError) setError(updateError.message); else navigate({ to: "/dashboard", replace: true }); }
  return <main className="grid min-h-screen place-items-center bg-background p-6"><div className="w-full max-w-md rounded-xl border border-border bg-card p-7 shadow-card"><Brand /><h1 className="mt-8 text-3xl font-extrabold">Nouveau mot de passe</h1><p className="mt-2 text-sm text-muted-foreground">Choisissez au moins 8 caractères.</p><form className="mt-7 space-y-4" onSubmit={submit}><Input name="password" type="password" minLength={8} required placeholder="Nouveau mot de passe" className="h-11" />{error && <p className="text-sm text-destructive">{error}</p>}<Button className="h-11 w-full" disabled={loading}>{loading ? "Mise à jour…" : "Enregistrer"}</Button></form></div></main>;
}