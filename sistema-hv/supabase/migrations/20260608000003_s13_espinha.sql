-- ============================================================================
-- Sistema HV — Migration 0015 — S13 (Fase A): Espinha configurável (dual-write)
-- ----------------------------------------------------------------------------
-- Adiciona Tipos de Serviço + Etapas de pipeline (com stage_role) configuráveis,
-- FKs no caso (service_type_id, stage_op_id, stage_fin_id) e trigger de projeção
-- macrostatus_* -> stage_* (ADR-007). NÃO remove case_type/macrostatus (dual-write
-- reversível). A bifurcação automática atual permanece intacta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) system_service_types (Tipo de Serviço)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_service_types (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,          -- casa com o case_type atual (mapeamento de migração)
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  ordem            INT NOT NULL DEFAULT 0,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE (organization_id, slug)
);

CREATE TRIGGER trg_system_service_types_updated_at
  BEFORE UPDATE ON system_service_types
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_service_types_active AS
  SELECT * FROM system_service_types WHERE deleted_at IS NULL;

-- Seed dos 6 tipos atuais (slug = case_type)
INSERT INTO system_service_types (organization_id, name, slug, ordem)
SELECT '00000000-0000-0000-0000-000000000001', x.name, x.slug, x.ordem
FROM (VALUES
  ('FIES ESF',     'FIES_ESF',     0),
  ('FIES DGM',     'FIES_DGM',     1),
  ('COVID',        'COVID',        2),
  ('Mais Médicos', 'MAIS_MEDICOS', 3),
  ('Residência',   'RESIDENCIA',   4),
  ('CFM/CRM',      'CFM_CRM',      5)
) AS x(name, slug, ordem)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2) system_pipeline_stages (etapas op/fin por tipo, com stage_role)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_pipeline_stages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  service_type_id   UUID NOT NULL REFERENCES system_service_types(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('op', 'fin')),
  slug              TEXT NOT NULL,         -- casa com macrostatus_op/fin atual
  label             TEXT NOT NULL,
  stage_role        TEXT NOT NULL DEFAULT 'normal'
                      CHECK (stage_role IN ('normal', 'won', 'lost', 'closed')),
  color             TEXT,
  ordem             INT NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (service_type_id, kind, slug)
);

CREATE INDEX IF NOT EXISTS idx_system_pipeline_stages_lookup
  ON system_pipeline_stages(service_type_id, kind, ordem) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_pipeline_stages_updated_at
  BEFORE UPDATE ON system_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

CREATE OR REPLACE VIEW system_pipeline_stages_active AS
  SELECT * FROM system_pipeline_stages WHERE deleted_at IS NULL;

-- Seed: para cada tipo de serviço, clona as 10 etapas op + 12 fin atuais.
INSERT INTO system_pipeline_stages (organization_id, service_type_id, kind, slug, label, ordem, stage_role)
SELECT st.organization_id, st.id, s.kind, s.slug, s.label, s.ordem, s.stage_role
FROM system_service_types st
CROSS JOIN (VALUES
  ('op','ONBOARDING','Onboarding',0,'normal'),
  ('op','ANALISE','Análise',1,'normal'),
  ('op','CONFERENCIA','Conferência',2,'normal'),
  ('op','PRONTO_AJUIZAR','Pronto p/ ajuizar',3,'normal'),
  ('op','EM_ANDAMENTO','Em andamento',4,'normal'),
  ('op','AGUARDANDO_DECISAO','Aguardando decisão',5,'normal'),
  ('op','IMPLANTADO','Implantado',6,'won'),
  ('op','IMPLANTACAO_PARCIAL','Implantação parcial',7,'won'),
  ('op','ENCERRADO','Encerrado',8,'closed'),
  ('op','CANCELADO','Cancelado',9,'lost'),
  ('fin','NAO_APLICAVEL','—',0,'normal'),
  ('fin','ELABORANDO','Elaborando',1,'normal'),
  ('fin','APROVACAO','Aprovação',2,'normal'),
  ('fin','AGUARDANDO_ATIVACAO','Aguardando ativação',3,'normal'),
  ('fin','ATIVO','Ativo',4,'normal'),
  ('fin','QUITANDO','Quitando',5,'normal'),
  ('fin','QUITADO','Quitado',6,'closed'),
  ('fin','INADIMPLENTE','Inadimplente',7,'normal'),
  ('fin','PARCIAL','Parcial',8,'normal'),
  ('fin','RENEGOCIADO','Renegociado',9,'normal'),
  ('fin','SUSPENSO','Suspenso',10,'normal'),
  ('fin','CANCELADO','Cancelado',11,'lost')
) AS s(kind, slug, label, ordem, stage_role)
WHERE st.deleted_at IS NULL
ON CONFLICT (service_type_id, kind, slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3) FKs no caso (dual-write — macrostatus_* continuam vivos)
-- ----------------------------------------------------------------------------
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES system_service_types(id);
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS stage_op_id      UUID REFERENCES system_pipeline_stages(id);
ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS stage_fin_id     UUID REFERENCES system_pipeline_stages(id);

CREATE INDEX IF NOT EXISTS idx_system_cases_service_type ON system_cases(service_type_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_cases_stage_op ON system_cases(stage_op_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_cases_stage_fin ON system_cases(stage_fin_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4) Trigger de projeção macrostatus_* -> stage_* (ADR-007)
--    Mantém os stage_id sincronizados enquanto a UI ainda escreve macrostatus.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 5) Migração dos casos existentes (idempotente — o trigger preenche stage_*)
-- ----------------------------------------------------------------------------
UPDATE system_cases c
   SET service_type_id = st.id
  FROM system_service_types st
 WHERE st.organization_id = c.organization_id
   AND st.slug = c.case_type
   AND c.deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 6) RLS + Grants
-- ----------------------------------------------------------------------------
ALTER TABLE system_service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_service_types_select ON system_service_types FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_service_types_insert ON system_service_types FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_service_types_update ON system_service_types FOR UPDATE USING (organization_id = system_current_organization_id()) WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_service_types_delete ON system_service_types FOR DELETE USING (organization_id = system_current_organization_id());

ALTER TABLE system_pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_pipeline_stages_select ON system_pipeline_stages FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_pipeline_stages_insert ON system_pipeline_stages FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_pipeline_stages_update ON system_pipeline_stages FOR UPDATE USING (organization_id = system_current_organization_id()) WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_pipeline_stages_delete ON system_pipeline_stages FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_service_types, system_pipeline_stages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_service_types, system_pipeline_stages TO anon, authenticated;
GRANT SELECT ON system_service_types_active, system_pipeline_stages_active TO anon, authenticated, service_role;

-- Auditoria
DROP TRIGGER IF EXISTS trg_audit_service_types ON system_service_types;
CREATE TRIGGER trg_audit_service_types AFTER INSERT OR UPDATE OR DELETE ON system_service_types FOR EACH ROW EXECUTE FUNCTION system_fn_audit();
DROP TRIGGER IF EXISTS trg_audit_pipeline_stages ON system_pipeline_stages;
CREATE TRIGGER trg_audit_pipeline_stages AFTER INSERT OR UPDATE OR DELETE ON system_pipeline_stages FOR EACH ROW EXECUTE FUNCTION system_fn_audit();
