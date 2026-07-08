-- Integração Asaas: adiciona campo asaas_customer_id em system_clients
-- para vincular o cadastro local ao cliente no Asaas.

ALTER TABLE system_clients
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- Índice para busca rápida por asaas_customer_id
CREATE INDEX IF NOT EXISTS idx_clients_asaas_customer_id
  ON system_clients (asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;

-- Comentário
COMMENT ON COLUMN system_clients.asaas_customer_id IS
  'ID do cliente no Asaas (cus_xxx). Preenchido ao sincronizar/criar no Asaas.';
