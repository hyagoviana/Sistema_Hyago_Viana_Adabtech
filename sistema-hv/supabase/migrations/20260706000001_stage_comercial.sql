-- ============================================================================
-- Sistema HV — Migration — S5-01 — Etapas comerciais (kind='comercial')
-- ----------------------------------------------------------------------------
-- Adiciona a 3ª esteira (kind='comercial') ao mesmo mecanismo de op/fin:
--   1) Estende o CHECK de system_pipeline_stages.kind p/ incluir 'comercial'.
--   2) system_cases ganha macrostatus_comercial + stage_comercial_id (+ índice).
--   3) system_fn_sync_stage_ids projeta macrostatus_comercial -> stage_comercial_id
--      (guarda por NULL; ELSE NULL), e o trigger passa a disparar em UPDATE
--      de macrostatus_comercial.
--   4) RECRIA system_cases_active (DROP+CREATE) copiando a definição vigente
--      (20260703000004) e ACRESCENTANDO macrostatus_comercial + stage_comercial_id.
--   5) Seed idempotente das etapas comerciais default por tipo de serviço.
--
-- REGRA DE OURO 2: TOCA system_cases → RECRIA system_cases_active preservando
-- TODAS as colunas + grants (anon, authenticated, service_role).
-- REGRA DE OURO 6: NÃO recria trg_system_cases_bifurcacao (permanece dropado).
-- Aplicável idempotentemente.
-- ============================================================================

-- 1) Estender o CHECK de kind (constraint inline auto-nomeada -> DROP + ADD nomeada).
ALTER TABLE system_pipeline_stages
  DROP CONSTRAINT IF EXISTS system_pipeline_stages_kind_check;
ALTER TABLE system_pipeline_stages
  ADD CONSTRAINT system_pipeline_stages_kind_check
  CHECK (kind IN ('op', 'fin', 'comercial'));

-- 2) Colunas no caso (dual-write; macrostatus_comercial é a fonte, projeção preenche o id).
ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS macrostatus_comercial TEXT;
ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS stage_comercial_id UUID REFERENCES system_pipeline_stages(id);

CREATE INDEX IF NOT EXISTS idx_system_cases_stage_comercial
  ON system_cases(stage_comercial_id) WHERE deleted_at IS NULL;

-- 3) Estender a projeção macrostatus_* -> stage_* (acrescenta o bloco comercial).
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

  IF NEW.service_type_id IS NOT NULL AND NEW.macrostatus_comercial IS NOT NULL THEN
    SELECT id INTO NEW.stage_comercial_id FROM system_pipeline_stages
     WHERE service_type_id = NEW.service_type_id AND kind = 'comercial' AND slug = NEW.macrostatus_comercial AND deleted_at IS NULL;
  ELSE
    NEW.stage_comercial_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_cases_sync_stages ON system_cases;
CREATE TRIGGER trg_system_cases_sync_stages
  BEFORE INSERT OR UPDATE OF case_type, macrostatus_op, macrostatus_fin, macrostatus_comercial, service_type_id ON system_cases
  FOR EACH ROW EXECUTE FUNCTION system_fn_sync_stage_ids();

-- 4) Recriar system_cases_active copiando a definição vigente (20260703000004)
--    e ACRESCENTANDO macrostatus_comercial + stage_comercial_id.
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

-- 5) Seed idempotente das etapas comerciais default por tipo de serviço ativo.
--    NOVO -> EM_CONTATO -> PROPOSTA_ENVIADA -> AGUARDANDO_ASSINATURA -> GANHO -> PERDIDO.
INSERT INTO system_pipeline_stages (organization_id, service_type_id, kind, slug, label, ordem, stage_role)
SELECT st.organization_id, st.id, s.kind, s.slug, s.label, s.ordem, s.stage_role
FROM system_service_types st
CROSS JOIN (VALUES
  ('comercial','NOVO','Novo',0,'normal'),
  ('comercial','EM_CONTATO','Em contato',1,'normal'),
  ('comercial','PROPOSTA_ENVIADA','Proposta enviada',2,'normal'),
  ('comercial','AGUARDANDO_ASSINATURA','Aguardando assinatura',3,'normal'),
  ('comercial','GANHO','Ganho',4,'won'),
  ('comercial','PERDIDO','Perdido',5,'lost')
) AS s(kind, slug, label, ordem, stage_role)
WHERE st.deleted_at IS NULL
ON CONFLICT (service_type_id, kind, slug) DO NOTHING;
