-- ============================================================================
-- Sistema HV — Migration — M8: modelo real de cadastro do colaborador + DUAS
-- flags do motor (Peticionante × Participa-da-distribuição-geral)
-- ----------------------------------------------------------------------------
-- Reunião 2026-08-07 (Story M8, v0.2 com retorno Thiago 2026-08-08). ADITIVA/idempotente.
--
-- Decisão (T1): as flags e o cadastro do colaborador ficam em `system_users`
-- (são atributos do colaborador). O `system_projuris_executor_mapping` (H5)
-- continua guardando ID ProJuris + weight + eligible_complex.
--
-- Domínios (decisões travadas do Thiago):
--   perfil (do sistema): administrador | usuario_padrao | coordenador | financeiro
--   cargo (nível):       senior | junior | estagiario | prestador_servico | administrador
--   status_projuris:     habilitado | desabilitado (= arquivado no ProJuris)
--   peticionante:                    Não => NEM entra no motor
--   participa_distribuicao_padrao:   só quem é Sim entra na FILA GERAL/ordinária
--
-- O status de LOGIN (system_users.status: ACTIVE/INVITED/...) continua sendo o
-- "ativo/inativo" do colaborador — NÃO criamos coluna redundante. status_projuris
-- é a dimensão SEPARADA (habilitado/desabilitado no ProJuris).
--
-- Colunas nascem NULL/DEFAULT false → usuários existentes não regridem.
--
-- Aplicar via (2× idempotente, de dentro de sistema-hv/):
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260808000030_system_users_cadastro_colaborador.sql
-- ============================================================================

ALTER TABLE system_users
  ADD COLUMN IF NOT EXISTS perfil TEXT,
  ADD COLUMN IF NOT EXISTS cargo TEXT,
  ADD COLUMN IF NOT EXISTS unidade_organizacional TEXT,
  ADD COLUMN IF NOT EXISTS peticionante BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS participa_distribuicao_padrao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_projuris TEXT;

-- CHECKs nomeados e idempotentes (só valida quando não-nulo).
DO $$ BEGIN
  ALTER TABLE system_users ADD CONSTRAINT system_users_perfil_check
    CHECK (perfil IS NULL OR perfil IN ('administrador','usuario_padrao','coordenador','financeiro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE system_users ADD CONSTRAINT system_users_cargo_check
    CHECK (cargo IS NULL OR cargo IN ('senior','junior','estagiario','prestador_servico','administrador'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE system_users ADD CONSTRAINT system_users_status_projuris_check
    CHECK (status_projuris IS NULL OR status_projuris IN ('habilitado','desabilitado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN system_users.perfil IS 'M8: perfil do sistema (base p/ permissão por cargo futura).';
COMMENT ON COLUMN system_users.cargo IS 'M8: cargo/nível do colaborador.';
COMMENT ON COLUMN system_users.peticionante IS 'M8 flag (a): Não => colaborador NEM entra no motor de distribuição.';
COMMENT ON COLUMN system_users.participa_distribuicao_padrao IS 'M8 flag (b): só quem é true entra na fila geral/ordinária (senão só por exceção).';
COMMENT ON COLUMN system_users.status_projuris IS 'M8: habilitado|desabilitado no ProJuris (arquivado). Separado do status de login.';

-- GOTCHA SELECT *: a view system_users_active é `SELECT *` (congela colunas na
-- criação). Reexpande p/ incluir as colunas novas — senão listUsers (que lê da
-- view) quebra com "column ... does not exist". Ver 20260808000050 (mesmo fix).
CREATE OR REPLACE VIEW system_users_active AS
  SELECT * FROM system_users WHERE deleted_at IS NULL;
GRANT SELECT ON system_users_active TO anon, authenticated, service_role;
