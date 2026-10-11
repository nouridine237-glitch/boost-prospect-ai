ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE, TRUNCATE ON public.ai_usage_log FROM authenticated, anon;
GRANT SELECT, INSERT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;