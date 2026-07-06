-- ============================================================================
-- Sistema HV — Migration — #15/#16 — Funil ÚNICO comercial + financeiro
-- ----------------------------------------------------------------------------
-- Cria um "tipo de serviço" SENTINELA (inativo, oculto das listas que filtram
-- active=true) que passa a DONO do conjunto ÚNICO/GLOBAL de etapas editáveis:
--   - kind='comercial' → funil comercial único (board Comercial)
--   - kind='fin'       → funil financeiro único (board Financeiro "Todos")
--
-- O board lê estas etapas como colunas (label editável no StageEditor) e mapeia
-- os casos de TODOS os tipos por SLUG. Como os slugs comerciais/financeiros são
-- uniformes entre os tipos existentes, mover um caso (dual-write macrostatus_*)
-- continua resolvendo stage_*_id per-tipo via system_fn_sync_stage_ids, e o gate
-- fin (system_fn_avancar_fin_se_ok) segue operando sobre as etapas per-tipo.
--
-- NÃO destrói etapas per-tipo existentes (operacional continua por tipo).
-- Idempotente: usa UUID fixo + ON CONFLICT DO NOTHING.
-- ============================================================================

DO $$
DECLARE
  v_org  UUID := '00000000-0000-0000-0000-000000000001';
  v_sent UUID := '00000000-0000-0000-0000-0000000000f0';
BEGIN
  -- Tipo sentinela (inativo → não aparece nas seleções de tipo).
  INSERT INTO system_service_types (id, organization_id, name, slug, active, ordem)
  VALUES (v_sent, v_org, 'Funil único (global)', '__GLOBAL__', FALSE, 999)
  ON CONFLICT (id) DO NOTHING;

  -- Etapas comerciais globais (espelham o conjunto canônico).
  INSERT INTO system_pipeline_stages
    (organization_id, service_type_id, kind, slug, label, stage_role, ordem)
  VALUES
    (v_org, v_sent, 'comercial', 'NOVO',                  'Novo',                  'normal', 0),
    (v_org, v_sent, 'comercial', 'EM_CONTATO',            'Em contato',            'normal', 1),
    (v_org, v_sent, 'comercial', 'PROPOSTA_ENVIADA',      'Proposta enviada',      'normal', 2),
    (v_org, v_sent, 'comercial', 'AGUARDANDO_ASSINATURA', 'Aguardando assinatura', 'normal', 3),
    (v_org, v_sent, 'comercial', 'GANHO',                 'Ganho',                 'won',    4),
    (v_org, v_sent, 'comercial', 'PERDIDO',               'Perdido',               'lost',   5)
  ON CONFLICT DO NOTHING;

  -- Etapas financeiras globais (espelham o conjunto canônico, sem NAO_APLICAVEL
  -- pois o board financeiro já exclui essa coluna).
  INSERT INTO system_pipeline_stages
    (organization_id, service_type_id, kind, slug, label, stage_role, ordem)
  VALUES
    (v_org, v_sent, 'fin', 'ELABORANDO',          'Elaborando',          'normal', 0),
    (v_org, v_sent, 'fin', 'APROVACAO',           'Aprovação',           'normal', 1),
    (v_org, v_sent, 'fin', 'AGUARDANDO_ATIVACAO', 'Aguardando ativação', 'normal', 2),
    (v_org, v_sent, 'fin', 'ATIVO',               'Ativo',               'normal', 3),
    (v_org, v_sent, 'fin', 'QUITANDO',            'Quitando',            'normal', 4),
    (v_org, v_sent, 'fin', 'QUITADO',             'Quitado',             'closed', 5),
    (v_org, v_sent, 'fin', 'INADIMPLENTE',        'Inadimplente',        'normal', 6),
    (v_org, v_sent, 'fin', 'PARCIAL',             'Parcial',             'normal', 7),
    (v_org, v_sent, 'fin', 'RENEGOCIADO',         'Renegociado',         'normal', 8),
    (v_org, v_sent, 'fin', 'SUSPENSO',            'Suspenso',            'normal', 9),
    (v_org, v_sent, 'fin', 'CANCELADO',           'Cancelado',           'lost',  10)
  ON CONFLICT DO NOTHING;
END $$;
