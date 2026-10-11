CREATE OR REPLACE FUNCTION public.reserve_ai_generation(_type public.ai_generation_type)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE u uuid := auth.uid(); p public.plan_type; lim integer; n integer; rid uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ai_quota:' || u::text));
  p := public.effective_plan(u);
  lim := CASE p WHEN 'gratuit' THEN 5 WHEN 'pro' THEN 100 ELSE 500 END;
  SELECT count(*) INTO n FROM public.ai_usage_log
   WHERE user_id = u AND created_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
  IF n >= lim THEN
    RAISE EXCEPTION 'LIMITE_IA:%', lim USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.ai_usage_log(user_id, generation_type, credits_estimes) VALUES (u, _type, 0) RETURNING id INTO rid;
  RETURN rid;
END $$;

REVOKE ALL ON FUNCTION public.reserve_ai_generation(public.ai_generation_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(public.ai_generation_type) TO authenticated;