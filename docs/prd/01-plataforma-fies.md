# 📋 PRD Projeto 1 — Plataforma Unificada + Sistema FIES

> **Plataforma Unificada Hyago Viana Advocacia**
> **Versão:** 1.0 · **Data:** 2026-05-15 · **Owners:** @pm (lead) + @architect + @qa · **Orquestração:** Orion
> **Status:** Aprovado para épicos/stories
>
> Este é o **módulo fundação**. Consome PRD Master + PRD 0. É a primeira entrega.

> ⚠ **Alinhamento com estratégia design-first (v1.1):**
> Quando este PRD entrar em execução (Fase **F4** do roadmap), todas as 95 telas internas + 14 telas do Portal do Cliente **JÁ ESTARÃO IMPLEMENTADAS** em Next.js com fixtures (saída de F2). Os épicos abaixo são portanto **"aplicar lógica e backend sobre telas prontas"**, NÃO "construir UI do zero". Visual e navegação já estão validados (F3). O foco aqui é: schema Supabase, RLS, Edge Functions, n8n workflows, integrações reais, migração dos 2.500 casos.

---

## Sumário

1. [Visão e escopo](#1-visão-e-escopo)
2. [Personas e jornadas](#2-personas-e-jornadas)
3. [Tipos de caso e modelos específicos](#3-tipos-de-caso-e-modelos-específicos)
4. [Dois rastros — estados e transições](#4-dois-rastros--estados-e-transições)
5. [Schema do Projeto 1 (tabelas específicas)](#5-schema-do-projeto-1)
6. [Épicos e User Stories](#6-épicos-e-user-stories)
7. [Telas detalhadas](#7-telas-detalhadas)
8. [Fluxos operacionais (POPs)](#8-fluxos-operacionais)
9. [Fluxo financeiro unificado](#9-fluxo-financeiro-unificado)
10. [Termo de Acerto — regras imutáveis](#10-termo-de-acerto)
11. [Aprovação jurídica híbrida](#11-aprovação-jurídica-híbrida)
12. [Integrações desse módulo](#12-integrações-deste-módulo)
13. [Portal do Cliente](#13-portal-do-cliente)
14. [Migração — plano detalhado](#14-migração-detalhada)
15. [Notificações específicas](#15-notificações-específicas)
16. [Dashboards e relatórios](#16-dashboards-e-relatórios)
17. [Critérios de aceitação](#17-critérios-de-aceitação)
18. [Riscos específicos](#18-riscos-específicos)

---

## 1. Visão e escopo

### 1.1 Visão

> Substituir Excel + Trello + Drive informal por **plataforma única** onde toda demanda jurídica do escritório nasce, tramita e arquiva. Modelo orientado a eventos com **base canônica única** consumida pelos Projetos 2–6.

### 1.2 Em escopo (V1 do Projeto 1)

- ✅ Cadastro unificado de clientes (PF/PJ) com atributos profissionais.
- ✅ Cliente 360° + dossiê do caso (5 abas).
- ✅ Pipeline Operacional (10 colunas) + Pipeline Financeira (15 colunas) com 8 views complementares.
- ✅ **Dois rastros independentes:** operacional e financeiro com bifurcação automática em IMPLANTADO.
- ✅ Implementação dos **5 fluxos POP**: FIES ESF/DGM, FIES ESF/Portaria, FIES Militar, FIES COVID, Fluxo Financeiro.
- ✅ **Termo de Acerto** com snapshots imutáveis (v1, v2…), aprovação jurídica híbrida.
- ✅ Integrações: ZapSign, Google Drive, Gmail, Postmark, Conta Azul, Asaas, ChatGuru, SEI scraping, CNES scraping, Gov.br protocolo.
- ✅ **Portal do Cliente** (mobile-first) com aceite Termo, upload docs, boletos, mensagens.
- ✅ **Migração assistida** dos ~2.500 casos FIES + demais ativos.
- ✅ **Outros tipos de caso (esqueleto):** Mais Médicos (indenização), Mais Médicos (eixo formação), Residência Médica (auxílio-moradia, CNRM), possessória, trabalhista, defesa CFM/CRM, MS previdenciário/saúde. Para esses: cadastro + dossiê básico; fluxos detalhados em iterações futuras.

### 1.3 Fora de escopo (vai para outros PRDs)

- ❌ Integração Projuris bidirecional → **PRD 2**
- ❌ Geração de minutas por IA → **PRD 3**
- ❌ CRM comercial / leads → **PRD 4**
- ❌ Marketing/conteúdo → **PRD 5**
- ❌ Agente WhatsApp triagem → **PRD 6**

> Este PRD **fornece o substrato** que os demais consomem.

---

## 2. Personas e jornadas

### 2.1 Personas internas

| Persona | Nome usado | Objetivos | Frustrações atuais |
|---|---|---|---|
| **Administrador** | Dr. Hyago Viana | Visão executiva, decisões estratégicas, override | Dependência de relatórios manuais |
| **Comercial pré-contratual** | Camila (atendente) | Captar lead, fechar contrato | WhatsApp informal, perde lead |
| **ADM/Operacional** | Maria Santos | Coletar docs, protocolar | Planilha + Drive desconexos |
| **Operacional (OPE)** | Carlos | Consultar CNES, CFM, montar processo | Multi-abas, copy-paste |
| **Jurídico (JUR)** | Dra. Patrícia | QA documentos, aprovar Termo, judicializar | Sem visibilidade do volume |
| **Financeiro (FIN)** | Pedro Lima | Elaborar Termo, cobrar parcelas | Excel descontrolado |
| **Controladoria** | (Projeto 2) | Monitorar prazos | (fora deste PRD) |

### 2.2 Persona externa

| Persona | Nome | Objetivo |
|---|---|---|
| **Cliente do escritório** | Dr. João Silva (médico ESF) | Acompanhar caso sem precisar ligar; aceitar Termo; pagar boletos |

### 2.3 Jornada-mãe: novo caso FIES ESF/DGM

```
1. Lead conversa via WhatsApp (Projeto 6) ou indicação
2. Comercial envia contrato + procuração ZapSign
3. Cliente assina → webhook ZapSign cria Cliente + Caso (Caminho A)
4. Sistema cria pasta Drive + envia boas-vindas
5. ADM coleta docs (cliente envia via Portal/WhatsApp)
6. OPE consulta CFM/CNES, monta DGM
7. DGM enviada à prefeitura (responsável assina)
8. JUR aprova QA da DGM
9. OPE protocola requerimento no eGov → registra NUP
10. SEI scraping monitora → resposta MS chega via Gmail
11. JUR analisa, decide:
    - Deferido → caso vai a IMPLANTADO
    - Indeferido/sem resposta → JUDICIAL_OPERACIONAL (Projuris)
12. IMPLANTADO → bifurcação automática
13. FIN elabora Termo → conferidor confere → JUR aprova → apresenta ao cliente
14. Cliente aceita via Portal → ATIVO → parcelas geradas
15. Cobrança mensal → quitação → arquivamento
```

---

## 3. Tipos de caso e modelos específicos

### 3.1 Matriz tipo × particularidades

| Tipo | Triagem op? | DGM? | Doc específico | Período | Bifurcação fin? |
|---|---|---|---|---|---|
| **FIES_ESF_DGM** | Sim (TRIAGEM) | Sim | DGM (gerada) | renovável anual | Sim |
| **FIES_ESF_PORTARIA** | Sim | Não | Portaria municipal verificada | renovável anual | Sim |
| **FIES_MILITAR** | Sim | Não | Comprovação militar | único | Sim |
| **FIES_COVID** | **Não** (pré-qualificado) | Não | Declaração COVID municipal | Mar/2020-Mai/2022 (máx 27 meses) | Sim |
| **MAIS_MEDICOS_INDENIZACAO** | Sim | Não | Comprovações vínculo PMMB | conforme contrato | Não (estrutura genérica V1) |
| **RESIDENCIA_AUXILIO_MORADIA** | Sim | Não | Termo residência + endereço | conforme programa | Não V1 |
| **POSSESSORIA** | Sim | Não | Documentos imóvel | n/a | Não V1 |
| **DEFESA_CFM_CRM** | Sim | Não | Notificação CFM | n/a | Não V1 |

### 3.2 Detalhamento FIES_COVID

**Característica distintiva:** triagem é **pré-contratual** (paciente já qualificado pelo Comercial). Caso entra direto em `DOCS_PENDENTES`.

**Forma de comprovação (`covid_forma_comprovacao`):**
- `DECLARACAO_APENAS` — só Declaração COVID municipal
- `CNES_APENAS` — só vínculo CNES no período
- `DECLARACAO_MAIS_CNES` — ambos (preferível)

**Doc 06 (Declaração COVID):**
- Gerado automaticamente pelo sistema com merge `Cliente + Caso`.
- Modelo padrão do escritório.
- Cliente leva ao Secretário Municipal de Saúde para assinatura.
- **QA jurídico obrigatório** (checklist 7 itens):
  1. Brasão municipal presente
  2. Identificação do ente + CPF do médico
  3. Médico nominado completo
  4. Período entre Mar/2020 e Mai/2022
  5. Natureza do vínculo descrita
  6. Assinatura do Secretário + cargo legível
  7. Data de emissão recente (< 90d)

**Período pleiteável:** máximo 27 meses (limite legal).

**Judicialização é regra**, não exceção (sem regulamentação clara).

### 3.3 Detalhamento FIES_ESF_DGM

**DGM = Declaração de Gestão Municipal.**

- Gerada pelo sistema automaticamente.
- OPE envia ao cliente/prefeitura via Portal/WhatsApp.
- Cliente (ou OPE em alguns casos) leva à Prefeitura para Prefeito assinar.
- Sistema rastreia:
  - `dgm_enviada_data`
  - `dgm_retorno_status`: `PENDENTE | ASSINADA | RECUSADA | INDISPONIVEL`
  - `sem_exito_dgm` (flag): caso prefeitura não devolva
- Follow-up intensificado (régua D+7, D+15, D+30).

**Inteligência por município:**
- Sistema acumula taxa histórica: "Aparecida de Goiânia 75% DGM assinadas, última em 08/2025 por Dr. Fulano".
- Sugestão de **plano B** se taxa < 50%: já preparar para ESF_PORTARIA ou judicializar mais cedo.

**Renovação:** ESF é anual. Em janeiro, casos válidos são candidatos a renovação automática (origem `RENOVACAO`, herança de dados).

### 3.4 Detalhamento FIES_ESF_PORTARIA

- Município já listado em portaria oficial → DGM dispensada.
- Pula direto de TRIAGEM para DOCS_PENDENTES.
- Mais rápido e previsível.

### 3.5 Detalhamento FIES_MILITAR

- Comprovação via documentos militares (FAB, Exército, Marinha).
- Único (sem renovação).
- Caso de menor volume.

---

## 4. Dois rastros — estados e transições

### 4.1 Rastro operacional (8 estados)

```
        ┌──────────┐
        │ONBOARDING│  ← criado via ZapSign ou manual
        └────┬─────┘
             │ docs início OK
        ┌────▼─────┐
        │ TRIAGEM  │  (skip se COVID)
        └────┬─────┘
             │ tipo confirmado
        ┌────▼─────────┐
        │DOCS_PENDENTES│
        └────┬─────────┘
             │ docs OK + (DGM enviada SE ESF/DGM)
        ┌────▼─────────┐
        │ DGM_ENVIADA  │  (somente ESF/DGM)
        └────┬─────────┘
             │ DGM assinada ou sem-êxito
        ┌────▼─────────────┐
        │ PRONTO_PROTOCOLO │
        └────┬─────────────┘
             │ protocolado eGov
        ┌────▼──────────────────┐
        │ ACOMPANHAMENTO_ADM    │
        └────┬───────────────┬──┘
             │               │
   (deferido)│  (indeferido /│
             │   sem resposta)│
        ┌────▼────────┐ ┌────▼───────────────┐
        │ IMPLANTADO  │ │JUDICIAL_OPERACIONAL│
        └────┬────────┘ └────┬───────────────┘
             │               │ (decisão favorável)
             │      ┌────────┘
             │      ▼
        ┌────▼──────────────┐
        │ENCERRADO_OPERACIO │  ← terminal feliz
        └───────────────────┘

           ┌──────────┐
           │CANCELADO │ ← terminal infeliz (a qualquer momento)
           └──────────┘
```

### 4.2 Rastro financeiro (15 estados)

```
NAO_APLICAVEL (estado inicial, padrão)
   │ bifurcação automática (gatilho IMPLANTADO operacional)
   ▼
ELABORANDO_TERMO
   │ FIN salva v1
   ▼
CONFERINDO_TERMO
   │ Conferidor (≠ elaborador) aprova
   ▼
APROVACAO_JURIDICA
   │ ┌─── automática (critérios padrão) ───┐
   │ │                                      │
   │ └─── manual (JUR decide) ─────────────┘
   ▼
COMUNICANDO_ABATIMENTO
   │ FIN comunica ao cliente
   ▼
APRESENTANDO_TERMO
   │ ┌─ aceite (Portal/WA/Presencial/ZapSign) ──┐
   │ │                                            │
   │ └─ discordância ─┐                          │
   ▼                  │                          ▼
TERMO_EM_DISCORDANCIA│                       TERMO_ACEITO
   │ JUR analisa    │                          │
   ├─ refazer (v2)  │                          ▼
   ├─ negociar      │                       ATIVO (cobrança ativa)
   ├─ judicializar  │                          │
   ▼                │                          │ mensalmente
COBRANCA_JUDICIAL   │                          ├─ pagamento → reduz saldo
   │ ajuizar       │                          ├─ atraso 2º mês → INADIMPLENTE
   ▼               │                          ├─ atraso 3+ mês → JUR escala
JUDICIAL_FINANCEIRO│                          │     ↓
                   │                       COBRANCA_JUDICIAL → JUDICIAL_FINANCEIRO
                   │                          │
                   │                          └─ última parcela paga
                                                       ▼
                                                   QUITADO (terminal feliz)

SUSPENSO  (hold; pode vir de ATIVO, APRESENTANDO_TERMO, TERMO_ACEITO)
   ↑ resolvido o hold, volta ao estado anterior

CANCELADO_FINANCEIRO  (terminal infeliz)
```

### 4.3 Gates de transição (validação ao mover)

| Transição | Gate (validação) |
|---|---|
| ONBOARDING → TRIAGEM | Contrato assinado + procuração + dados básicos cliente |
| TRIAGEM → DOCS_PENDENTES | Tipo confirmado + atributos profissionais preenchidos |
| DOCS_PENDENTES → DGM_ENVIADA | Docs canônicos do tipo recebidos + DGM gerada |
| DGM_ENVIADA → PRONTO_PROTOCOLO | DGM assinada OU `sem_exito_dgm=true` + JUR aprovou alternativa |
| PRONTO_PROTOCOLO → ACOMPANHAMENTO_ADM | NUP registrado (protocolado eGov) |
| ACOMPANHAMENTO_ADM → IMPLANTADO | Comprovação implantação (planilha banco verificada) |
| ACOMPANHAMENTO_ADM → JUDICIAL_OPERACIONAL | `projuris_id` registrado |
| → IMPLANTADO | `resultado_caso` preenchido (TOTAL/PARCIAL) |
| ELABORANDO → CONFERINDO | snapshot v1 salvo + elaborador identificado |
| CONFERINDO → APROVACAO_JURIDICA | conferidor ≠ elaborador (RLS + CHECK) |
| APROVACAO → COMUNICANDO | JUR aprovou (manual ou automático) |
| APRESENTANDO → TERMO_ACEITO | aceite registrado com canal + evidência |
| ACEITO → ATIVO | parcelas geradas no Conta Azul/Asaas (call API ok) |
| ATIVO → QUITADO | última parcela paga (`status=PAGA`) |

**Override de gate:** apenas `admin` com log obrigatório em `audit_log` + motivo textual.

### 4.4 Convergência → Arquivamento

```sql
-- Caso arquivável apenas quando ambos rastros em estado terminal
case.date_arquivado_at IS NULL
AND (
  (macrostatus_operacional = 'ENCERRADO_OPERACIONAL' AND macrostatus_financeiro = 'QUITADO')
  OR
  (macrostatus_operacional = 'CANCELADO' AND macrostatus_financeiro IN ('CANCELADO_FINANCEIRO', 'NAO_APLICAVEL'))
)
```

---

## 5. Schema do Projeto 1 (tabelas específicas)

> Complementa o schema do PRD Master (§3). Adiciona campos FIES-específicos e tabelas auxiliares.

### 5.1 Extensão `cases` — campos FIES-específicos

```sql
ALTER TABLE cases ADD COLUMN fies_data jsonb DEFAULT '{}'::jsonb;

-- Estrutura esperada para casos FIES:
-- {
--   "banco": "CAIXA" | "BB",
--   "tipo_subcaso": "ESF_DGM" | "ESF_PORTARIA" | "MILITAR" | "COVID",
--   "saldo_devedor": 12345.67,
--   "contrato_data_assinatura": "2018-05-15",
--   "covid": {
--     "forma_comprovacao": "DECLARACAO_MAIS_CNES",
--     "periodo_inicio": "2020-04",
--     "periodo_fim": "2021-12",
--     "meses_pleiteados": 21,
--     "declaracao_status": "RECEBIDA_CONFORME"
--   },
--   "esf": {
--     "dgm_status": "ASSINADA",
--     "dgm_data_envio": "2026-03-10",
--     "dgm_data_retorno": "2026-04-02",
--     "municipio_gestao": "Aparecida de Goiânia/GO",
--     "sem_exito_dgm": false
--   },
--   "percentual_solicitado": 100,   -- % do mês
--   "implantacao": {
--     "valor_real_abatimento": 8400.00,
--     "data_planilha_verificada": "2026-09-15"
--   }
-- }
```

### 5.2 Tabela `case_municipios_inteligencia`

Acumula taxa histórica de sucesso por município.

```sql
CREATE TABLE case_municipios_inteligencia (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             uuid NOT NULL REFERENCES organizations(id),
  municipio                   text NOT NULL,
  uf                          text NOT NULL,
  total_casos                 int NOT NULL DEFAULT 0,
  dgm_assinadas               int NOT NULL DEFAULT 0,
  dgm_recusadas               int NOT NULL DEFAULT 0,
  dgm_indisponiveis           int NOT NULL DEFAULT 0,
  taxa_sucesso                numeric(5,2),                  -- recalculado nightly
  ultimo_caso_sucesso_id      uuid REFERENCES cases(id),
  ultimo_caso_sucesso_em      timestamptz,
  responsaveis_destacados     text[],                        -- usuários que tiveram sucesso
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, municipio, uf)
);

CREATE INDEX idx_mun_uf ON case_municipios_inteligencia(uf, taxa_sucesso DESC);
```

### 5.3 Tabela `case_sei_tracking`

Histórico de scraping SEI.

```sql
CREATE TABLE case_sei_tracking (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  case_id         uuid NOT NULL REFERENCES cases(id),
  nup             text NOT NULL,
  ultima_consulta timestamptz NOT NULL,
  ultima_movimentacao_em timestamptz,
  ultima_movimentacao_texto text,
  consultas_consecutivas_falha int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'OK',                 -- OK | FALHANDO | DESABILITADO
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sei_case ON case_sei_tracking(case_id);
```

### 5.4 Tabela `case_cnes_sync`

Sincronização mensal CNES.

```sql
CREATE TABLE case_cnes_sync (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  case_id         uuid NOT NULL REFERENCES cases(id),
  cnes_unidade    text,
  vinculo_ativo   boolean,
  ultima_verificacao timestamptz NOT NULL,
  detalhes        jsonb,
  alertou_desligamento boolean DEFAULT false
);
```

### 5.5 Tabela `case_holds_history`

Histórico de holds (financeiros).

```sql
CREATE TABLE case_holds_history (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  case_id         uuid NOT NULL REFERENCES cases(id),
  motivo          hold_motivo NOT NULL,
  descricao       text,
  iniciado_em     timestamptz NOT NULL,
  finalizado_em   timestamptz,
  iniciado_por    uuid REFERENCES users(id),
  finalizado_por  uuid REFERENCES users(id),
  resolucao       text                                       -- como foi resolvido
);

CREATE INDEX idx_holds_case ON case_holds_history(case_id);
```

### 5.6 Tabela `migration_log`

Para migração F1 (rastreável).

```sql
CREATE TABLE migration_log (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  batch_id        uuid NOT NULL,
  source          text NOT NULL,                              -- 'excel:fies.xlsx', 'trello:board-1'
  source_row      int,
  client_id_new   uuid REFERENCES clients(id),
  case_id_new     uuid REFERENCES cases(id),
  status          text NOT NULL,                              -- IMPORTED | SKIPPED | ERROR
  warnings        text[],
  errors          text[],
  raw_data        jsonb,
  imported_at     timestamptz NOT NULL DEFAULT now()
);
```

---

## 6. Épicos e User Stories

### Épico 1 — Backend Foundations (lógica sobre UI pronta)

> **Pressuposto F4:** Monorepo, design system, Storybook, 115 telas, Auth UI já estão prontos desde F0-F2. Aqui ativamos o backend real.

#### Story 1.1: Supabase project + schema global aplicado
**Como** tech lead, **eu quero** Supabase configurado com tabelas globais do Master + RLS aplicada, **para que** o backend esteja pronto a receber dados.
**AC:**
- [ ] Project Supabase staging + prod criados
- [ ] Migrations das 17 tabelas globais (Master §3) executadas
- [ ] Extensions (`uuid-ossp`, `pg_trgm`, `vector`, etc.) habilitadas
- [ ] Seed inicial (organization Hyago Viana, roles, admin user) aplicado
- [ ] RLS policies criadas e testadas com script de auditoria

#### Story 1.2: Auth backend ligado à UI pronta
**Como** admin, **eu quero** o fluxo de login/convite/MFA/recovery funcionar com Supabase real, **para que** usuários acessem a plataforma.
**AC:**
- [ ] Telas de login/recovery/reset/convite/MFA (já implementadas em F2) trocadas de mock para Supabase Auth real
- [ ] MFA TOTP funcional (Supabase Auth + app autenticador)
- [ ] Convite por e-mail via Supabase + template Postmark
- [ ] Cookies httpOnly via `@supabase/ssr`
- [ ] Teste E2E: login + MFA + logout
- [ ] Teste E2E: usuário com `advogado_associado` recebe 403 ao tentar editar usuários

#### Story 1.3: Schema específico FIES + RLS
**Como** tech lead, **eu quero** as 6 tabelas específicas deste PRD aplicadas, **para que** dados FIES tenham estrutura.
**AC:**
- [ ] Migrations das tabelas §5 aplicadas (`case_municipios_inteligencia`, `case_sei_tracking`, `case_cnes_sync`, `case_holds_history`, `migration_log` + extensão `cases.fies_data`)
- [ ] RLS específica testada
- [ ] Triggers (bifurcação automática, log macrostatus) funcionais

#### Story 1.4: Toggle mock → real nas telas críticas
**Como** dev, **eu quero** substituir fixtures por queries Supabase reais nas telas centrais (Cliente 360°, Pipelines, Ficha Caso), **para que** dados reais fluam.
**AC:**
- [ ] `NEXT_PUBLIC_DATA_MODE=real` ativo nas rotas `/clientes`, `/casos`, `/clientes/:id`, `/casos/:id`
- [ ] Server Components RSC + Supabase server client
- [ ] React Query no client com keys consistentes
- [ ] MSW desabilitado em produção

---

### Épico 2 — Cliente unificado (PF/PJ)

#### Story 2.1: CRUD de Cliente
**AC:**
- [ ] Criar PF (CPF obrigatório) ou PJ (CNPJ obrigatório)
- [ ] Editar campos básicos + endereço + dados profissionais (jsonb)
- [ ] Soft-delete + restore (admin)
- [ ] Lista com busca fuzzy (nome, CPF, email, phone)
- [ ] Validações Zod (CPF/CNPJ válido, e-mail formato)

#### Story 2.2: Ficha Cliente 360° (5 abas)
**AC:**
- [ ] Cabeçalho com identificação + alertas + ações rápidas (links Drive, Conta Azul, ChatGuru)
- [ ] Aba Casos (lista de casos com 2 rastros lado a lado)
- [ ] Aba Documentos (todos docs de todos casos)
- [ ] Aba Timeline (feed de eventos consolidado)
- [ ] Aba Financeiro (parcelas, snapshot Termo, histórico)
- [ ] Aba Comunicação (timeline de mensagens WhatsApp, e-mails)

#### Story 2.3: Alertas no cabeçalho
**AC:**
- [ ] Detecção automática de alertas: inadimplente, docs pendentes, etapa atrasada >45d, hold ativo, contrato pós-2018, multi-casos, etc.
- [ ] Cada alerta é clicável (leva à origem)
- [ ] Estado "sem alertas críticos" se tudo ok

---

### Épico 3 — Caso e Pipelines

#### Story 3.1: CRUD básico de Caso
**AC:**
- [ ] Criar caso vinculado a cliente; case_code gerado
- [ ] Atribuir responsáveis por rastro (op, fin, jur)
- [ ] Editar campos + flags (judicial, risco, contrato pós-2018)
- [ ] Soft-delete + cancelamento (com motivo)

#### Story 3.2: Pipeline Operacional (Kanban)
**AC:**
- [ ] 10 colunas (estados operacionais)
- [ ] Drag-drop com **gate validation** (mostra o que falta se bloqueado)
- [ ] Card mostra: ID, tipo, origem, município, próxima ação, responsável, dias-em-estado com semáforo
- [ ] Filtros: tipo_caso, banco, UF, advogado responsável, SLA, origem
- [ ] Toggle Kanban ↔ Lista
- [ ] Modo densidade (confortável/padrão/compacto)
- [ ] Realtime: mudança em outro user atualiza minha tela

#### Story 3.3: Pipeline Financeira (Kanban + views)
**AC:**
- [ ] 15 colunas (estados financeiros)
- [ ] Mesmas funcionalidades do Pipeline Op
- [ ] 8 views complementares:
  - Aguardando Ativação (TERMO_ACEITO sem cobrança ativada)
  - Parcelas Atrasadas (ATIVO + parcela vencida 1-29d)
  - Inadimplência (INADIMPLENTE)
  - Pendências Judiciais (SUSPENSO + hold=AGUARDANDO_DECISAO_JUDICIAL)
  - Readequação Parcela (SUSPENSO + hold=PENDENTE_READEQUACAO_PARCELA)
  - Cliente Inerte (APRESENTANDO_TERMO >15d sem aceite)
  - Cobrança Judicial (COBRANCA_JUDICIAL)
  - Tramitação Judicial (JUDICIAL_FINANCEIRO)
  - Análise Pré-Decisão (TERMO_EM_DISCORDANCIA)

#### Story 3.4: Ficha do caso (dois rastros lado a lado)
**AC:**
- [ ] Cabeçalho com badges, alertas, ações rápidas
- [ ] **Bloco operacional + bloco financeiro lado a lado**, cada um com:
  - Macrostatus atual + dias-em-estado + SLA
  - Próxima ação
  - Responsável
  - Histórico de transições
- [ ] Abas: Docs, Timeline, Financeiro, Comunicação, Auditoria

---

### Épico 4 — Documentos

#### Story 4.1: Upload e gestão de documentos
**AC:**
- [ ] Upload via drag-drop ou click
- [ ] Múltiplos arquivos (até 20MB cada)
- [ ] Preview inline (PDF, imagem)
- [ ] OCR automático em <30s
- [ ] Hash SHA-256 gerado
- [ ] Sync com Drive

#### Story 4.2: Documentos canônicos por tipo de caso
**AC:**
- [ ] Lista de docs canônicos para o tipo (DOC-01 a DOC-14)
- [ ] Status de cada doc (PENDENTE/RECEBIDO/GERADO/DISPENSADO/APROVADO)
- [ ] Quando ausente, mostra "Solicitar ao cliente via WhatsApp/Portal"
- [ ] Quando recebido, JUR pode aprovar (gera evento)

#### Story 4.3: Geração de Declaração COVID (Doc 06)
**AC:**
- [ ] Botão "Gerar Declaração COVID"
- [ ] Merge dados Cliente + Caso em template DOCX
- [ ] PDF gerado + salvo em Storage + Drive
- [ ] QA jurídico pendente automaticamente após recebimento (preenchido)

#### Story 4.4: Geração de DGM (Doc específico ESF/DGM)
**AC:**
- [ ] Botão "Gerar DGM" disponível em DOCS_PENDENTES
- [ ] Merge dados em template
- [ ] PDF gerado + salvo
- [ ] Transição automática para DGM_ENVIADA

---

### Épico 5 — Onboarding via ZapSign

#### Story 5.1: Webhook ZapSign — Caminho A (cliente novo)
**AC:**
- [ ] Webhook recebido, HMAC validado
- [ ] Cliente novo criado a partir do contrato
- [ ] Caso criado em ONBOARDING
- [ ] Pasta Drive criada
- [ ] Boas-vindas WhatsApp enviado
- [ ] Idempotente (mesmo webhook 2x não duplica)

#### Story 5.2: Webhook ZapSign — Caminho B (cliente existente, novo caso)
**AC:**
- [ ] CPF identifica cliente existente
- [ ] Novo caso criado vinculado a cliente
- [ ] Reuso de contrato de honorários (se aplicável)

#### Story 5.3: Webhook ZapSign — Caminho C (inconsistência)
**AC:**
- [ ] Sistema detecta dados conflitantes (ex: CPF diferente do cliente cadastrado)
- [ ] Tarefa URGENTE criada para JUR + ADM
- [ ] Notificação imediata
- [ ] Caso NÃO criado até resolução manual

---

### Épico 6 — Fluxo POP FIES_COVID

#### Story 6.1: Fluxo Fase 1 (DOCS_PENDENTES)
**AC:**
- [ ] Sistema solicita docs 02/03/06/08/09/10 via WhatsApp/Portal
- [ ] OPE faz consultas Doc 04 (CFM) e Doc 05 (CNES se aplicável)
- [ ] Régua follow-up automática (D+3, D+7, D+15)
- [ ] Alerta "Coleta Pausada" se D+15 sem resposta

#### Story 6.2: QA Declaração COVID (Doc 06)
**AC:**
- [ ] Checklist 7 itens (ver §3.2)
- [ ] Status: APROVADA | APROVADA_COM_RESSALVA | REPROVADA
- [ ] Se reprovada, motivo obrigatório + ação sugerida (solicitar nova, mudar para CNES, cancelar inviável)
- [ ] Aprovada → habilita PRONTO_PROTOCOLO

#### Story 6.3: Fluxo Fase 2 (PRONTO_PROTOCOLO)
**AC:**
- [ ] Sistema gera requerimento (PDF)
- [ ] QA jurídico do requerimento (checklist 8 itens)
- [ ] OPE protocola eGov (via n8n workflow Playwright)
- [ ] NUP registrado
- [ ] Transição para ACOMPANHAMENTO_ADM

#### Story 6.4: Fluxo Fase 3 (ACOMPANHAMENTO_ADM)
**AC:**
- [ ] SEI scraper diário monitora NUP
- [ ] Gmail monitor lê e-mails MS/FNDE → vincula ao caso por NUP
- [ ] Alerta 30d sem resposta
- [ ] Decisão MS classificada (deferido/indeferido/exigência)
- [ ] Se indeferido/sem-regulamentação → escalação para JUDICIAL_OPERACIONAL

#### Story 6.5: Fluxo Fase 4 (JUDICIAL_OPERACIONAL)
**AC:**
- [ ] Campo `projuris_id` preenchido
- [ ] Flag `flag_judicial_operacional = TRUE` (permanente)
- [ ] Caso acompanhado via integração Projuris (Projeto 2)
- [ ] Decisão favorável → IMPLANTADO

#### Story 6.6: Fluxo Fase 5 (IMPLANTADO → ENCERRADO_OP)
**AC:**
- [ ] OPE verifica planilha banco (manual ou upload)
- [ ] Confirma % real abatido
- [ ] Classifica `resultado_caso` (TOTAL/PARCIAL)
- [ ] **Bifurcação automática** → ELABORANDO_TERMO

---

### Épico 7 — Fluxo POP FIES_ESF_DGM

(Similar ao COVID, com particularidades DGM detalhadas no fluxo operacional §8.2.)

---

### Épico 8 — Fluxo Financeiro

#### Story 8.1: Elaboração do Termo
**AC:**
- [ ] FIN abre "Elaborar Termo"
- [ ] Sistema calcula automaticamente:
  - `saldo_antes`, `saldo_depois`, `parcelas_pagas_no_processo`
  - `valor_efetivo_abatimento = saldo_antes - saldo_depois - parcelas_pagas` (truncado)
  - `valor_total_honorarios = valor_efetivo * percentual_honorarios / 100`
  - `qtd_parcelas = floor(valor_total / valor_parcela)`
  - `valor_ultima_parcela = valor_total - (qtd-1) * valor_parcela` (resto >= R$100)
  - `valor_avista = valor_total * (1 - desconto_avista/100)`
- [ ] FIN ajusta se necessário
- [ ] Salva como snapshot v1 (status RASCUNHO)
- [ ] Suspensão FIES considerada nos cálculos

#### Story 8.2: Conferência do Termo (segregação)
**AC:**
- [ ] Outro FIN (conferidor ≠ elaborador) acessa
- [ ] Checklist 8 itens (visual)
- [ ] Aprovar conferência → status EM_CONFERENCIA → APROVACAO_JURIDICA
- [ ] **Sistema impede elaborador conferir o próprio** (RLS + CHECK)

#### Story 8.3: Aprovação Jurídica Híbrida
**AC:**
- [ ] Sistema avalia critérios (ver §11):
  - Se PARCIAL + 15% + cláusula padrão + procuração ok + sem flag_risco + valor razoável → AUTOMÁTICA
  - Caso contrário → MANUAL (vai para JUR)
- [ ] Aprovação automática registra `aprovacao_automatica=true` + critérios JSON
- [ ] Evento Timeline com badge "Auto-aprovado"
- [ ] Aprovação manual: tarefa criada para JUR titular

#### Story 8.4: Apresentação ao cliente
**AC:**
- [ ] FIN clica "Apresentar"
- [ ] Sistema envia link Portal + WhatsApp + e-mail (configurável)
- [ ] Status → APRESENTANDO_TERMO
- [ ] Alerta "Cliente Inerte" se >15d sem resposta

#### Story 8.5: Aceite ou Discordância
**AC:**
- [ ] Aceite: registra canal + evidência (IP, UA, timestamp) → TERMO_ACEITO
- [ ] Transição automática para ATIVO após criar parcelas (Conta Azul/Asaas API)
- [ ] Discordância: cliente justifica → TERMO_EM_DISCORDANCIA → JUR analisa

#### Story 8.6: Geração de parcelas e cobrança
**AC:**
- [ ] Ao TERMO_ACEITO → chama API Conta Azul/Asaas para criar cobrança
- [ ] Parcelas registradas em `parcelas`
- [ ] Boletos disponíveis no Portal e via WhatsApp (link)
- [ ] Webhook Conta Azul/Asaas atualiza parcela paga

#### Story 8.7: Régua de cobrança
**AC:**
- [ ] D+5 antes vencimento: WhatsApp lembrete amigável
- [ ] D+15 após vencimento: contato ativo FIN (tarefa)
- [ ] 30+ dias: INADIMPLENTE (escalação JUR)
- [ ] 3+ meses: COBRANCA_JUDICIAL

#### Story 8.8: Renegociação
**AC:**
- [ ] FIN inicia renegociação (até 2º mês atraso) ou JUR (a partir 3º)
- [ ] Sistema cria novo snapshot v2 + Aditivo PDF
- [ ] Snapshot anterior → SUBSTITUIDO

---

### Épico 9 — Portal do Cliente

#### Story 9.1: Login do Portal
**AC:**
- [ ] Acesso por e-mail + senha OU CPF + senha
- [ ] Magic link opcional
- [ ] Mobile-first responsivo

#### Story 9.2: Visão geral dos casos
**AC:**
- [ ] Lista de casos ativos com status simplificado
- [ ] Próxima ação **na linguagem do cliente** (sem jargão jurídico)
- [ ] Atalhos para docs pendentes, boletos, mensagens

#### Story 9.3: Aceite Termo via Portal
**AC:**
- [ ] Visualização do PDF do Termo
- [ ] Botão "Aceitar"
- [ ] 2FA obrigatória (SMS ou TOTP)
- [ ] Confirmação dupla
- [ ] Aceite registra IP, UA, timestamp

#### Story 9.4: Upload de documentos
**AC:**
- [ ] Lista de docs pendentes
- [ ] Upload por câmera ou arquivo
- [ ] Confirmação visual
- [ ] Notificação ADM imediata

#### Story 9.5: Boletos
**AC:**
- [ ] Lista de parcelas pendentes + boletos
- [ ] Download PDF + copy QR Pix
- [ ] Histórico de pagamentos

---

### Épico 10 — Migração

#### Story 10.1: Script de importação Excel
**AC:**
- [ ] Lê planilhas FIES (formatos atuais)
- [ ] Mapeia campos para schema canônico
- [ ] Cria Cliente + Caso + Snapshot Termo (se aplicável) + Parcelas + Eventos sintéticos
- [ ] Logs em `migration_log`
- [ ] Modo dry-run

#### Story 10.2: Validação de migração
**AC:**
- [ ] Dashboard de status de importação
- [ ] Lista de erros (com link para original)
- [ ] Aprovação humana de amostra

---

### Épico 11 — Dashboards

#### Story 11.1: Dashboard Operacional
**AC:**
- [ ] Funnel: ONBOARDING → ENCERRADO_OP (taxas)
- [ ] DGM por município (mapa Brasil)
- [ ] Taxa de judicialização
- [ ] Tempo médio por fase
- [ ] Filtros: período, tipo, advogado

#### Story 11.2: Dashboard Financeiro
**AC:**
- [ ] Funnel financeiro
- [ ] Receita prevista vs realizada
- [ ] Inadimplência por idade (1-30d, 31-60d, >60d)
- [ ] Tempo médio aceite Termo
- [ ] Taxa aprovação automática vs revertida

#### Story 11.3: Dashboard Admin (Consolidado)
**AC:**
- [ ] Matriz Op × Fin (heatmap)
- [ ] Cohort de implantações por mês
- [ ] Performance por tipo_caso
- [ ] Top municípios por sucesso

---

(Continua nos demais épicos: notificações, auditoria, configurações de usuário, integrações detalhadas, relatórios, etc. Cada um se desdobra em ~3-5 stories.)

---

## 7. Telas detalhadas

> 6 telas-chave herdadas do PRD 0, expandidas com regras de Projeto 1:

### 7.1 Cliente 360°
- **Componentes:** `ClientHeader`, `Tabs`, `CaseCard` (1+ por aba Casos)
- **Permissões:** Admin, advogados, ADM, OPE, FIN (com escopo)
- **Realtime:** atualiza ao receber novos eventos
- **Print:** versão exportável "Dossiê do cliente" (PDF)

### 7.2 Ficha do Caso
- **2 rastros lado a lado** (`RastroBlock` × 2)
- **Tabs:** Visão, Documentos, Timeline, Financeiro, Comunicação, Auditoria
- **Ações rápidas (lateral):** mudar macrostatus, criar tarefa, gerar doc, ir para Drive, etc.

### 7.3 Pipeline Operacional / Financeira
- (Detalhado em §6 Stories 3.2 e 3.3)

### 7.4 Painel "Hoje"
- 4 seções: Urgente, Hoje, Próximos, Conquistas
- Personalizada por usuário (suas tarefas, seus casos)
- Atalho: `g h`

### 7.5 Portal do Cliente — Home
- Mobile-first, com 3 ações principais: ver casos, docs, boletos

### 7.6 Migração — Painel
- Status dos lotes
- Lista de erros
- Aprovação amostra

---

## 8. Fluxos operacionais (POPs)

### 8.1 Fluxo FIES_COVID — fases

| Fase | Estado | Atores | Atividades-chave | Saída |
|---|---|---|---|---|
| **0 — Onboarding** | ONBOARDING | Sistema | ZapSign webhook → cria cliente + caso + Drive | DOCS_PENDENTES |
| **1 — Docs** | DOCS_PENDENTES | ADM, OPE, Cliente | Solicitar docs cliente, consultar CFM/CNES, gerar Declaração COVID, QA JUR | PRONTO_PROTOCOLO |
| **2 — Protocolo** | PRONTO_PROTOCOLO | OPE, JUR | Gerar requerimento, QA, protocolar eGov, registrar NUP | ACOMPANHAMENTO_ADM |
| **3 — Acompanhamento** | ACOMPANHAMENTO_ADM | Sistema, JUR | SEI scraping, Gmail monitor, analisar resposta | IMPLANTADO ou JUDICIAL_OP |
| **4 — Judicial** | JUDICIAL_OPERACIONAL | JUR | Ajuizar, acompanhar via Projuris | IMPLANTADO ou CANCELADO |
| **5 — Implantação** | IMPLANTADO | OPE | Verificar planilha banco, classificar resultado | Bifurcação fin |

### 8.2 Fluxo FIES_ESF_DGM — particularidades

Idêntico ao COVID, mas:
- **Tem TRIAGEM** (não pré-contratual).
- **Tem DGM_ENVIADA** entre DOCS_PENDENTES e PRONTO_PROTOCOLO.
- **DGM gerada automaticamente** pelo sistema; OPE envia ao cliente.
- **Follow-up DGM** específico (D+7, D+15, D+30).
- **Renovação anual** (origem RENOVACAO em jan/cada ano).

### 8.3 Fluxo FIES_ESF_PORTARIA

- Pula DGM_ENVIADA → direto de DOCS_PENDENTES para PRONTO_PROTOCOLO.
- Validação adicional: município está em portaria oficial (consulta tabela ou JUR confirma).

### 8.4 Fluxo FIES_MILITAR

- Caso único (sem renovação).
- Docs específicos: comprovação militar.
- Fluxo mais curto e direto.

---

## 9. Fluxo financeiro unificado

> Mesmo fluxo para todos tipos de caso. Difere apenas em particularidades (suspensão FIES afeta cálculo).

### 9.1 Fases

| Fase | Estado | Atores | SLA |
|---|---|---|---|
| **5-Fin Elaboração** | ELABORANDO_TERMO | FIN | 3 dias úteis pós-bifurcação |
| **5-Fin Conferência** | CONFERINDO_TERMO | FIN conferidor | 2 dias úteis |
| **5-Fin Aprovação JUR** | APROVACAO_JURIDICA | JUR (ou auto) | 1 dia útil (manual) / <1min (auto) |
| **6-Fin Comunicação** | COMUNICANDO_ABATIMENTO | FIN | 1 dia útil |
| **6-Fin Apresentação** | APRESENTANDO_TERMO | Cliente | 7 dias úteis |
| **7-Fin Ativação** | TERMO_ACEITO → ATIVO | Sistema (API Conta Azul/Asaas) | 24h |
| **7-Fin Cobrança** | ATIVO | FIN, Sistema | mensal |
| **7-Fin Inadimplência** | INADIMPLENTE | FIN → JUR | 30d |
| **7-Fin Judicial** | COBRANCA_JUDICIAL / JUDICIAL_FINANCEIRO | JUR | conforme processo |

### 9.2 Cálculo do Termo (regra de negócio crítica)

```
saldo_antes              = saldo FIES antes do abatimento
saldo_depois             = saldo FIES após implantação
parcelas_pagas_processo  = parcelas FIES pagas pelo cliente durante o processo
valor_efetivo            = max(0, saldo_antes − saldo_depois − parcelas_pagas_processo)
                           (truncado para baixo, NÃO arredondado)

percentual_honorarios    = 15% (default, configurável no contrato)
valor_total_honorarios   = floor(valor_efetivo × percentual_honorarios / 100)

valor_parcela_padrao     = R$ 500 (configurável no contrato)
qtd_parcelas             = floor(valor_total / valor_parcela)
resto                    = valor_total − (qtd_parcelas × valor_parcela)

# Regra do resto: se resto < R$ 100, incorpora à última parcela
if resto < 100:
    valor_ultima_parcela = valor_parcela + resto
else:
    qtd_parcelas += 1
    valor_ultima_parcela = resto

valor_avista             = valor_total × (1 − desconto_avista / 100)   # 10% padrão
```

### 9.3 Suspensão FIES — 3 cenários

| Cenário | Suspensão ativa? | Parcelas pagas no processo |
|---|---|---|
| **A** | Sim | ≈ 0 (ninguém pagou durante processo) |
| **B** | Sim | > 0 (cliente pagou apesar de suspenso — voluntário) |
| **C** | Não | normais |

Sistema detecta cenário via campo `client.fies_data.suspension_active` e oferece pré-preenchimento adequado.

### 9.4 Tipo do Termo

- `PARCIAL` se primeiro abatimento (`client.fies_data.fies_teve_abatimento_anterior = false`)
- `COMPLEMENTAR` se há histórico anterior (`true`)
- Em renovação ESF, **Termo COMPLEMENTAR** é gerado; honorários acumulados ao parcelamento anterior via Aditivo.

---

## 10. Termo de Acerto

### 10.1 Princípio da imutabilidade

Após `APROVADO_JURIDICO`, o snapshot é **imutável**. Qualquer alteração:
1. Gera novo snapshot v2 com `supersedes = v1.id`.
2. Snapshot anterior recebe status `SUBSTITUIDO`.
3. Audit log registra motivo + diff.

### 10.2 Versionamento

```
TermoSnapshot v1 (APROVADO_JURIDICO → APRESENTADO → ACEITO)
         │
         │ cliente discorda
         ▼
       SUBSTITUIDO
         │ JUR cria v2 com ajustes
         ▼
TermoSnapshot v2 (APROVADO_JURIDICO → APRESENTADO → ACEITO)
```

### 10.3 PDF imutável

- Gerado uma vez no momento da aprovação jurídica.
- Hash SHA-256 armazenado.
- Validação de integridade no Portal (cliente vê o mesmo PDF que JUR aprovou).

### 10.4 Aceite — canais e evidências

| Canal | Evidência registrada |
|---|---|
| **PORTAL** | Login (user_id), IP, user-agent, timestamp, signed_text ("Aceito os termos...") |
| **WHATSAPP** | thread_id, mensagem "ACEITO", número telefone, timestamp |
| **PRESENCIAL** | Foto/assinatura escaneada + usuário que registrou |
| **ZAPSIGN** | doc_id ZapSign + signed_pdf_path |

---

## 11. Aprovação jurídica híbrida

### 11.1 Critérios para aprovação automática

**Todos devem ser TRUE:**
- `tipo_termo = PARCIAL`
- `percentual_honorarios = 15.00` (padrão exato)
- `cláusula_especial IS NULL` (cláusula padrão)
- Procuração válida no cadastro (status APROVADO)
- `case.flag_risco = false`
- Valor honorários dentro de faixa esperada (configurável; default: entre R$ 1.000 e R$ 20.000)
- `case.flag_judicial_operacional` consistente com tipo

**Se TUDO TRUE →** aprovação automática <1min, badge "Auto-aprovado" no evento.
**Se algum FALSE →** vai para JUR manual.

### 11.2 Métricas de saúde

- **Taxa de auto-aprovação:** % dos casos aprovados automaticamente. Meta: 70-85%.
- **Taxa de reversão:** snapshots auto-aprovados que viraram SUBSTITUIDO ou discordância. Meta: ≤ 10%.
- Se taxa de reversão > 10% por 2 meses → revisão dos critérios (calibração mais conservadora).

### 11.3 Aprovação manual

- Tarefa criada para JUR titular (responsável_juridico_id do caso ou JUR padrão da org).
- Aparece no Painel "Hoje" com prioridade ALTA.
- JUR vê: snapshot v1 + critérios que falharam + recomendação do sistema.
- JUR aprova ou reprova (com motivo).

---

## 12. Integrações deste módulo

### 12.1 ZapSign (webhook in)
- `wf-zapsign-onboarding` (n8n)
- Estados: A (novo), B (existente), C (inconsistência)
- HMAC validado, idempotência por `doc_id`

### 12.2 Google Drive (bidirecional)
- Cria pastas automaticamente em criação de cliente/caso.
- Upload local sincroniza para Drive.
- Estrutura padronizada: `Clientes/{Nome-CPF}/Caso-{code}/{Saldos|Termo|Financeiro}/`

### 12.3 Gmail (read)
- Polling 15min via n8n.
- Lê e-mails MS/FNDE/DIGES.
- Vincula ao caso via NUP ou CPF.
- Cria evento + tarefa de QA.

### 12.4 Postmark (send)
- Templates pré-aprovados: boas-vindas, cobrança, lembrete, Termo apresentação.
- Bounce → marca e-mail inválido.

### 12.5 Conta Azul / Asaas (cobrança)
- Auto-detecção do sistema preferido por contrato.
- Cria cobrança ao TERMO_ACEITO.
- Webhook atualiza pagamento.
- NF sob demanda (Conta Azul).

### 12.6 ChatGuru
- Webhook inbound (mensagens cliente).
- Cria `case_communications`.
- Régua automatizada de cobrança via WhatsApp.

### 12.7 SEI scraper (n8n + Playwright)
- Diário 6h.
- Consulta cada `nup` ativo.
- Best-effort: 3 falhas consecutivas → alerta.

### 12.8 CNES scraper
- Mensal.
- Detecta desligamento → alerta.

### 12.9 Gov.br protocolo (n8n + Playwright)
- Acionado pelo app (botão "Protocolar").
- Login delegado Dr. Hyago.
- Retorna NUP.
- Contingência: protocolo manual + registro manual.

---

## 13. Portal do Cliente

### 13.1 Telas
1. **Login** (e-mail/CPF + senha + magic link opcional)
2. **Home** — lista de casos com status simplificado
3. **Caso** — timeline simplificada, docs, próxima ação na linguagem do cliente
4. **Documentos** — pendentes + recebidos, upload
5. **Boletos** — abertos + pagos, download/pix
6. **Mensagens** — histórico WhatsApp + portal
7. **Perfil** — atualizar dados (endereço, telefone) + preferências privacidade

### 13.2 Linguagem
- **Sem jargão jurídico.** Em vez de "Em ACOMPANHAMENTO_ADM": "Aguardando resposta do Ministério da Saúde."
- **Tradução de macrostatus** em tabela `client_facing_status_labels`.

### 13.3 Aceite Termo
- Visualização PDF inline.
- Botão "Aceitar" → confirmação dupla.
- Texto: "Eu, [nome], CPF [cpf], aceito o Termo de Acerto v[N] em [data]."
- 2FA via SMS ou TOTP.

### 13.4 Mobile-first
- Tailwind responsive.
- Foto de docs via câmera (uso de `input[capture=camera]`).
- Push notifications V2 (após PWA).

---

## 14. Migração detalhada

### 14.1 Inventário

| Origem | Volume estimado | Notas |
|---|---|---|
| Excel "FIES.xlsx" | ~2.500 linhas | Casos FIES diversos |
| Trello "Operacional" | ~50 colunas (estados) × N cards | Detalhar com Hyago |
| Drive | ~30 GB documentos | Mapeamento cliente↔pasta |

### 14.2 Script

```typescript
// scripts/migrate-fies.ts
import { readExcelFile } from './lib/excel'
import { supabase } from './lib/supabase-admin'
import { mapStatusFromTrello } from './lib/mappings'

const ROW = await readExcelFile('/data/FIES.xlsx')
const batchId = randomUUID()

for (const row of ROW) {
  try {
    const client = await upsertClient({
      full_name: row['Nome'],
      cpf: normalizeCpf(row['CPF']),
      ...
    })
    const case_ = await createCase({
      client_id: client.id,
      case_type: inferType(row),
      macrostatus_operacional: mapStatusFromTrello(row['Status']),
      fies_data: { banco: row['Banco'], saldo_devedor: row['Saldo'], ... }
    })
    await logMigration({ batch_id: batchId, source_row: row.__rowNum__, client_id: client.id, case_id: case_.id, status: 'IMPORTED' })
  } catch (e) {
    await logMigration({ batch_id: batchId, source_row: row.__rowNum__, status: 'ERROR', errors: [e.message], raw_data: row })
  }
}
```

### 14.3 Plano detalhado

(Ver §13 do PRD Master para fases F1-F7.)

---

## 15. Notificações específicas

| Evento | Notif sino? | E-mail? | WA? | Para quem |
|---|---|---|---|---|
| Tarefa criada urgente | ✅ | ✅ (opt-in) | — | Responsável |
| Tarefa vencida | ✅ | ✅ | — | Responsável + supervisor |
| Macrostatus mudou | ✅ | — | — | Responsáveis do caso |
| Doc aprovado | ✅ | — | — | Quem fez upload |
| Termo aguarda aprovação manual | ✅ | ✅ | ✅ (Admin) | JUR titular |
| Cliente discordou Termo | ✅ | ✅ | ✅ (Admin) | JUR + FIN |
| Parcela paga | ✅ | — | — | FIN |
| Inadimplência | ✅ | ✅ | ✅ (Admin) | FIN + JUR |
| Webhook ZapSign Caminho C | ✅ | ✅ | ✅ (Admin) | JUR + ADM |
| SEI scraping falhou 3x | ✅ | ✅ | — | Admin |
| Renovação ESF próxima | ✅ | — | — | OPE |
| Contrato pós-2018 detectado | ✅ | — | — | JUR + Hyago |

---

## 16. Dashboards e relatórios

### 16.1 Materialized views

```sql
CREATE MATERIALIZED VIEW mv_dashboard_operacional AS
SELECT
  organization_id,
  macrostatus_operacional,
  count(*) as total,
  avg(extract(epoch from (now() - date_macrostatus_op_at)) / 86400) as dias_medio_em_estado,
  count(*) FILTER (WHERE date_macrostatus_op_at < now() - interval '45 days') as estourados_sla
FROM cases
WHERE deleted_at IS NULL
GROUP BY organization_id, macrostatus_operacional;

-- Refresh nightly via pg_cron
SELECT cron.schedule('refresh-dash-op', '0 3 * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_operacional$$);
```

### 16.2 Relatórios exportáveis (PDF/Excel)

- Produção mensal por advogado/equipe
- Inadimplência detalhada
- Renovações pendentes (próximos 90d)
- Tempo médio por fase (por tipo de caso)
- Auto-aprovações vs reversões
- Taxa DGM por município

---

## 17. Critérios de aceitação

### Definição de "pronto" do Projeto 1

- ✅ Todas stories críticas (épicos 1-10) com ACs aprovados
- ✅ 50+ casos migrados em staging com 0 erros (amostra)
- ✅ 2500 casos migrados em prod (lote final)
- ✅ Pipelines Op + Fin operando com dados reais
- ✅ Portal do Cliente em produção com 10+ clientes ativos
- ✅ Integrações ZapSign + Drive + Conta Azul + Asaas + ChatGuru + SEI + Gmail funcionais
- ✅ Termo gerado, aprovado, aceito e parcelas geradas em fluxo E2E real
- ✅ Auditoria completa em todas ações sensíveis
- ✅ LGPD: export + soft-delete funcionais
- ✅ Dashboards Op + Fin + Admin com dados reais
- ✅ E2E Playwright em 10 fluxos críticos passando
- ✅ Onboarding equipe (4h de treinamento concluído)
- ✅ Documentação operacional publicada

---

## 18. Riscos específicos

| # | Risco | Mitigação |
|---|---|---|
| **R1.1** | Migração com dados inconsistentes do Excel | Dry-run + validação amostral; coexistência 2 sem |
| **R1.2** | Cliente recusa Portal e quer aceitar WhatsApp/Presencial | Manter 4 canais de aceite com evidência |
| **R1.3** | Aprovação automática diverge da intenção JUR | Calibração conservadora 30d + métrica reversão |
| **R1.4** | DGM nunca volta da prefeitura | Plano B documentado: sem_exito_dgm → migrar para ESF_PORTARIA (se aplicável) ou cancelar inviável |
| **R1.5** | Implantação divergente detectada tarde | Rastros podem reverter (IMPLANTADO → JUDICIAL); novo snapshot v2 |
| **R1.6** | Conta Azul/Asaas API instável | Adapter trocável; retry; fallback registro manual |
| **R1.7** | Login Gov.br compartilhado falha | Contingência: protocolo manual; futuro: certificado A3 |

---

> **Status:** Aprovado. **Próximo:** Elicitação Projeto 2 → PRD Projeto 2.
> _— @pm, com revisão de @architect, @qa e @ux, sob coordenação de Orion 🎯_
