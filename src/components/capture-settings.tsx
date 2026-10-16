import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export type CapturePage = { slug: string; display_name: string; tagline: string; whatsapp: string; photo_url: string | null; visits: number; seen_at: string };

export function useCapturePage(userId: string) {
  const [page, setPage] = useState<CapturePage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reload = () => supabase.from("capture_pages").select("slug, display_name, tagline, whatsapp, photo_url, visits, seen_at").eq("user_id", userId).maybeSingle().then(({ data }) => { setPage(data); setLoaded(true); });
  useEffect(() => { void reload(); }, [userId]);
  return { page, loaded, reload };
}

async function resizeImage(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const s = 256, c = document.createElement("canvas"); c.width = s; c.height = s;
  const m = Math.min(img.width, img.height);
  c.getContext("2d")!.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
  return c.toDataURL("image/jpeg", 0.8);
}

export function CaptureSettings({ userId }: { userId: string }) {
  const { page, loaded, reload } = useCapturePage(userId);
  const [f, setF] = useState({ slug: "", display_name: "", tagline: "", whatsapp: "", photo_url: null as string | null });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (page) { setF({ slug: page.slug, display_name: page.display_name, tagline: page.tagline, whatsapp: page.whatsapp, photo_url: page.photo_url }); } }, [page]);

  async function save() {
    const slug = f.slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(slug)) { toast.error("Pseudo : 3 à 30 caractères, lettres minuscules, chiffres ou tirets."); return; }
    setSaving(true);
    const row = { user_id: userId, slug, display_name: f.display_name.trim().slice(0, 80), tagline: f.tagline.trim().slice(0, 160), whatsapp: f.whatsapp.replace(/[^\d+]/g, "").slice(0, 20), photo_url: f.photo_url };
    const { error } = page ? await supabase.from("capture_pages").update(row).eq("user_id", userId) : await supabase.from("capture_pages").insert(row);
    setSaving(false);
    if (error) { toast.error(error.code === "23505" ? "Ce pseudo est déjà pris." : "Enregistrement impossible."); return; }
    toast.success("Page de capture enregistrée"); void reload();
  }

  if (!loaded) return null;
  return (
    <section className="surface mt-6 rounded-lg p-5">
      <h2 className="font-bold">Ma page de capture</h2>
      <p className="mt-1 text-xs text-muted-foreground">Ta page publique : {typeof window !== "undefined" ? window.location.origin : ""}/p/{f.slug || "ton-pseudo"}</p>
      <div className="mt-4 flex items-center gap-4">
        {f.photo_url ? <img src={f.photo_url} alt="" width={64} height={64} className="size-16 rounded-full object-cover" /> : <span className="grid size-16 place-items-center rounded-full bg-primary/15 font-bold text-primary">{(f.display_name || "?").charAt(0).toUpperCase()}</span>}
        <label className="cursor-pointer text-sm font-semibold text-primary">Changer la photo<input type="file" accept="image/*" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (file) { try { setF({ ...f, photo_url: await resizeImage(file) }); } catch { toast.error("Image illisible"); } } }} /></label>
        {f.photo_url && <button type="button" className="text-xs text-muted-foreground" onClick={() => setF({ ...f, photo_url: null })}>Retirer</button>}
      </div>
      <label className="mt-4 grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Pseudo (adresse de la page)</span><Input value={f.slug} maxLength={30} onChange={e => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="nouridine" /></label>
      <label className="mt-4 grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Nom affiché</span><Input value={f.display_name} maxLength={80} onChange={e => setF({ ...f, display_name: e.target.value })} /></label>
      <label className="mt-4 grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Phrase d'accroche</span><Input value={f.tagline} maxLength={160} onChange={e => setF({ ...f, tagline: e.target.value })} placeholder="Je t'aide à découvrir nos produits bien-être." /></label>
      <label className="mt-4 grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Numéro WhatsApp (avec indicatif)</span><Input value={f.whatsapp} type="tel" maxLength={20} onChange={e => setF({ ...f, whatsapp: e.target.value })} placeholder="237641313407" /></label>
      <Button onClick={save} disabled={saving} className="mt-4">{saving ? "Enregistrement…" : "Enregistrer ma page"}</Button>
    </section>
  );
}

export function CaptureLeadsNotice({ userId }: { userId: string }) {
  const { page, reload } = useCapturePage(userId);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!page) return;
    supabase.from("prospects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("source", "Page de capture").gt("created_at", page.seen_at).then(({ count }) => setN(count ?? 0));
  }, [page, userId]);
  if (!page || n === 0) return null;
  const dismiss = async () => { await supabase.from("capture_pages").update({ seen_at: new Date().toISOString() }).eq("user_id", userId); setN(0); void reload(); };
  return (
    <div className="surface mb-6 flex items-center gap-3 rounded-lg border-primary/40 p-4">
      <Inbox className="size-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm"><strong>{n} nouveau{n > 1 ? "x" : ""} prospect{n > 1 ? "s" : ""}</strong> via ta page de capture.</p>
      <Link to="/prospects" onClick={dismiss} className="text-sm font-semibold text-primary">Voir</Link>
      <button onClick={dismiss} aria-label="Masquer" className="text-muted-foreground"><X className="size-4" /></button>
    </div>
  );
}
