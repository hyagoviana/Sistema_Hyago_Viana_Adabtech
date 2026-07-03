-- Backfill: leads legados (lifecycle='LEAD') sem etapa comercial entram na 1ª coluna (NOVO)
-- para aparecerem no Kanban de leads (Comercial → Leads). Idempotente.
-- Slug 'NOVO' existe em todos os tipos (seed de 20260706000001). O trigger
-- trg_system_cases_sync_stages projeta stage_comercial_id automaticamente.
UPDATE system_cases
SET macrostatus_comercial = 'NOVO'
WHERE lifecycle = 'LEAD'
  AND macrostatus_comercial IS NULL
  AND deleted_at IS NULL;
