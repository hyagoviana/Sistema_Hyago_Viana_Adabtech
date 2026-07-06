-- Rollback — S9-11 — Critérios ad-hoc por caso.
-- Reverte os 2 gates para a versão S2-04/S3-02 (só required do MODELO contam) e
-- remove as colunas/constraint ad-hoc. ATENÇÃO: se já existirem itens ad-hoc
-- (def_id IS NULL), o DROP das colunas os deixaria órfãos e o ALTER def_id SET
-- NOT NULL falharia — soft-delete/remova esses itens ANTES de rodar este rollback:
--   UPDATE system_case_checklist_items
--      SET deleted_at = NOW() WHERE def_id IS NULL AND deleted_at IS NULL;
--   DELETE FROM system_case_checklist_items WHERE def_id IS NULL;
--
-- NÃO toca system_cases. NÃO recria trg_system_cases_bifurcacao.

-- 1) Restaura o gate OP (versão S2-04, só INNER JOIN com defs required).
CREATE OR REPLACE FUNCTION system_fn_avancar_se_checklist_ok(
  p_case_id UUID,
  p_triggered_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_expected TEXT;
  v_service_type UUID;
  v_org UUID;
  v_current_ordem INTEGER;
  v_next_slug TEXT;
  v_rows INTEGER;
BEGIN
  SELECT macrostatus_op, service_type_id, organization_id
    INTO v_expected, v_service_type, v_org
    FROM system_cases
   WHERE id = p_case_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_service_type IS NULL OR v_expected IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM system_case_checklist_items ci
      JOIN system_stage_checklist_defs d ON d.id = ci.def_id
     WHERE ci.case_id = p_case_id
       AND ci.stage_slug = v_expected
       AND d.required = TRUE
       AND ci.done = FALSE
       AND ci.deleted_at IS NULL
       AND d.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  SELECT ordem INTO v_current_ordem
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type AND kind = 'op'
     AND slug = v_expected AND deleted_at IS NULL
   LIMIT 1;
  IF v_current_ordem IS NULL THEN RETURN; END IF;

  SELECT slug INTO v_next_slug
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type AND kind = 'op'
     AND ordem > v_current_ordem AND deleted_at IS NULL
   ORDER BY ordem ASC LIMIT 1;
  IF v_next_slug IS NULL THEN RETURN; END IF;

  UPDATE system_cases SET macrostatus_op = v_next_slug
   WHERE id = p_case_id AND macrostatus_op = v_expected;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    INSERT INTO system_case_events
      (case_id, organization_id, action, from_macrostatus_op, to_macrostatus_op, diff, triggered_by)
    VALUES
      (p_case_id, v_org, 'stage_auto_advanced', v_expected, v_next_slug,
       jsonb_build_object('from', v_expected, 'to', v_next_slug, 'via', 'checklist'),
       p_triggered_by);
  END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION system_fn_avancar_se_checklist_ok(UUID, UUID) TO service_role, authenticated;

-- 2) Restaura o gate FIN (versão S3-02, só INNER JOIN com defs required).
CREATE OR REPLACE FUNCTION system_fn_avancar_fin_se_ok(
  p_case_id UUID,
  p_triggered_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_expected TEXT;
  v_service_type UUID;
  v_org UUID;
  v_current_ordem INTEGER;
  v_next_slug TEXT;
  v_rows INTEGER;
BEGIN
  SELECT macrostatus_fin, service_type_id, organization_id
    INTO v_expected, v_service_type, v_org
    FROM system_cases
   WHERE id = p_case_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_service_type IS NULL
     OR v_expected IS NULL OR v_expected = 'NAO_APLICAVEL' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM system_case_checklist_items ci
      JOIN system_stage_checklist_defs d ON d.id = ci.def_id
     WHERE ci.case_id = p_case_id
       AND ci.stage_slug = v_expected
       AND d.required = TRUE
       AND ci.done = FALSE
       AND ci.deleted_at IS NULL
       AND d.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  SELECT ordem INTO v_current_ordem
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type AND kind = 'fin'
     AND slug = v_expected AND deleted_at IS NULL
   LIMIT 1;
  IF v_current_ordem IS NULL THEN RETURN; END IF;

  SELECT slug INTO v_next_slug
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type AND kind = 'fin'
     AND slug <> 'NAO_APLICAVEL' AND ordem > v_current_ordem AND deleted_at IS NULL
   ORDER BY ordem ASC LIMIT 1;
  IF v_next_slug IS NULL THEN RETURN; END IF;

  UPDATE system_cases
     SET macrostatus_fin = v_next_slug, status_fin_changed_at = NOW()
   WHERE id = p_case_id AND macrostatus_fin = v_expected;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    INSERT INTO system_case_events
      (case_id, organization_id, action, diff, triggered_by)
    VALUES
      (p_case_id, v_org, 'fin_stage_auto_advanced',
       jsonb_build_object('from', v_expected, 'to', v_next_slug, 'via', 'checklist'),
       p_triggered_by);
  END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION system_fn_avancar_fin_se_ok(UUID, UUID) TO service_role, authenticated;

-- 3) Remove constraint + colunas ad-hoc e volta def_id a NOT NULL.
ALTER TABLE system_case_checklist_items
  DROP CONSTRAINT IF EXISTS system_case_checklist_items_def_or_adhoc_chk;

ALTER TABLE system_case_checklist_items
  DROP COLUMN IF EXISTS label,
  DROP COLUMN IF EXISTS required,
  DROP COLUMN IF EXISTS ordem;

ALTER TABLE system_case_checklist_items
  ALTER COLUMN def_id SET NOT NULL;

-- 4) Recria a view _active.
DROP VIEW IF EXISTS system_case_checklist_items_active;
CREATE VIEW system_case_checklist_items_active AS
  SELECT * FROM system_case_checklist_items WHERE deleted_at IS NULL;
GRANT SELECT ON system_case_checklist_items_active TO anon, authenticated, service_role;
