-- ============================================================================
-- Sistema HV — Migration 0020 — S18-1: Parcelas (geradas do Termo aceito)
-- ----------------------------------------------------------------------------
-- Cobrança externa (Conta Azul/Asaas via n8n) entra na S18-2 (preenche provider_ext_id).
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_parcelas (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id             UUID NOT NULL REFERENCES system_cases(id) ON DELETE RESTRICT,
  termo_id            UUID NOT NULL REFERENCES system_termo_snapshots(id) ON DELETE RESTRICT,

  numero              INT NOT NULL,
  valor_centavos      BIGINT NOT NULL,
  vencimento          DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'PENDENTE'
                        CHECK (status IN ('PENDENTE','PAGA','VENCIDA','RENEGOCIADA','CANCELADA')),

  data_pagamento      TIMESTAMPTZ,
  valor_pago_centavos BIGINT,
  metodo_pagamento    TEXT,

  -- Integração cobrança (S18-2)
  provider            TEXT,        -- 'conta_azul' | 'asaas'
  provider_ext_id     TEXT,
  boleto_url          TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (termo_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_system_parcelas_case ON system_parcelas(case_id);
CREATE INDEX IF NOT EXISTS idx_system_parcelas_status ON system_parcelas(status);
CREATE INDEX IF NOT EXISTS idx_system_parcelas_vencimento ON system_parcelas(vencimento) WHERE status IN ('PENDENTE','VENCIDA');

CREATE TRIGGER trg_system_parcelas_updated_at
  BEFORE UPDATE ON system_parcelas
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_parcelas_active AS
  SELECT * FROM system_parcelas;

DROP TRIGGER IF EXISTS trg_audit_parcelas ON system_parcelas;
CREATE TRIGGER trg_audit_parcelas
  AFTER INSERT OR UPDATE OR DELETE ON system_parcelas
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

ALTER TABLE system_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_parcelas_select ON system_parcelas FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_parcelas_insert ON system_parcelas FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_parcelas_update ON system_parcelas FOR UPDATE USING (organization_id = system_current_organization_id()) WITH CHECK (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_parcelas TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE system_parcelas TO anon, authenticated;
GRANT SELECT ON system_parcelas_active TO anon, authenticated, service_role;
