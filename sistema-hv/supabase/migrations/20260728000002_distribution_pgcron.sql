-- ============================================================================
-- pg_cron — Agendamento diario da Edge Function projuris-sync
-- Story 3.1 — Epic 3
-- ============================================================================
-- Dispara a Edge Function diariamente as 06:00 BRT (09:00 UTC).
-- Requer extensoes pg_cron e pg_net (incluidas no Supabase Pro).
-- ============================================================================

-- Habilitar extensoes necessarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agendar job diario
-- 09:00 UTC = 06:00 BRT (America/Sao_Paulo UTC-3)
SELECT cron.schedule(
  'projuris-sync-daily',
  '0 9 * * 1-5',  -- seg-sex as 09:00 UTC (06:00 BRT), somente dias uteis
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.edge_function_url', true) || '/functions/v1/projuris-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('source', 'pg_cron', 'distribution_date', current_date::text)
  );
  $$
);

-- Nota: as settings app.settings.edge_function_url e app.settings.service_role_key
-- devem ser configuradas via ALTER DATABASE SET ou Supabase Dashboard > Settings.
-- Exemplo:
--   ALTER DATABASE postgres SET app.settings.edge_function_url = 'https://sptfmfeoikukrhbekitl.supabase.co';
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJ...';
