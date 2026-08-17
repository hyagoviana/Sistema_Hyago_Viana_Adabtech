-- ============================================================================
-- Desagenda o pg_cron LEGADO da distribuição (R6 — ativação segura)
-- ============================================================================
-- O job 'projuris-sync-daily' (migration 20260728000002) disparava a Edge
-- Function `projuris-sync`, que pode fazer WRITE-BACK REAL no ProJuris SEM
-- nenhuma trava (sem aprovação/confirmação) quando PROJURIS_ADAPTER=rest.
--
-- O motor atual roda pelo cron da Vercel (/api/cron/daily → runSync), que é
-- LEITURA-ONLY no ProJuris e respeita o gate `active`. Este job legado é um
-- caminho de escrita fantasma e precisa ser DESLIGADO.
--
-- Idempotente e defensivo: se pg_cron não estiver instalado neste ambiente
-- (ex.: banco local sem a extensão), não falha.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'cron' AND c.relname = 'job'
  ) THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'projuris-sync-daily') THEN
      PERFORM cron.unschedule('projuris-sync-daily');
      RAISE NOTICE 'Job pg_cron legado projuris-sync-daily DESAGENDADO.';
    ELSE
      RAISE NOTICE 'Job pg_cron legado projuris-sync-daily nao existe (nada a fazer).';
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron nao instalado neste ambiente (nada a fazer).';
  END IF;
END $$;
