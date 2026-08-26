-- ============================================================================
-- Sistema HV — Migration — TK1 — Status de tarefa igual ao ProJuris
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-26 (Thiago): "o ProJuris tem esses status de tarefa: pendente,
-- concluído com sucesso, concluído sem sucesso. Não sei se a gente tá fazendo
-- essa identificação, é um filtro importante."
--
-- Decisão do owner na mesma conversa: TIRAR o 'PENDENTE'. Uma tarefa distribuída
-- já é trabalho em andamento — 'pendente' e 'em andamento' eram a mesma coisa na
-- prática e só confundiam o filtro.
--
--   ANTES:  PENDENTE | EM_ANDAMENTO | CONCLUIDA
--   AGORA:  EM_ANDAMENTO | CONCLUIDA_SUCESSO | CONCLUIDA_SEM_SUCESSO | CANCELADA
--
-- De-para do backfill:
--   PENDENTE  -> EM_ANDAMENTO
--   CONCLUIDA -> CONCLUIDA_SUCESSO   (mantém completed_at)
--
-- ORDEM OBRIGATÓRIA: backfill ANTES do CHECK novo — senão a constraint falha
-- contra as linhas antigas. Como tudo roda numa transação (db-apply-pg.ts), ou
-- vai inteiro ou não vai nada.
--
-- ATENÇÃO — o que esta migration NÃO toca:
--   • system_parcelas (financeiro) também usa 'PENDENTE'.
--   • system_distribution_movements (fila do motor) idem.
--   Nenhuma das duas tem qualquer relação com o status da tarefa do caso.
--
-- Idempotente: descobre o nome real do CHECK, e o backfill só acha linha para
-- converter na primeira passada.
-- ============================================================================

DO $$
DECLARE
  v_conname text;
BEGIN
  -- 1) Solta o CHECK antigo (nome real, sem depender do default do Postgres).
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'system_case_tasks'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE system_case_tasks DROP CONSTRAINT %I', v_conname);
  END IF;

  -- 2) Backfill (antes da constraint nova).
  UPDATE system_case_tasks SET status = 'EM_ANDAMENTO'      WHERE status = 'PENDENTE';
  UPDATE system_case_tasks SET status = 'CONCLUIDA_SUCESSO' WHERE status = 'CONCLUIDA';

  -- 3) Domínio novo + default novo.
  ALTER TABLE system_case_tasks
    ADD CONSTRAINT system_case_tasks_status_check
    CHECK (status IN ('EM_ANDAMENTO', 'CONCLUIDA_SUCESSO', 'CONCLUIDA_SEM_SUCESSO', 'CANCELADA'));

  ALTER TABLE system_case_tasks ALTER COLUMN status SET DEFAULT 'EM_ANDAMENTO';
END $$;

COMMENT ON COLUMN system_case_tasks.status IS
  'TK1 (2026-08-26): espelha o vocabulario de situacao de tarefa do ProJuris. EM_ANDAMENTO (aberta) | CONCLUIDA_SUCESSO | CONCLUIDA_SEM_SUCESSO | CANCELADA. Nao existe mais PENDENTE. Trabalho ABERTO = EM_ANDAMENTO; CANCELADA nao e conclusao e nao preenche completed_at.';
