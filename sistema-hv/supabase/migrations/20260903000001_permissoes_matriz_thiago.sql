-- ============================================================================
-- Sistema HV — S5-01 — Modelo de permissões da matriz do Thiago — 2026-09-03
-- ----------------------------------------------------------------------------
-- Reunião 02/09 + decisão do owner (D2): a régua de permissão passa a ser a
-- tabela que o Thiago desenhou. Esta migration entrega o MODELO; quem aplica aos
-- usuários é a S5-04 (de-para revisado por ele e pelo Hyago).
--
-- O que entra:
--   1. Papéis novos no CHECK de system_users.role: coordenador, suporte,
--      atendimento, estagiario. Os papéis antigos CONTINUAM válidos — ninguém
--      fica sem papel enquanto o de-para não roda.
--   2. Módulo `cliente` e nível `configure` em system_user_module_perms.
--   3. Tabela system_role_module_perms: o padrão por PAPEL vira DADO editável
--      (hoje é derivado em código, em src/lib/rbac.ts).
--
-- REGRESSÃO ZERO — por que ninguém muda de acesso hoje:
--   só semeamos os QUATRO papéis NOVOS, que nenhum usuário tem ainda. Para os
--   papéis existentes a tabela fica VAZIA, e `permissaoEfetiva` cai no mapa
--   derivado de sempre. A S5-04 insere as linhas dos papéis antigos no mesmo
--   passo em que faz o de-para, com o owner tendo revisado a planilha.
--
-- Aditiva e idempotente. Rollback ao final, em comentário.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Papéis da matriz
-- ----------------------------------------------------------------------------
ALTER TABLE system_users DROP CONSTRAINT IF EXISTS system_users_role_check;
ALTER TABLE system_users ADD CONSTRAINT system_users_role_check
  CHECK (role = ANY (ARRAY[
    -- Papéis da matriz do Thiago (02/09).
    'admin', 'coordenador', 'financeiro', 'controladoria', 'suporte',
    'atendimento', 'operacional', 'estagiario', 'marketing',
    -- Legados: continuam aceitos até o de-para da S5-04.
    'advogado_titular', 'advogado_associado', 'prestador_externo', 'comercial'
  ]));

-- ----------------------------------------------------------------------------
-- 2) Módulo `cliente` + nível `configure` nos overrides por usuário
-- ----------------------------------------------------------------------------
ALTER TABLE system_user_module_perms DROP CONSTRAINT IF EXISTS system_user_module_perms_module_check;
ALTER TABLE system_user_module_perms ADD CONSTRAINT system_user_module_perms_module_check
  CHECK (module = ANY (ARRAY[
    'cliente',        -- novo (matriz do Thiago)
    'comercial', 'operacional', 'financeiro', 'controladoria',
    'inteligencia', 'marketing', 'sistema', 'judicial'
  ]));

ALTER TABLE system_user_module_perms DROP CONSTRAINT IF EXISTS system_user_module_perms_access_check;
ALTER TABLE system_user_module_perms ADD CONSTRAINT system_user_module_perms_access_check
  CHECK (access IS NULL OR access = ANY (ARRAY['none', 'view', 'edit', 'configure']));

-- ----------------------------------------------------------------------------
-- 3) Padrão por PAPEL (o que hoje é derivado em código)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_role_module_perms (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role       TEXT NOT NULL,
  module     TEXT NOT NULL
               CHECK (module IN ('cliente','comercial','operacional','financeiro',
                                 'controladoria','inteligencia','marketing','sistema','judicial')),
  access     TEXT NOT NULL
               CHECK (access IN ('none','view','edit','configure')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role, module)
);

COMMENT ON TABLE system_role_module_perms IS
  'S5-01 (reunião 02/09): padrão de acesso por PAPEL x MÓDULO. Papel SEM linhas aqui cai no mapa derivado do rbac.ts (é o que mantém a regressão zero enquanto o de-para da S5-04 não roda). Override por usuário (system_user_module_perms) continua tendo precedência sobre isto.';

CREATE INDEX IF NOT EXISTS idx_system_role_module_perms_role
  ON system_role_module_perms(role);

