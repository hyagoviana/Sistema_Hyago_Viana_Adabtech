-- ============================================================================
-- Sistema HV — Migration — A5 (Reunião 2026-08-03): REABILITA checklist no OP
-- ----------------------------------------------------------------------------
-- Decisão do owner (travada): o checklist do funil (defs por etapa que valem p/
-- TODOS os casos) + os critérios ad-hoc por caso passam a existir também nas
-- etapas OPERACIONAIS, com o MESMO mecanismo do financeiro:
--   defs (system_stage_checklist_defs) → instância por caso
--   (system_fn_instanciar_checklist) → marcação (marcarItemChecklist) → gate
--   idempotente (system_fn_avancar_se_checklist_ok, op).
--
-- A migration 20260709000040_checklist_only_fin foi um LIMPADOR DE DADOS de uma
-- só vez (soft-delete de defs/instâncias op-only) — NÃO deixou constraint nem
-- trigger persistente. O bloqueio do op vivia só no APP:
--   • StageEditor.tsx:85    showChecklist = kind === "fin"   (esconde o editor)
--   • checklist-service.ts  trava 422 em createAdhocChecklistItem p/ etapa op-only
-- Ambos são relaxados nesta story (código). No BANCO nada precisava mudar para
-- reabilitar — as fns já são agnósticas a kind (o gate op sempre existiu).
--
-- POLÍTICA DE DADOS LEGADOS (Risco R1): NÃO ressuscitamos em massa as defs/
-- instâncias op soft-deletadas em 2026-07-10 pela only_fin — reviver itens
-- obsoletos poderia "travar" casos que já avançaram. O owner recria no editor as
-- defs op que quiser. Esta migration é, portanto, um MARCADOR/NO-OP idempotente e
-- reversível: reafirma os GRANTs das fns de checklist (defesa em profundidade) e
-- documenta a reabilitação. Não toca dados.
--
-- Idempotente. Sem operação destrutiva. Rollback simétrico em supabase/rollbacks/.
-- ============================================================================

-- Reafirma os GRANTs das fns de checklist (op + fin) — idempotente. Garante que
-- service_role/authenticated executem a instanciação e os dois gates. (As fns em
-- si já existem via migrations anteriores; aqui só blindamos as permissões.)
GRANT EXECUTE ON FUNCTION system_fn_instanciar_checklist(UUID, TEXT)
  TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION system_fn_avancar_se_checklist_ok(UUID, UUID)
  TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION system_fn_avancar_fin_se_ok(UUID, UUID)
  TO service_role, authenticated;

-- Sanidade (não destrutivo): reafirma o SELECT na view de defs ativas.
GRANT SELECT ON system_stage_checklist_defs_active
  TO anon, authenticated, service_role;
