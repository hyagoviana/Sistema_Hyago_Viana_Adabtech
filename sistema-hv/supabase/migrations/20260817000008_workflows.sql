-- ============================================================================
-- #2 (melhorias 2026-08-17) — WORKFLOWS / automações (fundação)
-- ----------------------------------------------------------------------------
-- Regras "gatilho → ações" por tema (ou globais). O motor (workflow-engine.ts)
-- avalia as regras ativas quando um evento ocorre no caso e executa as ações
-- reusando os serviços existentes (tarefas / notas / mover etapa). A tabela de
-- RUNS garante idempotência (não disparar a mesma regra 2x para o mesmo evento).
--
-- FORMATO:
--   trigger_type   : 'status_changed' | 'checklist_completed' | 'task_created' | 'task_completed'
--   trigger_config : jsonb — ex.: { "to_stage_slug": "EM_ANDAMENTO" } (status_changed)
--   actions        : jsonb[] — cada ação { "type": "...", ...config }
--     • write_comment : { "type":"write_comment", "body":"..." }
--     • create_task   : { "type":"create_task", "title":"...", "due_days":N, "assignee_id":uuid|null }
--     • move_stage    : { "type":"move_stage", "to_stage_slug":"..." }
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_workflow_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  name             TEXT NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  -- NULL = vale para todos os temas; senão restringe ao tema.
  tema_id          UUID REFERENCES system_temas(id) ON DELETE CASCADE,
  trigger_type     TEXT NOT NULL
    CHECK (trigger_type IN ('status_changed', 'checklist_completed', 'task_created', 'task_completed')),
  trigger_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by        UUID REFERENCES system_users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wf_rules_org ON system_workflow_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_wf_rules_trigger ON system_workflow_rules(trigger_type) WHERE active;

CREATE TABLE IF NOT EXISTS system_workflow_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  rule_id          UUID NOT NULL REFERENCES system_workflow_rules(id) ON DELETE CASCADE,
  case_id          UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,
  -- Chave de idempotência do evento (ex.: 'status:EM_ANDAMENTO'). Impede repetir
  -- as ações se o mesmo gatilho reincidir para o mesmo caso/regra.
  event_key        TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'done',
  detail           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rule_id, case_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_wf_runs_case ON system_workflow_runs(case_id);

ALTER TABLE system_workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY wf_rules_select ON system_workflow_rules
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY wf_rules_service ON system_workflow_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY wf_runs_select ON system_workflow_runs
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY wf_runs_service ON system_workflow_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON system_workflow_rules, system_workflow_runs TO authenticated;
GRANT ALL ON system_workflow_rules, system_workflow_runs TO service_role;
