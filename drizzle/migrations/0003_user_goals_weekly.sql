CREATE TABLE public.user_goals_weekly (
  user_id uuid PRIMARY KEY,
  contacts_goal integer NOT NULL DEFAULT 10 CHECK (contacts_goal BETWEEN 1 AND 1000),
  relances_goal integer NOT NULL DEFAULT 5 CHECK (relances_goal BETWEEN 1 AND 1000),
  recrues_goal integer NOT NULL DEFAULT 1 CHECK (recrues_goal BETWEEN 1 AND 1000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_goals_weekly TO authenticated;
GRANT ALL ON public.user_goals_weekly TO service_role;
ALTER TABLE public.user_goals_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_goals_select_own ON public.user_goals_weekly FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_goals_insert_own ON public.user_goals_weekly FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_goals_update_own ON public.user_goals_weekly FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_goals_set_updated_at BEFORE UPDATE ON public.user_goals_weekly FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();