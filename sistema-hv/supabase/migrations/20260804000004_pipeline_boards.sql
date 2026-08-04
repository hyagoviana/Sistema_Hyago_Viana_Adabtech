-- ============================================================================
-- Sistema HV — Migration — A3: Múltiplos Kanbans (boards/listas) por TEMA
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-03 (Story A3). ADITIVA/idempotente. Generaliza o padrão
-- implícito "op/fin = 2 boards do mesmo caso" para N boards NOMEÁVEIS por tema.
--
-- MODELAGEM TRAVADA (Opção A da story):
--   1) system_pipeline_boards        — 1 entidade "board/lista" por service_type
--      (tema). 1 board PRINCIPAL obrigatório (is_principal) + N boards custom.
--   2) system_pipeline_stages.board_id (aditivo, NULL) — etapas op/fin legadas
--      ficam board_id=NULL (roteadas por kind, INTOCADAS). Etapas de board custom
--      carregam board_id.
--   3) system_case_board_positions   — posição do caso em cada board EXTRA (custom).
--
-- DECISÃO FINA (registrada no Change Log da story):
--   (a) O board PRINCIPAL é o ESPELHO VIRTUAL do operacional: suas colunas são as
--       etapas op existentes (board_id=NULL, kind='op') e a posição do caso é
--       derivada ON-READ de macrostatus_op. => NÃO tocamos createCase, NÃO tocamos
--       o trigger system_fn_sync_stage_ids, NÃO tocamos system_cases. Regressão ZERO.
--   (b) Etapas op/fin legadas permanecem board_id=NULL.
--   (c) Checklist/gate NÃO se aplica a boards custom na v1 (sub-fluxos puros).
--
-- FINANCEIRO: permanece board reservado (kind='fin' + funil sentinela +
--   requireModule('financeiro')). NÃO vira linha aqui.
--
-- system_cases NÃO é tocada → view system_cases_active permanece INTACTA.
-- Aplicar via: npx tsx scripts/db-apply-pg.ts supabase/migrations/20260804000004_pipeline_boards.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) system_pipeline_boards — boards/listas por tema (service_type)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_pipeline_boards (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  service_type_id  UUID NOT NULL REFERENCES system_service_types(id) ON DELETE CASCADE,
  slug             TEXT NOT NULL,
  label            TEXT NOT NULL,                      -- EDITÁVEL (renomear board)
  ordem            INT  NOT NULL DEFAULT 0,
  is_principal     BOOLEAN NOT NULL DEFAULT FALSE,     -- board principal (espelho do op)
  kind             TEXT,                               -- reservado: NULL=custom; 'op'/'fin' futuros
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- slug único por tema (entre os não-excluídos) — tombstone ao soft-delete libera o slug.
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_pipeline_boards_slug
  ON system_pipeline_boards(service_type_id, slug) WHERE deleted_at IS NULL;

-- NO MÁXIMO 1 board principal ATIVO por service_type.
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_pipeline_boards_principal
  ON system_pipeline_boards(service_type_id) WHERE is_principal AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_pipeline_boards_lookup
  ON system_pipeline_boards(service_type_id, ordem) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_system_pipeline_boards_updated_at ON system_pipeline_boards;
CREATE TRIGGER trg_system_pipeline_boards_updated_at
  BEFORE UPDATE ON system_pipeline_boards
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_pipeline_boards_active AS
  SELECT * FROM system_pipeline_boards WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2) system_pipeline_stages.board_id (aditivo, NULL = etapa op/fin legada)
