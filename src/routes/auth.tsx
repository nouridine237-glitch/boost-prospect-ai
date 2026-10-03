import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Quote, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Connexion — MLM Boost AI" },
    { name: "description", content: "Connectez-vous à votre espace de prospection MLM Boost AI." },
    { property: "og:title", content: "Connexion — MLM Boost AI" },
    { property: "og:description", content: "Accédez à votre assistant et à votre suivi de prospects." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [signup, setSignup] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "");
    if (forgot) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setLoading(false); setMessage(resetError ? "" : "Consultez votre boîte mail pour réinitialiser votre mot de passe."); setError(resetError?.message ?? ""); return;
    }
    if (signup) {
      const { data, error: signupError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } } });
      if (!signupError && data.user) await supabase.from("profiles").upsert({ id: data.user.id, full_name: fullName });
      setLoading(false); setError(signupError?.message ?? ""); setMessage(signupError ? "" : "Compte créé. Confirmez votre adresse e-mail pour continuer."); return;
    }
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) { setLoading(false); setError(loginError.message); return; }
    await waitForSession();
    setLoading(false);
    navigate({ to: "/dashboard", replace: true });
  }

  // Attend que la session soit bien persistée avant de naviguer vers une route protégée.
  async function waitForSession() {
    for (let i = 0; i < 20; i++) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  }

  async function handleGoogle() {
    setLoading(true); setError("");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { setError(result.error.message); setLoading(false); return; }
    if (!result.redirected) {
      await waitForSession();
      setLoading(false);
      navigate({ to: "/dashboard", replace: true });
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_.95fr]">
      <section className="auth-visual relative hidden overflow-hidden border-r border-border p-12 lg:flex lg:flex-col lg:justify-between">
        <Brand />
        <div className="relative z-10 max-w-xl">
          <Quote className="mb-7 size-9 text-primary" />
          <h1 className="text-5xl font-extrabold leading-[1.08]">Transformez chaque conversation en opportunité.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Organisez votre prospection, trouvez les bons mots et gardez le cap sur vos relations.</p>
          <div className="mt-10 flex items-center gap-3 text-sm text-muted-foreground"><span className="flex -space-x-2"><i className="avatar-dot" /><i className="avatar-dot avatar-dot-two" /><i className="avatar-dot avatar-dot-three" /></span> Rejoignez les networkers qui prospectent mieux.</div>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 MLM Boost AI</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" /> Retour à l’accueil</Link>
          <div className="mb-8 lg:hidden"><Brand /></div>
          <span className="eyebrow">{forgot ? "Récupération" : signup ? "Nouveau compte" : "Bon retour"}</span>
          <h2 className="mt-3 text-3xl font-extrabold">{forgot ? "Mot de passe oublié" : signup ? "Créer votre espace" : "Connectez-vous"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{forgot ? "Nous vous envoyons un lien sécurisé." : "Continuez votre prospection là où vous l’avez laissée."}</p>
          {!forgot && <Button variant="outline" className="mt-7 h-11 w-full" onClick={handleGoogle} disabled={loading}><Sparkles /> Continuer avec Google</Button>}
          {!forgot && <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> OU AVEC VOTRE E-MAIL <span className="h-px flex-1 bg-border" /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {signup && !forgot && <label className="field-label">Nom complet<Input name="fullName" required placeholder="Votre nom" className="mt-2 h-11" /></label>}
            <label className="field-label">Adresse e-mail<Input name="email" type="email" required placeholder="vous@exemple.com" className="mt-2 h-11" /></label>
            {!forgot && <label className="field-label">Mot de passe<div className="relative mt-2"><Input name="password" type={showPassword ? "text" : "password"} required minLength={6} placeholder="••••••••" className="h-11 pr-10" /><button type="button" aria-label="Afficher le mot de passe" className="absolute right-3 top-3 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>}
            {error && <p className="text-sm text-destructive">{error}</p>}{message && <p className="text-sm text-success">{message}</p>}
            <Button className="h-11 w-full" disabled={loading}>{loading ? "Patientez…" : forgot ? "Envoyer le lien" : signup ? "Créer mon compte" : "Se connecter"}</Button>
          </form>
          <div className="mt-5 flex justify-between text-sm"><button className="text-muted-foreground hover:text-foreground" onClick={() => { setSignup(!signup); setForgot(false); setMessage(""); }}>{signup ? "J’ai déjà un compte" : "Créer un compte"}</button><button className="text-primary hover:text-primary/80" onClick={() => { setForgot(!forgot); setMessage(""); }}> {forgot ? "Retour" : "Mot de passe oublié ?"}</button></div>
        </div>
      </section>
    </main>
  );
}