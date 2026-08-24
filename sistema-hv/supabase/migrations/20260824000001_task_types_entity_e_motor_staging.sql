-- ============================================================================
-- ONDA 1 — Fundacao do doc "21.08 _ Controladoria" (Thiago) + reuniao 19/08
--
-- Duas mudancas estruturais, ambas ADITIVAS (nada existente e removido ou
-- renomeado; o motor que roda hoje em producao continua funcionando igual):
--
--   A) TIPO DE TAREFA vira ENTIDADE DO SISTEMA (sai de "coisa do motor").
--      Ganha CLASSE (Judicial/Administrativo/Comercial/Financeiro), o flag de
--      "aparece no motor de distribuicao", arquivamento (3 estados: ativo /
--      arquivado / todos), vinculo opcional com o ProJuris e a EXCECAO de
--      responsavel exclusivo por TEMA ("inicial do TMFC e da Patricia").
--      A tarefa do caso (system_case_tasks) passa a ter tipo — o que tambem
--      destrava o "Pedido A" dos Workflows (filtro por tipo no gatilho).
--
--   B) O MOTOR ganha as DUAS ETAPAS HUMANAS que faltavam (doc, paginas 1 e 2):
--      1. system_distribution_movements = andamentos/intimacoes pendentes, onde
--         uma PESSOA decide: arquivar / marcar lido / distribuir tarefa (tipo).
--      2. system_distribution_staging   = as tarefas escolhidas, com todas as
--         variaveis pre-preenchidas pelo sistema e EDITAVEIS antes de rodar.
--      So depois disso o motor atual distribui. "Processo automatizado, e nao
--      automatico" (Thiago, 19/08).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A1. Tipo de tarefa como entidade do sistema
-- ----------------------------------------------------------------------------
ALTER TABLE system_task_type_mapping
  ADD COLUMN IF NOT EXISTS classe TEXT
    CHECK (classe IN ('JUDICIAL', 'ADMINISTRATIVO', 'COMERCIAL', 'FINANCEIRO')),
  ADD COLUMN IF NOT EXISTS aparece_no_motor BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_projuris BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS projuris_classificacao TEXT;

COMMENT ON COLUMN system_task_type_mapping.classe IS
  'Classe interna do SHV (doc 21.08): JUDICIAL/ADMINISTRATIVO/COMERCIAL/FINANCEIRO. NAO e a "Classificacao" do ProJuris (Prazos/Processuais) — essa fica em projuris_classificacao.';
COMMENT ON COLUMN system_task_type_mapping.aparece_no_motor IS
  'Se FALSE, o tipo existe no sistema (workflows, dossie, comercial) mas NAO aparece como opcao no motor de distribuicao.';
COMMENT ON COLUMN system_task_type_mapping.archived_at IS
  'Arquivamento (3 estados: ativo / arquivado / todos). Arquivado some de "criar tarefa" mas continua no legado/espelhamento.';
COMMENT ON COLUMN system_task_type_mapping.sync_projuris IS
  'Se TRUE, o tipo deve existir/refletir no ProJuris. Tarefa COMERCIAL, por exemplo, nunca vai pra la.';
COMMENT ON COLUMN system_task_type_mapping.projuris_classificacao IS
  'Espelho da "Classificacao" do ProJuris (ex.: Prazos, Processuais). Somente leitura do lado de la.';

-- ----------------------------------------------------------------------------
-- A2. Excecao do responsavel exclusivo POR TEMA
--     Regra geral fica em system_task_type_mapping.exclusive_executor_id.
--     Aqui moram as excecoes: "esse tipo, NESTE tema, e do fulano".
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_task_type_theme_exclusives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  task_type_id    UUID NOT NULL REFERENCES system_task_type_mapping(id) ON DELETE CASCADE,
  tema_id         UUID NOT NULL REFERENCES system_temas(id) ON DELETE CASCADE,
  executor_id     UUID NOT NULL REFERENCES system_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES system_users(id),
  CONSTRAINT uq_task_type_theme_exclusive UNIQUE (task_type_id, tema_id)
);

