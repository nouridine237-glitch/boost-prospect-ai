import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Loader2, MessageCircle, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/use-plan";
import { generateProspectingContent } from "@/lib/ai.functions";
import { localDay } from "@/lib/coach";
import {
  addDays, canPlace, CHANNELS, dayLabel, dbError, generationContext, MAX_BODY, mondayOf, OBJECTIVES, SLOTS, STATUSES, validatePost, weekDays, weekLimit,
  contentPostsKey, type Post, type PostDraft,
} from "@/lib/content-planner";

export const Route = createFileRoute("/_authenticated/planificateur")({
  head: () => ({ meta: [
    { title: "Planificateur de statuts — MLM Boost AI" },
    { name: "description", content: "Planifiez vos statuts WhatsApp et Facebook de la semaine, publiés par vous-même." },
    { property: "og:title", content: "Planificateur de statuts — MLM Boost AI" },
    { property: "og:description", content: "Calendrier hebdomadaire, brouillons, génération IA à la demande et publication manuelle." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PlannerPage,
});

const COLS = "id, channel, objective, body, planned_on, slot, status, published_at";

function PlannerPage() {
  const { user } = Route.useRouteContext();
  const plan = usePlan(user.id);
  const qc = useQueryClient();
  const today = localDay();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const [editing, setEditing] = useState<(PostDraft & { id?: string }) | null>(null);
  const days = weekDays(monday);

  const posts = useQuery({
    queryKey: [...contentPostsKey(user.id), monday],
    queryFn: async () => {
      // Fenêtre élargie : la limite hebdomadaire se calcule sur la semaine affichée.
      const { data, error } = await supabase.from("content_posts").select(COLS).eq("user_id", user.id).gte("planned_on", monday).lt("planned_on", addDays(monday, 7)).order("planned_on").order("slot");
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });
  const list = posts.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: contentPostsKey(user.id) });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PostDraft> }) => {
      const { error } = await supabase.from("content_posts").update(patch).eq("id", id).eq("user_id", user.id);
      if (error) throw new Error(dbError(error.message));
    },
    onSuccess: invalidate, onError: e => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_posts").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw new Error(dbError(error.message));
    },
    onSuccess: () => { void invalidate(); toast.success("Statut supprimé"); }, onError: e => toast.error(e.message),
  });

  const limit = weekLimit(plan.plan);
  const full = !canPlace(list, monday, plan.plan);
  const newPost = (day: string) => setEditing({ channel: "whatsapp", objective: "notoriete", body: "", planned_on: day, slot: "matin", status: "brouillon" });

  return <AppShell user={user} title="Planificateur">
    <div className="mx-auto max-w-3xl p-5 lg:p-8">
      <span className="eyebrow">Organisation</span>
      <h1 className="mt-2 text-3xl font-extrabold">Planificateur de statuts</h1>
      <p className="mt-2 text-sm text-muted-foreground">Préparez vos statuts WhatsApp et Facebook. Vous les publiez vous-même : rien n'est envoyé automatiquement.</p>

      <div className="mt-6 flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" className="size-11" aria-label="Semaine précédente" onClick={() => setMonday(addDays(monday, -7))}><ChevronLeft /></Button>
        <div className="text-center"><p className="font-semibold">Semaine du {dayLabel(monday).replace(/^\S+ /, "")}</p>
          <p className="text-xs text-muted-foreground">{list.length}/{limit} statuts cette semaine{monday !== mondayOf(today) && <> · <button className="text-primary underline" onClick={() => setMonday(mondayOf(today))}>Aujourd'hui</button></>}</p></div>
        <Button variant="outline" size="icon" className="size-11" aria-label="Semaine suivante" onClick={() => setMonday(addDays(monday, 7))}><ChevronRight /></Button>
      </div>
      {full && plan.plan === "gratuit" && <div className="mt-4 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">Le plan Gratuit permet {limit} statuts par semaine. <Link to="/abonnement" className="font-semibold text-primary underline">Voir les plans</Link></div>}
      {posts.isError && <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Impossible de charger vos statuts. <button className="underline" onClick={() => void posts.refetch()}>Réessayer</button></p>}

      <ol className="mt-5 space-y-3">{days.map(day => {
        const items = list.filter(p => p.planned_on === day);
        const isToday = day === today;
        return <li key={day} className={`surface rounded-lg p-4 ${isToday ? "border-primary ring-1 ring-primary" : ""}`} aria-current={isToday ? "date" : undefined}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold first-letter:uppercase">{dayLabel(day)}{isToday && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Aujourd'hui</span>}</p>
            <Button size="sm" variant="ghost" className="min-h-11" disabled={full} onClick={() => newPost(day)} aria-label={`Ajouter un statut le ${dayLabel(day)}`}><Plus className="size-4" />Ajouter</Button>
          </div>
          {posts.isLoading ? <p className="mt-2 text-xs text-muted-foreground">Chargement…</p>
            : !items.length ? <p className="mt-2 text-xs text-muted-foreground">Aucun statut prévu.</p>
            : <ul className="mt-3 space-y-3">{items.map(p => <PostCard key={p.id} p={p} busy={update.isPending || remove.isPending}
                onEdit={() => setEditing(p)} onDelete={() => { if (confirm("Supprimer ce statut ?")) remove.mutate(p.id); }}
                onPublish={() => update.mutate({ id: p.id, patch: { status: "publie" } }, { onSuccess: () => toast.success("Marqué comme publié") })}
                onDuplicate={() => setEditing({ channel: p.channel, objective: p.objective, body: p.body, planned_on: addDays(p.planned_on, 7), slot: p.slot, status: "brouillon" })} />)}</ul>}
        </li>;
      })}</ol>
      <p className="mt-8 text-center text-xs text-muted-foreground">Aucun revenu garanti — publication manuelle par vous-même</p>
    </div>
    {editing && <PostEditor userId={user.id} initial={editing} plan={plan.plan} weekPosts={list} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void invalidate(); }} />}
  </AppShell>;
}

