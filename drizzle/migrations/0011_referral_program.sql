ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS bonus boolean NOT NULL DEFAULT false;

CREATE TABLE public.referral_codes (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_codes_select_own ON public.referral_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'inscrit' CHECK (status IN ('inscrit','valide')),
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  rewarded boolean NOT NULL DEFAULT false,
  paid_rewarded boolean NOT NULL DEFAULT false,
  reward_note text NOT NULL DEFAULT '',
  CHECK (referrer_id <> referred_id)
);
CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_id);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY referrals_select_own ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('pro_trial','ai_bonus','sub_extension','paid_conversion')),
  value integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_rewards_user_idx ON public.referral_rewards(user_id);
GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_rewards_select_own ON public.referral_rewards FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Plan payé effectif, sans contrôle d'appelant (usage interne uniquement)
CREATE OR REPLACE FUNCTION public._paid_plan_of(_user_id uuid)
RETURNS plan_type LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record;
BEGIN
  SELECT plan, status, date_renouvellement INTO s FROM public.subscriptions WHERE user_id = _user_id LIMIT 1;
  IF NOT FOUND THEN RETURN 'gratuit'; END IF;
  IF s.status = 'actif' AND (s.date_renouvellement IS NULL OR now() <= s.date_renouvellement + interval '3 days') THEN RETURN s.plan; END IF;
  RETURN 'gratuit';
END $$;
REVOKE EXECUTE ON FUNCTION public._paid_plan_of(uuid) FROM PUBLIC, anon, authenticated;

