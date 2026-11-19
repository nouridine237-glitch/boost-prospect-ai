import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Lock, MessageCircle, PlayCircle } from "lucide-react";
import { Brand } from "@/components/brand";
import { FilePlayer } from "@/components/videotheque/file-player";
import { supabase } from "@/integrations/supabase/client";
import { formatTotal, groupByModule } from "@/lib/videotheque";
import { viewerAction, type ViewerRole } from "@/lib/duplication-hub";
import { publicLessonPlayUrl, publicLinkAccess, resolvePublicLink, trackPublicLink } from "@/lib/duplication-hub.functions";

export const Route = createFileRoute("/d/$token")({
  loader: ({ params }) => resolvePublicLink({ data: { token: params.token } }),
  head: ({ loaderData }) => ({ meta: [
    { title: loaderData ? `${loaderData.title} — leçon offerte | MLM Boost AI` : "Parcours de formation — MLM Boost AI" },
    { name: "description", content: "Regarde la première leçon offerte de ce parcours de formation, sans créer de compte." },
    { property: "og:title", content: loaderData ? `${loaderData.title} — par ${loaderData.trainer}` : "Parcours de formation — MLM Boost AI" },
    { property: "og:description", content: "Une leçon offerte, sans compte. La suite du parcours se débloque avec ton accès." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ]}),
  component: PublicCoursePage,
});

function PublicCoursePage() {
  const { token } = Route.useParams();
  const course = Route.useLoaderData();
  const track = useServerFn(trackPublicLink), play = useServerFn(publicLessonPlayUrl), access = useServerFn(publicLinkAccess);
  const [role, setRole] = useState<ViewerRole | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    if (!course) return;
    const k = `dup:${token.slice(0, 12)}`;
    if (!sessionStorage.getItem(`${k}:vue`)) { sessionStorage.setItem(`${k}:vue`, "1"); void track({ data: { token, kind: "vue" } }).catch(() => {}); }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setRole("anonyme"); return; }
      if (localStorage.getItem(`${k}:inscription`)) { localStorage.removeItem(`${k}:inscription`); void track({ data: { token, kind: "inscription_fin" } }).catch(() => {}); }
      try { const r = await access({ data: { token } }); setRole(r.role); setCourseId(r.courseId); } catch { setRole("none"); }
    });
  }, [course, token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!course) {
    return (
      <Shell>
        <div className="surface mx-auto mt-10 max-w-md rounded-2xl p-6 text-center">
          <h1 className="text-xl font-bold">Lien indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ce lien a été retiré par son formateur, a expiré ou n'existe pas. Demande un nouveau lien à la personne qui te l'a envoyé.</p>
          <Link to="/" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Découvrir MLM Boost AI</Link>
        </div>
      </Shell>
    );
  }

  const free = course.lessons.find((l) => l.id === course.freeLessonId);
  const groups = groupByModule(course.lessons);
  const total = course.lessons.reduce((s, l) => s + l.duration, 0);
  const next = `/d/${token}`;
  const onSignup = () => { localStorage.setItem(`dup:${token.slice(0, 12)}:inscription`, "1"); void track({ data: { token, kind: "inscription_debut" } }).catch(() => {}); };
  const action = role ? viewerAction(role) : null;
  const waText = encodeURIComponent(`Bonjour ${course.trainer}, j'ai regardé la leçon offerte de « ${course.title} » sur MLM Boost AI. Peux-tu me partager la suite du parcours ?`);

  const cta = !action ? <div className="h-12 animate-pulse rounded-xl bg-muted" /> :
    action.to === "auth" ? (
      <div className="space-y-2">
        <Link to="/auth" search={{ mode: "signup", next }} onClick={onSignup} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{action.label}</Link>
        <Link to="/auth" search={{ next }} className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border/70 px-5 text-sm font-semibold">J'ai déjà un compte</Link>
        <p className="text-xs text-muted-foreground">Ton compte est gratuit. La suite du parcours reste partagée par ton formateur : créer un compte ne donne pas accès automatiquement aux autres leçons.</p>
      </div>
    ) : action.to === "editor" && courseId ? (
      <Link to="/academie/mes-formations/$id" params={{ id: courseId }} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{action.label}</Link>
    ) : action.to === "reader" && courseId ? (
      <Link to="/academie/lecture/$courseId" params={{ courseId }} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{action.label}</Link>
    ) : action.to === "received" ? (
      <Link to="/academie/recues" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{action.label}</Link>
    ) : (
      <div className="space-y-2">
        {course.whatsapp ? (
          <a href={`https://wa.me/${course.whatsapp}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground"><MessageCircle className="size-4" />{action.label} sur WhatsApp</a>
        ) : null}
        <p className="text-xs text-muted-foreground">{course.whatsapp ? "WhatsApp s'ouvre avec un message prêt : c'est toi qui l'envoies." : `Contacte ${course.trainer} pour qu'il te partage la formation.`} Une fois partagée, elle apparaîtra dans tes formations reçues.</p>
      </div>
    );

  return (
    <Shell>
      <div className="mx-auto grid max-w-[1100px] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-5">
          <div>
            <span className="eyebrow">Parcours de {course.trainer}</span>
            <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">{course.title}</h1>
            {course.description && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{course.description}</p>}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" />{course.lessons.length} leçon{course.lessons.length > 1 ? "s" : ""} · {formatTotal(total)}</p>
          </div>
          {free && (
            <div className="surface rounded-2xl p-3 sm:p-4">
              <p className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold"><PlayCircle className="size-4 text-primary" />Leçon offerte · {free.title}</p>
              <FilePlayer title={free.title}
                getUrl={async () => { void track({ data: { token, kind: "lecture_debut" } }).catch(() => {}); return (await play({ data: { token } })).url; }}
                onReport={(r) => { if (!ended.current && r.duration && r.position >= r.duration * 0.9) { ended.current = true; void track({ data: { token, kind: "lecture_fin" } }).catch(() => {}); } }} />
              <p className="mt-3 px-1 text-xs text-muted-foreground">Sans compte, ta progression n'est pas enregistrée.</p>
            </div>
          )}
        </section>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="surface rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-base font-bold uppercase text-primary">{course.trainer.slice(0, 1)}</span>
              <div className="min-w-0"><p className="truncate font-semibold">{course.trainer}</p><p className="text-xs text-muted-foreground">Formateur</p></div>
            </div>
            {course.intro && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{course.intro}</p>}
            <div className="mt-4">{cta}</div>
          </div>
          <div className="surface overflow-hidden rounded-2xl">
            <p className="border-b border-border/50 px-4 py-3 text-sm font-semibold">Sommaire</p>
            {groups.map((g) => (
              <div key={g.module || "_"}>
                {g.module && <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.module}</p>}
                <ul>
                  {g.items.map((l) => (
                    <li key={l.id} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm">
                      {l.free ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : <Lock className="size-4 shrink-0 text-muted-foreground" />}
                      <span className={`min-w-0 flex-1 truncate ${l.free ? "font-medium" : "text-muted-foreground"}`}>{l.title}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{l.free ? "Offerte" : formatTotal(l.duration)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between p-4 lg:px-8"><Link to="/" aria-label="MLM Boost AI"><Brand compact /></Link></header>
      <main className="px-4 pb-10 lg:px-8">{children}</main>
      <footer className="border-t border-border/50 px-4 py-5 text-center text-xs text-muted-foreground">MLM Boost AI est un outil d'aide à la prospection et à la productivité. Aucun revenu n'est garanti.</footer>
    </div>
  );
}
