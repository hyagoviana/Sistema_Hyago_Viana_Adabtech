-- ============================================================================
-- Sistema HV — Migration — W1 — Identificador e grupo do Workflow (ADITIVA)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-26 (Thiago): "tem um monte de tarefa aparecendo para todo
-- mundo aqui, então o negócio errado. Qual é o workflow que tá fazendo isso? A
-- gente vem aqui, sabe dizer." E: "quando tiver uma ação automática de workflow,
-- ele indicar qual foi o identificador, qual foi que gerou".
--
-- Três colunas, todas aditivas:
--   1. system_workflow_rules.code       — identificador curto e ESTÁVEL (WF-0007)
--   2. system_workflow_rules.group_name — agrupamento visual (texto livre, por
--                                         decisão do owner: "pode ser texto livre")
--   3. system_case_tasks.created_by_workflow_id — o rastro em si. Texto na
--      descrição resolve o "ler e entender"; a coluna resolve o "listar TODAS as
--      tarefas que aquele workflow criou", que é o que se quer quando algo deu
--      errado.
--
-- O código NUNCA é reciclado (índice único). Uma tarefa antiga precisa continuar
-- apontando para algo compreensível mesmo que a regra tenha sido excluída — por
-- isso o FK é ON DELETE SET NULL, não CASCADE: apagar o workflow não apaga a
-- tarefa que ele criou.
-- ============================================================================

ALTER TABLE system_workflow_rules
  ADD COLUMN IF NOT EXISTS code       TEXT,
  ADD COLUMN IF NOT EXISTS group_name TEXT;

COMMENT ON COLUMN system_workflow_rules.code IS
  'Identificador curto e imutavel (WF-0001). Aparece na acao gerada e na linha do tempo. Unico por organizacao; nunca reciclado.';
COMMENT ON COLUMN system_workflow_rules.group_name IS
  'Agrupamento VISUAL da lista de workflows (texto livre). Nao restringe permissao nem execucao.';

-- Backfill: numera as regras existentes na ordem em que foram criadas.
WITH ordenadas AS (
  SELECT id,
         organization_id,
         ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at, id) AS n
    FROM system_workflow_rules
   WHERE code IS NULL
)
UPDATE system_workflow_rules r
   SET code = 'WF-' || LPAD(o.n::text, 4, '0')
  FROM ordenadas o
 WHERE r.id = o.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_rule_code
  ON system_workflow_rules (organization_id, code)
  WHERE code IS NOT NULL;

-- Rastro na tarefa gerada automaticamente.
ALTER TABLE system_case_tasks
  ADD COLUMN IF NOT EXISTS created_by_workflow_id UUID
    REFERENCES system_workflow_rules(id) ON DELETE SET NULL;

COMMENT ON COLUMN system_case_tasks.created_by_workflow_id IS
  'W1: qual regra de workflow criou esta tarefa (NULL = criada por gente). ON DELETE SET NULL — apagar a regra nao apaga a tarefa.';

CREATE INDEX IF NOT EXISTS idx_case_tasks_by_workflow
  ON system_case_tasks (created_by_workflow_id)
  WHERE created_by_workflow_id IS NOT NULL;
