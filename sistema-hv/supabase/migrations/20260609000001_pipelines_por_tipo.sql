-- ============================================================================
-- Sistema HV — Migration 0017 — Pipelines operacionais POR TIPO (docs de fluxo)
-- ----------------------------------------------------------------------------
-- Substitui as etapas operacionais GENÉRICAS (ONBOARDING/ANALISE/CONFERENCIA/…)
-- pelas etapas REAIS de cada tipo de serviço, conforme os POPs:
--   • FIES_DGM (ESF/DGM): inclui a etapa DGM_ENVIADA
--   • FIES_ESF (ESF/Portaria): igual, sem DGM
--   • COVID: sem TRIAGEM (triagem é pré-contratual); judicial é regra
--   • MAIS_MEDICOS / RESIDENCIA / CFM_CRM: fluxo administrativo padrão
--
-- A infra já era configurável (S13: system_pipeline_stages por service_type_id);
-- aqui apenas corrigimos os DADOS por tipo + migramos os casos existentes.
--
-- Relaxa o CHECK de macrostatus_op (as etapas agora são configuráveis por tipo —
-- a validação passa a ser as próprias etapas + camada de aplicação; coerente com
-- o dual-write do ADR-007). O fluxo financeiro NÃO é alterado nesta migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Relaxar o CHECK fixo de macrostatus_op (novos slugs por tipo)
-- ----------------------------------------------------------------------------
ALTER TABLE system_cases DROP CONSTRAINT IF EXISTS system_cases_macrostatus_op_check;

-- ----------------------------------------------------------------------------
-- 2) Upsert das etapas operacionais corretas por tipo
--    (cria as novas; atualiza label/ordem/role das mantidas; revive se soft-del)
-- ----------------------------------------------------------------------------
INSERT INTO system_pipeline_stages
  (organization_id, service_type_id, kind, slug, label, ordem, stage_role)
SELECT st.organization_id, st.id, 'op', t.slug, t.label, t.ordem, t.role
FROM system_service_types st
JOIN (VALUES
  -- FIES_DGM (ESF/DGM) — com subfluxo DGM
  ('FIES_DGM','ONBOARDING','Onboarding',0,'normal'),
  ('FIES_DGM','TRIAGEM','Triagem',1,'normal'),
  ('FIES_DGM','DOCS_PENDENTES','Documentos pendentes',2,'normal'),
  ('FIES_DGM','DGM_ENVIADA','DGM enviada',3,'normal'),
  ('FIES_DGM','PRONTO_PROTOCOLO','Pronto p/ protocolo',4,'normal'),
  ('FIES_DGM','ACOMPANHAMENTO_ADM','Acompanhamento adm.',5,'normal'),
  ('FIES_DGM','JUDICIAL_OPERACIONAL','Judicial',6,'normal'),
  ('FIES_DGM','IMPLANTADO','Implantado',7,'won'),
  ('FIES_DGM','ENCERRADO_OPERACIONAL','Encerrado',8,'closed'),
  ('FIES_DGM','CANCELADO','Cancelado',9,'lost'),
  -- FIES_ESF (ESF/Portaria) — sem DGM
  ('FIES_ESF','ONBOARDING','Onboarding',0,'normal'),
  ('FIES_ESF','TRIAGEM','Triagem',1,'normal'),
  ('FIES_ESF','DOCS_PENDENTES','Documentos pendentes',2,'normal'),
  ('FIES_ESF','PRONTO_PROTOCOLO','Pronto p/ protocolo',3,'normal'),
  ('FIES_ESF','ACOMPANHAMENTO_ADM','Acompanhamento adm.',4,'normal'),
  ('FIES_ESF','JUDICIAL_OPERACIONAL','Judicial',5,'normal'),
  ('FIES_ESF','IMPLANTADO','Implantado',6,'won'),
  ('FIES_ESF','ENCERRADO_OPERACIONAL','Encerrado',7,'closed'),
  ('FIES_ESF','CANCELADO','Cancelado',8,'lost'),
  -- COVID — sem triagem; judicial é regra
  ('COVID','ONBOARDING','Onboarding',0,'normal'),
  ('COVID','DOCS_PENDENTES','Documentos pendentes',1,'normal'),
  ('COVID','PRONTO_PROTOCOLO','Pronto p/ protocolo',2,'normal'),
  ('COVID','ACOMPANHAMENTO_ADM','Acompanhamento adm.',3,'normal'),
  ('COVID','JUDICIAL_OPERACIONAL','Judicial',4,'normal'),
  ('COVID','IMPLANTADO','Implantado',5,'won'),
  ('COVID','ENCERRADO_OPERACIONAL','Encerrado',6,'closed'),
  ('COVID','CANCELADO','Cancelado',7,'lost'),
  -- MAIS_MEDICOS — fluxo administrativo padrão
  ('MAIS_MEDICOS','ONBOARDING','Onboarding',0,'normal'),
  ('MAIS_MEDICOS','TRIAGEM','Triagem',1,'normal'),
  ('MAIS_MEDICOS','DOCS_PENDENTES','Documentos pendentes',2,'normal'),
  ('MAIS_MEDICOS','PRONTO_PROTOCOLO','Pronto p/ protocolo',3,'normal'),
  ('MAIS_MEDICOS','ACOMPANHAMENTO_ADM','Acompanhamento adm.',4,'normal'),
  ('MAIS_MEDICOS','JUDICIAL_OPERACIONAL','Judicial',5,'normal'),
  ('MAIS_MEDICOS','IMPLANTADO','Implantado',6,'won'),
  ('MAIS_MEDICOS','ENCERRADO_OPERACIONAL','Encerrado',7,'closed'),
  ('MAIS_MEDICOS','CANCELADO','Cancelado',8,'lost'),
  -- RESIDENCIA — fluxo administrativo padrão
  ('RESIDENCIA','ONBOARDING','Onboarding',0,'normal'),
  ('RESIDENCIA','TRIAGEM','Triagem',1,'normal'),
  ('RESIDENCIA','DOCS_PENDENTES','Documentos pendentes',2,'normal'),
  ('RESIDENCIA','PRONTO_PROTOCOLO','Pronto p/ protocolo',3,'normal'),
  ('RESIDENCIA','ACOMPANHAMENTO_ADM','Acompanhamento adm.',4,'normal'),
  ('RESIDENCIA','JUDICIAL_OPERACIONAL','Judicial',5,'normal'),
  ('RESIDENCIA','IMPLANTADO','Implantado',6,'won'),
  ('RESIDENCIA','ENCERRADO_OPERACIONAL','Encerrado',7,'closed'),
  ('RESIDENCIA','CANCELADO','Cancelado',8,'lost'),
  -- CFM_CRM — fluxo administrativo padrão
  ('CFM_CRM','ONBOARDING','Onboarding',0,'normal'),
  ('CFM_CRM','TRIAGEM','Triagem',1,'normal'),
  ('CFM_CRM','DOCS_PENDENTES','Documentos pendentes',2,'normal'),
  ('CFM_CRM','PRONTO_PROTOCOLO','Pronto p/ protocolo',3,'normal'),
  ('CFM_CRM','ACOMPANHAMENTO_ADM','Acompanhamento adm.',4,'normal'),
  ('CFM_CRM','JUDICIAL_OPERACIONAL','Judicial',5,'normal'),
  ('CFM_CRM','IMPLANTADO','Implantado',6,'won'),
  ('CFM_CRM','ENCERRADO_OPERACIONAL','Encerrado',7,'closed'),
  ('CFM_CRM','CANCELADO','Cancelado',8,'lost')
) AS t(service_slug, slug, label, ordem, role)
  ON t.service_slug = st.slug
