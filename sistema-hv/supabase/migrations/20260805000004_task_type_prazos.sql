-- ============================================================================
-- Motor de Distribuicao — PRAZOS INTERNOS por TIPO de tarefa (story H6)
-- ============================================================================
-- Contexto: hoje o motor (src/lib/distribuicao/sync-core.ts) le o prazo previsto
-- (dataConclusaoPrevista) e o prazo fatal (dataLimite) da TAREFA do ProJuris a
-- cada rodada. H6 (decisao 2 / I2) guarda um DEFAULT interno por tipo, usado como
-- FALLBACK quando a tarefa nao trouxer o prazo — deixando o menu "Tipos de
-- tarefa" como fonte da verdade interna e o motor menos dependente do ProJuris.
--
-- Regra de precedencia do motor (nao muda o comportamento com prazo real):
--   prazo REAL da tarefa (ProJuris) > default interno (estas colunas) > sentinela
--
-- Esta migration (ADITIVA, idempotente, nullable):
--   ADD COLUMN prazo_previsto_dias INT NULL  (dias uteis/corridos p/ prazo previsto)
--   ADD COLUMN prazo_fatal_dias    INT NULL  (dias p/ prazo fatal)
-- em system_task_type_mapping. Tipo sem default continua valido (NULL).
--
-- Rollback: supabase/rollbacks/20260805000004_task_type_prazos.rollback.sql
-- ============================================================================

ALTER TABLE system_task_type_mapping
  ADD COLUMN IF NOT EXISTS prazo_previsto_dias INT NULL,
  ADD COLUMN IF NOT EXISTS prazo_fatal_dias INT NULL;

COMMENT ON COLUMN system_task_type_mapping.prazo_previsto_dias IS
  'Default interno (H6): prazo previsto em dias por tipo. Fallback do motor quando a tarefa ProJuris nao trouxer dataConclusaoPrevista. NULL = sem default.';
COMMENT ON COLUMN system_task_type_mapping.prazo_fatal_dias IS
  'Default interno (H6): prazo fatal em dias por tipo. Fallback do motor quando a tarefa ProJuris nao trouxer dataLimite. NULL = sem default.';
