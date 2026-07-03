-- ============================================================================
-- Sistema HV — Migration — S7-01 — Honorários por caso (system_case_honorarios)
-- ----------------------------------------------------------------------------
-- Persiste os valores financeiros digitados na revisão da procuração (percentual
-- de honorários, valor da parcela, desconto à vista, forma de pagamento e total
-- quando disponível) por caso, para que a elaboração do Termo de Acerto (S7-02)
-- e futuras procurações (S7-03) possam PRÉ-PREENCHER esses valores.
--
-- 1 registro vigente por caso (UNIQUE parcial WHERE deleted_at IS NULL → upsert
-- idempotente ao re-gerar a procuração). Saldos do processo NÃO entram aqui
-- (não têm fonte → seguem manuais no termo).
--
-- Molde: 20260703000001_stage_checklist.sql (RLS por org, grants nos 3 roles,
-- view _active, trigger updated_at, trigger de auditoria system_fn_audit).
--
-- REGRA DE OURO: esta migration NÃO toca colunas de system_cases → NÃO recria
-- system_cases_active. NÃO recriar trg_system_cases_bifurcacao (dropado).
-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   DROP VIEW IF EXISTS system_case_honorarios_active;
--   DROP TABLE IF EXISTS system_case_honorarios;  -- (cascateia triggers/policies)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_case_honorarios (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id           UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id                   UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,

  -- Valores financeiros da procuração (todos nullable — registro pode nascer parcial).
  percentual_honorarios     NUMERIC(5,2),           -- ex.: 15.00 (não "15%")
  valor_parcela_centavos    INTEGER,                -- centavos (int), ex.: 50000
  desconto_avista_pct       NUMERIC(5,2),           -- ex.: 10.00
  forma_pagamento           TEXT,                   -- livre (ex.: PARCELADO / A_VISTA), sem CHECK rígido
  honorarios_total_centavos INTEGER,                -- centavos (int), quando disponível

  created_by                UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ
);

-- 1 registro de honorários vigente por caso (permite upsert idempotente).
CREATE UNIQUE INDEX IF NOT EXISTS system_case_honorarios_case_uq
  ON system_case_honorarios (case_id)
  WHERE deleted_at IS NULL;

-- Lookup por caso.
CREATE INDEX IF NOT EXISTS idx_system_case_honorarios_case
  ON system_case_honorarios (case_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_case_honorarios_updated_at
  BEFORE UPDATE ON system_case_honorarios
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_case_honorarios_active AS
  SELECT * FROM system_case_honorarios WHERE deleted_at IS NULL;

-- Auditoria (padrão do sistema).
DROP TRIGGER IF EXISTS trg_audit_case_honorarios ON system_case_honorarios;
CREATE TRIGGER trg_audit_case_honorarios
  AFTER INSERT OR UPDATE OR DELETE ON system_case_honorarios
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

-- RLS por organização (4 policies).
ALTER TABLE system_case_honorarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_case_honorarios_select_own_org ON system_case_honorarios
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_case_honorarios_insert_own_org ON system_case_honorarios
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_honorarios_update_own_org ON system_case_honorarios
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_honorarios_delete_own_org ON system_case_honorarios
  FOR DELETE USING (organization_id = system_current_organization_id());

-- Grants nos 3 roles.
GRANT ALL ON TABLE system_case_honorarios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_case_honorarios TO anon, authenticated;
GRANT SELECT ON system_case_honorarios_active TO anon, authenticated, service_role;
