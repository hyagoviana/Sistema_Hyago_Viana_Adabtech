-- ============================================================================
-- Tabela de excecoes + RPCs de metricas + coluna blocked
-- Story 5.3 + 5.5 — Epic 5
-- ============================================================================

-- Adicionar coluna blocked em distribution_results
ALTER TABLE system_distribution_results ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- Tabela de excecoes para tratamento de tarefas bloqueadas
CREATE TABLE IF NOT EXISTS system_distribution_exceptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  distribution_result_id  UUID REFERENCES system_distribution_results(id),
  task_id                 TEXT NOT NULL,
  alert_code              TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'manually_assigned', 'reprocess', 'ignored')),
  manual_executor_id      UUID REFERENCES system_users(id),
  override_reason         TEXT,
  ignore_reason           TEXT,
  action_by               UUID REFERENCES system_users(id),
  action_at               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dist_exceptions_status ON system_distribution_exceptions(status) WHERE status = 'pending';
CREATE INDEX idx_dist_exceptions_org ON system_distribution_exceptions(organization_id);

ALTER TABLE system_distribution_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dist_exceptions_select ON system_distribution_exceptions FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY dist_exceptions_insert ON system_distribution_exceptions FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY dist_exceptions_update ON system_distribution_exceptions FOR UPDATE USING (organization_id = system_current_organization_id());
CREATE POLICY dist_exceptions_service ON system_distribution_exceptions FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON system_distribution_exceptions TO authenticated;
GRANT ALL ON system_distribution_exceptions TO service_role;

-- RPC: contagem de excecoes pendentes (para badge no menu)
CREATE OR REPLACE FUNCTION system_count_pending_exceptions(p_org_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*)::INTEGER FROM system_distribution_exceptions
  WHERE organization_id = p_org_id AND status = 'pending';
$$;
GRANT EXECUTE ON FUNCTION system_count_pending_exceptions(UUID) TO authenticated;

-- RPC: taxa de preferencia
CREATE OR REPLACE FUNCTION system_get_preference_rate(p_org_id UUID, p_start DATE, p_end DATE)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ROUND(
    COUNT(*) FILTER (WHERE preference_applied) * 100.0 / NULLIF(COUNT(*), 0), 2
  )
  FROM system_distribution_results
  WHERE organization_id = p_org_id
    AND distribution_date BETWEEN p_start AND p_end
    AND NOT blocked;
$$;
GRANT EXECUTE ON FUNCTION system_get_preference_rate(UUID, DATE, DATE) TO authenticated;

-- RPC: desvio de carga (coeficiente de variacao %)
CREATE OR REPLACE FUNCTION system_get_load_deviation(p_org_id UUID, p_start DATE, p_end DATE)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ROUND(
    COALESCE(STDDEV(total_pts) / NULLIF(AVG(total_pts), 0) * 100, 0), 2
  )
  FROM (
    SELECT executor_id, SUM(final_points) AS total_pts
    FROM system_distribution_results
    WHERE organization_id = p_org_id
      AND distribution_date BETWEEN p_start AND p_end
      AND NOT blocked
    GROUP BY executor_id
  ) t;
$$;
GRANT EXECUTE ON FUNCTION system_get_load_deviation(UUID, DATE, DATE) TO authenticated;
