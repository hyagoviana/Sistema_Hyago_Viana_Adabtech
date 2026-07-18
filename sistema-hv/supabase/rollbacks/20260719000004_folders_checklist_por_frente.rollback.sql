-- Rollback R2-04 — Pastas/modelos/checklist por FRENTE.
-- Simétrico: restaura os UNIQUEs anteriores (sem frente_slug), remove as colunas
-- frente_slug das 2 tabelas, restaura as views _active e a fn de instanciação
-- para a versão de 20260710000003 (sem filtro por frente). NÃO perde vínculos
-- legados. NÃO toca system_cases / system_cases_active / trigger.

-- ----------------------------------------------------------------------------
-- 1) system_service_type_folders — restaura UNIQUE(service_type_id, kind, drive_folder_id)
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS system_service_type_folders_uq;

-- Recria o constraint original (auto-nomeado no CREATE TABLE) se ainda não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'system_service_type_folders'
       AND c.contype = 'u'
       AND pg_get_constraintdef(c.oid) ILIKE '%(service_type_id, kind, drive_folder_id)%'
  ) THEN
    ALTER TABLE system_service_type_folders
      ADD CONSTRAINT system_service_type_folders_service_type_id_kind_drive_folder_id_key
      UNIQUE (service_type_id, kind, drive_folder_id);
  END IF;
END $$;

-- View _active sem frente_slug (estado original de 20260709000030). DROP+CREATE
-- (a view referencia frente_slug; remover a coluna via CREATE OR REPLACE é proibido).
-- Dropar a view PRIMEIRO libera o DROP COLUMN abaixo.
DROP VIEW IF EXISTS system_service_type_folders_active;
CREATE VIEW system_service_type_folders_active AS
  SELECT id, organization_id, service_type_id, kind, drive_folder_id, name, ordem,
         created_by, created_at, deleted_at
  FROM system_service_type_folders
  WHERE deleted_at IS NULL;
GRANT SELECT ON system_service_type_folders_active TO anon, authenticated, service_role;

ALTER TABLE system_service_type_folders DROP COLUMN IF EXISTS frente_slug;

-- ----------------------------------------------------------------------------
-- 2) system_stage_checklist_defs — restaura UNIQUE(service_type_id, stage_slug, key)
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS system_stage_checklist_defs_uq;
CREATE UNIQUE INDEX IF NOT EXISTS system_stage_checklist_defs_uq
  ON system_stage_checklist_defs (service_type_id, stage_slug, key)
  WHERE deleted_at IS NULL;

-- A view _active (SELECT *) tem frente_slug como coluna materializada → dropar a
-- coluna exige dropar a view antes. Recria depois (SELECT * sem a coluna).
DROP VIEW IF EXISTS system_stage_checklist_defs_active;
ALTER TABLE system_stage_checklist_defs DROP COLUMN IF EXISTS frente_slug;
CREATE VIEW system_stage_checklist_defs_active AS
  SELECT * FROM system_stage_checklist_defs WHERE deleted_at IS NULL;
GRANT SELECT ON system_stage_checklist_defs_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3) Restaura system_fn_instanciar_checklist SEM filtro por frente (20260710000003)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION system_fn_instanciar_checklist(
  p_case_id UUID,
  p_stage_slug TEXT
)
RETURNS VOID AS $$
DECLARE
  v_service_type UUID;
  v_org UUID;
BEGIN
  SELECT service_type_id, organization_id
    INTO v_service_type, v_org
    FROM system_cases
   WHERE id = p_case_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_service_type IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO system_case_checklist_items
    (organization_id, case_id, def_id, stage_slug, source, done, assigned_to)
  SELECT v_org, p_case_id, d.id, d.stage_slug, 'manual', FALSE, d.assigned_to
    FROM system_stage_checklist_defs d
   WHERE d.service_type_id IN (
           v_service_type,
           '00000000-0000-0000-0000-0000000000f0'::uuid
         )
     AND d.stage_slug = p_stage_slug
     AND d.active = TRUE
     AND d.deleted_at IS NULL
  ON CONFLICT (case_id, def_id) WHERE deleted_at IS NULL DO NOTHING;

  INSERT INTO system_case_checklist_item_assignees (item_id, user_id)
  SELECT ci.id, da.user_id
    FROM system_case_checklist_items ci
    JOIN system_stage_checklist_def_assignees da ON da.def_id = ci.def_id
   WHERE ci.case_id = p_case_id
     AND ci.stage_slug = p_stage_slug
     AND ci.def_id IS NOT NULL
     AND ci.deleted_at IS NULL
  ON CONFLICT (item_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_instanciar_checklist(UUID, TEXT) TO service_role, authenticated;
