import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { adminListAcademy, adminSaveCourse, adminSaveLesson } from "@/lib/academy-video.functions";

type CourseRow = {
  id: string; slug: string; title: string; description: string; min_plan: string;
  source_type: string; source_author: string; source_url: string;
  authorization_note: string; authorized_at: string | null; status: string; sort_order: number;
};
type LessonRow = {
  id: string; course_id: string; slug: string; title: string; summary: string;
  video_id: string; duration_minutes: number; notes: string; transcript: string;
  status: string; sort_order: number;
};

const emptyCourse = {
  slug: "", title: "", description: "", min_plan: "gratuit", source_type: "interne",
  source_author: "", source_url: "", authorization_note: "", authorized_at: null as string | null,
  status: "brouillon", sort_order: 0,
};
const emptyLesson = {
  course_id: "", slug: "", title: "", summary: "", video: "", duration_minutes: 10,
  notes: "", transcript: "", status: "brouillon", sort_order: 0,
};

const inputCls = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";
const areaCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";

export function AdminAcademySection() {
  const listFn = useServerFn(adminListAcademy);
  const saveCourseFn = useServerFn(adminSaveCourse);
  const saveLessonFn = useServerFn(adminSaveLesson);

  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [courseForm, setCourseForm] = useState<typeof emptyCourse & { id?: string }>(emptyCourse);
  const [lessonForm, setLessonForm] = useState<typeof emptyLesson & { id?: string }>(emptyLesson);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(false);

  async function reload() {
    const d = await listFn({});
    setCourses(d.courses as CourseRow[]);
    setLessons(d.lessons as LessonRow[]);
  }
  useEffect(() => { reload().catch(() => setMsg("Impossible de charger les cours.")); }, []);

  async function saveCourse() {
    setSaving(true); setMsg("");
    try {
      await saveCourseFn({ data: courseForm as any });
      setMsg("Cours enregistré.");
      setCourseForm(emptyCourse); setShowCourseForm(false);
      await reload();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Cours non enregistré."); }
    finally { setSaving(false); }
  }

  async function saveLesson() {
    setSaving(true); setMsg("");
    try {
      await saveLessonFn({ data: lessonForm as any });
      setMsg("Leçon enregistrée.");
      setLessonForm(emptyLesson); setShowLessonForm(false);
      await reload();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Leçon non enregistrée."); }
    finally { setSaving(false); }
  }

  const field = (label: string, node: React.ReactNode) => (
    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
      <span>{label}</span>
      {node}
    </label>
  );

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><BookOpen className="size-5" /> Académie vidéo</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setCourseForm(emptyCourse); setShowCourseForm((v) => !v); }}>
            <Plus className="size-4" /> Cours
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setLessonForm(emptyLesson); setShowLessonForm((v) => !v); }} disabled={courses.length === 0}>
            <Plus className="size-4" /> Leçon
          </Button>
        </div>
      </div>
      {msg && <p className="mb-3 text-sm text-muted-foreground">{msg}</p>}

      {showCourseForm && (
        <Card className="mb-4 border-border bg-card">
          <CardContent className="space-y-3 pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {field("Identifiant (slug)", <input className={inputCls} value={courseForm.slug} onChange={(e) => setCourseForm((f) => ({ ...f, slug: e.target.value }))} placeholder="prospection-whatsapp" />)}
              {field("Titre", <input className={inputCls} value={courseForm.title} onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))} />)}
              {field("Plan minimum", (
                <select className={inputCls} value={courseForm.min_plan} onChange={(e) => setCourseForm((f) => ({ ...f, min_plan: e.target.value }))}>
                  {["gratuit", "pro", "expert", "business"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              ))}
              {field("Statut", (
                <select className={inputCls} value={courseForm.status} onChange={(e) => setCourseForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="brouillon">Brouillon</option>
                  <option value="publie">Publié</option>
                </select>
              ))}
              {field("Source", (
                <select className={inputCls} value={courseForm.source_type} onChange={(e) => setCourseForm((f) => ({ ...f, source_type: e.target.value }))}>
                  <option value="interne">Interne (MLM Boost AI)</option>
                  <option value="externe">Externe (avec autorisation)</option>
                </select>
              ))}
              {field("Ordre d’affichage", <input className={inputCls} type="number" min={0} value={courseForm.sort_order} onChange={(e) => setCourseForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))} />)}
            </div>
            {field("Description", <textarea className={areaCls} rows={2} value={courseForm.description} onChange={(e) => setCourseForm((f) => ({ ...f, description: e.target.value }))} />)}
            {courseForm.source_type === "externe" && (
              <div className="grid gap-3 rounded-lg border border-warning/50 p-3 sm:grid-cols-2">
                {field("Auteur / organisme externe", <input className={inputCls} value={courseForm.source_author} onChange={(e) => setCourseForm((f) => ({ ...f, source_author: e.target.value }))} />)}
                {field("Lien source", <input className={inputCls} value={courseForm.source_url} onChange={(e) => setCourseForm((f) => ({ ...f, source_url: e.target.value }))} />)}
                {field("Date d’autorisation", <input className={inputCls} type="date" value={courseForm.authorized_at ?? ""} onChange={(e) => setCourseForm((f) => ({ ...f, authorized_at: e.target.value || null }))} />)}
                {field("Preuve d’autorisation (note)", <input className={inputCls} value={courseForm.authorization_note} onChange={(e) => setCourseForm((f) => ({ ...f, authorization_note: e.target.value }))} placeholder="E-mail du …, contrat …" />)}
              </div>
            )}
            <Button size="sm" onClick={saveCourse} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer le cours"}</Button>
          </CardContent>
        </Card>
      )}

      {showLessonForm && (
        <Card className="mb-4 border-border bg-card">
          <CardContent className="space-y-3 pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {field("Cours", (
                <select className={inputCls} value={lessonForm.course_id} onChange={(e) => setLessonForm((f) => ({ ...f, course_id: e.target.value }))}>
                  <option value="">Choisir…</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              ))}
              {field("Identifiant (slug)", <input className={inputCls} value={lessonForm.slug} onChange={(e) => setLessonForm((f) => ({ ...f, slug: e.target.value }))} />)}
              {field("Titre", <input className={inputCls} value={lessonForm.title} onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))} />)}
              {field("Lien ou ID YouTube", <input className={inputCls} value={lessonForm.video} onChange={(e) => setLessonForm((f) => ({ ...f, video: e.target.value }))} placeholder="https://youtube.com/watch?v=…" />)}
              {field("Durée (minutes)", <input className={inputCls} type="number" min={1} value={lessonForm.duration_minutes} onChange={(e) => setLessonForm((f) => ({ ...f, duration_minutes: Number(e.target.value) || 1 }))} />)}
              {field("Statut", (
                <select className={inputCls} value={lessonForm.status} onChange={(e) => setLessonForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="brouillon">Brouillon</option>
                  <option value="publie">Publié</option>
                </select>
              ))}
            </div>
            {field("Résumé", <textarea className={areaCls} rows={2} value={lessonForm.summary} onChange={(e) => setLessonForm((f) => ({ ...f, summary: e.target.value }))} />)}
            {field("Notes (visibles après déblocage)", <textarea className={areaCls} rows={3} value={lessonForm.notes} onChange={(e) => setLessonForm((f) => ({ ...f, notes: e.target.value }))} />)}
            {field("Transcription (pour le futur coach IA)", <textarea className={areaCls} rows={3} value={lessonForm.transcript} onChange={(e) => setLessonForm((f) => ({ ...f, transcript: e.target.value }))} />)}
            <Button size="sm" onClick={saveLesson} disabled={saving || !lessonForm.course_id}>{saving ? "Enregistrement…" : "Enregistrer la leçon"}</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {courses.map((c) => {
          const courseLessons = lessons.filter((l) => l.course_id === c.id);
          return (
            <Card key={c.id} className="border-border bg-card">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.title} <span className="text-xs font-normal text-muted-foreground">({c.slug})</span></p>
                    <p className="text-xs text-muted-foreground">
                      Plan {c.min_plan} · {c.source_type === "externe" ? `Externe — ${c.source_author || "auteur manquant"}` : "Interne"} · {courseLessons.length} leçon(s) ·{" "}
                      <span className={c.status === "publie" ? "font-semibold text-success" : "font-semibold text-warning"}>{c.status === "publie" ? "Publié" : "Brouillon"}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setCourseForm({ ...c } as any); setShowCourseForm(true); }}>Modifier</Button>
                </div>
                {courseLessons.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    {courseLessons.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate">{l.title} · {l.duration_minutes} min · {l.status === "publie" ? "publié" : "brouillon"}</span>
                        <Button size="sm" variant="ghost" onClick={() => { setLessonForm({ ...l, video: l.video_id } as any); setShowLessonForm(true); }}>Modifier</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
        {courses.length === 0 && <p className="text-sm text-muted-foreground">Aucun cours vidéo pour le moment.</p>}
      </div>
    </section>
  );
}
