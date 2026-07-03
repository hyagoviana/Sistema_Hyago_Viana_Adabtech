-- Rollback S5-01 — Etapas comerciais (kind='comercial').
-- Remove seed comercial, recria system_cases_active SEM as 2 colunas comerciais
-- (preservando as demais + grants), restaura a projeção sem o bloco comercial e o
-- trigger sem macrostatus_comercial, dropa índice/colunas e restaura o CHECK de kind.
-- NÃO recria trg_system_cases_bifurcacao.

-- 1) Remover o seed das etapas comerciais.
DELETE FROM system_pipeline_stages WHERE kind = 'comercial';

-- 2) Recriar a view SEM macrostatus_comercial/stage_comercial_id.
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

-- 3) Restaurar a projeção sem o bloco comercial.
CREATE OR REPLACE FUNCTION system_fn_sync_stage_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.service_type_id IS NULL AND NEW.case_type IS NOT NULL THEN
    SELECT id INTO NEW.service_type_id FROM system_service_types
     WHERE organization_id = NEW.organization_id AND slug = NEW.case_type AND deleted_at IS NULL;
  END IF;

  IF NEW.service_type_id IS NOT NULL AND NEW.macrostatus_op IS NOT NULL THEN
    SELECT id INTO NEW.stage_op_id FROM system_pipeline_stages
     WHERE service_type_id = NEW.service_type_id AND kind = 'op' AND slug = NEW.macrostatus_op AND deleted_at IS NULL;
  END IF;

  IF NEW.service_type_id IS NOT NULL AND NEW.macrostatus_fin IS NOT NULL AND NEW.macrostatus_fin <> 'NAO_APLICAVEL' THEN
    SELECT id INTO NEW.stage_fin_id FROM system_pipeline_stages
     WHERE service_type_id = NEW.service_type_id AND kind = 'fin' AND slug = NEW.macrostatus_fin AND deleted_at IS NULL;
  ELSE
    NEW.stage_fin_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_cases_sync_stages ON system_cases;
CREATE TRIGGER trg_system_cases_sync_stages
  BEFORE INSERT OR UPDATE OF case_type, macrostatus_op, macrostatus_fin, service_type_id ON system_cases
  FOR EACH ROW EXECUTE FUNCTION system_fn_sync_stage_ids();

-- 4) Dropar índice + colunas.
DROP INDEX IF EXISTS idx_system_cases_stage_comercial;
ALTER TABLE system_cases DROP COLUMN IF EXISTS stage_comercial_id;
ALTER TABLE system_cases DROP COLUMN IF EXISTS macrostatus_comercial;

-- 5) Restaurar o CHECK de kind (sem 'comercial').
ALTER TABLE system_pipeline_stages
  DROP CONSTRAINT IF EXISTS system_pipeline_stages_kind_check;
ALTER TABLE system_pipeline_stages
  ADD CONSTRAINT system_pipeline_stages_kind_check
  CHECK (kind IN ('op', 'fin'));
