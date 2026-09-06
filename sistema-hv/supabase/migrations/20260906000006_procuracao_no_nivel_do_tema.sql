-- ============================================================================
-- Sistema HV — procuração passa a morar no nível do TEMA
-- ----------------------------------------------------------------------------
-- Decisão do owner (06/09), depois de ver o fluxo funcionando:
--
--   • "quando eu quiser selecionar um documento de procuração ali em gerar
--      documento deve abrir direto lá" — sem tela de categoria no meio;
--   • as procurações ficam numa pasta do TEMA, não de cada tipo.
--
-- Por que o nível do tema é o certo: hoje cada tema tem UMA pasta de procuração
-- servindo todos os seus tipos ("1% fies" tem 5 tipos e 1 pasta). Empurrar o
-- arquivo para dentro de um tipo deixaria os outros quatro sem procuração — ou
-- exigiria copiar o mesmo contrato cinco vezes, que é pior.
--
-- A árvore fica:
--
--   TEMA/
--   ├── CONTRATO E PROCURAÇÃO/     ← procurações, valem para o tema inteiro
--   ├── TIPO 1/
--   │     ├── JUDICIAL/
--   │     └── ADMINISTRATIVO/
--   └── TIPO 2/
--         ├── JUDICIAL/
--         └── ADMINISTRATIVO/
--
-- `drive_contratacao_folder_id` já existia em `system_temas`, apontando para a
-- antiga camada "Procurações" que a S2-04 aposentou. A coluna é reaproveitada
-- para a pasta nova — mesmo papel, nome novo no Drive.
-- ============================================================================

COMMENT ON COLUMN system_temas.drive_contratacao_folder_id IS
  'Pasta "CONTRATO E PROCURAÇÃO" do tema — onde ficam os modelos de procuração/contrato, valendo para todos os tipos. Era a antiga camada "Procurações", aposentada pela S2-04 e reaproveitada aqui.';

-- As pastas de procuração DENTRO do tipo deixam de ser usadas: a procuração é do
-- tema. A coluna continua para não perder a referência das que já existem no
-- Drive; nada novo aponta para ela.
COMMENT ON COLUMN system_service_type_folders.drive_contrato_folder_id IS
  'LEGADO — a pasta "CONTRATO E PROCURAÇÃO" dentro do TIPO. A procuração passou para o nível do TEMA (system_temas.drive_contratacao_folder_id) em 06/09. Mantida só para não perder a referência.';

-- ============================================================================
-- ROLLBACK: só comentários — nada a desfazer no schema.
-- ============================================================================
