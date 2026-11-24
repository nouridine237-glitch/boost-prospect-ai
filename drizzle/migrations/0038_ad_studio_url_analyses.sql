CREATE TABLE public.ad_studio_url_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  url text NOT NULL CHECK (char_length(url) BETWEEN 8 AND 2048),
  status text NOT NULL DEFAULT 'en_cours' CHECK (status IN ('en_cours', 'termine', 'echec')),
  report jsonb,
  error text NOT NULL DEFAULT '' CHECK (char_length(error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.ad_studio_url_analyses TO authenticated;
GRANT ALL ON public.ad_studio_url_analyses TO service_role;

ALTER TABLE public.ad_studio_url_analyses ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX ad_studio_url_analyses_one_running ON public.ad_studio_url_analyses (owner_id) WHERE status = 'en_cours';
CREATE INDEX ad_studio_url_analyses_owner_created ON public.ad_studio_url_analyses (owner_id, created_at DESC);

CREATE POLICY ad_studio_url_analyses_select_owner ON public.ad_studio_url_analyses
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND auth.uid() = 'da34c34b-7f66-4103-aa6a-d29f8fe3f300'::uuid);

CREATE POLICY ad_studio_url_analyses_insert_owner ON public.ad_studio_url_analyses
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND auth.uid() = 'da34c34b-7f66-4103-aa6a-d29f8fe3f300'::uuid AND status = 'en_cours');

CREATE POLICY ad_studio_url_analyses_update_owner ON public.ad_studio_url_analyses
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND auth.uid() = 'da34c34b-7f66-4103-aa6a-d29f8fe3f300'::uuid)
  WITH CHECK (owner_id = auth.uid() AND auth.uid() = 'da34c34b-7f66-4103-aa6a-d29f8fe3f300'::uuid);