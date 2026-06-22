-- ============================================================================
-- Sistema HV — Migration 0026 — Caso em fase Comercial / Procuração (Melhoria 3)
-- ----------------------------------------------------------------------------
-- Um caso pode nascer em fase COMERCIAL: aguardando a assinatura da procuração
-- pela ZapSign. Enquanto aguarda, NÃO aparece no Kanban operacional (mesmo
-- padrão da flag `removido_do_operacional_at` — ADR-012/ADR-016, filtro no front).
-- Quando a procuração é assinada (webhook ZapSign) OU liberada manualmente
-- (usuário confirma + upload), a flag é limpa e o caso entra no funil operacional.
--   - aguardando_assinatura_at: flag de data (NULL = não está na fase comercial).
--   - assinatura_liberada_at / _by: carimbo da liberação.
--   - system_case_documents.doc_kind: identifica a procuração ('procuracao'),
--     usada pelo webhook para saber que aquela assinatura libera o caso.
-- ============================================================================

ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS aguardando_assinatura_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinatura_liberada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinatura_liberada_by UUID;

-- Índice parcial: acelera a aba Comercial (casos aguardando assinatura).
CREATE INDEX IF NOT EXISTS idx_system_cases_aguardando_assinatura
  ON system_cases(aguardando_assinatura_at)
  WHERE aguardando_assinatura_at IS NOT NULL AND deleted_at IS NULL;

-- Tipo do documento (ex.: 'procuracao'). NULL = documento comum.
ALTER TABLE system_case_documents
  ADD COLUMN IF NOT EXISTS doc_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_system_case_documents_doc_kind
  ON system_case_documents(doc_kind)
  WHERE doc_kind IS NOT NULL AND deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Refresh da view (c.* é fixado na criação — DROP+CREATE para expor as colunas
-- novas de system_cases na system_cases_active).
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS system_cases_active;
CREATE VIEW system_cases_active AS
  SELECT c.*, cli.full_name AS client_name, cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;
GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
