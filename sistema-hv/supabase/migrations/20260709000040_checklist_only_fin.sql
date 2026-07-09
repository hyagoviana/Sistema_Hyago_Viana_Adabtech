-- ============================================================================
-- Sistema HV — Migration — Checklist SÓ no financeiro (item 6, 2026-07-09)
-- ----------------------------------------------------------------------------
-- O dono definiu que o checklist de critérios existe APENAS nas etapas do
-- pipeline FINANCEIRO. A partir de agora o operacional não instancia/exibe/edita
-- checklist (mudanças no app). Esta migration LIMPA os dados legados: desativa as
-- definições e soft-deleta as instâncias ancoradas em etapas OPERACIONAIS puras
-- (kind='op' e que NÃO existem também como kind='fin' para o mesmo tipo).
--
-- Seguro: op e fin usam slugs distintos (op: ONBOARDING/TRIAGEM…; fin: ELABORANDO
-- /APROVACAO…), então a limpeza não toca o financeiro. Idempotente.
-- ============================================================================

-- 1) Soft-delete das INSTÂNCIAS de checklist em etapas op-only.
UPDATE system_case_checklist_items ci
   SET deleted_at = NOW()
  FROM system_cases c
 WHERE ci.case_id = c.id
   AND ci.deleted_at IS NULL
   AND EXISTS (
     SELECT 1 FROM system_pipeline_stages s
      WHERE s.service_type_id = c.service_type_id
        AND s.slug = ci.stage_slug AND s.kind = 'op' AND s.deleted_at IS NULL
   )
   AND NOT EXISTS (
     SELECT 1 FROM system_pipeline_stages s
      WHERE s.service_type_id = c.service_type_id
        AND s.slug = ci.stage_slug AND s.kind = 'fin' AND s.deleted_at IS NULL
   );

-- 2) Desativa as DEFINIÇÕES de checklist ancoradas em etapas op-only.
UPDATE system_stage_checklist_defs d
   SET active = FALSE, deleted_at = NOW()
 WHERE d.deleted_at IS NULL
   AND EXISTS (
     SELECT 1 FROM system_pipeline_stages s
      WHERE s.service_type_id = d.service_type_id
        AND s.slug = d.stage_slug AND s.kind = 'op' AND s.deleted_at IS NULL
   )
   AND NOT EXISTS (
     SELECT 1 FROM system_pipeline_stages s
      WHERE s.service_type_id = d.service_type_id
        AND s.slug = d.stage_slug AND s.kind = 'fin' AND s.deleted_at IS NULL
   );