-- ----------------------------------------------------------------------------
ALTER TABLE system_pipeline_stages
  ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES system_pipeline_boards(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_system_pipeline_stages_board
  ON system_pipeline_stages(board_id, ordem) WHERE deleted_at IS NULL AND board_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3) system_case_board_positions — posição do caso em cada board EXTRA (custom)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_board_positions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id          UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,
  board_id         UUID NOT NULL REFERENCES system_pipeline_boards(id) ON DELETE CASCADE,
  stage_id         UUID REFERENCES system_pipeline_stages(id),  -- etapa atual no board
  stage_slug       TEXT,                                        -- dual-write leve (espelha stage_id)
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- Um caso ocupa NO MÁXIMO uma etapa por board.
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_case_board_positions
  ON system_case_board_positions(case_id, board_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_case_board_positions_board
  ON system_case_board_positions(board_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_case_board_positions_case
  ON system_case_board_positions(case_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_system_case_board_positions_updated_at ON system_case_board_positions;
CREATE TRIGGER trg_system_case_board_positions_updated_at
  BEFORE UPDATE ON system_case_board_positions
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_case_board_positions_active AS
  SELECT * FROM system_case_board_positions WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4) Seed idempotente do board PRINCIPAL por tema (service_type)
--    1 board is_principal=true por service_type ativo. NÃO cria etapas (o
--    principal espelha as etapas op existentes). label = nome do tipo/tema.
--    Ignora o funil sentinela global (não tem esteira op própria).
-- ----------------------------------------------------------------------------
INSERT INTO system_pipeline_boards (organization_id, service_type_id, slug, label, ordem, is_principal)
SELECT st.organization_id, st.id, 'principal', st.name, 0, TRUE
FROM system_service_types st
WHERE st.deleted_at IS NULL
  AND st.id <> '00000000-0000-0000-0000-0000000000f0'  -- GLOBAL_FUNNEL_SERVICE_TYPE_ID (sentinela)
  AND NOT EXISTS (
    SELECT 1 FROM system_pipeline_boards b
    WHERE b.service_type_id = st.id AND b.is_principal AND b.deleted_at IS NULL
  );

-- ----------------------------------------------------------------------------
-- 5) RLS + Grants (por org — molde s13_espinha)
-- ----------------------------------------------------------------------------
ALTER TABLE system_pipeline_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_pipeline_boards_select ON system_pipeline_boards;
DROP POLICY IF EXISTS system_pipeline_boards_insert ON system_pipeline_boards;
DROP POLICY IF EXISTS system_pipeline_boards_update ON system_pipeline_boards;
DROP POLICY IF EXISTS system_pipeline_boards_delete ON system_pipeline_boards;
CREATE POLICY system_pipeline_boards_select ON system_pipeline_boards FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_pipeline_boards_insert ON system_pipeline_boards FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_pipeline_boards_update ON system_pipeline_boards FOR UPDATE USING (organization_id = system_current_organization_id()) WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_pipeline_boards_delete ON system_pipeline_boards FOR DELETE USING (organization_id = system_current_organization_id());

ALTER TABLE system_case_board_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_case_board_positions_select ON system_case_board_positions;
DROP POLICY IF EXISTS system_case_board_positions_insert ON system_case_board_positions;
DROP POLICY IF EXISTS system_case_board_positions_update ON system_case_board_positions;
DROP POLICY IF EXISTS system_case_board_positions_delete ON system_case_board_positions;
CREATE POLICY system_case_board_positions_select ON system_case_board_positions FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_case_board_positions_insert ON system_case_board_positions FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_board_positions_update ON system_case_board_positions FOR UPDATE USING (organization_id = system_current_organization_id()) WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_board_positions_delete ON system_case_board_positions FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_pipeline_boards, system_case_board_positions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_pipeline_boards, system_case_board_positions TO anon, authenticated;
GRANT SELECT ON system_pipeline_boards_active, system_case_board_positions_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6) Auditoria
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_pipeline_boards ON system_pipeline_boards;
CREATE TRIGGER trg_audit_pipeline_boards AFTER INSERT OR UPDATE OR DELETE ON system_pipeline_boards FOR EACH ROW EXECUTE FUNCTION system_fn_audit();
DROP TRIGGER IF EXISTS trg_audit_case_board_positions ON system_case_board_positions;
CREATE TRIGGER trg_audit_case_board_positions AFTER INSERT OR UPDATE OR DELETE ON system_case_board_positions FOR EACH ROW EXECUTE FUNCTION system_fn_audit();
