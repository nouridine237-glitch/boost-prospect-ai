-- Droits d'exécution : feature_plan réservé aux connectés ; _can_lead appelé uniquement par d'autres fonctions.
REVOKE ALL ON FUNCTION public.feature_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feature_plan(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._can_lead(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._can_lead(uuid) TO service_role;

-- Tables de la vidéothèque : aucun accès anonyme, droits connectés réduits au strict nécessaire (RLS inchangée).
REVOKE ALL ON public.course_grants, public.course_versions, public.user_videos, public.video_views, public.academy_courses, public.academy_lessons FROM anon;
REVOKE ALL ON public.course_grants, public.course_versions, public.video_views FROM authenticated;
GRANT SELECT ON public.course_grants, public.course_versions TO authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_videos, public.academy_courses, public.academy_lessons FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_videos, public.academy_courses, public.academy_lessons TO authenticated;
GRANT ALL ON public.course_grants, public.course_versions, public.user_videos, public.video_views, public.academy_courses, public.academy_lessons TO service_role;