-- Vidéothèque personnelle, formations utilisateur, versions et octrois durables.
CREATE TABLE public.user_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  category text NOT NULL DEFAULT 'formation' CHECK (category IN ('presentation','produit','formation','temoignage','motivation','autre')),
  storage_path text NOT NULL UNIQUE,
  thumb_path text,
  mime_type text NOT NULL CHECK (mime_type IN ('video/mp4','video/quicktime','video/webm')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 524288000),
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 3600),
  status text NOT NULL DEFAULT 'envoi' CHECK (status IN ('envoi','pret','echec')),
  rights_confirmed boolean NOT NULL CHECK (rights_confirmed),
  archived_at timestamptz,
  deleted_at timestamptz,
  moderated_at timestamptz,
  moderation_reason text NOT NULL DEFAULT '' CHECK (char_length(moderation_reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_videos_owner_idx ON public.user_videos(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.user_videos TO authenticated;
GRANT ALL ON public.user_videos TO service_role;
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_videos_select_own ON public.user_videos FOR SELECT TO authenticated USING (auth.uid() = owner_id AND deleted_at IS NULL);
CREATE POLICY user_videos_insert_own ON public.user_videos FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY user_videos_update_own ON public.user_videos FOR UPDATE TO authenticated USING (auth.uid() = owner_id AND deleted_at IS NULL) WITH CHECK (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.video_quota(_plan public.plan_type)
RETURNS TABLE(total_bytes bigint, max_bytes bigint, per_day integer) LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _plan WHEN 'pro' THEN 2147483648 WHEN 'expert' THEN 5368709120 WHEN 'business' THEN 16106127360 ELSE 0 END::bigint,
         CASE _plan WHEN 'pro' THEN 209715200 WHEN 'expert' THEN 314572800 WHEN 'business' THEN 524288000 ELSE 0 END::bigint,
         CASE _plan WHEN 'pro' THEN 10 WHEN 'expert' THEN 20 WHEN 'business' THEN 40 ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public.user_videos_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.plan_type; q record; used bigint; n integer;
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_id <> OLD.owner_id OR NEW.storage_path <> OLD.storage_path OR NEW.size_bytes <> OLD.size_bytes THEN RAISE EXCEPTION 'Immutable'; END IF;
    IF current_user = 'authenticated' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.thumb_path IS DISTINCT FROM OLD.thumb_path
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.moderated_at IS DISTINCT FROM OLD.moderated_at
       OR NEW.moderation_reason IS DISTINCT FROM OLD.moderation_reason OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.duration_seconds IS DISTINCT FROM OLD.duration_seconds) THEN RAISE EXCEPTION 'CHAMP_PROTEGE'; END IF;
    RETURN NEW;
  END IF;
  IF current_user = 'authenticated' THEN
    NEW.status := 'envoi'; NEW.deleted_at := NULL; NEW.moderated_at := NULL; NEW.moderation_reason := ''; NEW.archived_at := NULL;
  END IF;
  IF NEW.storage_path NOT LIKE NEW.owner_id::text || '/' || NEW.id::text || '.%' THEN RAISE EXCEPTION 'CHEMIN_INVALIDE'; END IF;
  IF NEW.thumb_path IS NOT NULL AND NEW.thumb_path <> NEW.owner_id::text || '/' || NEW.id::text || '.jpg' THEN RAISE EXCEPTION 'CHEMIN_INVALIDE'; END IF;
  p := public.effective_plan(NEW.owner_id);
  IF p = 'gratuit' THEN RAISE EXCEPTION 'PLAN_PAYANT_REQUIS'; END IF;
  SELECT * INTO q FROM public.video_quota(p);
  IF NEW.size_bytes > q.max_bytes THEN RAISE EXCEPTION 'LIMITE_TAILLE:%', q.max_bytes; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_id::text || ':videos', 0));
  SELECT COALESCE(sum(size_bytes), 0) INTO used FROM public.user_videos WHERE owner_id = NEW.owner_id AND deleted_at IS NULL AND status <> 'echec';
  IF used + NEW.size_bytes > q.total_bytes THEN RAISE EXCEPTION 'LIMITE_STOCKAGE:%', q.total_bytes; END IF;
  SELECT count(*) INTO n FROM public.user_videos WHERE owner_id = NEW.owner_id AND created_at > now() - interval '1 day';
  IF n >= q.per_day THEN RAISE EXCEPTION 'LIMITE_IMPORTS:%', q.per_day; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_videos_guard BEFORE INSERT OR UPDATE ON public.user_videos FOR EACH ROW EXECUTE FUNCTION public.user_videos_guard();

-- Storage : envoi seulement dans son dossier, vers un chemin déclaré en cours d'envoi ; aucune lecture partagée directe.
CREATE POLICY user_videos_obj_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'user-videos' AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.user_videos v WHERE v.owner_id = auth.uid() AND v.status = 'envoi' AND v.deleted_at IS NULL AND (v.storage_path = name OR v.thumb_path = name)));
CREATE POLICY user_videos_obj_select_own ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'user-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Formations utilisateur : réutilisent academy_courses / academy_lessons et la progression existante.
ALTER TABLE public.academy_courses ADD COLUMN owner_id uuid;
ALTER TABLE public.academy_courses ADD COLUMN archived_at timestamptz;
CREATE INDEX academy_courses_owner_idx ON public.academy_courses(owner_id) WHERE owner_id IS NOT NULL;
DROP POLICY "Connectés lisent les cours publiés" ON public.academy_courses;
CREATE POLICY "Connectés lisent les cours publiés" ON public.academy_courses FOR SELECT TO authenticated USING (status = 'publie' AND owner_id IS NULL);
CREATE POLICY academy_courses_owner_select ON public.academy_courses FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY academy_courses_owner_insert ON public.academy_courses FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND source_type = 'interne');
CREATE POLICY academy_courses_owner_update ON public.academy_courses FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND source_type = 'interne');

