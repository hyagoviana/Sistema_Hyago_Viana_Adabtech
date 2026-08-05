-- Rollback do seed dos executores ProJuris (20260805000001)
-- Remove os mappings e os system_users sinteticos; restaura o CHECK original.

DO $$
DECLARE
  v_org UUID := '00000000-0000-0000-0000-000000000001';
  v_ns  UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  codigos TEXT[] := ARRAY['195775','131021','128861','130405','131873','207254',
                          '203286','131018','131484','194419','194420','131016',
                          '204546','128858','131022'];
  c TEXT;
  v_uid UUID;
BEGIN
  FOREACH c IN ARRAY codigos LOOP
    v_uid := uuid_generate_v5(v_ns, 'projuris-executor-' || c);
    DELETE FROM system_projuris_executor_mapping
      WHERE organization_id = v_org AND projuris_responsavel_id = c;
    -- so remove o usuario se nao houver referencias remanescentes
    DELETE FROM system_users WHERE id = v_uid;
  END LOOP;
END $$;

ALTER TABLE system_distribution_config
  DROP CONSTRAINT IF EXISTS system_distribution_config_projuris_auth_type_check;
ALTER TABLE system_distribution_config
  ADD CONSTRAINT system_distribution_config_projuris_auth_type_check
  CHECK (projuris_auth_type IN ('basic','bearer','apikey'));
