CREATE TYPE public.payment_request_status AS ENUM ('en_attente', 'valide', 'refuse');
CREATE TYPE public.paid_plan AS ENUM ('pro', 'expert', 'business');

CREATE TABLE public.payment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_demande public.paid_plan NOT NULL,
  montant numeric NOT NULL,
  devise text NOT NULL DEFAULT 'FCFA',
  capture_paiement text,
  reference_transaction text NOT NULL DEFAULT '',
  statut public.payment_request_status NOT NULL DEFAULT 'en_attente',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_requests_select_own ON public.payment_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY payment_requests_insert_own ON public.payment_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY payment_requests_select_admin ON public.payment_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY payment_requests_update_admin ON public.payment_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY payment_requests_delete_admin ON public.payment_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payment_requests_set_updated_at BEFORE UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX payment_requests_statut_created_idx ON public.payment_requests (statut, created_at DESC);