-- ============================================================================
-- Motor de Distribuicao — permitir DELETE em system_distribution_results
-- (re-sync limpo do botao "Sincronizar" na tela de distribuicao).
-- ============================================================================
-- Contexto: a v1.0 (20260728000001) marcou system_distribution_results como
-- APPEND-ONLY via trigger de imutabilidade (so UPDATE de writeback_pending era
-- permitido; DELETE sempre levantava excecao). Isso servia ao cron diario, que
-- nunca reprocessava a mesma data.
--
-- Agora o owner quer sincronizar SOB DEMANDA pela UI, o que exige RE-SYNC
-- idempotente: apagar os resultados da (distribution_date + org) antes de
-- reinserir os novos. Esta migration ajusta o gatilho de imutabilidade para
-- PERMITIR DELETE, mantendo o resto do comportamento (UPDATE segue restrito a
-- writeback_pending; INSERT livre). A auditoria juridica dos resultados vividos
-- fica preservada porque o re-sync substitui o snapshot da MESMA data (nao ha
-- edicao silenciosa de linhas historicas de outras datas).
--
-- ADITIVA/idempotente (CREATE OR REPLACE FUNCTION). O batch_log continua com a
-- sua propria regra (permite UPDATE so enquanto status='running').
--
-- Rollback: supabase/rollbacks/20260805000003_distribution_results_allow_delete.rollback.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION system_prevent_distribution_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- DELETE agora e permitido (re-sync limpo por data).
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- UPDATE: permitir apenas atualizacao do campo writeback_pending.
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'system_distribution_results' THEN
    IF (OLD.task_id, OLD.process_id, OLD.distribution_date, OLD.final_points,
        OLD.flow, OLD.base_date, OLD.applicable_limit, OLD.preferred_date,
        OLD.final_date, OLD.executor_id, OLD.preference_applied, OLD.alerts,
        OLD.raw_data, OLD.organization_id)
       IS NOT DISTINCT FROM
       (NEW.task_id, NEW.process_id, NEW.distribution_date, NEW.final_points,
        NEW.flow, NEW.base_date, NEW.applicable_limit, NEW.preferred_date,
        NEW.final_date, NEW.executor_id, NEW.preference_applied, NEW.alerts,
        NEW.raw_data, NEW.organization_id)
    THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Registros de distribuicao sao imutaveis (auditoria juridica). Tabela: %, Operacao: %',
    TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;
