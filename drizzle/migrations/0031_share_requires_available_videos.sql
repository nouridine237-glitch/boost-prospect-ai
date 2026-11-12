-- Une vidéo est « disponible » si prête, non supprimée, non modérée et son fichier présent dans le stockage.
CREATE OR REPLACE FUNCTION public._video_available(_video_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_videos v JOIN storage.objects o ON o.bucket_id = 'user-videos' AND o.name = v.storage_path
    WHERE v.id = _video_id AND v.status = 'pret' AND v.deleted_at IS NULL AND v.moderated_at IS NULL)
$$;
REVOKE ALL ON FUNCTION public._video_available(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._video_available(uuid) TO service_role;

-- Partage : le propriétaire doit être Business/admin ; le membre autorisé à repartager n'a AUCUNE condition de plan
-- (accès actif + can_reshare + membre actif de l'équipe du propriétaire). Refus si la version contient une vidéo indisponible.
CREATE OR REPLACE FUNCTION public.grant_share(_course_id uuid, _recipients uuid[], _can_reshare boolean, _origin text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF EXISTS (SELECT 1 FROM public.course_versions v, jsonb_array_elements(v.lessons) e
             WHERE v.id = ver AND NOT public._video_available((e->>'video_id')::uuid)) THEN RAISE EXCEPTION 'VERSION_INCOMPLETE'; END IF;
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
REVOKE ALL ON FUNCTION public.grant_share(uuid, uuid[], boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_share(uuid, uuid[], boolean, text) TO authenticated, service_role;

-- Publication : seules les leçons dont la vidéo est réellement disponible (fichier compris) entrent dans la version.
CREATE OR REPLACE FUNCTION public.course_publish_version(_course_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); c record; v integer; ls jsonb;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO c FROM public.academy_courses WHERE id = _course_id AND owner_id = u AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORMATION_INTROUVABLE'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('lesson_id', l.id, 'title', l.title, 'summary', l.summary, 'module', l.module_title,
      'video_id', l.user_video_id, 'duration', vv.duration_seconds) ORDER BY l.sort_order, l.created_at), '[]'::jsonb) INTO ls
  FROM public.academy_lessons l JOIN public.user_videos vv ON vv.id = l.user_video_id
  WHERE l.course_id = _course_id AND l.archived_at IS NULL AND public._video_available(vv.id);
  IF jsonb_array_length(ls) = 0 THEN RAISE EXCEPTION 'AUCUNE_LECON'; END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v FROM public.course_versions WHERE course_id = _course_id;
  INSERT INTO public.course_versions(course_id, version, title, description, lessons) VALUES (_course_id, v, c.title, c.description, ls);
  UPDATE public.academy_courses SET status = 'publie' WHERE id = _course_id;
  UPDATE public.academy_lessons SET status = 'publie' WHERE course_id = _course_id AND archived_at IS NULL;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.course_publish_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.course_publish_version(uuid) TO authenticated, service_role;