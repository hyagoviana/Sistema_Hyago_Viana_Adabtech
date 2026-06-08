-- ============================================================================
-- Sistema HV — Migration 0014 — S12 backend: numeração segura + templates + dedupe
-- ----------------------------------------------------------------------------
-- Incorpora BLOCKERs da revisão (Architect/QA):
--   B3 — numeração de documento concorrente (advisory lock + UNIQUE)
--   B4 — idempotência de webhook (system_webhook_dedupe, ADR-005 materializado)
-- + S12-3 — system_document_templates (modelos por tipo) + FK em case_documents.
-- Aditiva: não altera/remove nada existente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- B3 — Numeração por caso à prova de corrida
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_fn_case_document_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.document_number IS NULL THEN
    -- Serializa inserts concorrentes do MESMO caso (lock por caso, escopo da transação).
    PERFORM pg_advisory_xact_lock(hashtext(NEW.case_id::text));
    SELECT COALESCE(MAX(document_number), 0) + 1
      INTO NEW.document_number
      FROM system_case_documents
     WHERE case_id = NEW.case_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Barreira dura contra duplicação (inclui soft-deleted: número nunca é reusado).
CREATE UNIQUE INDEX IF NOT EXISTS system_case_documents_case_number_unique
  ON system_case_documents(case_id, document_number);

-- ----------------------------------------------------------------------------
-- S12-3 — system_document_templates (modelos de documento por tipo de serviço)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_document_templates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  name                TEXT NOT NULL,
  -- Transitório: linka ao case_type atual; migra p/ service_type_id na Fase A (S14-4).
  case_type           TEXT,

  -- Google Doc base (modelo com placeholders <campo>), na conta-sistema OAuth.
  google_doc_id       TEXT NOT NULL,

  -- Definição dos campos: [{ key, label, source:'auto'|'manual'|'blank', required:bool, auto_field?:text }]
  fields              JSONB NOT NULL DEFAULT '[]'::jsonb,

  goes_to_zapsign     BOOLEAN NOT NULL DEFAULT FALSE,
  active              BOOLEAN NOT NULL DEFAULT TRUE,

  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_system_document_templates_org
  ON system_document_templates(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_document_templates_case_type
  ON system_document_templates(case_type) WHERE deleted_at IS NULL AND active = TRUE;

CREATE TRIGGER trg_system_document_templates_updated_at
  BEFORE UPDATE ON system_document_templates
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_document_templates_active AS
  SELECT * FROM system_document_templates WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_audit_document_templates ON system_document_templates;
CREATE TRIGGER trg_audit_document_templates
  AFTER INSERT OR UPDATE OR DELETE ON system_document_templates
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

-- FK que faltava em system_case_documents.template_id (criada sem FK no DOC-1)
ALTER TABLE system_case_documents
  DROP CONSTRAINT IF EXISTS fk_case_documents_template;
ALTER TABLE system_case_documents
  ADD CONSTRAINT fk_case_documents_template
  FOREIGN KEY (template_id) REFERENCES system_document_templates(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE system_document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_document_templates_select_own_org ON system_document_templates
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_document_templates_insert_own_org ON system_document_templates
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_document_templates_update_own_org ON system_document_templates
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_document_templates_delete_own_org ON system_document_templates
  FOR DELETE USING (organization_id = system_current_organization_id());

-- Grants
GRANT ALL ON TABLE system_document_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_document_templates TO anon, authenticated;
GRANT SELECT ON system_document_templates_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- B4 — Dedupe de webhooks (idempotência; ADR-005 materializado)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_webhook_dedupe (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider      TEXT NOT NULL,            -- 'zapsign' | 'conta_azul' | 'asaas' | ...
  external_id   TEXT NOT NULL,            -- token do doc / id do evento
  event_type    TEXT,
  payload       JSONB,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_system_webhook_dedupe_provider
  ON system_webhook_dedupe(provider, received_at DESC);

-- Só o backend (service_role) escreve/lê — sem RLS p/ anon/authenticated.
GRANT ALL ON TABLE system_webhook_dedupe TO service_role;
