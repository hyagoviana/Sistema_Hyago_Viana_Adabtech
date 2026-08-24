-- ============================================================================
-- MENU JUDICIAL DA FICHA — "aparece na linha do tempo do caso"
--
-- Doc "21.08 _ Controladoria", parte do menu Judicial:
--   "Opção para marcar se esse andamento também aparece na linha do tempo da
--    ficha do caso. (tarefas por padrão sempre aparecem no painel próprio)"
--
-- Os andamentos NÃO são persistidos: vêm ao vivo do ProJuris
-- (POST /v2/processo-andamento/consulta) a cada abertura. Persistir todos eles
-- só para permitir a marcação seria caro e frágil (o endpoint é instável).
-- Então guardamos apenas a MARCAÇÃO: qual andamento alguém escolheu promover
-- para a linha do tempo do caso, e qual evento isso gerou lá — o que permite
-- desmarcar sem deixar lixo na timeline.
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_case_judicial_andamento_pins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id         UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,

  -- Identidade do andamento do lado do ProJuris (código quando existe; senão um
  -- hash estável de data+descrição montado pelo app).
  andamento_key   TEXT NOT NULL,

  -- Evento gerado na linha do tempo do caso (system_case_events). Guardado para
  -- que "desmarcar" remova exatamente aquele evento.
  event_id        UUID,

  descricao       TEXT,
  data_andamento  DATE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES system_users(id),

  CONSTRAINT uq_judicial_andamento_pin UNIQUE (case_id, andamento_key)
);

COMMENT ON TABLE system_case_judicial_andamento_pins IS
  'Andamentos do ProJuris promovidos manualmente para a linha do tempo do caso (doc 21.08, menu Judicial).';

CREATE INDEX IF NOT EXISTS idx_judicial_andamento_pins_case
  ON system_case_judicial_andamento_pins(case_id);

ALTER TABLE system_case_judicial_andamento_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS judicial_pins_select ON system_case_judicial_andamento_pins;
CREATE POLICY judicial_pins_select ON system_case_judicial_andamento_pins
  FOR SELECT USING (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS judicial_pins_all_service ON system_case_judicial_andamento_pins;
CREATE POLICY judicial_pins_all_service ON system_case_judicial_andamento_pins
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON system_case_judicial_andamento_pins TO authenticated;
GRANT ALL ON system_case_judicial_andamento_pins TO service_role;