WHERE st.deleted_at IS NULL
ON CONFLICT (service_type_id, kind, slug) DO UPDATE
  SET label = EXCLUDED.label,
      ordem = EXCLUDED.ordem,
      stage_role = EXCLUDED.stage_role,
      active = TRUE,
      deleted_at = NULL;

-- ----------------------------------------------------------------------------
-- 3) Migrar macrostatus_op dos casos existentes p/ os novos slugs
--    (o trigger system_fn_sync_stage_ids reaponta stage_op_id automaticamente)
-- ----------------------------------------------------------------------------
UPDATE system_cases SET macrostatus_op = CASE macrostatus_op
    WHEN 'ANALISE'             THEN 'TRIAGEM'
    WHEN 'CONFERENCIA'         THEN 'DOCS_PENDENTES'
    WHEN 'PRONTO_AJUIZAR'      THEN 'PRONTO_PROTOCOLO'
    WHEN 'EM_ANDAMENTO'        THEN 'ACOMPANHAMENTO_ADM'
    WHEN 'AGUARDANDO_DECISAO'  THEN 'ACOMPANHAMENTO_ADM'
    WHEN 'IMPLANTACAO_PARCIAL' THEN 'IMPLANTADO'
    WHEN 'ENCERRADO'           THEN 'ENCERRADO_OPERACIONAL'
    ELSE macrostatus_op  -- ONBOARDING, IMPLANTADO, CANCELADO permanecem
  END
WHERE deleted_at IS NULL
  AND macrostatus_op IN
    ('ANALISE','CONFERENCIA','PRONTO_AJUIZAR','EM_ANDAMENTO',
     'AGUARDANDO_DECISAO','IMPLANTACAO_PARCIAL','ENCERRADO');

-- 3b) COVID não tem TRIAGEM: quem foi mapeado p/ TRIAGEM cai em DOCS_PENDENTES
UPDATE system_cases
   SET macrostatus_op = 'DOCS_PENDENTES'
 WHERE deleted_at IS NULL
   AND case_type = 'COVID'
   AND macrostatus_op = 'TRIAGEM';

-- ----------------------------------------------------------------------------
-- 4) Aposentar (soft-delete) as etapas operacionais genéricas obsoletas
--    Seguro: nenhum caso aponta mais p/ elas após o passo 3.
-- ----------------------------------------------------------------------------
UPDATE system_pipeline_stages
   SET deleted_at = NOW()
 WHERE kind = 'op'
   AND deleted_at IS NULL
   AND slug IN
    ('ANALISE','CONFERENCIA','PRONTO_AJUIZAR','EM_ANDAMENTO',
     'AGUARDANDO_DECISAO','IMPLANTACAO_PARCIAL','ENCERRADO');
