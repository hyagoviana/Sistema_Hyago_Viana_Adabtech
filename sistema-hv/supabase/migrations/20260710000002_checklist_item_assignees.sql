-- ============================================================================
-- Sistema HV — Múltiplos responsáveis por item de checklist (etapa) — 2026-07-10
-- ----------------------------------------------------------------------------
-- Pedido do owner: permitir MAIS DE UM responsável por etapa do checklist.
-- Abordagem ADITIVA (baixo risco): mantém `system_case_checklist_items.assigned_to`
-- como responsável PRIMÁRIO (compat com visibilidade/leituras single) e adiciona
-- uma tabela N:N com o conjunto completo de responsáveis. Visibilidade e a aba
-- Tarefas passam a considerar (assigned_to UNIÃO N:N).
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_case_checklist_item_assignees (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id    UUID NOT NULL REFERENCES system_case_checklist_items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_item_assignees_user
  ON system_case_checklist_item_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_assignees_item
  ON system_case_checklist_item_assignees(item_id);

-- Backfill: cada item com responsável único vira uma linha N:N.
INSERT INTO system_case_checklist_item_assignees (item_id, user_id)
SELECT id, assigned_to
  FROM system_case_checklist_items
 WHERE assigned_to IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (item_id, user_id) DO NOTHING;

GRANT ALL ON TABLE system_case_checklist_item_assignees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_case_checklist_item_assignees
  TO anon, authenticated;
