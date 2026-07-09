-- ============================================================================
-- Sistema HV — Migration — Renomeia FIES_DGM → "Abatimento Militar" + cria "Outros"
-- ----------------------------------------------------------------------------
-- Pedido do owner (2026-07-09), item 1 — nomes das pipelines OPERACIONAIS:
--   FIES DGM  → Abatimento Militar   (rename só do DISPLAY; slug FIES_DGM PERMANECE,
--               pois é a chave de case_type, das etapas e do filtro de templates)
--   + novo tipo "Outros" (catch-all), já com o conjunto COMPLETO de etapas
--     (op + fin + comercial). Os slugs de fin/comercial ESPELHAM o funil único
--     canônico (senão o tipo nasce quebrado no board global — ver createServiceType).
--
-- Idempotente: UPDATE por slug + ON CONFLICT DO NOTHING.
-- ============================================================================

-- 1) Rename do display (slug permanece FIES_DGM).
UPDATE system_service_types
   SET name = 'Abatimento Militar'
 WHERE slug = 'FIES_DGM'
   AND organization_id = '00000000-0000-0000-0000-000000000001';

-- 2) Novo tipo "Outros".
INSERT INTO system_service_types (organization_id, name, slug, ordem)
VALUES ('00000000-0000-0000-0000-000000000001', 'Outros', 'OUTROS', 6)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- 3) Etapas de "Outros": op (fluxo administrativo padrão) + fin/comercial
--    espelhando o conjunto canônico (mesmos slugs do funil único).
INSERT INTO system_pipeline_stages
  (organization_id, service_type_id, kind, slug, label, ordem, stage_role)
SELECT st.organization_id, st.id, t.kind, t.slug, t.label, t.ordem, t.stage_role
FROM system_service_types st
CROSS JOIN (VALUES
  -- ── Operacional ──────────────────────────────────────────────────────────
  ('op','ONBOARDING','Onboarding',0,'normal'),
  ('op','TRIAGEM','Triagem',1,'normal'),
  ('op','DOCS_PENDENTES','Documentos pendentes',2,'normal'),
  ('op','PRONTO_PROTOCOLO','Pronto p/ protocolo',3,'normal'),
  ('op','ACOMPANHAMENTO_ADM','Acompanhamento adm.',4,'normal'),
  ('op','JUDICIAL_OPERACIONAL','Judicial',5,'normal'),
  ('op','IMPLANTADO','Implantado',6,'won'),
  ('op','ENCERRADO_OPERACIONAL','Encerrado',7,'closed'),
  ('op','CANCELADO','Cancelado',8,'lost'),
  -- ── Financeiro (espelha o canônico) ──────────────────────────────────────
  ('fin','ELABORANDO','Elaborando',0,'normal'),
  ('fin','APROVACAO','Aprovação',1,'normal'),
  ('fin','AGUARDANDO_ATIVACAO','Aguardando ativação',2,'normal'),
  ('fin','ATIVO','Ativo',3,'normal'),
  ('fin','QUITANDO','Quitando',4,'normal'),
  ('fin','QUITADO','Quitado',5,'closed'),
  ('fin','INADIMPLENTE','Inadimplente',6,'normal'),
  ('fin','PARCIAL','Parcial',7,'normal'),
  ('fin','RENEGOCIADO','Renegociado',8,'normal'),
  ('fin','SUSPENSO','Suspenso',9,'normal'),
  ('fin','CANCELADO','Cancelado',10,'lost'),
  -- ── Comercial (espelha o canônico) ───────────────────────────────────────
  ('comercial','NOVO','Novo',0,'normal'),
  ('comercial','EM_CONTATO','Em contato',1,'normal'),
  ('comercial','PROPOSTA_ENVIADA','Proposta enviada',2,'normal'),
  ('comercial','AGUARDANDO_ASSINATURA','Aguardando assinatura',3,'normal'),
  ('comercial','GANHO','Ganho',4,'won'),
  ('comercial','PERDIDO','Perdido',5,'lost')
) AS t(kind, slug, label, ordem, stage_role)
WHERE st.slug = 'OUTROS'
  AND st.organization_id = '00000000-0000-0000-0000-000000000001'
  AND st.deleted_at IS NULL
ON CONFLICT (service_type_id, kind, slug) DO NOTHING;
