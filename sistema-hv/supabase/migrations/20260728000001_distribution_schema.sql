-- ============================================================================
-- Motor de Distribuicao de Tarefas Judiciais — Schema v1.0
-- Story 1.1 — Epic 1 (Infraestrutura e Motor de Distribuicao)
-- ============================================================================
-- Cria todas as tabelas, enums, indices, RLS, triggers de imutabilidade
-- e RPC necessarios para o Motor de Distribuicao integrado ao Sistema HV.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
CREATE TYPE distribution_flow     AS ENUM ('ABSOLUTE', 'COMPLEX', 'GENERAL');
CREATE TYPE batch_status          AS ENUM ('running', 'completed', 'failed');
CREATE TYPE calendar_block_type   AS ENUM ('general', 'individual');
CREATE TYPE writeback_status      AS ENUM ('pending', 'success', 'failed');

-- ----------------------------------------------------------------------------
-- 1. distribution_results — Resultado da distribuicao por tarefa (AC-01)
-- ----------------------------------------------------------------------------
CREATE TABLE system_distribution_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  -- Identificadores
  task_id             TEXT NOT NULL,
  process_id          TEXT NOT NULL,
  distribution_date   DATE NOT NULL,

  -- Pontuacao
  final_points        NUMERIC(10,4) NOT NULL,

  -- Fluxo e datas
  flow                distribution_flow NOT NULL,
  base_date           DATE NOT NULL,
  applicable_limit    DATE NOT NULL,
  preferred_date      DATE,
  final_date          DATE NOT NULL,

  -- Responsavel
  executor_id         UUID NOT NULL REFERENCES system_users(id) ON DELETE RESTRICT,
  preference_applied  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Alertas e estado
  alerts              TEXT[] NOT NULL DEFAULT '{}',
  writeback_pending   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Dados brutos do Projuris para auditoria e reprocessamento (FR-005)
  raw_data            JSONB,

  -- Auditoria
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Deduplicacao: mesma tarefa nao pode ser distribuida 2x no mesmo batch/org
  CONSTRAINT uq_distribution_task_date_org UNIQUE (task_id, distribution_date, organization_id)
);

-- Indices (AC-10)
CREATE INDEX idx_dist_results_date_org
  ON system_distribution_results(distribution_date, organization_id);
CREATE INDEX idx_dist_results_executor_final_date
  ON system_distribution_results(executor_id, final_date);
CREATE INDEX idx_dist_results_task_id
  ON system_distribution_results(task_id);

