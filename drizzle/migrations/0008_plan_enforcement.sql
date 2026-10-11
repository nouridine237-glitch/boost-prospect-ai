CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
RETURNS public.plan_type
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE s record;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN 'gratuit';
  END IF;
  SELECT plan, status, date_renouvellement INTO s FROM public.subscriptions WHERE user_id = _user_id LIMIT 1;
  IF NOT FOUND THEN RETURN 'gratuit'; END IF;
  IF s.status = 'actif' AND (s.date_renouvellement IS NULL OR now() <= s.date_renouvellement + interval '3 days') THEN
    RETURN s.plan;
  END IF;
  RETURN 'gratuit';
END $$;

REVOKE ALL ON FUNCTION public.effective_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_plan(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_prospect_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE p public.plan_type; lim integer; n integer;
BEGIN
  p := public.effective_plan(NEW.user_id);
  lim := CASE WHEN p = 'gratuit' THEN 10 ELSE -1 END;
  IF lim >= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('prospects:' || NEW.user_id::text));
    SELECT count(*) INTO n FROM public.prospects WHERE user_id = NEW.user_id;
    IF n >= lim THEN
      RAISE EXCEPTION 'LIMITE_PROSPECTS: Tu as atteint la limite de % prospects du plan Gratuit. Passe à un plan supérieur pour en ajouter.', lim
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prospects_enforce_limit ON public.prospects;
CREATE TRIGGER prospects_enforce_limit BEFORE INSERT ON public.prospects
FOR EACH ROW EXECUTE FUNCTION public.enforce_prospect_limit();