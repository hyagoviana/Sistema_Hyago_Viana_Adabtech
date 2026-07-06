-- ============================================================================
-- Sistema HV — Migration — S9-11 — Critérios ad-hoc por caso (fin + op)
-- ----------------------------------------------------------------------------
-- Hoje os critérios (checklist) de cada etapa vêm SÓ do MODELO por tipo de
-- serviço (system_stage_checklist_defs, editáveis no editor de funil, valem
-- p/ TODOS os casos do tipo). Materializados por caso em
-- system_case_checklist_items com def_id NOT NULL.
--
-- O owner quer, ADICIONALMENTE, acrescentar/editar/excluir critérios DENTRO de
-- um caso específico — valem SÓ para aquele caso. O caso HERDA os critérios do
-- tipo + pode ter itens EXTRAS próprios (ad-hoc). O gate de avanço de etapa
-- passa a considerar os DOIS (obrigatórios do modelo + obrigatórios ad-hoc).
--
-- Esta migration estende system_case_checklist_items p/ suportar item AD-HOC
-- (sem def do modelo):
--   - def_id passa a ser NULLABLE (hoje é NOT NULL).
--   - novas colunas usadas QUANDO def_id IS NULL: stage_slug já existe; label,
--     required, ordem passam a carregar a definição do próprio item.
--   - CHECK: def_id IS NOT NULL OR (stage_slug IS NOT NULL AND label IS NOT NULL).
--
-- REGRA DE OURO: NÃO toca colunas de system_cases → NÃO recria system_cases_active.
-- NÃO recria trg_system_cases_bifurcacao. RLS/grants/triggers da tabela já existem
-- (S2-01) — colunas novas herdam. O índice UNIQUE parcial (case_id, def_id) NÃO
-- muda: com def_id NULL, o Postgres trata NULLs como distintos, então vários
-- ad-hoc por caso não colidem (idempotência da instanciação por def preservada).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) def_id NULLABLE (item ad-hoc não referencia def do modelo).
-- ----------------------------------------------------------------------------
ALTER TABLE system_case_checklist_items
  ALTER COLUMN def_id DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- 2) Colunas da definição inline (usadas quando def_id IS NULL). Idempotente.
--    stage_slug já existe (NOT NULL) e continua sendo a etapa do item.
-- ----------------------------------------------------------------------------
ALTER TABLE system_case_checklist_items
  ADD COLUMN IF NOT EXISTS label    TEXT,
  ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ordem    INTEGER NOT NULL DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 3) Integridade: ou é item de modelo (def_id) ou é ad-hoc (stage_slug + label).
--    stage_slug já é NOT NULL na tabela, mas mantemos a condição explícita p/
--    documentar a intenção e sobreviver a futuras mudanças da coluna.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'system_case_checklist_items_def_or_adhoc_chk'
  ) THEN
    ALTER TABLE system_case_checklist_items
      ADD CONSTRAINT system_case_checklist_items_def_or_adhoc_chk
      CHECK (def_id IS NOT NULL OR (stage_slug IS NOT NULL AND label IS NOT NULL));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4) Recria a view _active (mesma definição — SELECT *). Como a tabela ganhou
--    colunas, recriar garante que a view exponha label/required/ordem também.
--    (CREATE OR REPLACE VIEW com SELECT * já reprojeta as novas colunas, mas
--    fazemos explícito p/ clareza.)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS system_case_checklist_items_active;
CREATE VIEW system_case_checklist_items_active AS
  SELECT * FROM system_case_checklist_items WHERE deleted_at IS NULL;
GRANT SELECT ON system_case_checklist_items_active TO anon, authenticated, service_role;

