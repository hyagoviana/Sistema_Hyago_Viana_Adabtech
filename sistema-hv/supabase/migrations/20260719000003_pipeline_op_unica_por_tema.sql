-- ============================================================================
-- Sistema HV — Migration — R2-03 — Pipeline op única por TEMA (ADITIVA — só coluna)
-- ----------------------------------------------------------------------------
-- Épico R2 (fase 5c). Design travado: R2-03-design-pipeline-tema.md
--   • Opção (1): 1 TEMA ⇔ 1 system_service_type interno espelho 1:1. O motor
--     (trigger system_fn_sync_stage_ids / dual-write) continua resolvendo por
--     service_type_id — NÃO é tocado aqui nem no app.
--   • Opção (b): etapas do tema são COMUNS a todas as frentes. As funções de
--     auto-avanço (system_fn_avancar_se_checklist_ok / system_fn_avancar_fin_se_ok)
--     NÃO são tocadas — o gap C2 é eliminado na raiz (nenhuma etapa tem frente_slug).
--
-- ESTA MIGRATION É ESTRITAMENTE ADITIVA: acrescenta APENAS a coluna
--   system_pipeline_stages.frente_slug TEXT NULL
-- que é EXIBIÇÃO-ONLY (usada só como filtro de coluna no Kanban em R2-05).
-- NUNCA é consultada pelo auto-avanço (ver R-5 do design). NULL = etapa comum
-- do tema; setado = etapa condicional daquela frente (só esconde na UI).
--
-- O QUE ESTA MIGRATION *NÃO* FAZ (fica em R2-02, bloqueado pela lista do cliente):
--   • NÃO consolida/upserta o conjunto op de service_types legados.
--   • NÃO faz de-para de macrostatus_op de casos existentes.
--   • NÃO reancora checklist defs, NÃO soft-deleta etapas.
--   • NÃO toca system_cases, NÃO recria system_cases_active (nenhuma coluna de
--     system_cases muda — confirma AC-6/R-7 do design).
--   • NÃO toca system_fn_sync_stage_ids / trg_system_cases_bifurcacao /
--     trg_system_cases_sync_stages / as 2 funções de auto-avanço.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE system_pipeline_stages
  ADD COLUMN IF NOT EXISTS frente_slug TEXT;

COMMENT ON COLUMN system_pipeline_stages.frente_slug IS
  'EXIBIÇÃO-ONLY (R2-03). NULL = etapa comum do tema; setado = condicional daquela '
  'frente (só filtra a coluna no Kanban, R2-05). NUNCA consultada pelo auto-avanço.';
