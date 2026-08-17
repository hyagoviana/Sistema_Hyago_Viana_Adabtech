-- ============================================================================
-- R5 — Snapshot de TAREFAS do ProJuris para a aba Kanban
-- ============================================================================
-- O motor já lê as tarefas de cada processo (consulta-multi-modulo) durante o
-- sync. Aqui guardamos um SNAPSHOT de TODAS as tarefas (abertas E concluídas)
-- com a situação (coluna do Kanban) e os responsáveis MAPEADOS para o nosso
-- system_users — assim a aba Kanban lê do NOSSO banco (rápido, RBAC-able,
-- funciona offline) sem bater no ProJuris a cada abertura.
--
-- RBAC na leitura (server fn): admin vê tudo; não-admin só onde o seu id está em
-- responsavel_ids. Refresh completo por org a cada sync (delete + insert).
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_distribution_kanban_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  task_id          TEXT NOT NULL,
  process_id       TEXT,
  process_nome     TEXT,
  numero_processo  TEXT,
  tipo_nome        TEXT,
  situacao         TEXT,
  situacao_col     TEXT NOT NULL DEFAULT 'Pendente',
  concluida        BOOLEAN NOT NULL DEFAULT FALSE,
  responsavel_ids  UUID[] NOT NULL DEFAULT '{}',
  responsavel_nomes TEXT[] NOT NULL DEFAULT '{}',
  prazo_previsto   DATE,
  prazo_fatal      DATE,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_org ON system_distribution_kanban_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_kanban_tasks_resp ON system_distribution_kanban_tasks USING GIN (responsavel_ids);

ALTER TABLE system_distribution_kanban_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY kanban_tasks_select ON system_distribution_kanban_tasks
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY kanban_tasks_service ON system_distribution_kanban_tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON system_distribution_kanban_tasks TO authenticated;
GRANT ALL ON system_distribution_kanban_tasks TO service_role;
