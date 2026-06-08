-- ============================================================================
-- Sistema HV — Migration 0013 — Documentos do CASO + pasta Drive do caso
-- ----------------------------------------------------------------------------
-- DOC-1 (Sprint 12 - Documentos + ZapSign). Cria a base onde os documentos
-- gerados/assinados do caso são guardados (espelha system_client_documents,
-- mas vinculado ao CASO), + pasta Drive por caso + numeração por caso.
-- NÃO altera tabelas existentes (apenas adiciona colunas/objetos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Pasta Drive DO CASO (system_cases ganha as colunas, como system_clients já tem)
-- ----------------------------------------------------------------------------
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS drive_folder_id   TEXT;
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS drive_folder_url  TEXT;
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS drive_sync_failed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS drive_sync_error  VARCHAR(2000);

-- ----------------------------------------------------------------------------
-- 2) Tabela: system_case_documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_documents (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID NOT NULL REFERENCES system_cases(id) ON DELETE RESTRICT,
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  -- Numeração sequencial POR CASO (casa com o retorno do ZapSign). Gerada por trigger.
  document_number     INT,

  title               TEXT NOT NULL,
  description         TEXT,

  -- Ciclo de vida do documento
  status              TEXT NOT NULL DEFAULT 'RASCUNHO'
                        CHECK (status IN ('RASCUNHO','EM_EDICAO','FINALIZADO',
                                          'ENVIADO_ZAPSIGN','ASSINADO','CANCELADO')),
  source              TEXT NOT NULL DEFAULT 'GERADO'
                        CHECK (source IN ('GERADO','UPLOAD','ZAPSIGN')),

  -- Modelo de origem (FK adicionada no DOC-3, quando system_document_templates existir)
  template_id         UUID,

  -- Google Docs (doc editável dentro do sistema)
  google_doc_id       TEXT,

  -- Arquivo final na pasta do caso (PDF/assinado)
  drive_file_id       TEXT,
  drive_url           TEXT,
  mime_type           TEXT,
  size_bytes          BIGINT,
  sha256              TEXT,

  -- ZapSign
  goes_to_zapsign     BOOLEAN NOT NULL DEFAULT FALSE,
  zapsign_doc_token   TEXT,
  zapsign_sign_url    TEXT,

  -- Auditoria + soft-delete
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_system_case_documents_case
  ON system_case_documents(case_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_case_documents_org
  ON system_case_documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_case_documents_zapsign_token
  ON system_case_documents(zapsign_doc_token) WHERE zapsign_doc_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_case_documents_google_doc
  ON system_case_documents(google_doc_id) WHERE google_doc_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_case_documents_drive_file
  ON system_case_documents(drive_file_id);

-- updated_at
CREATE TRIGGER trg_system_case_documents_updated_at
  BEFORE UPDATE ON system_case_documents
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- Numeração sequencial por caso (DOC-01, DOC-02… dentro de cada caso)
CREATE OR REPLACE FUNCTION system_fn_case_document_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.document_number IS NULL THEN
    SELECT COALESCE(MAX(document_number), 0) + 1
      INTO NEW.document_number
      FROM system_case_documents
     WHERE case_id = NEW.case_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_system_case_documents_number
  BEFORE INSERT ON system_case_documents
  FOR EACH ROW EXECUTE FUNCTION system_fn_case_document_number();

-- View ativa
CREATE OR REPLACE VIEW system_case_documents_active AS
  SELECT * FROM system_case_documents WHERE deleted_at IS NULL;

-- Auditoria (mesmo trigger genérico das demais tabelas-núcleo)
DROP TRIGGER IF EXISTS trg_audit_case_documents ON system_case_documents;
CREATE TRIGGER trg_audit_case_documents
  AFTER INSERT OR UPDATE OR DELETE ON system_case_documents
  FOR EACH ROW EXECUTE FUNCTION system_fn_audit();

-- ----------------------------------------------------------------------------
-- 3) RLS — system_case_documents (organization-scoped, padrão do sistema)
-- ----------------------------------------------------------------------------
ALTER TABLE system_case_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_case_documents_select_own_org ON system_case_documents
  FOR SELECT USING (organization_id = system_current_organization_id());

CREATE POLICY system_case_documents_insert_own_org ON system_case_documents
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());

CREATE POLICY system_case_documents_update_own_org ON system_case_documents
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());

CREATE POLICY system_case_documents_delete_own_org ON system_case_documents
  FOR DELETE USING (organization_id = system_current_organization_id());

-- ----------------------------------------------------------------------------
-- 4) Grants (mesmo padrão da migration 0002)
-- ----------------------------------------------------------------------------
GRANT ALL ON TABLE system_case_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_case_documents TO anon, authenticated;
GRANT SELECT ON system_case_documents_active TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION system_fn_case_document_number() TO service_role;
