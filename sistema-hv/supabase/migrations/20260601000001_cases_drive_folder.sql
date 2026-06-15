-- Migration: adicionar colunas de pasta Drive nos casos (subpasta por processo)
-- Usado pela integração n8n → cada caso ganha sua própria pasta dentro da pasta do cliente.

ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS drive_folder_id  TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;

COMMENT ON COLUMN system_cases.drive_folder_id  IS 'ID da pasta do caso no Google Drive (subpasta dentro da pasta do cliente)';
COMMENT ON COLUMN system_cases.drive_folder_url IS 'URL webViewLink da pasta do caso no Drive';

-- Atualizar a view ativa para incluir os novos campos
DROP VIEW IF EXISTS system_cases_active;
CREATE VIEW system_cases_active AS
  SELECT
    c.*,
    cl.full_name  AS client_name,
    cl.cpf_cnpj   AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cl ON cl.id = c.client_id
  WHERE c.deleted_at IS NULL
    AND cl.deleted_at IS NULL;

-- Grants (mesmo padrão das migrations anteriores)
GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
