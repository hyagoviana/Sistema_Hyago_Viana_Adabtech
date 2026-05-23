-- ============================================================================
-- Sistema HV — Migration 0004 — Casos + Timeline
-- ----------------------------------------------------------------------------
-- system_cases       — caso operacional vinculado a cliente
-- system_case_events — timeline de transições e mudanças (audit específico)
-- seq_system_case_code — sequence pra gerar HV-{TIPO}-{YEAR}-{NNNN}
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Sequence pra gerar case_code (global, formato HV-FIES-2026-0001)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS seq_system_case_code START 1;

-- ----------------------------------------------------------------------------
-- system_cases
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_cases (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  client_id           UUID NOT NULL REFERENCES system_clients(id) ON DELETE RESTRICT,

  case_code           TEXT NOT NULL UNIQUE,
  case_type           TEXT NOT NULL,
  macrostatus_op      TEXT NOT NULL DEFAULT 'ONBOARDING',
  macrostatus_fin     TEXT NOT NULL DEFAULT 'NAO_APLICAVEL',

  -- Operacional
  proximo_passo       TEXT,
  responsavel         TEXT,
  municipio           TEXT,

  -- Financeiro (preenchido pela Sprint 4)
  valor_centavos      BIGINT,
  inadimplente        BOOLEAN NOT NULL DEFAULT FALSE,

  -- Estado calculado pelo trigger abaixo
  status_changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT system_cases_case_type_check
    CHECK (case_type IN ('FIES_ESF','FIES_DGM','COVID','MAIS_MEDICOS','RESIDENCIA','CFM_CRM')),

  CONSTRAINT system_cases_macrostatus_op_check
    CHECK (macrostatus_op IN (
      'ONBOARDING','ANALISE','CONFERENCIA','PRONTO_AJUIZAR','EM_ANDAMENTO',
      'AGUARDANDO_DECISAO','IMPLANTADO','IMPLANTACAO_PARCIAL','ENCERRADO','CANCELADO'
    )),

  CONSTRAINT system_cases_macrostatus_fin_check
    CHECK (macrostatus_fin IN (
      'NAO_APLICAVEL','ELABORANDO','APROVACAO','AGUARDANDO_ATIVACAO','ATIVO',
      'QUITANDO','QUITADO','INADIMPLENTE','PARCIAL','RENEGOCIADO','SUSPENSO','CANCELADO'
    ))
);

CREATE INDEX IF NOT EXISTS idx_system_cases_org_active
  ON system_cases(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_cases_client
  ON system_cases(client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_cases_macrostatus_op
  ON system_cases(macrostatus_op) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_cases_case_code
  ON system_cases(case_code);

CREATE TRIGGER trg_system_cases_updated_at
  BEFORE UPDATE ON system_cases
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- Atualiza status_changed_at quando macrostatus_op muda
CREATE OR REPLACE FUNCTION system_cases_status_changed_at_trg()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.macrostatus_op IS DISTINCT FROM OLD.macrostatus_op THEN
    NEW.status_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_system_cases_status_changed_at
  BEFORE UPDATE ON system_cases
  FOR EACH ROW EXECUTE FUNCTION system_cases_status_changed_at_trg();

-- View ativa + JOIN com cliente filtrando soft-deletes
CREATE OR REPLACE VIEW system_cases_active AS
  SELECT c.*
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- system_case_events — timeline (transições + mudanças relevantes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  action              TEXT NOT NULL, -- 'created','status_changed','updated','soft_deleted'
  from_macrostatus_op TEXT,
  to_macrostatus_op   TEXT,
  diff                JSONB,
  triggered_by        UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_case_events_case_created
  ON system_case_events(case_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE system_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_cases_select_own_org ON system_cases
  FOR SELECT USING (organization_id = system_current_organization_id());

CREATE POLICY system_cases_insert_own_org ON system_cases
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());

CREATE POLICY system_cases_update_own_org ON system_cases
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());

CREATE POLICY system_cases_delete_own_org ON system_cases
  FOR DELETE USING (organization_id = system_current_organization_id());

ALTER TABLE system_case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_case_events_select_own_org ON system_case_events
  FOR SELECT USING (organization_id = system_current_organization_id());
-- INSERT em events fica via service_role (backend).

-- ----------------------------------------------------------------------------
-- Grants (mesmo padrão da migration 0002)
-- ----------------------------------------------------------------------------
GRANT ALL ON TABLE system_cases, system_case_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_cases TO anon, authenticated;
GRANT SELECT ON TABLE system_case_events TO anon, authenticated;
GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
GRANT USAGE ON SEQUENCE seq_system_case_code TO service_role;
GRANT EXECUTE ON FUNCTION system_cases_status_changed_at_trg() TO service_role;
