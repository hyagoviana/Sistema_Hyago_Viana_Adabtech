-- Rollback do executor exclusivo de Sustentacao Oral (20260808000010 / M14).
-- Zera SOMENTE o exclusive_executor_id da linha Sustentacao Oral (codigo 6050441).
-- NAO dropa a coluna (ela e da migration 20260805000002 e guarda as outras 3 excecoes).

UPDATE system_task_type_mapping
  SET exclusive_executor_id = NULL, updated_at = now()
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'
    AND projuris_tipo_codigo = '6050441';
