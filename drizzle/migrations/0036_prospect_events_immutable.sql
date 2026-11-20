-- Historique d'activité prospects : non supprimable par l'utilisateur et horodaté par le serveur.
-- La suppression d'un prospect continue d'effacer ses événements (cascade de la clé étrangère).
DROP POLICY IF EXISTS prospect_events_delete_own ON public.prospect_events;
REVOKE DELETE, UPDATE ON public.prospect_events FROM authenticated;

CREATE OR REPLACE FUNCTION public.prospect_events_server_time()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.created_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prospect_events_server_time ON public.prospect_events;
CREATE TRIGGER prospect_events_server_time BEFORE INSERT ON public.prospect_events
  FOR EACH ROW EXECUTE FUNCTION public.prospect_events_server_time();