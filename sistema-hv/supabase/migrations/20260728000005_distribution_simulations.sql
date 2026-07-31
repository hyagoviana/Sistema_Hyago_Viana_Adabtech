-- ============================================================================
-- Tabelas de simulacao e atribuicoes manuais
-- Story 6.1 + 6.2 — Epic 6
-- ============================================================================

-- Tabela de simulacoes (schema identico a distribution_results + campos extras)
CREATE TABLE IF NOT EXISTS system_distribution_simulations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  simulation_run_id   UUID NOT NULL,
  simulated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  simulation_mode     TEXT NOT NULL,
  task_id             TEXT NOT NULL,
  process_id          TEXT NOT NULL,
  distribution_date   DATE NOT NULL,
  final_points        NUMERIC(10,4) NOT NULL DEFAULT 0,
  flow                distribution_flow,
  base_date           DATE,
  applicable_limit    DATE,
  preferred_date      DATE,
  final_date          DATE,
  executor_id         UUID REFERENCES system_users(id),
  preference_applied  BOOLEAN NOT NULL DEFAULT FALSE,
  alerts              TEXT[] NOT NULL DEFAULT '{}',
  blocked             BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_dist_simulations_run ON system_distribution_simulations(simulation_run_id);
CREATE INDEX idx_dist_simulations_date_org ON system_distribution_simulations(distribution_date, organization_id);

ALTER TABLE system_distribution_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY dist_sim_select ON system_distribution_simulations FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY dist_sim_service ON system_distribution_simulations FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON system_distribution_simulations TO authenticated;
GRANT ALL ON system_distribution_simulations TO service_role;

-- Coluna is_simulation no batch_log
ALTER TABLE system_distribution_batch_logs ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN NOT NULL DEFAULT FALSE;

-- Coluna active na config (para ativacao Go-Live)
ALTER TABLE system_distribution_config ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT FALSE;

-- Tabela de atribuicoes manuais (para comparacao simulacao vs real)
CREATE TABLE IF NOT EXISTS system_distribution_manual_assignments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  task_id                 TEXT NOT NULL,
  distribution_date       DATE NOT NULL,
  projuris_responsavel_id TEXT,
  executor_id             UUID REFERENCES system_users(id),
  source                  TEXT NOT NULL DEFAULT 'projuris_sync',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manual_assign_task_date UNIQUE (task_id, distribution_date, organization_id)
);

ALTER TABLE system_distribution_manual_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY dist_manual_select ON system_distribution_manual_assignments FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY dist_manual_service ON system_distribution_manual_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON system_distribution_manual_assignments TO authenticated;
GRANT ALL ON system_distribution_manual_assignments TO service_role;
