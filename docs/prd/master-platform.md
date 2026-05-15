# 🏛️ PRD Master — Plataforma Unificada (Arquitetura + Especificação Global)

> **Plataforma Unificada Hyago Viana Advocacia**
> **Versão:** 1.0 · **Data:** 2026-05-15 · **Owners:** @architect (lead) + @pm + @qa · **Orquestração:** Orion
> **Status:** Aprovado para iniciar PRDs por módulo

---

## Sumário

1. [Visão arquitetural](#1-visão-arquitetural)
2. [Modelo de domínio canônico](#2-modelo-de-domínio-canônico)
3. [Schema Supabase — tabelas globais](#3-schema-supabase--tabelas-globais)
4. [Autenticação, autorização e RLS](#4-autenticação-autorização-e-rls)
5. [Motor de eventos](#5-motor-de-eventos)
6. [Integrações externas — contratos](#6-integrações-externas--contratos)
7. [Storage e gestão de documentos](#7-storage-e-gestão-de-documentos)
8. [IA, RAG e governança de prompts](#8-ia-rag-e-governança-de-prompts)
9. [n8n self-hosted — workflows](#9-n8n-self-hosted--workflows)
10. [API interna (App ↔ Supabase ↔ módulos)](#10-api-interna)
11. [Notificações e realtime](#11-notificações-e-realtime)
12. [Auditoria, observabilidade e LGPD](#12-auditoria-observabilidade-e-lgpd)
13. [Estratégia de migração](#13-estratégia-de-migração)
14. [DevOps, CI/CD e ambientes](#14-devops-cicd-e-ambientes)
15. [Segurança](#15-segurança)
16. [Performance e escalabilidade](#16-performance-e-escalabilidade)
17. [Estratégia de testes](#17-estratégia-de-testes)
18. [Roadmap técnico cross-módulo](#18-roadmap-técnico-cross-módulo)
19. [Riscos técnicos e mitigações](#19-riscos-técnicos)
20. [Acceptance criteria do Master](#20-acceptance-criteria)

---

## 1. Visão arquitetural

### 1.1 Diagrama de alto nível (C4 — Container view)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          CLIENTES / USUÁRIOS                                 │
│  Equipe interna · Cliente final (Portal) · Leads (WhatsApp) · Inst. ANMR     │
└────────┬────────────────────────┬───────────────────────────┬────────────────┘
         │                        │                           │
   ┌─────▼────────┐         ┌─────▼──────────┐         ┌──────▼───────────┐
   │  app.hv.br   │         │  portal.hv.br  │         │  painel.hv.br    │
   │ (Next.js 15) │         │  (Next.js 15)  │         │ (Next.js 15 SSG) │
   │  Vercel Edge │         │  Vercel Edge   │         │ Vercel Edge      │
   └──────┬───────┘         └────────┬───────┘         └────────┬─────────┘
          │                          │                          │
          └──────────────┬───────────┴──────────────────────────┘
                         │
                  ┌──────▼──────────────────────────────┐
                  │       SUPABASE (Postgres core)      │
                  │                                     │
                  │  - PostgreSQL 15+ (RLS, pgvector)   │
                  │  - Auth (JWT)                       │
                  │  - Storage (S3-compat)              │
                  │  - Realtime (CDC)                   │
                  │  - Edge Functions (Deno)            │
                  └──┬──────────┬──────────┬────────┬───┘
                     │          │          │        │
        ┌────────────┘          │          │        └────────────┐
        │                       │          │                     │
   ┌────▼──────────┐    ┌───────▼──┐  ┌────▼────────┐    ┌──────▼─────────────┐
   │ n8n           │    │ Claude   │  │ Evolution   │    │ Adapters externos  │
   │ self-hosted   │    │ API      │  │ API self    │    │ (Projuris, Conta  │
   │ (VPS Docker)  │    │ (Sonnet/ │  │ hosted      │    │ Azul, Asaas,      │
   │ - Scrapers    │    │  Opus/   │  │ (WhatsApp)  │    │ ChatGuru, ZapSign, │
   │ - Webhooks    │    │  Haiku)  │  │             │    │ Gmail, Drive,      │
   │ - Régua       │    │          │  │             │    │ Postmark, SEI,     │
   │ - Cron jobs   │    │          │  │             │    │ CNES, Gov.br)      │
   └───────────────┘    └──────────┘  └─────────────┘    └────────────────────┘
```

### 1.2 Camadas lógicas

| Camada | Responsabilidade |
|---|---|
| **Apresentação** | Next.js 15 (3 apps: interno, portal, painel) — RSC + Client Components |
| **API / Edge** | Supabase Edge Functions (Deno) + Next.js Route Handlers — endpoints REST/RPC |
| **Domínio** | Postgres functions, triggers, regras de negócio em SQL puro onde aplicável |
| **Persistência** | Postgres com RLS, pgvector, full-text search (tsvector) |
| **Mensageria** | Postgres `pg_notify` + Supabase Realtime + n8n para orquestração |
| **Automação** | n8n self-hosted (workflows visuais + JS custom) |
| **Integrações** | Adapters em Edge Functions ou n8n nodes; padrão **Hexagonal/Ports-Adapters** |

### 1.3 Decisões arquiteturais (ADRs sumarizadas)

| # | Decisão | Motivo |
|---|---|---|
| **ADR-001** | Monolito modular sobre Supabase | Equipe pequena, time-to-market crítico, dev experience. Microsserviços só se justificarão pós-PMF. |
| **ADR-002** | RLS no banco (não service-layer auth) | Single source of truth, impossível bypassar via cliente JS. |
| **ADR-003** | Eventos via outbox + Realtime | Garantia "at-least-once" sem broker dedicado (Kafka/SQS). |
| **ADR-004** | n8n para orquestração externa | Workflows visuais editáveis pela equipe; redução de código backend. |
| **ADR-005** | Claude como IA primária (Sonnet default) | Caching nativo (-90% custo), context 200k, ferramentas robustas. |
| **ADR-006** | pgvector para embeddings | Mesmo banco do operacional; sem segundo storage (Pinecone, Weaviate). |
| **ADR-007** | Snapshots imutáveis com versionamento | Auditoria jurídica/financeira; mudança gera v2 (não edita v1). |
| **ADR-008** | Soft-delete + retenção configurável | LGPD: right-to-be-forgotten + obrigações legais coexistem. |
| **ADR-009** | Multi-tenancy via `organization_id` row-level | Preparação para SaaS multi-escritório no futuro (v2 da plataforma). |
| **ADR-010** | Storage Supabase + signed URLs | Não expor URLs públicas de documentos; expiração 15min. |

---

## 2. Modelo de domínio canônico

### 2.1 Entidades centrais (visão lógica)

```
┌──────────────┐
│ Organization │ (1 — Hyago Viana Adv.; preparado p/ multi-tenant futuro)
└──────┬───────┘
       │ 1..*
       ▼
┌──────────────┐      ┌───────────────┐
│    User      │◄────►│   UserRole    │
└──────────────┘      └───────────────┘
       │
       │ assigned_to
       ▼
┌──────────────┐                        ┌──────────────────┐
│   Client     │ 1..* ────────────────► │      Case        │
│ (PF/PJ)      │                        │  (caso jurídico) │
└──────┬───────┘                        └────┬─────────────┘
       │                                     │
       │                                     ├──► CaseEvent (timeline)
       │                                     ├──► CaseTask
       │                                     ├──► CaseDocument
       │                                     ├──► CaseCommunication
       │                                     ├──► TermoAcerto (snapshot v1..vN)
       │                                     ├──► Parcela
       │                                     └──► RelatedProcess (Projuris ref)
       │
       └──► ContractHonorarios
       └──► ConsentRecord
       └──► CommercialOpportunity (P4)
       └──► WhatsappConversation (P6)
```

### 2.2 Glossário técnico das entidades

| Entidade | Descrição | Ciclo de vida |
|---|---|---|
| **Organization** | Tenant (escritório). V1 = uma só. | Imutável após criação |
| **User** | Funcionário, advogado, prestador externo, cliente final | Convidado → ativo → suspenso |
| **UserRole** | Papel + permissões. Multi-role permitido. | Granted/revoked |
| **Client** | Pessoa Física (CPF) ou Jurídica (CNPJ) | Lead → ativo → arquivado |
| **Case** | Caso jurídico — uma demanda. Cliente pode ter N casos. | Estados canônicos: macrostatus_operacional + macrostatus_financeiro |
| **CaseEvent** | Evento na timeline (transição, ação, integração) | Imutável |
| **CaseTask** | Tarefa atribuída a usuário | Pending → in-progress → done/cancelled |
| **CaseDocument** | Documento vinculado ao caso (PDF, imagem, planilha) | Pending → received → approved → archived |
| **TermoAcerto** | Snapshot imutável do acordo financeiro | v1 ativo; pode ser substituído por v2 (v1 → SUBSTITUIDO) |
| **Parcela** | Parcela do parcelamento de honorários | Pendente → paga / vencida / renegociada |
| **ContractHonorarios** | Contrato de honorários (1 por cliente, reutilizável em casos do mesmo tipo) | Assinado → ativo → encerrado |
| **ConsentRecord** | Registro LGPD | Imutável, versionado por política |
| **AuditLog** | Toda ação sensível | Append-only, particionado mensalmente |

---

## 3. Schema Supabase — Tabelas globais

> Schema **escrito em PostgreSQL puro**, pronto para `supabase migrations`. Convenções: snake_case, UUIDs como PK, timestamps `created_at`/`updated_at` + soft-delete `deleted_at`.

### 3.1 Extensions necessárias

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- fuzzy search
CREATE EXTENSION IF NOT EXISTS "unaccent";      -- normalização PT-BR
CREATE EXTENSION IF NOT EXISTS "vector";        -- embeddings (Projeto 2/3)
CREATE EXTENSION IF NOT EXISTS "pg_net";        -- HTTP requests (webhooks)
```

### 3.2 ENUMs canônicos

```sql
-- Tipos de caso (V1: FIES; expansível)
CREATE TYPE case_type AS ENUM (
  'FIES_ESF_DGM',
  'FIES_ESF_PORTARIA',
  'FIES_MILITAR',
  'FIES_COVID',
  'MAIS_MEDICOS_INDENIZACAO',
  'MAIS_MEDICOS_EIXO_FORMACAO',
  'RESIDENCIA_AUXILIO_MORADIA',
  'RESIDENCIA_CNRM',
  'POSSESSORIA',
  'TRABALHISTA',
  'DEFESA_CFM_CRM',
  'MS_PREVIDENCIARIO',
  'MS_SAUDE',
  'OUTRO'
);

-- Origem do caso
CREATE TYPE case_origin AS ENUM (
  'PRIMEIRO',
  'RENOVACAO',
  'NOVA_SOLICITACAO'
);

-- Macrostatus operacional
CREATE TYPE macrostatus_operacional AS ENUM (
  'ONBOARDING',
  'TRIAGEM',
  'DOCS_PENDENTES',
  'DGM_ENVIADA',
  'PRONTO_PROTOCOLO',
  'ACOMPANHAMENTO_ADM',
  'JUDICIAL_OPERACIONAL',
  'IMPLANTADO',
  'ENCERRADO_OPERACIONAL',
  'CANCELADO'
);

-- Macrostatus financeiro
CREATE TYPE macrostatus_financeiro AS ENUM (
  'NAO_APLICAVEL',
  'ELABORANDO_TERMO',
  'CONFERINDO_TERMO',
  'APROVACAO_JURIDICA',
  'COMUNICANDO_ABATIMENTO',
  'APRESENTANDO_TERMO',
  'TERMO_EM_DISCORDANCIA',
  'TERMO_ACEITO',
  'ATIVO',
  'INADIMPLENTE',
  'COBRANCA_JUDICIAL',
  'JUDICIAL_FINANCEIRO',
  'QUITADO',
  'SUSPENSO',
  'CANCELADO_FINANCEIRO'
);

-- Resultado do caso
CREATE TYPE case_result AS ENUM ('TOTAL', 'PARCIAL', 'INSUCESSO', 'INVIAVEL', 'DESISTENCIA');

-- Status documento
CREATE TYPE document_status AS ENUM ('PENDENTE', 'RECEBIDO', 'GERADO', 'DISPENSADO', 'SUBSTITUIDO', 'APROVADO');

-- Status parcela
CREATE TYPE parcela_status AS ENUM ('PENDENTE', 'PAGA', 'VENCIDA', 'RENEGOCIADA', 'CANCELADA');

-- Status snapshot Termo
CREATE TYPE termo_snapshot_status AS ENUM (
  'RASCUNHO', 'EM_CONFERENCIA', 'APROVADO_JURIDICO',
  'APRESENTADO', 'ACEITO', 'RECUSADO', 'SUBSTITUIDO'
);

-- Tipo Termo
CREATE TYPE termo_tipo AS ENUM ('PARCIAL', 'COMPLEMENTAR');

-- Hold motivo (financeiro)
CREATE TYPE hold_motivo AS ENUM (
  'AGUARDANDO_DECISAO_JUDICIAL',
  'PENDENTE_READEQUACAO_PARCELA',
  'CLIENTE_INERTE',
  'OUTRO'
);

-- Tipo pessoa
CREATE TYPE person_type AS ENUM ('PF', 'PJ');

-- Status user
CREATE TYPE user_status AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED');

-- Tipo evento (alta-cardinalidade; mantemos como TEXT validado por CHECK)
-- (não enum por flexibilidade)
```

### 3.3 Tabela: `organizations`

```sql
CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  cnpj            text UNIQUE,
  slug            text UNIQUE NOT NULL,
  brand_config    jsonb DEFAULT '{}'::jsonb,         -- cores, logo URL, etc.
  feature_flags   jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed inicial
INSERT INTO organizations (name, cnpj, slug)
VALUES ('Hyago Viana Advocacia', '62.880.271/0001-36', 'hyagoviana');
```

### 3.4 Tabela: `users` (espelha `auth.users` do Supabase)

```sql
CREATE TABLE users (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES organizations(id),
  email            text NOT NULL UNIQUE,
  full_name        text NOT NULL,
  display_name     text,
  phone            text,
  avatar_url       text,
  status           user_status NOT NULL DEFAULT 'INVITED',
  preferences      jsonb DEFAULT '{}'::jsonb,        -- atalhos, modo escuro, etc.
  last_active_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX idx_users_org ON users(organization_id) WHERE deleted_at IS NULL;
```

### 3.5 Tabela: `roles` e `user_roles`

```sql
CREATE TABLE roles (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES organizations(id),
  name             text NOT NULL,
  description      text,
  permissions      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array de strings: 'cases.read', 'cases.write', ...
  is_system        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE TABLE user_roles (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by      uuid REFERENCES users(id),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,  -- para prestadores externos com escopo temporal
  UNIQUE(user_id, role_id)
);

-- Seed papéis
INSERT INTO roles (organization_id, name, description, permissions, is_system) VALUES
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'admin',                  'Administrador',          '["*"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'advogado_titular',       'Advogado Titular',       '["cases.*","tese.write","decisao.write","termo.approve"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'advogado_associado',     'Advogado Associado',     '["cases.read","cases.write","tese.read","decisao.read"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'prestador_externo',      'Prestador Externo',      '["cases.read.scoped"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'controladoria',          'Controladoria',          '["controladoria.*","cases.read","tasks.*"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'comercial',              'Comercial',              '["commercial.*","clients.read"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'financeiro_elaborador',  'Financeiro (Elaborador)','["termo.elaborate","parcela.read","client.read"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'financeiro_conferidor',  'Financeiro (Conferidor)','["termo.confirm","parcela.read"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'operacional',            'Operacional/ADM',        '["cases.write.operacional","docs.write","tasks.*"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'marketing',              'Marketing',              '["marketing.*"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'cliente_portal',         'Cliente (Portal)',       '["portal.self"]', true),
  ((SELECT id FROM organizations WHERE slug='hyagoviana'), 'agente_ia',              'Agente IA (sistema)',    '["whatsapp.read","whatsapp.write","clients.read.minimal"]', true);
```

### 3.6 Tabela: `clients` (Pessoa Física/Jurídica)

```sql
CREATE TABLE clients (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  person_type         person_type NOT NULL,
  -- Identificação
  full_name           text NOT NULL,
  social_name         text,
  cpf                 text,                                  -- somente PF
  cnpj                text,                                  -- somente PJ
  rg                  text,
  rg_issuer           text,
  birth_date          date,
  -- Contato
  email               text,
  phone               text,
  phone_secondary     text,
  -- Endereço (jsonb por flexibilidade)
  address             jsonb,                                 -- {street, number, complement, neighborhood, city, state, zip, country}
  -- Profissional (campos jurídicos específicos)
  professional_info   jsonb DEFAULT '{}'::jsonb,             -- {crm, oab, institutional_link, programs:[FIES, MAIS_MEDICOS, ...]}
  -- FIES-específico
  fies_data           jsonb DEFAULT '{}'::jsonb,             -- {bank, debt_balance, contract_post_2018, suspension_active, ...}
  -- Origem
  source              text,                                  -- WHATSAPP, INDICACAO, ZAPSIGN, MANUAL, ...
  source_details      jsonb DEFAULT '{}'::jsonb,
  -- Vinculações externas
  drive_folder_id     text,                                  -- Google Drive folder ID
  zapsign_doc_id      text,
  conta_azul_id       text,
  asaas_id            text,
  chatguru_contact_id text,
  -- Marketing/Compliance
  marketing_opt_in    boolean NOT NULL DEFAULT false,
  whatsapp_opt_in     boolean NOT NULL DEFAULT false,
  -- Soft-delete + auditoria
  notes               text,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  -- Constraints
  CONSTRAINT chk_pf_pj CHECK (
    (person_type = 'PF' AND cpf IS NOT NULL) OR
    (person_type = 'PJ' AND cnpj IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_clients_cpf      ON clients(organization_id, cpf)  WHERE cpf IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_clients_cnpj     ON clients(organization_id, cnpj) WHERE cnpj IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_clients_full_name_trgm  ON clients USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_clients_email           ON clients(organization_id, email);
CREATE INDEX idx_clients_phone           ON clients(organization_id, phone);
```

### 3.7 Tabela: `cases`

```sql
CREATE TABLE cases (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             uuid NOT NULL REFERENCES organizations(id),
  client_id                   uuid NOT NULL REFERENCES clients(id),
  case_code                   text NOT NULL,                  -- ex: FIES-2026-0042 (gerado por sequence)
  case_type                   case_type NOT NULL,
  origin                      case_origin NOT NULL DEFAULT 'PRIMEIRO',
  -- Estados canônicos
  macrostatus_operacional     macrostatus_operacional NOT NULL DEFAULT 'ONBOARDING',
  macrostatus_financeiro      macrostatus_financeiro  NOT NULL DEFAULT 'NAO_APLICAVEL',
  -- Datas-chave
  date_macrostatus_op_at      timestamptz NOT NULL DEFAULT now(),
  date_macrostatus_fin_at     timestamptz,
  date_implantado_at          timestamptz,                    -- gatilho de bifurcação
  date_encerrado_op_at        timestamptz,
  date_arquivado_at           timestamptz,                    -- só após convergência
  -- Identificação processual/administrativa
  nup                         text,                           -- protocolo SEI/eGov
  projuris_id                 text,                           -- link Projuris (Projeto 2)
  -- Flags
  flag_judicial_operacional   boolean NOT NULL DEFAULT false,
  flag_judicial_financeiro    boolean NOT NULL DEFAULT false,
  flag_risco                  boolean NOT NULL DEFAULT false,
  flag_contrato_pos_2018      boolean NOT NULL DEFAULT false, -- alerta inviabilidade adm.
  -- Hold (somente quando macrostatus_financeiro = SUSPENSO)
  hold_motivo                 hold_motivo,
  hold_descricao              text,
  hold_iniciado_em            timestamptz,
  -- Resultado (terminal)
  result                      case_result,
  result_observation          text,
  -- Atribuições
  responsavel_operacional_id  uuid REFERENCES users(id),
  responsavel_financeiro_id   uuid REFERENCES users(id),
  responsavel_juridico_id     uuid REFERENCES users(id),
  -- Vinculações externas
  drive_folder_id             text,
  -- Soft-delete + auditoria
  created_by                  uuid REFERENCES users(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz,
  -- Constraints
  CONSTRAINT chk_hold CHECK (
    (macrostatus_financeiro = 'SUSPENSO' AND hold_motivo IS NOT NULL) OR
    (macrostatus_financeiro <> 'SUSPENSO' AND hold_motivo IS NULL)
  )
);

-- Sequence + trigger para case_code (FIES-2026-0042)
CREATE SEQUENCE case_code_seq START 1;

CREATE OR REPLACE FUNCTION fn_generate_case_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_code IS NULL THEN
    NEW.case_code := upper(split_part(NEW.case_type::text, '_', 1)) || '-' ||
                     to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('case_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gen_case_code BEFORE INSERT ON cases
  FOR EACH ROW EXECUTE FUNCTION fn_generate_case_code();

-- Índices
CREATE UNIQUE INDEX idx_cases_code         ON cases(organization_id, case_code);
CREATE INDEX idx_cases_client              ON cases(client_id);
CREATE INDEX idx_cases_status_op           ON cases(organization_id, macrostatus_operacional) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_status_fin          ON cases(organization_id, macrostatus_financeiro)  WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_resp_op             ON cases(responsavel_operacional_id);
CREATE INDEX idx_cases_nup                 ON cases(nup) WHERE nup IS NOT NULL;
CREATE INDEX idx_cases_projuris            ON cases(projuris_id) WHERE projuris_id IS NOT NULL;
```

### 3.8 Tabela: `case_events` (timeline / event store)

```sql
CREATE TABLE case_events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  case_id         uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type      text NOT NULL,                     -- ex: 'macrostatus.changed', 'document.received', 'task.created'
  actor_id        uuid REFERENCES users(id),         -- pode ser NULL (eventos de sistema)
  actor_kind      text NOT NULL DEFAULT 'USER',      -- USER, SYSTEM, INTEGRATION, IA_AGENT
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Para realtime / sincronização
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  -- Tags / categorização
  category        text,                              -- operacional | financeiro | comunicacao | sistema | ia
  visibility      text NOT NULL DEFAULT 'INTERNAL',  -- INTERNAL | CLIENT (mostra no portal) | AUDIT_ONLY
  -- Particionamento por mês (performance em escala)
  -- (criado abaixo)
  CONSTRAINT chk_actor CHECK (
    (actor_kind = 'USER' AND actor_id IS NOT NULL) OR
    (actor_kind <> 'USER')
  )
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_events_case ON case_events(case_id, occurred_at DESC);
CREATE INDEX idx_events_type ON case_events(event_type, occurred_at DESC);

-- Partições mensais (criadas automaticamente via cron Edge Function)
CREATE TABLE case_events_2026_01 PARTITION OF case_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... etc; ver §14.5 cron auto-create
```

### 3.9 Tabela: `case_tasks`

```sql
CREATE TABLE case_tasks (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  case_id             uuid REFERENCES cases(id) ON DELETE CASCADE, -- pode ser NULL (tarefa orgânica não-vinculada)
  parent_task_id      uuid REFERENCES case_tasks(id),
  title               text NOT NULL,
  description         text,
  task_type           text NOT NULL,                 -- ex: 'PROTOCOLO_EGOV', 'QA_DECLARACAO', 'CONFERIR_TERMO'
  category            text NOT NULL,                 -- OPERACIONAL | FINANCEIRO | JURIDICO | COMERCIAL | MARKETING
  origin              text NOT NULL DEFAULT 'AUTOMATIC', -- AUTOMATIC | MANUAL
  priority            text NOT NULL DEFAULT 'NORMAL', -- LOW | NORMAL | HIGH | URGENT
  status              text NOT NULL DEFAULT 'PENDING', -- PENDING | ACCEPTED | IN_PROGRESS | DONE | CANCELLED | EXPIRED
  -- Atribuição
  assigned_to_id      uuid REFERENCES users(id),
  assigned_team       text,                          -- alternativa: "OPE", "JUR", "FIN", "ADM"
  -- Datas
  due_at              timestamptz,
  sla_at              timestamptz,                   -- prazo crítico (legal)
  accepted_at         timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  -- Contexto IA
  ai_suggestion       jsonb,                         -- {tese_id, decisao_id, confidence, ...}
  -- Auditoria
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_tasks_case      ON case_tasks(case_id);
CREATE INDEX idx_tasks_assignee  ON case_tasks(assigned_to_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due       ON case_tasks(due_at) WHERE status NOT IN ('DONE', 'CANCELLED');
CREATE INDEX idx_tasks_type      ON case_tasks(task_type);
```

### 3.10 Tabela: `case_documents`

```sql
CREATE TABLE case_documents (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  case_id             uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_code       text NOT NULL,                  -- ex: 'DOC-01', 'DOC-06-DECLARACAO_COVID'
  title               text NOT NULL,
  description         text,
  status              document_status NOT NULL DEFAULT 'PENDENTE',
  -- Storage
  storage_path        text,                          -- supabase storage path
  drive_file_id       text,                          -- google drive file id
  mime_type           text,
  file_size_bytes     bigint,
  pages_count         int,
  -- Versionamento
  version             int NOT NULL DEFAULT 1,
  supersedes          uuid REFERENCES case_documents(id), -- referência para versão anterior
  -- Metadados ricos
  ocr_text            text,                          -- texto extraído (busca full-text)
  ocr_confidence      numeric(5,2),
  extracted_data      jsonb,                         -- campos extraídos por IA
  hash_sha256         text,                          -- imutabilidade
  -- Origem
  received_via        text,                          -- WHATSAPP | EMAIL | PORTAL | MANUAL | DRIVE_SYNC | GENERATED
  uploaded_by         uuid REFERENCES users(id),
  approved_by         uuid REFERENCES users(id),
  approved_at         timestamptz,
  -- Auditoria
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX idx_docs_case            ON case_documents(case_id);
CREATE INDEX idx_docs_status          ON case_documents(case_id, status);
CREATE INDEX idx_docs_hash            ON case_documents(hash_sha256);
CREATE INDEX idx_docs_ocr_fulltext    ON case_documents USING gin (to_tsvector('portuguese', coalesce(ocr_text, '')));
```

### 3.11 Tabela: `case_communications`

```sql
CREATE TABLE case_communications (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  case_id             uuid REFERENCES cases(id),                -- pode ser NULL antes da vinculação
  client_id           uuid REFERENCES clients(id),
  channel             text NOT NULL,                            -- WHATSAPP | EMAIL | SMS | PORTAL | PHONE_CALL | IN_PERSON
  direction           text NOT NULL,                            -- INBOUND | OUTBOUND
  thread_id           text,                                     -- agrupamento (ChatGuru thread, Gmail thread, etc.)
  external_message_id text,
  -- Conteúdo
  subject             text,
  body                text,
  attachments         jsonb DEFAULT '[]'::jsonb,                -- [{name, storage_path, mime, size}]
  -- Metadados
  sent_at             timestamptz,
  received_at         timestamptz,
  read_at             timestamptz,
  -- Classificação (Projeto 6 - IA preenche)
  classification      text,
  sentiment           text,
  intent              text,
  ai_summary          text,
  -- Auditoria
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comm_case      ON case_communications(case_id);
CREATE INDEX idx_comm_client    ON case_communications(client_id);
CREATE INDEX idx_comm_thread    ON case_communications(thread_id);
CREATE INDEX idx_comm_channel   ON case_communications(channel, direction);
```

### 3.12 Tabela: `contract_honorarios`

```sql
CREATE TABLE contract_honorarios (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             uuid NOT NULL REFERENCES organizations(id),
  client_id                   uuid NOT NULL REFERENCES clients(id),
  case_type                   case_type NOT NULL,                 -- contrato vinculado ao tipo (reutilizado em renovações)
  -- Termos
  percentual_honorarios       numeric(5,2) NOT NULL DEFAULT 15.00,
  valor_parcela_padrao        numeric(12,2) NOT NULL DEFAULT 500.00,
  desconto_avista_percentual  numeric(5,2) NOT NULL DEFAULT 10.00,
  clausula_especial           text,
  sistema_cobranca_default    text DEFAULT 'CONTA_AZUL',          -- CONTA_AZUL | ASAAS
  -- Assinatura
  zapsign_doc_id              text,
  signed_at                   timestamptz,
  signed_pdf_storage_path     text,
  -- Status
  status                      text NOT NULL DEFAULT 'ATIVO',      -- ATIVO | ENCERRADO | CANCELADO
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_client ON contract_honorarios(client_id, case_type);
```

### 3.13 Tabela: `termo_acerto_snapshots`

```sql
CREATE TABLE termo_acerto_snapshots (
  id                              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id                 uuid NOT NULL REFERENCES organizations(id),
  case_id                         uuid NOT NULL REFERENCES cases(id),
  version                         int NOT NULL,
  supersedes                      uuid REFERENCES termo_acerto_snapshots(id),
  -- Cálculo financeiro (todos imutáveis após APROVADO_JURIDICO)
  saldo_antes                     numeric(14,2) NOT NULL,
  saldo_depois                    numeric(14,2) NOT NULL,
  parcelas_pagas_no_processo      numeric(14,2) NOT NULL DEFAULT 0,
  valor_efetivo_abatimento        numeric(14,2) NOT NULL,
  percentual_honorarios           numeric(5,2)  NOT NULL,
  valor_total_honorarios          numeric(14,2) NOT NULL,
  valor_parcela                   numeric(12,2) NOT NULL,
  qtd_parcelas                    int NOT NULL,
  valor_ultima_parcela            numeric(12,2),
  valor_avista                    numeric(14,2),                   -- com desconto à vista
  forma_pagamento_escolhida       text,                            -- PARCELADO | A_VISTA
  tipo_termo                      termo_tipo NOT NULL,
  -- Documentos
  pdf_storage_path                text,
  pdf_hash_sha256                 text,
  drive_file_id                   text,
  -- Workflow
  status                          termo_snapshot_status NOT NULL DEFAULT 'RASCUNHO',
  elaborado_por_id                uuid NOT NULL REFERENCES users(id),
  conferido_por_id                uuid REFERENCES users(id),
  aprovado_juridico_por_id        uuid REFERENCES users(id),
  aprovacao_automatica            boolean NOT NULL DEFAULT false,
  criterios_aprovacao_auto        jsonb,                           -- {tipo:'PARCIAL', percentual:15, padrao:true, ...}
  apresentado_em                  timestamptz,
  apresentado_canal               text,                            -- PORTAL | WHATSAPP | PRESENCIAL | ZAPSIGN
  aceito_em                       timestamptz,
  aceito_canal                    text,
  aceito_evidencia                jsonb,                           -- {ip, user_agent, timestamp, signed_text}
  recusado_em                     timestamptz,
  recusado_motivo                 text,
  -- Datas
  elaborado_em                    timestamptz NOT NULL DEFAULT now(),
  conferido_em                    timestamptz,
  aprovado_em                     timestamptz,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  -- CONSTRAINTS DE SEGREGAÇÃO
  CONSTRAINT chk_segregacao_elab_conf CHECK (
    conferido_por_id IS NULL OR conferido_por_id <> elaborado_por_id
  ),
  UNIQUE (case_id, version)
);

CREATE INDEX idx_termo_case   ON termo_acerto_snapshots(case_id);
CREATE INDEX idx_termo_status ON termo_acerto_snapshots(case_id, status);
```

### 3.14 Tabela: `parcelas`

```sql
CREATE TABLE parcelas (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             uuid NOT NULL REFERENCES organizations(id),
  case_id                     uuid NOT NULL REFERENCES cases(id),
  termo_snapshot_id           uuid NOT NULL REFERENCES termo_acerto_snapshots(id),
  numero                      int NOT NULL,
  valor                       numeric(12,2) NOT NULL,
  vencimento                  date NOT NULL,
  status                      parcela_status NOT NULL DEFAULT 'PENDENTE',
  -- Pagamento
  data_pagamento              timestamptz,
  valor_pago                  numeric(12,2),
  metodo_pagamento            text,                              -- BOLETO | CARTAO | PIX | TRANSFERENCIA | DINHEIRO
  -- Integração sistema cobrança
  sistema_cobranca            text NOT NULL,                     -- CONTA_AZUL | ASAAS
  sistema_cobranca_id_ext     text,                              -- ID externo (boleto/cobrança)
  boleto_url                  text,
  qrcode_pix                  text,
  -- Renegociação
  renegociacao_id             uuid REFERENCES renegociacoes(id), -- (table abaixo)
  -- Auditoria
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (termo_snapshot_id, numero)
);

CREATE INDEX idx_parcelas_case        ON parcelas(case_id);
CREATE INDEX idx_parcelas_status      ON parcelas(status);
CREATE INDEX idx_parcelas_vencimento  ON parcelas(vencimento) WHERE status IN ('PENDENTE', 'VENCIDA');

CREATE TABLE renegociacoes (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  case_id             uuid NOT NULL REFERENCES cases(id),
  termo_snapshot_id   uuid NOT NULL REFERENCES termo_acerto_snapshots(id),
  motivo              text NOT NULL,                              -- DIFICULDADE_FINANCEIRA | DISCORDANCIA | ACORDO_AMIGAVEL | DECISAO_JUDICIAL
  descricao           text,
  novo_snapshot_id    uuid REFERENCES termo_acerto_snapshots(id),
  aditivo_pdf_path    text,
  aprovado_por_id     uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

### 3.15 Tabela: `consent_records` (LGPD)

```sql
CREATE TABLE consent_records (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  client_id           uuid REFERENCES clients(id),
  user_id             uuid REFERENCES users(id),                -- caso seja usuário do app
  -- Identificação no momento
  cpf                 text,                                     -- captura redundante (imutável)
  full_name           text,
  email               text,
  phone               text,
  -- Consentimento
  policy_version      text NOT NULL,                            -- ex: '1.0', '1.1'
  finalidade          text NOT NULL,                            -- DADOS_OPERACIONAIS | MARKETING | WHATSAPP | COMUNICACAO_TRANSACIONAL
  granted             boolean NOT NULL,
  channel             text NOT NULL,                            -- WHATSAPP | PORTAL | ZAPSIGN | EMAIL | PRESENCIAL
  evidence            jsonb NOT NULL DEFAULT '{}'::jsonb,       -- {ip, user_agent, timestamp, text_shown}
  -- Revogação
  revoked_at          timestamptz,
  revoked_reason      text,
  -- Auditoria (imutável)
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_consent_client    ON consent_records(client_id);
CREATE INDEX idx_consent_finalidade ON consent_records(finalidade);
```

### 3.16 Tabela: `audit_log`

```sql
CREATE TABLE audit_log (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  actor_user_id       uuid REFERENCES users(id),
  actor_kind          text NOT NULL DEFAULT 'USER',           -- USER | SYSTEM | INTEGRATION | IA_AGENT
  action              text NOT NULL,                          -- ex: 'case.create', 'termo.approve', 'user.role.grant'
  entity_kind         text NOT NULL,                          -- 'case', 'client', 'termo', 'user', ...
  entity_id           uuid,
  diff                jsonb,                                  -- {before:{...}, after:{...}}
  -- Contexto
  ip_address          inet,
  user_agent          text,
  request_id          text,
  metadata            jsonb DEFAULT '{}'::jsonb,
  -- Imutável
  occurred_at         timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_audit_actor  ON audit_log(actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_kind, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action, occurred_at DESC);
```

### 3.17 Tabelas auxiliares (referenciadas em outros PRDs)

> Definições detalhadas nos PRDs específicos:

- `case_outbox_events` — outbox pattern para integração externa (PRD Master §5).
- `teses`, `decisoes`, `decisoes_embeddings` — base de teses/decisões (PRD Projeto 2).
- `minutas`, `pecas_validadas`, `pecas_embeddings` — peticionamento (PRD Projeto 3).
- `commercial_opportunities`, `commercial_leads`, `commercial_funnel_stages` — CRM (PRD Projeto 4).
- `content_calendar`, `content_drafts`, `media_assets` — marketing (PRD Projeto 5).
- `whatsapp_conversations`, `whatsapp_messages`, `agent_classifications` — agente WhatsApp (PRD Projeto 6).
- `integration_logs` — logs detalhados de cada chamada externa.
- `notifications` — notificações ao usuário (sino do app).

### 3.18 Total de tabelas previstas

| Categoria | Tabelas | Estimativa |
|---|---|---|
| **Globais (este PRD)** | 17 | ✅ Detalhadas acima |
| **Projeto 1 — extras (FIES-específicas)** | ~6 | covid_data, esf_data, sei_tracking, cnes_sync, etc. |
| **Projeto 2** | ~8 | projuris_sync, teses, decisoes, embeddings, prazos, excecoes |
| **Projeto 3** | ~6 | minutas, pecas, fontes_rastreaveis, checklists_prontidao |
| **Projeto 4** | ~7 | leads, oportunidades, funis, campanhas_meta, campanhas_google |
| **Projeto 5** | ~5 | calendario, conteudos, midia, briefings |
| **Projeto 6** | ~4 | conversations, messages, classifications, handoffs |
| **TOTAL ESTIMADO** | **~53 tabelas** | |

---

## 4. Autenticação, autorização e RLS

### 4.1 Auth flow

```
USER ─►  app.hyagoviana.adv.br
         │
         ▼ /entrar
         Supabase Auth (email + senha + MFA TOTP opcional)
         │
         ▼ JWT issued
         App armazena em cookie httpOnly (SSR cookies do @supabase/ssr)
         │
         ▼ todas as queries ao DB são autenticadas (JWT validado pela RLS)
```

**Convidar usuário** (admin):
1. Admin clica "Convidar" → escolhe e-mail + roles.
2. Backend gera convite (`auth.invite_user`) → e-mail enviado pelo Supabase.
3. Usuário cria senha → status `ACTIVE` em `users`.

**Reset de senha:** fluxo padrão Supabase, com link de e-mail por 1h.

**MFA:** TOTP obrigatório para roles `admin`, `advogado_titular`, `financeiro_*`.

### 4.2 RLS — Princípios

- **Todo SELECT, INSERT, UPDATE, DELETE passa por policy.**
- Service role bypassa RLS (usado apenas em Edge Functions seguras, n8n e migrations).
- **Tenant isolation primeiro:** toda tabela tem `organization_id`; policy garante `org_id = current_user_org()`.

### 4.3 Função helper: `current_user_org()`

```sql
CREATE OR REPLACE FUNCTION current_user_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION current_user_has_permission(perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  has_perm boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND (
        r.permissions @> '["*"]'::jsonb
        OR r.permissions @> to_jsonb(perm)
      )
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) INTO has_perm;
  RETURN has_perm;
END $$;
```

### 4.4 RLS Policies — exemplos críticos

```sql
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Leitura: dentro da organização + permissão
CREATE POLICY clients_select ON clients FOR SELECT
USING (
  organization_id = current_user_org()
  AND current_user_has_permission('clients.read')
);

-- Inserção: somente quem pode escrever
CREATE POLICY clients_insert ON clients FOR INSERT
WITH CHECK (
  organization_id = current_user_org()
  AND current_user_has_permission('clients.write')
);

-- Update: idem
CREATE POLICY clients_update ON clients FOR UPDATE
USING (organization_id = current_user_org() AND current_user_has_permission('clients.write'));

-- Delete: somente admin
CREATE POLICY clients_delete ON clients FOR DELETE
USING (organization_id = current_user_org() AND current_user_has_permission('admin.clients.delete'));

-- Cases (similar, com regra adicional: prestador_externo só vê casos atribuídos)
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY cases_select ON cases FOR SELECT
USING (
  organization_id = current_user_org()
  AND (
    current_user_has_permission('cases.read')
    OR (
      current_user_has_permission('cases.read.scoped')
      AND (
        responsavel_operacional_id = auth.uid()
        OR responsavel_financeiro_id = auth.uid()
        OR responsavel_juridico_id = auth.uid()
      )
    )
  )
);

-- Termo Acerto: enforce segregação elaborador ≠ conferidor a nível de DB
ALTER TABLE termo_acerto_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY termo_update_conferencia ON termo_acerto_snapshots FOR UPDATE
USING (
  organization_id = current_user_org()
  AND current_user_has_permission('termo.confirm')
  AND elaborado_por_id <> auth.uid()  -- redundante com CHECK, mas explícito
);
```

### 4.5 Portal do Cliente (cliente final)

Cliente final autentica-se em `portal.hyagoviana.adv.br` com **email + senha** OU **CPF + senha**. Role: `cliente_portal`.

Policy específica:
```sql
CREATE POLICY portal_cases ON cases FOR SELECT
USING (
  current_user_has_permission('portal.self')
  AND client_id IN (SELECT id FROM clients WHERE email = (auth.jwt() ->> 'email'))
);
```

---

## 5. Motor de eventos

### 5.1 Pattern: Outbox

Toda transição de estado **escreve evento na mesma transação**:

```sql
-- Trigger: ao mudar macrostatus, inserir em case_events
CREATE OR REPLACE FUNCTION fn_log_macrostatus_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.macrostatus_operacional <> NEW.macrostatus_operacional THEN
    INSERT INTO case_events (organization_id, case_id, event_type, actor_id, actor_kind, payload, category)
    VALUES (
      NEW.organization_id, NEW.id, 'macrostatus.op.changed',
      auth.uid(), CASE WHEN auth.uid() IS NULL THEN 'SYSTEM' ELSE 'USER' END,
      jsonb_build_object('from', OLD.macrostatus_operacional, 'to', NEW.macrostatus_operacional),
      'operacional'
    );
  END IF;

  IF OLD.macrostatus_financeiro <> NEW.macrostatus_financeiro THEN
    INSERT INTO case_events (organization_id, case_id, event_type, actor_id, actor_kind, payload, category)
    VALUES (
      NEW.organization_id, NEW.id, 'macrostatus.fin.changed',
      auth.uid(), CASE WHEN auth.uid() IS NULL THEN 'SYSTEM' ELSE 'USER' END,
      jsonb_build_object('from', OLD.macrostatus_financeiro, 'to', NEW.macrostatus_financeiro),
      'financeiro'
    );
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_macrostatus AFTER UPDATE OF macrostatus_operacional, macrostatus_financeiro ON cases
  FOR EACH ROW EXECUTE FUNCTION fn_log_macrostatus_change();
```

### 5.2 Bifurcação automática (Operacional → Financeiro)

```sql
-- Quando IMPLANTADO: inicia rastro financeiro
CREATE OR REPLACE FUNCTION fn_bifurcar_para_financeiro()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.macrostatus_operacional = 'IMPLANTADO'
     AND OLD.macrostatus_operacional <> 'IMPLANTADO'
     AND NEW.macrostatus_financeiro = 'NAO_APLICAVEL' THEN
    -- Marca bifurcação
    UPDATE cases
       SET macrostatus_financeiro = 'ELABORANDO_TERMO',
           date_macrostatus_fin_at = now(),
           date_implantado_at = now()
     WHERE id = NEW.id;

    -- Cria tarefa automática
    INSERT INTO case_tasks (
      organization_id, case_id, title, task_type, category, origin, priority,
      assigned_team, due_at
    ) VALUES (
      NEW.organization_id, NEW.id,
      'Elaborar Termo de Acerto',
      'ELABORAR_TERMO', 'FINANCEIRO', 'AUTOMATIC', 'HIGH',
      'FIN', now() + interval '3 days'
    );
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bifurcar AFTER UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION fn_bifurcar_para_financeiro();
```

### 5.3 Realtime no front

```typescript
// Em qualquer página/componente React
const supabase = createBrowserClient(...)
useEffect(() => {
  const ch = supabase.channel('case-events')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'case_events',
        filter: `case_id=eq.${caseId}` },
        (payload) => queryClient.invalidateQueries(['case', caseId]))
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}, [caseId])
```

---

## 6. Integrações externas — contratos

### 6.1 Inventário de integrações (resumo)

| Integração | Direção | Auth | SLA | Erro: estratégia |
|---|---|---|---|---|
| **Supabase** | n/a | - | 99.9% | n/a |
| **Claude API** | App → Anthropic | API key (vault) | 99% | Retry exp + fallback Sonnet→Haiku se Sonnet falhar |
| **n8n** | App ↔ n8n | Webhook secret (HMAC) | 99% (self-hosted) | Queue + dead-letter; alertar via PagerDuty |
| **Evolution API** | n8n → Evolution | Bearer token | 95% | Banimento WA: retry com nova instância |
| **ChatGuru** | n8n ↔ ChatGuru | API key | 99% | Webhook idempotente + dedupe |
| **ZapSign** | ZapSign → n8n | Webhook signature | 99% | Idempotente |
| **Conta Azul** | App ↔ Conta Azul | OAuth2 | 99% | Refresh token automático; retry |
| **Asaas** | App ↔ Asaas | API key | 99% | Retry |
| **Postmark** | App → Postmark | API key | 99.9% | Fallback SES |
| **Gmail API** | n8n → Gmail | OAuth2 (service account) | 99% | Token refresh |
| **Google Drive** | App ↔ Drive | OAuth2 + service account | 99% | Idem |
| **Projuris** | App ↔ Projuris | API key | 95% | Logs + alertas; queue de retry |
| **SEI scraper** | n8n Worker | Login Gov.br | 80% | Best-effort; 3 falhas consecutivas → alerta |
| **CNES scraper** | n8n Worker | Pública | 90% | Idem |
| **Gov.br protocolo** | n8n Worker (Playwright) | Login Hyago | 90% | Idem |
| **Meta Ads / Google Ads** | App ↔ API | OAuth2 | 99% | Retry |

### 6.2 Padrão de Adapter (Hexagonal)

```typescript
// types/integrations/projuris.ts
export interface ProjurisAdapter {
  syncProcesses(orgId: string): Promise<SyncResult>
  fetchProcess(id: string): Promise<ProjurisProcess>
  fetchMovimentos(processId: string, since: Date): Promise<Movement[]>
}

// adapters/projuris.real.ts → chama API real
export class RealProjurisAdapter implements ProjurisAdapter { ... }

// adapters/projuris.mock.ts → testes
export class MockProjurisAdapter implements ProjurisAdapter { ... }

// Wire-up via DI container ou Next.js singleton
```

### 6.3 Webhooks recebidos — endpoint padrão

```
POST /api/webhooks/[provider]
Headers:
  X-Signature: HMAC(secret, body)
Body: JSON específico do provider

Pipeline:
  1. Validar HMAC
  2. Verificar idempotency-key (DB: integration_logs)
  3. Inserir em case_outbox_events (status: PENDING)
  4. Disparar processor async (Edge Function)
  5. Atualizar status processor: SUCCESS | FAILED
```

```sql
CREATE TABLE case_outbox_events (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id      uuid NOT NULL REFERENCES organizations(id),
  source               text NOT NULL,                      -- 'zapsign', 'conta_azul', 'gmail', ...
  source_event_id      text,
  payload              jsonb NOT NULL,
  status               text NOT NULL DEFAULT 'PENDING',    -- PENDING | PROCESSING | SUCCESS | FAILED | DLQ
  attempts             int NOT NULL DEFAULT 0,
  last_error           text,
  received_at          timestamptz NOT NULL DEFAULT now(),
  processed_at         timestamptz,
  UNIQUE (source, source_event_id)
);

CREATE INDEX idx_outbox_pending ON case_outbox_events(status, received_at) WHERE status IN ('PENDING','FAILED');
```

---

## 7. Storage e gestão de documentos

### 7.1 Buckets Supabase Storage

| Bucket | Visibilidade | RLS | Conteúdo |
|---|---|---|---|
| `case-documents` | Private | Yes | Docs vinculados a casos |
| `termo-pdfs` | Private | Yes | PDFs dos Termos (snapshots imutáveis) |
| `contracts` | Private | Yes | Contratos de honorários assinados |
| `client-uploads` | Private | Yes | Uploads via Portal do Cliente |
| `media-marketing` | Private | Yes (only marketing role) | Mídias do Projeto 5 |
| `branding` | Public | No | Logos e assets públicos |

### 7.2 Convenção de paths

```
case-documents/{org_id}/{client_id}/{case_id}/{document_code}_v{version}_{timestamp}.{ext}
termo-pdfs/{org_id}/{case_id}/termo_v{version}.pdf
client-uploads/{org_id}/{client_id}/inbox/{filename}_{timestamp}.{ext}
```

### 7.3 Signed URLs

- Toda visualização gera **signed URL com expiração 15min**.
- Reload de página re-gera signed URL.
- Logs de acesso registrados em `audit_log` (action: `document.viewed`).

### 7.4 Sync com Google Drive

- Cada cliente novo dispara criação de pasta no Drive via `n8n` (Service Account).
- Estrutura: `Clientes/{NomeCliente}-{CPF}/Caso-{case_code}/Saldos/Termo/Financeiro/`.
- Sincronização bidirecional opcional (V2): upload via app vai pro Drive; upload no Drive cria evento.

### 7.5 OCR

- Toda imagem/PDF passa por OCR (Tesseract via n8n, ou Claude Vision para precisão).
- Texto extraído em `case_documents.ocr_text` → indexado para busca full-text.

---

## 8. IA, RAG e governança de prompts

### 8.1 Modelos por caso de uso

| Caso de uso | Modelo | Custo (input/output por 1M tokens) | Caching |
|---|---|---|---|
| **Classificação de mensagens WhatsApp** (P6) | Haiku 4.5 | $0.80/$4 | Sim — system prompt + few-shots |
| **Classificação de movimentações Projuris** (P2) | Haiku 4.5 | $0.80/$4 | Sim |
| **Resumo de movimentações** (P2) | Sonnet 4.6 | $3/$15 | Sim — contexto fixo |
| **Geração de minutas** (P3) | Opus 4.7 | $15/$75 | Sim — base de teses + peças validadas (cacheadas) |
| **Sugestão de tese/decisão** (P2/P3) | Sonnet 4.6 | $3/$15 | Sim |
| **Geração de roteiros Reels/podcast** (P5) | Sonnet 4.6 | $3/$15 | Sim — guideline marca cached |
| **Agente WhatsApp triagem** (P6) | Haiku 4.5 → Sonnet (escalation) | varia | Sim |
| **Extração de campos OCR** | Claude Vision (Sonnet) | $3/$15 | Não (variável) |

### 8.2 Prompt caching (obrigatório)

Toda chamada Claude API usa `cache_control` para:
- System prompts longos
- Base de conhecimento (teses, decisões)
- Few-shot examples
- Guidelines de marca/OAB

**Meta:** ≥ 80% cache hit rate em uso recorrente. Economia estimada: **-90% custo input**.

### 8.3 RAG — Stack

```
USER QUERY
  │
  ▼
[Query rewrite] (Claude Haiku)
  │
  ▼
[Embed query] (text-embedding-3-large)
  │
  ▼
[pgvector similarity search]
  ├─ teses_embeddings (top 5)
  ├─ decisoes_embeddings (top 5)
  └─ pecas_embeddings (top 3, só P3)
  │
  ▼
[Re-rank] (opcional — Cohere Rerank ou Claude Haiku scoring)
  │
  ▼
[Build prompt]
  - System (cached)
  - Contexto (top-K trechos)
  - Query do usuário
  │
  ▼
[Claude completion]
  │
  ▼
[Validação automática]
  - Verifica citação de fontes
  - Detecta "alucinação" (afirmações sem fonte)
  - Marca trechos não-fundamentados
  │
  ▼
[Resposta ao usuário com mapa de fontes]
```

### 8.4 Guardrails contra alucinação (Projeto 3)

1. **System prompt explícito:** "Só afirme fatos com fonte em [documentos | base de teses | peças validadas]. Marque trechos especulativos com [INFERÊNCIA NÃO VERIFICADA]."
2. **Self-critique pass:** após geração, segundo prompt revisa se todas afirmações têm fonte.
3. **Mapa de fontes:** cada minuta gerada lista as fontes usadas (rastreável).
4. **Marcação visual:** "MINUTA — NÃO REVISADA" em watermark até aceite advogado.
5. **Revisão automatizada:** valida nomes, CPF, processo, datas vs. dados do caso (regex + crosscheck DB).

### 8.5 Custos estimados (mensal, ~2500 casos ativos)

| Módulo | Tokens/mês estimados | Custo bruto | Pós-cache (80%) |
|---|---|---|---|
| **P2 — Classificação movimentações** | 10M input / 2M output | $16 | $5 |
| **P2 — Resumo movimentações** | 5M input / 1M output | $30 | $8 |
| **P3 — Minutas (Opus)** | 8M input / 3M output | $345 | $105 |
| **P5 — Conteúdo** | 3M input / 1M output | $24 | $9 |
| **P6 — Agente WhatsApp** | 15M input / 3M output | $24 | $8 |
| **Embeddings (OpenAI)** | ~50M tokens | $7 | n/a |
| **TOTAL estimado** | | **~$446** | **~$135-180/mês** |

> _Cache reduz drasticamente. Monitorar via Anthropic Console + budget guardrail._

---

## 9. n8n self-hosted — workflows

### 9.1 Infra

- **VPS:** Hetzner CCX13 (2 vCPU dedicated, 8GB RAM) — ~€20/mês.
- **Docker Compose:** n8n + Postgres (separado do Supabase para evitar mistura) + Redis + Caddy (TLS).
- **Backup:** snapshot diário + dump banco diário → S3 (Hetzner Object Storage).
- **Monitoring:** Uptime Kuma + alertas Telegram.

### 9.2 Workflows críticos a construir

| Workflow | Trigger | Output |
|---|---|---|
| **wf-zapsign-onboarding** | Webhook ZapSign | Cria/atualiza cliente + caso + pastas Drive |
| **wf-régua-followup-docs** | Cron (diário 9h) | Mensagem WhatsApp D+3, D+7, D+15 |
| **wf-sei-scraper** | Cron (diário 6h) | Atualiza movimentações por NUP |
| **wf-cnes-scraper** | Cron (mensal) | Atualiza vínculo ativo |
| **wf-projuris-sync** | Cron (horário) | Sincroniza Projuris bidirecional |
| **wf-conta-azul-webhook** | Webhook | Atualiza parcela (paga) |
| **wf-asaas-webhook** | Webhook | Idem |
| **wf-gmail-monitor** | Polling (15min) | Lê e-mails MS/FNDE → cria eventos |
| **wf-régua-cobranca** | Cron (diário) | D+5, D+15, D+30 cobranças |
| **wf-postmark-bounce** | Webhook | Marca e-mail inválido |
| **wf-chatguru-inbound** | Webhook | Cria `case_communications` |
| **wf-protocolo-egov** | Trigger via app | Protocola requerimento (Playwright headless) |
| **wf-evolution-inbound** | Webhook | Roteia mensagem ao agente IA (P6) |
| **wf-evolution-outbound** | RPC do app | Envia mensagem WhatsApp |
| **wf-marketing-publish** | Trigger via app | Publica conteúdo em redes (P5) |

### 9.3 Padrão de Workflow

- **Idempotente:** todo workflow checa idempotency-key antes de processar.
- **Logged:** começo, fim, erros → tabela `integration_logs`.
- **Retry:** 3 tentativas com backoff exponencial (1m, 5m, 15m).
- **DLQ:** após 3 falhas → notificação para admin + flag em `case_outbox_events.status='DLQ'`.

---

## 10. API interna

### 10.1 Estratégia

- **Server Components (RSC)** chamam Supabase diretamente (RLS aplicada).
- **Client Components** usam **Supabase JS SDK** com JWT.
- **Mutações complexas** ou **operações privilegiadas** usam **Next.js Route Handlers** (`/api/*`).

### 10.2 Endpoints internos críticos (todos auth JWT)

```
POST   /api/cases                                  Criar caso
PATCH  /api/cases/[id]/macrostatus                 Mudar macrostatus (com validação de gate)
POST   /api/cases/[id]/tasks                       Criar tarefa manual
POST   /api/cases/[id]/documents                   Upload doc
POST   /api/cases/[id]/termo/elaborar              Criar snapshot v1 (RASCUNHO)
POST   /api/termo/[id]/conferir                    Aprovação conferência (segregação enforced)
POST   /api/termo/[id]/aprovar-juridico            Aprovação jurídica (manual/auto)
POST   /api/termo/[id]/apresentar                  Envia ao cliente
POST   /api/termo/[id]/aceitar                     Cliente aceita (via Portal)

POST   /api/integrations/zapsign/webhook           Webhook ZapSign
POST   /api/integrations/conta-azul/webhook        Webhook Conta Azul
POST   /api/integrations/asaas/webhook
POST   /api/integrations/chatguru/webhook
POST   /api/integrations/evolution/webhook
POST   /api/integrations/projuris/sync             Trigger manual

POST   /api/ai/peticao/generate                    Gerar minuta (P3)
POST   /api/ai/teses/search                        Busca semântica
POST   /api/ai/classification/movimento            Classificar movimentação
```

### 10.3 Convenções

- **Versionamento:** sem versão por enquanto; quebras anunciadas com 30d.
- **Resposta padrão:** `{ data, error }` (estilo Supabase).
- **Erros:** códigos HTTP corretos + `code` machine-readable + `message` user-friendly.
- **Rate limiting:** middleware Vercel (Upstash Redis) — 100 req/min/usuário, 1000 req/min/org.

---

## 11. Notificações e realtime

### 11.1 Canais

| Canal | Quando |
|---|---|
| **In-app (sino)** | Toda notificação relevante ao usuário |
| **E-mail (Postmark)** | Opt-in por tipo de evento |
| **WhatsApp (ChatGuru)** | Admin, eventos críticos |
| **Push (PWA)** | V2 — após Portal mobile |

### 11.2 Tabela `notifications`

```sql
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id         uuid NOT NULL REFERENCES users(id),
  kind            text NOT NULL,                          -- 'task.due', 'macrostatus.changed', 'termo.discordancia', ...
  title           text NOT NULL,
  body            text,
  link            text,                                   -- deep link
  priority        text NOT NULL DEFAULT 'NORMAL',         -- NORMAL | HIGH | URGENT
  data            jsonb DEFAULT '{}'::jsonb,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
```

### 11.3 Trigger automático

```sql
-- Ex: tarefa criada → notificar atribuído
CREATE OR REPLACE FUNCTION fn_notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to_id IS NOT NULL THEN
    INSERT INTO notifications (organization_id, user_id, kind, title, body, link, priority, data)
    VALUES (
      NEW.organization_id, NEW.assigned_to_id,
      'task.assigned',
      'Nova tarefa: ' || NEW.title,
      coalesce(NEW.description, ''),
      '/casos/' || coalesce(NEW.case_id::text, '') || '/tarefas/' || NEW.id,
      NEW.priority,
      jsonb_build_object('task_id', NEW.id, 'case_id', NEW.case_id)
    );
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_task AFTER INSERT ON case_tasks
  FOR EACH ROW EXECUTE FUNCTION fn_notify_task_assigned();
```

---

## 12. Auditoria, observabilidade e LGPD

### 12.1 Auditoria

- Toda ação consequente passa por `audit_log` (§3.16).
- Particionamento mensal para performance.
- Retenção: **10 anos** (compliance OAB + boa prática).
- Imutável: sem UPDATE/DELETE policy.

### 12.2 Observabilidade

| Camada | Ferramenta | O que monitora |
|---|---|---|
| **Erros front** | Sentry | Exceptions, source maps |
| **Erros back** | Sentry + Supabase Logs | Edge Functions, SQL errors |
| **Performance** | Vercel Analytics + custom RUM | LCP, INP, CLS |
| **Logs estruturados** | Axiom ou Logtail | Todas Edge Functions emitem JSON logs |
| **Métricas** | PostHog | Eventos de produto (page views, ações) |
| **Uptime** | UptimeRobot | App, Portal, painel, API |
| **n8n** | Uptime Kuma + n8n logs | Workflows |
| **SQL slow queries** | Supabase pg_stat_statements | Queries >500ms |

### 12.3 LGPD — Implementação concreta

#### Right of access (art. 18, II)
- Endpoint `/api/lgpd/export?token={uuid}` (sob auth do titular)
- Gera ZIP com:
  - `cliente.json` (todos campos da tabela `clients`)
  - `casos.json` (cases relacionados)
  - `comunicacoes.json` (case_communications)
  - `consents.json` (consent_records)
  - Documentos vinculados

#### Right to deletion (art. 18, VI)
- Cliente solicita via Portal ou pedido formal
- Soft-delete em `clients.deleted_at = now()` + `cascade` em casos não-arquivados
- **Exceções legais:** dados retidos para obrigação legal (5 anos pós-quitação fiscal) → mantidos com flag `legal_hold = true`

#### Consent management
- Banner de consentimento em Portal + WhatsApp (primeira interação)
- Tela "Minhas preferências de privacidade" → consultar consents ativos, revogar

#### DPO
- Designar Adavio ou consultor externo
- E-mail dpo@hyagoviana.adv.br dedicado
- SLA de resposta: 15 dias úteis

---

## 13. Estratégia de migração

> Migração dos **~2.500 casos FIES** + demais demandas ativas do Excel/Trello.

### 13.1 Fases

| Fase | Duração | Atividade |
|---|---|---|
| **F1 — Inventário** | 1 sem | Mapear planilhas, abas, campos, exceções |
| **F2 — De-para** | 1 sem | Tabela de mapeamento campo-a-campo |
| **F3 — Dry run** | 1 sem | Importação em ambiente staging com 50 casos amostrais |
| **F4 — Validação** | 1 sem | Hyago revisa amostra (validation by exception) |
| **F5 — Importação plena** | 1 sem | Importação noturna; coexistência 2 semanas |
| **F6 — Cutover** | 1 dia | Freeze Excel/Trello; tudo move para plataforma |
| **F7 — Coexistência leitura** | 2 sem | Excel read-only para histórico até confiança total |

### 13.2 Ferramentas

- Script Node.js (`migrations/import.ts`) que lê Excel (`xlsx` package) e insere via Supabase Service Role.
- Validações Zod no script (rejeita registros inválidos com log).
- Tabela `migration_log` registra cada caso importado: `source_file`, `row_number`, `client_id_new`, `case_id_new`, `errors`.

### 13.3 De-para de status (Trello → macrostatus)

| Coluna Trello (estimada) | Macrostatus operacional | Macrostatus financeiro |
|---|---|---|
| "Aguardando docs" | DOCS_PENDENTES | NAO_APLICAVEL |
| "DGM enviada" | DGM_ENVIADA | NAO_APLICAVEL |
| "Em acompanhamento" | ACOMPANHAMENTO_ADM | NAO_APLICAVEL |
| "Judicial" | JUDICIAL_OPERACIONAL | NAO_APLICAVEL |
| "Implantado" | IMPLANTADO | ELABORANDO_TERMO |
| "Termo em cobrança" | ENCERRADO_OPERACIONAL | ATIVO |
| "Quitado" | ENCERRADO_OPERACIONAL | QUITADO |

> _De-para refinado em sessão com Hyago durante F1._

### 13.4 Plano de rollback

- Backup de banco antes de cada lote de importação.
- Em caso de inconsistência crítica: `DELETE FROM cases WHERE migration_batch_id = X` + restore.
- Excel/Trello preservados read-only por 2 semanas.

---

## 14. DevOps, CI/CD e ambientes

### 14.1 Ambientes

| Ambiente | URL | Branch | Supabase |
|---|---|---|---|
| **Local** | localhost:3000 | feature/* | Local Supabase (Docker) |
| **Preview** | `*.preview.vercel.app` | PRs | Supabase branch (database branching) |
| **Staging** | `staging.app.hyagoviana.adv.br` | `develop` | Project Supabase staging |
| **Produção** | `app.hyagoviana.adv.br` | `main` | Project Supabase prod |

### 14.2 CI/CD pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml — esqueleto
jobs:
  lint:        # eslint, prettier
  typecheck:   # tsc
  unit:        # vitest
  e2e:         # playwright
  migrations:  # supabase db lint + dry-run
  security:    # npm audit, secret scan
  build:       # next build
  preview:     # deploy preview (PRs)
  production:  # deploy prod (main, com aprovação manual)
```

### 14.3 Migrations

- Toda mudança de schema via `supabase migration new`.
- Migration files commitadas (timestamped).
- Aplicação automática em staging; **manual em prod** com janela de manutenção.
- Migrations devem ser **idempotentes** (`CREATE TABLE IF NOT EXISTS`, etc.).

### 14.4 Feature flags

- Tabela `feature_flags` + lib `unleash-proxy` ou Supabase próprio.
- Flags por organização e por usuário.
- Releases atrás de flag para rollout gradual.

### 14.5 Cron jobs

- **Supabase Cron Extension** (pg_cron) para SQL cron.
- **n8n cron** para workflows.
- Job diário: criar partição `case_events_{YYYY_MM}` para mês corrente + próximo.
- Job semanal: dump de banco para S3 (além do daily backup Supabase).

---

## 15. Segurança

### 15.1 Threat model resumido (STRIDE)

| Ameaça | Mitigação |
|---|---|
| **Spoofing** | Auth JWT + MFA + IP allowlist admin |
| **Tampering** | Snapshots imutáveis + hash SHA-256 + audit_log append-only |
| **Repudiation** | Audit log com IP, user agent, request_id |
| **Information disclosure** | RLS estrita + signed URLs com expiração + criptografia at-rest |
| **DoS** | Vercel + Cloudflare + rate limit + WAF |
| **Elevation of privilege** | Roles + permissions + segregação enforçada no DB |

### 15.2 Práticas obrigatórias

- ✅ Secrets em **Vercel Env + Supabase Vault** (nunca em código).
- ✅ Variáveis sensíveis nunca expostas no client (sem prefix `NEXT_PUBLIC_`).
- ✅ Inputs validados com Zod (server-side, mesmo após validação client).
- ✅ Output encoding (Next.js JSX faz por padrão).
- ✅ CSRF: Next.js mitigation + SameSite cookies.
- ✅ SQL injection: queries parametrizadas (Supabase faz por padrão).
- ✅ HTTPS obrigatório (HSTS).
- ✅ CSP estrito (no unsafe-inline em produção).
- ✅ Dependabot + Renovate para atualizações.

### 15.3 Backup e disaster recovery

- **Supabase:** PITR 7 dias (plano Pro+).
- **Storage:** versionamento de bucket.
- **n8n:** snapshot diário + dump banco diário → S3.
- **Documentos críticos** (Termos, contratos): replicação para Drive (já é fonte secundária).
- **RTO:** 4h. **RPO:** 1h.

---

## 16. Performance e escalabilidade

### 16.1 Targets

| Métrica | Target P95 |
|---|---|
| Página `/casos` (Pipeline) | ≤ 1.5s |
| Página `/clientes/[id]` (360°) | ≤ 2s |
| Query "casos do usuário" | ≤ 200ms |
| Webhook processado | ≤ 5s |
| n8n workflow (médio) | ≤ 30s |

### 16.2 Estratégias

- **Índices** rigorosos (ver §3 em cada tabela).
- **Particionamento** em tabelas alta-cardinalidade (`case_events`, `audit_log`).
- **Materialized views** para dashboards pesados (refresh a cada 15min).
- **Connection pooling** via PgBouncer (Supabase Supavisor).
- **Cache em camadas:** Vercel ISR (dashboards públicos) + SWR client + Supabase Edge cache.
- **Lazy load** de timeline (cursor pagination).

### 16.3 Escalabilidade prevista

- 2.500 casos × ~50 eventos/caso/ano = 125k eventos/ano → particionamento já cobre.
- Em 3 anos × 5x casos = 12.500 casos → ainda dentro do esperado para Supabase Pro.
- **Threshold para upgrade:** > 50k casos ativos OU > 10M eventos OU > 100k req/dia.

---

## 17. Estratégia de testes

### 17.1 Pirâmide

```
        ┌─────┐
        │ E2E │  ~50 testes (Playwright) — fluxos críticos
       ┌┴─────┴┐
       │ Integ. │  ~200 testes — APIs, integrações com mocks
      ┌┴───────┴┐
      │  Unit   │  ~1000 testes (Vitest) — funções, utils, componentes
      └─────────┘
```

### 17.2 Testes E2E críticos (must-have antes de prod)

1. Login + MFA
2. Criar cliente + caso
3. Pipeline Op — drag caso entre colunas + gates
4. Bifurcação Op → Fin automática
5. Elaborar Termo + Conferência + Aprovação (segregação enforçada)
6. Cliente aceita Termo via Portal
7. Cobrança vence + régua dispara WhatsApp
8. Webhook ZapSign cria caso novo (Caminho A)
9. Migração: importar 50 casos sem erro
10. LGPD export: usuário baixa seus dados

### 17.3 Testes de segurança

- **Penetration test** antes do go-live (parceiro externo).
- **OWASP ZAP** em CI (scan automatizado).
- **Auditoria RLS** com script que tenta acessar dados de outras orgs.

---

## 18. Roadmap técnico cross-módulo (design-first ★ atualizado v1.1)

> **Estratégia oficial:** construir TODA a UI primeiro (F0-F3) com mocks; depois aplicar lógica/backend módulo a módulo sobre telas prontas (F4-F9).

```
F0 — DESIGN BIBLE (concluído)
  - PRD 0 v1.2 — 115 telas catalogadas, tokens, componentes
  - PRDs 1-6 + Master + Brief

F1 — FIGMA HIGH-FIDELITY (3 semanas)
  - Designer transforma ASCII em Figma editável
  - 6 frames master + 30 sub-frames
  - Validação Hyago em sessões semanais
  - Protótipo clicável

F2 — IMPLEMENTAÇÃO FRONTEND MOCK-FIRST (4 semanas)
  - Setup monorepo Turborepo
  - apps/interno + apps/portal + apps/painel
  - packages/ui (@hv/ui) com Storybook
  - 115 telas implementadas em Next.js 15
  - MSW + fixtures (50 clientes, 200 casos, etc.)
  - Toggle NEXT_PUBLIC_DATA_MODE=mock
  - Deploy preview Vercel acessível

F3 — TESTES DE USABILIDADE (1 semana)
  - 5 usuários reais executando top-15 jornadas
  - Ajustes finais
  - Design system congelado

────────── A partir daqui, telas estão prontas ──────────

F4 — APLICAR LÓGICA PROJETO 1 — Plataforma + FIES (8 semanas)
  - Setup Supabase (project + RLS + tabelas globais)
  - Auth + RBAC funcional
  - Migração 2500 casos (dry-run + plena)
  - Integrações: ZapSign, Drive, Gmail, Postmark, Conta Azul, Asaas, ChatGuru, SEI, CNES, Gov.br
  - Portal do Cliente em produção
  - Trocar fixtures por dados reais nas 95 telas internas + 14 do portal

F5 — APLICAR LÓGICA PROJETO 2 — Controladoria (6 semanas)
  - Integração Projuris bidirecional
  - Classificação IA de movimentações
  - Base de teses/decisões + embeddings
  - Centro de Exceções operacional

F6 — APLICAR LÓGICA PROJETO 6 — Agente WhatsApp (4 semanas, pode paralelizar com F5)
  - Evolution API self-hosted
  - State machine conversacional
  - Handoff humano + UI atendente
  - LGPD compliance funcional

F7 — APLICAR LÓGICA PROJETO 3 — Peticionamento (6 semanas)
  - RAG anti-alucinação
  - Geração de 9 tipos de peça (Claude Opus)
  - Banco de peças validadas
  - Validação automatizada (CPF, datas, nomes)

F8 — APLICAR LÓGICA PROJETOS 4 + 5 (paralelos, 8 semanas)
  - Projeto 4: CRM + funil + cross-sell + Meta/Google Ads + painel ANMR/AMPB
  - Projeto 5: Calendário editorial IA + Reels/Podcast/Copy + compliance OAB

F9 — POLISH + TREINAMENTO + GO-LIVE CONSOLIDADO (2 semanas)
  - Auditoria final RLS + segurança
  - Pen-test externo
  - Treinamento equipe (8h+8h+4h por turno)
  - Documentação operacional
  - Cutover oficial
```

**Total estimado:** ~14 meses (F0 concluído; restam F1-F9 = ~13 meses).

### Observação crítica para o time de backend

> Quando F4 começar, **95% das telas internas já estarão implementadas em Next.js** com fixtures. O trabalho dos PRDs 1-6 é majoritariamente:
> 1. Schema Supabase + migrations
> 2. RLS policies
> 3. Edge Functions / Route Handlers
> 4. n8n workflows
> 5. Trocar fixtures por queries Supabase reais nas telas existentes
> 6. Conectar webhooks de integrações
>
> **Não é "criar do zero".** É "ligar a usina elétrica nas casas já construídas".

---

## 19. Riscos técnicos

| # | Risco | Mitigação |
|---|---|---|
| **RT1** | RLS mal configurada vaza dados entre orgs | Testes automatizados de RLS + audit reviews trimestrais |
| **RT2** | Eventos perdidos (outbox falha) | Pattern outbox-relay + dead-letter queue + alertas |
| **RT3** | Particionamento case_events não automatiza | Cron Edge Function cria partição mensal antecipadamente |
| **RT4** | Custo IA escala mal | Caching obrigatório + budget guard + degradar p/ Haiku |
| **RT5** | Migração com inconsistências | Dry-run + validação amostral + rollback documentado |
| **RT6** | Vendor lock-in Supabase | Postgres puro + RLS standard; portável a self-hosted PG |
| **RT7** | n8n single point of failure | Backup + alerta + plano de migração eventual a Temporal |
| **RT8** | Evolution API banimento WhatsApp | Plano de migração para WA Business API + comunicação prévia ao cliente |
| **RT9** | Scrapers SEI/CNES quebram com mudança site | Best-effort + alertas; humano sobe atualização |

---

## 20. Acceptance criteria

### Para considerar o PRD Master "aceito":

- ✅ Schema executado em Supabase staging sem erros
- ✅ RLS validada com testes (script `tests/rls.test.ts`)
- ✅ Auth + papéis seed aplicados
- ✅ Outbox pattern funcional (evento gerado e consumido em < 5s)
- ✅ Webhook genérico recebe e processa amostra de cada integração
- ✅ Storage buckets criados e signed URLs funcionam
- ✅ Audit log preenchido em todas ações sensíveis (amostragem de 20 ações)
- ✅ Cron de partição mensal executando
- ✅ Backup automatizado validado (restore test mensal)
- ✅ Performance: query do pipeline com 10k casos < 200ms

### Para considerar a plataforma pronta para PRD Projeto 1 (F4):

> **Pré-requisitos design-first concluídos (F0 → F3):**
- ✅ PRD 0 v1.2 (Design Bible) aprovado e congelado
- ✅ Figma high-fidelity das 115 telas validado por Hyago
- ✅ Monorepo Turborepo + Storybook publicado com 100% componentes
- ✅ 115 telas implementadas em Next.js com MSW + fixtures
- ✅ Preview Vercel acessível e navegável end-to-end
- ✅ Testes de usabilidade com 5 usuários reais concluídos
- ✅ Auth UI (login, convite, MFA, reset) implementada com mock backend

> **Pré-requisitos do Master (este PRD):**
- ✅ Acceptance criteria do Master ✅ (lista acima)
- ✅ Auth flow trocado de mock → Supabase real funcionando
- ✅ Página `/perfil` lendo dados reais do Supabase

---

## 📌 Validação cruzada (revisão @qa + @architect + @ux)

### @qa
- [x] Cenários de borda mapeados (multi-org, hold complexo, divergência implantação)
- [x] Testes E2E críticos listados
- [x] Estratégia de migração com rollback
- [x] Auditoria 100% das ações sensíveis

### @architect
- [x] Stack consistente com project-brief (§6)
- [x] Schema canônico cobre 90%+ dos PRDs downstream
- [x] RLS em todas tabelas com dados sensíveis
- [x] Outbox pattern para integrações
- [x] Particionamento para tabelas alta-cardinalidade

### @ux (consumido do PRD 0)
- [x] Atalhos de teclado especificados
- [x] Estados de erro/empty/loading definidos
- [x] WCAG 2.2 AA obrigatório

---

> **Status:** Aprovado.
> **Próximo:** **PRD Projeto 1 — Plataforma + FIES** (consome este Master + Project Brief + PRD 0).
>
> _— @architect, com revisão de @qa e @pm, sob coordenação de Orion 🎯_
