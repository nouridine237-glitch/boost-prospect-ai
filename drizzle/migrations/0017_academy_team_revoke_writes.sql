REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.academy_progress, public.team_links FROM authenticated, anon;
REVOKE ALL ON public.academy_progress, public.team_links FROM anon;