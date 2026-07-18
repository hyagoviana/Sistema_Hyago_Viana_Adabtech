-- ============================================================================
-- Sistema HV — Migration — R2-07 — Campos personalizados por TEMA/FRENTE (ADITIVA)
-- ----------------------------------------------------------------------------
-- Épico R2 (bloco B2, N6/A2 estrutural). Cria a ESTRUTURA GENÉRICA de definições
-- de campo do CASO por TEMA e por FRENTE (o "form builder" do painel do caso).
-- O VALOR por caso continua em system_cases.canonical_fields (S2-07) — esta
-- migration NÃO cria coluna nova, NÃO toca system_cases / system_cases_active /
-- trigger de bifurcação. Só nasce a tabela de defs + view + RLS/grants/auditoria.
--
-- MODELO:
--   • frente_slug NULL  = campo do painel PADRÃO do TEMA (vale para todas as frentes).
--   • frente_slug setado = campo CONDICIONAL da frente.
-- A UI da ficha do caso resolve as defs por (tema_id, frente_slug OU NULL) e grava
-- o valor em canonical_fields via updateCaseCanonicalFields (INALTERADO).
--
-- [C4] UNIQUE com COALESCE — OBRIGATÓRIO. No Postgres, NULLs contam como valores
-- DISTINTOS num UNIQUE → sem COALESCE, o índice permitiria duplicatas silenciosas
-- de def "sem frente" (frente_slug NULL). Por isso o índice único usa
-- COALESCE(frente_slug,'') — mesmo padrão de R2-04 (20260719000004).
--
-- ESCOPO / REGRAS DE OURO:
--   • NÃO migra os campos FIES concretos (R5-06 / fies-fields.ts) para cá — só a
--     estrutura genérica. FiesFields continua funcionando por conta própria.
--   • NÃO toca system_cases / system_cases_active / trigger de bifurcação.
--   • Idempotente: CREATE ... IF NOT EXISTS, DROP ... IF EXISTS, DO-blocks
--     guardados. Rollback simétrico em rollbacks/ (preserva canonical_fields).
--
-- Molde: 20260622000002_client_custom_fields.sql (system_client_field_defs:
--        defs + view _active + RLS/grants/auditoria/trigger updated_at),
--        20260719000004_folders_checklist_por_frente.sql (UNIQUE COALESCE).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Definições de campos por TEMA/FRENTE (o "form builder" do painel do caso)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_tema_field_defs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  tema_id           UUID NOT NULL REFERENCES system_temas(id) ON DELETE CASCADE,
  frente_slug       TEXT,                   -- NULL = painel padrão do tema; setado = condicional da frente

  key               TEXT NOT NULL,          -- slug estável usado como chave no JSONB canonical_fields
  label             TEXT NOT NULL,          -- rótulo exibido na ficha do caso
  type              TEXT NOT NULL
    CHECK (type IN ('text', 'select', 'money', 'number', 'date')),
  options           JSONB,                  -- array de strings (para type = 'select')
  ordem             INTEGER NOT NULL DEFAULT 0,
  required          BOOLEAN NOT NULL DEFAULT FALSE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,

  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- [C4] UNIQUE(tema_id, COALESCE(frente_slug,''), key) entre linhas ativas. Uma def
-- com frente pode coexistir com a def padrão (NULL) e com a de outra frente sob a
-- mesma (tema_id, key), sem colidir e sem duplicatas silenciosas dos NULLs.
DROP INDEX IF EXISTS system_tema_field_defs_uq;
CREATE UNIQUE INDEX IF NOT EXISTS system_tema_field_defs_uq
  ON system_tema_field_defs (tema_id, COALESCE(frente_slug, ''), key)
  WHERE deleted_at IS NULL;

-- Leitura ordenada por tema/frente/ordem (padrão da UI).
CREATE INDEX IF NOT EXISTS idx_system_tema_field_defs_tema_active
  ON system_tema_field_defs (tema_id, ordem)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_system_tema_field_defs_updated_at ON system_tema_field_defs;
CREATE TRIGGER trg_system_tema_field_defs_updated_at
  BEFORE UPDATE ON system_tema_field_defs
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_tema_field_defs_active AS
  SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2) Auditoria + RLS + grants (padrão do sistema — molde client_field_defs)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_tema_field_defs ON system_tema_field_defs;
CREATE TRIGGER trg_audit_tema_field_defs
  AFTER INSERT OR UPDATE OR DELETE ON system_tema_field_defs
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

ALTER TABLE system_tema_field_defs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_tema_field_defs_select_own_org ON system_tema_field_defs;
CREATE POLICY system_tema_field_defs_select_own_org ON system_tema_field_defs
  FOR SELECT USING (organization_id = system_current_organization_id());

DROP POLICY IF EXISTS system_tema_field_defs_insert_own_org ON system_tema_field_defs;
CREATE POLICY system_tema_field_defs_insert_own_org ON system_tema_field_defs
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());

DROP POLICY IF EXISTS system_tema_field_defs_update_own_org ON system_tema_field_defs;
CREATE POLICY system_tema_field_defs_update_own_org ON system_tema_field_defs
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());

DROP POLICY IF EXISTS system_tema_field_defs_delete_own_org ON system_tema_field_defs;
CREATE POLICY system_tema_field_defs_delete_own_org ON system_tema_field_defs
  FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_tema_field_defs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_tema_field_defs TO anon, authenticated;
GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;
