-- ============================================================================
-- Sistema HV — Migration — S3-02 — Gate financeiro "checklist conclui → avança"
-- ----------------------------------------------------------------------------
-- Versão FINANCEIRA do gate op (system_fn_avancar_se_checklist_ok, S2-04),
-- moldada também em system_fn_entrar_financeiro (idempotência sob concorrência).
--
-- Se todos os itens `required` da etapa FIN atual (por stage_slug fin +
-- service_type_id) estão done=true, promove o caso à próxima etapa kind='fin'
-- (menor ordem > atual, slug <> 'NAO_APLICAVEL', deleted_at IS NULL) via
-- dual-write macrostatus_fin (a projeção system_fn_sync_stage_ids preenche
-- stage_fin_id). Guarda de concorrência DENTRO da função:
--   UPDATE ... WHERE macrostatus_fin = <etapa esperada lida no início>.
-- Duas chamadas concorrentes → só 1 avança (a 2ª vira no-op, ROW_COUNT=0).
--
-- Só itens done=true contam (sugestões drive_suggest done=false NÃO fecham o gate).
-- Grava system_case_events(action='fin_stage_auto_advanced') só quando promove.
-- (system_case_events.action NÃO tem CHECK restritivo — verificado; novos valores
--  livres. A tabela NÃO tem colunas from/to_macrostatus_fin — usamos diff.)
--
-- Q-8: a próxima etapa fin resolvida NUNCA é 'NAO_APLICAVEL' (só avança "para
-- frente" por ordem entre etapas reais). NULL/NAO_APLICAVEL no início → RETURN
-- (entrada no fin é via system_fn_entrar_financeiro, não por este gate).
--
-- NÃO toca colunas de system_cases → NÃO recria system_cases_active.
-- NÃO recria trg_system_cases_bifurcacao (dropado na 0022).
-- ============================================================================

CREATE OR REPLACE FUNCTION system_fn_avancar_fin_se_ok(
  p_case_id UUID,
  p_triggered_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_expected TEXT;      -- macrostatus_fin lido no início (etapa esperada)
  v_service_type UUID;
  v_org UUID;
  v_current_ordem INTEGER;
  v_next_slug TEXT;
  v_rows INTEGER;
BEGIN
  -- Lê estado no início (após localizar o caso).
  SELECT macrostatus_fin, service_type_id, organization_id
    INTO v_expected, v_service_type, v_org
    FROM system_cases
   WHERE id = p_case_id AND deleted_at IS NULL;

  -- Caso inexistente / sem tipo / ainda não bifurcado (NULL ou NAO_APLICAVEL) → no-op.
  -- A ENTRADA no fin é responsabilidade de system_fn_entrar_financeiro.
  IF NOT FOUND OR v_service_type IS NULL
     OR v_expected IS NULL OR v_expected = 'NAO_APLICAVEL' THEN
    RETURN;
  END IF;

  -- Pendências: existe algum item required NÃO concluído na etapa fin esperada?
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

  -- ordem da etapa fin esperada do tipo de serviço.
  SELECT ordem INTO v_current_ordem
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'fin'
     AND slug = v_expected
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_current_ordem IS NULL THEN
    RETURN;  -- etapa atual não mapeada (defensivo)
  END IF;

  -- Próxima etapa fin real (menor ordem > atual, nunca NAO_APLICAVEL).
  -- NULL = última etapa fin → não avança.
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
    RETURN;  -- última etapa fin → nada a fazer
  END IF;

  -- Promove com guarda de idempotência/concorrência: só avança se a etapa fin
  -- atual ainda for a esperada (reavaliada após lock). Dual-write via macrostatus_fin.
  UPDATE system_cases
     SET macrostatus_fin = v_next_slug,
         status_fin_changed_at = NOW()
   WHERE id = p_case_id
     AND macrostatus_fin = v_expected;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Evento só quando a promoção efetivamente ocorreu.
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
