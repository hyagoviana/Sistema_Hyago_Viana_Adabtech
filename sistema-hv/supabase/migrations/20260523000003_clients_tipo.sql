-- ============================================================================
-- Sistema HV — Migration 0003 — Coluna `tipo` em system_clients
-- ----------------------------------------------------------------------------
-- A UI Lovable mostra cliente como Médico/Dentista/etc. No MVP-2 isso é texto
-- livre — pode virar enum quando o catálogo estiver estabelecido.
-- ============================================================================

ALTER TABLE system_clients
  ADD COLUMN IF NOT EXISTS tipo TEXT;

CREATE INDEX IF NOT EXISTS idx_system_clients_tipo
  ON system_clients(tipo)
  WHERE deleted_at IS NULL;
