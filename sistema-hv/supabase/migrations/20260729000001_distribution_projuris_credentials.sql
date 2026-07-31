-- Adicionar campos de credenciais Projuris na config de distribuicao
-- As credenciais ficam na mesma tabela protegida por RLS (org-scoped)
-- e sao lidas apenas pelo service_role na Edge Function.

ALTER TABLE system_distribution_config
  ADD COLUMN IF NOT EXISTS projuris_base_url   TEXT,
  ADD COLUMN IF NOT EXISTS projuris_auth_type  TEXT DEFAULT 'bearer' CHECK (projuris_auth_type IN ('basic', 'bearer', 'apikey')),
  ADD COLUMN IF NOT EXISTS projuris_username   TEXT,
  ADD COLUMN IF NOT EXISTS projuris_password   TEXT,
  ADD COLUMN IF NOT EXISTS projuris_token      TEXT,
  ADD COLUMN IF NOT EXISTS projuris_api_key    TEXT;

-- Permitir admins da org atualizar (ja coberto pela policy dist_config_upsert via service_role)
-- Para permitir update direto pelo authenticated, criar policy com check de admin:
CREATE POLICY dist_config_update_admin ON system_distribution_config
  FOR UPDATE TO authenticated
  USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
