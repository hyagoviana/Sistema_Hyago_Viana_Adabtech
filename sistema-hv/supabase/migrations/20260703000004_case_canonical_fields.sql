-- ============================================================================
-- Sistema HV — Migration — S2-07 — Campos canônicos no CASO (JSONB)
-- ----------------------------------------------------------------------------
-- Adiciona system_cases.canonical_fields JSONB (atributos do CASO — ex.: nº FIES),
-- DISTINTO dos custom_fields de CLIENTE. Índice GIN p/ busca. Opcional.
--
-- Molde: 20260622000002_client_custom_fields.sql (coluna JSONB + índice GIN).
--
-- REGRA DE OURO 2: esta migration TOCA system_cases → RECRIA system_cases_active
-- (DROP+CREATE) preservando TODAS as colunas já expostas + grants. NÃO recria
-- trg_system_cases_bifurcacao. A view atual enumera colunas (não usa c.*), então
-- adicionamos c.canonical_fields explicitamente.
-- ============================================================================

-- 1) Coluna + índice GIN (molde idx_system_clients_custom_fields).
ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS canonical_fields JSONB;

CREATE INDEX IF NOT EXISTS idx_system_cases_canonical_fields
  ON system_cases USING GIN (canonical_fields);

-- 2) Recriar a view expondo canonical_fields + TODAS as colunas pré-existentes
--    (copiadas da definição vigente, apenas ACRESCENTANDO canonical_fields).
DROP VIEW IF EXISTS system_cases_active;
CREATE VIEW system_cases_active AS
  SELECT
    c.id,
    c.organization_id,
    c.client_id,
    c.case_code,
    c.case_type,
    c.macrostatus_op,
    c.macrostatus_fin,
    c.proximo_passo,
    c.responsavel,
    c.municipio,
    c.valor_centavos,
    c.inadimplente,
    c.status_changed_at,
    c.created_by,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    c.status_fin_changed_at,
    c.drive_folder_id,
    c.drive_folder_url,
    c.drive_sync_failed,
    c.drive_sync_error,
    c.service_type_id,
    c.stage_op_id,
    c.stage_fin_id,
    c.acerto_parcial,
    c.tem_pendencia_judicial,
    c.acerto_parcial_obs,
    c.removido_do_operacional_at,
    c.aguardando_assinatura_at,
    c.assinatura_liberada_at,
    c.assinatura_liberada_by,
    c.lifecycle,
    c.perdido_at,
    c.perdido_motivo,
    c.canonical_fields,
    cli.full_name AS client_name,
    cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
    JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;

GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
