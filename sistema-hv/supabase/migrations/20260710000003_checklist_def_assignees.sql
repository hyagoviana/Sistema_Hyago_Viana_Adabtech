-- ============================================================================
-- Sistema HV — Múltiplos responsáveis na DEF de checklist (etapa mestre) 2026-07-10
-- ----------------------------------------------------------------------------
-- Item 7: no editor de etapas do funil (def) só dava pra escolher 1 responsável.
-- Abordagem ADITIVA (igual ao 2b dos itens): mantém `assigned_to` como primário +
-- N:N com o conjunto completo. A instanciação passa a PROPAGAR todos os
-- responsáveis da def para a N:N do item do caso.
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_stage_checklist_def_assignees (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  def_id     UUID NOT NULL REFERENCES system_stage_checklist_defs(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (def_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_def_assignees_def
  ON system_stage_checklist_def_assignees(def_id);

-- Backfill do responsável único já existente.
INSERT INTO system_stage_checklist_def_assignees (def_id, user_id)
SELECT id, assigned_to
  FROM system_stage_checklist_defs
 WHERE assigned_to IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (def_id, user_id) DO NOTHING;

GRANT ALL ON TABLE system_stage_checklist_def_assignees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_stage_checklist_def_assignees
  TO anon, authenticated;

-- Instanciação passa a propagar TODOS os responsáveis da def para o item (N:N).
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
   WHERE d.service_type_id IN (
           v_service_type,
           '00000000-0000-0000-0000-0000000000f0'::uuid
         )
     AND d.stage_slug = p_stage_slug
     AND d.active = TRUE
     AND d.deleted_at IS NULL
  ON CONFLICT (case_id, def_id) WHERE deleted_at IS NULL DO NOTHING;

  -- Propaga o conjunto COMPLETO de responsáveis da def → N:N do item (idempotente).
  INSERT INTO system_case_checklist_item_assignees (item_id, user_id)
  SELECT ci.id, da.user_id
    FROM system_case_checklist_items ci
    JOIN system_stage_checklist_def_assignees da ON da.def_id = ci.def_id
   WHERE ci.case_id = p_case_id
     AND ci.stage_slug = p_stage_slug
     AND ci.def_id IS NOT NULL
     AND ci.deleted_at IS NULL
  ON CONFLICT (item_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_instanciar_checklist(UUID, TEXT) TO service_role, authenticated;
