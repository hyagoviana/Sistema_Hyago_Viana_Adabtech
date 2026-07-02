-- ============================================================================
-- Sistema HV — Migration — S2-04 — Gate "checklist conclui → avança etapa"
-- ----------------------------------------------------------------------------
-- Função idempotente (molde system_fn_entrar_financeiro): se todos os itens
-- `required` da etapa ATUAL do caso estão done=true, promove o caso à próxima
-- etapa op (menor ordem > atual). Guarda de concorrência DENTRO da função:
--   UPDATE ... WHERE macrostatus_op = <etapa esperada lida no início>.
-- Duas chamadas concorrentes → só 1 avança (a 2ª vira no-op, ROW_COUNT=0).
--
-- Só itens done=true contam (sugestões drive_suggest done=false NÃO fecham o gate).
-- Grava system_case_events(action='stage_auto_advanced') só quando a promoção ocorre.
-- (system_case_events.action NÃO tem CHECK restritivo — verificado; novos valores livres.)
--
-- Dual-write via macrostatus_op (a projeção system_fn_sync_stage_ids preenche
-- stage_op_id). NÃO escrever stage_op_id direto. NÃO toca outras colunas de
-- system_cases → NÃO recria system_cases_active. NÃO recria trg_..._bifurcacao.
-- ============================================================================

CREATE OR REPLACE FUNCTION system_fn_avancar_se_checklist_ok(
  p_case_id UUID,
  p_triggered_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_expected TEXT;      -- macrostatus_op lido no início (etapa esperada)
  v_service_type UUID;
  v_org UUID;
  v_current_ordem INTEGER;
  v_next_slug TEXT;
  v_rows INTEGER;
BEGIN
  -- Lê estado no início (após localizar o caso).
  SELECT macrostatus_op, service_type_id, organization_id
    INTO v_expected, v_service_type, v_org
    FROM system_cases
   WHERE id = p_case_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_service_type IS NULL OR v_expected IS NULL THEN
    RETURN;
  END IF;

  -- Pendências: existe algum item required NÃO concluído na etapa esperada?
  -- Só done=true conta; sugestões (done=false) mantêm pendência.
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
    RETURN;  -- ainda há required pendente → não avança
  END IF;

  -- ordem da etapa esperada (op) do tipo de serviço.
  SELECT ordem INTO v_current_ordem
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'op'
     AND slug = v_expected
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_current_ordem IS NULL THEN
    RETURN;  -- etapa atual não mapeada (defensivo)
  END IF;

  -- Próxima etapa op (menor ordem > atual). NULL = última etapa → não avança (AC-4).
  SELECT slug INTO v_next_slug
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'op'
     AND ordem > v_current_ordem
     AND deleted_at IS NULL
   ORDER BY ordem ASC
   LIMIT 1;

  IF v_next_slug IS NULL THEN
    RETURN;  -- última etapa op → nada a fazer
  END IF;

  -- Promove com guarda de idempotência/concorrência: só avança se a etapa atual
  -- ainda for a esperada (reavaliada após lock). Dual-write via macrostatus_op.
  UPDATE system_cases
     SET macrostatus_op = v_next_slug
   WHERE id = p_case_id
     AND macrostatus_op = v_expected;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Evento só quando a promoção efetivamente ocorreu.
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
