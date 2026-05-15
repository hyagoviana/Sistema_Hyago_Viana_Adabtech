# 💼 PRD Projeto 4 — Módulo Comercial / CRM

> **Plataforma Unificada Hyago Viana Advocacia**
> **Versão:** 1.0 · **Data:** 2026-05-15 · **Owners:** @pm + @architect + @qa · **Orquestração:** Orion
> **Status:** Aprovado para épicos/stories
>
> Consome: PRD Master + 0 + 1 + 6.

> ⚠ **Alinhamento com estratégia design-first (v1.1):**
> Quando este PRD entrar em execução (Fase **F8** do roadmap, paralelo com Projeto 5), as telas do Comercial (Funil Kanban, Leads, Oportunidades, Campanhas Meta/Google, E-mail Marketing, Painel Institucional ANMR/AMPB) **JÁ ESTARÃO IMPLEMENTADAS** com fixtures. Este PRD foca em: schema comercial, engine de cross-sell (regras + cron), integrações Meta Ads API + Google Ads API + Postmark, painel institucional read-only externo. **UI pronta — foco é regra de negócio + integrações.**

---

## Sumário
1. [Visão](#1-visão)
2. [Personas](#2-personas)
3. [Escopo](#3-escopo)
4. [Schema](#4-schema)
5. [Funil comercial](#5-funil-comercial)
6. [Cross-sell para clientes existentes](#6-cross-sell)
7. [Leads externos](#7-leads-externos)
8. [E-mail marketing e tráfego pago](#8-e-mail-marketing-e-tráfego-pago)
9. [Painel institucional ANMR/AMPB](#9-painel-institucional)
10. [Indicadores](#10-indicadores)
11. [Telas](#11-telas)
12. [Épicos e Stories](#12-épicos-e-stories)
13. [Métricas](#13-métricas)
14. [Critérios de aceitação](#14-critérios-de-aceitação)
15. [Riscos](#15-riscos)

---

## 1. Visão

> **"CRM próprio que substitui ChatGuru pipeline + planilhas comerciais, com 2 motores: cross-sell para clientes existentes + captação de leads externos."**

ChatGuru permanece como **mensageria operacional** (documentos, mensagens em batch); pipeline comercial migra para o CRM.

---

## 2. Personas

| Persona | Responsabilidades |
|---|---|
| **Camila (Comercial)** | Atender leads, fechar contratos, cross-sell |
| **Pedro (Comercial)** | Idem |
| **Tráfego Pago (parceiro externo)** | Configurar campanhas Meta/Google |
| **Marketing (interno)** | Conteúdo + nutrição (interface com Projeto 5) |
| **Admin** | Configurar funis, ver indicadores |

---

## 3. Escopo

### Em escopo
- ✅ CRUD de leads e oportunidades
- ✅ Funil com mín. 5 etapas (Lead → Qualificado → Proposta → Negociação → Fechado)
- ✅ Captação: formulários, indicações, leads via WhatsApp (Projeto 6), Meta Ads, Google Ads
- ✅ Distribuição automática por regras (round-robin, especialidade, carga)
- ✅ Enriquecimento assistido IA (WhatsApp → preencher dados, com revisão humana)
- ✅ Cross-sell: dashboard de clientes ativos com regras de oportunidade
- ✅ Tarefas comerciais automáticas
- ✅ E-mail marketing (Postmark templates)
- ✅ Integração Meta Ads API + Google Ads API (importação leads + métricas)
- ✅ Painel institucional ANMR/AMPB (dados agregados anonimizados)

### Fora de escopo
- ❌ Atendimento pós-contratação (vai pro Projeto 1)
- ❌ Geração de minutas (vai pro Projeto 3)

---

## 4. Schema

### 4.1 Tabela `commercial_leads`

```sql
CREATE TABLE commercial_leads (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             uuid NOT NULL REFERENCES organizations(id),
  -- Identificação
  full_name                   text,
  email                       text,
  phone                       text,
  cpf                         text,
  -- Origem
  source                      text NOT NULL,                            -- WHATSAPP | FORMULARIO_SITE | INDICACAO | META_ADS | GOOGLE_ADS | OUTRO
  source_campaign             text,                                     -- ID campanha
  source_details              jsonb,                                    -- params utm, ad_id, etc.
  utm                         jsonb,                                    -- {source,medium,campaign,content,term}
  -- Qualificação
  profession                  text,                                     -- 'medico', 'residente', 'outro'
  crm                         text,
  crm_uf                      text,
  demand_type                 text,                                     -- FIES | RESIDENCIA | DEFESA_CFM | OUTRO
  demand_description          text,
  -- Score
  score                       int,                                      -- 0-100 (qualificação)
  ai_qualification            jsonb,                                    -- razões IA
  -- Funnel
  stage_id                    uuid REFERENCES commercial_funnel_stages(id),
  assigned_to_id              uuid REFERENCES users(id),
  assigned_at                 timestamptz,
  -- Conversão
  converted_to_client_id      uuid REFERENCES clients(id),
  converted_at                timestamptz,
  lost_reason                 text,                                     -- caso lost
  lost_at                     timestamptz,
  -- LGPD
  consent_id                  uuid REFERENCES consent_records(id),
  -- Auditoria
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_stage ON commercial_leads(stage_id);
CREATE INDEX idx_leads_assignee ON commercial_leads(assigned_to_id);
CREATE INDEX idx_leads_source ON commercial_leads(source, created_at DESC);
```

### 4.2 Tabela `commercial_funnel_stages`

```sql
CREATE TABLE commercial_funnel_stages (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  name                text NOT NULL,                          -- 'Lead', 'Qualificado', 'Proposta', 'Negociação', 'Fechado'
  position            int NOT NULL,
  color               text,
  win_stage           boolean NOT NULL DEFAULT false,
  loss_stage          boolean NOT NULL DEFAULT false,
  expected_duration_days int,                                 -- alerta se demora demais
  UNIQUE (organization_id, position)
);

-- Seed
INSERT INTO commercial_funnel_stages (organization_id, name, position) VALUES
  (org_id, 'Lead Captado',         1),
  (org_id, 'Qualificado',          2),
  (org_id, 'Proposta Enviada',     3),
  (org_id, 'Em Negociação',        4),
  (org_id, 'Contrato Enviado',     5),
  (org_id, 'Cliente',              6),
  (org_id, 'Perdido',              99);
```

### 4.3 Tabela `commercial_opportunities` (cross-sell)

```sql
CREATE TABLE commercial_opportunities (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  client_id           uuid NOT NULL REFERENCES clients(id),
  -- Tipo
  opportunity_type    text NOT NULL,                          -- CROSS_SELL_NOVO_TIPO_CASO | RENOVACAO | UPSELL
  suggested_case_type case_type,                              -- ex: cliente FIES_ESF_DGM → sugerir RESIDENCIA_AUXILIO_MORADIA
  suggested_reason    text,                                   -- razão da sugestão
  -- Score
  score               int,
  ai_suggestion       jsonb,                                  -- {reasoning, signals}
  -- Workflow
  stage_id            uuid REFERENCES commercial_funnel_stages(id),
  assigned_to_id      uuid REFERENCES users(id),
  status              text NOT NULL DEFAULT 'OPEN',           -- OPEN | CONTACTED | CONVERTED | DISMISSED
  converted_case_id   uuid REFERENCES cases(id),
  dismissed_reason    text,
  -- Datas
  created_at          timestamptz NOT NULL DEFAULT now(),
  contacted_at        timestamptz,
  closed_at           timestamptz
);
```

### 4.4 Tabela `marketing_campaigns`

```sql
CREATE TABLE marketing_campaigns (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  name                text NOT NULL,
  channel             text NOT NULL,                          -- META | GOOGLE | EMAIL | ORGANIC
  external_id         text,                                   -- ID na plataforma externa
  budget              numeric(12,2),
  status              text NOT NULL DEFAULT 'ACTIVE',         -- ACTIVE | PAUSED | ENDED
  -- Métricas (sync periódico)
  impressions         int DEFAULT 0,
  clicks              int DEFAULT 0,
  leads_generated     int DEFAULT 0,
  cost_total          numeric(12,2) DEFAULT 0,
  conversions         int DEFAULT 0,
  -- Datas
  start_date          date,
  end_date            date,
  last_synced_at      timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

### 4.5 Tabela `commercial_tasks` (estende `case_tasks` ou tabela própria? — escolhemos estender `case_tasks` com `case_id NULL` e `category='COMERCIAL'`)

> Sem nova tabela; usa `case_tasks` do Master.

---

## 5. Funil comercial

### 5.1 Etapas (configurável; 5 default)

1. **Lead Captado** — entrada inicial (de qualquer canal)
2. **Qualificado** — após contato inicial, perfil bate
3. **Proposta Enviada** — escopo + valor enviados
4. **Em Negociação** — discussão aberta
5. **Contrato Enviado** — ZapSign disparado
6. **Cliente** — contrato assinado (win)
7. **Perdido** — não converteu (loss)

### 5.2 Drag-drop Kanban

- Igual ao Pipeline Operacional do Projeto 1.
- Card mostra: nome, source, score, dias-em-etapa, responsável, próxima ação sugerida.
- Filtros: source, responsável, etapa, score.

### 5.3 Movimentação automática

- Lead novo de WhatsApp (Projeto 6) → cria em "Lead Captado"
- Cliente assina contrato ZapSign → move para "Cliente" + cria cliente real (Projeto 1)

---

## 6. Cross-sell

### 6.1 Regras de detecção (engine)

```typescript
const rules: CrossSellRule[] = [
  {
    name: 'Médico FIES com residência médica recente',
    condition: (client) => client.professional_info?.programs?.includes('FIES') &&
                          client.professional_info?.residencia_concluida_anos_atras <= 5,
    suggestion: 'RESIDENCIA_AUXILIO_MORADIA',
    reason: 'Cliente teve residência recente — possível direito a auxílio-moradia retroativo'
  },
  {
    name: 'Cliente Mais Médicos sem ESF cadastrada',
    condition: (client) => client.professional_info?.programs?.includes('MAIS_MEDICOS') &&
                          !hasCaseOfType(client, 'FIES_ESF_DGM'),
    suggestion: 'FIES_ESF_DGM',
    reason: 'Cliente Mais Médicos pode ter direito a abatimento FIES ESF'
  },
  // ...mais regras
]
```

### 6.2 Geração de oportunidades

- Cron noturno roda regras sobre base de clientes
- Cria `commercial_opportunities` para matches
- Notificação para Comercial: "X novas oportunidades de cross-sell"

### 6.3 Dashboard de cross-sell

```
┌──────────────────────────────────────────────────────────────┐
│ Oportunidades de Cross-Sell                                  │
│                                                              │
│ Abertas: 47   Convertidas (30d): 8   Dismissed: 12          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Ordenar por: Score ▼ Cliente ▼ Tipo ▼                       │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Dr. João Silva (Cliente FIES desde 2024)         Score 87│ │
│ │ Sugestão: RESIDENCIA_AUXILIO_MORADIA                    │ │
│ │ Razão: Residência médica concluída em 2022             │ │
│ │ [Contatar] [Dispensar] [Ver Cliente]                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Leads externos

### 7.1 Canais de captação

| Canal | Implementação |
|---|---|
| **Formulário site** | Webhook `/api/integrations/forms/[id]` |
| **WhatsApp (Projeto 6)** | Lead criado por agente após classificação `LEAD_EXTERNO` |
| **Indicação** | Cadastro manual com link de origem (e-mail) |
| **Meta Ads** | API + lead form sync |
| **Google Ads** | API + lead form extension sync |

### 7.2 Distribuição automática

```typescript
async function assignLead(lead: Lead) {
  const team = lead.demand_type === 'FIES' ? 'fies-team' : 'general-team'
  const members = await getTeamMembers(team)
  const lessLoaded = members.sort((a,b) => a.openLeadsCount - b.openLeadsCount)[0]
  return lessLoaded.id
}
```

Configurável: round-robin, especialidade, carga.

### 7.3 Enriquecimento IA

Quando lead chega via WhatsApp:
- Agente coleta dados estruturados (P6).
- Sistema enriquece (busca pública por CRM, por exemplo).
- Mostra para Comercial com aviso "Dados sugeridos por IA — confirmar antes".

---

## 8. E-mail marketing e tráfego pago

### 8.1 E-mail marketing

- Templates Postmark editáveis (UI dentro do app).
- Listas: segmentação por tipo de cliente, programa, UF.
- Disparo manual ou cadenciado.
- Tracking abertura + clique.

### 8.2 Meta Ads + Google Ads

- OAuth2 para conectar conta cliente.
- Sync diário: campanhas, custos, leads gerados.
- Dashboards com ROAS, CAC, conversão por canal.

---

## 9. Painel institucional

### 9.1 Stakeholders
- ANMR (Associação Nacional de Médicos Residentes)
- AMPB (Associação de Médicos pelo Brasil)
- Outras entidades conveniadas

### 9.2 Dados agregados anonimizados
- Total de associados representados
- Distribuição geográfica (mapa)
- Tipos de demanda
- Taxa de êxito
- Valores em pipeline / recuperados
- Marcos relevantes (decisões, vitórias)

### 9.3 Acesso
- Subdomínio `painel.hyagoviana.adv.br`
- Login dedicado (`user_role = 'inst_partner'`)
- Apenas leitura de dados agregados (RLS específica)

---

## 10. Indicadores

- **Leads por canal:** quantidade + custo
- **Conversão por etapa:** % de movimentação entre etapas
- **Conversão por canal:** lead → cliente por origem
- **Ticket médio:** valor médio honorários
- **Tempo até fechamento:** mediana e P75
- **CAC estimado:** custo total / clientes convertidos
- **Cross-sell efetivo:** % de oportunidades convertidas
- **Produtividade comercial:** leads atendidos por Comercial

---

## 11. Telas

### 11.1 Pipeline Comercial (Kanban)
- Layout idêntico ao Pipeline Op (Projeto 1)
- Cards com score visual

### 11.2 Detalhe do Lead
- Tabs: Histórico, Conversa (WhatsApp Projeto 6), Tarefas, Notas

### 11.3 Cross-Sell Dashboard
- (Detalhado em §6.3)

### 11.4 Campanhas Meta/Google
- Lista, métricas, drill-down

### 11.5 E-mail Marketing
- Editor de templates + envio + analytics

### 11.6 Painel Institucional (externo)
- Dashboard read-only para ANMR/AMPB

---

## 12. Épicos e Stories

### Épico 1 — Funil e Leads
- Story 1.1: CRUD leads
- Story 1.2: Funil Kanban
- Story 1.3: Distribuição automática
- Story 1.4: Conversão lead → cliente

### Épico 2 — Cross-Sell
- Story 2.1: Engine de regras
- Story 2.2: Cron noturno
- Story 2.3: Dashboard

### Épico 3 — Canais de Captação
- Story 3.1: Webhook formulário
- Story 3.2: Integração lead via Projeto 6
- Story 3.3: Meta Ads API
- Story 3.4: Google Ads API

### Épico 4 — E-mail Marketing
- Story 4.1: Editor templates
- Story 4.2: Disparo + listas
- Story 4.3: Tracking

### Épico 5 — Painel Institucional
- Story 5.1: Subdomínio + auth
- Story 5.2: Dashboards anonimizados
- Story 5.3: Export PDF para entidades

### Épico 6 — Indicadores
- Story 6.1: Dashboards comerciais
- Story 6.2: Relatórios exportáveis

---

## 13. Métricas

- Conversão lead → cliente: baseline + 30%
- Tempo médio primeiro contato: ≤ 5min (horário comercial)
- Cross-sell efetivo: ≥ 15% de oportunidades convertidas
- Custo por lead (Meta/Google): tracking + alertas se acima do esperado

---

## 14. Critérios de aceitação

- ✅ Funil operando com 5+ etapas
- ✅ 100+ leads importados/gerados em produção
- ✅ Cross-sell engine rodando + 10+ oportunidades geradas
- ✅ Integrações Meta + Google funcionais
- ✅ E-mail marketing com 1+ campanha enviada
- ✅ Painel institucional acessível por ANMR/AMPB
- ✅ Treinamento equipe comercial (3h)

---

## 15. Riscos

| # | Risco | Mitigação |
|---|---|---|
| **R4.1** | LGPD em leads externos | Consent obrigatório antes de qualquer ação |
| **R4.2** | Vendor lock-in Meta/Google APIs | Abstração via Adapter |
| **R4.3** | Painel institucional vazar dados pessoais | RLS rigorosa + agregação obrigatória |
| **R4.4** | Cross-sell incorreto incomoda cliente | Score mínimo + dismiss visível |

---

> **Status:** Aprovado. **Próximo:** PRD Projeto 5 — Marketing.
> _— @pm + @architect + @qa 🎯_
