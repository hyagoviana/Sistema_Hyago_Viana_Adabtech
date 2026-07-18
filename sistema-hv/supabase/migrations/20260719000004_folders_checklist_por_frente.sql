-- ============================================================================
-- Sistema HV — Migration — R2-04 — Pastas/modelos/checklist por FRENTE (ADITIVA)
-- ----------------------------------------------------------------------------
-- Épico R2 (fase 5d da Sequência Segura §7). Adiciona `frente_slug` às tabelas
-- de PASTAS por categoria (system_service_type_folders) e de DEFS de checklist
-- (system_stage_checklist_defs), para que ao cadastrar um caso escolhendo
-- tema+frente o sistema mostre exatamente as pastas/modelos e o checklist da
-- frente — MANTENDO o fallback legado (frente_slug NULL vale para todo o tema).
--
-- MODELO (design R2-03, Opção 1): 1 TEMA ⇔ 1 system_service_type interno espelho.
-- Pastas/checklist continuam ancoradas em `service_type_id` (o motor); esta
-- migration só ACRESCENTA `frente_slug` como filtro adicional por frente.
--
-- [C4] UNIQUE com COALESCE — OBRIGATÓRIO. No Postgres, NULLs contam como valores
-- DISTINTOS num UNIQUE → sem COALESCE, o índice permitiria duplicatas silenciosas
-- de pasta/def "sem frente" (frente_slug NULL). Por isso os índices únicos usam
-- COALESCE(frente_slug,'') — mesmo padrão de R2-07.
--
-- ESCOPO / REGRAS DE OURO:
--   • NÃO popula pastas legadas (FIES_ESF ESF/CENSO/PORTARIA etc.) — isso é a
--     fusão R2-02 (espera a lista definitiva do cliente). Aqui só a COLUNA nasce.
--   • NÃO toca system_cases / system_cases_active / trigger de bifurcação.
--   • Idempotente: ADD COLUMN IF NOT EXISTS, DROP ... IF EXISTS, CREATE ... IF
--     NOT EXISTS, DO-blocks guardados. Rollback simétrico em rollbacks/.
--
-- Molde: 20260709000030_service_type_folders.sql (folders + view _active),
--        20260703000001_stage_checklist.sql (defs + UNIQUE parcial + view _active),
--        20260710000003_checklist_def_assignees.sql (system_fn_instanciar_checklist).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) system_service_type_folders.frente_slug (NULL = vale para todo o tema)
-- ----------------------------------------------------------------------------
ALTER TABLE system_service_type_folders
  ADD COLUMN IF NOT EXISTS frente_slug TEXT;

-- [C4] Substitui o UNIQUE (service_type_id, kind, drive_folder_id) — que era um
-- constraint auto-nomeado do CREATE TABLE (sem WHERE deleted_at) — por um índice
-- ÚNICO PARCIAL que inclui COALESCE(frente_slug,'') e ignora linhas excluídas.
-- Dropa o constraint antigo pelo nome real (descoberto via catálogo) p/ ser
-- idempotente mesmo se o nome variar entre ambientes.
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT c.conname INTO v_conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'system_service_type_folders'
     AND c.contype = 'u'
     AND pg_get_constraintdef(c.oid) ILIKE '%(service_type_id, kind, drive_folder_id)%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE system_service_type_folders DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

-- Também dropa um eventual índice único já criado por reexecução parcial.
DROP INDEX IF EXISTS system_service_type_folders_uq;

CREATE UNIQUE INDEX IF NOT EXISTS system_service_type_folders_uq
  ON system_service_type_folders
     (service_type_id, kind, drive_folder_id, COALESCE(frente_slug, ''))
  WHERE deleted_at IS NULL;

-- Recria a view _active expondo frente_slug. Usa DROP+CREATE (não CREATE OR
-- REPLACE): a coluna nova precisa entrar respeitando as colunas VIGENTES, e o
-- CREATE OR REPLACE do Postgres proíbe reordenar/inserir colunas no meio — só
-- permite APENDAR ao fim. DROP+CREATE evita esse acoplamento de ordem.
DROP VIEW IF EXISTS system_service_type_folders_active;
CREATE VIEW system_service_type_folders_active AS
  SELECT id, organization_id, service_type_id, kind, drive_folder_id, name, ordem,
         created_by, created_at, deleted_at, frente_slug
  FROM system_service_type_folders
  WHERE deleted_at IS NULL;
GRANT SELECT ON system_service_type_folders_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2) system_stage_checklist_defs.frente_slug (NULL = def comum do tema)
-- ----------------------------------------------------------------------------
ALTER TABLE system_stage_checklist_defs
  ADD COLUMN IF NOT EXISTS frente_slug TEXT;

-- [C4] Recria o UNIQUE parcial incluindo COALESCE(frente_slug,''). Uma def com
-- frente pode coexistir com a def comum (NULL) e com a de outra frente na mesma
-- (service_type_id, stage_slug, key), sem colidir e sem duplicatas silenciosas.
DROP INDEX IF EXISTS system_stage_checklist_defs_uq;
CREATE UNIQUE INDEX IF NOT EXISTS system_stage_checklist_defs_uq
  ON system_stage_checklist_defs
     (service_type_id, stage_slug, key, COALESCE(frente_slug, ''))
  WHERE deleted_at IS NULL;

-- Recria a view _active (era SELECT *; SELECT * já pega a nova coluna, mas
-- reemitimos p/ garantir a projeção da coluna nova em ambientes já criados).
CREATE OR REPLACE VIEW system_stage_checklist_defs_active AS
  SELECT * FROM system_stage_checklist_defs WHERE deleted_at IS NULL;
GRANT SELECT ON system_stage_checklist_defs_active TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3) Instanciação de checklist por FRENTE (AC-4)
-- ----------------------------------------------------------------------------
-- A fn passa a ler o frente_slug do CASO e a filtrar as defs:
--   • def com frente (d.frente_slug = <frente do caso>) → instancia SÓ nessa frente;
--   • def comum (d.frente_slug IS NULL) → instancia para TODAS as frentes (e para
--     casos sem frente).
-- Continua idempotente (ON CONFLICT DO NOTHING), mantém a herança do assigned_to
-- e a propagação N:N de responsáveis (system_fn_instanciar_checklist do
-- 20260710000003). NÃO é trigger; é chamada no MESMO caminho de serviço de sempre.
CREATE OR REPLACE FUNCTION system_fn_instanciar_checklist(
  p_case_id UUID,
  p_stage_slug TEXT
)
RETURNS VOID AS $$
DECLARE
  v_service_type UUID;
  v_org UUID;
  v_frente TEXT;
BEGIN
  SELECT service_type_id, organization_id, frente_slug
    INTO v_service_type, v_org, v_frente
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
           '00000000-0000-0000-0000-0000000000f0'::uuid  -- GLOBAL_FUNNEL_SERVICE_TYPE_ID
         )
     AND d.stage_slug = p_stage_slug
     AND d.active = TRUE
     AND d.deleted_at IS NULL
     -- Frente: def comum (NULL) vale p/ todos; def com frente só p/ a mesma frente
     -- do caso. Caso sem frente (v_frente NULL) só herda as defs comuns.
     AND (d.frente_slug IS NULL OR d.frente_slug = v_frente)
  ON CONFLICT (case_id, def_id) WHERE deleted_at IS NULL DO NOTHING;

  -- Propaga o conjunto COMPLETO de responsáveis da def → N:N do item (idempotente).
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
