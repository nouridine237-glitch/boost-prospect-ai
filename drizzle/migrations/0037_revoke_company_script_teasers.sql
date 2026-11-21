REVOKE ALL ON FUNCTION public.company_script_teasers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_script_teasers() TO service_role;