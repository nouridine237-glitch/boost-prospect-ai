DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_delete_own ON public.subscriptions;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon;

DROP POLICY IF EXISTS payment_requests_insert_own ON public.payment_requests;
CREATE POLICY payment_requests_insert_own ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND statut = 'en_attente'::public.payment_request_status
    AND method = 'manuel'
    AND saspay_session_id IS NULL
    AND checkout_url IS NULL
  );
REVOKE INSERT, UPDATE, DELETE ON public.payment_requests FROM anon;