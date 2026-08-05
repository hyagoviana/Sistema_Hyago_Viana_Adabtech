-- ============================================================================
-- Motor de Distribuicao — EXECUTOR EXCLUSIVO por TIPO de tarefa / TEMA (assunto)
-- ============================================================================
-- Contexto: o engine (engine/flow-selector.ts -> detectAbsoluteResponsible)
-- ja honra exclusividade via precedencia:
--   (1) process.directed_executor_id
--   (2) task.theme_exclusive_executor_id       (nivel TEMA)
--   (3) task.task_type_exclusive_executor_id   (nivel TIPO)
-- resultando em fluxo ABSOLUTE (vai direto pro executor, ignora fila/preferencia).
--
-- ProJuris NAO expoe essa regra de exclusividade: a fonte e o SHV. Guardamos a
-- excecao no proprio mapeamento (uma coluna nova por tabela), e o transformer
-- do dry-run popula os campos da Task a partir dela.
--
-- Esta migration (ADITIVA, idempotente):
--   1) ALTER TABLE add coluna exclusive_executor_id uuid null
--      -> references system_users(id)   (mesmo alvo de executor_id do mapping)
--      em system_task_type_mapping E system_theme_mapping.
--   2) Semeia as 3 excecoes resolvendo o uuid a partir de
--      system_projuris_executor_mapping.executor_id (por codigo ProJuris):
--        - Audiencia (TIPO, projuris_tipo_codigo='6476501') -> THIAGO (128858)
--        - INDENIZACAO PMMB (TEMA)                          -> THAISE (204546)
--        - TEMFC (TEMA, projuris_tema_codigo='TEMFC')       -> Ana Patricia (131021)
--      NOTA: TEMFC existe no banco como TEMA (system_theme_mapping), nao como
--      tipo de tarefa; por isso e semeado no nivel TEMA (precedencia 2 -> ABSOLUTE).
--
-- Rollback: supabase/rollbacks/20260805000002_distribution_exclusive_executors.rollback.sql
-- ============================================================================

-- 1) Colunas -----------------------------------------------------------------
ALTER TABLE system_task_type_mapping
  ADD COLUMN IF NOT EXISTS exclusive_executor_id uuid NULL
    REFERENCES system_users(id);

ALTER TABLE system_theme_mapping
  ADD COLUMN IF NOT EXISTS exclusive_executor_id uuid NULL
    REFERENCES system_users(id);

COMMENT ON COLUMN system_task_type_mapping.exclusive_executor_id IS
  'Executor exclusivo do motor: se preenchido, tarefas deste TIPO vao direto a esse executor (fluxo ABSOLUTE, precedencia task_type). FK system_users(id).';
COMMENT ON COLUMN system_theme_mapping.exclusive_executor_id IS
  'Executor exclusivo do motor: se preenchido, tarefas deste TEMA vao direto a esse executor (fluxo ABSOLUTE, precedencia theme). FK system_users(id).';

-- 2) Seed das 3 excecoes -----------------------------------------------------
DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000001';

  v_thiago UUID;  -- 128858
  v_thaise UUID;  -- 204546
  v_ana    UUID;  -- 131021

  n INT;
BEGIN
  -- Resolve uuids pelo mapping (fonte unica: system_projuris_executor_mapping)
  SELECT executor_id INTO v_thiago FROM system_projuris_executor_mapping
    WHERE organization_id = v_org AND projuris_responsavel_id = '128858';
  SELECT executor_id INTO v_thaise FROM system_projuris_executor_mapping
    WHERE organization_id = v_org AND projuris_responsavel_id = '204546';
  SELECT executor_id INTO v_ana    FROM system_projuris_executor_mapping
    WHERE organization_id = v_org AND projuris_responsavel_id = '131021';

  IF v_thiago IS NULL OR v_thaise IS NULL OR v_ana IS NULL THEN
    RAISE EXCEPTION 'Executor(es) nao mapeado(s): thiago(128858)=% thaise(204546)=% ana(131021)=%',
      v_thiago, v_thaise, v_ana;
  END IF;

  -- (1) Audiencia (TIPO) -> THIAGO. Usa o codigo numerico real 6476501
  --     (evita a colisao com projuris_tipo_codigo='AUDIENCIA'/audiencia_trabalhista).
  UPDATE system_task_type_mapping
    SET exclusive_executor_id = v_thiago, updated_at = now()
    WHERE organization_id = v_org AND projuris_tipo_codigo = '6476501';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Audiencia (6476501): esperava 1 linha, afetou %', n; END IF;

  -- (2) INDENIZACAO PMMB (TEMA) -> THAISE.
  UPDATE system_theme_mapping
    SET exclusive_executor_id = v_thaise, updated_at = now()
    WHERE organization_id = v_org AND projuris_tema_codigo = 'INDENIZAÇÃO PMMB';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'INDENIZACAO PMMB: esperava 1 linha, afetou %', n; END IF;

  -- (3) TEMFC (TEMA) -> Ana Patricia. (TEMFC existe como assunto, nao como tipo.)
  UPDATE system_theme_mapping
    SET exclusive_executor_id = v_ana, updated_at = now()
    WHERE organization_id = v_org AND projuris_tema_codigo = 'TEMFC';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'TEMFC: esperava 1 linha, afetou %', n; END IF;
END $$;
