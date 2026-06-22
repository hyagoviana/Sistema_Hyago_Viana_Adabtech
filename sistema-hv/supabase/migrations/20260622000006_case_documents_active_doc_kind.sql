-- ============================================================================
-- Sistema HV — Migration 0029 — Expor doc_kind na view system_case_documents_active
-- ----------------------------------------------------------------------------
-- A migration 0026 (caso_comercial) adicionou system_case_documents.doc_kind à
-- TABELA, mas a view system_case_documents_active lista colunas explicitamente e
-- não foi refeita — então doc_kind não aparecia para o front (lista de documentos
-- do caso e a nova seção "Documentos dos casos" na ficha do cliente). Recria a
-- view incluindo doc_kind (no fim, para permitir CREATE OR REPLACE).
-- ============================================================================
CREATE OR REPLACE VIEW system_case_documents_active AS
  SELECT id,
         case_id,
         organization_id,
         document_number,
         title,
         description,
         status,
         source,
         template_id,
         google_doc_id,
         drive_file_id,
         drive_url,
         mime_type,
         size_bytes,
         sha256,
         goes_to_zapsign,
         zapsign_doc_token,
         zapsign_sign_url,
         created_by,
         created_at,
         updated_at,
         deleted_at,
         doc_kind
    FROM system_case_documents
   WHERE deleted_at IS NULL;

GRANT SELECT ON system_case_documents_active TO anon, authenticated, service_role;
