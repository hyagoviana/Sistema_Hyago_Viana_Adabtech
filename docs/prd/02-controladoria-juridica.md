# ⚖️ PRD Projeto 2 — Controladoria Jurídica

> **Plataforma Unificada Hyago Viana Advocacia**
> **Versão:** 1.0 · **Data:** 2026-05-15 · **Owners:** @pm + @architect + @qa · **Orquestração:** Orion
> **Status:** Aprovado para épicos/stories
>
> Consome: PRD Master + PRD 0 + PRD Projeto 1. **Pressuposto:** Projeto 1 entregue e clientes/casos cadastrados.

> ⚠ **Alinhamento com estratégia design-first (v1.1):**
> Quando este PRD entrar em execução (Fase **F5** do roadmap), as telas da Controladoria (Painel, Prazos, Movimentações, Exceções, Teses, Decisões, Projuris) **JÁ ESTARÃO IMPLEMENTADAS** com fixtures (saída de F2). Este PRD foca em: schema próprio do módulo, integração Projuris bidirecional, classificação IA de movimentações, embeddings pgvector, workflows n8n de sincronização. **Não é "construir UI"** — UI já existe e foi validada com usuários reais (F3).

---

## Sumário
1. [Visão e objetivos](#1-visão-e-objetivos)
2. [Personas](#2-personas)
3. [Escopo](#3-escopo)
4. [Schema do Projeto 2](#4-schema-do-projeto-2)
5. [Integração Projuris](#5-integração-projuris)
6. [Classificação IA de movimentações](#6-classificação-ia-de-movimentações)
7. [Gestão de prazos](#7-gestão-de-prazos)
8. [Centro de Exceções](#8-centro-de-exceções)
9. [Base de Teses e Decisões (RAG)](#9-base-de-teses-e-decisões-rag)
10. [Agente de monitoramento contínuo](#10-agente-de-monitoramento-contínuo)
11. [Telas e UX](#11-telas-e-ux)
12. [Épicos e Stories](#12-épicos-e-stories)
13. [Métricas e dashboards](#13-métricas-e-dashboards)
14. [Critérios de aceitação](#14-critérios-de-aceitação)
15. [Riscos](#15-riscos)

---

## 1. Visão e objetivos

> **"Cérebro jurídico que nunca esquece, nunca dorme e sugere sem decidir."**

A Controladoria recebe:
- **Sincronização contínua com Projuris** (processos, movimentações, prazos, partes).
- **Classificação automática de movimentações** (despacho, decisão, intimação, etc.).
- **Sugestão de providência** (peticionar, comunicar cliente, agendar, arquivar, escalar).
- **Gestão de prazos** com responsável sugerido + alertas escalonados.
- **Centro de Exceções** consolidando tudo que precisa atenção humana.
- **Base interna de teses e decisões** com busca semântica (embeddings).
- **Painel da controladoria** com filtros e indicadores.

### 3 objetivos macro

| # | Objetivo |
|---|---|
| **O1** | **Automatizar** atividades manuais de monitoramento processual |
| **O2** | **Sugerir inteligentemente** providências baseadas no histórico do escritório |
| **O3** | **Capturar conhecimento** (teses, decisões, entendimentos) para reuso pelos Projetos 3, 4, 5 |

---

## 2. Personas

| Persona | Nome | Responsabilidades |
|---|---|---|
| **Controlador Jurídico** | Renata Silva | Monitorar painel diário, validar classificações de baixa confiança, escalar exceções, alimentar base de teses |
| **Advogado Titular** | Dr. Hyago / Adavio | Tomar decisões estratégicas, aprovar teses, validar decisões cadastradas |
| **Advogado Associado** | (variável) | Executar tarefas, acessar teses/decisões |
| **Admin** | Dr. Hyago | Configurar regras, parâmetros, integrações |

---

## 3. Escopo

### Em escopo (V1)
- ✅ Integração Projuris API (sync bidirecional)
- ✅ Classificação automática de movimentações via Claude Haiku
- ✅ Gestão de prazos com responsável sugerido + alertas
- ✅ Centro de Exceções (8 categorias)
- ✅ Base de teses (CRUD + embedding)
- ✅ Base de decisões (CRUD + embedding + busca semântica)
- ✅ Painel da controladoria
- ✅ Agente n8n de monitoramento contínuo

### Fora de escopo
- ❌ Geração de minutas → PRD 3
- ❌ Outras integrações (não-Projuris)
- ❌ Cobrança jurídica → PRD 1 (já integrado)

---

## 4. Schema do Projeto 2

### 4.1 Tabela `projuris_processes`

```sql
CREATE TABLE projuris_processes (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         uuid NOT NULL REFERENCES organizations(id),
  case_id                 uuid REFERENCES cases(id),                -- pode ser NULL antes de vincular
  projuris_id             text NOT NULL,                            -- ID externo no Projuris
  numero_processo         text,                                     -- CNJ
  comarca                 text,
  orgao_julgador          text,
  tribunal                text,
  classe                  text,
  assunto                 text,
  valor_causa             numeric(14,2),
  partes                  jsonb,                                    -- [{nome, tipo, cpf_cnpj, ...}]
  status_projuris         text,
  ultimo_sync_em          timestamptz,
  ultimo_movimento_em     timestamptz,
  raw_data                jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, projuris_id)
);

CREATE INDEX idx_pj_case ON projuris_processes(case_id);
CREATE INDEX idx_pj_numero ON projuris_processes(numero_processo);
```

### 4.2 Tabela `processo_movimentacoes`

```sql
CREATE TABLE processo_movimentacoes (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         uuid NOT NULL REFERENCES organizations(id),
  projuris_process_id     uuid NOT NULL REFERENCES projuris_processes(id) ON DELETE CASCADE,
  case_id                 uuid REFERENCES cases(id),
  movimento_data          timestamptz NOT NULL,
  texto_completo          text NOT NULL,
  -- Classificação IA
  ai_classificacao        text,                                     -- DESPACHO | DECISAO_INTERLOCUTORIA | SENTENCA | INTIMACAO | CITACAO | JUNTADA | AUDIENCIA | OUTRO
  ai_subclassificacao     text,                                     -- ex: 'sentença favorável', 'intimação prazo'
  ai_urgencia             text,                                     -- ROTINA | ATENCAO | URGENTE
  ai_resumo               text,                                     -- até 5 linhas
  ai_providencia_sugerida text,                                     -- PETICIONAR | COMUNICAR_CLIENTE | AGENDAR | ARQUIVAR | ESCALAR
  ai_prazo_detectado_dias int,                                      -- prazo identificado em dias
  ai_confidence           numeric(5,2),                             -- 0-100
  -- Estado humano
  status_humano           text DEFAULT 'PENDING',                   -- PENDING | VALIDATED | OVERRIDDEN | DISMISSED
  validado_por_id         uuid REFERENCES users(id),
  validado_em             timestamptz,
  validacao_correcoes     jsonb,                                    -- {classificacao_real, observacao}
  -- Tarefa derivada
  task_id                 uuid REFERENCES case_tasks(id),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mov_proc ON processo_movimentacoes(projuris_process_id, movimento_data DESC);
CREATE INDEX idx_mov_classif ON processo_movimentacoes(ai_classificacao, ai_urgencia);
CREATE INDEX idx_mov_pending ON processo_movimentacoes(status_humano, ai_confidence) WHERE status_humano = 'PENDING';
```

### 4.3 Tabela `prazos`

```sql
CREATE TABLE prazos (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             uuid NOT NULL REFERENCES organizations(id),
  case_id                     uuid REFERENCES cases(id),
  projuris_process_id         uuid REFERENCES projuris_processes(id),
  movimentacao_id             uuid REFERENCES processo_movimentacoes(id),
  -- Definição
  tipo                        text NOT NULL,                        -- CONTESTACAO, RECURSO, MANIFESTACAO, etc.
  descricao                   text NOT NULL,
  data_fatal                  date NOT NULL,                        -- prazo legal final
  data_recomendada_protocolo  date NOT NULL,                        -- antecedência mínima 3 dias úteis
  -- Atribuição
  responsavel_sugerido_id     uuid REFERENCES users(id),            -- sistema sugere
  responsavel_atribuido_id    uuid REFERENCES users(id),            -- após aceite
  aceito_em                   timestamptz,
  -- Status
  status                      text NOT NULL DEFAULT 'PENDENTE',     -- PENDENTE | EM_ANDAMENTO | CONCLUIDO | PERDIDO | NAO_APLICA
  cumprido_em                 timestamptz,
  cumprido_por_id             uuid REFERENCES users(id),
  -- Confiança
  ai_confidence               numeric(5,2),                         -- detecção automática
  validacao_humana_required   boolean NOT NULL DEFAULT false,        -- se confidence < limiar
  -- Auditoria
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prazos_case ON prazos(case_id);
CREATE INDEX idx_prazos_fatal ON prazos(data_fatal) WHERE status IN ('PENDENTE', 'EM_ANDAMENTO');
CREATE INDEX idx_prazos_resp ON prazos(responsavel_atribuido_id, data_fatal);
```

### 4.4 Tabela `teses`

```sql
CREATE TABLE teses (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  titulo              text NOT NULL,
  tema                text NOT NULL,                              -- FIES_ABATIMENTO, MAIS_MEDICOS_INDENIZACAO, etc.
  area_direito        text,                                       -- ADM, CIVEL, TRABALHISTA, ETICO
  texto_completo      text NOT NULL,
  argumentos_chave    text[],
  jurisprudencia_apoio jsonb,                                      -- [{tribunal, processo, ementa}]
  status              text NOT NULL DEFAULT 'RASCUNHO',           -- RASCUNHO | REVISAO | APROVADA | DEPRECIADA
  aprovada_por_id     uuid REFERENCES users(id),
  aprovada_em         timestamptz,
  -- Embedding
  embedding           vector(3072),                                -- text-embedding-3-large
  -- Auditoria
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teses_tema ON teses(tema, status);
CREATE INDEX idx_teses_embedding ON teses USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 4.5 Tabela `decisoes`

```sql
CREATE TABLE decisoes (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             uuid NOT NULL REFERENCES organizations(id),
  -- Identificação
  tribunal                    text NOT NULL,                        -- TRF1, STJ, TJSP, etc.
  orgao_julgador              text,                                 -- 3ª Turma, 1ª Vara
  numero_processo             text,
  relator                     text,
  data_decisao                date,
  tipo                        text NOT NULL,                        -- DECISAO | SENTENCA | ACORDAO | OUTRO
  -- Conteúdo
  ementa                      text,
  texto_completo              text NOT NULL,
  resultado                   text,                                 -- DEFERIDO | INDEFERIDO | PROVIDO | IMPROVIDO | OUTRO
  tema                        text NOT NULL,
  area_direito                text,
  -- Vinculações
  teses_relacionadas          uuid[],                               -- IDs em teses
  -- Embedding
  embedding                   vector(3072),
  -- Estado
  status                      text NOT NULL DEFAULT 'CADASTRADA',   -- CADASTRADA | REVISADA | RELEVANTE_DESTACADA
  destacada                   boolean NOT NULL DEFAULT false,        -- decisão "marco" para o escritório
  -- Auditoria
  cadastrada_por_id           uuid REFERENCES users(id),
  validada_por_id             uuid REFERENCES users(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dec_tema ON decisoes(tema, tribunal);
CREATE INDEX idx_dec_embedding ON decisoes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 4.6 Tabela `excecoes`

```sql
CREATE TABLE excecoes (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  categoria           text NOT NULL,
  -- Categorias possíveis:
  -- PRAZO_SEM_RESPONSAVEL
  -- PRAZO_CONFLITANTE
  -- TAREFA_SEM_ACEITE
  -- TAREFA_VENCIDA
  -- PROCESSO_PARADO         (>parâmetro configurável dias)
  -- MOVIMENTACAO_BAIXA_CONFIANCA
  -- DECISAO_NAO_CLASSIFICADA
  -- ERRO_INTEGRACAO
  case_id             uuid REFERENCES cases(id),
  prazo_id            uuid REFERENCES prazos(id),
  tarefa_id           uuid REFERENCES case_tasks(id),
  movimentacao_id     uuid REFERENCES processo_movimentacoes(id),
  -- Descrição
  titulo              text NOT NULL,
  descricao           text,
  prioridade          text NOT NULL DEFAULT 'NORMAL',               -- LOW | NORMAL | HIGH | URGENT
  -- Resolução
  status              text NOT NULL DEFAULT 'ABERTA',              -- ABERTA | EM_ANALISE | RESOLVIDA | IGNORADA
  resolvida_por_id    uuid REFERENCES users(id),
  resolvida_em        timestamptz,
  resolucao_descricao text,
  -- Auditoria
  detectada_em        timestamptz NOT NULL DEFAULT now(),
  detectada_por       text NOT NULL DEFAULT 'SYSTEM'                -- SYSTEM | USER
);

CREATE INDEX idx_exc_cat ON excecoes(categoria, status);
CREATE INDEX idx_exc_open ON excecoes(status, detectada_em DESC) WHERE status = 'ABERTA';
```

### 4.7 Tabela `controladoria_config`

```sql
CREATE TABLE controladoria_config (
  organization_id                 uuid PRIMARY KEY REFERENCES organizations(id),
  prazo_antecedencia_dias         int NOT NULL DEFAULT 3,
  processo_parado_dias_threshold  int NOT NULL DEFAULT 60,
  classif_confidence_threshold    numeric(5,2) NOT NULL DEFAULT 70.00,
  projuris_sync_freq_minutes      int NOT NULL DEFAULT 60,
  alerta_prazo_dias_antes         int[] NOT NULL DEFAULT '{15,7,3,1}',
  updated_at                      timestamptz NOT NULL DEFAULT now()
);
```

---

## 5. Integração Projuris

### 5.1 Endpoints consumidos (referência Projuris API V2)

| Endpoint | Uso |
|---|---|
| `GET /processos?modified_since=...` | Lista processos modificados |
| `GET /processos/{id}` | Detalhes de processo |
| `GET /processos/{id}/movimentacoes?since=...` | Movimentações |
| `GET /processos/{id}/prazos` | Prazos cadastrados |
| `POST /processos/{id}/comentarios` | Anotações nossas |

### 5.2 Sync bidirecional

**Frequência:** configurável (`controladoria_config.projuris_sync_freq_minutes` — default 60min).

**Direção In (Projuris → nossa base):**
1. Buscar processos modificados desde último sync.
2. Upsert em `projuris_processes`.
3. Para cada processo, buscar movimentações novas.
4. Inserir em `processo_movimentacoes` com `status_humano=PENDING`.
5. Disparar classificação IA (assíncrono).
6. Vincular processo a `case` via match de partes/CPF (se possível).

**Direção Out (nossa base → Projuris):**
- Comentários: anotações relevantes do nosso sistema podem ser sincronizadas como comentários no Projuris.
- Prazos cumpridos: marcação opcional.

### 5.3 Workflow n8n `wf-projuris-sync`

```
[Cron horário]
  → GET processos modificados (paginated)
  → Para cada processo:
    → UPSERT projuris_processes
    → GET movimentações desde ultimo_sync
    → INSERT processo_movimentacoes
    → Dispara classifier (HTTP POST /api/ai/classification/movimento)
  → Log integração
  → Atualiza last_sync_at
```

### 5.4 Tratamento de erros

- Retry 3x backoff exponencial.
- 5xx Projuris: aborta + alerta.
- 4xx: log + flag em `integration_logs`.
- Sync parcial: salva offset, retoma.

---

## 6. Classificação IA de movimentações

### 6.1 Pipeline

```
[Movimentação inserida em processo_movimentacoes]
    ↓
[Edge Function /api/ai/classify-movement]
    ↓
[Claude Haiku 4.5 com system prompt cached]
    ↓
[JSON output]:
  {
    classificacao: 'INTIMACAO',
    subclassificacao: 'intimação prazo recurso',
    urgencia: 'URGENTE',
    resumo: '...',
    providencia_sugerida: 'PETICIONAR',
    prazo_detectado_dias: 15,
    confidence: 87
  }
    ↓
[Update processo_movimentacoes com classificação]
    ↓
[Se providencia_sugerida = PETICIONAR + prazo detectado:]
  → Cria registro em `prazos` com data calculada
  → Cria `case_task` se responsável sugerido
    ↓
[Se confidence < threshold (70%):]
  → Cria `excecoes` categoria MOVIMENTACAO_BAIXA_CONFIANCA
```

### 6.2 System prompt (cached)

```
Você é assistente jurídico especializado em classificação processual brasileira.
Receberá texto de movimentação processual e deve classificar com:

CLASSIFICAÇÃO (obrigatória):
- DESPACHO
- DECISAO_INTERLOCUTORIA
- SENTENCA
- INTIMACAO
- CITACAO
- JUNTADA
- AUDIENCIA
- OUTRO

URGÊNCIA:
- ROTINA: sem prazo
- ATENCAO: prazo informativo
- URGENTE: prazo legal em <30 dias

PROVIDÊNCIA SUGERIDA:
- PETICIONAR (se demanda peça)
- COMUNICAR_CLIENTE (se cliente precisa saber)
- AGENDAR (audiência, perícia)
- ARQUIVAR (rotina sem ação)
- ESCALAR (situação crítica/incomum)

RESUMO: 1-3 linhas em português claro.
PRAZO_DETECTADO_DIAS: número de dias se mencionado prazo, senão null.
CONFIDENCE: 0-100 baseado em clareza do texto.

Retorne JSON puro, sem comentários.
```

### 6.3 Validação humana

- Movimentações com `confidence < 70%` aparecem em painel "Validação Pendente".
- Controlador valida (mantém ou corrige).
- Correções treinam o sistema (logs para fine-tuning futuro).

### 6.4 Métricas

- **Cobertura:** % movimentações classificadas automaticamente. Meta: 100%.
- **Acurácia validada:** % de classificações mantidas pelo humano (sem correção). Meta: ≥ 85%.
- **Confidence média:** ≥ 75.

---

## 7. Gestão de prazos

### 7.1 Detecção de prazos

- Pipeline IA detecta menção a prazos em movimentações ("prazo de 15 dias", "no quinquídio legal", etc.).
- Calcula `data_fatal` (data movimentação + dias úteis).
- Calcula `data_recomendada_protocolo = data_fatal - antecedencia (config)`.
- Sugere responsável baseado em:
  - Responsável atual do caso (`cases.responsavel_juridico_id`).
  - Carga de trabalho atual (menos sobrecarregado).
  - Especialidade (se cadastrada em `users.preferences`).

### 7.2 Aceite/Recusa

- Tarefa de prazo aparece no Painel "Hoje" do responsável sugerido.
- Botões: "Aceitar" / "Recusar e sugerir outro".
- Aceite registra `aceito_em` + status `EM_ANDAMENTO`.
- Recusa abre modal para indicar quem deveria pegar.

### 7.3 Alertas escalonados

Configurável por org (`alerta_prazo_dias_antes`):
- Default: 15, 7, 3, 1 dias antes da `data_recomendada_protocolo`.
- Cada alerta: notificação sino + e-mail + (se URGENT) WhatsApp Admin.

### 7.4 Override de prazo

- Apenas Admin pode mover `data_fatal` (caso real diferente do detectado).
- Audit log obrigatório.

### 7.5 Prazos conflitantes

- 2+ prazos com `data_recomendada_protocolo` no mesmo dia → exceção `PRAZO_CONFLITANTE`.
- Sistema sugere redistribuição.

---

## 8. Centro de Exceções

### 8.1 Categorias e detecção

| Categoria | Detecção (SQL/lógica) |
|---|---|
| `PRAZO_SEM_RESPONSAVEL` | `prazos.responsavel_atribuido_id IS NULL AND status='PENDENTE'` |
| `PRAZO_CONFLITANTE` | Window function: count(*) > 1 para mesma data |
| `TAREFA_SEM_ACEITE` | `case_tasks.assigned_to_id IS NOT NULL AND accepted_at IS NULL AND age(created_at) > 1 day` |
| `TAREFA_VENCIDA` | `case_tasks.due_at < now() AND status NOT IN ('DONE','CANCELLED')` |
| `PROCESSO_PARADO` | `cases.date_macrostatus_op_at < now() - threshold_dias` |
| `MOVIMENTACAO_BAIXA_CONFIANCA` | `processo_movimentacoes.ai_confidence < threshold` |
| `DECISAO_NAO_CLASSIFICADA` | `processo_movimentacoes.ai_classificacao IN ('DECISAO_INTERLOCUTORIA','SENTENCA') AND status_humano='PENDING' AND age > 24h` |
| `ERRO_INTEGRACAO` | `integration_logs.status='FAILED' AND retries_exceeded=true` |

### 8.2 Painel "Centro de Exceções"

```
┌────────────────────────────────────────────────────────────┐
│ Centro de Exceções                                          │
│ 23 abertas  •  Filtrar por: categoria, prioridade, caso     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ 🔴 URGENTE (5)                                              │
│ ├ PRAZO_CONFLITANTE: Maria tem 2 prazos em 18/05         → │
│ ├ ERRO_INTEGRACAO: Projuris sync falhou 3x                → │
│ └ ...                                                       │
│                                                             │
│ 🟡 ATENÇÃO (12)                                             │
│ ├ TAREFA_VENCIDA: 4 tarefas vencidas há >48h              → │
│ ├ MOVIMENTACAO_BAIXA_CONFIANCA: 7 aguardando validação    → │
│ └ ...                                                       │
│                                                             │
│ 🟢 ROTINA (6)                                               │
│ ├ DECISAO_NAO_CLASSIFICADA: 3 decisões aguardando JUR     → │
│ └ ...                                                       │
└────────────────────────────────────────────────────────────┘
```

### 8.3 Resolução

- Clicar em exceção → leva ao registro origem.
- Resolução in-line (atribuir responsável, corrigir prazo, validar movimentação).
- Audit log + status → RESOLVIDA.

---

## 9. Base de Teses e Decisões (RAG)

### 9.1 CRUD de Teses

- Cadastro manual: Controladoria/JUR cria tese ao identificar padrão.
- Sugestão IA (V2): sistema detecta padrão repetido em movimentações e sugere "Criar tese?".
- Workflow: RASCUNHO → REVISAO → APROVADA → (DEPRECIADA).

### 9.2 CRUD de Decisões

- Cadastro manual ou via PDF upload (OCR + extração IA dos campos).
- IA preenche automaticamente: tribunal, processo, ementa, resultado.
- Humano valida.

### 9.3 Embeddings

- Ao salvar tese/decisão APROVADA, calcula embedding via `text-embedding-3-large`.
- Armazena em `vector(3072)`.

### 9.4 Busca semântica

```typescript
// Edge Function /api/ai/teses-search
const queryEmbedding = await embedQuery(req.query)
const { data } = await supabase.rpc('search_teses', {
  query_embedding: queryEmbedding,
  match_threshold: 0.75,
  match_count: 10
})

// SQL function:
// SELECT id, titulo, tema, ts_score
// FROM teses
// WHERE status='APROVADA' AND embedding <=> query_embedding < (1 - threshold)
// ORDER BY embedding <=> query_embedding
// LIMIT match_count
```

### 9.5 Sugestão ativa em tarefas

- Quando movimentação classificada como `PETICIONAR`, sistema busca teses+decisões relacionadas por tema.
- Mostra na tarefa: "📚 3 teses relacionadas, 5 decisões favoráveis".
- Clicar exibe lista resumida.

### 9.6 Facilitadores de cadastro

- Upload PDF de decisão → IA extrai campos + sugere preenchimento → humano confirma.
- Bookmarklet (browser extension V2) para capturar decisões durante navegação.

---

## 10. Agente de monitoramento contínuo

### 10.1 Workflow n8n `wf-agente-monitoramento`

```
[Cron 8h diário]
  ↓
[SELECT movimentacoes onde:
   movimento_data >= ontem
   AND ai_urgencia IN ('ATENCAO', 'URGENTE')]
  ↓
[Agrupa por caso/responsável]
  ↓
[Para cada responsável:
  - Envia notificação sino: "Você tem N movimentações relevantes hoje"
  - Envia e-mail resumo com lista
  - Se URGENTE: envia WhatsApp ao Admin]
  ↓
[Atualiza dashboard "Resumo diário"]
```

### 10.2 Resumo executivo (Admin)

E-mail diário 8h para Admin com:
- N movimentações novas / N urgentes
- N prazos próximos
- N exceções abertas
- Casos em atenção (>45d em macrostatus)

---

## 11. Telas e UX

### 11.1 Painel da Controladoria

```
┌──────────────────────────────────────────────────────────────┐
│ Controladoria · Bom dia, Renata                              │
│                                                              │
│ 🔥 Prazos próximos (15d): 23   ⚠ Exceções: 11   📈 Hoje: +5 │
├──────────────────────────────────────────────────────────────┤
│ [Painel] [Prazos] [Movimentações] [Exceções] [Teses] [Decisões]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Prazos próximos                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ HOJE (3)                                                 │ │
│ │ • CONTESTACAO  •  FIES-2026-0042  •  Maria  •  10h     │ │
│ │ • RECURSO      •  COVID-2026-0017  •  Pedro  •  16h    │ │
│ │ • MANIFESTACAO •  ESF-2026-0033   •  Maria  •  17h     │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AMANHÃ (5)                                               │ │
│ │ ...                                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 Tela de Validação de Movimentação

```
┌──────────────────────────────────────────────────────────────┐
│ Movimentação aguardando validação                            │
│ Processo: 0001234-56.2024.4.01.4000  •  TRF1  •  3ª Turma   │
├──────────────────────────────────────────────────────────────┤
│ Texto da movimentação:                                       │
│ "Intime-se a parte autora para, no prazo de 15 dias, ..."   │
│                                                              │
│ Classificação IA (confidence 65%):                           │
│ ┌──────────────────────────────────────────────┐            │
│ │ Tipo:           INTIMACAO                     │ [Manter]   │
│ │ Subtipo:        intimação para manifestar     │ [Editar]   │
│ │ Urgência:       URGENTE                       │            │
│ │ Providência:    PETICIONAR                    │            │
│ │ Prazo detectado: 15 dias                      │            │
│ └──────────────────────────────────────────────┘            │
│                                                              │
│ Resumo:                                                       │
│ "Tribunal intima parte autora a manifestar-se sobre laudo   │
│  pericial em 15 dias."                                      │
│                                                              │
│ Teses relacionadas (auto-sugerido):                          │
│ • Tese: Laudo pericial em demandas FIES                     │
│ • Decisão: TRF1 3ª Turma — Acórdão 12345 (favorável)        │
│                                                              │
│ [Confirmar e criar prazo] [Corrigir classificação] [Dispensar]│
└──────────────────────────────────────────────────────────────┘
```

### 11.3 Tela de Cadastro de Tese

```
┌──────────────────────────────────────────────────────────────┐
│ Nova Tese                                                    │
│                                                              │
│ Título:        [_______________________________________]    │
│ Tema:          [▼ FIES_ABATIMENTO ▼]                        │
│ Área:          [▼ ADMINISTRATIVO ▼]                         │
│                                                              │
│ Texto completo:                                              │
│ ┌───────────────────────────────────────────────────────┐   │
│ │                                                       │   │
│ │  [editor rich-text]                                   │   │
│ │                                                       │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                              │
│ Argumentos-chave (1 por linha):                              │
│ • _________________________________                          │
│ • _________________________________                          │
│                                                              │
│ Jurisprudência de apoio (adicionar):                         │
│ + Adicionar decisão                                          │
│                                                              │
│ [Salvar Rascunho] [Enviar p/ Revisão] [Aprovar (Admin)]    │
└──────────────────────────────────────────────────────────────┘
```

---

## 12. Épicos e Stories

### Épico 1 — Integração Projuris
- **Story 1.1:** Configurar API key + teste de conexão
- **Story 1.2:** Workflow n8n sync inicial (1 processo)
- **Story 1.3:** Sync incremental (movimentações desde último)
- **Story 1.4:** Vinculação automática processo↔case via match de partes
- **Story 1.5:** Painel de saúde da integração (logs, falhas, retries)

### Épico 2 — Classificação IA
- **Story 2.1:** Edge function `/api/ai/classify-movement`
- **Story 2.2:** System prompt + cache + teste com 50 amostras
- **Story 2.3:** Storage de classificação + UI de exibição
- **Story 2.4:** Validação humana de baixa confidence
- **Story 2.5:** Dashboard de acurácia (validações × correções)

### Épico 3 — Gestão de Prazos
- **Story 3.1:** Detecção automática de prazos (via classificação)
- **Story 3.2:** Cálculo `data_fatal` + `data_recomendada` (dias úteis)
- **Story 3.3:** Sugestão de responsável
- **Story 3.4:** Painel de prazos (lista + calendário)
- **Story 3.5:** Aceite/recusa de prazo
- **Story 3.6:** Alertas escalonados (15/7/3/1 dias)
- **Story 3.7:** Detecção de conflitos

### Épico 4 — Centro de Exceções
- **Story 4.1:** Detector de exceções (SQL + cron 15min)
- **Story 4.2:** UI consolidado
- **Story 4.3:** Resolução in-line
- **Story 4.4:** Histórico de exceções resolvidas

### Épico 5 — Base de Teses
- **Story 5.1:** CRUD básico
- **Story 5.2:** Embedding em background
- **Story 5.3:** Busca semântica
- **Story 5.4:** Workflow aprovação

### Épico 6 — Base de Decisões
- **Story 6.1:** CRUD básico
- **Story 6.2:** Upload PDF + extração IA
- **Story 6.3:** Embedding
- **Story 6.4:** Busca semântica + filtros (tribunal, ano, resultado)

### Épico 7 — Painel Controladoria
- **Story 7.1:** Layout multi-tab
- **Story 7.2:** Indicadores (prazos próximos, exceções, hoje)
- **Story 7.3:** Drilldown por advogado/equipe

### Épico 8 — Agente n8n
- **Story 8.1:** Workflow diário 8h
- **Story 8.2:** Resumo executivo Admin
- **Story 8.3:** Alertas WhatsApp para urgências

---

## 13. Métricas e dashboards

- **% movimentações classificadas auto:** 100% (cobertura) — meta
- **Acurácia validada:** ≥ 85%
- **% prazos com responsável atribuído em <1 dia:** ≥ 95%
- **Exceções abertas há >7d:** ≤ 5
- **Teses cadastradas:** baseline + crescente
- **Decisões cadastradas:** baseline + crescente
- **Tempo médio resolução exceção:** ≤ 24h (URGENT) / ≤ 72h (NORMAL)

---

## 14. Critérios de aceitação

- ✅ Integração Projuris sync >99% confiável (alertas funcionando)
- ✅ 1000+ movimentações classificadas, validação amostral ≥85% acurácia
- ✅ Painel da controladoria operando com dados reais
- ✅ Base de teses com ≥50 teses cadastradas (alimentação inicial Controladoria)
- ✅ Base de decisões com ≥100 decisões (alimentação inicial)
- ✅ Busca semântica retornando resultados relevantes (validação Controladoria)
- ✅ Centro de Exceções detectando 8 categorias
- ✅ Agente n8n diário enviando resumos
- ✅ Treinamento Controladoria (4h) realizado

---

## 15. Riscos

| # | Risco | Mitigação |
|---|---|---|
| **R2.1** | Projuris API instável | Retry + alertas + manual fallback (planilha de processos críticos) |
| **R2.2** | Classificação IA com erros sistemáticos | Validação amostral mensal + ajuste de prompt |
| **R2.3** | Base de teses fica desatualizada | Workflow trimestral de revisão (Controladoria responsabilidade) |
| **R2.4** | Embeddings caros (volume alto) | Embed somente teses/decisões APROVADAS (não rascunhos) |
| **R2.5** | Sugestões IA ignoradas pela equipe | Treinamento + métricas de aceitação |

---

> **Status:** Aprovado. **Próximo:** Elicitação Projeto 6 → PRD Projeto 6.
> _— @pm + @architect + @qa, sob coordenação de Orion 🎯_