ALTER TABLE public.academy_lessons ADD COLUMN user_video_id uuid REFERENCES public.user_videos(id);
ALTER TABLE public.academy_lessons ADD COLUMN module_title text NOT NULL DEFAULT '' CHECK (char_length(module_title) <= 80);
ALTER TABLE public.academy_lessons ADD COLUMN archived_at timestamptz;
ALTER TABLE public.academy_lessons DROP CONSTRAINT IF EXISTS academy_lessons_video_provider_check;
ALTER TABLE public.academy_lessons DROP CONSTRAINT IF EXISTS academy_lessons_video_id_check;
ALTER TABLE public.academy_lessons ADD CONSTRAINT academy_lessons_video_source CHECK (
  (video_provider = 'youtube' AND video_id ~ '^[A-Za-z0-9_-]{11}$' AND user_video_id IS NULL)
  OR (video_provider = 'fichier' AND user_video_id IS NOT NULL));
CREATE POLICY academy_lessons_owner_select ON public.academy_lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.academy_courses c WHERE c.id = course_id AND c.owner_id = auth.uid()));
CREATE POLICY academy_lessons_owner_insert ON public.academy_lessons FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.academy_courses c WHERE c.id = course_id AND c.owner_id = auth.uid()));
CREATE POLICY academy_lessons_owner_update ON public.academy_lessons FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.academy_courses c WHERE c.id = course_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.academy_courses c WHERE c.id = course_id AND c.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.owner_lesson_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o uuid;
BEGIN
  SELECT owner_id INTO o FROM public.academy_courses WHERE id = NEW.course_id;
  IF TG_OP = 'UPDATE' AND NEW.course_id <> OLD.course_id THEN RAISE EXCEPTION 'Immutable'; END IF;
  IF o IS NULL THEN
    IF NEW.video_provider = 'fichier' THEN RAISE EXCEPTION 'CATALOGUE_YOUTUBE'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.video_provider <> 'fichier' THEN RAISE EXCEPTION 'VIDEO_REQUISE'; END IF;
  IF NEW.user_video_id IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.user_video_id END) AND NOT EXISTS (
    SELECT 1 FROM public.user_videos v WHERE v.id = NEW.user_video_id AND v.owner_id = o AND v.status = 'pret'
      AND v.archived_at IS NULL AND v.deleted_at IS NULL AND v.moderated_at IS NULL) THEN RAISE EXCEPTION 'VIDEO_INVALIDE'; END IF;
  NEW.video_id := NEW.user_video_id::text;
  NEW.duration_minutes := GREATEST(1, ceil((SELECT duration_seconds FROM public.user_videos WHERE id = NEW.user_video_id) / 60.0))::smallint;
  RETURN NEW;
