CREATE TABLE public.academy_progress (
  user_id uuid NOT NULL,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 20),
  best_score smallint NOT NULL DEFAULT 0,
  total smallint NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  passed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);
GRANT SELECT ON public.academy_progress TO authenticated;
GRANT ALL ON public.academy_progress TO service_role;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY academy_progress_select_own ON public.academy_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Written only by the server after it recomputes the score; never overwrites a better result.
CREATE OR REPLACE FUNCTION public.record_academy_result(_user_id uuid, _level smallint, _score smallint, _total smallint, _passed boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.academy_progress(user_id, level, best_score, total, passed, passed_at, attempts)
  VALUES (_user_id, _level, _score, _total, _passed, CASE WHEN _passed THEN now() END, 1)
  ON CONFLICT (user_id, level) DO UPDATE SET
    best_score = GREATEST(academy_progress.best_score, EXCLUDED.best_score),
    total = EXCLUDED.total,
    passed = academy_progress.passed OR EXCLUDED.passed,
    passed_at = COALESCE(academy_progress.passed_at, EXCLUDED.passed_at),
    attempts = academy_progress.attempts + 1,
    updated_at = now();
$$;
REVOKE ALL ON FUNCTION public.record_academy_result(uuid, smallint, smallint, smallint, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_academy_result(uuid, smallint, smallint, smallint, boolean) TO service_role;

CREATE TABLE public.team_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL,
  member_id uuid,
  invite_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(9), 'hex'),
  status text NOT NULL DEFAULT 'invite' CHECK (status IN ('invite','actif','refuse','quitte','revoque')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at timestamptz,
  ended_at timestamptz
);
CREATE UNIQUE INDEX team_links_one_active_leader ON public.team_links(member_id) WHERE status = 'actif';
CREATE INDEX team_links_leader_idx ON public.team_links(leader_id);
GRANT SELECT ON public.team_links TO authenticated;
GRANT ALL ON public.team_links TO service_role;
ALTER TABLE public.team_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_links_select_parties ON public.team_links FOR SELECT TO authenticated
  USING (auth.uid() = leader_id OR auth.uid() = member_id);

CREATE OR REPLACE FUNCTION public._can_lead(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.feature_plan(_u) = 'business' OR public.has_role(_u, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.team_create_invite() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); c text; n int;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public._can_lead(u) THEN RAISE EXCEPTION 'PLAN_BUSINESS_REQUIS' USING ERRCODE = 'P0001'; END IF;
  SELECT count(*) INTO n FROM public.team_links WHERE leader_id = u AND status = 'invite' AND expires_at > now();
  IF n >= 50 THEN RAISE EXCEPTION 'TROP_INVITATIONS' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.team_links(leader_id) VALUES (u) RETURNING invite_code INTO c;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.team_invite_info(_code text)
RETURNS TABLE(leader_name text, status text, expired boolean, is_self boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(p.display_name, ''), NULLIF(p.full_name, ''), 'Ton leader'), l.status, l.expires_at <= now(), l.leader_id = auth.uid()
  FROM public.team_links l LEFT JOIN public.profiles p ON p.id = l.leader_id
  WHERE l.invite_code = _code AND auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.team_respond_invite(_code text, _accept boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); l record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO l FROM public.team_links WHERE invite_code = _code FOR UPDATE;
  IF NOT FOUND THEN RETURN 'introuvable'; END IF;
  IF l.status <> 'invite' THEN RETURN 'deja_utilisee'; END IF;
  IF l.expires_at <= now() THEN RETURN 'expiree'; END IF;
  IF l.leader_id = u THEN RETURN 'soi_meme'; END IF;
  IF NOT _accept THEN
    UPDATE public.team_links SET status = 'refuse', member_id = u, ended_at = now() WHERE id = l.id;
    RETURN 'refuse';
  END IF;
  IF EXISTS (SELECT 1 FROM public.team_links WHERE member_id = u AND status = 'actif') THEN RETURN 'deja_dans_equipe'; END IF;
  UPDATE public.team_links SET status = 'actif', member_id = u, accepted_at = now() WHERE id = l.id;
  RETURN 'actif';
END $$;

-- Member leaves, or leader revokes / cancels a pending invite.
CREATE OR REPLACE FUNCTION public.team_end_link(_link_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); l record;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO l FROM public.team_links WHERE id = _link_id FOR UPDATE;
  IF NOT FOUND OR l.status NOT IN ('actif','invite') THEN RETURN 'introuvable'; END IF;
  IF l.member_id = u AND l.status = 'actif' THEN
    UPDATE public.team_links SET status = 'quitte', ended_at = now() WHERE id = l.id; RETURN 'quitte';
  ELSIF l.leader_id = u THEN
    UPDATE public.team_links SET status = 'revoque', ended_at = now() WHERE id = l.id; RETURN 'revoque';
  END IF;
  RETURN 'interdit';
END $$;

-- Leader view: learning aggregates only, for accepted members only.
CREATE OR REPLACE FUNCTION public.team_member_progress()
RETURNS TABLE(link_id uuid, member_name text, accepted_at timestamptz, levels_passed int, last_passed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, COALESCE(NULLIF(p.display_name, ''), NULLIF(p.full_name, ''), 'Partenaire'), l.accepted_at,
    (SELECT count(*)::int FROM public.academy_progress a WHERE a.user_id = l.member_id AND a.passed),
    (SELECT max(a.passed_at) FROM public.academy_progress a WHERE a.user_id = l.member_id AND a.passed)
  FROM public.team_links l LEFT JOIN public.profiles p ON p.id = l.member_id
  WHERE l.leader_id = auth.uid() AND l.status = 'actif' AND public._can_lead(auth.uid())
  ORDER BY l.accepted_at DESC
$$;

-- Member view: who is my leader (name only).
CREATE OR REPLACE FUNCTION public.my_team_leader()
RETURNS TABLE(link_id uuid, leader_name text, accepted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, COALESCE(NULLIF(p.display_name, ''), NULLIF(p.full_name, ''), 'Ton leader'), l.accepted_at
  FROM public.team_links l LEFT JOIN public.profiles p ON p.id = l.leader_id
  WHERE l.member_id = auth.uid() AND l.status = 'actif'
$$;

REVOKE ALL ON FUNCTION public._can_lead(uuid), public.team_create_invite(), public.team_invite_info(text), public.team_respond_invite(text, boolean), public.team_end_link(uuid), public.team_member_progress(), public.my_team_leader() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_create_invite(), public.team_invite_info(text), public.team_respond_invite(text, boolean), public.team_end_link(uuid), public.team_member_progress(), public.my_team_leader() TO authenticated;
GRANT EXECUTE ON FUNCTION public._can_lead(uuid) TO service_role;