DO $$ BEGIN
  CREATE TYPE public.prospect_status AS ENUM ('nouveau','contacté','discussion','intéressé','client','non_intéressé');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_generation_type AS ENUM ('message_prospection','reponse_prospect','script_appel','post_reseau_social');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_status_check;
ALTER TABLE public.prospects ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.prospects
  ALTER COLUMN status TYPE public.prospect_status
  USING (CASE lower(status)
    WHEN 'contacté' THEN 'contacté'
    WHEN 'discussion' THEN 'discussion'
    WHEN 'intéressé' THEN 'intéressé'
    WHEN 'client' THEN 'client'
    WHEN 'non intéressé' THEN 'non_intéressé'
    WHEN 'non_intéressé' THEN 'non_intéressé'
    ELSE 'nouveau' END)::public.prospect_status;
ALTER TABLE public.prospects ALTER COLUMN status SET DEFAULT 'nouveau'::public.prospect_status;
ALTER TABLE public.prospects ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS next_followup_date date;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS interest_level smallint;
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_interest_level_check;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_interest_level_check CHECK (interest_level IS NULL OR (interest_level BETWEEN 1 AND 5));
ALTER TABLE public.prospects ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.prospects ALTER COLUMN notes DROP NOT NULL;
ALTER TABLE public.prospects ALTER COLUMN social_network DROP NOT NULL;

ALTER TABLE public.ai_generations ADD COLUMN IF NOT EXISTS prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL;
ALTER TABLE public.ai_generations ADD COLUMN IF NOT EXISTS generation_type public.ai_generation_type NOT NULL DEFAULT 'message_prospection';

CREATE INDEX IF NOT EXISTS prospects_user_id_idx ON public.prospects(user_id);
CREATE INDEX IF NOT EXISTS ai_generations_user_id_idx ON public.ai_generations(user_id);
CREATE INDEX IF NOT EXISTS ai_generations_prospect_id_idx ON public.ai_generations(prospect_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generations TO authenticated;
GRANT ALL ON public.ai_generations TO service_role;

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
