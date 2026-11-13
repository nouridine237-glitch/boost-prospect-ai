-- Scénarios en base du partage vidéo (Vidéothèque MLM V1).
-- Tout s'exécute dans un seul bloc DO terminé par RAISE EXCEPTION : rien n'est conservé.
-- Usage : remplacer :OWNER et :VIDEO par un admin et une de ses vidéos « Prête » dont le fichier existe, puis exécuter.
DO $$
DECLARE
  a uuid := ':OWNER'; v1 uuid := ':VIDEO';
  b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  v2 uuid := gen_random_uuid(); crs uuid := gen_random_uuid(); crs_b uuid := gen_random_uuid();
  gb uuid; gc uuid; gd uuid; r text; n int; out text[] := '{}';
BEGIN
  -- Données de test (garde-fous désactivés le temps de les créer).
  SET LOCAL session_replication_role = replica;
  INSERT INTO team_links(leader_id, member_id, status, accepted_at) VALUES (a, b, 'actif', now()), (b, c, 'actif', now()), (a, d, 'actif', now());
  INSERT INTO user_videos(id, owner_id, title, storage_path, mime_type, size_bytes, duration_seconds, status, rights_confirmed)
    VALUES (v2, a, 'Vidéo sans fichier', a || '/' || v2 || '.mp4', 'video/mp4', 1000, 10, 'pret', true);
  INSERT INTO academy_courses(id, owner_id, slug, title, description, min_plan, source_type, status, sort_order)
    VALUES (crs, a, 'u-test-' || substr(md5(crs::text), 1, 12), 'Formation test', '', 'gratuit', 'interne', 'brouillon', 0),
           (crs_b, b, 'u-test-' || substr(md5(crs_b::text), 1, 12), 'Formation de B', '', 'gratuit', 'interne', 'brouillon', 0);
  INSERT INTO academy_lessons(course_id, slug, title, summary, module_title, user_video_id, video_provider, video_id, sort_order, status) VALUES
    (crs, 'l-t1-' || substr(md5(random()::text), 1, 10), 'Leçon 1', '', '', v1, 'fichier', v1::text, 10, 'brouillon'),
    (crs, 'l-t2-' || substr(md5(random()::text), 1, 10), 'Leçon 2', '', '', v2, 'fichier', v2::text, 20, 'brouillon');
  INSERT INTO course_versions(course_id, version, title, lessons) VALUES (crs_b, 1, 'Formation de B', '[]');
  SET LOCAL session_replication_role = origin;

  -- 1. Publication : la leçon dont le fichier est absent est exclue.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM course_publish_version(crs);
  SELECT jsonb_array_length(lessons) INTO n FROM course_versions WHERE course_id = crs;
  out := out || ('publication_exclut_fichier_absent=' || (n = 1));

  -- 2. Propriétaire non Business : partage initial refusé.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  BEGIN PERFORM grant_share(crs_b, ARRAY[c], false, 'direct'); out := out || 'proprio_gratuit=ACCEPTE(KO)'::text;
  EXCEPTION WHEN OTHERS THEN out := out || ('proprio_gratuit=' || (SQLERRM = 'PLAN_BUSINESS_REQUIS')); END;

  -- 3. Destinataire hors équipe refusé ; partage normal accepté.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  BEGIN PERFORM grant_share(crs, ARRAY[x], false, 'direct'); out := out || 'hors_equipe=ACCEPTE(KO)'::text;
  EXCEPTION WHEN OTHERS THEN out := out || ('hors_equipe=' || (SQLERRM = 'DESTINATAIRE_HORS_EQUIPE')); END;
  n := grant_share(crs, ARRAY[b], true, 'direct'); out := out || ('partage_b=' || (n = 1));
  n := grant_share(crs, ARRAY[d], false, 'direct');
  SELECT id INTO gb FROM course_grants WHERE course_id = crs AND recipient_id = b;
  SELECT id INTO gd FROM course_grants WHERE course_id = crs AND recipient_id = d;

  -- 4. Repartage par un membre Gratuit autorisé ; le 2e niveau ne repartage jamais.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM grant_respond(gb, true);
  n := grant_share(crs, ARRAY[c], true, 'direct'); out := out || ('repartage_membre_gratuit=' || (n = 1));
  SELECT id INTO gc FROM course_grants WHERE course_id = crs AND recipient_id = c;
  out := out || ('niveau2_sans_repartage=' || NOT (SELECT can_reshare FROM course_grants WHERE id = gc));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  PERFORM grant_respond(gc, true);
  BEGIN PERFORM grant_share(crs, ARRAY[b], false, 'direct'); out := out || 'niveau2_repartage=ACCEPTE(KO)'::text;
  EXCEPTION WHEN OTHERS THEN out := out || ('niveau2_repartage=' || (SQLERRM = 'REPARTAGE_NON_AUTORISE')); END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  out := out || ('set_reshare_niveau2=' || (grant_set_reshare(gc, true) = 'introuvable'));

  -- 5. Retrait : 7 jours depuis l'acceptation (chaque essai est annulé aussitôt).
  UPDATE course_grants SET created_at = now() - interval '10 days', accepted_at = now() - interval '6 days 23 hours' WHERE id = gb;
  BEGIN r := grant_revoke(gb); RAISE EXCEPTION 'R:%', r; EXCEPTION WHEN raise_exception THEN out := out || ('accepte_6j23h=' || (SQLERRM = 'R:revoque')); END;
  UPDATE course_grants SET accepted_at = now() - interval '7 days' WHERE id = gb;
  BEGIN r := grant_revoke(gb); RAISE EXCEPTION 'R:%', r; EXCEPTION WHEN raise_exception THEN out := out || ('accepte_7j_pile=' || (SQLERRM = 'R:acces_definitif')); END;
  UPDATE course_grants SET accepted_at = now() - interval '2 days' WHERE id = gb;
  BEGIN r := grant_revoke(gb); RAISE EXCEPTION 'R:%', r; EXCEPTION WHEN raise_exception THEN out := out || ('partage_10j_accepte_2j=' || (SQLERRM = 'R:revoque')); END;
  UPDATE course_grants SET created_at = now() - interval '30 days' WHERE id = gd;
  BEGIN r := grant_revoke(gd); RAISE EXCEPTION 'R:%', r; EXCEPTION WHEN raise_exception THEN out := out || ('attente_30j=' || (SQLERRM = 'R:revoque')); END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  out := out || ('retrait_par_tiers=' || (grant_revoke(gb) = 'introuvable'));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  BEGIN r := grant_revoke(gc); RAISE EXCEPTION 'R:%', r; EXCEPTION WHEN raise_exception THEN out := out || ('retrait_par_repartageur=' || (SQLERRM = 'R:revoque')); END;

  -- 6. Accès durable : B quitte l'équipe et la formation est archivée ; l'accès reste actif mais B ne peut plus repartager.
  BEGIN
    UPDATE team_links SET status = 'quitte', ended_at = now() WHERE leader_id = a AND member_id = b;
    UPDATE academy_courses SET archived_at = now() WHERE id = crs;
    r := (SELECT status FROM course_grants WHERE id = gb);
    BEGIN PERFORM grant_share(crs, ARRAY[c], false, 'direct'); r := r || ':repartage_accepte';
    EXCEPTION WHEN OTHERS THEN r := r || ':' || SQLERRM; END;
    RAISE EXCEPTION 'R:%', r;
  EXCEPTION WHEN raise_exception THEN out := out || ('acces_durable=' || (SQLERRM IN ('R:actif:FORMATION_INTROUVABLE', 'R:actif:REPARTAGE_NON_AUTORISE'))); END;
  BEGIN
    UPDATE team_links SET status = 'quitte', ended_at = now() WHERE leader_id = a AND member_id = b;
    PERFORM grant_share(crs, ARRAY[c], false, 'direct'); RAISE EXCEPTION 'accepte';
  EXCEPTION WHEN OTHERS THEN out := out || ('repartage_apres_depart=' || (SQLERRM = 'REPARTAGE_NON_AUTORISE')); END;

  -- 7. Version immuable pour un utilisateur connecté.
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN UPDATE course_versions SET title = 'x' WHERE course_id = crs; out := out || 'version_modifiable(KO)'::text;
  EXCEPTION WHEN insufficient_privilege THEN out := out || 'version_update_refuse=true'::text; END;
  BEGIN DELETE FROM course_versions WHERE course_id = crs; out := out || 'version_supprimable(KO)'::text;
  EXCEPTION WHEN insufficient_privilege THEN out := out || 'version_delete_refuse=true'::text; END;
  EXECUTE 'RESET ROLE';

  -- 8. Limite de 50 partages par jour.
  BEGIN
    SET LOCAL session_replication_role = replica;
    INSERT INTO course_grants(course_id, owner_id, grantor_id, recipient_id, origin, status, version_id)
      SELECT crs, a, a, gen_random_uuid(), 'direct', 'refuse', (SELECT id FROM course_versions WHERE course_id = crs LIMIT 1) FROM generate_series(1, 50);
    SET LOCAL session_replication_role = origin;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    UPDATE course_grants SET status = 'refuse' WHERE id = gd;
    PERFORM grant_share(crs, ARRAY[d], false, 'direct'); RAISE EXCEPTION 'accepte';
  EXCEPTION WHEN OTHERS THEN out := out || ('limite_50_jour=' || (SQLERRM = 'LIMITE_PARTAGES_JOUR')); END;
  SET LOCAL session_replication_role = origin;

  -- 9. Modération d'une vidéo : seule la leçon devient indisponible, les accès restent actifs.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  BEGIN PERFORM moderate_video(v1, 'motif de test'); out := out || 'moderation_non_admin=ACCEPTE(KO)'::text;
  EXCEPTION WHEN OTHERS THEN out := out || ('moderation_non_admin=' || (SQLERRM = 'ADMIN_REQUIS')); END;
  BEGIN PERFORM moderate_course(crs, 'motif de test'); out := out || 'retrait_formation_non_admin=ACCEPTE(KO)'::text;
  EXCEPTION WHEN OTHERS THEN out := out || ('retrait_formation_non_admin=' || (SQLERRM = 'ADMIN_REQUIS')); END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  out := out || ('moderation_video=' || (moderate_video(v1, 'motif de test') = 'retire'));
  SELECT count(*) INTO n FROM course_grants WHERE course_id = crs AND recipient_id IN (b, c) AND status = 'actif';
  out := out || ('acces_restent_actifs=' || (n = 2));
  UPDATE course_grants SET status = 'refuse' WHERE id = gd;
  BEGIN PERFORM grant_share(crs, ARRAY[d], false, 'direct'); out := out || 'partage_version_incomplete=ACCEPTE(KO)'::text;
  EXCEPTION WHEN OTHERS THEN out := out || ('partage_version_incomplete=' || (SQLERRM = 'VERSION_INCOMPLETE')); END;

  -- 10. Retrait administratif de toute la formation : action distincte.
  n := moderate_course(crs, 'motif de test');
  out := out || ('retrait_formation_compte=' || (n = 2));
  out := out || ('retrait_formation_statuts=' || NOT EXISTS (SELECT 1 FROM course_grants WHERE course_id = crs AND recipient_id IN (b, c) AND status <> 'retire_moderation'));
  out := out || ('formation_archivee=' || (SELECT archived_at IS NOT NULL FROM academy_courses WHERE id = crs));

  RAISE EXCEPTION 'RESULTS %', array_to_string(out, ' | ');
END $$;
