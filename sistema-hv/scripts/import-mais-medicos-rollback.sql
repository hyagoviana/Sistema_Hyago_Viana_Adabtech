-- ============================================================================
-- ROLLBACK da carga "Mais Médicos" (Story A8) — import_batch = MM_2026_08_03
-- ============================================================================
-- Desfaz a importação de forma REVERSÍVEL onde possível. HARD-DELETE das linhas
-- de caso/cliente do batch (elas são 100% da importação; não há dado do usuário
-- misturado). O TEMA e o SERVICE_TYPE são REUSO (o service_type MAIS_MEDICOS já
-- existia antes) — então o rollback NÃO apaga o service_type; apenas
-- desvincula o tema (tema_id=NULL) e soft-deleta o tema recém-criado.
--
-- Pastas do Drive: NÃO são apagadas por este script (evita perda acidental). Para
-- limpar, liste os clientes do batch e use scripts/clean-client-folders.ts /
-- exclusão manual. Query de listagem no fim deste arquivo.
--
-- USO (conexão pg direta, dev=prod):
--   psql "$DATABASE_URL" -f sistema-hv/scripts/import-mais-medicos-rollback.sql
-- Rode dentro de uma transação e confira as contagens ANTES de COMMIT.
-- ============================================================================

BEGIN;

-- Casos do batch (fonte da verdade p/ apagar os filhos por case_id).
CREATE TEMP TABLE _mm_cases ON COMMIT DROP AS
SELECT id FROM system_cases
WHERE canonical_fields->>'import_batch' = 'MM_2026_08_03';

-- Clientes do batch.
CREATE TEMP TABLE _mm_clients ON COMMIT DROP AS
SELECT id FROM system_clients
WHERE custom_fields->>'import_batch' = 'MM_2026_08_03';

-- Confira as contagens antes de prosseguir:
SELECT (SELECT count(*) FROM _mm_cases)   AS casos_batch,
       (SELECT count(*) FROM _mm_clients) AS clientes_batch;

-- 1) Filhos dos casos.
DELETE FROM system_case_checklist_items WHERE case_id IN (SELECT id FROM _mm_cases);
DELETE FROM system_case_notes           WHERE case_id IN (SELECT id FROM _mm_cases);
DELETE FROM system_case_events          WHERE case_id IN (SELECT id FROM _mm_cases);
-- (outros filhos por case_id, se existirem — best-effort/nenhum esperado nesta carga)

-- 2) Os casos.
DELETE FROM system_cases WHERE id IN (SELECT id FROM _mm_cases);

-- 3) Os clientes do batch (não têm outros vínculos — nasceram nesta carga).
DELETE FROM system_clients WHERE id IN (SELECT id FROM _mm_clients);

-- 4) Campos do tema + checklist defs criados p/ o tema Mais Médicos.
DELETE FROM system_tema_field_defs
 WHERE tema_id IN (SELECT id FROM system_temas WHERE slug = 'MAIS_MEDICOS');
DELETE FROM system_stage_checklist_defs
 WHERE service_type_id IN (SELECT id FROM system_service_types WHERE slug = 'MAIS_MEDICOS')
   AND stage_slug = 'DOCUMENTOS_INICIAIS';

-- 5) Desvincula o tema do service_type REUSADO (não apaga o service_type) e
--    soft-deleta o tema criado nesta carga. (As 7 etapas op "Contratos" ficam;
--    se quiser reverter as etapas ao estado anterior, faça manualmente — as
--    genéricas foram soft-deletadas e podem ser revividas.)
UPDATE system_service_types SET tema_id = NULL WHERE slug = 'MAIS_MEDICOS';
UPDATE system_temas
   SET deleted_at = now(), active = false,
       slug = 'MAIS_MEDICOS__del_' || to_char(now(),'YYYYMMDDHH24MISS')
 WHERE slug = 'MAIS_MEDICOS' AND deleted_at IS NULL;

-- Confira e então COMMIT; ou ROLLBACK; se algo divergir.
-- COMMIT;
ROLLBACK;

-- ----------------------------------------------------------------------------
-- Listagem das pastas do Drive a limpar manualmente (rode ANTES do delete acima
-- se for apagar pastas — depois do delete os clientes já não existem):
--   SELECT full_name, cpf_cnpj, drive_folder_id, drive_folder_url
--   FROM system_clients
--   WHERE custom_fields->>'import_batch' = 'MM_2026_08_03' AND drive_folder_id IS NOT NULL;
-- ----------------------------------------------------------------------------
