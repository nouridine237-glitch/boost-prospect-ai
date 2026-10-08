ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT '';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS product_interest text NOT NULL DEFAULT '';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS main_objection text NOT NULL DEFAULT '';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS first_contact_at date;
COMMENT ON COLUMN public.prospects.interest_level IS '1=Froid, 2=Tiède, 3=Chaud';