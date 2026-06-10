-- ============================================================================
-- Sistema HV — Migration 0022 — S19: Entrada no Financeiro (Duplicar / Somente-fin)
-- ----------------------------------------------------------------------------
-- D1 (reversível): coluna `removido_do_operacional_at` (flag de data, NULL = no op).
-- D2 (só manual): DROP do trigger de bifurcação automática `trg_system_cases_bifurcacao`
--                 (a FUNÇÃO permanece para rollback). A entrada no financeiro passa a
--                 ser sempre manual, pelo botão + popup.
-- ADRs: ADR-012 (flag), ADR-013 (drop trigger), ADR-014 (1ª etapa fin por MIN(ordem)),
--       ADR-016 (filtro só no Kanban op — implementado no front).
-- Preservados: trg_system_cases_status_fin_changed_at (carimbo) e
--              trg_system_cases_sync_stages (projeção macrostatus_fin -> stage_fin_id).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Flag reversível de remoção do operacional (D1 / ADR-012)
-- ----------------------------------------------------------------------------
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS removido_do_operacional_at TIMESTAMPTZ;

-- Índice parcial: acelera o filtro "ainda no operacional" do Kanban op.
CREATE INDEX IF NOT EXISTS idx_system_cases_removido_operacional
  ON system_cases(removido_do_operacional_at)
  WHERE removido_do_operacional_at IS NOT NULL AND deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2) Desligar a bifurcação automática (D2 / ADR-013)
--    DROP só do trigger; a função fica viva para rollback de 1 linha.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_system_cases_bifurcacao ON system_cases;
-- (NÃO dropar system_cases_bifurcacao_trg() — rollback recria o trigger a partir dela.)

-- ----------------------------------------------------------------------------
-- 3) Função única de entrada no financeiro (idempotente) — ADR-014
--    Resolve a 1ª etapa fin REAL (menor ordem, slug <> NAO_APLICAVEL) do tipo de
--    serviço do caso. Grava via macrostatus_fin (dual-write; a projeção preenche
--    stage_fin_id). Seta/limpa a flag conforme o modo escolhido no popup.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_fn_entrar_financeiro(
  p_case_id UUID,
  p_remover_operacional BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_service_type UUID;
  v_first_fin_slug TEXT;
BEGIN
  SELECT service_type_id INTO v_service_type
    FROM system_cases
   WHERE id = p_case_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caso não encontrado' USING ERRCODE = 'no_data_found';
  END IF;

  -- 1ª etapa financeira real do tipo de serviço (não NAO_APLICAVEL).
  SELECT slug INTO v_first_fin_slug
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'fin'
     AND slug <> 'NAO_APLICAVEL'
     AND deleted_at IS NULL
   ORDER BY ordem ASC
   LIMIT 1;

  IF v_first_fin_slug IS NULL THEN
    RAISE EXCEPTION 'Tipo de serviço sem etapa financeira cadastrada' USING ERRCODE = 'check_violation';
  END IF;

  -- Bifurca (idempotente): só promove se ainda não bifurcado. Sob concorrência,
  -- a 2ª transação reavalia o WHERE após o lock e vira no-op.
  UPDATE system_cases
     SET macrostatus_fin = v_first_fin_slug,
         status_fin_changed_at = NOW()
   WHERE id = p_case_id
     AND (macrostatus_fin IS NULL OR macrostatus_fin = 'NAO_APLICAVEL');

  -- Flag de remoção do operacional (idempotente em cada sentido).
  IF p_remover_operacional THEN
    UPDATE system_cases SET removido_do_operacional_at = NOW()
     WHERE id = p_case_id AND removido_do_operacional_at IS NULL;
  ELSE
    UPDATE system_cases SET removido_do_operacional_at = NULL
     WHERE id = p_case_id AND removido_do_operacional_at IS NOT NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_entrar_financeiro(UUID, BOOLEAN) TO service_role, authenticated;

-- ----------------------------------------------------------------------------
-- 4) Reverter: trazer o caso de volta ao operacional (D1)
--    Zera APENAS a flag. NÃO toca macrostatus_fin/stage_fin_id/status_fin_changed_at
--    (a coluna nem está na lista do trigger de projeção/carimbo). Idempotente.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_fn_voltar_ao_operacional(p_case_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE system_cases SET removido_do_operacional_at = NULL
   WHERE id = p_case_id AND removido_do_operacional_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_voltar_ao_operacional(UUID) TO service_role, authenticated;

-- ----------------------------------------------------------------------------
-- 5) Refresh da view (c.* é fixado na criação — DROP+CREATE para expor a coluna nova)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS system_cases_active;
CREATE VIEW system_cases_active AS
  SELECT c.*, cli.full_name AS client_name, cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;
GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