END $$;
CREATE TRIGGER academy_lessons_owner_guard BEFORE INSERT OR UPDATE ON public.academy_lessons FOR EACH ROW EXECUTE FUNCTION public.owner_lesson_guard();

-- Versions publiées (copie figée de la structure ; les fichiers ne sont pas dupliqués).
CREATE TABLE public.course_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id),
  version integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  lessons jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, version)
);
GRANT SELECT ON public.course_versions TO authenticated;
GRANT ALL ON public.course_versions TO service_role;
ALTER TABLE public.course_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_versions_owner_select ON public.course_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.academy_courses c WHERE c.id = course_id AND c.owner_id = auth.uid()));

-- Octrois d'accès individuels et durables.
CREATE TABLE public.course_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id),
  owner_id uuid NOT NULL,
  grantor_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  origin text NOT NULL CHECK (origin IN ('direct','equipe')),
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente','actif','refuse','revoque_proprietaire','retire_moderation')),
  can_reshare boolean NOT NULL DEFAULT false,
  version_id uuid NOT NULL REFERENCES public.course_versions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  UNIQUE (course_id, recipient_id),
  CHECK (recipient_id <> owner_id)
);
CREATE INDEX course_grants_recipient_idx ON public.course_grants(recipient_id, status);
CREATE INDEX course_grants_grantor_idx ON public.course_grants(grantor_id, created_at DESC);
GRANT SELECT ON public.course_grants TO authenticated;
GRANT ALL ON public.course_grants TO service_role;
ALTER TABLE public.course_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_grants_select_parties ON public.course_grants FOR SELECT TO authenticated
  USING (auth.uid() IN (recipient_id, grantor_id, owner_id));

-- Journal léger des lectures (anti-abus) et signalements.
CREATE TABLE public.video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.user_videos(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX video_views_viewer_idx ON public.video_views(viewer_id, created_at DESC);
GRANT ALL ON public.video_views TO service_role;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.video_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.user_videos(id),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 500),
  status text NOT NULL DEFAULT 'ouvert' CHECK (status IN ('ouvert','traite','rejete')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, video_id)
);
GRANT SELECT, INSERT ON public.video_reports TO authenticated;
GRANT ALL ON public.video_reports TO service_role;
ALTER TABLE public.video_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY video_reports_insert_own ON public.video_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid() AND status = 'ouvert');
CREATE POLICY video_reports_select ON public.video_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Publication d'une version (propriétaire).
CREATE OR REPLACE FUNCTION public.course_publish_version(_course_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); c record; v integer; ls jsonb;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO c FROM public.academy_courses WHERE id = _course_id AND owner_id = u AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORMATION_INTROUVABLE'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('lesson_id', l.id, 'title', l.title, 'summary', l.summary, 'module', l.module_title,
      'video_id', l.user_video_id, 'duration', vv.duration_seconds) ORDER BY l.sort_order, l.created_at), '[]'::jsonb) INTO ls
  FROM public.academy_lessons l JOIN public.user_videos vv ON vv.id = l.user_video_id
  WHERE l.course_id = _course_id AND l.archived_at IS NULL AND vv.status = 'pret' AND vv.moderated_at IS NULL AND vv.deleted_at IS NULL;
  IF jsonb_array_length(ls) = 0 THEN RAISE EXCEPTION 'AUCUNE_LECON'; END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v FROM public.course_versions WHERE course_id = _course_id;
  INSERT INTO public.course_versions(course_id, version, title, description, lessons) VALUES (_course_id, v, c.title, c.description, ls);
  UPDATE public.academy_courses SET status = 'publie' WHERE id = _course_id;
  UPDATE public.academy_lessons SET status = 'publie' WHERE course_id = _course_id AND archived_at IS NULL;
  RETURN v;
