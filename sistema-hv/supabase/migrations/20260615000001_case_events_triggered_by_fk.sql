-- Adiciona FK de triggered_by → system_users para permitir join no PostgREST
-- e habilitar auditoria na timeline de eventos dos casos.

ALTER TABLE system_case_events
  ADD CONSTRAINT fk_case_events_triggered_by
  FOREIGN KEY (triggered_by) REFERENCES system_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_system_case_events_triggered_by
  ON system_case_events(triggered_by) WHERE triggered_by IS NOT NULL;
