-- ============================================================================
-- Motor de Distribuicao — Seed dos EXECUTORES reais do ProJuris (dry-run)
-- ============================================================================
-- Contexto: system_projuris_executor_mapping.executor_id e
-- system_distribution_simulations.executor_id sao FK NOT NULL -> system_users(id).
-- Os 15 colaboradores do ProJuris NAO existiam em system_users, o que impedia
-- tanto o cadastro do mapping quanto a gravacao das simulacoes.
--
-- Esta migration (ADITIVA, idempotente) cria 1 system_users por colaborador
-- ProJuris (UUID deterministico via uuid_generate_v5-like a partir do codigo)
-- e o respectivo mapping projuris_responsavel_id(codigo) -> executor_id.
--
-- Papel: 'operacional' (valor valido no CHECK de role). Status: 'ACTIVE'.
-- E-mail sintetico (@projuris.local) para nao colidir com usuarios reais de
-- login — estes registros sao "executores do motor", nao contas de acesso.
--
-- Rollback: supabase/rollbacks/20260805000001_distribution_executors_seed.rollback.sql
-- ============================================================================

DO $$
DECLARE
  v_org  UUID := '00000000-0000-0000-0000-000000000001';
  -- namespace fixo para uuid v5 (deterministico por codigo ProJuris)
  v_ns   UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  rec    RECORD;
  v_uid  UUID;
BEGIN

  FOR rec IN
    SELECT * FROM (VALUES
      ('195775', 'Amanda Campos'),
      ('131021', 'Ana Patricia Cruz'),
      ('128861', 'Controladoria'),
      ('130405', 'HYAGO ALVES VIANA'),
      ('131873', 'joão braga gois'),
      ('207254', 'KEILANE ALVES'),
      ('203286', 'leslie Souza'),
      ('131018', 'Maxwel Bruno Santos Costa'),
      ('131484', 'Pablo silva'),
      ('194419', 'Pedro Holanda'),
      ('194420', 'Sarah Helena'),
      ('131016', 'suporte HV'),
      ('204546', 'THAISE'),
      ('128858', 'THIAGO CORREIA SILVA'),
      ('131022', 'Wdyson Neres Moreira da Costa')
    ) AS t(codigo, nome)
  LOOP
    -- UUID deterministico a partir do codigo ProJuris (v5).
    v_uid := uuid_generate_v5(v_ns, 'projuris-executor-' || rec.codigo);

    -- 1) system_users (idempotente por id)
    INSERT INTO system_users (id, organization_id, email, full_name, role, status)
    VALUES (
      v_uid, v_org,
      'projuris-' || rec.codigo || '@projuris.local',
      rec.nome, 'operacional', 'ACTIVE'
    )
    ON CONFLICT (id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          status    = 'ACTIVE';

    -- 2) mapping projuris_responsavel_id -> executor_id (idempotente por unique)
    INSERT INTO system_projuris_executor_mapping
      (organization_id, projuris_responsavel_id, executor_id, active, weight, eligible_complex)
    VALUES (v_org, rec.codigo, v_uid, TRUE, 1.0, TRUE)
    ON CONFLICT (projuris_responsavel_id, organization_id) DO UPDATE
      SET executor_id = EXCLUDED.executor_id, active = TRUE;
  END LOOP;
END $$;

-- ============================================================================
-- Config do Motor: credenciais/base_url/auth_type reais (OAuth2 password)
-- ============================================================================
-- NOTA: o CHECK de projuris_auth_type so permite basic/bearer/apikey. Como a
-- auth REAL e OAuth2 password (Keycloak), ampliamos o CHECK p/ 'oauth2_password'
-- e gravamos base_url de SERVICOS (adv-service) + username (email) + password.
-- client_id/secret ficam no .env.local da Edge Function (segredo), nao no banco.

ALTER TABLE system_distribution_config
  DROP CONSTRAINT IF EXISTS system_distribution_config_projuris_auth_type_check;
ALTER TABLE system_distribution_config
  ADD CONSTRAINT system_distribution_config_projuris_auth_type_check
  CHECK (projuris_auth_type IN ('basic','bearer','apikey','oauth2_password'));

UPDATE system_distribution_config
SET projuris_base_url  = 'https://api.projurisadv.com.br/adv-service',
    projuris_auth_type = 'oauth2_password',
    projuris_username  = 'thiagocorreia@hyagovianaadvocacia.com.br'
WHERE organization_id = '00000000-0000-0000-0000-000000000001';
