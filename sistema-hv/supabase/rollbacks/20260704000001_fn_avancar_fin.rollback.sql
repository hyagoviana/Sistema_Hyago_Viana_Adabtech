-- Rollback — S3-02 — Gate financeiro por checklist.
-- Remove a função do gate fin. Não há alteração de tabela/coluna para reverter.
DROP FUNCTION IF EXISTS system_fn_avancar_fin_se_ok(UUID, UUID);
