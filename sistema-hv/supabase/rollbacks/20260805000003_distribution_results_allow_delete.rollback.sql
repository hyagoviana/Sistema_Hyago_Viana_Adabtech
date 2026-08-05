-- Rollback de 20260805000003 — restaura o comportamento APPEND-ONLY original
-- (DELETE volta a ser bloqueado em system_distribution_results; UPDATE segue
-- restrito a writeback_pending). Espelha a definicao de 20260728000001.

CREATE OR REPLACE FUNCTION system_prevent_distribution_modification()
RETURNS TRIGGER AS $$
BEGIN
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
