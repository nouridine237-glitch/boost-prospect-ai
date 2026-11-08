CREATE TABLE public.campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
 objective text NOT NULL CHECK (objective IN ('notoriete','produit','temoignage','invitation','education')),
 channel text NOT NULL CHECK (channel IN ('whatsapp','facebook','autre','multi')),
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
 archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_on >= starts_on)
);
CREATE INDEX campaigns_user_start ON public.campaigns(user_id, starts_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
REVOKE ALL ON public.campaigns FROM anon;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns own select" ON public.campaigns FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "campaigns own insert" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "campaigns own update" ON public.campaigns FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "campaigns own delete" ON public.campaigns FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.campaigns_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN RAISE EXCEPTION 'Owner cannot change'; END IF;
 NEW.updated_at := now();
 IF NOT NEW.archived AND NEW.ends_on >= current_date AND public.effective_plan(NEW.user_id) = 'gratuit'
    AND (TG_OP = 'INSERT' OR OLD.archived OR OLD.ends_on < current_date) THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || ':campaign', 0));
   SELECT count(*) INTO n FROM public.campaigns WHERE user_id = NEW.user_id AND NOT archived AND ends_on >= current_date AND id <> NEW.id;
   IF n >= 1 THEN RAISE EXCEPTION 'LIMITE_CAMPAGNES:1'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.campaigns_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER campaigns_guard BEFORE INSERT OR UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.campaigns_guard();

ALTER TABLE public.content_posts ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.prospects ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.prospects ADD COLUMN source_post_id uuid REFERENCES public.content_posts(id) ON DELETE SET NULL;
CREATE INDEX content_posts_campaign ON public.content_posts(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX prospects_campaign ON public.prospects(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX prospects_source_post ON public.prospects(source_post_id) WHERE source_post_id IS NOT NULL;

CREATE FUNCTION public.campaign_link_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
 IF NEW.campaign_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id) THEN
   IF NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = NEW.campaign_id AND user_id = NEW.user_id) THEN RAISE EXCEPTION 'CAMPAGNE_INVALIDE'; END IF;
 END IF;
 IF TG_TABLE_NAME = 'prospects' AND NEW.source_post_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.source_post_id IS DISTINCT FROM OLD.source_post_id OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id) THEN
   SELECT user_id, status, campaign_id INTO p FROM public.content_posts WHERE id = NEW.source_post_id;
   IF NOT FOUND OR p.user_id <> NEW.user_id OR p.status <> 'publie' THEN RAISE EXCEPTION 'CONTENU_INVALIDE'; END IF;
   IF NEW.campaign_id IS NOT NULL AND p.campaign_id IS DISTINCT FROM NEW.campaign_id THEN RAISE EXCEPTION 'CONTENU_AUTRE_CAMPAGNE'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.campaign_link_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER content_posts_campaign_guard BEFORE INSERT OR UPDATE ON public.content_posts FOR EACH ROW EXECUTE FUNCTION public.campaign_link_guard();
CREATE TRIGGER prospects_campaign_guard BEFORE INSERT OR UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.campaign_link_guard();