CREATE TABLE public.action_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 goal text NOT NULL CHECK (goal IN ('clients','recruter','relancer')),
 target integer NOT NULL CHECK (target BETWEEN 1 AND 50),
 minutes_per_day smallint NOT NULL CHECK (minutes_per_day IN (15,30,60)),
 rest_days smallint[] NOT NULL DEFAULT '{}' CHECK (rest_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[] AND cardinality(rest_days) <= 6),
 starts_on date NOT NULL,
 ends_on date GENERATED ALWAYS AS (starts_on + 27) STORED,
 campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'actif' CHECK (status IN ('actif','termine','abandonne')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX action_plans_user_status ON public.action_plans(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;
REVOKE ALL ON public.action_plans FROM anon;
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "action_plans own select" ON public.action_plans FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "action_plans own insert" ON public.action_plans FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "action_plans own update" ON public.action_plans FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "action_plans own delete" ON public.action_plans FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.action_plan_weeks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plan_id uuid NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
 user_id uuid NOT NULL DEFAULT auth.uid(),
 week_index smallint NOT NULL CHECK (week_index BETWEEN 1 AND 4),
 contacts_target integer NOT NULL DEFAULT 0 CHECK (contacts_target BETWEEN 0 AND 500),
 relances_target integer NOT NULL DEFAULT 0 CHECK (relances_target BETWEEN 0 AND 500),
 posts_target integer NOT NULL DEFAULT 0 CHECK (posts_target BETWEEN 0 AND 500),
 adjusted boolean NOT NULL DEFAULT false,
 adjust_note text NOT NULL DEFAULT '' CHECK (char_length(adjust_note) <= 200),
 reviewed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (plan_id, week_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plan_weeks TO authenticated;
GRANT ALL ON public.action_plan_weeks TO service_role;
REVOKE ALL ON public.action_plan_weeks FROM anon;
ALTER TABLE public.action_plan_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "action_plan_weeks own select" ON public.action_plan_weeks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "action_plan_weeks own insert" ON public.action_plan_weeks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "action_plan_weeks own update" ON public.action_plan_weeks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "action_plan_weeks own delete" ON public.action_plan_weeks FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.action_plan_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; changed boolean;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN RAISE EXCEPTION 'Owner cannot change'; END IF;
 NEW.updated_at := now();
 changed := TG_OP = 'INSERT' OR (NEW.status = 'actif' AND OLD.status <> 'actif')
   OR NEW.goal IS DISTINCT FROM OLD.goal OR NEW.target IS DISTINCT FROM OLD.target
   OR NEW.minutes_per_day IS DISTINCT FROM OLD.minutes_per_day OR NEW.rest_days IS DISTINCT FROM OLD.rest_days
   OR NEW.starts_on IS DISTINCT FROM OLD.starts_on OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id;
 IF changed AND public.effective_plan(NEW.user_id) = 'gratuit' THEN RAISE EXCEPTION 'PLAN_PAYANT_REQUIS'; END IF;
 IF (TG_OP = 'INSERT' OR NEW.starts_on IS DISTINCT FROM OLD.starts_on) AND extract(isodow FROM NEW.starts_on) <> 1 THEN RAISE EXCEPTION 'DEBUT_LUNDI'; END IF;
 IF NEW.campaign_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id)
    AND NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = NEW.campaign_id AND user_id = NEW.user_id) THEN RAISE EXCEPTION 'CAMPAGNE_INVALIDE'; END IF;
 IF NEW.status = 'actif' AND (TG_OP = 'INSERT' OR OLD.status <> 'actif') THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || ':action_plan', 0));
   SELECT count(*) INTO n FROM public.action_plans WHERE user_id = NEW.user_id AND status = 'actif' AND id <> NEW.id;
   IF n > 0 THEN RAISE EXCEPTION 'PLAN_DEJA_ACTIF'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.action_plan_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER action_plan_guard BEFORE INSERT OR UPDATE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION public.action_plan_guard();

CREATE FUNCTION public.action_plan_week_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE targets_changed boolean;
BEGIN
 IF TG_OP = 'UPDATE' AND (NEW.user_id <> OLD.user_id OR NEW.plan_id <> OLD.plan_id OR NEW.week_index <> OLD.week_index) THEN RAISE EXCEPTION 'Immutable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.action_plans WHERE id = NEW.plan_id AND user_id = NEW.user_id) THEN RAISE EXCEPTION 'PLAN_INVALIDE'; END IF;
 NEW.updated_at := now();
 targets_changed := TG_OP = 'INSERT' OR NEW.contacts_target <> OLD.contacts_target OR NEW.relances_target <> OLD.relances_target OR NEW.posts_target <> OLD.posts_target;
 IF TG_OP = 'UPDATE' AND OLD.reviewed_at IS NOT NULL AND (targets_changed OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) THEN RAISE EXCEPTION 'SEMAINE_VALIDEE'; END IF;
 IF targets_changed AND public.effective_plan(NEW.user_id) = 'gratuit' THEN RAISE EXCEPTION 'PLAN_PAYANT_REQUIS'; END IF;
 IF NEW.reviewed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.reviewed_at IS NULL) THEN NEW.reviewed_at := now(); END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.action_plan_week_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER action_plan_week_guard BEFORE INSERT OR UPDATE ON public.action_plan_weeks FOR EACH ROW EXECUTE FUNCTION public.action_plan_week_guard();