COMMENT ON TABLE system_task_type_theme_exclusives IS
  'Excecao de executor exclusivo por (tipo de tarefa x tema). Precedencia no motor: excecao por tema > exclusivo geral do tipo > exclusivo do tema > distribuicao normal.';

ALTER TABLE system_task_type_theme_exclusives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ttte_select ON system_task_type_theme_exclusives;
CREATE POLICY ttte_select ON system_task_type_theme_exclusives
  FOR SELECT USING (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS ttte_all_service ON system_task_type_theme_exclusives;
CREATE POLICY ttte_all_service ON system_task_type_theme_exclusives
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON system_task_type_theme_exclusives TO authenticated;
GRANT ALL ON system_task_type_theme_exclusives TO service_role;

-- ----------------------------------------------------------------------------
-- A3. Tarefa do caso ganha TIPO (destrava o filtro por tipo nos Workflows).
--     Nullable de proposito: todas as tarefas ja existentes seguem sem tipo.
-- ----------------------------------------------------------------------------
ALTER TABLE system_case_tasks
  ADD COLUMN IF NOT EXISTS task_type_id UUID REFERENCES system_task_type_mapping(id);

CREATE INDEX IF NOT EXISTS idx_system_case_tasks_task_type
  ON system_case_tasks(task_type_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN system_case_tasks.task_type_id IS
  'Tipo da tarefa (catalogo unico system_task_type_mapping). Opcional. O motor de workflows filtra gatilhos de tarefa por este campo.';

-- ----------------------------------------------------------------------------
-- A4. Media diaria de producao vira MANUAL (doc 21.08).
--     Antes o motor inferia a media analisando os ultimos 90 dias; agora e um
--     numero configurado, escolhido pelo MODO de operacao.
--     Valores iniciais pedidos pelo Thiago: 12 (controle) e 15 (producao).
-- ----------------------------------------------------------------------------
ALTER TABLE system_distribution_config
  ADD COLUMN IF NOT EXISTS pontos_dia_controle NUMERIC(6,2) NOT NULL DEFAULT 12.0,
  ADD COLUMN IF NOT EXISTS pontos_dia_producao NUMERIC(6,2) NOT NULL DEFAULT 15.0;

COMMENT ON COLUMN system_distribution_config.pontos_dia_controle IS
  'Media diaria de pontos por pessoa no modo HIGH_CONTROL (manual, doc 21.08).';
COMMENT ON COLUMN system_distribution_config.pontos_dia_producao IS
  'Media diaria de pontos por pessoa no modo HIGH_PRODUCTION (manual, doc 21.08).';

-- ----------------------------------------------------------------------------
-- B1. TELA 1 — Andamentos / intimacoes pendentes de decisao humana
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_distribution_movements (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,

  -- De onde veio a linha.
  origem                  TEXT NOT NULL
                            CHECK (origem IN ('INTIMACAO', 'ANDAMENTO', 'INICIAL_SHV')),
  projuris_id             TEXT,
  projuris_processo_codigo TEXT,
  numero_cnj              TEXT,

  -- Conteudo exibido na lista.
  descricao               TEXT,
  cliente_nome            TEXT,
  data_referencia         DATE,
  raw                     JSONB,

  -- Vinculo com o SHV (quando conseguimos casar o processo com um caso).
  case_id                 UUID REFERENCES system_cases(id) ON DELETE SET NULL,
  tema_id                 UUID REFERENCES system_temas(id) ON DELETE SET NULL,

  -- A DECISAO HUMANA (o coracao da tela 1).
  decisao                 TEXT NOT NULL DEFAULT 'PENDENTE'
                            CHECK (decisao IN ('PENDENTE', 'ARQUIVADO', 'LIDO', 'DISTRIBUIR')),
  task_type_id            UUID REFERENCES system_task_type_mapping(id),
  decidido_por            UUID REFERENCES system_users(id),
  decidido_em             TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotencia do sync: a mesma intimacao/andamento nao entra duas vezes.
  CONSTRAINT uq_dist_movement_origem_id UNIQUE (organization_id, origem, projuris_id)
);

COMMENT ON TABLE system_distribution_movements IS
  'Pagina 1 do motor (doc 21.08): listagem crua do ProJuris (intimacoes/andamentos) + iniciais mandadas pela ficha Judicial. O sistema NAO decide nada aqui — so registra a decisao da pessoa.';

CREATE INDEX IF NOT EXISTS idx_dist_movements_pendentes
  ON system_distribution_movements(organization_id, data_referencia DESC)
  WHERE decisao = 'PENDENTE';
CREATE INDEX IF NOT EXISTS idx_dist_movements_case
  ON system_distribution_movements(case_id);

DROP TRIGGER IF EXISTS trg_dist_movements_updated_at ON system_distribution_movements;
CREATE TRIGGER trg_dist_movements_updated_at
  BEFORE UPDATE ON system_distribution_movements
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

ALTER TABLE system_distribution_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dist_movements_select ON system_distribution_movements;
CREATE POLICY dist_movements_select ON system_distribution_movements
  FOR SELECT USING (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS dist_movements_all_service ON system_distribution_movements;
CREATE POLICY dist_movements_all_service ON system_distribution_movements
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON system_distribution_movements TO authenticated;
GRANT ALL ON system_distribution_movements TO service_role;

-- ----------------------------------------------------------------------------
-- B2. TELA 2 — Tarefas a distribuir (variaveis pre-preenchidas e EDITAVEIS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_distribution_staging (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  movement_id           UUID REFERENCES system_distribution_movements(id) ON DELETE CASCADE,

  -- Identificacao (vem do movimento / do caso).
  case_id               UUID REFERENCES system_cases(id) ON DELETE SET NULL,
  tema_id               UUID REFERENCES system_temas(id) ON DELETE SET NULL,
  task_type_id          UUID REFERENCES system_task_type_mapping(id),
  numero_cnj            TEXT,
  cliente_nome          TEXT,

  -- Variaveis do motor: o sistema sugere, a pessoa pode trocar TUDO na mao.
  coletivo              BOOLEAN NOT NULL DEFAULT FALSE,
  complexo              BOOLEAN NOT NULL DEFAULT FALSE,
  urgente               BOOLEAN NOT NULL DEFAULT FALSE,
  exclusive_executor_id UUID REFERENCES system_users(id),
  data_prevista         DATE,
  data_fatal            DATE,
  pontos                NUMERIC(10,4),

  -- O que a pessoa alterou em relacao ao sugerido (auditoria da tela 2).
  overrides             JSONB NOT NULL DEFAULT '{}'::jsonb,

  status                TEXT NOT NULL DEFAULT 'ABERTA'
                          CHECK (status IN ('ABERTA', 'DISTRIBUIDA', 'CANCELADA')),
  distribuido_em        TIMESTAMPTZ,
  distribuido_por       UUID REFERENCES system_users(id),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE system_distribution_staging IS
  'Pagina 2 do motor (doc 21.08): so o que a pessoa marcou como "distribuir". O sistema pontua e preenche as variaveis; a revisao humana acontece AQUI, antes de o motor rodar.';

CREATE INDEX IF NOT EXISTS idx_dist_staging_abertas
  ON system_distribution_staging(organization_id, created_at DESC)
  WHERE status = 'ABERTA';
CREATE INDEX IF NOT EXISTS idx_dist_staging_movement
  ON system_distribution_staging(movement_id);

DROP TRIGGER IF EXISTS trg_dist_staging_updated_at ON system_distribution_staging;
CREATE TRIGGER trg_dist_staging_updated_at
  BEFORE UPDATE ON system_distribution_staging
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();

ALTER TABLE system_distribution_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dist_staging_select ON system_distribution_staging;
CREATE POLICY dist_staging_select ON system_distribution_staging
  FOR SELECT USING (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS dist_staging_all_service ON system_distribution_staging;
CREATE POLICY dist_staging_all_service ON system_distribution_staging
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON system_distribution_staging TO authenticated;
GRANT ALL ON system_distribution_staging TO service_role;
