-- ============================================================================
-- Sistema HV — Migration — Responsável PADRÃO por etapa de checklist (2026-07-09)
-- ----------------------------------------------------------------------------
-- O DEF de checklist (system_stage_checklist_defs, por etapa) ganha um responsável
-- OPCIONAL (assigned_to). Ao instanciar o checklist num caso, o item HERDA esse
-- responsável — assim uma etapa pode ter um responsável único para todos os casos
-- (ou nenhum). O responsável por item continua editável por caso (assigned_to do
-- item), e a herança só preenche o valor inicial.
-- Idempotente.
-- ============================================================================

ALTER TABLE system_stage_checklist_defs
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES system_users(id) ON DELETE SET NULL;

-- Recria a view _active (SELECT *) para incluir a nova coluna.
CREATE OR REPLACE VIEW system_stage_checklist_defs_active AS
  SELECT * FROM system_stage_checklist_defs WHERE deleted_at IS NULL;
GRANT SELECT ON system_stage_checklist_defs_active TO anon, authenticated, service_role;

-- A instanciação passa a HERDAR o responsável do DEF para o item do caso.
CREATE OR REPLACE FUNCTION system_fn_instanciar_checklist(
  p_case_id UUID,
  p_stage_slug TEXT
)
RETURNS VOID AS $$
DECLARE
  v_service_type UUID;
  v_org UUID;
BEGIN
  SELECT service_type_id, organization_id
    INTO v_service_type, v_org
    FROM system_cases
   WHERE id = p_case_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_service_type IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO system_case_checklist_items
    (organization_id, case_id, def_id, stage_slug, source, done, assigned_to)
  SELECT v_org, p_case_id, d.id, d.stage_slug, 'manual', FALSE, d.assigned_to
    FROM system_stage_checklist_defs d
   WHERE d.service_type_id = v_service_type
     AND d.stage_slug = p_stage_slug
     AND d.active = TRUE
     AND d.deleted_at IS NULL
  ON CONFLICT (case_id, def_id) WHERE deleted_at IS NULL DO NOTHING;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_instanciar_checklist(UUID, TEXT) TO service_role, authenticated;
