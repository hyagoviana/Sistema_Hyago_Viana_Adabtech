-- ============================================================================
-- Sistema HV — Migration — FN1 — FINANCEIRO DO CASO (fundação, sem API)
-- ----------------------------------------------------------------------------
-- Doc "25.08 _ Financeiro SHV" (Thiago). A ideia central, nas palavras dele:
--
--   "O ContaAzul representa um ERP financeiro onde administramos o grosso dos
--    recebíveis e a pagar (…) Mas até para fins de organização interna, também
--    defini a possibilidade de que valores sejam registrados/cadastrados no SHV,
--    SEM necessariamente serem lançados no ContaAzul. Assim garantimos que
--    valores que temos que pagar/receber sejam visualizados (…) em razão de uma
--    especificidade da advocacia: parte dos valores são questões futuras e que
--    dependem de outra situação."
--
-- Por isso o registro nasce AQUI e o lançamento no ERP é um passo separado
-- (status AGUARDANDO → LANCADO), que a FN2 vai automatizar.
--
-- DECISÃO DO OWNER (2026-08-26): tabelas NOVAS. `system_parcelas` continua sendo
-- só a COBRANÇA emitida (Asaas/ContaAzul), que já roda em produção e alimenta
-- inadimplência e relatório. Forçar este modelo lá dentro arriscaria os três de
-- uma vez. O vínculo entre lançamento e cobrança fica para a FN2.
--
-- Três tabelas + dois campos no tema:
--   system_fin_categorias           árvore de categorias do ContaAzul (com código)
--   system_case_fin_entries         o lançamento (receita ou despesa) do caso
--   system_case_fin_installments    as parcelas do lançamento
--   system_temas.contaazul_*        centro de custo e serviço, POR TEMA (Desenho 6)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CATEGORIAS FINANCEIRAS (a árvore do doc, com o código do ContaAzul)
--
-- Hierarquia livre por `parent_id` porque o doc tem 3 níveis na receita
-- (Fiscal/Gerencial → natureza → tipo) e 2 na despesa. O `codigo` é o do
-- ContaAzul (4.01.01.01) — é ele que a FN2 usa para lançar.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_fin_categorias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  kind            TEXT NOT NULL CHECK (kind IN ('RECEITA', 'DESPESA')),
  codigo          TEXT NOT NULL,
  nome            TEXT NOT NULL,
  parent_id       UUID REFERENCES system_fin_categorias(id) ON DELETE CASCADE,
  -- Só para despesa: a categoria é do balde "reembolsável"? É o que destrava a
  -- chave de reembolso no formulário e a receita-espelho automática.
  reembolsavel    BOOLEAN NOT NULL DEFAULT FALSE,
  -- Preenchido quando a categoria for casada com o ID real do ContaAzul (FN2).
  contaazul_id    TEXT,
  ordem           INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT uq_fin_categoria_codigo UNIQUE (organization_id, codigo)
);

COMMENT ON TABLE system_fin_categorias IS
  'FN1: arvore de categorias financeiras espelhando o ContaAzul (doc 25.08). `codigo` e o codigo de la (ex.: 4.01.01.01); `contaazul_id` e preenchido na FN2.';

