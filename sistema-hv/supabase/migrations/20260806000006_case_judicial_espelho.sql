-- ============================================================================
-- Sistema HV — Migration — G1: Espelho JUDICIAL do ProJuris (só leitura)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-05 (Story G1). ADITIVA/idempotente.
--
-- OBJETIVO: guardar o VÍNCULO do caso com o processo ProJuris + um SNAPSHOT
-- (read-model) das tarefas do processo espelhadas do ProJuris. O ProJuris é a
-- FONTE (D1); estas tabelas só são escritas pelo sync de LEITURA (idempotente).
--
--   D-G1: vínculo por COLUNAS em system_cases (projuris_codigo_processo BIGINT +
--         projuris_numero_processo TEXT) — sem tabela de vínculo extra; um caso
--         espelha 1 processo. Preenchido manualmente/importação (fora do escopo).
--   D-G2: system_case_judicial_tasks (upsert idempotente por
--         (case_id, projuris_codigo_tarefa)); resumo do processo em
--         system_case_judicial_processos (1 linha por caso).
--
-- REGRESSÃO ZERO: colunas novas nascem NULL; tabelas novas vazias. Nenhuma
-- tabela existente de valores/pipeline é tocada. RLS org-scoped nas novas.
--
-- Aplicar via:
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260806000006_case_judicial_espelho.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Vínculo caso ↔ processo ProJuris (D-G1)
-- ----------------------------------------------------------------------------
ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS projuris_codigo_processo BIGINT;
ALTER TABLE system_cases
  ADD COLUMN IF NOT EXISTS projuris_numero_processo TEXT;

CREATE INDEX IF NOT EXISTS idx_system_cases_projuris_cod_proc
  ON system_cases (projuris_codigo_processo)
  WHERE projuris_codigo_processo IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2) Resumo do PROCESSO espelhado (1 por caso) — quadro tribunal/nº/etapa (G3)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_judicial_processos (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id                 UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,
  projuris_codigo_processo BIGINT,
  numero_processo         TEXT,
  tribunal                TEXT,
  orgao                   TEXT,
  fase                    TEXT,
  assunto                 TEXT,
  raw                     JSONB,
  synced_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_case_judicial_processos_case
  ON system_case_judicial_processos (case_id);

DROP TRIGGER IF EXISTS trg_system_case_judicial_processos_updated_at ON system_case_judicial_processos;
CREATE TRIGGER trg_system_case_judicial_processos_updated_at
  BEFORE UPDATE ON system_case_judicial_processos
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3) Tarefas do processo espelhadas (read-model, upsert idempotente) — G1
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_judicial_tasks (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id                 UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,
  projuris_codigo_tarefa  TEXT NOT NULL,
  tipo_codigo             TEXT,
  tipo_nome               TEXT,
  responsavel_projuris_cod TEXT,
  responsavel_nome        TEXT,
  situacao                TEXT,
  concluida               BOOLEAN NOT NULL DEFAULT FALSE,
  prazo_previsto          DATE,
  prazo_fatal             DATE,
  raw                     JSONB,
  synced_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotência do sync: uma tarefa ProJuris por caso.
CREATE UNIQUE INDEX IF NOT EXISTS uq_system_case_judicial_tasks_case_tarefa
  ON system_case_judicial_tasks (case_id, projuris_codigo_tarefa);
CREATE INDEX IF NOT EXISTS idx_system_case_judicial_tasks_case
  ON system_case_judicial_tasks (case_id);

DROP TRIGGER IF EXISTS trg_system_case_judicial_tasks_updated_at ON system_case_judicial_tasks;
CREATE TRIGGER trg_system_case_judicial_tasks_updated_at
  BEFORE UPDATE ON system_case_judicial_tasks
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4) RLS + Grants (por org — molde 20260806000004)
-- ----------------------------------------------------------------------------
ALTER TABLE system_case_judicial_processos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_case_judicial_processos_select ON system_case_judicial_processos;
DROP POLICY IF EXISTS system_case_judicial_processos_insert ON system_case_judicial_processos;
DROP POLICY IF EXISTS system_case_judicial_processos_update ON system_case_judicial_processos;
DROP POLICY IF EXISTS system_case_judicial_processos_delete ON system_case_judicial_processos;
CREATE POLICY system_case_judicial_processos_select ON system_case_judicial_processos
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_case_judicial_processos_insert ON system_case_judicial_processos
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_judicial_processos_update ON system_case_judicial_processos
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_judicial_processos_delete ON system_case_judicial_processos
  FOR DELETE USING (organization_id = system_current_organization_id());

ALTER TABLE system_case_judicial_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_case_judicial_tasks_select ON system_case_judicial_tasks;
DROP POLICY IF EXISTS system_case_judicial_tasks_insert ON system_case_judicial_tasks;
DROP POLICY IF EXISTS system_case_judicial_tasks_update ON system_case_judicial_tasks;
DROP POLICY IF EXISTS system_case_judicial_tasks_delete ON system_case_judicial_tasks;
CREATE POLICY system_case_judicial_tasks_select ON system_case_judicial_tasks
  FOR SELECT USING (organization_id = system_current_organization_id());
CREATE POLICY system_case_judicial_tasks_insert ON system_case_judicial_tasks
  FOR INSERT WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_judicial_tasks_update ON system_case_judicial_tasks
  FOR UPDATE USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());
CREATE POLICY system_case_judicial_tasks_delete ON system_case_judicial_tasks
  FOR DELETE USING (organization_id = system_current_organization_id());

GRANT ALL ON TABLE system_case_judicial_processos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_case_judicial_processos TO anon, authenticated;
GRANT ALL ON TABLE system_case_judicial_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_case_judicial_tasks TO anon, authenticated;
