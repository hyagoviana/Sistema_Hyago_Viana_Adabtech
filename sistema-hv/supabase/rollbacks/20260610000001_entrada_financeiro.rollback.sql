-- ============================================================================
-- ROLLBACK — Migration 0022 (S19: Entrada no Financeiro)
-- ----------------------------------------------------------------------------
-- Reverte D1 (flag) e D2 (drop do trigger automático). Reativa a bifurcação
-- automática recriando o trigger a partir da função preservada.
-- ============================================================================

-- 1) Reativar a bifurcação automática (a função nunca foi dropada).
DROP TRIGGER IF EXISTS trg_system_cases_bifurcacao ON system_cases;
CREATE TRIGGER trg_system_cases_bifurcacao
  BEFORE UPDATE ON system_cases
  FOR EACH ROW EXECUTE FUNCTION system_cases_bifurcacao_trg();

-- 2) Remover as funções de entrada manual.
DROP FUNCTION IF EXISTS system_fn_entrar_financeiro(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS system_fn_voltar_ao_operacional(UUID);

-- 3) Refazer a view sem a coluna nova e dropar a coluna/índice.
DROP VIEW IF EXISTS system_cases_active;
DROP INDEX IF EXISTS idx_system_cases_removido_operacional;
ALTER TABLE system_cases DROP COLUMN IF EXISTS removido_do_operacional_at;

CREATE VIEW system_cases_active AS
  SELECT c.*, cli.full_name AS client_name, cli.cpf_cnpj AS client_cpf_cnpj
  FROM system_cases c
  JOIN system_clients cli ON cli.id = c.client_id AND cli.deleted_at IS NULL
  WHERE c.deleted_at IS NULL;
GRANT SELECT ON system_cases_active TO anon, authenticated, service_role;
