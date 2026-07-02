-- Rollback S2-04 — Gate "checklist conclui → avança etapa".
-- Dropa apenas a função. Não toca system_cases nem system_case_events.

DROP FUNCTION IF EXISTS system_fn_avancar_se_checklist_ok(UUID, UUID);
