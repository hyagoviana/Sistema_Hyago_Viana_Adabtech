-- Rollback S2-03 — Instanciar checklist ao entrar na etapa.
-- Dropa apenas a função. Não toca system_cases nem tabelas de checklist.

DROP FUNCTION IF EXISTS system_fn_instanciar_checklist(UUID, TEXT);
