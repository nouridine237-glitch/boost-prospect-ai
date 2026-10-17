import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Apple, ArrowLeft, Eye, EyeOff, Quote, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string | undefined; mode?: "signup" | undefined } => ({
    ...(typeof s["next"] === "string" ? { next: s["next"] } : {}),
    ...(s["mode"] === "signup" ? { mode: "signup" as const } : {}),
  }),
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
  const router = useRouter();
  useEffect(() => { void router.preloadRoute({ to: "/dashboard" }).catch(() => {}); }, [router]);
  const { next: rawNext, mode } = Route.useSearch();
  const next = rawNext ? oauthReturnPath(rawNext) : "";
  const goNext = () => { if (next && next !== "/") window.location.href = next; else navigate({ to: "/dashboard", replace: true }); };
  const returnUrl = () => next && next !== "/" ? new URL(next, window.location.origin).href : window.location.origin;
  const [signup, setSignup] = useState(mode === "signup");
  const [forgot, setForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [pendingEmail, setPendingEmail] = useState("");

  useEffect(() => {
    let done = false;
    const finish = async (user: { id: string; user_metadata?: Record<string, unknown> } | null | undefined) => {
      if (!user || done) return; done = true;
      const meta = user.user_metadata ?? {};
      const name = String(meta["full_name"] ?? meta["name"] ?? "").trim();
      if (name) await supabase.from("profiles").upsert({ id: user.id, full_name: name }).then(() => {}, () => {});
      goNext();
    };
    supabase.auth.getUser().then(({ data }) => finish(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") void finish(session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  function frenchError(msg: string) {
    const m = msg.toLowerCase();
    if (m.includes("invalid login")) return "E-mail ou mot de passe incorrect.";
    if (m.includes("email not confirmed")) return "Votre adresse e-mail n’est pas encore confirmée. Ouvrez le lien reçu par e-mail ou renvoyez-le ci-dessous.";
    if (m.includes("already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cet e-mail. Connectez-vous ou utilisez « Mot de passe oublié ».";
    if (m.includes("password")) return "Mot de passe trop faible : au moins 6 caractères.";
    if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Patientez une minute puis réessayez.";
    if (m.includes("fetch") || m.includes("network")) return "Connexion internet instable. Réessayez.";
    return msg;
  }

  async function resend() {
    if (!pendingEmail) return;
    setLoading(true); setError("");
    const { error: e } = await supabase.auth.resend({ type: "signup", email: pendingEmail, options: { emailRedirectTo: returnUrl() } });
    setLoading(false);
    if (e) setError(frenchError(e.message)); else setMessage(`Nouvel e-mail envoyé à ${pendingEmail}. Pensez à vérifier les spams.`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();
    try {
      if (forgot) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (resetError) setError(frenchError(resetError.message)); else setMessage("Consultez votre boîte mail (et les spams) pour réinitialiser votre mot de passe.");
        return;
      }
      if (signup) {
        const { data, error: signupError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: returnUrl(), data: { full_name: fullName } } });
        if (signupError) { setError(frenchError(signupError.message)); return; }
        if (data.user && data.user.identities?.length === 0) { setError(frenchError("already registered")); return; }
        if (data.session) { await supabase.from("profiles").upsert({ id: data.session.user.id, full_name: fullName }); goNext(); return; }
        setPendingEmail(email);
        setMessage(`Compte créé ! Un lien de confirmation a été envoyé à ${email}. Ouvrez-le (vérifiez aussi les spams) pour accéder à votre espace.`);
        return;
      }
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        setError(frenchError(loginError.message));
        if (loginError.message.toLowerCase().includes("not confirmed")) setPendingEmail(email);
      } else goNext();
    } catch (e) {
      setError(frenchError(e instanceof Error ? e.message : "Erreur inattendue. Réessayez."));
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setLoading(true); setError("");
    let result;
    try { result = await lovable.auth.signInWithOAuth("google", { redirect_uri: returnUrl() }); } catch (e) { setError("Connexion Google impossible. Réessayez ou utilisez votre e-mail."); setLoading(false); return; }
    if (result.error) { setError(frenchError(result.error.message)); setLoading(false); return; }
    if (!result.redirected) goNext();
  }

  async function handleApple() {
    setLoading(true); setError("");
    let result;
    try { result = await lovable.auth.signInWithOAuth("apple", { redirect_uri: returnUrl() }); } catch (e) { setError("Connexion Apple impossible. Réessayez ou utilisez votre e-mail."); setLoading(false); return; }
    if (result.error) { setError(frenchError(result.error.message)); setLoading(false); return; }
    if (!result.redirected) goNext();
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
          {!forgot && <Button variant="outline" className="mt-3 h-11 w-full" onClick={handleApple} disabled={loading}><Apple /> Continuer avec Apple</Button>}
          {!forgot && <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /> OU AVEC VOTRE E-MAIL <span className="h-px flex-1 bg-border" /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {signup && !forgot && <label className="field-label">Nom complet<Input name="fullName" required placeholder="Votre nom" className="mt-2 h-11" /></label>}
            <label className="field-label">Adresse e-mail<Input name="email" type="email" required placeholder="vous@exemple.com" className="mt-2 h-11" /></label>
            {!forgot && <label className="field-label">Mot de passe<div className="relative mt-2"><Input name="password" type={showPassword ? "text" : "password"} required minLength={6} placeholder="••••••••" className="h-11 pr-10" /><button type="button" aria-label="Afficher le mot de passe" className="absolute right-3 top-3 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>}
            {error && <p className="text-sm text-destructive">{error}</p>}{message && <p className="text-sm text-success">{message}</p>}
            {pendingEmail && !forgot && <button type="button" onClick={resend} disabled={loading} className="text-sm text-primary underline">Renvoyer l’e-mail de confirmation</button>}
            <Button className="h-11 w-full" disabled={loading}>{loading ? "Patientez…" : forgot ? "Envoyer le lien" : signup ? "Créer mon compte" : "Se connecter"}</Button>
          </form>
          <div className="mt-5 flex justify-between text-sm"><button className="text-muted-foreground hover:text-foreground" onClick={() => { setSignup(!signup); setForgot(false); setMessage(""); setError(""); }}>{signup ? "J’ai déjà un compte" : "Créer un compte"}</button><button className="text-primary hover:text-primary/80" onClick={() => { setForgot(!forgot); setMessage(""); }}> {forgot ? "Retour" : "Mot de passe oublié ?"}</button></div>
        </div>
      </section>
    </main>
  );
}