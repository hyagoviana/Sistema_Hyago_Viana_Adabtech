-- ============================================================================
-- Sistema HV — Migration — S2-03 — Instanciar checklist ao entrar na etapa
-- ----------------------------------------------------------------------------
-- Função idempotente (molde system_fn_entrar_financeiro): materializa os itens
-- de checklist da etapa de destino no momento em que o caso entra nela.
-- Chamada SERVER-SIDE dentro da transição (pipeline-service / cases-service),
-- nunca pelo front. A idempotência vem do UNIQUE parcial (case_id, def_id) de S2-01.
--
-- NÃO toca colunas de system_cases → NÃO recria system_cases_active.
-- NÃO recria trg_system_cases_bifurcacao. Não é trigger — é função chamada via RPC
-- no mesmo caminho de serviço que TODA transição op usa (Opção A da story).
-- ============================================================================

CREATE OR REPLACE FUNCTION system_fn_instanciar_checklist(
  p_case_id UUID,
  p_stage_slug TEXT
)
RETURNS VOID AS $$
DECLARE
  v_service_type UUID;
  v_org UUID;
BEGIN
  -- Resolve tipo de serviço + org do caso. Se não achar/sem tipo → no-op silencioso.
  SELECT service_type_id, organization_id
    INTO v_service_type, v_org
    FROM system_cases
   WHERE id = p_case_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_service_type IS NULL THEN
    RETURN;
  END IF;

  -- Copia os defs ativos da etapa/tipo para itens do caso. Idempotente:
  -- ON CONFLICT no UNIQUE parcial (case_id, def_id) preserva itens já existentes
  -- (inclusive os já done). source='manual', done=false por padrão.
  INSERT INTO system_case_checklist_items
    (organization_id, case_id, def_id, stage_slug, source, done)
  SELECT v_org, p_case_id, d.id, d.stage_slug, 'manual', FALSE
    FROM system_stage_checklist_defs d
   WHERE d.service_type_id = v_service_type
     AND d.stage_slug = p_stage_slug
     AND d.active = TRUE
     AND d.deleted_at IS NULL
  ON CONFLICT (case_id, def_id) WHERE deleted_at IS NULL DO NOTHING;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_instanciar_checklist(UUID, TEXT) TO service_role, authenticated;
