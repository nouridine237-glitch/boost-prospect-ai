REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.academy_lesson_progress FROM authenticated, anon;
REVOKE ALL ON public.academy_lesson_progress FROM anon;