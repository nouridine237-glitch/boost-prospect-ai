ALTER TABLE public.ad_studio_url_analyses ADD COLUMN admin_notes text NOT NULL DEFAULT '' CHECK (char_length(admin_notes) <= 12000), ADD COLUMN edit_version integer NOT NULL DEFAULT 0;

ALTER POLICY ad_studio_url_analyses_select_owner ON public.ad_studio_url_analyses USING (owner_id = auth.uid() AND auth.uid() = 'da34c34b-7f66-4103-aa6a-d29f8fe3f300'::uuid AND public.has_role(auth.uid(), 'admin') AND auth.jwt()->>'aal' = 'aal2');
ALTER POLICY ad_studio_url_analyses_insert_owner ON public.ad_studio_url_analyses WITH CHECK (owner_id = auth.uid() AND auth.uid() = 'da34c34b-7f66-4103-aa6a-d29f8fe3f300'::uuid AND public.has_role(auth.uid(), 'admin') AND auth.jwt()->>'aal' = 'aal2' AND status = 'en_cours');
ALTER POLICY ad_studio_url_analyses_update_owner ON public.ad_studio_url_analyses USING (owner_id = auth.uid() AND auth.uid() = 'da34c34b-7f66-4103-aa6a-d29f8fe3f300'::uuid AND public.has_role(auth.uid(), 'admin') AND auth.jwt()->>'aal' = 'aal2') WITH CHECK (owner_id = auth.uid() AND auth.uid() = 'da34c34b-7f66-4103-aa6a-d29f8fe3f300'::uuid AND public.has_role(auth.uid(), 'admin') AND auth.jwt()->>'aal' = 'aal2');

CREATE TABLE public.ad_studio_analysis_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 analysis_id uuid NOT NULL REFERENCES public.ad_studio_url_analyses(id),
 owner_id uuid NOT NULL,
 version integer NOT NULL,
 notes text NOT NULL CHECK (char_length(notes) <= 12000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (analysis_id, version)
);
GRANT SELECT ON public.ad_studio_analysis_revisions TO authenticated;
GRANT ALL ON public.ad_studio_analysis_revisions TO service_role;
ALTER TABLE public.ad_studio_analysis_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_studio_analysis_revisions_owner ON public.ad_studio_analysis_revisions FOR SELECT TO authenticated USING (owner_id = auth.uid() AND auth.uid() = 'da34c34b-7f66-4103-aa6a-d29f8fe3f300'::uuid AND public.has_role(auth.uid(), 'admin') AND auth.jwt()->>'aal' = 'aal2');

CREATE FUNCTION public.ad_studio_notes_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND (NEW.id,NEW.owner_id,NEW.url,NEW.status,NEW.report,NEW.error,NEW.created_at,NEW.finished_at) IS DISTINCT FROM (OLD.id,OLD.owner_id,OLD.url,OLD.status,OLD.report,OLD.error,OLD.created_at,OLD.finished_at) THEN
  RAISE EXCEPTION 'Original analysis fields are immutable for user edits';
 END IF;
 NEW.edit_version := OLD.edit_version + CASE WHEN NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN 1 ELSE 0 END;
 RETURN NEW;
END;
$$;
CREATE TRIGGER ad_studio_notes_guard BEFORE UPDATE ON public.ad_studio_url_analyses FOR EACH ROW EXECUTE FUNCTION public.ad_studio_notes_guard();

CREATE FUNCTION public.ad_studio_notes_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
  INSERT INTO public.ad_studio_analysis_revisions(analysis_id,owner_id,version,notes) VALUES (OLD.id,OLD.owner_id,OLD.edit_version,OLD.admin_notes) ON CONFLICT (analysis_id,version) DO NOTHING;
  INSERT INTO public.ad_studio_analysis_revisions(analysis_id,owner_id,version,notes) VALUES (NEW.id,NEW.owner_id,NEW.edit_version,NEW.admin_notes);
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ad_studio_notes_revision() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ad_studio_notes_revision AFTER UPDATE ON public.ad_studio_url_analyses FOR EACH ROW EXECUTE FUNCTION public.ad_studio_notes_revision();