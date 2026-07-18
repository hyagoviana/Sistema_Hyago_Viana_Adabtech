-- ============================================================================
-- Sistema HV — R3-01 — Infra de permissão efetiva por MÓDULO — 2026-07-18
-- ----------------------------------------------------------------------------
-- Overrides OPCIONAIS de acesso por usuário×módulo. ADITIVO / regressão zero:
-- o PAPEL continua a base; esta tabela só arruma exceções por pessoa. Enquanto
-- estiver VAZIA, o comportamento do sistema é idêntico (a função pura
-- `permissaoEfetiva` cai de volta no papel quando não há override).
--
-- Módulos canônicos (doc-mestre §4.3): comercial · operacional · financeiro ·
-- controladoria · inteligencia · marketing · sistema.
-- Acesso: none (bloqueia) | view (só leitura) | edit (leitura+escrita).
--
-- Regra de ouro: NÃO toca system_cases / views / CHECKs de lifecycle. Só cria
-- tabela nova. Idempotente. Rollback em supabase/rollbacks/.
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_user_module_perms (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  module     TEXT NOT NULL
               CHECK (module IN ('comercial','operacional','financeiro',
                                 'controladoria','inteligencia','marketing','sistema')),
  access     TEXT NOT NULL DEFAULT 'view'
               CHECK (access IN ('none','view','edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_system_user_module_perms_user
  ON system_user_module_perms(user_id);

-- updated_at automático (mesma função das demais tabelas system_*).
DROP TRIGGER IF EXISTS trg_system_user_module_perms_updated_at ON system_user_module_perms;
CREATE TRIGGER trg_system_user_module_perms_updated_at
  BEFORE UPDATE ON system_user_module_perms
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Grants (sem isto o PostgREST/app retorna 500). Coerente com as demais
-- tabelas system_* (ex.: system_case_checklist_item_assignees).
-- ----------------------------------------------------------------------------
GRANT ALL ON TABLE system_user_module_perms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_user_module_perms
  TO anon, authenticated;
