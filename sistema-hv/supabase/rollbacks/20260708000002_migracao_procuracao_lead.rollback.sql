-- ============================================================================
-- ROLLBACK — S9-06 — 20260708000002_migracao_procuracao_lead.sql
-- ----------------------------------------------------------------------------
-- Restaura os casos rebaixados a partir do último evento de auditoria
-- 'rebaixado_lead_migracao_s9' de cada caso:
--   lifecycle → o valor original do diff (normalmente 'CLIENTE');
--   assinatura_liberada_at / _by → valores originais do diff;
--   procuracao_assinada_at → NULL (o carimbo não existia antes do modelo novo).
--
-- Só reverte casos que HOJE estão LEAD (não mexe em quem já foi promovido por
-- contrato depois). Marca o evento com um evento de reversão para auditoria.
-- ============================================================================

-- 1) Restaurar cada caso a partir do evento de rebaixamento mais recente.
WITH ult AS (
  SELECT DISTINCT ON (e.case_id)
    e.case_id,
    e.organization_id,
    e.diff->>'from' AS lifecycle_original,
    NULLIF(e.diff->>'assinatura_liberada_at_original', '')::timestamptz AS assin_at,
    NULLIF(e.diff->>'assinatura_liberada_by_original', '')::uuid AS assin_by
  FROM system_case_events e
  WHERE e.action = 'rebaixado_lead_migracao_s9'
  ORDER BY e.case_id, e.created_at DESC
)
UPDATE system_cases c
   SET lifecycle = COALESCE(ult.lifecycle_original, 'CLIENTE'),
       assinatura_liberada_at = ult.assin_at,
       assinatura_liberada_by = ult.assin_by,
       procuracao_assinada_at = NULL
  FROM ult
 WHERE c.id = ult.case_id
   AND c.deleted_at IS NULL
   AND c.lifecycle = 'LEAD';

-- 2) Auditar a reversão.
INSERT INTO system_case_events (case_id, organization_id, action, diff, triggered_by)
SELECT DISTINCT ON (e.case_id)
  e.case_id, e.organization_id, 'rebaixado_lead_migracao_s9_revertido',
  jsonb_build_object('via', 'rollback'), NULL
FROM system_case_events e
WHERE e.action = 'rebaixado_lead_migracao_s9'
ORDER BY e.case_id, e.created_at DESC;
