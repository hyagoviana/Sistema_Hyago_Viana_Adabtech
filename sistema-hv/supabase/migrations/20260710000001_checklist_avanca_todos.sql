-- ============================================================================
-- Sistema HV — Avanço automático por checklist: exige TODOS os itens (2026-07-10)
-- ----------------------------------------------------------------------------
-- Pedido do owner: o caso só deve avançar de etapa AUTOMATICAMENTE quando TODOS
-- os itens do checklist da etapa estiverem marcados (done=true), independente de
-- o item ser "obrigatório" ou não. O campo `required` passa a ser SÓ um rótulo
-- informativo (badge "Obrigatório" na UI) e NÃO bloqueia mais o avanço.
-- O movimento MANUAL (arrastar no Kanban / mudar status) continua livre, sem gate.
-- Idempotente (CREATE OR REPLACE).
-- ============================================================================

-- GATE OPERACIONAL
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

  -- Pendências: QUALQUER item da etapa (obrigatório OU não) ainda não concluído?
  -- Só avança automaticamente quando TODOS estão done. `required` não bloqueia.
  IF EXISTS (
    SELECT 1
      FROM system_case_checklist_items ci
     WHERE ci.case_id = p_case_id
       AND ci.stage_slug = v_expected
       AND ci.done = FALSE
       AND ci.deleted_at IS NULL
  ) THEN
    RETURN;  -- ainda há item pendente → não avança
  END IF;

  SELECT ordem INTO v_current_ordem
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'op'
     AND slug = v_expected
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_current_ordem IS NULL THEN
    RETURN;
  END IF;

  SELECT slug INTO v_next_slug
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'op'
     AND ordem > v_current_ordem
     AND deleted_at IS NULL
   ORDER BY ordem ASC
   LIMIT 1;

  IF v_next_slug IS NULL THEN
    RETURN;
  END IF;

  UPDATE system_cases
     SET macrostatus_op = v_next_slug
   WHERE id = p_case_id
     AND macrostatus_op = v_expected;

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

-- GATE FINANCEIRO
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

  -- Pendências: QUALQUER item da etapa fin ainda não concluído? Só avança quando
  -- TODOS estão done (obrigatório ou não). `required` é apenas informativo.
  IF EXISTS (
    SELECT 1
      FROM system_case_checklist_items ci
     WHERE ci.case_id = p_case_id
       AND ci.stage_slug = v_expected
       AND ci.done = FALSE
       AND ci.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  SELECT ordem INTO v_current_ordem
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'fin'
     AND slug = v_expected
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_current_ordem IS NULL THEN
    RETURN;
  END IF;

  SELECT slug INTO v_next_slug
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'fin'
     AND slug <> 'NAO_APLICAVEL'
     AND ordem > v_current_ordem
     AND deleted_at IS NULL
   ORDER BY ordem ASC
   LIMIT 1;

  IF v_next_slug IS NULL THEN
    RETURN;
  END IF;

  UPDATE system_cases
     SET macrostatus_fin = v_next_slug,
         status_fin_changed_at = NOW()
   WHERE id = p_case_id
     AND macrostatus_fin = v_expected;

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
