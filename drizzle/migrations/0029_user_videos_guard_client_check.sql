-- Inside a SECURITY DEFINER function current_user is the owner, so detect browser callers from the JWT role.
CREATE OR REPLACE FUNCTION public.user_videos_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.plan_type; q record; used bigint; n integer; is_client boolean := COALESCE(auth.jwt() ->> 'role', '') = 'authenticated';
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_id <> OLD.owner_id OR NEW.storage_path <> OLD.storage_path OR NEW.size_bytes <> OLD.size_bytes THEN RAISE EXCEPTION 'Immutable'; END IF;
    IF is_client AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.thumb_path IS DISTINCT FROM OLD.thumb_path
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.moderated_at IS DISTINCT FROM OLD.moderated_at
       OR NEW.moderation_reason IS DISTINCT FROM OLD.moderation_reason OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.duration_seconds IS DISTINCT FROM OLD.duration_seconds) THEN RAISE EXCEPTION 'CHAMP_PROTEGE'; END IF;
    RETURN NEW;
  END IF;
  IF is_client THEN
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