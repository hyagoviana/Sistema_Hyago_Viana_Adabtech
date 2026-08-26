-- ROLLBACK — D1. As pastas continuam existindo no Drive; o sistema só perde a
-- referência e volta a gravar os documentos gerados na raiz da pasta do caso.
ALTER TABLE system_cases
  DROP COLUMN IF EXISTS drive_auto_folder_id,
  DROP COLUMN IF EXISTS drive_auto_folder_url;
