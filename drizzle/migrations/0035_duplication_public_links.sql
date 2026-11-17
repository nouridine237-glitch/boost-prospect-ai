CREATE TABLE public.duplication_public_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.course_versions(id) ON DELETE CASCADE,
  free_lesson_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  intro text NOT NULL DEFAULT '' CHECK (char_length(intro) <= 400),
  show_whatsapp boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'actif' CHECK (status IN ('actif','revoque')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX duplication_public_links_one_active ON public.duplication_public_links(course_id) WHERE status = 'actif';
GRANT SELECT ON public.duplication_public_links TO authenticated;
GRANT ALL ON public.duplication_public_links TO service_role;
ALTER TABLE public.duplication_public_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own public links" ON public.duplication_public_links FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.duplication_public_events (
  link_id uuid NOT NULL REFERENCES public.duplication_public_links(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  kind text NOT NULL CHECK (kind IN ('vue','lecture_debut','lecture_fin','inscription_debut','inscription_fin')),
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (link_id, day, kind)
);
GRANT SELECT ON public.duplication_public_events TO authenticated;
GRANT ALL ON public.duplication_public_events TO service_role;
ALTER TABLE public.duplication_public_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own link events" ON public.duplication_public_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.duplication_public_links l WHERE l.id = link_id AND l.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public._public_link_hash(_token text) RETURNS text LANGUAGE sql IMMUTABLE
AS $$ SELECT encode(sha256(convert_to(COALESCE(_token, ''), 'UTF8')), 'hex') $$;

CREATE OR REPLACE FUNCTION public._public_link_rate(_key text, _max integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_key));
  SELECT count(*) INTO n FROM public.capture_rate_limits WHERE ip_hash = _key AND created_at > now() - interval '1 hour';
  IF n >= _max THEN RETURN false; END IF;
  INSERT INTO public.capture_rate_limits(ip_hash) VALUES (_key);
  RETURN true;
END $$;

-- Lien valide : actif, non expiré, formation active, leçon gratuite présente dans la version et vidéo disponible.
CREATE OR REPLACE FUNCTION public._public_link_valid(_token text)
RETURNS TABLE(link_id uuid, owner_id uuid, course_id uuid, version_id uuid, free_lesson_id uuid, video_id uuid, intro text, show_whatsapp boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT l.id, l.owner_id, l.course_id, l.version_id, l.free_lesson_id, (e->>'video_id')::uuid, l.intro, l.show_whatsapp
  FROM public.duplication_public_links l
  JOIN public.academy_courses c ON c.id = l.course_id AND c.archived_at IS NULL AND c.owner_id = l.owner_id
  JOIN public.course_versions v ON v.id = l.version_id
  CROSS JOIN LATERAL jsonb_array_elements(v.lessons) e
  WHERE l.token_hash = public._public_link_hash(_token) AND l.status = 'actif'
    AND (l.expires_at IS NULL OR l.expires_at > now())
    AND e->>'lesson_id' = l.free_lesson_id::text
    AND public._video_available((e->>'video_id')::uuid)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.public_link_create(_course_id uuid, _lesson_id uuid, _intro text, _show_whatsapp boolean, _expires_days integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u uuid := auth.uid(); ver record; tok text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.academy_courses WHERE id = _course_id AND owner_id = u AND archived_at IS NULL) THEN RAISE EXCEPTION 'FORMATION_INTROUVABLE'; END IF;
  IF NOT public._can_lead(u) THEN RAISE EXCEPTION 'PLAN_BUSINESS_REQUIS'; END IF;
  IF _expires_days IS NOT NULL AND (_expires_days < 1 OR _expires_days > 365) THEN RAISE EXCEPTION 'ENTREE_INVALIDE'; END IF;
  SELECT id, lessons INTO ver FROM public.course_versions WHERE course_id = _course_id ORDER BY version DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'PUBLIER_AVANT'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ver.lessons) e WHERE e->>'lesson_id' = _lesson_id::text AND public._video_available((e->>'video_id')::uuid)) THEN
    RAISE EXCEPTION 'LECON_INVALIDE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text || ':public_links', 0));
  IF (SELECT count(*) FROM public.duplication_public_links WHERE owner_id = u AND created_at > now() - interval '1 day') >= 20 THEN RAISE EXCEPTION 'LIMITE_LIENS_JOUR'; END IF;
  UPDATE public.duplication_public_links SET status = 'revoque', revoked_at = now() WHERE course_id = _course_id AND status = 'actif';
  tok := encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex');
  INSERT INTO public.duplication_public_links(owner_id, course_id, version_id, free_lesson_id, token_hash, intro, show_whatsapp, expires_at)
  VALUES (u, _course_id, ver.id, _lesson_id, public._public_link_hash(tok), left(btrim(COALESCE(_intro, '')), 400), COALESCE(_show_whatsapp, false),
    CASE WHEN _expires_days IS NULL THEN NULL ELSE now() + make_interval(days => _expires_days) END);
  RETURN tok;
