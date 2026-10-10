ALTER TYPE public.payment_request_status ADD VALUE IF NOT EXISTS 'echoue';
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'manuel' CHECK (method IN ('manuel','saspay')),
  ADD COLUMN IF NOT EXISTS saspay_session_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS checkout_url text;