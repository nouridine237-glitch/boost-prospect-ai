-- Modération d'une vidéo : seule la leçon concernée devient indisponible ; les accès restent actifs.
CREATE OR REPLACE FUNCTION public.moderate_video(_video_id uuid, _reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIS'; END IF;
  IF char_length(btrim(COALESCE(_reason, ''))) < 5 THEN RAISE EXCEPTION 'MOTIF_REQUIS'; END IF;
  UPDATE public.user_videos SET moderated_at = now(), moderation_reason = left(_reason, 500), deleted_at = now() WHERE id = _video_id AND moderated_at IS NULL;
  IF NOT FOUND THEN RETURN 'introuvable'; END IF;
  UPDATE public.video_reports SET status = 'traite' WHERE video_id = _video_id AND status = 'ouvert';
  RETURN 'retire';
END $$;
REVOKE ALL ON FUNCTION public.moderate_video(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_video(uuid, text) TO authenticated, service_role;

-- Retrait administratif explicite d'une formation entière : coupe tous ses accès et l'archive.
CREATE OR REPLACE FUNCTION public.moderate_course(_course_id uuid, _reason text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIS'; END IF;
  IF char_length(btrim(COALESCE(_reason, ''))) < 5 THEN RAISE EXCEPTION 'MOTIF_REQUIS'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.academy_courses WHERE id = _course_id AND owner_id IS NOT NULL) THEN RAISE EXCEPTION 'FORMATION_INTROUVABLE'; END IF;
  UPDATE public.course_grants SET status = 'retire_moderation', can_reshare = false, ended_at = now()
   WHERE course_id = _course_id AND status IN ('en_attente','actif');
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.academy_courses SET archived_at = COALESCE(archived_at, now()) WHERE id = _course_id;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.moderate_course(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_course(uuid, text) TO authenticated, service_role;