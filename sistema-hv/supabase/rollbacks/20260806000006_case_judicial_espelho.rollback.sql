-- Rollback simétrico da migration 20260806000006_case_judicial_espelho.sql (Story G1).
DROP TABLE IF EXISTS system_case_judicial_tasks;
DROP TABLE IF EXISTS system_case_judicial_processos;

DROP INDEX IF EXISTS idx_system_cases_projuris_cod_proc;
ALTER TABLE system_cases DROP COLUMN IF EXISTS projuris_numero_processo;
ALTER TABLE system_cases DROP COLUMN IF EXISTS projuris_codigo_processo;
