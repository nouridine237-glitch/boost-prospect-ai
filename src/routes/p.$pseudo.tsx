import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPublicCapturePage, submitCaptureLead } from "@/lib/capture.functions";

export const Route = createFileRoute("/p/$pseudo")({
  loader: async ({ params }) => {
    const page = await getPublicCapturePage({ data: { slug: params.pseudo } });
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => {
    const n = loaderData?.page.display_name || "Page indisponible";
    const d = loaderData?.page.tagline || "Laisse tes coordonnées pour être recontacté.";
    return { meta: [
      { title: `${n} — MLM Boost AI` },
      { name: "description", content: d },
      { property: "og:title", content: n },
      { property: "og:description", content: d },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
      ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
    ] };
  },
  notFoundComponent: () => <div className="grid min-h-screen place-items-center p-6 text-center text-muted-foreground">Cette page n'existe pas.</div>,
  component: CapturePage,
});

function CapturePage() {
  const { page } = Route.useLoaderData();
  const { pseudo } = Route.useParams();
  const [form, setForm] = useState({ name: "", phone: "", interest: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");
  const wa = page.whatsapp.replace(/\D/g, "");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (form.name.trim().length < 2) return setErr("Indique ton nom.");
    if (form.phone.replace(/\D/g, "").length < 6) return setErr("Indique un numéro valide.");
    setState("sending");
    try {
      const r = await submitCaptureLead({ data: { slug: pseudo, ...form } });
      if (r.ok) setState("done"); else { setErr(r.message); setState("idle"); }
    } catch { setErr("Vérifie les informations saisies."); setState("idle"); }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          {page.photo_url
            ? <img src={page.photo_url} alt={page.display_name} width={112} height={112} className="mx-auto size-28 rounded-full border-2 border-primary/40 object-cover" />
            : <span className="mx-auto grid size-28 place-items-center rounded-full bg-primary/15 text-4xl font-bold text-primary">{(page.display_name || "?").charAt(0).toUpperCase()}</span>}
          <h1 className="mt-4 text-2xl font-extrabold">{page.display_name}</h1>
          {page.tagline && <p className="mt-2 text-muted-foreground">{page.tagline}</p>}
          {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent("Bonjour, j'ai vu ta page et j'aimerais en savoir plus.")}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#25D366] px-4 font-semibold text-[#0b2e1a]">Écrire sur WhatsApp</a>}
        </div>

        <section className="surface mt-8 rounded-lg p-5">
          {state === "done" ? (
            <div className="py-6 text-center"><CheckCircle2 className="mx-auto size-10 text-primary" /><p className="mt-3 font-semibold">Merci, c'est envoyé !</p><p className="mt-1 text-sm text-muted-foreground">{page.display_name} va te recontacter.</p></div>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <h2 className="font-bold">Laisse tes coordonnées</h2>
              <label className="grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Nom</span><Input className="h-12" maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
              <label className="grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Téléphone</span><Input className="h-12" type="tel" maxLength={30} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
              <label className="grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Ce qui t'intéresse</span><textarea maxLength={300} rows={3} value={form.interest} onChange={e => setForm({ ...form, interest: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" /></label>
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" disabled={state === "sending"} className="h-12">{state === "sending" ? "Envoi…" : "Envoyer"}</Button>
            </form>
          )}
        </section>
        <p className="mt-10 text-center text-xs text-muted-foreground">Page créée avec MLM Boost AI · Aucun revenu garanti.</p>
      </div>
    </main>
  );
}