-- Plan des fonctionnalités (hors IA) : Pro pendant un essai de parrainage actif
CREATE OR REPLACE FUNCTION public.feature_plan(_user_id uuid)
RETURNS plan_type LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.plan_type;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN RETURN 'gratuit'; END IF;
  p := public._paid_plan_of(_user_id);
  IF p = 'gratuit' AND EXISTS (SELECT 1 FROM public.referral_rewards WHERE user_id = _user_id AND type = 'pro_trial' AND expires_at > now()) THEN
    RETURN 'pro';
  END IF;
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public._ai_bonus_left(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT GREATEST(0,
    COALESCE((SELECT sum(value) FROM public.referral_rewards WHERE user_id = _user_id AND type = 'ai_bonus'), 0)::int
    - (SELECT count(*) FROM public.ai_usage_log WHERE user_id = _user_id AND bonus)::int)
$$;
REVOKE EXECUTE ON FUNCTION public._ai_bonus_left(uuid) FROM PUBLIC, anon, authenticated;

-- Générations en plus du quota de base visibles ce mois (bonus restants + bonus utilisés ce mois)
CREATE OR REPLACE FUNCTION public.my_ai_bonus()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN 0 ELSE
    public._ai_bonus_left(auth.uid()) + (SELECT count(*) FROM public.ai_usage_log WHERE user_id = auth.uid() AND bonus
      AND created_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'))::int END
$$;

CREATE OR REPLACE FUNCTION public.reserve_ai_generation(_type ai_generation_type)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u uuid := auth.uid(); p public.plan_type; lim integer; n integer; rid uuid; use_bonus boolean := false;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ai_quota:' || u::text));
  p := public.effective_plan(u);
  lim := CASE p WHEN 'gratuit' THEN 5 WHEN 'pro' THEN 100 ELSE 500 END;
  SELECT count(*) INTO n FROM public.ai_usage_log
   WHERE user_id = u AND NOT bonus AND created_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
  IF n >= lim THEN
    IF public._ai_bonus_left(u) > 0 THEN use_bonus := true;
    ELSE RAISE EXCEPTION 'LIMITE_IA:%', lim USING ERRCODE = 'P0001'; END IF;
  END IF;
  INSERT INTO public.ai_usage_log(user_id, generation_type, credits_estimes, bonus) VALUES (u, _type, 0, use_bonus) RETURNING id INTO rid;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_prospect_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.plan_type; lim integer; n integer;
BEGIN
  p := public._paid_plan_of(NEW.user_id);
  IF p = 'gratuit' AND EXISTS (SELECT 1 FROM public.referral_rewards WHERE user_id = NEW.user_id AND type = 'pro_trial' AND expires_at > now()) THEN p := 'pro'; END IF;
  lim := CASE WHEN p = 'gratuit' THEN 10 ELSE -1 END;
  IF lim >= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('prospects:' || NEW.user_id::text));
    SELECT count(*) INTO n FROM public.prospects WHERE user_id = NEW.user_id;
    IF n >= lim THEN
      RAISE EXCEPTION 'LIMITE_PROSPECTS: Tu as atteint la limite de % prospects du plan Gratuit. Passe à un plan supérieur pour en ajouter.', lim USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Validation : 1er prospect du filleul
CREATE OR REPLACE FUNCTION public.process_referral_validation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; rp public.plan_type; m timestamptz := (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
  nrew integer; bonus_month integer; trial_end timestamptz; s record;
BEGIN
  SELECT * INTO r FROM public.referrals WHERE referred_id = NEW.user_id AND status = 'inscrit' FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  UPDATE public.referrals SET status = 'valide', validated_at = now() WHERE id = r.id;
  PERFORM pg_advisory_xact_lock(hashtext('referral_rewards:' || r.referrer_id::text));
  SELECT count(*) INTO nrew FROM public.referrals WHERE referrer_id = r.referrer_id AND rewarded AND validated_at >= m;
  IF nrew >= 3 THEN
    UPDATE public.referrals SET reward_note = 'plafond_mensuel' WHERE id = r.id;
    RETURN NEW;
  END IF;
  rp := public._paid_plan_of(r.referrer_id);
  IF rp <> 'gratuit' THEN
    SELECT id, date_renouvellement INTO s FROM public.subscriptions WHERE user_id = r.referrer_id;
    IF s.date_renouvellement IS NOT NULL THEN
      UPDATE public.subscriptions SET date_renouvellement = GREATEST(s.date_renouvellement, now()) + interval '7 days' WHERE id = s.id;
    END IF;
    INSERT INTO public.referral_rewards(user_id, referral_id, type, value) VALUES (r.referrer_id, r.id, 'sub_extension', 7);
  ELSE
    SELECT GREATEST(COALESCE(max(expires_at), now()), now()) + interval '15 days' INTO trial_end
      FROM public.referral_rewards WHERE user_id = r.referrer_id AND type = 'pro_trial';
    INSERT INTO public.referral_rewards(user_id, referral_id, type, value, expires_at) VALUES (r.referrer_id, r.id, 'pro_trial', 15, trial_end);
    SELECT COALESCE(sum(value), 0) INTO bonus_month FROM public.referral_rewards WHERE user_id = r.referrer_id AND type = 'ai_bonus' AND created_at >= m;
    IF bonus_month + 10 <= 30 THEN
      INSERT INTO public.referral_rewards(user_id, referral_id, type, value) VALUES (r.referrer_id, r.id, 'ai_bonus', 10);
    END IF;
  END IF;
  UPDATE public.referrals SET rewarded = true WHERE id = r.id;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.process_referral_validation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER prospects_referral_validation AFTER INSERT ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.process_referral_validation();

-- Filleul validé passant sur un plan payant : +1 mois pour le parrain, une fois
CREATE OR REPLACE FUNCTION public.process_referral_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; s record; trial_end timestamptz;
BEGIN
  IF NEW.plan = 'gratuit' OR NEW.status <> 'actif' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.plan = NEW.plan AND OLD.status = NEW.status THEN RETURN NEW; END IF;
  SELECT * INTO r FROM public.referrals WHERE referred_id = NEW.user_id AND status = 'valide' AND NOT paid_rewarded FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  UPDATE public.referrals SET paid_rewarded = true WHERE id = r.id;
  IF public._paid_plan_of(r.referrer_id) <> 'gratuit' THEN
    SELECT id, date_renouvellement INTO s FROM public.subscriptions WHERE user_id = r.referrer_id;
    IF s.date_renouvellement IS NOT NULL THEN
      UPDATE public.subscriptions SET date_renouvellement = GREATEST(s.date_renouvellement, now()) + interval '1 month' WHERE id = s.id;
    END IF;
    INSERT INTO public.referral_rewards(user_id, referral_id, type, value) VALUES (r.referrer_id, r.id, 'paid_conversion', 30);
  ELSE
    SELECT GREATEST(COALESCE(max(expires_at), now()), now()) + interval '1 month' INTO trial_end
      FROM public.referral_rewards WHERE user_id = r.referrer_id AND type = 'pro_trial';
    INSERT INTO public.referral_rewards(user_id, referral_id, type, value, expires_at) VALUES (r.referrer_id, r.id, 'pro_trial', 30, trial_end);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.process_referral_paid() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER subscriptions_referral_paid AFTER INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.process_referral_paid();