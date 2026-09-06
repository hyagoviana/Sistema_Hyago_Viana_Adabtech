-- ============================================================================
-- Sistema HV — restauração dos modelos (owner, 06/09) — correções de dado
-- ----------------------------------------------------------------------------
-- O owner pediu os 73 Word de volta. A restauração no Drive funcionou, mas a
-- reativação no banco teve dois problemas, corrigidos aqui.
--
-- 1) DUPLICATAS. O `UPDATE ... SET deleted_at = NULL WHERE google_doc_id IN (...)`
--    reativou 369 registros para apenas 65 documentos distintos: cada sync antigo
--    havia criado uma linha nova para o mesmo arquivo, e todas estavam
--    soft-deletadas. Reativar por `google_doc_id` trouxe o lixo junto — o mesmo
--    modelo apareceria até 18 vezes no popup de geração.
--
--    Mantém-se UMA linha por documento: a mais recente. As outras voltam para
--    soft-delete. O sync seguinte reescreve `source_folder_id` da sobrevivente.
--
-- 2) O INVENTÁRIO precisa registrar a volta. Ele foi criado como log append-only
--    e a tentativa de APAGAR as linhas restauradas falhou por falta de permissão
--    — o que, no fim, foi bom: apagar perderia o histórico. O certo é marcar.
--    "Saiu em 06/09, voltou em 06/09" é mais honesto do que fingir que nunca saiu.
-- ============================================================================

-- ---------------------------------------------------------------- 1) dedup
WITH ranqueado AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY google_doc_id
           ORDER BY created_at DESC, id DESC
         ) AS posicao
    FROM system_document_templates
   WHERE deleted_at IS NULL
     AND google_doc_id IS NOT NULL
)
UPDATE system_document_templates t
   SET deleted_at = now()
  FROM ranqueado r
 WHERE t.id = r.id
   AND r.posicao > 1;

-- --------------------------------------------------- 2) inventário: marcar volta
ALTER TABLE system_drive_archive_log
  ADD COLUMN IF NOT EXISTS restaurado_em TIMESTAMPTZ;

COMMENT ON COLUMN system_drive_archive_log.restaurado_em IS
  'Quando o arquivo voltou para circulação. NULL = ainda arquivado. O log é append-only: a volta é MARCADA, não apagada, para o histórico continuar legível.';

-- O lote da S2-04 voltou inteiro por decisão do owner em 06/09.
UPDATE system_drive_archive_log
   SET restaurado_em = now()
 WHERE lote = 's204-modelos-legados-2026-09-06'
   AND restaurado_em IS NULL;

-- A service_role precisa poder marcar. Sem o GRANT, a escrita volta
-- "permission denied for table" — foi o que aconteceu na primeira tentativa.
GRANT UPDATE ON system_drive_archive_log TO service_role;

-- ============================================================================
-- ROLLBACK:
--   ALTER TABLE system_drive_archive_log DROP COLUMN IF EXISTS restaurado_em;
--   (o dedup não se desfaz por script — as linhas extras eram lixo de sync e
--    o próximo sync recria o que for preciso)
-- ============================================================================
