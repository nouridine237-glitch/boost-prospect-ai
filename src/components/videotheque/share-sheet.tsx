import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Share2, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ShareSummary } from "./ui-bits";
import { shareCourse, shareTargets } from "@/lib/videotheque.functions";
import { GRANT_STATUS_LABEL, vtError } from "@/lib/videotheque";

/** Partage explicite : toute l'équipe ou membres choisis, droit de repartager par case (propriétaire seulement). */
export function ShareSheet({ courseId, open, onOpenChange }: { courseId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const fetchTargets = useServerFn(shareTargets);
  const share = useServerFn(shareCourse);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["videotheque", "targets", courseId], queryFn: () => fetchTargets({ data: { courseId } }), enabled: open });
  const [mode, setMode] = useState<"equipe" | "direct">("equipe");
  const [picked, setPicked] = useState<string[]>([]);
  const [reshare, setReshare] = useState(false);
  const [busy, setBusy] = useState(false);
  const available = (q.data?.members ?? []).filter((m) => !m.status || m.status === "refuse" || m.status === "revoque_proprietaire");
  const isOwner = q.data?.mode === "owner";
  const recipients = mode === "equipe" ? available.map((m) => m.id) : picked;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Partager la formation</SheetTitle>
          <SheetDescription>Chaque personne reçoit une invitation à accepter. La version publiée actuelle est partagée.</SheetDescription>
        </SheetHeader>
        {q.isLoading ? <div className="mt-4 h-32 animate-pulse rounded-2xl bg-muted" /> : q.data?.mode === "none" ? (
          <p className="mt-4 text-sm text-muted-foreground">Tu n'as pas l'autorisation de partager cette formation.</p>
        ) : !q.data?.members.length ? (
          <p className="mt-4 text-sm text-muted-foreground">Aucun membre actif dans ton équipe. Invite des partenaires depuis « Former mon équipe ».</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {([["equipe", `Toute l'équipe (${available.length})`], ["direct", "Choisir des membres"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors duration-150 ${mode === k ? "border-primary/60 bg-primary/12" : "border-border/60 text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
            <ul className="space-y-1">
              {q.data.members.map((m) => {
                const can = available.some((a) => a.id === m.id);
                return (
                  <li key={m.id}>
                    <label className={`flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm ${!can ? "opacity-60" : ""}`}>
                      {mode === "direct" && <Checkbox disabled={!can} checked={picked.includes(m.id)} onCheckedChange={(v) => setPicked((p) => v ? [...p, m.id] : p.filter((x) => x !== m.id))} />}
                      <Users className="size-4 text-muted-foreground" />
                      <span className="flex-1">{m.name}{q.data.mode === "reshare" && <span className="ml-1 text-xs text-muted-foreground">· {m.group}</span>}</span>
                      {m.status && <span className="text-xs text-muted-foreground">{GRANT_STATUS_LABEL[m.status]}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
            {isOwner && (
              <label className="surface flex items-start gap-3 rounded-xl p-3 text-sm">
                <Switch checked={reshare} onCheckedChange={setReshare} className="mt-0.5" />
                <span><span className="font-semibold">Peut repartager</span><span className="block text-xs text-muted-foreground">Ces personnes pourront à leur tour la partager à leurs propres membres ou aux membres de ton équipe, sans pouvoir donner ce droit plus loin.</span></span>
              </label>
            )}
            <ShareSummary count={recipients.length} reshare={isOwner && reshare} />
            <div className="sticky bottom-0 -mx-6 bg-background/95 px-6 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur">
            <Button className="min-h-11 w-full" disabled={!recipients.length || busy} onClick={async () => {
              setBusy(true);
              try {
                const r = await share({ data: { courseId, recipients, canReshare: isOwner && reshare, origin: mode } });
                toast.success(r.invited ? `${r.invited} invitation${r.invited > 1 ? "s" : ""} envoyée${r.invited > 1 ? "s" : ""}` : "Ces personnes ont déjà reçu la formation.");
                qc.invalidateQueries({ queryKey: ["videotheque"] }); setPicked([]); onOpenChange(false);
              } catch (e) { toast.error(vtError(e, "Partage impossible.")); } finally { setBusy(false); }
            }}><Share2 className="size-4" />Partager à {recipients.length} personne{recipients.length > 1 ? "s" : ""}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