-- ============================================================================
-- 5) GATE OP — system_fn_avancar_se_checklist_ok
--    A pendência passa a considerar TODOS os required da etapa esperada:
--      - itens de modelo:  def.required = TRUE  (join com defs)
--      - itens ad-hoc:     ci.def_id IS NULL AND ci.required = TRUE
--    que estejam done = FALSE. Mantém guarda WHERE macrostatus_op = esperado
--    e idempotência. Resto da função inalterado.
-- ============================================================================
CREATE OR REPLACE FUNCTION system_fn_avancar_se_checklist_ok(
  p_case_id UUID,
  p_triggered_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_expected TEXT;      -- macrostatus_op lido no início (etapa esperada)
  v_service_type UUID;
  v_org UUID;
  v_current_ordem INTEGER;
  v_next_slug TEXT;
  v_rows INTEGER;
BEGIN
  SELECT macrostatus_op, service_type_id, organization_id
    INTO v_expected, v_service_type, v_org
    FROM system_cases
   WHERE id = p_case_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_service_type IS NULL OR v_expected IS NULL THEN
    RETURN;
  END IF;

  -- Pendências: algum item REQUIRED (modelo OU ad-hoc) NÃO concluído na etapa
  -- esperada? Só done=true fecha. LEFT JOIN p/ ad-hoc (sem def).
  IF EXISTS (
    SELECT 1
      FROM system_case_checklist_items ci
      LEFT JOIN system_stage_checklist_defs d
        ON d.id = ci.def_id AND d.deleted_at IS NULL
     WHERE ci.case_id = p_case_id
       AND ci.stage_slug = v_expected
       AND ci.done = FALSE
       AND ci.deleted_at IS NULL
       AND (
         (ci.def_id IS NOT NULL AND d.required = TRUE)      -- item do modelo
         OR (ci.def_id IS NULL AND ci.required = TRUE)      -- item ad-hoc do caso
       )
  ) THEN
    RETURN;  -- ainda há required pendente → não avança
  END IF;

  SELECT ordem INTO v_current_ordem
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'op'
     AND slug = v_expected
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_current_ordem IS NULL THEN
    RETURN;
  END IF;

  SELECT slug INTO v_next_slug
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'op'
     AND ordem > v_current_ordem
     AND deleted_at IS NULL
   ORDER BY ordem ASC
   LIMIT 1;

  IF v_next_slug IS NULL THEN
    RETURN;
  END IF;

  UPDATE system_cases
     SET macrostatus_op = v_next_slug
   WHERE id = p_case_id
     AND macrostatus_op = v_expected;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    INSERT INTO system_case_events
      (case_id, organization_id, action, from_macrostatus_op, to_macrostatus_op, diff, triggered_by)
    VALUES
      (p_case_id, v_org, 'stage_auto_advanced', v_expected, v_next_slug,
       jsonb_build_object('from', v_expected, 'to', v_next_slug, 'via', 'checklist'),
       p_triggered_by);
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_avancar_se_checklist_ok(UUID, UUID) TO service_role, authenticated;

-- ============================================================================
-- 6) GATE FIN — system_fn_avancar_fin_se_ok (mesmo critério de pendência).
-- ============================================================================
CREATE OR REPLACE FUNCTION system_fn_avancar_fin_se_ok(
  p_case_id UUID,
  p_triggered_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_expected TEXT;      -- macrostatus_fin lido no início (etapa esperada)
  v_service_type UUID;
  v_org UUID;
  v_current_ordem INTEGER;
  v_next_slug TEXT;
  v_rows INTEGER;
BEGIN
  SELECT macrostatus_fin, service_type_id, organization_id
    INTO v_expected, v_service_type, v_org
    FROM system_cases
   WHERE id = p_case_id AND deleted_at IS NULL;

  IF NOT FOUND OR v_service_type IS NULL
     OR v_expected IS NULL OR v_expected = 'NAO_APLICAVEL' THEN
    RETURN;
  END IF;

  -- Pendências: algum item REQUIRED (modelo OU ad-hoc) NÃO concluído na etapa
  -- fin esperada? Só done=true fecha.
  IF EXISTS (
    SELECT 1
      FROM system_case_checklist_items ci
      LEFT JOIN system_stage_checklist_defs d
        ON d.id = ci.def_id AND d.deleted_at IS NULL
     WHERE ci.case_id = p_case_id
       AND ci.stage_slug = v_expected
       AND ci.done = FALSE
       AND ci.deleted_at IS NULL
       AND (
         (ci.def_id IS NOT NULL AND d.required = TRUE)      -- item do modelo
         OR (ci.def_id IS NULL AND ci.required = TRUE)      -- item ad-hoc do caso
       )
  ) THEN
    RETURN;
  END IF;

  SELECT ordem INTO v_current_ordem
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'fin'
     AND slug = v_expected
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_current_ordem IS NULL THEN
    RETURN;
  END IF;

  SELECT slug INTO v_next_slug
    FROM system_pipeline_stages
   WHERE service_type_id = v_service_type
     AND kind = 'fin'
     AND slug <> 'NAO_APLICAVEL'
     AND ordem > v_current_ordem
     AND deleted_at IS NULL
   ORDER BY ordem ASC
   LIMIT 1;

  IF v_next_slug IS NULL THEN
    RETURN;
  END IF;

  UPDATE system_cases
     SET macrostatus_fin = v_next_slug,
         status_fin_changed_at = NOW()
   WHERE id = p_case_id
     AND macrostatus_fin = v_expected;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    INSERT INTO system_case_events
      (case_id, organization_id, action, diff, triggered_by)
    VALUES
      (p_case_id, v_org, 'fin_stage_auto_advanced',
       jsonb_build_object('from', v_expected, 'to', v_next_slug, 'via', 'checklist'),
       p_triggered_by);
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION system_fn_avancar_fin_se_ok(UUID, UUID) TO service_role, authenticated;
