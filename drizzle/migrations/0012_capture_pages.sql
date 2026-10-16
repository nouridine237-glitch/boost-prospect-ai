CREATE TABLE public.capture_pages (
  user_id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  tagline text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  photo_url text,
  visits integer NOT NULL DEFAULT 0,
  seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capture_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  CONSTRAINT capture_name_len CHECK (char_length(display_name) <= 80),
  CONSTRAINT capture_tagline_len CHECK (char_length(tagline) <= 160),
  CONSTRAINT capture_wa_len CHECK (char_length(whatsapp) <= 20)
);
GRANT SELECT, INSERT, UPDATE ON public.capture_pages TO authenticated;
GRANT ALL ON public.capture_pages TO service_role;
ALTER TABLE public.capture_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY capture_pages_select_own ON public.capture_pages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY capture_pages_insert_own ON public.capture_pages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND visits = 0);
CREATE POLICY capture_pages_update_own ON public.capture_pages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER capture_pages_set_updated_at BEFORE UPDATE ON public.capture_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- prevent owners from editing their visit counter
CREATE OR REPLACE FUNCTION public.capture_keep_visits() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user = 'authenticated' THEN NEW.visits := OLD.visits; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER capture_pages_keep_visits BEFORE UPDATE ON public.capture_pages FOR EACH ROW EXECUTE FUNCTION public.capture_keep_visits();

CREATE TABLE public.capture_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX capture_rate_ip_idx ON public.capture_rate_limits (ip_hash, created_at);
GRANT ALL ON public.capture_rate_limits TO service_role;
ALTER TABLE public.capture_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.capture_page_view(_slug text)
RETURNS TABLE(display_name text, tagline text, whatsapp text, photo_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY UPDATE public.capture_pages c SET visits = c.visits + 1
    WHERE c.slug = lower(_slug)
    RETURNING c.display_name, c.tagline, c.whatsapp, c.photo_url;
END $$;
REVOKE ALL ON FUNCTION public.capture_page_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_page_view(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_capture_lead(_slug text, _name text, _phone text, _interest text, _ip_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE owner uuid; n integer;
BEGIN
  SELECT user_id INTO owner FROM public.capture_pages WHERE slug = lower(_slug);
  IF owner IS NULL THEN RETURN 'not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('capture:' || _ip_hash));
  SELECT count(*) INTO n FROM public.capture_rate_limits WHERE ip_hash = _ip_hash AND created_at > now() - interval '1 hour';
  IF n >= 5 THEN RETURN 'rate_limited'; END IF;
  INSERT INTO public.capture_rate_limits(ip_hash) VALUES (_ip_hash);
  DELETE FROM public.capture_rate_limits WHERE created_at < now() - interval '1 day';
  BEGIN
    INSERT INTO public.prospects(user_id, name, phone, status, source, product_interest, notes)
    VALUES (owner, left(_name, 80), left(_phone, 30), 'nouveau', 'Page de capture', left(_interest, 300), '');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN RETURN 'owner_full';
  END;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.submit_capture_lead(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_capture_lead(text, text, text, text, text) TO service_role;

CREATE POLICY capture_photos_read ON storage.objects FOR SELECT USING (bucket_id = 'capture-photos');
CREATE POLICY capture_photos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'capture-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY capture_photos_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'capture-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY capture_photos_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'capture-photos' AND (storage.foldername(name))[1] = auth.uid()::text);