CREATE INDEX IF NOT EXISTS idx_fin_categorias_org ON system_fin_categorias(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fin_categorias_parent ON system_fin_categorias(parent_id);

-- ----------------------------------------------------------------------------
-- 2. LANÇAMENTO DO CASO (receita ou despesa)
--
-- Status (doc): Aguardando | Dispensado | Lançado.
--   AGUARDANDO — registrado aqui, ainda não foi ao ERP
--   DISPENSADO — decidiu-se que não vai ao ERP (o "valor futuro que não se
--                confirmou" da advocacia)
--   LANCADO    — existe no ContaAzul (a FN2 preenche `contaazul_registro_id`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_fin_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  case_id         UUID NOT NULL REFERENCES system_cases(id) ON DELETE RESTRICT,

  kind            TEXT NOT NULL CHECK (kind IN ('RECEITA', 'DESPESA')),
  -- Vocabulário do SHV (doc, "MAPA - CLASSIFICAÇÕES E CAMPOS"). A categoria do
  -- ContaAzul vem por `categoria_id`; o tipo é como NÓS chamamos.
  tipo            TEXT NOT NULL CHECK (tipo IN (
                    -- receitas
                    'ENTRADA', 'EXITO', 'RESCISAO', 'CONSULTA_PARECER',
                    'RECUPERADOS_ACORDO_RENEGOCIACAO',
                    'REEMBOLSO_CUSTAS', 'REEMBOLSO_DILIGENCIAS', 'REEMBOLSO_OUTRAS',
                    -- despesas
                    'CUSTAS_TAXAS_EMOLUMENTOS', 'DILIGENCIAS')),
  categoria_id    UUID REFERENCES system_fin_categorias(id),

  status          TEXT NOT NULL DEFAULT 'AGUARDANDO'
                    CHECK (status IN ('AGUARDANDO', 'DISPENSADO', 'LANCADO')),

  descricao       TEXT,
  valor_centavos  BIGINT NOT NULL CHECK (valor_centavos >= 0),

  -- Recebimento (receita) / pagamento (despesa)
  forma_pagamento TEXT,
  conta_financeira TEXT,
  data_vencimento DATE,

  -- Parcelamento (receita) — `parcelas = 1` é a "venda avulsa" do doc.
  parcelas        INTEGER NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 240),
  periodicidade_meses INTEGER NOT NULL DEFAULT 1 CHECK (periodicidade_meses BETWEEN 1 AND 12),

  -- Despesa
  fornecedor      TEXT,
  recorrente      BOOLEAN NOT NULL DEFAULT FALSE,
  reembolsavel    BOOLEAN NOT NULL DEFAULT FALSE,
  -- Quando a despesa é reembolsável, o sistema cria uma RECEITA pendente com as
  -- mesmas informações. Este campo liga a receita à despesa que a originou.
  origem_despesa_id UUID REFERENCES system_case_fin_entries(id) ON DELETE SET NULL,

  -- Preenchido pela FN2 (integração). Aqui só existe a coluna.
  contaazul_registro_id TEXT,
  contaazul_sync_at     TIMESTAMPTZ,
  contaazul_sync_error  TEXT,

  created_by      UUID REFERENCES system_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

COMMENT ON TABLE system_case_fin_entries IS
  'FN1: receita/despesa registrada NO CASO (doc 25.08). Pode existir sem ir ao ContaAzul (status AGUARDANDO/DISPENSADO) — e essa e justamente a razao de existir.';
COMMENT ON COLUMN system_case_fin_entries.origem_despesa_id IS
  'FN1: preenchido na RECEITA criada automaticamente a partir de uma DESPESA reembolsavel.';

CREATE INDEX IF NOT EXISTS idx_fin_entries_case ON system_case_fin_entries(case_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fin_entries_status ON system_case_fin_entries(organization_id, status) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. PARCELAS do lançamento
--
-- O doc pede "Revisar parcelas": ver todas as que serão criadas e editar
-- vencimento/valor de uma específica. Por isso a parcela é linha, não cálculo.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_case_fin_installments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES system_organizations(id) ON DELETE RESTRICT,
  entry_id        UUID NOT NULL REFERENCES system_case_fin_entries(id) ON DELETE CASCADE,

  numero          INTEGER NOT NULL CHECK (numero >= 1),
  data_vencimento DATE NOT NULL,
  valor_centavos  BIGINT NOT NULL CHECK (valor_centavos >= 0),

  status          TEXT NOT NULL DEFAULT 'AGUARDANDO'
                    CHECK (status IN ('AGUARDANDO', 'VENCIDA', 'PAGA', 'CANCELADA')),
  valor_pago_centavos BIGINT,
  data_pagamento  DATE,

  contaazul_parcela_id TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fin_installment_numero UNIQUE (entry_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_fin_installments_entry ON system_case_fin_installments(entry_id);

-- ----------------------------------------------------------------------------
-- 4. TEMA → ContaAzul (Desenho 6 do doc)
--
-- "Após criarmos as classificações no Contaazul, nessa opção aqui vinculamos
--  manualmente qual o centro de custo / serviço é relacionado ao tema. Assim o
--  SHV já tem nativamente a informação para o registro das despesas / receitas."
--
-- É POR TEMA, não por caso — o Thiago repetiu isso na reunião ("sempre que a
-- gente for trabalhar um tema, ele é para tudo").
-- ----------------------------------------------------------------------------
ALTER TABLE system_temas
  ADD COLUMN IF NOT EXISTS contaazul_centro_custo_id   TEXT,
  ADD COLUMN IF NOT EXISTS contaazul_centro_custo_nome TEXT,
  ADD COLUMN IF NOT EXISTS contaazul_servico_id        TEXT,
  ADD COLUMN IF NOT EXISTS contaazul_servico_nome      TEXT;

COMMENT ON COLUMN system_temas.contaazul_centro_custo_id IS
  'FN1 (Desenho 6 do doc 25.08): centro de custo do ContaAzul deste tema. 1 centro de custo por tema.';

-- ----------------------------------------------------------------------------
-- 5. RLS — leitura pela organização; escrita só service_role (os RPCs gateiam
--    por `financeiro`, mesmo padrão do resto do módulo).
-- ----------------------------------------------------------------------------
ALTER TABLE system_fin_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_case_fin_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_case_fin_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_categorias_select ON system_fin_categorias;
CREATE POLICY fin_categorias_select ON system_fin_categorias
  FOR SELECT USING (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS fin_categorias_service ON system_fin_categorias;
CREATE POLICY fin_categorias_service ON system_fin_categorias
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS fin_entries_select ON system_case_fin_entries;
CREATE POLICY fin_entries_select ON system_case_fin_entries
  FOR SELECT USING (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS fin_entries_service ON system_case_fin_entries;
CREATE POLICY fin_entries_service ON system_case_fin_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS fin_installments_select ON system_case_fin_installments;
CREATE POLICY fin_installments_select ON system_case_fin_installments
  FOR SELECT USING (organization_id = system_current_organization_id());
DROP POLICY IF EXISTS fin_installments_service ON system_case_fin_installments;
CREATE POLICY fin_installments_service ON system_case_fin_installments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON system_fin_categorias, system_case_fin_entries, system_case_fin_installments TO authenticated;
GRANT ALL ON system_fin_categorias, system_case_fin_entries, system_case_fin_installments TO service_role;

-- ----------------------------------------------------------------------------
-- 6. updated_at
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_fin_categorias_updated_at ON system_fin_categorias;
CREATE TRIGGER trg_fin_categorias_updated_at BEFORE UPDATE ON system_fin_categorias
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();
DROP TRIGGER IF EXISTS trg_fin_entries_updated_at ON system_case_fin_entries;
CREATE TRIGGER trg_fin_entries_updated_at BEFORE UPDATE ON system_case_fin_entries
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();
DROP TRIGGER IF EXISTS trg_fin_installments_updated_at ON system_case_fin_installments;
CREATE TRIGGER trg_fin_installments_updated_at BEFORE UPDATE ON system_case_fin_installments
  FOR EACH ROW EXECUTE FUNCTION system_update_updated_at_column();
