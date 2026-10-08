import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Pencil, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { prefersReducedMotion } from "@/lib/confetti";
import type { Crm, Prospect } from "@/components/crm";

const GOAL_KEY = "mlm-team-goal";

function useCountUp(target: number) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (prefersReducedMotion()) { setValue(target); return; }
    const from = 0; const start = performance.now(); let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      setValue(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

function hueFor(id: string) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

export function TeamTabs({ tab, onChange, count }: { tab: "prospects" | "team"; onChange: (t: "prospects" | "team") => void; count: number }) {
  return (
    <div role="tablist" className="team-tabs relative inline-grid grid-cols-2 rounded-full border border-border bg-secondary/60 p-1">
      <span aria-hidden className="team-tab-indicator" style={{ transform: tab === "team" ? "translateX(100%)" : "translateX(0)" }} />
      <button role="tab" aria-selected={tab === "prospects"} onClick={() => onChange("prospects")} className={`relative z-10 min-h-11 rounded-full px-5 text-sm font-semibold transition-colors duration-200 ${tab === "prospects" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Prospects</button>
      <button role="tab" aria-selected={tab === "team"} onClick={() => onChange("team")} className={`relative z-10 flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors duration-200 ${tab === "team" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Mon équipe <span className="team-badge">{count}</span></button>
    </div>
  );
}

export function TeamPanel({ crm }: { crm: Crm }) {
  const members = crm.prospects.filter(p => p.status === "client").sort((a, b) => (b.joined_team_at ?? "").localeCompare(a.joined_team_at ?? ""));
  const [goal, setGoal] = useState(10);
  const [editing, setEditing] = useState(false);
  useEffect(() => { const v = Number(localStorage.getItem(GOAL_KEY)); if (v > 0) setGoal(v); }, []);
  const count = useCountUp(members.length);
  const pct = Math.min(100, Math.round((members.length / goal) * 100));
  function saveGoal(v: number) { const g = Math.max(1, Math.min(10000, Math.round(v) || 10)); setGoal(g); localStorage.setItem(GOAL_KEY, String(g)); setEditing(false); }

  return (
    <div className="grid gap-6">
      <section className="team-hero">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Mon équipe</span>
            <h2 className="mt-2 text-2xl font-extrabold">Ton équipe</h2>
          </div>
          <p className="team-count" aria-live="polite">{count}<span className="ml-2 text-base font-semibold text-muted-foreground">{members.length > 1 ? "membres" : "membre"}</span></p>
        </div>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{members.length} / {goal} vers ton objectif</span>
            {editing ? (
              <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); saveGoal(Number(new FormData(e.currentTarget).get("goal"))); }}>
                <Input name="goal" type="number" min={1} defaultValue={goal} className="h-11 w-24" autoFocus aria-label="Objectif de membres" />
                <Button size="sm" className="min-h-11"><Check /> OK</Button>
              </form>
            ) : (
              <button onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary hover:underline"><Pencil className="size-3" /> Modifier l'objectif</button>
            )}
          </div>
          <div className="team-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="team-progress-bar" style={{ width: `${pct}%` }} /></div>
        </div>
      </section>

      {members.length === 0 ? (
        <div className="surface rounded-[20px] px-6 py-14 text-center">
          <div className="team-empty-icon mx-auto"><Users className="size-8" /></div>
          <p className="mx-auto mt-6 max-w-sm text-sm text-muted-foreground">Ton équipe est vide. Quand un prospect devient Client, il apparaît ici.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {members.map((m, i) => <MemberCard key={m.id} member={m} index={i} crm={crm} />)}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member: m, index, crm }: { member: Prospect; index: number; crm: Crm }) {
  const [notes, setNotes] = useState(m.notes ?? "");
  const [saving, setSaving] = useState(false);
  const hue = hueFor(m.id);
  const message = crm.lastMessages[m.id] ?? `Bienvenue dans l'équipe ${m.name.split(" ")[0]} ! 🎉 Je suis là pour t'accompagner à chaque étape.`;
  const since = m.joined_team_at ? new Date(m.joined_team_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "récemment";
  const digits = (m.phone ?? "").replace(/\D/g, "");
  const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  async function copy() {
    try { await navigator.clipboard.writeText(message); toast.success("Message copié"); } catch { toast.error("Copie impossible"); }
  }
  async function save() { setSaving(true); await crm.updateProspect(m.id, { notes: notes.trim() }); setSaving(false); toast.success("Notes enregistrées"); }

  return (
    <article className="member-card" style={{ animationDelay: `${index * 60}ms`, ["--member-hue" as string]: hue }}>
      <div className="flex items-center gap-4">
        <span className="member-avatar">{m.name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{m.name}</p>
          <p className="text-xs text-muted-foreground">{m.phone || "Téléphone non renseigné"}</p>
          <span className="member-badge mt-2"><Star className="size-3 fill-current" /> Membre depuis {since}</span>
        </div>
      </div>
      <label className="mt-4 grid gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Notes</span>
        <Textarea className="min-h-20 resize-none bg-background/60" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Objectifs, besoins, points d'accompagnement…" />
      </label>
      {notes !== (m.notes ?? "") && <div className="mt-2 flex justify-end"><Button size="sm" className="min-h-11" onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></div>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild className="min-h-11 bg-success font-bold text-background hover:bg-success/90">
          <a href={waUrl} target="_blank" rel="noreferrer" onClick={e => { if (digits.length < 8) { e.preventDefault(); toast.error("Numéro invalide"); } }}><MessageCircle /> Envoyer via WhatsApp</a>
        </Button>
        <Button variant="outline" className="min-h-11" onClick={copy}><Copy /> Copier</Button>
      </div>
    </article>
  );
}
