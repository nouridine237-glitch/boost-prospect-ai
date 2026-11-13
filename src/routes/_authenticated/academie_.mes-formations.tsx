import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Layers, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CourseStatusBadge, PageHeader } from "@/components/videotheque/ui-bits";
import { AcademyTabs, EmptyState, ErrorLine } from "@/components/videotheque/academy-tabs";
import { UpgradeCard } from "@/components/plan-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createCourse, listMyCourses } from "@/lib/videotheque.functions";

const coursesQuery = queryOptions({ queryKey: ["videotheque", "courses"], queryFn: () => listMyCourses() });

export const Route = createFileRoute("/_authenticated/academie_/mes-formations")({
  head: () => ({ meta: [
    { title: "Mes formations — Académie MLM Boost AI" },
    { name: "description", content: "Organise tes vidéos en formations, modules et leçons." },
    { property: "og:title", content: "Mes formations — MLM Boost AI" },
    { property: "og:description", content: "Crée tes propres formations vidéo pour la duplication de ton équipe." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: CoursesPage,
});

function CoursesPage() {
  const { user } = Route.useRouteContext();
  const q = useQuery(coursesQuery);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const create = useServerFn(createCourse);
  const navigate = useNavigate();
  const active = (q.data?.courses ?? []).filter((c) => !c.archived);
  const archived = (q.data?.courses ?? []).filter((c) => c.archived);

  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[1000px] p-5 lg:p-8">
        <PageHeader title="Mes formations" text="Assemble tes vidéos en modules et leçons, puis partage-les avec ton équipe."
          action={q.data?.canCreate ? <Button className="min-h-11" onClick={() => setOpen(true)}><Plus className="size-4" />Nouvelle formation</Button> : null} />
        <AcademyTabs />
        {q.isLoading ? (
          <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="surface h-20 animate-pulse rounded-2xl" />)}</div>
        ) : q.isError ? <ErrorLine text="Formations indisponibles." onRetry={() => q.refetch()} /> : q.data && !q.data.canCreate && !q.data.courses.length ? (
          <div className="mt-6"><UpgradeCard minPlan="pro">Crée tes propres formations vidéo à partir du plan Pro.</UpgradeCard></div>
        ) : (
          <>
            {q.data?.canCreate && <Button className="mt-6 min-h-11 w-full sm:hidden" onClick={() => setOpen(true)}><Plus className="size-4" />Nouvelle formation</Button>}
            {!active.length ? (
              <EmptyState icon={Layers} title="Aucune formation pour l'instant" text="Commence par ajouter des vidéos dans ta vidéothèque, puis crée une formation." />
            ) : (
              <ul className="mt-5 grid gap-3 md:grid-cols-2">
                {active.map((c) => (
                  <li key={c.id}>
                    <Link to="/academie/mes-formations/$id" params={{ id: c.id }} className="surface flex min-h-20 items-center gap-4 rounded-2xl p-4 transition-colors duration-200 hover:border-primary/40">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><Layers className="size-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c.title}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><CourseStatusBadge version={c.version} />{c.lessons} leçon{c.lessons > 1 ? "s" : ""}{c.recipients ? <span className="inline-flex items-center gap-1"><Users className="size-3" />{c.recipients}</span> : null}{c.unavailable > 0 && <span className="rounded-full border border-destructive/40 px-2 py-0.5 font-medium text-destructive">{c.unavailable} leçon{c.unavailable > 1 ? "s" : ""} indisponible{c.unavailable > 1 ? "s" : ""}</span>}</span>
                      </span>
                      <ChevronRight className="size-5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {archived.length > 0 && <p className="mt-6 text-xs text-muted-foreground">{archived.length} formation{archived.length > 1 ? "s" : ""} archivée{archived.length > 1 ? "s" : ""} : {archived.map((c, i) => <span key={c.id}>{i ? ", " : ""}<Link to="/academie/mes-formations/$id" params={{ id: c.id }} className="underline">{c.title}</Link></span>)}</p>}
          </>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle formation</DialogTitle><DialogDescription>Tu pourras ajouter modules et leçons ensuite.</DialogDescription></DialogHeader>
            <label className="text-sm font-medium">Titre<Input className="mt-1 min-h-11" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Mes 7 premiers jours" /></label>
            <Button className="min-h-11" disabled={title.trim().length < 3} onClick={async () => {
              try { const r = await create({ data: { title, description: "" } }); setOpen(false); navigate({ to: "/academie/mes-formations/$id", params: { id: r.id } }); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Formation non créée."); }
            }}>Créer</Button>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
