CREATE OR REPLACE FUNCTION public.campaign_link_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; new_post uuid; old_post uuid;
BEGIN
 IF NEW.campaign_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id) THEN
   IF NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = NEW.campaign_id AND user_id = NEW.user_id) THEN RAISE EXCEPTION 'CAMPAGNE_INVALIDE'; END IF;
 END IF;
 IF TG_TABLE_NAME = 'prospects' THEN
   new_post := (to_jsonb(NEW) ->> 'source_post_id')::uuid;
   IF TG_OP = 'UPDATE' THEN old_post := (to_jsonb(OLD) ->> 'source_post_id')::uuid; END IF;
   IF new_post IS NOT NULL AND (TG_OP = 'INSERT' OR new_post IS DISTINCT FROM old_post OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id) THEN
     SELECT user_id, status, campaign_id INTO p FROM public.content_posts WHERE id = new_post;
     IF NOT FOUND OR p.user_id <> NEW.user_id OR p.status <> 'publie' THEN RAISE EXCEPTION 'CONTENU_INVALIDE'; END IF;
     IF NEW.campaign_id IS NOT NULL AND p.campaign_id IS DISTINCT FROM NEW.campaign_id THEN RAISE EXCEPTION 'CONTENU_AUTRE_CAMPAGNE'; END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.campaign_link_guard() FROM PUBLIC, anon, authenticated;