import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, Film, MoreHorizontal, Pencil, Play, Plus, RotateCcw, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AcademyTabs, CardSkeletons, EmptyState, ErrorLine } from "@/components/videotheque/academy-tabs";
import { StorageMeter, VideoStatusBadge } from "@/components/videotheque/ui-bits";
import { UploadSheet } from "@/components/videotheque/upload-sheet";
import { FilePlayer } from "@/components/videotheque/file-player";
import { UpgradeCard } from "@/components/plan-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORIES, categoryLabel, formatBytes, formatDuration } from "@/lib/videotheque";
import { archiveVideo, getOwnVideoUrl, listMyVideos, restoreVideo, updateVideoMeta, type MyVideo } from "@/lib/videotheque.functions";

export const videosQuery = queryOptions({ queryKey: ["videotheque", "videos"], queryFn: () => listMyVideos() });

export const Route = createFileRoute("/_authenticated/academie_/videos")({
  head: () => ({ meta: [
    { title: "Ma vidéothèque — Académie MLM Boost AI" },
    { name: "description", content: "Importe tes propres vidéos de formation depuis ton téléphone et organise-les." },
    { property: "og:title", content: "Ma vidéothèque — MLM Boost AI" },
    { property: "og:description", content: "Tes vidéos de formation privées, prêtes à être utilisées dans tes formations." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: VideosPage,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  envoi: { label: "Envoi", cls: "bg-primary/15 text-primary" },
  pret: { label: "Prête", cls: "bg-success/15 text-success" },
  echec: { label: "Échec", cls: "bg-destructive/15 text-destructive" },
};

function VideosPage() {
  const { user } = Route.useRouteContext();
  const q = useQuery(videosQuery);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState<MyVideo | null>(null);
  const [archive, setArchive] = useState<MyVideo | null>(null);
  const [preview, setPreview] = useState<MyVideo | null>(null);
  const qc = useQueryClient();
  const archiveFn = useServerFn(archiveVideo);
  const restoreFn = useServerFn(restoreVideo);
  const urlFn = useServerFn(getOwnVideoUrl);

  const list = useMemo(() => (q.data?.videos ?? []).filter((v) => v.status !== "echec" || !v.archived)
    .filter((v) => showArchived ? v.archived : !v.archived)
    .filter((v) => !cat || v.category === cat)
    .filter((v) => !search.trim() || v.title.toLowerCase().includes(search.trim().toLowerCase())), [q.data, cat, search, showArchived]);

  const d = q.data;
  
  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[1100px] p-5 pb-28 sm:pb-5 lg:p-8">
        <span className="eyebrow">Académie</span>
        <h1 className="mt-2 text-3xl font-extrabold">Ma vidéothèque</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tes vidéos restent privées. Tu choisis ensuite lesquelles utiliser dans tes formations.</p>
        <AcademyTabs />

        {q.isLoading ? <CardSkeletons /> : q.isError ? <ErrorLine text="Vidéos indisponibles pour le moment." onRetry={() => q.refetch()} /> : d && !d.canImport && !d.videos.length ? (
          <div className="mt-6"><UpgradeCard minPlan="pro">Importe tes propres vidéos de formation et partage-les avec ton équipe.</UpgradeCard></div>
        ) : d ? (
          <>
            <div className="surface mt-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
              <StorageMeter used={d.usedBytes} total={d.quota.totalBytes} />
              {d.canImport ? <Button className="hidden min-h-11 sm:inline-flex" onClick={() => setOpen(true)}><Plus className="size-4" />Ajouter une vidéo</Button>
                : <p className="text-xs text-muted-foreground">Import disponible à partir du plan Pro. Tes vidéos existantes restent consultables.</p>}
            </div>

            {d.videos.length > 0 && (
              <div className="mt-4 space-y-3">
                <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un titre" className="min-h-11 pl-9" aria-label="Rechercher" /></label>
                <div className="-mx-5 overflow-x-auto px-5"><div className="flex w-max gap-2">
                  {[{ key: null, label: "Toutes" }, ...CATEGORIES].map((c) => (
                    <button key={String(c.key)} type="button" onClick={() => setCat(c.key)} aria-pressed={cat === c.key}
                      className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${cat === c.key ? "border-primary/60 bg-primary/12" : "border-border/60 text-muted-foreground"}`}>{c.label}</button>
                  ))}
                  <button type="button" onClick={() => setShowArchived((s) => !s)} aria-pressed={showArchived}
                    className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${showArchived ? "border-primary/60 bg-primary/12" : "border-border/60 text-muted-foreground"}`}><Archive className="mr-1 inline size-3.5" />Archivées</button>
                </div></div>
              </div>
            )}

            {!d.videos.length ? (
              <EmptyState icon={Film} title="Ajoute ta première vidéo" text="Une présentation produit, un témoignage, une formation pour ton équipe… filmée avec ton téléphone." 
                action={d.canImport ? <Button className="min-h-11" onClick={() => setOpen(true)}><Plus className="size-4" />Ajouter une vidéo</Button> : null} />
            ) : !list.length ? (
              <p className="mt-8 text-center text-sm text-muted-foreground">Aucune vidéo ne correspond.</p>
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((v) => (
                  <li key={v.id} className="surface group overflow-hidden rounded-2xl transition-colors duration-200 hover:border-primary/40 focus-within:border-primary/50">
                    <button type="button" disabled={v.status !== "pret"} onClick={() => setPreview(v)} className="relative block aspect-video w-full bg-muted" aria-label={`Aperçu : ${v.title}`}>
                      {v.thumbUrl ? <img src={v.thumbUrl} alt="" loading="lazy" className="size-full object-cover" /> : <Film className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />}
                      <VideoStatusBadge status={v.status} archived={v.archived} className="absolute left-2 top-2" />
                      <span className="absolute bottom-2 right-2 rounded bg-background/85 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums backdrop-blur-sm">{formatDuration(v.duration)}</span>
                      {v.status === "pret" && <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"><span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><Play className="ml-0.5 size-5" /></span></span>}
                    </button>
                    <div className="flex items-start gap-2 p-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="line-clamp-2 font-semibold leading-snug">{v.title}</h2>
                        <p className="mt-1 text-xs text-muted-foreground"><span className="rounded-full border border-border/60 px-2 py-0.5">{categoryLabel(v.category)}</span> · {formatBytes(v.size)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><button type="button" className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:text-foreground" aria-label="Actions"><MoreHorizontal className="size-5" /></button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!v.archived && <DropdownMenuItem onClick={() => setEdit(v)}><Pencil className="size-4" />Modifier</DropdownMenuItem>}
                          {v.archived ? <DropdownMenuItem onClick={async () => { await restoreFn({ data: { id: v.id } }); qc.invalidateQueries({ queryKey: ["videotheque"] }); }}><RotateCcw className="size-4" />Restaurer</DropdownMenuItem>
                            : <DropdownMenuItem onClick={() => setArchive(v)}><Archive className="size-4" />Archiver</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <UploadSheet open={open} onOpenChange={setOpen} plan={d.plan} usedBytes={d.usedBytes} />
          </>
        ) : null}

        <EditDialog video={edit} onClose={() => setEdit(null)} />
        <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
            {preview && <FilePlayer key={preview.id} title={preview.title} thumbUrl={preview.thumbUrl} getUrl={async () => (await urlFn({ data: { id: preview.id } })).url} />}
            {preview?.description && <p className="text-sm text-muted-foreground">{preview.description}</p>}
          </DialogContent>
        </Dialog>
        <AlertDialog open={!!archive} onOpenChange={(o) => !o && setArchive(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archiver « {archive?.title} » ?</AlertDialogTitle>
              <AlertDialogDescription>Elle disparaît de ta vidéothèque. Les personnes qui ont déjà reçu une formation la contenant la gardent. Si personne ne l'a reçue, le fichier est supprimé définitivement.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                if (!archive) return;
                try {
                  const r = await archiveFn({ data: { id: archive.id } });
                  toast.success(r.deleted ? "Vidéo supprimée." : `Vidéo archivée, conservée pour ${r.keptFor} personne${r.keptFor > 1 ? "s" : ""}.`);
                  qc.invalidateQueries({ queryKey: ["videotheque"] });
                } catch (e) { toast.error(e instanceof Error ? e.message : "Archivage impossible."); }
              }}>Archiver</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {d?.canImport && d.videos.length > 0 && !open && (
        <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 sm:hidden">
          <Button className="min-h-12 w-full shadow-lg" onClick={() => setOpen(true)}><Plus className="size-4" />Ajouter une vidéo</Button>
        </div>
      )}
    </AppShell>
  );
}

function EditDialog({ video, onClose }: { video: MyVideo | null; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(updateVideoMeta);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("formation");
  const [lastId, setLastId] = useState<string | null>(null);
  if (video && video.id !== lastId) { setLastId(video.id); setTitle(video.title); setDescription(video.description); setCategory(video.category); }
  return (
    <Dialog open={!!video} onOpenChange={(o) => { if (!o) { onClose(); setLastId(null); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Modifier la vidéo</DialogTitle></DialogHeader>
        <label className="block text-sm font-medium">Titre<Input className="mt-1 min-h-11" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-sm font-medium">Description<Textarea className="mt-1" rows={3} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => (
          <button key={c.key} type="button" onClick={() => setCategory(c.key)} aria-pressed={category === c.key}
            className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${category === c.key ? "border-primary/60 bg-primary/12" : "border-border/60 text-muted-foreground"}`}>{c.label}</button>
        ))}</div>
        <Button className="min-h-11" disabled={title.trim().length < 3} onClick={async () => {
          if (!video) return;
          try { await save({ data: { id: video.id, title, description, category } }); toast.success("Enregistré"); qc.invalidateQueries({ queryKey: ["videotheque"] }); onClose(); setLastId(null); }
          catch { toast.error("Modification non enregistrée."); }
        }}>Enregistrer</Button>
      </DialogContent>
    </Dialog>
  );
}
