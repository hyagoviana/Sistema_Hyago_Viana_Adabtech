-- ============================================================================
-- ROLLBACK — S9-01 — 20260708000001_procuracao_assinada.sql
-- ----------------------------------------------------------------------------
-- Restaura o estado anterior:
--   - dropa procuracao_assinada_at + índice;
--   - restaura o CHECK de assinatura (mesma expressão, comentário antigo);
--   - recria system_cases_active SEM procuracao_assinada_at (def de 20260706000001).
--
-- ATENÇÃO: se a S9-06 já tiver rebaixado casos p/ LEAD movendo o carimbo para
-- procuracao_assinada_at, este rollback (que dropa a coluna) perde esse dado —
-- reverta a S9-06 ANTES desta.
-- ============================================================================

-- 1) Recriar a view SEM procuracao_assinada_at (def vigente de 20260706000001).
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
    c.macrostatus_comercial,
    c.stage_comercial_id,
    cli.full_name AS client_name,
    cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
    JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;

GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;

-- 2) Restaurar o CHECK (mesma expressão; comentário anterior).
ALTER TABLE system_cases
  DROP CONSTRAINT IF EXISTS system_cases_assinatura_lifecycle_chk;
ALTER TABLE system_cases
  ADD CONSTRAINT system_cases_assinatura_lifecycle_chk
  CHECK (assinatura_liberada_at IS NULL OR lifecycle <> 'LEAD') NOT VALID;
ALTER TABLE system_cases
  VALIDATE CONSTRAINT system_cases_assinatura_lifecycle_chk;

COMMENT ON COLUMN system_cases.assinatura_liberada_at IS NULL;

-- 3) Dropar índice + coluna.
DROP INDEX IF EXISTS idx_system_cases_procuracao_assinada;
ALTER TABLE system_cases DROP COLUMN IF EXISTS procuracao_assinada_at;
