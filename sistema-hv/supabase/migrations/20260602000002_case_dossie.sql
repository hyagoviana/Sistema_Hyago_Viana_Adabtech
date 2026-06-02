-- ============================================================================
-- Sistema HV — Migration 0009 — Dossiê 360º do caso (F3)
-- ----------------------------------------------------------------------------
-- Escopo mínimo P1 item 3: dossiê do caso com TAREFAS, PRAZOS e COMUNICAÇÕES.
-- Padrão: prefixo system_, organization_id + RLS, soft-delete, updated_at.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- system_case_tasks — tarefas do caso
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES system_cases(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDENTE'
                    CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA')),
  priority        TEXT NOT NULL DEFAULT 'MEDIA'
                    CHECK (priority IN ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE')),
  assignee        TEXT,
  due_date        DATE,
  completed_at    TIMESTAMPTZ,

  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_system_case_tasks_case
  ON system_case_tasks(case_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_case_tasks_org
  ON system_case_tasks(organization_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_case_tasks_updated_at
  BEFORE UPDATE ON system_case_tasks
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- ----------------------------------------------------------------------------
-- system_case_deadlines — prazos do caso
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_deadlines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES system_cases(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  title           TEXT NOT NULL,
  tipo            TEXT,                       -- ex.: recurso, contestação, audiência
  fatal_date      DATE NOT NULL,              -- data fatal
  recommended_date DATE,                      -- data recomendada de protocolo
  status          TEXT NOT NULL DEFAULT 'ABERTO'
                    CHECK (status IN ('ABERTO', 'CUMPRIDO', 'PERDIDO')),
  responsible     TEXT,
  notes           TEXT,

  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_system_case_deadlines_case
  ON system_case_deadlines(case_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_case_deadlines_fatal
  ON system_case_deadlines(fatal_date) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_system_case_deadlines_updated_at
  BEFORE UPDATE ON system_case_deadlines
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- ----------------------------------------------------------------------------
-- system_case_communications — comunicações do caso
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_communications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES system_cases(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  channel         TEXT NOT NULL DEFAULT 'OUTRO'
                    CHECK (channel IN ('WHATSAPP', 'EMAIL', 'TELEFONE', 'PRESENCIAL', 'PORTAL', 'OUTRO')),
  direction       TEXT NOT NULL DEFAULT 'OUT'
                    CHECK (direction IN ('IN', 'OUT')),
  summary         TEXT NOT NULL,
  content         TEXT,
  contact         TEXT,                       -- com quem (nome / número / e-mail)
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_system_case_comms_case
  ON system_case_communications(case_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- RLS — org-scoped (mesmo padrão das demais tabelas system_)
-- ----------------------------------------------------------------------------
ALTER TABLE system_case_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_case_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_case_communications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['system_case_tasks', 'system_case_deadlines', 'system_case_communications']
  LOOP
    EXECUTE format($f$
      CREATE POLICY %1$s_select_own_org ON %1$s
        FOR SELECT USING (organization_id = system_current_organization_id());
      CREATE POLICY %1$s_insert_own_org ON %1$s
        FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
      CREATE POLICY %1$s_update_own_org ON %1$s
        FOR UPDATE USING (organization_id = system_current_organization_id())
        WITH CHECK (organization_id = system_current_organization_id());
      CREATE POLICY %1$s_delete_own_org ON %1$s
        FOR DELETE USING (organization_id = system_current_organization_id());
    $f$, t);
  END LOOP;
END $$;

-- Views ativas (filtram soft-delete)
CREATE OR REPLACE VIEW system_case_tasks_active AS
  SELECT * FROM system_case_tasks WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW system_case_deadlines_active AS
  SELECT * FROM system_case_deadlines WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW system_case_communications_active AS
  SELECT * FROM system_case_communications WHERE deleted_at IS NULL;
