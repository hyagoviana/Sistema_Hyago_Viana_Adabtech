-- ============================================================================
-- Sistema HV — Migration — Responsável do checklist (item 3, 2026-07-09)
-- ----------------------------------------------------------------------------
-- Cada item de checklist (financeiro) pode ter um RESPONSÁVEL (usuário do sistema).
-- Quando um usuário é responsável por um item, o caso passa a ser visível para ele
-- (ver src/lib/visibility.ts — getVisibleCaseIds inclui assigned_to).
-- Idempotente.
-- ============================================================================

ALTER TABLE system_case_checklist_items
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES system_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_items_assigned_to
  ON system_case_checklist_items(assigned_to)
  WHERE deleted_at IS NULL;

-- Recria a view _active (SELECT *) para incluir a nova coluna ao final.
CREATE OR REPLACE VIEW system_case_checklist_items_active AS
  SELECT * FROM system_case_checklist_items WHERE deleted_at IS NULL;
GRANT SELECT ON system_case_checklist_items_active TO anon, authenticated, service_role;