function PostCard({ p, busy, onEdit, onDelete, onPublish, onDuplicate }: { p: Post; busy: boolean; onEdit: () => void; onDelete: () => void; onPublish: () => void; onDuplicate: () => void }) {
  const copy = async () => { try { await navigator.clipboard.writeText(p.body); toast.success("Texte copié"); } catch { toast.error("Copie impossible"); } };
  const badge = p.status === "publie" ? "bg-primary/15 text-primary" : p.status === "prevu" ? "bg-secondary text-foreground" : "border border-dashed border-border text-muted-foreground";
  return <li className="rounded-md border border-border bg-secondary/40 p-3">
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className={`rounded-full px-2 py-0.5 font-semibold ${badge}`}>{STATUSES[p.status as keyof typeof STATUSES]}</span>
      <span className="text-muted-foreground">{SLOTS[p.slot as keyof typeof SLOTS]} · {CHANNELS[p.channel as keyof typeof CHANNELS]} · {OBJECTIVES[p.objective as keyof typeof OBJECTIVES]}</span>
    </div>
    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm">{p.body || <span className="italic text-muted-foreground">Brouillon sans texte</span>}</p>
    {p.published_at && <p className="mt-1 text-[11px] text-muted-foreground">Publié le {new Date(p.published_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {p.body && <Button size="sm" variant="outline" className="min-h-11" onClick={copy}><Copy className="size-4" />Copier</Button>}
      {p.body && p.channel === "whatsapp" && <Button size="sm" variant="outline" className="min-h-11" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(p.body)}`, "_blank", "noopener,noreferrer")}><MessageCircle className="size-4" />Ouvrir WhatsApp</Button>}
      {p.status !== "publie" && p.body.trim() && <Button size="sm" className="min-h-11" disabled={busy} onClick={onPublish}><Check className="size-4" />Marquer comme publié</Button>}
      <Button size="sm" variant="ghost" className="min-h-11" onClick={onEdit} aria-label="Modifier"><Pencil className="size-4" />Modifier</Button>
      <Button size="sm" variant="ghost" className="min-h-11" onClick={onDuplicate} aria-label="Réutiliser la semaine suivante">Réutiliser</Button>
      <Button size="sm" variant="ghost" className="min-h-11 text-destructive" disabled={busy} onClick={onDelete} aria-label="Supprimer"><Trash2 className="size-4" /></Button>
    </div>
  </li>;
}

function Select<K extends string>({ label, value, options, onChange }: { label: string; value: string; options: Record<K, string>; onChange: (v: K) => void }) {
  return <label className="block text-sm font-semibold">{label}
    <select value={value} onChange={e => onChange(e.target.value as K)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-normal">
      {(Object.keys(options) as K[]).map(k => <option key={k} value={k}>{options[k]}</option>)}
    </select></label>;
}

function PostEditor({ userId, initial, plan, weekPosts, onClose, onSaved }: { userId: string; initial: PostDraft & { id?: string }; plan: string; weekPosts: Post[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<PostDraft>(initial);
  const [idea, setIdea] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generate = useServerFn(generateProspectingContent);
  const set = <K extends keyof PostDraft>(k: K, v: PostDraft[K]) => setD(x => ({ ...x, [k]: v }));

  async function onGenerate() {
    if (generating) return;
    setGenerating(true); setError(null);
    try {
      const { text } = await generate({ data: { mode: "Post réseau social", context: generationContext(d, idea) } });
      set("body", text.trim().slice(0, MAX_BODY));
      toast.success("Texte généré : relisez-le avant d'enregistrer");
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur réseau, réessayez."); }
    finally { setGenerating(false); }
  }

  async function onSave() {
    const err = validatePost(d);
    if (err) { setError(err); return; }
    // Vérification locale de la limite si on change de semaine ; la base revérifie toujours.
    if ((!initial.id || initial.planned_on !== d.planned_on) && mondayOf(d.planned_on) === mondayOf(initial.planned_on) && !canPlace(weekPosts, d.planned_on, plan, initial.id)) { setError("Limite hebdomadaire atteinte pour votre plan."); return; }
    setSaving(true); setError(null);
    const row = { channel: d.channel, objective: d.objective, body: d.body, planned_on: d.planned_on, slot: d.slot, status: d.status };
    const { error: e } = initial.id
      ? await supabase.from("content_posts").update(row).eq("id", initial.id).eq("user_id", userId)
      : await supabase.from("content_posts").insert({ ...row, user_id: userId });
    setSaving(false);
    if (e) { setError(dbError(e.message)); return; }
    toast.success("Statut enregistré"); onSaved();
  }

  return <Dialog open onOpenChange={o => { if (!o && !saving && !generating) onClose(); }}>
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" />{initial.id ? "Modifier le statut" : "Nouveau statut"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold">Date<input type="date" value={d.planned_on} onChange={e => set("planned_on", e.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" /></label>
          <Select label="Créneau" value={d.slot} options={SLOTS} onChange={v => set("slot", v)} />
          <Select label="Canal" value={d.channel} options={CHANNELS} onChange={v => set("channel", v)} />
          <Select label="Objectif" value={d.objective} options={OBJECTIVES} onChange={v => set("objective", v)} />
        </div>
        <Select label="État" value={d.status} options={STATUSES} onChange={v => set("status", v)} />
        <div className="rounded-md border border-border p-3">
          <label className="block text-sm font-semibold">Idée pour l'IA (facultatif)
            <input value={idea} maxLength={300} onChange={e => setIdea(e.target.value)} placeholder="Ex. : témoignage d'une cliente satisfaite du produit X" className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" /></label>
          <Button type="button" variant="outline" className="mt-2 min-h-11 w-full" disabled={generating || saving} onClick={() => void onGenerate()}>
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{generating ? "Génération…" : "Générer avec l'Assistant (1 génération IA)"}</Button>
        </div>
        <label className="block text-sm font-semibold">Texte du statut
          <Textarea value={d.body} maxLength={MAX_BODY} rows={6} onChange={e => set("body", e.target.value)} className="mt-1 font-normal" /></label>
        <p className="text-right text-xs text-muted-foreground">{d.body.length}/{MAX_BODY}</p>
        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}{/plan/.test(error) && <> <Link to="/abonnement" className="font-semibold underline">Voir les plans</Link></>}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="min-h-11" onClick={onClose} disabled={saving || generating}>Annuler</Button>
          <Button className="min-h-11" onClick={() => void onSave()} disabled={saving || generating}>{saving && <Loader2 className="size-4 animate-spin" />}Enregistrer</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
