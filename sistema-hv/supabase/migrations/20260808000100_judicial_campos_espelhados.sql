-- ============================================================================
-- Sistema HV — Migration — Campos JUDICIAIS espelhados do ProJuris (docx Thiago)
-- ----------------------------------------------------------------------------
-- 2026-08-08. ADITIVA/idempotente. Estende o espelho judicial (G1) com os campos
-- que o Thiago pediu na tabela (docs/reunioes/dados-thiago-2026-08-08-judicial-prazos.md):
--   ESPELHADOS do ProJuris (preenchidos pelo sync de LEITURA, `.valor` do {chave,valor}):
--     orgao_julgador, classe_cnj, situacao, instancia, vara, tipo_justica,
--     data_distribuicao, valor_causa_centavos.
--   MANUAIS do SHV (NÃO vêm do ProJuris — "apenas manter no SHV"):
--     system_cases.honorarios_estimados_centavos / honorarios_provisionados_centavos.
--
-- (orgao/tribunal/fase/assunto já existiam em system_case_judicial_processos.)
-- Colunas nascem NULL → regressão zero. As espelhadas ficam na tabela do espelho
-- (reescrita pelo sync); as manuais ficam em system_cases (o sync NÃO as toca).
--
-- Aplicar via:
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260808000100_judicial_campos_espelhados.sql
-- ============================================================================

ALTER TABLE system_case_judicial_processos
  ADD COLUMN IF NOT EXISTS orgao_julgador       TEXT,
  ADD COLUMN IF NOT EXISTS classe_cnj           TEXT,
  ADD COLUMN IF NOT EXISTS situacao             TEXT,
  ADD COLUMN IF NOT EXISTS instancia            TEXT,
  ADD COLUMN IF NOT EXISTS vara                 TEXT,
  ADD COLUMN IF NOT EXISTS tipo_justica         TEXT,
  ADD COLUMN IF NOT EXISTS data_distribuicao    DATE,
  ADD COLUMN IF NOT EXISTS valor_causa_centavos BIGINT;

ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS honorarios_estimados_centavos     BIGINT,
  ADD COLUMN IF NOT EXISTS honorarios_provisionados_centavos BIGINT;

COMMENT ON COLUMN system_cases.honorarios_estimados_centavos IS
  'Judicial: honorários contratuais ESTIMADOS (manual SHV, não vem do ProJuris).';
COMMENT ON COLUMN system_cases.honorarios_provisionados_centavos IS
  'Judicial: honorários contratuais PROVISIONADOS (manual SHV, não vem do ProJuris).';
