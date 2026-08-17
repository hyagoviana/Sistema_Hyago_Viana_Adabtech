-- ============================================================================
-- R3 — Exceções de DUPLICADOS: contexto do processo direto na exceção
-- ============================================================================
-- Quando o motor detecta uma tarefa DUPLICADA, ela não é distribuída (não gera
-- linha em system_distribution_results), então o JOIN atual da tela de Exceções
-- (que puxa process_id/final_date do result) fica vazio. Guardamos o contexto
-- direto na exceção para a tela mostrar o processo do duplicado.
-- Aditivo/idempotente.
-- ============================================================================

ALTER TABLE system_distribution_exceptions
  ADD COLUMN IF NOT EXISTS process_id TEXT,
  ADD COLUMN IF NOT EXISTS detail TEXT;

COMMENT ON COLUMN system_distribution_exceptions.process_id IS
  'Código do processo ProJuris (para exceções sem distribution_result, ex.: duplicados).';
COMMENT ON COLUMN system_distribution_exceptions.detail IS
  'Descrição legível da exceção (ex.: tipo/CNJ do duplicado).';
