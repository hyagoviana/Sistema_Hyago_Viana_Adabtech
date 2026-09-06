-- ============================================================================
-- Sistema HV — S2-04 — MODELOS subdivididos por categoria dentro do TIPO
-- ----------------------------------------------------------------------------
-- Estrutura que o Thiago desenhou (resposta B2, 04/09; árvore confirmada pelo
-- owner em 06/09):
--
--   PASTA DO TEMA
--   └── TIPO
--       └── MODELOS
--           ├── JUDICIAL
--           ├── CONTRATO E PROCURAÇÃO
--           └── ADMINISTRATIVO
--
-- "Com essa subdivisão de pastas, conseguimos categorizar melhor os modelos e
--  dar mais eficiência no uso diário. E o SHV também já fica com o rastreio para
--  subdividir melhor na hora de gerar os modelos."
--
-- O TIPO continua sendo SÓ pasta no Drive — decisão do owner, sem entidade nova.
-- Cada linha de `system_service_type_folders` com kind='caso' já É um tipo; esta
-- migration só guarda os ids das subpastas que passam a existir dentro dela.
--
-- Por que colunas e não tabela nova: são exatamente 3 categorias fixas, definidas
-- pelo Thiago, e `system_temas` já resolve o mesmo problema assim
-- (`drive_casos_folder_id` / `drive_contratacao_folder_id`). Tabela filha aqui só
-- traria join sem ganho.
--
-- ADITIVA: tudo nasce NULL, e o código trata NULL como "tipo ainda sem a
-- estrutura nova" e cai no comportamento antigo (modelos soltos na pasta do
-- tipo). Nenhum vínculo existente muda de sentido.
-- ============================================================================

ALTER TABLE system_service_type_folders
  ADD COLUMN IF NOT EXISTS drive_modelos_folder_id        TEXT,
  ADD COLUMN IF NOT EXISTS drive_judicial_folder_id       TEXT,
  ADD COLUMN IF NOT EXISTS drive_contrato_folder_id       TEXT,
  ADD COLUMN IF NOT EXISTS drive_administrativo_folder_id TEXT;

COMMENT ON COLUMN system_service_type_folders.drive_modelos_folder_id IS
  'S2-04: pasta "MODELOS" dentro da pasta do TIPO. NULL = tipo ainda sem a estrutura nova (o app cai no comportamento antigo).';
COMMENT ON COLUMN system_service_type_folders.drive_judicial_folder_id IS
  'S2-04: subpasta "JUDICIAL" dentro de MODELOS. É o source_folder_id dos modelos judiciais.';
COMMENT ON COLUMN system_service_type_folders.drive_contrato_folder_id IS
  'S2-04: subpasta "CONTRATO E PROCURAÇÃO" dentro de MODELOS.';
COMMENT ON COLUMN system_service_type_folders.drive_administrativo_folder_id IS
  'S2-04: subpasta "ADMINISTRATIVO" dentro de MODELOS.';

-- A view é `SELECT` de colunas literais, então precisa ser recriada para as
-- colunas novas aparecerem em quem lê pela view (é o caso de `listTypeFolders`).
CREATE OR REPLACE VIEW system_service_type_folders_active AS
  SELECT id,
         organization_id,
         service_type_id,
         kind,
         drive_folder_id,
         name,
         ordem,
         created_by,
         created_at,
         deleted_at,
         frente_slug,
         drive_modelos_folder_id,
         drive_judicial_folder_id,
         drive_contrato_folder_id,
         drive_administrativo_folder_id
    FROM system_service_type_folders
   WHERE deleted_at IS NULL;

-- ============================================================================
-- ROLLBACK:
--   CREATE OR REPLACE VIEW system_service_type_folders_active AS
--     SELECT id, organization_id, service_type_id, kind, drive_folder_id, name,
--            ordem, created_by, created_at, deleted_at, frente_slug
--       FROM system_service_type_folders WHERE deleted_at IS NULL;
--   ALTER TABLE system_service_type_folders
--     DROP COLUMN IF EXISTS drive_modelos_folder_id,
--     DROP COLUMN IF EXISTS drive_judicial_folder_id,
--     DROP COLUMN IF EXISTS drive_contrato_folder_id,
--     DROP COLUMN IF EXISTS drive_administrativo_folder_id;
-- (as pastas já criadas no Drive continuam lá — inofensivas e vazias)
-- ============================================================================
