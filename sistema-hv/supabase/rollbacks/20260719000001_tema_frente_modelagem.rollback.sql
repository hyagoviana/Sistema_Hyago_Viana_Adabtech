-- ============================================================================
-- Rollback — R2-01 — Modelagem TEMA + FRENTE/TIPO (aditiva)
-- ----------------------------------------------------------------------------
-- Desfaz a migration 20260719000001:
--   1) Recria system_cases_active SEM tema_id/frente_slug (preservando as demais
--      41 colunas VIGENTES — mesma def de base da migration).
--   2) Dropa os índices/colunas aditivas de system_cases.
--   3) Dropa tema_id de system_service_types.
--   4) Dropa as views + tabelas system_tema_frentes / system_temas.
-- NÃO recria trg_system_cases_bifurcacao. NÃO toca trigger de dual-write nem CHECKs.
-- ============================================================================

-- 1) Recriar a view SEM as 2 colunas novas (def vigente pré-migration).
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
    c.procuracao_assinada_at,
    cli.full_name AS client_name,
    cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
    JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;

GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;

-- 2) Índices + colunas aditivas de system_cases.
DROP INDEX IF EXISTS idx_system_cases_tema;
ALTER TABLE system_cases DROP COLUMN IF EXISTS frente_slug;
ALTER TABLE system_cases DROP COLUMN IF EXISTS tema_id;

-- 3) tema_id de system_service_types.
DROP INDEX IF EXISTS idx_system_service_types_tema;
ALTER TABLE system_service_types DROP COLUMN IF EXISTS tema_id;

-- 4) Views + tabelas novas (frentes primeiro por causa da FK).
DROP VIEW IF EXISTS system_tema_frentes_active;
DROP VIEW IF EXISTS system_temas_active;
DROP TABLE IF EXISTS system_tema_frentes;
DROP TABLE IF EXISTS system_temas;
