-- ============================================================================
-- Dívidas técnicas apontadas pelo QA de 2026-08-24 (nenhuma era bloqueador).
--
-- 1. ÍNDICES para as consultas que as telas realmente fazem. Os índices criados
--    junto com as tabelas cobrem só os estados "quentes" (PENDENTE / ABERTA);
--    as listagens de histórico e o filtro "todas" caíam em Seq Scan. Irrelevante
--    com 300 linhas — mas a fila cresce ~80/dia, e o histórico nunca é apagado.
--
-- 2. `search_path` das funções SECURITY DEFINER sem `pg_temp`. Quando ele não é
--    listado, o Postgres pesquisa o schema temporário PRIMEIRO para nomes de
--    relação. A recomendação da documentação é listá-lo por último.
--
-- 3. FK faltando em `event_id`: o pin de andamento aponta para um evento da
--    timeline só por convenção. Se o evento for apagado, "desmarcar" não acha
--    nada e o pin fica alegando um item que não existe mais.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Índices
-- ----------------------------------------------------------------------------

-- listMovements com filtro "todas" (ordena por data de referência).
CREATE INDEX IF NOT EXISTS idx_dist_movements_org_data
  ON system_distribution_movements(organization_id, data_referencia DESC);

-- Histórico de andamentos: tudo que já foi decidido, mais recente primeiro.
CREATE INDEX IF NOT EXISTS idx_dist_movements_decididos
  ON system_distribution_movements(organization_id, decidido_em DESC)
  WHERE decisao <> 'PENDENTE';

-- Histórico de tarefas: o que o motor distribuiu.
CREATE INDEX IF NOT EXISTS idx_dist_staging_distribuidas
  ON system_distribution_staging(organization_id, distribuido_em DESC)
  WHERE status = 'DISTRIBUIDA';

-- Exceções por tema são sempre lidas por organização (task-types-service).
CREATE INDEX IF NOT EXISTS idx_task_type_theme_exclusives_org
  ON system_task_type_theme_exclusives(organization_id);

-- ----------------------------------------------------------------------------
-- 2. search_path com pg_temp (por último, como manda a doc do Postgres)
-- ----------------------------------------------------------------------------
ALTER FUNCTION system_merge_case_canonical_fields(UUID, JSONB)
  SET search_path = public, pg_temp;
ALTER FUNCTION system_merge_client_custom_fields(UUID, JSONB)
  SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 3. FK do evento no pin de andamento
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_judicial_andamento_pin_event'
  ) THEN
    -- Limpa referências já órfãs antes de criar a restrição.
    UPDATE system_case_judicial_andamento_pins p
       SET event_id = NULL
     WHERE p.event_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM system_case_events e WHERE e.id = p.event_id);

    ALTER TABLE system_case_judicial_andamento_pins
      ADD CONSTRAINT fk_judicial_andamento_pin_event
      FOREIGN KEY (event_id) REFERENCES system_case_events(id) ON DELETE SET NULL;
  END IF;
END $$;
