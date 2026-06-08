-- ============================================================================
-- Sistema HV — Migration 0018 — S16: Bifurcação por botão (idempotente) + acerto parcial
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ADR-009 — Função única idempotente de bifurcação
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_fn_bifurcar_financeiro(p_case_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE system_cases
     SET macrostatus_fin = 'ELABORANDO',
         status_fin_changed_at = NOW()
   WHERE id = p_case_id
     AND deleted_at IS NULL
     AND (macrostatus_fin IS NULL OR macrostatus_fin = 'NAO_APLICAVEL');
  -- idempotente: se já bifurcado, o WHERE não casa e nada acontece.
  -- O trigger de projeção preenche stage_fin_id a partir de macrostatus_fin.
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_bifurcar_financeiro(UUID) TO service_role, authenticated;

-- ----------------------------------------------------------------------------
-- ADR-010 — Marcação acerto parcial / judicial (escalar, acompanha o caso)
-- ----------------------------------------------------------------------------
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS acerto_parcial         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS tem_pendencia_judicial BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS acerto_parcial_obs     TEXT;

-- Refresh da view pra expor as colunas novas
DROP VIEW IF EXISTS system_cases_active;
CREATE VIEW system_cases_active AS
  SELECT c.*, cli.full_name AS client_name, cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;
GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
