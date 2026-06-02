-- ============================================================================
-- Sistema HV — Migration 0007 — Bifurcação automática + status_fin_changed_at
-- ----------------------------------------------------------------------------
-- Quando macrostatus_op muda pra IMPLANTADO ou IMPLANTACAO_PARCIAL e o
-- macrostatus_fin ainda é NAO_APLICAVEL, dispara fin = ELABORANDO no mesmo
-- UPDATE (BEFORE trigger, atômico).
--
-- E acompanha status_fin_changed_at (simétrico ao status_changed_at).
-- ============================================================================

ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS status_fin_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ----------------------------------------------------------------------------
-- Trigger: bifurcação automática op → fin
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_cases_bifurcacao_trg()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.macrostatus_op IN ('IMPLANTADO', 'IMPLANTACAO_PARCIAL')
     AND OLD.macrostatus_op NOT IN ('IMPLANTADO', 'IMPLANTACAO_PARCIAL')
     AND NEW.macrostatus_fin = 'NAO_APLICAVEL'
  THEN
    NEW.macrostatus_fin := 'ELABORANDO';
    NEW.status_fin_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_cases_bifurcacao ON system_cases;
CREATE TRIGGER trg_system_cases_bifurcacao
  BEFORE UPDATE ON system_cases
  FOR EACH ROW EXECUTE FUNCTION system_cases_bifurcacao_trg();

-- ----------------------------------------------------------------------------
-- Trigger: status_fin_changed_at (atualiza quando macrostatus_fin muda)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_cases_status_fin_changed_at_trg()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.macrostatus_fin IS DISTINCT FROM OLD.macrostatus_fin THEN
    NEW.status_fin_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_cases_status_fin_changed_at ON system_cases;
CREATE TRIGGER trg_system_cases_status_fin_changed_at
  BEFORE UPDATE ON system_cases
  FOR EACH ROW EXECUTE FUNCTION system_cases_status_fin_changed_at_trg();

-- ----------------------------------------------------------------------------
-- Recriar view (CREATE OR REPLACE não aceita mudança de ordem/composição
-- quando há colunas novas via c.*). DROP + CREATE resolve.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS system_cases_active;
CREATE VIEW system_cases_active AS
  SELECT
    c.*,
    cli.full_name AS client_name,
    cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;

GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION system_cases_bifurcacao_trg() TO service_role;
GRANT EXECUTE ON FUNCTION system_cases_status_fin_changed_at_trg() TO service_role;
