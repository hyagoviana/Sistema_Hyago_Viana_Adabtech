-- Integração Conta Azul:
-- 1) Campo contaazul_customer_id em system_clients
-- 2) Tabela system_integrations para armazenar tokens OAuth2

-- Campo no cliente
ALTER TABLE system_clients
  ADD COLUMN IF NOT EXISTS contaazul_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_contaazul_customer_id
  ON system_clients (contaazul_customer_id)
  WHERE contaazul_customer_id IS NOT NULL;

COMMENT ON COLUMN system_clients.contaazul_customer_id IS
  'ID do cliente no Conta Azul (UUID). Preenchido ao sincronizar/criar.';

-- Tabela de integrações (armazena refresh_token OAuth2 de forma segura)
CREATE TABLE IF NOT EXISTS system_integrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id),
  provider          TEXT NOT NULL,           -- 'conta_azul', 'asaas', etc.
  refresh_token     TEXT,
  access_token      TEXT,
  extra             JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, provider)
);

-- RLS
ALTER TABLE system_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON system_integrations
  FOR ALL
  USING (organization_id = current_setting('app.organization_id', true)::uuid);

COMMENT ON TABLE system_integrations IS
  'Armazena tokens OAuth2 e configurações de integrações externas (Conta Azul, Asaas, etc.).';