END $$;

CREATE OR REPLACE FUNCTION public.public_link_revoke(_link_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.duplication_public_links SET status = 'revoque', revoked_at = now() WHERE id = _link_id AND owner_id = auth.uid() AND status = 'actif';
  RETURN CASE WHEN FOUND THEN 'revoque' ELSE 'introuvable' END;
END $$;

-- Réponse publique allowlistée (appelée uniquement par le serveur).
CREATE OR REPLACE FUNCTION public.public_link_resolve(_token text, _ip_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k record; v record; p record; wa text;
BEGIN
  IF NOT public._public_link_rate('dup:' || _ip_hash, 60) THEN RETURN jsonb_build_object('error', 'rate_limited'); END IF;
  SELECT * INTO k FROM public._public_link_valid(_token);
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT title, description, lessons INTO v FROM public.course_versions WHERE id = k.version_id;
  SELECT display_name, full_name INTO p FROM public.profiles WHERE id = k.owner_id;
  IF k.show_whatsapp THEN SELECT whatsapp INTO wa FROM public.capture_pages WHERE user_id = k.owner_id; END IF;
  RETURN jsonb_build_object(
    'trainer', COALESCE(NULLIF(p.display_name, ''), NULLIF(p.full_name, ''), 'Ton formateur'),
    'intro', k.intro, 'whatsapp', NULLIF(regexp_replace(COALESCE(wa, ''), '\D', '', 'g'), ''),
    'title', v.title, 'description', v.description, 'freeLessonId', k.free_lesson_id,
    'lessons', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e->>'lesson_id', 'title', e->>'title', 'module', COALESCE(e->>'module', ''),
        'duration', COALESCE((e->>'duration')::int, 60), 'free', e->>'lesson_id' = k.free_lesson_id::text) ORDER BY o), '[]'::jsonb)
      FROM jsonb_array_elements(v.lessons) WITH ORDINALITY AS t(e, o)));
END $$;

CREATE OR REPLACE FUNCTION public.public_link_play(_token text, _ip_hash text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k record; path text;
BEGIN
  SELECT * INTO k FROM public._public_link_valid(_token);
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT public._public_link_rate('dupv:' || _ip_hash, 10) THEN RETURN 'rate_limited'; END IF;
  SELECT storage_path INTO path FROM public.user_videos WHERE id = k.video_id;
  RETURN path;
END $$;

CREATE OR REPLACE FUNCTION public.public_link_event(_token text, _kind text, _ip_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k record;
BEGIN
  IF _kind NOT IN ('vue','lecture_debut','lecture_fin','inscription_debut','inscription_fin') THEN RETURN; END IF;
  SELECT * INTO k FROM public._public_link_valid(_token);
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT public._public_link_rate('dupe:' || _ip_hash, 30) THEN RETURN; END IF;
  INSERT INTO public.duplication_public_events(link_id, kind, count) VALUES (k.link_id, _kind, 1)
  ON CONFLICT (link_id, day, kind) DO UPDATE SET count = duplication_public_events.count + 1;
END $$;

REVOKE ALL ON FUNCTION public._public_link_rate(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._public_link_valid(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_link_resolve(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_link_play(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_link_event(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_link_create(uuid, uuid, text, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.public_link_revoke(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._public_link_rate(text, integer), public._public_link_valid(text), public.public_link_resolve(text, text),
  public.public_link_play(text, text), public.public_link_event(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_link_create(uuid, uuid, text, boolean, integer), public.public_link_revoke(uuid) TO authenticated;