-- ----------------------------------------------------------------------------
-- 2. distribution_queue_state — Estado persistente das filas (AC-02)
-- ----------------------------------------------------------------------------
CREATE TABLE system_distribution_queue_state (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  batch_date          DATE NOT NULL,
  general_balances    JSONB NOT NULL DEFAULT '{}',
  complex_balances    JSONB NOT NULL DEFAULT '{}',
  rotating_order      TEXT[] NOT NULL DEFAULT '{}',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice (AC-10)
CREATE INDEX idx_dist_queue_state_date_org
  ON system_distribution_queue_state(batch_date, organization_id);

-- ----------------------------------------------------------------------------
-- 3. distribution_batch_logs — Log de cada execucao de batch (AC-03)
-- ----------------------------------------------------------------------------
CREATE TABLE system_distribution_batch_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  batch_date          DATE NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  status              batch_status NOT NULL DEFAULT 'running',

  total_tasks         INTEGER NOT NULL DEFAULT 0,
  successful          INTEGER NOT NULL DEFAULT 0,
  failed              INTEGER NOT NULL DEFAULT 0,
  alerts_generated    INTEGER NOT NULL DEFAULT 0,

  error_message       TEXT,
  metrics             JSONB,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice (AC-10)
CREATE INDEX idx_dist_batch_logs_date_org
  ON system_distribution_batch_logs(batch_date, organization_id);

-- ----------------------------------------------------------------------------
-- 4. projuris_executor_mapping — Mapeamento Projuris -> executor (AC-04)
-- ----------------------------------------------------------------------------
CREATE TABLE system_projuris_executor_mapping (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  projuris_responsavel_id TEXT NOT NULL,
  executor_id             UUID NOT NULL REFERENCES system_users(id) ON DELETE RESTRICT,
  active                  BOOLEAN NOT NULL DEFAULT TRUE,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Um responsavel Projuris so mapeia para um executor por org
  CONSTRAINT uq_projuris_executor_org UNIQUE (projuris_responsavel_id, organization_id)
);

CREATE TRIGGER trg_projuris_executor_mapping_updated_at
  BEFORE UPDATE ON system_projuris_executor_mapping
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 5. task_type_mapping — Tipo tarefa Projuris -> Motor (AC-05)
-- ----------------------------------------------------------------------------
CREATE TABLE system_task_type_mapping (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  projuris_tipo_codigo    TEXT NOT NULL,
  motor_task_type_id      TEXT NOT NULL,
  points                  NUMERIC(10,4) NOT NULL DEFAULT 1.0,
  complexity_level        INTEGER NOT NULL DEFAULT 0 CHECK (complexity_level BETWEEN 0 AND 2),
  temporal_level          INTEGER NOT NULL DEFAULT 0 CHECK (temporal_level BETWEEN 0 AND 2),
  active                  BOOLEAN NOT NULL DEFAULT TRUE,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_task_type_projuris_org UNIQUE (projuris_tipo_codigo, organization_id)
);

CREATE TRIGGER trg_task_type_mapping_updated_at
  BEFORE UPDATE ON system_task_type_mapping
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6. theme_mapping — Tema Projuris -> Motor (AC-06)
-- ----------------------------------------------------------------------------
CREATE TABLE system_theme_mapping (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  projuris_tema_codigo    TEXT NOT NULL,
  motor_theme_id          TEXT NOT NULL,
  multiplier              NUMERIC(10,4) NOT NULL DEFAULT 1.0,
  temporal_level          INTEGER NOT NULL DEFAULT 0 CHECK (temporal_level BETWEEN 0 AND 2),
  active                  BOOLEAN NOT NULL DEFAULT TRUE,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_theme_projuris_org UNIQUE (projuris_tema_codigo, organization_id)
);

CREATE TRIGGER trg_theme_mapping_updated_at
  BEFORE UPDATE ON system_theme_mapping
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 7. distribution_calendar — Calendario operacional (AC-07)
-- ----------------------------------------------------------------------------
CREATE TABLE system_distribution_calendar (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  date                DATE NOT NULL,
  block_type          calendar_block_type NOT NULL,
  executor_id         UUID REFERENCES system_users(id) ON DELETE CASCADE,
  reason              TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Bloqueio geral: executor_id deve ser NULL
  -- Bloqueio individual: executor_id deve ser NOT NULL
  CONSTRAINT chk_calendar_block_type CHECK (
    (block_type = 'general' AND executor_id IS NULL) OR
    (block_type = 'individual' AND executor_id IS NOT NULL)
  ),
  -- Nao duplicar mesmo bloqueio
  CONSTRAINT uq_calendar_block UNIQUE (date, block_type, executor_id, organization_id)
);

-- Indice (AC-10)
CREATE INDEX idx_dist_calendar_date_org
  ON system_distribution_calendar(date, organization_id);

-- ----------------------------------------------------------------------------
-- 8. distribution_writeback_log — Log de write-back no Projuris (AC-08)
-- ----------------------------------------------------------------------------
CREATE TABLE system_distribution_writeback_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  distribution_result_id  UUID NOT NULL REFERENCES system_distribution_results(id) ON DELETE RESTRICT,
  task_id                 TEXT NOT NULL,
  executor_id             UUID NOT NULL REFERENCES system_users(id) ON DELETE RESTRICT,
  projuris_responsavel_id TEXT NOT NULL,

  error                   TEXT,
  attempt                 INTEGER NOT NULL DEFAULT 1,
  status                  writeback_status NOT NULL DEFAULT 'pending',

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dist_writeback_status
  ON system_distribution_writeback_log(status) WHERE status = 'pending';

-- ============================================================================
-- RLS — Todas as 8 tabelas (AC-09)
-- ============================================================================

-- Helper macro: habilitar RLS + policies padrao (SELECT, INSERT, UPDATE) + service_role
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'system_distribution_results',
      'system_distribution_queue_state',
      'system_distribution_batch_logs',
      'system_projuris_executor_mapping',
      'system_task_type_mapping',
      'system_theme_mapping',
      'system_distribution_calendar',
      'system_distribution_writeback_log'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (organization_id = system_current_organization_id())',
      tbl || '_select_own_org', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (organization_id = system_current_organization_id())',
      tbl || '_insert_own_org', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (organization_id = system_current_organization_id()) WITH CHECK (organization_id = system_current_organization_id())',
      tbl || '_update_own_org', tbl
    );
    -- service_role bypassa RLS, mas policy explicita para clareza
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl || '_all_service_role', tbl
    );

    -- GRANTs
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO service_role', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO authenticated', tbl);
  END LOOP;
