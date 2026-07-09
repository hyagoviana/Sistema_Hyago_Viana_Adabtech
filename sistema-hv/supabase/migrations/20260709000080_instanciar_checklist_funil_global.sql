-- ============================================================================
-- Sistema HV — Migration — Instanciação de checklist do FUNIL FINANCEIRO ÚNICO
-- ----------------------------------------------------------------------------
-- BUG (2026-07-09): o checklist existe SÓ no pipeline financeiro, que é o funil
-- ÚNICO/global (service_type_id = GLOBAL_FUNNEL_SERVICE_TYPE_ID = ...f0),
-- compartilhado por TODOS os tipos. As defs de checklist são salvas sob esse id
-- global — mas a instanciação filtrava `d.service_type_id = <tipo REAL do caso>`
-- (FIES, Abatimento…), que NUNCA casa com o id global. Resultado: nenhuma etapa
-- de checklist criada no editor do funil financeiro aparecia nos casos.
--
-- Correção: a instanciação passa a casar as defs cujo service_type_id seja o do
-- caso OU o do funil global. Continua idempotente (ON CONFLICT DO NOTHING) e
-- mantém a herança do responsável (assigned_to) do DEF para o item.
-- Idempotente.
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
           '00000000-0000-0000-0000-0000000000f0'::uuid  -- GLOBAL_FUNNEL_SERVICE_TYPE_ID
         )
     AND d.stage_slug = p_stage_slug
     AND d.active = TRUE
     AND d.deleted_at IS NULL
  ON CONFLICT (case_id, def_id) WHERE deleted_at IS NULL DO NOTHING;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_instanciar_checklist(UUID, TEXT) TO service_role, authenticated;