DROP TRIGGER IF EXISTS trg_system_role_module_perms_updated_at ON system_role_module_perms;
CREATE TRIGGER trg_system_role_module_perms_updated_at
  BEFORE UPDATE ON system_role_module_perms
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

GRANT ALL ON TABLE system_role_module_perms TO service_role;
GRANT SELECT ON TABLE system_role_module_perms TO anon, authenticated;

ALTER TABLE system_role_module_perms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_module_perms_select ON system_role_module_perms;
CREATE POLICY role_module_perms_select ON system_role_module_perms FOR SELECT USING (true);
DROP POLICY IF EXISTS role_module_perms_all_service ON system_role_module_perms;
CREATE POLICY role_module_perms_all_service ON system_role_module_perms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4) Seed — SOMENTE os papéis novos (ninguém os tem hoje ⇒ acesso de ninguém muda)
--
-- Linhas conforme a tabela do documento 02.09.docx. Módulos que a matriz não
-- cita (inteligencia, judicial) ficam no mínimo seguro: 'none', exceto onde a
-- área claramente precisa ver (controladoria/coordenação) — está na pergunta
-- C3.4 ao Thiago e pode ser ajustado pela tela da S5-02.
-- ----------------------------------------------------------------------------
INSERT INTO system_role_module_perms (role, module, access) VALUES
  -- Coordenador: configura o operacional inteiro; edita financeiro/controladoria.
  ('coordenador','cliente','configure'),
  ('coordenador','operacional','configure'),
  ('coordenador','comercial','configure'),
  ('coordenador','financeiro','edit'),
  ('coordenador','controladoria','edit'),
  ('coordenador','marketing','edit'),
  ('coordenador','sistema','view'),
  ('coordenador','inteligencia','view'),
  ('coordenador','judicial','view'),

  -- Suporte: edita o dia a dia; vê o financeiro; sem sistema.
  ('suporte','cliente','edit'),
  ('suporte','operacional','edit'),
  ('suporte','comercial','edit'),
  ('suporte','financeiro','view'),
  ('suporte','controladoria','edit'),
  ('suporte','marketing','view'),
  ('suporte','sistema','none'),
  ('suporte','inteligencia','view'),
  ('suporte','judicial','view'),

  -- Atendimento (antigo comercial): cliente, operacional e comercial.
  ('atendimento','cliente','edit'),
  ('atendimento','operacional','edit'),
  ('atendimento','comercial','edit'),
  ('atendimento','financeiro','none'),
  ('atendimento','controladoria','none'),
  ('atendimento','marketing','none'),
  ('atendimento','sistema','none'),
  ('atendimento','inteligencia','none'),
  ('atendimento','judicial','none'),

  -- Estagiário: mesma régua do Operacional na matriz.
  ('estagiario','cliente','edit'),
  ('estagiario','operacional','edit'),
  ('estagiario','comercial','view'),
  ('estagiario','financeiro','none'),
  ('estagiario','controladoria','none'),
  ('estagiario','marketing','none'),
  ('estagiario','sistema','none'),
  ('estagiario','inteligencia','none'),
  ('estagiario','judicial','none')
ON CONFLICT (role, module) DO NOTHING;

-- ============================================================================
-- ROLLBACK (manual, se precisar):
--   DROP TABLE IF EXISTS system_role_module_perms;
--   ALTER TABLE system_user_module_perms DROP CONSTRAINT system_user_module_perms_module_check;
--   ALTER TABLE system_user_module_perms ADD CONSTRAINT system_user_module_perms_module_check
--     CHECK (module = ANY (ARRAY['comercial','operacional','financeiro','controladoria',
--                                'inteligencia','marketing','sistema','judicial']));
--   ALTER TABLE system_users DROP CONSTRAINT system_users_role_check;
--   ALTER TABLE system_users ADD CONSTRAINT system_users_role_check
--     CHECK (role = ANY (ARRAY['admin','advogado_titular','advogado_associado','prestador_externo',
--                              'controladoria','comercial','financeiro','operacional','marketing']));
-- (o rollback do role_check só é seguro enquanto NENHUM usuário tiver papel novo)
-- ============================================================================
