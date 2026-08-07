-- ============================================================================
-- Sistema HV — Migration — C5: "Links úteis" / wiki por TEMA
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-05 (Story C5). ADITIVA/idempotente. Cria a tabela de "blocos
-- wiki" vinculados ao TEMA (system_temas), não ao kanban/board nem ao service_type.
--
-- MODELAGEM TRAVADA (Opção A da story):
--   1 tabela `system_tema_wiki_blocks`: um "bloco" = um quadro com TÍTULO editável
--   e uma lista de ITENS (caixinhas) em JSONB. Cada item:
--     { id, tipo: 'texto'|'link', valor: string, rotulo?: string }
--   A validação do shape do item é no SERVICE (Zod), não como CHECK no JSON.
--
-- "Salva no Drive" do levantamento = um item pode CONTER uma URL do Drive (link),
-- mas o armazenamento do bloco/itens é no Supabase (metadado). Não cria arquivo
-- no Drive por bloco.
--
-- Molde: 20260804000004_pipeline_boards.sql (RLS por org + índice + trigger
-- updated_at + view _active + grants 3 roles + audit).
-- Aplicar via: npx tsx scripts/db-apply-pg.ts supabase/migrations/20260806000002_tema_wiki_blocks.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) system_tema_wiki_blocks — quadro de links úteis / wiki por TEMA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_tema_wiki_blocks (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  tema_id          UUID NOT NULL REFERENCES system_temas(id) ON DELETE CASCADE,
  titulo           TEXT NOT NULL,                       -- EDITÁVEL ("Links úteis" / "Manuais" / "Observações")
  itens            JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ id, tipo: 'texto'|'link', valor, rotulo? }]
  ordem            INT  NOT NULL DEFAULT 0,             -- ordem do quadro entre os blocos do tema
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_system_tema_wiki_blocks_tema
  ON system_tema_wiki_blocks(tema_id, ordem) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_system_tema_wiki_blocks_updated_at ON system_tema_wiki_blocks;
CREATE TRIGGER trg_system_tema_wiki_blocks_updated_at
  BEFORE UPDATE ON system_tema_wiki_blocks
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_tema_wiki_blocks_active AS
  SELECT * FROM system_tema_wiki_blocks WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2) RLS + Grants (por org — molde pipeline_boards)
-- ----------------------------------------------------------------------------
ALTER TABLE system_tema_wiki_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_tema_wiki_blocks_select ON system_tema_wiki_blocks;
DROP POLICY IF EXISTS system_tema_wiki_blocks_insert ON system_tema_wiki_blocks;
DROP POLICY IF EXISTS system_tema_wiki_blocks_update ON system_tema_wiki_blocks;
DROP POLICY IF EXISTS system_tema_wiki_blocks_delete ON system_tema_wiki_blocks;
CREATE POLICY system_tema_wiki_blocks_select ON system_tema_wiki_blocks FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_tema_wiki_blocks_insert ON system_tema_wiki_blocks FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_tema_wiki_blocks_update ON system_tema_wiki_blocks FOR UPDATE USING (organization_id = system_current_organization_id()) WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_tema_wiki_blocks_delete ON system_tema_wiki_blocks FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_tema_wiki_blocks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_tema_wiki_blocks TO anon, authenticated;
GRANT SELECT ON system_tema_wiki_blocks_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3) Auditoria
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_tema_wiki_blocks ON system_tema_wiki_blocks;
CREATE TRIGGER trg_audit_tema_wiki_blocks AFTER INSERT OR UPDATE OR DELETE ON system_tema_wiki_blocks FOR EACH ROW EXECUTE FUNCTION system_fn_audit();
