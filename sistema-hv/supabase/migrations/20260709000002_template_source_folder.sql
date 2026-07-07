-- ============================================================================
-- Sistema HV — Migration — ITEM 4 (2026-07-07) — source_folder_id em templates
-- ----------------------------------------------------------------------------
-- O caminho "Documento de caso" do popup de geração passa a ser em 2 passos:
--   passo 1 = escolher 1 das 6 PASTAS do Drive (por NOME);
--   passo 2 = listar só os documentos DAQUELA pasta.
-- Para isso cada modelo guarda a pasta de origem (Drive folder id) de onde o
-- sync o leu. `source_folder_id` é gravado por syncTemplatesFromDrive.
--
-- Nullable: modelos antigos (procuração, tipos legados) ficam NULL e seguem no
-- fluxo por case_type. O seletor de pastas do "Documento de caso" filtra por
-- source_folder_id (só as 6 pastas configuradas).
--
-- REGRA DE OURO: NÃO toca system_cases. A view active de templates é
-- column-enumerated (não SELECT *), então recriamos incluindo a coluna nova.
-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   CREATE OR REPLACE VIEW system_document_templates_active AS
--     SELECT id, organization_id, name, case_type, google_doc_id, fields,
--            goes_to_zapsign, active, created_by, created_at, updated_at, deleted_at
--     FROM system_document_templates WHERE deleted_at IS NULL;
--   ALTER TABLE system_document_templates DROP COLUMN IF EXISTS source_folder_id;
--   GRANT SELECT ON system_document_templates_active TO anon, authenticated, service_role;
-- ============================================================================

ALTER TABLE system_document_templates
  ADD COLUMN IF NOT EXISTS source_folder_id TEXT;

CREATE OR REPLACE VIEW system_document_templates_active AS
  SELECT
    id,
    organization_id,
    name,
    case_type,
    google_doc_id,
    fields,
    goes_to_zapsign,
    active,
    created_by,
    created_at,
    updated_at,
    deleted_at,
    source_folder_id
  FROM system_document_templates
  WHERE deleted_at IS NULL;

GRANT SELECT ON system_document_templates_active TO anon, authenticated, service_role;
