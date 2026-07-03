-- Rollback do backfill de etapa comercial dos leads legados.
-- NO-OP intencional: reverter 'NOVO' -> NULL em massa é lossy e arriscado
-- (perde a etapa comercial de leads que possam já ter sido movidos).
-- Se estritamente necessário, revisar caso a caso manualmente:
--   UPDATE system_cases SET macrostatus_comercial = NULL
--   WHERE lifecycle='LEAD' AND macrostatus_comercial='NOVO' AND stage_comercial_id IS NOT NULL;
SELECT 1;
