CREATE TABLE public.duplication_progress (
 user_id uuid NOT NULL,
 track text NOT NULL,
 day smallint NOT NULL,
 checked_actions smallint[] NOT NULL DEFAULT '{}',
 completed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, track, day),
 CONSTRAINT duplication_track_day CHECK ((track = 'path' AND day BETWEEN 1 AND 7) OR (track IN ('demarrage','decouverte','suivi','transmission') AND day = 1))
);
GRANT SELECT ON public.duplication_progress TO authenticated;
GRANT ALL ON public.duplication_progress TO service_role;
ALTER TABLE public.duplication_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY duplication_progress_read_own ON public.duplication_progress FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.effective_plan(auth.uid()) IN ('pro','expert','business'));

CREATE FUNCTION public.save_duplication_progress(_track text, _day smallint, _actions smallint[], _complete boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); n integer; previous_completed timestamptz;
BEGIN
 IF u IS NULL OR public.effective_plan(u) NOT IN ('pro','expert','business') THEN RAISE EXCEPTION 'Paid plan required'; END IF;
 IF _track IS NULL OR _day IS NULL OR _complete IS NULL OR _actions IS NULL THEN RAISE EXCEPTION 'Invalid input'; END IF;
 IF _track = 'path' AND _day BETWEEN 1 AND 7 THEN n := 3;
 ELSIF _track IN ('demarrage','decouverte','suivi','transmission') AND _day = 1 THEN n := 4;
 ELSE RAISE EXCEPTION 'Invalid track or day'; END IF;
 IF cardinality(_actions) > n OR EXISTS (SELECT 1 FROM unnest(_actions) a WHERE a IS NULL OR a < 0 OR a >= n) OR cardinality(_actions) <> (SELECT count(DISTINCT a) FROM unnest(_actions) a) THEN RAISE EXCEPTION 'Invalid actions'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text || ':duplication', 0));
 IF _track = 'path' AND _day > 1 AND (SELECT count(*) FROM public.duplication_progress WHERE user_id = u AND track = 'path' AND day < _day AND completed_at IS NOT NULL) <> _day - 1 THEN RAISE EXCEPTION 'Complete previous days first'; END IF;
 SELECT completed_at INTO previous_completed FROM public.duplication_progress WHERE user_id = u AND track = _track AND day = _day;
 IF previous_completed IS NOT NULL THEN RETURN; END IF;
 IF _complete AND cardinality(_actions) <> n THEN RAISE EXCEPTION 'Complete checklist first'; END IF;
 INSERT INTO public.duplication_progress(user_id,track,day,checked_actions,completed_at)
 VALUES(u,_track,_day,_actions,CASE WHEN _complete THEN now() ELSE NULL END)
 ON CONFLICT(user_id,track,day) DO UPDATE SET checked_actions=EXCLUDED.checked_actions, completed_at=EXCLUDED.completed_at, updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.save_duplication_progress(text,smallint,smallint[],boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_duplication_progress(text,smallint,smallint[],boolean) TO authenticated;