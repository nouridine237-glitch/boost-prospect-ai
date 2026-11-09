import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adminDismissReport, adminListVideoReports, adminModerateVideo } from "@/lib/videotheque.functions";

/** Signalements de vidéos : retrait (coupe tous les accès, supprime le fichier) ou rejet. */
export function AdminVideoReports() {
  const list = useServerFn(adminListVideoReports);
  const moderate = useServerFn(adminModerateVideo);
  const dismiss = useServerFn(adminDismissReport);
  const q = useQuery({ queryKey: ["admin", "video-reports"], queryFn: () => list() });
  const qc = useQueryClient();
  const [target, setTarget] = useState<{ videoId: string; title: string } | null>(null);
  const [reason, setReason] = useState("");
  return (
    <section className="surface mt-6 rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-bold"><ShieldAlert className="size-5 text-primary" />Vidéos signalées</h2>
      {q.isLoading ? <div className="mt-3 h-12 animate-pulse rounded bg-muted" /> : !q.data?.length ? <p className="mt-2 text-sm text-muted-foreground">Aucun signalement ouvert.</p> : (
        <ul className="mt-3 divide-y divide-border/50 text-sm">
          {q.data.map((r) => (
            <li key={r.id} className="py-3">
              <p className="font-semibold">{r.title} <span className="font-normal text-muted-foreground">· {r.owner}</span></p>
              <p className="mt-1 text-muted-foreground">{r.reason}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => { setTarget({ videoId: r.videoId, title: r.title }); setReason(""); }}>Retirer la vidéo</Button>
                <Button size="sm" variant="outline" onClick={async () => { await dismiss({ data: { id: r.id } }); qc.invalidateQueries({ queryKey: ["admin", "video-reports"] }); }}>Rejeter</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer « {target?.title} » ?</AlertDialogTitle>
            <AlertDialogDescription>Le fichier est supprimé définitivement et tous les accès aux formations qui la contiennent sont coupés. C'est la seule exception à l'accès permanent.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (obligatoire)" />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={reason.trim().length < 5} onClick={async () => {
              if (!target) return;
              try { await moderate({ data: { videoId: target.videoId, reason } }); toast.success("Vidéo retirée"); qc.invalidateQueries({ queryKey: ["admin", "video-reports"] }); }
              catch { toast.error("Retrait impossible."); }
            }}>Retirer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
