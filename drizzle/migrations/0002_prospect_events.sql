CREATE TABLE public.prospect_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  type text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospect_events_type_check CHECK (type IN ('message_envoyé','message_copié','changement_statut','relance_reportée','note_modifiée'))
);
CREATE INDEX prospect_events_prospect_idx ON public.prospect_events (prospect_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.prospect_events TO authenticated;
GRANT ALL ON public.prospect_events TO service_role;
ALTER TABLE public.prospect_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY prospect_events_select_own ON public.prospect_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY prospect_events_insert_own ON public.prospect_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.user_id = auth.uid()));
CREATE POLICY prospect_events_delete_own ON public.prospect_events FOR DELETE TO authenticated USING (auth.uid() = user_id);