END;
$$;

-- ============================================================================
-- Imutabilidade — distribution_results e distribution_batch_logs (AC-11)
-- ============================================================================
-- Registros de distribuicao sao append-only para auditoria juridica (NFR-008).
-- Excecao: writeback_pending pode ser atualizado em distribution_results.

CREATE OR REPLACE FUNCTION system_prevent_distribution_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Permitir apenas atualizacao do campo writeback_pending
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
      -- Somente writeback_pending mudou, permitir
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Registros de distribuicao sao imutaveis (auditoria juridica). Tabela: %, Operacao: %',
    TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

-- distribution_results: bloqueia UPDATE (exceto writeback_pending) e DELETE
CREATE TRIGGER trg_distribution_results_immutable
  BEFORE UPDATE OR DELETE ON system_distribution_results
  FOR EACH ROW EXECUTE FUNCTION system_prevent_distribution_modification();

-- distribution_batch_logs: bloqueia UPDATE e DELETE completamente
CREATE OR REPLACE FUNCTION system_prevent_batch_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Permitir UPDATE somente enquanto batch esta 'running' (para marcar completed/failed)
  IF TG_OP = 'UPDATE' AND OLD.status = 'running' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Logs de batch finalizados sao imutaveis (auditoria juridica). Tabela: %, Operacao: %',
    TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_distribution_batch_logs_immutable
  BEFORE UPDATE OR DELETE ON system_distribution_batch_logs
  FOR EACH ROW EXECUTE FUNCTION system_prevent_batch_log_modification();

-- ============================================================================
-- RPC: get_queue_state (AC-13)
-- ============================================================================
-- Retorna o estado de fila mais recente anterior ou igual a data informada.
-- Usado pelo Motor para carregar estado persistido do batch anterior.

CREATE OR REPLACE FUNCTION system_get_queue_state(
  p_organization_id UUID,
  p_batch_date      DATE
)
RETURNS TABLE (
  id               UUID,
  batch_date       DATE,
  general_balances JSONB,
  complex_balances JSONB,
  rotating_order   TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    qs.id,
    qs.batch_date,
    qs.general_balances,
    qs.complex_balances,
    qs.rotating_order
  FROM system_distribution_queue_state qs
  WHERE qs.organization_id = p_organization_id
    AND qs.batch_date <= p_batch_date
  ORDER BY qs.batch_date DESC
  LIMIT 1;
$$;

-- Grant para authenticated e service_role
GRANT EXECUTE ON FUNCTION system_get_queue_state(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION system_get_queue_state(UUID, DATE) TO service_role;
