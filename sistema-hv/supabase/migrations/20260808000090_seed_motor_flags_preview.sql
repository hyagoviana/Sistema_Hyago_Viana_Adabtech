-- ============================================================================
-- Sistema HV — SEED (preview do motor) — flags dos executores a partir da planilha
-- ----------------------------------------------------------------------------
-- 2026-08-08. Semeia as flags do motor (M8/M9/M13) nos 15 executores ATIVOS que
-- já vieram no seed do ProJuris (20260805000001), casando pelo CÓDIGO NUMÉRICO do
-- ProJuris (mapping.projuris_responsavel_id) — que é o que a API usa (o PES.* da
-- planilha é outro identificador, a confirmar com o Thiago).
--
-- NÃO cria usuário nem manda e-mail (o import de ativos + convites do M15 segue
-- adiado). Só liga as flags nos registros que já existem, para o motor conseguir
-- distribuir no PREVIEW. Idempotente. Será SUPERSEDIDO pelo import completo do M15.
--
-- Regras (da planilha PREENCHIDA-2026-08-08):
--   FILA GERAL (peticionante=Sim E participa=Sim): Keilane(207254), Maxwel(131018).
--   POOL por EXCEÇÃO (peticionante=Sim, participa=Não): Thiago(128858),
--     Ana Patrícia(131021), Thaíse(204546), Amanda(195775), Pedro(194419),
--     Sarah(194420), Leslie(203286), Controladoria/Nicole(128861).
--   eligible_complex=true (só 4): Keilane(207254), Maxwel(131018),
--     Wdyson(131022), Ana Patrícia(131021).
--   Wdyson(131022): planilha veio peticionante=Não×participa=Sim (contraditório) —
--     deixado COMO ESTÁ (fica fora do pool); só recebe eligible_complex.
--   Demais (joão 131873, Pablo 131484, suporte 131016, Hyago 130405): peticionante=Não.
--
-- Aplicar via:
--   npx tsx scripts/db-apply-pg.ts supabase/migrations/20260808000090_seed_motor_flags_preview.sql
-- ============================================================================

DO $$
DECLARE v_org UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- FILA GERAL: peticionante + participa.
  UPDATE system_users u SET peticionante = true, participa_distribuicao_padrao = true, updated_at = now()
  FROM system_projuris_executor_mapping m
  WHERE m.executor_id = u.id AND m.organization_id = v_org
    AND m.projuris_responsavel_id IN ('207254', '131018');

  -- POOL por EXCEÇÃO: peticionante = true, participa = false.
  UPDATE system_users u SET peticionante = true, participa_distribuicao_padrao = false, updated_at = now()
  FROM system_projuris_executor_mapping m
  WHERE m.executor_id = u.id AND m.organization_id = v_org
    AND m.projuris_responsavel_id IN
      ('128858', '131021', '204546', '195775', '194419', '194420', '203286', '128861');

  -- eligible_complex: zera todos e liga só os 4.
  UPDATE system_projuris_executor_mapping SET eligible_complex = false WHERE organization_id = v_org;
  UPDATE system_projuris_executor_mapping SET eligible_complex = true
  WHERE organization_id = v_org
    AND projuris_responsavel_id IN ('207254', '131018', '131022', '131021');
END $$;
