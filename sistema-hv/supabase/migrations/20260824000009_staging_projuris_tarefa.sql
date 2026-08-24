-- ============================================================================
-- Guarda o resultado da criação da tarefa no ProJuris.
--
-- Fecha o ciclo do motor: hoje a tela 2 distribui DENTRO do SHV (grava em
-- system_distribution_results) e para por aí — quem executa só vê a tarefa se
-- entrar no SHV. O Thiago pediu o contrário: a controladoria decide aqui, a
-- pessoa continua trabalhando no ProJuris.
--
-- As três colunas seguem o mesmo desenho já usado em system_distribution_movements
-- (migration 20260824000004): guardar o código de lá, quando sincronizou e qual
-- foi o erro — porque a criação é BEST-EFFORT. Se o ProJuris estiver fora do ar,
-- a distribuição feita no SHV continua valendo; só o espelho lá fica pendente.
-- ============================================================================

ALTER TABLE system_distribution_staging
  ADD COLUMN IF NOT EXISTS projuris_codigo_tarefa TEXT,
  ADD COLUMN IF NOT EXISTS projuris_sync_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS projuris_sync_error    TEXT;

COMMENT ON COLUMN system_distribution_staging.projuris_codigo_tarefa IS
  'codigoTarefaEvento devolvido pelo POST /tarefa. Preenchido => a tarefa existe no ProJuris; NULL com status DISTRIBUIDA => só o SHV sabe dela.';

-- Fila de reenvio: distribuídas que ainda não espelharam.
CREATE INDEX IF NOT EXISTS idx_dist_staging_sem_espelho
  ON system_distribution_staging(organization_id, distribuido_em DESC)
  WHERE status = 'DISTRIBUIDA' AND projuris_codigo_tarefa IS NULL;