END $$;

-- Partage : propriétaire vers ses membres directs ; membre autorisé (can_reshare, toujours dans l'équipe du propriétaire)
-- vers ses propres membres directs ou les autres membres du propriétaire. Les octrois repartagés n'ont jamais can_reshare.
CREATE OR REPLACE FUNCTION public.grant_share(_course_id uuid, _recipients uuid[], _can_reshare boolean, _origin text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); c record; ver uuid; r uuid; ok boolean; n integer := 0; today integer; pending integer; is_owner boolean; reshare boolean := false;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF _origin NOT IN ('direct','equipe') OR _recipients IS NULL OR cardinality(_recipients) = 0 OR cardinality(_recipients) > 200 THEN RAISE EXCEPTION 'ENTREE_INVALIDE'; END IF;
  SELECT * INTO c FROM public.academy_courses WHERE id = _course_id AND owner_id IS NOT NULL AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORMATION_INTROUVABLE'; END IF;
  is_owner := c.owner_id = u;
  IF is_owner THEN
    IF NOT public._can_lead(u) THEN RAISE EXCEPTION 'PLAN_BUSINESS_REQUIS'; END IF;
    SELECT id INTO ver FROM public.course_versions WHERE course_id = _course_id ORDER BY version DESC LIMIT 1;
  ELSE
    SELECT g.version_id INTO ver FROM public.course_grants g WHERE g.course_id = _course_id AND g.recipient_id = u AND g.status = 'actif' AND g.can_reshare
      AND EXISTS (SELECT 1 FROM public.team_links t WHERE t.leader_id = c.owner_id AND t.member_id = u AND t.status = 'actif');
    IF ver IS NULL THEN RAISE EXCEPTION 'REPARTAGE_NON_AUTORISE'; END IF;
    reshare := true;
  END IF;
  IF ver IS NULL THEN RAISE EXCEPTION 'PUBLIER_AVANT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text || ':grants', 0));
  SELECT count(*) INTO today FROM public.course_grants WHERE grantor_id = u AND created_at > now() - interval '1 day';
  SELECT count(*) INTO pending FROM public.course_grants WHERE grantor_id = u AND course_id = _course_id AND status IN ('en_attente','actif');
  FOREACH r IN ARRAY (SELECT array_agg(DISTINCT x) FROM unnest(_recipients) x) LOOP
    IF r = u OR r = c.owner_id THEN CONTINUE; END IF;
    ok := EXISTS (SELECT 1 FROM public.team_links t WHERE t.leader_id = u AND t.member_id = r AND t.status = 'actif');
    IF NOT ok AND reshare THEN ok := EXISTS (SELECT 1 FROM public.team_links t WHERE t.leader_id = c.owner_id AND t.member_id = r AND t.status = 'actif'); END IF;
    IF NOT ok THEN RAISE EXCEPTION 'DESTINATAIRE_HORS_EQUIPE'; END IF;
    IF today + n >= 50 THEN RAISE EXCEPTION 'LIMITE_PARTAGES_JOUR'; END IF;
    IF pending + n >= 200 THEN RAISE EXCEPTION 'LIMITE_DESTINATAIRES'; END IF;
    INSERT INTO public.course_grants(course_id, owner_id, grantor_id, recipient_id, origin, can_reshare, version_id)
    VALUES (_course_id, c.owner_id, u, r, _origin, _can_reshare AND is_owner, ver)
    ON CONFLICT (course_id, recipient_id) DO UPDATE SET status = 'en_attente', grantor_id = u, origin = EXCLUDED.origin,
      can_reshare = EXCLUDED.can_reshare, version_id = EXCLUDED.version_id, created_at = now(), accepted_at = NULL, ended_at = NULL
      WHERE course_grants.status IN ('refuse','revoque_proprietaire');
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.grant_respond(_grant_id uuid, _accept boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  UPDATE public.course_grants SET status = CASE WHEN _accept THEN 'actif' ELSE 'refuse' END,
    accepted_at = CASE WHEN _accept THEN now() END, ended_at = CASE WHEN _accept THEN NULL ELSE now() END
  WHERE id = _grant_id AND recipient_id = u AND status = 'en_attente';
  IF NOT FOUND THEN RETURN 'introuvable'; END IF;
  RETURN CASE WHEN _accept THEN 'actif' ELSE 'refuse' END;
END $$;

-- Retrait volontaire : seulement dans les 7 jours suivant le partage (accès durable ensuite).
CREATE OR REPLACE FUNCTION public.grant_revoke(_grant_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); g record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO g FROM public.course_grants WHERE id = _grant_id FOR UPDATE;
  IF NOT FOUND OR u NOT IN (g.owner_id, g.grantor_id) THEN RETURN 'introuvable'; END IF;
  IF g.status NOT IN ('en_attente','actif') THEN RETURN 'deja_termine'; END IF;
  IF g.status = 'actif' AND g.created_at < now() - interval '7 days' THEN RETURN 'acces_definitif'; END IF;
  UPDATE public.course_grants SET status = 'revoque_proprietaire', can_reshare = false, ended_at = now() WHERE id = g.id;
  RETURN 'revoque';
END $$;

CREATE OR REPLACE FUNCTION public.grant_set_reshare(_grant_id uuid, _value boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.course_grants SET can_reshare = _value WHERE id = _grant_id AND owner_id = auth.uid() AND grantor_id = owner_id AND status IN ('en_attente','actif');
  RETURN CASE WHEN FOUND THEN 'ok' ELSE 'introuvable' END;
END $$;

-- Le destinataire choisit de passer à la dernière version publiée.
CREATE OR REPLACE FUNCTION public.grant_update_version(_grant_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; latest uuid;
BEGIN
  SELECT * INTO g FROM public.course_grants WHERE id = _grant_id AND recipient_id = auth.uid() AND status = 'actif';
  IF NOT FOUND THEN RETURN 'introuvable'; END IF;
  SELECT v.id INTO latest FROM public.course_versions v JOIN public.academy_courses c ON c.id = v.course_id
   WHERE v.course_id = g.course_id AND c.archived_at IS NULL ORDER BY v.version DESC LIMIT 1;
  IF latest IS NULL OR latest = g.version_id THEN RETURN 'a_jour'; END IF;
  UPDATE public.course_grants SET version_id = latest WHERE id = g.id;
  RETURN 'ok';
END $$;

-- Modération (admin) : coupe tous les accès aux formations contenant la vidéo.
CREATE OR REPLACE FUNCTION public.moderate_video(_video_id uuid, _reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIS'; END IF;
  IF char_length(btrim(COALESCE(_reason, ''))) < 5 THEN RAISE EXCEPTION 'MOTIF_REQUIS'; END IF;
  UPDATE public.user_videos SET moderated_at = now(), moderation_reason = left(_reason, 500), deleted_at = now() WHERE id = _video_id AND moderated_at IS NULL;
  IF NOT FOUND THEN RETURN 'introuvable'; END IF;
  UPDATE public.course_grants g SET status = 'retire_moderation', can_reshare = false, ended_at = now()
   WHERE g.status IN ('en_attente','actif') AND EXISTS (SELECT 1 FROM public.course_versions v WHERE v.id = g.version_id
     AND v.lessons @> jsonb_build_array(jsonb_build_object('video_id', _video_id)));
  UPDATE public.video_reports SET status = 'traite' WHERE video_id = _video_id AND status = 'ouvert';
  RETURN 'retire';
END $$;

REVOKE ALL ON FUNCTION public.course_publish_version(uuid), public.grant_share(uuid, uuid[], boolean, text), public.grant_respond(uuid, boolean),
  public.grant_revoke(uuid), public.grant_set_reshare(uuid, boolean), public.grant_update_version(uuid), public.moderate_video(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.course_publish_version(uuid), public.grant_share(uuid, uuid[], boolean, text), public.grant_respond(uuid, boolean),
  public.grant_revoke(uuid), public.grant_set_reshare(uuid, boolean), public.grant_update_version(uuid), public.moderate_video(uuid, text) TO authenticated;

-- Progression : les leçons de formations utilisateur sont contrôlées par le serveur (octroi/propriétaire) avant l'appel.
CREATE OR REPLACE FUNCTION public.record_lesson_progress(_user_id uuid, _lesson_id uuid, _position integer, _playing boolean, _player_duration integer, _manual boolean DEFAULT false)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  l record; p record; dur integer; credit integer := 0; pos integer;
BEGIN
  SELECT les.id, les.course_id, les.duration_minutes INTO l
  FROM academy_lessons les JOIN academy_courses c ON c.id = les.course_id
  WHERE les.id = _lesson_id AND ((les.status = 'publie' AND c.status = 'publie') OR c.owner_id IS NOT NULL);
  IF NOT FOUND THEN RETURN 'indisponible'; END IF;
  dur := GREATEST(COALESCE(NULLIF(_player_duration, 0), l.duration_minutes * 60), l.duration_minutes * 30, 30);
  pos := LEAST(GREATEST(COALESCE(_position, 0), 0), dur);
  SELECT * INTO p FROM academy_lesson_progress WHERE user_id = _user_id AND lesson_id = _lesson_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO academy_lesson_progress(user_id, lesson_id, course_id, position_seconds, duration_seconds, playing)
    VALUES (_user_id, _lesson_id, l.course_id, pos, dur, _playing);
    RETURN 'en_cours';
  END IF;
  IF p.playing AND _playing IS NOT NULL THEN
    credit := LEAST(GREATEST(EXTRACT(EPOCH FROM now() - p.last_activity_at)::integer, 0), GREATEST(pos - p.position_seconds + 2, 0), 30);
  END IF;
  UPDATE academy_lesson_progress SET
    position_seconds = pos,
    watched_seconds = LEAST(p.watched_seconds + credit, dur),
    duration_seconds = dur,
    playing = COALESCE(_playing, false),
    last_activity_at = now(),
    status = CASE WHEN p.status = 'terminee'
                    OR p.watched_seconds + credit >= dur * 0.8
                    OR (_manual AND now() - p.started_at >= make_interval(secs => dur * 0.6)) THEN 'terminee' ELSE 'en_cours' END,
    completed_at = COALESCE(p.completed_at, CASE
                    WHEN p.watched_seconds + credit >= dur * 0.8 THEN now()
                    WHEN _manual AND now() - p.started_at >= make_interval(secs => dur * 0.6) THEN now() END),
    completion_method = COALESCE(p.completion_method, CASE
                    WHEN p.watched_seconds + credit >= dur * 0.8 THEN 'lecture'
                    WHEN _manual AND now() - p.started_at >= make_interval(secs => dur * 0.6) THEN 'manuel' END)
  WHERE user_id = _user_id AND lesson_id = _lesson_id;
  RETURN (SELECT status FROM academy_lesson_progress WHERE user_id = _user_id AND lesson_id = _lesson_id);
END $function$;
REVOKE ALL ON FUNCTION public.record_lesson_progress(uuid, uuid, integer, boolean, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_lesson_progress(uuid, uuid, integer, boolean, integer, boolean) TO service_role;