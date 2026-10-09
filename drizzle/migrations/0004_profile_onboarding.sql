ALTER TABLE public.profiles ADD COLUMN onboarded boolean NOT NULL DEFAULT false, ADD COLUMN onboarding_dismissed boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.onboarded IS 'Welcome dialog acknowledged by the user.';
COMMENT ON COLUMN public.profiles.onboarding_dismissed IS 'Getting-started guide hidden manually or after completion.';