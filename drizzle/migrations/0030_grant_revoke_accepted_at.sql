-- Délai de retrait volontaire : 7 jours à partir de l'acceptation (repli sur la date du partage si absente).
CREATE OR REPLACE FUNCTION public.grant_revoke(_grant_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); g record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO g FROM public.course_grants WHERE id = _grant_id FOR UPDATE;
  IF NOT FOUND OR u NOT IN (g.owner_id, g.grantor_id) THEN RETURN 'introuvable'; END IF;
  IF g.status NOT IN ('en_attente','actif') THEN RETURN 'deja_termine'; END IF;
  IF g.status = 'actif' AND now() >= COALESCE(g.accepted_at, g.created_at) + interval '7 days' THEN RETURN 'acces_definitif'; END IF;
  UPDATE public.course_grants SET status = 'revoque_proprietaire', can_reshare = false, ended_at = now() WHERE id = g.id;
  RETURN 'revoque';
END $$;
REVOKE ALL ON FUNCTION public.grant_revoke(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_revoke(uuid) TO authenticated, service_role;