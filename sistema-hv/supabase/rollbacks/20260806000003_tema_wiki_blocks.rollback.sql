-- ============================================================================
-- ROLLBACK — C5: "Links úteis" / wiki por TEMA
-- ----------------------------------------------------------------------------
-- Remove a view + tabela `system_tema_wiki_blocks`. Aditiva pura → rollback
-- limpo. NÃO toca system_temas nem qualquer outra tabela.
-- Aplicar via db-apply-pg.ts.
-- ============================================================================

DROP VIEW IF EXISTS system_tema_wiki_blocks_active;
DROP TABLE IF EXISTS system_tema_wiki_blocks CASCADE;
