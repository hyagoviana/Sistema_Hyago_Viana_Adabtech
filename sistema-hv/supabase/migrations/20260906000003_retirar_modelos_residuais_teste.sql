-- ============================================================================
-- Sistema HV — S2-04 — retira de circulação os 4 modelos residuais de teste
-- ----------------------------------------------------------------------------
-- O arquivamento do lote `s204-modelos-legados-2026-09-06` varreu as duas raízes
-- legadas ("07- Modelos" e "08- Contratos e procurações") e as pastas de tipo,
-- tirando 71 arquivos de circulação. Sobraram QUATRO modelos ativos cujos
-- arquivos moram em pastas fora dessas raízes:
--
--   _temp_extract          — sobra de uma extração de placeholders
--   documento_teste        — teste
--   requerimento - teste   — teste
--   Declaração Militar     — repetição da que foi arquivada
--
-- Thiago (04/09): "podem apagar tudo, todos que estão ai são de testes e temos
-- as cópias." Owner (06/09): apagar do sistema, mantendo guardado.
--
-- Aqui é só soft-delete: os ARQUIVOS continuam intactos no Drive, onde estão. O
-- escritório vai reconstruir os modelos dentro da estrutura nova
-- (TEMA/TIPO/MODELOS/{JUDICIAL, CONTRATO E PROCURAÇÃO, ADMINISTRATIVO}).
--
-- Por id, não por nome ou por "todos os ativos": um UPDATE amplo aqui apagaria
-- qualquer modelo que alguém tenha subido entre a análise e a execução.
-- ============================================================================

UPDATE system_document_templates
   SET deleted_at = now()
 WHERE deleted_at IS NULL
   AND id IN (
     'fb4c3742-9730-454b-90cf-9d564cd9382b',  -- _temp_extract
     'f8eb8e5b-d8aa-4d1b-97b3-cf65dc3228aa',  -- Declaração Militar (repetida)
     '6f1a2a3f-42f5-4d7f-b1ed-3ccb6270fc4c',  -- documento_teste
     '3b559425-5791-4fb8-884a-17942b0f36de'   -- requerimento - teste
   );

-- ============================================================================
-- ROLLBACK:
--   UPDATE system_document_templates SET deleted_at = NULL
--    WHERE id IN ('fb4c3742-9730-454b-90cf-9d564cd9382b',
--                 'f8eb8e5b-d8aa-4d1b-97b3-cf65dc3228aa',
--                 '6f1a2a3f-42f5-4d7f-b1ed-3ccb6270fc4c',
--                 '3b559425-5791-4fb8-884a-17942b0f36de');
-- ============================================================================
