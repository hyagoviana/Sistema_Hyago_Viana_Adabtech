-- ============================================================================
-- Motor de Distribuicao — EXECUTOR EXCLUSIVO: Sustentacao Oral -> THIAGO (M14)
-- ============================================================================
-- Contexto: 3 das 4 excecoes de responsavel exclusivo ja foram semeadas em
--   20260805000002_distribution_exclusive_executors.sql
--     - Audiencia (TIPO, 6476501)      -> THIAGO (128858)
--     - INDENIZACAO PMMB (TEMA)         -> THAISE (204546)
--     - TEMFC (TEMA)                    -> Ana Patricia (131021)
--
-- Falta a 4a: Sustentacao Oral (TIPO) -> THIAGO. O engine
-- (engine/flow-selector.ts -> detectAbsoluteResponsible) ja honra a coluna
-- system_task_type_mapping.exclusive_executor_id (precedencia task_type ->
-- fluxo ABSOLUTE, vai direto ao executor, "independentemente do tempo").
--
-- "Sustentacao Oral" ja existe em system_task_type_mapping com o codigo
-- ProJuris real projuris_tipo_codigo='6050441' (motor_task_type_id=
-- 'SUSTENTACAO_ORAL'). Usamos o codigo numerico (nao o nome) para evitar
-- near-miss, mesmo cuidado do seed de Audiencia (6476501).
--
-- Esta migration (ADITIVA, idempotente):
--   Resolve o uuid do THIAGO via system_projuris_executor_mapping (128858) e
--   faz UPDATE system_task_type_mapping SET exclusive_executor_id = :thiago
--   WHERE projuris_tipo_codigo = '6050441'. GET DIAGNOSTICS exige 1 linha
--   (falha barulhenta se o codigo nao existir). Re-executar e no-op idempotente.
--
-- Rollback: supabase/rollbacks/20260808000010_sustentacao_oral_exclusivo.rollback.sql
-- ============================================================================

DO $$
DECLARE
  v_org    UUID := '00000000-0000-0000-0000-000000000001';
  v_thiago UUID;  -- 128858
  n INT;
BEGIN
  -- Resolve uuid pelo mapping (fonte unica: system_projuris_executor_mapping)
  SELECT executor_id INTO v_thiago FROM system_projuris_executor_mapping
    WHERE organization_id = v_org AND projuris_responsavel_id = '128858';

  IF v_thiago IS NULL THEN
    RAISE EXCEPTION 'Executor nao mapeado: thiago(128858)=%', v_thiago;
  END IF;

  -- Sustentacao Oral (TIPO) -> THIAGO. Usa o codigo numerico real 6050441.
  UPDATE system_task_type_mapping
    SET exclusive_executor_id = v_thiago, updated_at = now()
    WHERE organization_id = v_org AND projuris_tipo_codigo = '6050441';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Sustentacao Oral (6050441): esperava 1 linha, afetou %', n; END IF;
END $$;
