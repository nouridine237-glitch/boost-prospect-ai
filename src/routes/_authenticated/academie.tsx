import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, GraduationCap, MessageSquareText, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/academie")({
  head: () => ({ meta: [
    { title: "Académie — MLM Boost AI" },
    { name: "description", content: "Guides pratiques pour prospecter avec méthode et éthique." },
    { property: "og:title", content: "Académie — MLM Boost AI" },
    { property: "og:description", content: "Apprenez à structurer votre prospection, étape par étape." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: AcademiePage,
});

const lessons = [
  { icon: MessageSquareText, title: "Le premier message", text: "Ouvrir une conversation sans pression : contexte, question ouverte, respect du rythme de l'autre." },
  { icon: Users, title: "Qualifier un prospect", text: "Écouter avant de proposer. Identifier le besoin réel et noter ce qui compte dans la fiche prospect." },
  { icon: BookOpen, title: "La relance utile", text: "Relancer avec une valeur ajoutée plutôt qu'une simple répétition. Planifiez la date dans votre CRM." },
  { icon: GraduationCap, title: "Parler sans promesse", text: "Présenter l'activité avec honnêteté : aucun revenu n'est garanti, seul le travail régulier compte." },
];

function AcademiePage() {
  const { user } = Route.useRouteContext();
  return (
    <AppShell user={user} title="Académie">
      <div className="mx-auto max-w-[1000px] p-5 lg:p-8">
        <span className="eyebrow">Formation</span>
        <h1 className="mt-2 text-3xl font-extrabold">Académie.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Des repères simples pour une prospection structurée et honnête.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {lessons.map(({ icon: Icon, title, text }) => (
            <article key={title} className="surface rounded-lg p-5">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary"><Icon className="size-5" /></span>
              <h2 className="mt-4 font-bold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">Aucun revenu garanti — outil d’aide à la prospection.</p>
      </div>
    </AppShell>
  );
}
