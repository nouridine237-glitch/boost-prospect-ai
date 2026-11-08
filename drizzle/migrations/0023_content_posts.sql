CREATE TABLE public.content_posts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','facebook','autre')),
 objective text NOT NULL DEFAULT 'notoriete' CHECK (objective IN ('notoriete','produit','temoignage','invitation','education')),
 body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
 planned_on date NOT NULL,
 slot text NOT NULL DEFAULT 'matin' CHECK (slot IN ('matin','midi','soir')),
 status text NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon','prevu','publie')),
 published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_posts_user_day ON public.content_posts (user_id, planned_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_posts TO authenticated;
GRANT ALL ON public.content_posts TO service_role;
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_posts_select_own ON public.content_posts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY content_posts_insert_own ON public.content_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY content_posts_update_own ON public.content_posts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY content_posts_delete_own ON public.content_posts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.content_posts_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lim integer; n integer; wk date;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN RAISE EXCEPTION 'Owner cannot change'; END IF;
 IF NEW.status = 'prevu' AND char_length(btrim(NEW.body)) = 0 THEN RAISE EXCEPTION 'TEXTE_REQUIS'; END IF;
 IF NEW.status = 'publie' THEN
   IF TG_OP = 'INSERT' OR OLD.status <> 'publie' THEN NEW.published_at := now(); ELSE NEW.published_at := OLD.published_at; END IF;
 ELSE NEW.published_at := NULL; END IF;
 NEW.updated_at := now();
 IF TG_OP = 'INSERT' OR NEW.planned_on IS DISTINCT FROM OLD.planned_on THEN
   lim := CASE WHEN public.effective_plan(NEW.user_id) = 'gratuit' THEN 7 ELSE 60 END;
   wk := date_trunc('week', NEW.planned_on)::date;
   PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || ':content', 0));
   SELECT count(*) INTO n FROM public.content_posts WHERE user_id = NEW.user_id AND planned_on >= wk AND planned_on < wk + 7 AND id <> NEW.id;
   IF n >= lim THEN RAISE EXCEPTION 'LIMITE_STATUTS:%', lim; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.content_posts_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER content_posts_guard BEFORE INSERT OR UPDATE ON public.content_posts FOR EACH ROW EXECUTE FUNCTION public.content_posts_guard();