-- ============================================================================
-- Sistema HV — Migration — S9-01 — procuracao_assinada_at + redefinir CHECK de
-- assinatura (agora = CONTRATO) + recriar system_cases_active expondo o carimbo.
-- ----------------------------------------------------------------------------
-- Modelo definitivo Lead→Comercial→Operacional (Sprint 9):
--   - procuracao_assinada_at = PROCURAÇÃO assinada (evento COMERCIAL). SEGUE LEAD.
--   - assinatura_liberada_at = CONTRATO do caso assinado (evento OPERACIONAL).
--     Vira CLIENTE (ou PERDIDO). Semântica REDEFINIDA nesta migration.
--
-- O CHECK system_cases_assinatura_lifecycle_chk MANTÉM a expressão
--   (assinatura_liberada_at IS NULL OR lifecycle <> 'LEAD'),
-- mas agora significa "contrato assinado ⇒ não pode ser LEAD" (regra CORRETA do
-- modelo novo). NENHUM CHECK prende procuracao_assinada_at ao lifecycle
-- (procuração assinada convive com LEAD).
--
-- REGRA DE OURO 2: TOCA system_cases → RECRIA system_cases_active (DROP+CREATE)
--   copiando a definição VIGENTE (20260706000001_stage_comercial.sql, enumerada,
--   com macrostatus_comercial/stage_comercial_id) e ACRESCENTANDO
--   procuracao_assinada_at. Preserva TODAS as colunas + grants (anon,
--   authenticated, service_role).
-- REGRA DE OURO 6: NÃO recria trg_system_cases_bifurcacao (permanece dropado).
-- Aplicável idempotentemente (rodar 2x sem erro).
-- ============================================================================

-- 1) Coluna nova — carimbo comercial da procuração (nullable, não prende lifecycle).
ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS procuracao_assinada_at TIMESTAMPTZ;

COMMENT ON COLUMN system_cases.procuracao_assinada_at IS
  'S9-01: PROCURAÇÃO assinada (evento comercial). Convive com lifecycle=LEAD — '
  'NÃO promove a CLIENTE. Distinto de assinatura_liberada_at (contrato).';

-- 2) Redefinir o CHECK de assinatura → agora significa CONTRATO assinado.
--    A expressão NÃO muda; muda o SIGNIFICADO de assinatura_liberada_at.
--    NOT VALID + VALIDATE: reprova a migration explicitamente se houver dado
--    divergente (nenhum LEAD com assinatura_liberada_at NOT NULL — hoje verdade).
ALTER TABLE system_cases
  DROP CONSTRAINT IF EXISTS system_cases_assinatura_lifecycle_chk;
ALTER TABLE system_cases
  ADD CONSTRAINT system_cases_assinatura_lifecycle_chk
  CHECK (assinatura_liberada_at IS NULL OR lifecycle <> 'LEAD') NOT VALID;
ALTER TABLE system_cases
  VALIDATE CONSTRAINT system_cases_assinatura_lifecycle_chk;

COMMENT ON COLUMN system_cases.assinatura_liberada_at IS
  'S9-01: CONTRATO do caso assinado (evento operacional) ⇒ lifecycle <> LEAD '
  '(CLIENTE/PERDIDO). Semântica redefinida na Sprint 9 (antes: procuração).';

-- 3) Índice parcial p/ consultas por procuração assinada (casos vivos).
CREATE INDEX IF NOT EXISTS idx_system_cases_procuracao_assinada
  ON system_cases(procuracao_assinada_at) WHERE deleted_at IS NULL;

-- 4) Recriar system_cases_active copiando a definição VIGENTE
--    (20260706000001_stage_comercial.sql) e ACRESCENTANDO procuracao_assinada_at.
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
