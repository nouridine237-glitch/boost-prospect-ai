import n1 from "@/content/academie/niveau-1.md?raw";
import n2 from "@/content/academie/niveau-2.md?raw";
import n3 from "@/content/academie/niveau-3.md?raw";
import n4 from "@/content/academie/niveau-4.md?raw";
import n5 from "@/content/academie/niveau-5.md?raw";
import n6 from "@/content/academie/niveau-6.md?raw";

export type Lesson = { slug: string; number: number; title: string; objectives: string[]; body: string; minutes: number };

const raw: [string, string][] = [
  ["Comprendre le MLM", n1],
  ["Construire ton image professionnelle", n2],
  ["Créer du contenu qui attire les bonnes personnes", n3],
  ["Techniques de prospection efficaces", n4],
  ["Structurer le suivi de tes prospects", n5],
  ["Développer et animer ton équipe", n6],
];

function parse(md: string) {
  // First "## Ce que tu vas apprendre" block → objectives; rest → body.
  const m = md.match(/##[^\n]*apprendre[^\n]*\n([\s\S]*?)\n---\n/);
  const objectives = m
    ? (m[1] ?? "").split("\n").filter((l) => l.trim().startsWith("- ")).map((l) => l.trim().slice(2))
    : [];
  const body = m ? md.slice((m.index ?? 0) + m[0].length) : md;
  return { objectives, body: body.trim() };
}

export const lessons: Lesson[] = raw.map(([title, md], i) => {
  const { objectives, body } = parse(md);
  return {
    slug: `niveau-${i + 1}`,
    number: i + 1,
    title,
    objectives,
    body,
    minutes: Math.max(3, Math.round(md.split(/\s+/).length / 200)),
  };
});

export const getLesson = (slug: string) => lessons.find((l) => l.slug === slug);
