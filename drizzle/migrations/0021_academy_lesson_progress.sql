CREATE TABLE public.academy_lesson_progress (
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'en_cours' CHECK (status IN ('en_cours','terminee')),
  position_seconds integer NOT NULL DEFAULT 0 CHECK (position_seconds BETWEEN 0 AND 86400),
  watched_seconds integer NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  duration_seconds integer,
  playing boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completion_method text CHECK (completion_method IN ('lecture','manuel')),
  PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX academy_lesson_progress_user_course ON public.academy_lesson_progress(user_id, course_id);
CREATE INDEX academy_lesson_progress_user_activity ON public.academy_lesson_progress(user_id, last_activity_at DESC);
GRANT SELECT ON public.academy_lesson_progress TO authenticated;
GRANT ALL ON public.academy_lesson_progress TO service_role;
ALTER TABLE public.academy_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY academy_lesson_progress_select_own ON public.academy_lesson_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Written only by the server after plan/publication checks. Watched time is credited with the
-- server clock: only between two consecutive "playing" reports, bounded by elapsed time,
-- by the position advance and by 30 s per report. Completion never regresses.
CREATE OR REPLACE FUNCTION public.record_lesson_progress(_user_id uuid, _lesson_id uuid, _position integer, _playing boolean, _player_duration integer, _manual boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record; p record; dur integer; credit integer := 0; pos integer;
BEGIN
  SELECT les.id, les.course_id, les.duration_minutes INTO l
  FROM academy_lessons les JOIN academy_courses c ON c.id = les.course_id
  WHERE les.id = _lesson_id AND les.status = 'publie' AND c.status = 'publie';
  IF NOT FOUND THEN RETURN 'indisponible'; END IF;
  dur := GREATEST(COALESCE(NULLIF(_player_duration, 0), l.duration_minutes * 60), l.duration_minutes * 30, 30);
  pos := LEAST(GREATEST(COALESCE(_position, 0), 0), dur);

  SELECT * INTO p FROM academy_lesson_progress WHERE user_id = _user_id AND lesson_id = _lesson_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO academy_lesson_progress(user_id, lesson_id, course_id, position_seconds, duration_seconds, playing)
    VALUES (_user_id, _lesson_id, l.course_id, pos, dur, _playing);
    RETURN 'en_cours';
  END IF;

  IF p.playing AND _playing IS NOT NULL THEN
    credit := LEAST(GREATEST(EXTRACT(EPOCH FROM now() - p.last_activity_at)::integer, 0), GREATEST(pos - p.position_seconds + 2, 0), 30);
  END IF;

  UPDATE academy_lesson_progress SET
    position_seconds = pos,
    watched_seconds = LEAST(p.watched_seconds + credit, dur),
    duration_seconds = dur,
    playing = COALESCE(_playing, false),
    last_activity_at = now(),
    status = CASE WHEN p.status = 'terminee'
                    OR p.watched_seconds + credit >= dur * 0.8
                    OR (_manual AND now() - p.started_at >= make_interval(secs => dur * 0.6)) THEN 'terminee' ELSE 'en_cours' END,
    completed_at = COALESCE(p.completed_at, CASE
                    WHEN p.watched_seconds + credit >= dur * 0.8 THEN now()
                    WHEN _manual AND now() - p.started_at >= make_interval(secs => dur * 0.6) THEN now() END),
    completion_method = COALESCE(p.completion_method, CASE
                    WHEN p.watched_seconds + credit >= dur * 0.8 THEN 'lecture'
                    WHEN _manual AND now() - p.started_at >= make_interval(secs => dur * 0.6) THEN 'manuel' END)
  WHERE user_id = _user_id AND lesson_id = _lesson_id
  RETURNING status INTO p;
  RETURN (SELECT status FROM academy_lesson_progress WHERE user_id = _user_id AND lesson_id = _lesson_id);
END $$;
REVOKE ALL ON FUNCTION public.record_lesson_progress(uuid, uuid, integer, boolean, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_lesson_progress(uuid, uuid, integer, boolean, integer, boolean) TO service_role;