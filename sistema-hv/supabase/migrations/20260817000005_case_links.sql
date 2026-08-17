-- ============================================================================
-- #13 (melhorias 2026-08-17) — CASOS VINCULADOS (link manual entre casos)
-- ----------------------------------------------------------------------------
-- Painel "Casos vinculados" na ficha: o usuário liga um caso a outro(s) e vê um
-- espelho (cliente, tema, etapa, dias no estado); clicar abre o caso vinculado.
-- Vínculo DIRECIONADO (case_id → linked_case_id); a leitura mostra os dois lados.
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_case_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id          UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,
  linked_case_id   UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES system_users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, linked_case_id),
  CONSTRAINT system_case_links_no_self CHECK (case_id <> linked_case_id)
);

CREATE INDEX IF NOT EXISTS idx_case_links_case ON system_case_links(case_id);
CREATE INDEX IF NOT EXISTS idx_case_links_linked ON system_case_links(linked_case_id);
CREATE INDEX IF NOT EXISTS idx_case_links_org ON system_case_links(organization_id);

ALTER TABLE system_case_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_links_select ON system_case_links
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY case_links_insert ON system_case_links
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY case_links_delete ON system_case_links
  FOR DELETE USING (organization_id = system_current_organization_id());
CREATE POLICY case_links_service ON system_case_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, DELETE ON system_case_links TO authenticated;
GRANT ALL ON system_case_links TO service_role;
