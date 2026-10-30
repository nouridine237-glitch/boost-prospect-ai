DROP POLICY IF EXISTS scripts_read_authenticated ON public.scripts;
CREATE POLICY scripts_read_authenticated ON public.scripts FOR SELECT TO authenticated
  USING (company IS NULL OR public.effective_plan(auth.uid()) IN ('pro','expert','business') OR public.has_role(auth.uid(), 'admin'));