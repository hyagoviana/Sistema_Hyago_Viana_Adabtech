-- ============================================================================
-- Doc "31.08 — tarefas" (Thiago) — WORKFLOW SUCESSIVO (encadeamento)
-- ----------------------------------------------------------------------------
-- Pedido: "Quando a ação gerada for uma tarefa [ação 1], adicionar opção de
-- poder ter um workflow sucessivo: quando a tarefa criada (pela ação 1) for
-- concluída [gatilho 2], gerar outra ação [ação 2]."
--
-- A regra já sabe QUEM criou a tarefa (system_case_tasks.created_by_workflow_id).
-- O que faltava era saber QUAL AÇÃO da regra criou — uma regra pode ter várias
-- ações "criar tarefa", cada uma com o seu próprio encadeamento. Esta coluna é
-- o índice (0-based) da ação dentro de system_workflow_rules.actions.
--
-- Aditiva: NULL = tarefa criada por gente, ou por uma regra anterior a isto.
-- ============================================================================

ALTER TABLE system_case_tasks
  ADD COLUMN IF NOT EXISTS created_by_workflow_action INT;

COMMENT ON COLUMN system_case_tasks.created_by_workflow_action IS
  'Indice (0-based) da acao dentro de system_workflow_rules.actions que criou esta tarefa. Usado pelo encadeamento: ao concluir a tarefa, o motor roda as acoes de actions[idx].on_complete. NULL = criada por gente (ou por regra anterior ao encadeamento).';

-- Busca do encadeamento: "esta tarefa foi criada por qual acao de qual regra?"
CREATE INDEX IF NOT EXISTS idx_system_case_tasks_wf_chain
  ON system_case_tasks(created_by_workflow_id, created_by_workflow_action)
  WHERE created_by_workflow_id IS NOT NULL AND deleted_at IS NULL;
