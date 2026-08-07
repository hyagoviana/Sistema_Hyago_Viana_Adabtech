-- ============================================================================
-- Motor de Distribuicao — TABELA SATELITE de APROVACAO (Story H2)
-- ============================================================================
-- Contexto: system_distribution_results e APPEND-ONLY (trigger
-- system_prevent_distribution_modification permite so DELETE de re-sync + UPDATE
-- de writeback_pending). O estado de aprovacao humano (pending -> approved |
-- rejected) e o override manual de executor NAO cabem nessa tabela imutavel.
--
-- Esta migration cria uma tabela SATELITE (1:1 opcional por result) que guarda o
-- PORTAO humano que a H3 (writeback ao ProJuris) vai consumir como pre-condicao:
-- so tarefas com status='approved' ficam elegiveis a efetivacao.
--
-- Coerencia com re-sync (AC-8): FK ON DELETE CASCADE para
-- system_distribution_results(id). Quando o runSync apaga+reinsere os results da
-- data (migration 20260805000003), as aprovacoes orfas somem junto — o operador
-- aprova sempre a ULTIMA rodada.
--
-- Override manual de executor (AC-5): guarda original_executor_id +
-- override_executor_id (de->para) + quem/quando, auditavel. O executor do result
-- imutavel nao muda; a "verdade efetiva" e result.executor_id salvo override.
--
-- ADITIVA / IDEMPOTENTE (IF NOT EXISTS + DROP POLICY IF EXISTS). RLS org-scoped.
-- Rollback: supabase/rollbacks/20260805000004_distribution_approvals.rollback.sql
-- ============================================================================

-- Enum de status da aprovacao (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'distribution_approval_status') THEN
    CREATE TYPE distribution_approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS system_distribution_approvals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  -- Result alvo (imutavel). CASCADE cobre AC-8 (re-sync limpa aprovacoes orfas).
  distribution_result_id UUID NOT NULL
    REFERENCES system_distribution_results(id) ON DELETE CASCADE,

  status                distribution_approval_status NOT NULL DEFAULT 'pending',

  -- Auditoria da decisao.
  decided_by            UUID REFERENCES system_users(id) ON DELETE SET NULL,
  decided_at            TIMESTAMPTZ,
  reason                TEXT,

  -- Override manual de executor (AC-5): de -> para, auditavel. NULL quando nao
  -- houve troca (mantem o executor sugerido pelo motor).
  original_executor_id  UUID REFERENCES system_users(id) ON DELETE SET NULL,
  override_executor_id  UUID REFERENCES system_users(id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Um estado de aprovacao por result (1:1). Aprovar/rejeitar/editar = UPSERT.
  CONSTRAINT uq_distribution_approval_result UNIQUE (distribution_result_id)
);

CREATE INDEX IF NOT EXISTS idx_dist_approvals_result
  ON system_distribution_approvals(distribution_result_id);
CREATE INDEX IF NOT EXISTS idx_dist_approvals_status_org
  ON system_distribution_approvals(status, organization_id);

-- updated_at automatico (reusa o helper padrao do schema).
DROP TRIGGER IF EXISTS trg_distribution_approvals_updated_at ON system_distribution_approvals;
CREATE TRIGGER trg_distribution_approvals_updated_at
  BEFORE UPDATE ON system_distribution_approvals
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- ----------------------------------------------------------------------------
-- RLS org-scoped (mesma regua das demais tabelas do motor).
-- ----------------------------------------------------------------------------
ALTER TABLE system_distribution_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_distribution_approvals_select_own_org ON system_distribution_approvals;
CREATE POLICY system_distribution_approvals_select_own_org
  ON system_distribution_approvals FOR SELECT
  USING (organization_id = system_current_organization_id());

DROP POLICY IF EXISTS system_distribution_approvals_insert_own_org ON system_distribution_approvals;
CREATE POLICY system_distribution_approvals_insert_own_org
  ON system_distribution_approvals FOR INSERT
  WITH CHECK (organization_id = system_current_organization_id());

DROP POLICY IF EXISTS system_distribution_approvals_update_own_org ON system_distribution_approvals;
CREATE POLICY system_distribution_approvals_update_own_org
  ON system_distribution_approvals FOR UPDATE
  USING (organization_id = system_current_organization_id())
  WITH CHECK (organization_id = system_current_organization_id());

DROP POLICY IF EXISTS system_distribution_approvals_delete_own_org ON system_distribution_approvals;
CREATE POLICY system_distribution_approvals_delete_own_org
  ON system_distribution_approvals FOR DELETE
  USING (organization_id = system_current_organization_id());

DROP POLICY IF EXISTS system_distribution_approvals_all_service_role ON system_distribution_approvals;
CREATE POLICY system_distribution_approvals_all_service_role
  ON system_distribution_approvals FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON system_distribution_approvals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_distribution_approvals TO authenticated;

COMMENT ON TABLE system_distribution_approvals IS
  'H2: portao humano de aprovacao (pending/approved/rejected) + override manual de executor por resultado do motor. Satelite 1:1 de system_distribution_results (append-only). CASCADE no re-sync (AC-8). Consumida pela H3 como pre-condicao do writeback.';
