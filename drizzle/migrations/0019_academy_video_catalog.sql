CREATE TABLE public.academy_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '',
  min_plan public.plan_type NOT NULL DEFAULT 'pro',
  source_type text NOT NULL DEFAULT 'interne' CHECK (source_type IN ('interne','externe')),
  source_author text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  authorization_note text NOT NULL DEFAULT '',
  authorized_at date,
  status text NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon','publie')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_needs_authorization CHECK (
    status <> 'publie' OR source_type = 'interne'
    OR (authorized_at IS NOT NULL AND char_length(source_author) > 0 AND char_length(authorization_note) > 0))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_courses TO authenticated;
GRANT ALL ON public.academy_courses TO service_role;
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Connectés lisent les cours publiés" ON public.academy_courses FOR SELECT TO authenticated
  USING (status = 'publie' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gère les cours" ON public.academy_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER academy_courses_updated BEFORE UPDATE ON public.academy_courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  summary text NOT NULL DEFAULT '',
  video_provider text NOT NULL DEFAULT 'youtube' CHECK (video_provider IN ('youtube')),
  video_id text NOT NULL CHECK (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  duration_minutes smallint NOT NULL DEFAULT 5 CHECK (duration_minutes BETWEEN 1 AND 600),
  notes text NOT NULL DEFAULT '',
  transcript text NOT NULL DEFAULT '' CHECK (char_length(transcript) <= 60000),
  status text NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon','publie')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_lessons TO authenticated;
GRANT ALL ON public.academy_lessons TO service_role;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
-- Pas de lecture directe pour les membres : contenu servi par le serveur après contrôle du plan.
CREATE POLICY "Admin gère les leçons" ON public.academy_lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER academy_lessons_updated BEFORE UPDATE ON public.academy_lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();