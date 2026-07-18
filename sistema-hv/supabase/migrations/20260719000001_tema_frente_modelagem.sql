-- ============================================================================
-- Sistema HV — Migration — R2-01 — Modelagem TEMA + FRENTE/TIPO (ADITIVA)
-- ----------------------------------------------------------------------------
-- Épico R2 (fase 5a da Sequência Segura §7). Introduz as entidades TEMA e
-- FRENTE/TIPO como camada ADITIVA, sem tocar em system_service_types (núcleo),
-- case_type/macrostatus_*, nem no trigger de dual-write.
--
-- DECISÃO TRAVADA — Opção A (doc-mestre §4.1, story R2-01 §Contexto):
--   • system_temas é tabela NOVA independente.
--   • system_service_types recebe coluna aditiva `tema_id UUID NULL` (N service_types → 1 tema).
--   • system_cases recebe `tema_id UUID NULL` + `frente_slug TEXT NULL`.
--   • SEM backfill, SEM default, SEM CHECK. Estritamente nullable (FK contra tabela
--     vazia é segura: NULL não valida FK).
--
-- REGRA DE OURO 2: esta migration TOCA system_cases → RECRIA system_cases_active
-- (DROP+CREATE) preservando TODAS as colunas VIGENTES (extraídas via
-- pg_get_viewdef em 2026-07-18: 41 colunas = 39 c.* + client_name/client_cpf_cnpj)
-- + as 2 novas. NÃO recria trg_system_cases_bifurcacao. NÃO toca
-- trg_system_cases_sync_stages / system_fn_sync_stage_ids. NÃO remove CHECKs de
-- lifecycle.
--
-- Molde: 20260608000003_s13_espinha.sql (config-table com RLS+audit+updated_at)
--        + 20260709000030_service_type_folders.sql (tabela filha, view _active, grants)
--        + 20260703000004_case_canonical_fields.sql (coluna aditiva + recriar view).
--
-- Idempotente: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
-- CREATE INDEX IF NOT EXISTS / DROP VIEW IF EXISTS antes de recriar / policies
-- e triggers guardados por DROP ... IF EXISTS ou DO-block.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) system_temas (camada TEMA — nova, independente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_temas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  ordem            INT NOT NULL DEFAULT 0,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- slug UNIQUE por org (índice parcial — permite reusar slug de tema soft-deletado).
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_temas_org_slug
  ON system_temas(organization_id, slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_temas_org
  ON system_temas(organization_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_system_temas_updated_at ON system_temas;
CREATE TRIGGER trg_system_temas_updated_at
  BEFORE UPDATE ON system_temas
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_temas_active AS
  SELECT * FROM system_temas WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2) system_tema_frentes (FRENTE/TIPO por tema)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_tema_frentes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  tema_id          UUID NOT NULL REFERENCES system_temas(id) ON DELETE CASCADE,
  slug             TEXT NOT NULL,
  label            TEXT NOT NULL,
  ordem            INT NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- slug UNIQUE por tema (índice parcial WHERE deleted_at IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_tema_frentes_tema_slug
  ON system_tema_frentes(tema_id, slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_tema_frentes_tema
  ON system_tema_frentes(tema_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_system_tema_frentes_updated_at ON system_tema_frentes;
CREATE TRIGGER trg_system_tema_frentes_updated_at
  BEFORE UPDATE ON system_tema_frentes
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_tema_frentes_active AS
  SELECT * FROM system_tema_frentes WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3) RLS por org + Grants (molde s13_espinha:166-180). Idempotente via DROP POLICY.
-- ----------------------------------------------------------------------------
ALTER TABLE system_temas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_temas_select ON system_temas;
CREATE POLICY system_temas_select ON system_temas FOR SELECT USING (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS system_temas_insert ON system_temas;
CREATE POLICY system_temas_insert ON system_temas FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS system_temas_update ON system_temas;
CREATE POLICY system_temas_update ON system_temas FOR UPDATE USING (organization_id = system_current_organization_id()) WITH CHECK (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS system_temas_delete ON system_temas;
CREATE POLICY system_temas_delete ON system_temas FOR DELETE USING (organization_id = system_current_organization_id());

ALTER TABLE system_tema_frentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_tema_frentes_select ON system_tema_frentes;
CREATE POLICY system_tema_frentes_select ON system_tema_frentes FOR SELECT USING (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS system_tema_frentes_insert ON system_tema_frentes;
CREATE POLICY system_tema_frentes_insert ON system_tema_frentes FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS system_tema_frentes_update ON system_tema_frentes;
CREATE POLICY system_tema_frentes_update ON system_tema_frentes FOR UPDATE USING (organization_id = system_current_organization_id()) WITH CHECK (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS system_tema_frentes_delete ON system_tema_frentes;
CREATE POLICY system_tema_frentes_delete ON system_tema_frentes FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_temas, system_tema_frentes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_temas, system_tema_frentes TO anon, authenticated;
GRANT SELECT ON system_temas_active, system_tema_frentes_active TO anon, authenticated, service_role;

-- Auditoria (molde s13_espinha:183-186).
DROP TRIGGER IF EXISTS trg_audit_temas ON system_temas;
CREATE TRIGGER trg_audit_temas AFTER INSERT OR UPDATE OR DELETE ON system_temas FOR EACH ROW EXECUTE FUNCTION system_fn_audit();
DROP TRIGGER IF EXISTS trg_audit_tema_frentes ON system_tema_frentes;
CREATE TRIGGER trg_audit_tema_frentes AFTER INSERT OR UPDATE OR DELETE ON system_tema_frentes FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

-- ----------------------------------------------------------------------------
-- 4) Colunas aditivas nullable (Opção A). SEM popular, SEM default, SEM CHECK.
-- ----------------------------------------------------------------------------
ALTER TABLE system_service_types
  ADD COLUMN IF NOT EXISTS tema_id UUID REFERENCES system_temas(id);

ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS tema_id UUID REFERENCES system_temas(id);
ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS frente_slug TEXT;

-- Índices.
CREATE INDEX IF NOT EXISTS idx_system_cases_tema
  ON system_cases(tema_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_service_types_tema
  ON system_service_types(tema_id);

-- ----------------------------------------------------------------------------
-- 5) RECRIAR system_cases_active (DROP+CREATE) — REGRA DE OURO 2.
--    Base: definição VIGENTE extraída do banco (pg_get_viewdef, 2026-07-18),
--    que já inclui macrostatus_comercial / stage_comercial_id / procuracao_assinada_at
--    (NÃO presentes na 20260703000004). Apenas ACRESCENTAMOS c.tema_id, c.frente_slug.
--    Total: 41 colunas vigentes + 2 novas = 43 colunas.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS system_cases_active;
CREATE VIEW system_cases_active AS
  SELECT
    c.id,
    c.organization_id,
    c.client_id,
    c.case_code,
    c.case_type,
    c.macrostatus_op,
    c.macrostatus_fin,
    c.proximo_passo,
    c.responsavel,
    c.municipio,
    c.valor_centavos,
    c.inadimplente,
    c.status_changed_at,
    c.created_by,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    c.status_fin_changed_at,
    c.drive_folder_id,
    c.drive_folder_url,
    c.drive_sync_failed,
    c.drive_sync_error,
    c.service_type_id,
    c.stage_op_id,
    c.stage_fin_id,
    c.acerto_parcial,
    c.tem_pendencia_judicial,
    c.acerto_parcial_obs,
    c.removido_do_operacional_at,
    c.aguardando_assinatura_at,
    c.assinatura_liberada_at,
    c.assinatura_liberada_by,
    c.lifecycle,
    c.perdido_at,
    c.perdido_motivo,
    c.canonical_fields,
    c.macrostatus_comercial,
    c.stage_comercial_id,
    c.procuracao_assinada_at,
    c.tema_id,
    c.frente_slug,
    cli.full_name AS client_name,
    cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
    JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;

GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
