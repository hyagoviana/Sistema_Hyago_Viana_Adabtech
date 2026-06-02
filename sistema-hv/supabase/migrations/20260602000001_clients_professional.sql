-- ============================================================================
-- Sistema HV — Migration 0008 — Atributos profissionais + PF/PJ (F1 / Projeto 1)
-- ----------------------------------------------------------------------------
-- Escopo mínimo P1 item 1: atributos profissionais ESTRUTURADOS (CRM, OAB,
-- vínculo institucional, programa governamental, residência) + distinção PF/PJ.
--   - person_type:        coluna derivada do tamanho do CPF/CNPJ canônico.
--   - professional_data:  JSONB validado na aplicação por Zod (extensível — o
--                         escopo prevê "e outros" atributos).
-- ============================================================================

ALTER TABLE system_clients
  ADD COLUMN IF NOT EXISTS person_type TEXT
    CHECK (person_type IS NULL OR person_type IN ('PF', 'PJ')),
  ADD COLUMN IF NOT EXISTS professional_data JSONB;

-- Backfill person_type para os clientes já existentes (CNPJ = 14 dígitos → PJ).
UPDATE system_clients
  SET person_type = CASE WHEN length(cpf_cnpj) = 14 THEN 'PJ' ELSE 'PF' END
  WHERE person_type IS NULL;

-- Índice GIN para busca futura por atributos profissionais (programas, vínculo).
CREATE INDEX IF NOT EXISTS idx_system_clients_professional_data
  ON system_clients USING GIN (professional_data);

CREATE INDEX IF NOT EXISTS idx_system_clients_person_type
  ON system_clients(person_type) WHERE deleted_at IS NULL;
