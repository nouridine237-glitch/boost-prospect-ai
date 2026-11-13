import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adminDismissReport, adminListVideoReports, adminModerateCourse, adminModerateVideo } from "@/lib/videotheque.functions";

type Target = { kind: "video"; videoId: string; title: string } | { kind: "course"; courseId: string; title: string; people: number };

/** Signalements : retirer la vidéo (seule sa leçon devient indisponible), retirer toute une formation (action distincte) ou rejeter. */
export function AdminVideoReports() {
  const list = useServerFn(adminListVideoReports);
  const moderate = useServerFn(adminModerateVideo);
  const moderateCourse = useServerFn(adminModerateCourse);
  const dismiss = useServerFn(adminDismissReport);
  const q = useQuery({ queryKey: ["admin", "video-reports"], queryFn: () => list() });
  const qc = useQueryClient();
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState("");
  const open = (t: Target) => { setTarget(t); setReason(""); };
  const confirm = async () => {
    if (!target) return;
    try {
      if (target.kind === "video") { await moderate({ data: { videoId: target.videoId, reason } }); toast.success("Vidéo retirée : seule sa leçon est indisponible"); }
      else { const r = await moderateCourse({ data: { courseId: target.courseId, reason } }); toast.success(`Formation retirée · ${r.revoked} accès coupé${r.revoked > 1 ? "s" : ""}`); }
      qc.invalidateQueries({ queryKey: ["admin", "video-reports"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Retrait impossible."); }
  };
  return (
    <section className="surface mt-6 rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-bold"><ShieldAlert className="size-5 text-primary" />Vidéos signalées</h2>
      {q.isLoading ? <div className="mt-3 h-12 animate-pulse rounded bg-muted" /> : !q.data?.length ? <p className="mt-2 text-sm text-muted-foreground">Aucun signalement ouvert.</p> : (
        <ul className="mt-3 divide-y divide-border/50 text-sm">
          {q.data.map((r) => (
            <li key={r.id} className="py-3">
              <p className="font-semibold">{r.title} <span className="font-normal text-muted-foreground">· {r.owner}</span></p>
              <p className="mt-1 text-muted-foreground">{r.reason}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="destructive" className="min-h-10" onClick={() => open({ kind: "video", videoId: r.videoId, title: r.title })}>Retirer la vidéo</Button>
                <Button size="sm" variant="outline" className="min-h-10" onClick={async () => { await dismiss({ data: { id: r.id } }); qc.invalidateQueries({ queryKey: ["admin", "video-reports"] }); }}>Rejeter</Button>
              </div>
              {r.courses.length > 0 && (
                <div className="mt-3 rounded-xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">Formations partagées qui contiennent cette vidéo :</p>
                  <ul className="mt-2 space-y-2">
                    {r.courses.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0"><span className="font-medium">{c.title}</span> <span className="text-xs text-muted-foreground">· {c.people} personne{c.people > 1 ? "s" : ""}</span></span>
                        <Button size="sm" variant="outline" className="min-h-10 border-destructive/50 text-destructive hover:text-destructive" onClick={() => open({ kind: "course", courseId: c.id, title: c.title, people: c.people })}>Retirer toute la formation</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{target?.kind === "course" ? `Retirer toute la formation « ${target.title} » ?` : `Retirer la vidéo « ${target?.title} » ?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.kind === "course"
                ? `Cette action coupe l'accès de ${target.people} personne${target.people > 1 ? "s" : ""} et archive la formation. Elle ne peut pas être annulée.`
                : "Le fichier est supprimé définitivement. Seule la leçon qui utilise cette vidéo devient indisponible : le reste des formations et les accès restent en place."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (obligatoire)" aria-label="Motif" />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={reason.trim().length < 5} onClick={confirm}>{target?.kind === "course" ? "Retirer la formation" : "Retirer la vidéo"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
