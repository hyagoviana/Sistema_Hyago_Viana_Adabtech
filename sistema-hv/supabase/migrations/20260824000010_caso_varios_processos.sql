-- ============================================================================
-- Um CASO pode ter VÁRIOS processos judiciais.
--
-- Decisão do Thiago (24/08), que corrige uma premissa nossa. O ProJuris só
-- registra processo JUDICIAL; o caso é coisa nossa e nem sempre vira processo
-- (há os administrativos). E, quando vira, pode virar mais de um:
--
--   "existe a possibilidade do mesmo caso ter mais de um processo judicial (…)
--    e existe a possibilidade do mesmo caso ter um processo judicial e um
--    processo que a gente chama de incidental, que são os recursos. Esse recurso
--    no tribunal tem um número de processo e um andamento exclusivo."
--
-- E ainda: "a mesma pessoa ter dois casos e cada um deles ter dois processos".
--
-- Por que uma tabela nova em vez de trocar a coluna:
--
-- `system_cases.projuris_codigo_processo` é lido em cinco lugares (motor, fila
-- da controladoria, espelho de tarefas, sincronização judicial, urgência).
-- Trocá-la por uma lista obrigaria a mexer em todos de uma vez. Em vez disso,
-- ela passa a significar "o processo PRINCIPAL do caso" — continua respondendo
-- a mesma pergunta para quem já perguntava — e a lista completa vive aqui.
--
-- A amarração é MANUAL por decisão explícita: "a gente vai selecionar quais os
-- processos do ProJuris a gente quer vincular naquele caso (…) porque aí evita
-- do sistema ter que ir e fazer essa identificação". O sistema sugere; quem
-- decide é a controladoria.
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_case_projuris_processos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id           UUID NOT NULL REFERENCES system_cases(id) ON DELETE CASCADE,

  -- Identificação do processo no ProJuris.
  codigo_processo   BIGINT NOT NULL,
  identificador     TEXT,          -- PRO.0005235, que é o que a pessoa reconhece
  numero_cnj        TEXT,
  assunto           TEXT,

  -- O principal é o que responde por "o processo do caso" para quem só sabe
  -- lidar com um. Exatamente um por caso (garantido pelo índice abaixo).
  principal         BOOLEAN NOT NULL DEFAULT FALSE,

  -- "processo relacionado, processo incidental, que é os recursos" — o ProJuris
  -- faz essa distinção e ela importa para a leitura humana. Texto livre porque
  -- ainda não sabemos a lista fechada dos tipos de lá.
  relacao           TEXT,

  vinculado_por     UUID REFERENCES system_users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- O mesmo processo não entra duas vezes no mesmo caso.
  CONSTRAINT uq_caso_processo UNIQUE (case_id, codigo_processo)
);

COMMENT ON TABLE system_case_projuris_processos IS
  'Processos judiciais do ProJuris vinculados a um caso do SHV. Vínculo MANUAL, feito pela controladoria (decisão do Thiago em 24/08). Um caso pode ter vários: o principal, os relacionados e os incidentais (recursos).';

-- Um principal por caso, no máximo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_caso_processo_principal
  ON system_case_projuris_processos(case_id)
  WHERE principal;

CREATE INDEX IF NOT EXISTS idx_caso_processo_codigo
  ON system_case_projuris_processos(organization_id, codigo_processo);

-- ----------------------------------------------------------------------------
-- Backfill: os vínculos que já existem viram o processo PRINCIPAL de cada caso.
-- ----------------------------------------------------------------------------
INSERT INTO system_case_projuris_processos
  (organization_id, case_id, codigo_processo, numero_cnj, principal)
SELECT c.organization_id, c.id, c.projuris_codigo_processo, c.projuris_numero_processo, TRUE
  FROM system_cases c
 WHERE c.projuris_codigo_processo IS NOT NULL
   AND c.deleted_at IS NULL
ON CONFLICT (case_id, codigo_processo) DO NOTHING;

-- ----------------------------------------------------------------------------
-- RLS: mesma regra dos casos — quem enxerga o caso enxerga seus processos.
-- ----------------------------------------------------------------------------
ALTER TABLE system_case_projuris_processos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caso_processos_leitura ON system_case_projuris_processos;
CREATE POLICY caso_processos_leitura ON system_case_projuris_processos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM system_cases c WHERE c.id = case_id AND c.deleted_at IS NULL));

-- Escrita só pelo servidor (service role), que é onde o gate de módulo vive.
DROP POLICY IF EXISTS caso_processos_escrita ON system_case_projuris_processos;
CREATE POLICY caso_processos_escrita ON system_case_projuris_processos
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

COMMENT ON COLUMN system_cases.projuris_codigo_processo IS
  'Processo PRINCIPAL do caso. A lista completa está em system_case_projuris_processos — esta coluna é mantida em sincronia com a linha marcada como principal.';

-- ----------------------------------------------------------------------------
-- GRANTs. Sem isto a tabela nasce inacessível até para o service role — o erro
-- é "permission denied", que se parece com RLS mas é outra coisa (RLS filtra
-- linhas; GRANT dá acesso à tabela). Mesmo par das demais tabelas do motor.
-- ----------------------------------------------------------------------------
GRANT SELECT ON system_case_projuris_processos TO authenticated;
GRANT ALL    ON system_case_projuris_processos TO service_role;
