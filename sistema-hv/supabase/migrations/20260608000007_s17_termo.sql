-- ============================================================================
-- Sistema HV — Migration 0019 — S17 Termo de Acerto (snapshot imutável)
-- ----------------------------------------------------------------------------
-- Calculo em CENTAVOS (inteiros). Segregação elaborador<>conferidor (CHECK + RLS).
-- Imutabilidade após aprovação via TRIGGER (RLS sozinha não basta — service_role
-- bypassa). BLOCKER B6 (Architect/QA).
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_termo_snapshots (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id                     UUID NOT NULL REFERENCES system_cases(id) ON DELETE RESTRICT,
  version                     INT NOT NULL DEFAULT 1,
  supersedes                  UUID REFERENCES system_termo_snapshots(id),

  -- Cálculo (centavos)
  saldo_antes_centavos        BIGINT NOT NULL,
  saldo_depois_centavos       BIGINT NOT NULL,
  parcelas_pagas_centavos     BIGINT NOT NULL DEFAULT 0,
  valor_efetivo_centavos      BIGINT NOT NULL,
  percentual_honorarios       NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  valor_total_centavos        BIGINT NOT NULL,
  valor_parcela_centavos      BIGINT NOT NULL DEFAULT 50000,
  qtd_parcelas                INT NOT NULL,
  valor_ultima_parcela_centavos BIGINT NOT NULL DEFAULT 0,
  desconto_avista_pct         NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  valor_avista_centavos       BIGINT NOT NULL,
  forma_pagamento             TEXT NOT NULL DEFAULT 'PARCELADO' CHECK (forma_pagamento IN ('PARCELADO','A_VISTA')),
  tipo_termo                  TEXT NOT NULL DEFAULT 'PARCIAL' CHECK (tipo_termo IN ('PARCIAL','COMPLEMENTAR')),

  -- Workflow
  status                      TEXT NOT NULL DEFAULT 'RASCUNHO'
                                CHECK (status IN ('RASCUNHO','EM_CONFERENCIA','APROVADO_JURIDICO',
                                                  'APRESENTADO','ACEITO','RECUSADO','SUBSTITUIDO')),
  elaborado_por_id            UUID,
  conferido_por_id            UUID,
  aprovado_por_id             UUID,
  aprovacao_automatica        BOOLEAN NOT NULL DEFAULT FALSE,
  criterios_aprovacao         JSONB,

  -- PDF
  drive_file_id               TEXT,
  drive_url                   TEXT,
  pdf_hash_sha256             TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_segregacao CHECK (conferido_por_id IS NULL OR conferido_por_id <> elaborado_por_id),
  UNIQUE (case_id, version)
);

CREATE INDEX IF NOT EXISTS idx_system_termo_case ON system_termo_snapshots(case_id);
CREATE INDEX IF NOT EXISTS idx_system_termo_status ON system_termo_snapshots(case_id, status);

CREATE TRIGGER trg_system_termo_updated_at
  BEFORE UPDATE ON system_termo_snapshots
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- Imutabilidade após aprovação (B6): bloqueia mudança nos campos de cálculo e
-- bloqueia DELETE quando o termo já foi aprovado/apresentado/aceito.
CREATE OR REPLACE FUNCTION system_fn_termo_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('APROVADO_JURIDICO','APRESENTADO','ACEITO') THEN
      RAISE EXCEPTION 'Termo aprovado é imutável e não pode ser apagado (gere v2)';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('APROVADO_JURIDICO','APRESENTADO','ACEITO') THEN
    IF NEW.saldo_antes_centavos   <> OLD.saldo_antes_centavos
       OR NEW.saldo_depois_centavos  <> OLD.saldo_depois_centavos
       OR NEW.valor_efetivo_centavos <> OLD.valor_efetivo_centavos
       OR NEW.valor_total_centavos   <> OLD.valor_total_centavos
       OR NEW.percentual_honorarios  <> OLD.percentual_honorarios
       OR NEW.qtd_parcelas           <> OLD.qtd_parcelas THEN
      RAISE EXCEPTION 'Termo aprovado é imutável — para alterar, gere uma nova versão (v2)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_termo_immutable ON system_termo_snapshots;
CREATE TRIGGER trg_system_termo_immutable
  BEFORE UPDATE OR DELETE ON system_termo_snapshots
  FOR EACH ROW EXECUTE FUNCTION system_fn_termo_immutable();

DROP TRIGGER IF EXISTS trg_audit_termo ON system_termo_snapshots;
CREATE TRIGGER trg_audit_termo
  AFTER INSERT OR UPDATE OR DELETE ON system_termo_snapshots
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

CREATE OR REPLACE VIEW system_termo_snapshots_active AS
  SELECT * FROM system_termo_snapshots;

ALTER TABLE system_termo_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_termo_select ON system_termo_snapshots FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_termo_insert ON system_termo_snapshots FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_termo_update ON system_termo_snapshots FOR UPDATE USING (organization_id = system_current_organization_id()) WITH CHECK (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_termo_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE system_termo_snapshots TO anon, authenticated;
GRANT SELECT ON system_termo_snapshots_active TO anon, authenticated, service_role;
