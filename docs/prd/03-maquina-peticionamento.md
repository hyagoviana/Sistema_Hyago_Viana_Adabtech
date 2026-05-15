# 🤖 PRD Projeto 3 — Máquina de Peticionamento

> **Plataforma Unificada Hyago Viana Advocacia**
> **Versão:** 1.0 · **Data:** 2026-05-15 · **Owners:** @pm + @architect + @qa · **Orquestração:** Orion
> **Status:** Aprovado para épicos/stories
>
> Consome: PRD Master + 0 + 1 + 2. **Pressuposto:** Base de teses/decisões povoada (P2).

> ⚠ **Alinhamento com estratégia design-first (v1.1):**
> Quando este PRD entrar em execução (Fase **F7** do roadmap), as telas de Peticionamento (Lista de Minutas, Editor com painel lateral de fontes/issues, Banco de Peças, Checklist de Prontidão) **JÁ ESTARÃO IMPLEMENTADAS** com fixtures. Este PRD foca em: pipeline RAG, system prompts cached por tipo de peça, self-critique pass, validação automatizada (regex + cross-check DB), watermark "MINUTA NÃO REVISADA", embeddings das peças validadas. **UI pronta e validada — foco é a inteligência por trás.**

---

## Sumário
1. [Visão](#1-visão)
2. [Princípios anti-alucinação](#2-princípios-anti-alucinação)
3. [Escopo](#3-escopo)
4. [Tipos de peças](#4-tipos-de-peças)
5. [Schema](#5-schema)
6. [Pipeline RAG](#6-pipeline-rag)
7. [Checklist de prontidão](#7-checklist-de-prontidão)
8. [Banco de peças validadas](#8-banco-de-peças-validadas)
9. [Telas](#9-telas)
10. [Épicos e Stories](#10-épicos-e-stories)
11. [Métricas](#11-métricas)
12. [Critérios de aceitação](#12-critérios-de-aceitação)
13. [Riscos](#13-riscos)

---

## 1. Visão

> **"Reduzir o trabalho mecânico do advogado, sem reduzir sua responsabilidade — geração assistida, decisão humana."**

Sistema produz **minutas de qualidade jurídica** consumindo:
- Base de teses (P2)
- Base de decisões cadastradas (P2)
- Banco de peças validadas (próprio)
- Dados do caso e cliente (P1)
- Movimentações processuais (P2/Projuris)
- Normas legais verificáveis

Cada minuta:
- Marca clara **"MINUTA — NÃO REVISADA"** até aceite.
- **Mapa de fontes** rastreável (toda afirmação tem origem).
- **Validação automática** de consistência (nomes, CPF, datas, processo).
- **Painel lateral** com decisões internas relevantes.

---

## 2. Princípios anti-alucinação

| # | Princípio | Implementação |
|---|---|---|
| **AH1** | **Toda afirmação tem fonte rastreável** | Mapa de fontes obrigatório; afirmações sem fonte são marcadas |
| **AH2** | **Modelo Opus** para minutas (maior capacidade, menos alucinação) | Sonnet em V2 após validação |
| **AH3** | **Self-critique pass** (segundo prompt revisa o primeiro) | 2-step generation |
| **AH4** | **Revisão automatizada de dados** (nomes, CPF, processo) | Regex + cross-check DB |
| **AH5** | **Marcação visual** indelével até aceite advogado | Watermark + flag |
| **AH6** | **Banco de peças validadas** como template | RAG prioriza peças aprovadas |
| **AH7** | **Sem juízo de mérito da IA** | Prompts proíbem opinião jurídica não-fundada |
| **AH8** | **Versionamento** de cada minuta | Histórico completo de edições |
| **AH9** | **Auditoria de aceite** | Quem aceitou, quando, quais alterações fez |
| **AH10** | **Métrica de "alucinação detectada"** | Toda correção do advogado loga o que mudou |

---

## 3. Escopo

### Em escopo (V1)

Geração de **mínimo 9 tipos de peças**:
- ✅ Petição inicial FIES (administrativa)
- ✅ Recurso administrativo SGTES/SAPS/FNDE
- ✅ Auxílio-moradia residência médica (inicial)
- ✅ Bolsa/residência e CNRM (inicial)
- ✅ Mais Médicos — indenização de permanência
- ✅ Defesa preliminar CFM/CRM
- ✅ Razões finais CFM/CRM
- ✅ Mandado de segurança previdenciário/saúde
- ✅ 10% PMMB
- + ✅ Mínimo 3 peças extras a definir com cliente

Funcionalidades:
- ✅ Checklist de prontidão
- ✅ Pipeline RAG
- ✅ Mapa de fontes
- ✅ Validação automatizada
- ✅ Marcação MINUTA NÃO REVISADA
- ✅ Banco de peças validadas
- ✅ Editor de revisão

### Fora de escopo
- ❌ Protocolo eletrônico (esse fica no Projeto 1)
- ❌ Peças com mérito altamente discricionário (ex: defesa em processo de homicídio doloso) — sempre 100% manual

---

## 4. Tipos de peças

### 4.1 Inventário

| Tipo | Complexidade | Volume estimado | Auto-aprovação possível? |
|---|---|---|---|
| **Inicial FIES (admin)** | Baixa | Alto (~150/mês) | Sim para casos padrão |
| **Recurso adm SGTES/SAPS/FNDE** | Média | Médio | Parcial |
| **Auxílio-moradia residência** | Média | Baixo | Sim |
| **Bolsa/CNRM** | Média | Baixo | Sim |
| **Mais Médicos indenização** | Alta | Baixo | Não — sempre manual |
| **Defesa CFM/CRM (preliminar)** | Alta | Médio | Não |
| **Razões finais CFM/CRM** | Alta | Médio | Não |
| **MS previdenciário** | Média | Baixo | Parcial |
| **10% PMMB** | Média | Médio | Sim |

### 4.2 Estrutura padrão de uma peça

```
1. Endereçamento (autoridade)
2. Qualificação das partes
3. Dos fatos
4. Do direito (fundamentação)
5. Dos pedidos
6. Documentos anexados
7. Valor da causa (quando aplicável)
8. Local, data, assinatura
```

Cada bloco tem prompt e validações específicas.

---

## 5. Schema

### 5.1 Tabela `minutas`

```sql
CREATE TABLE minutas (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         uuid NOT NULL REFERENCES organizations(id),
  case_id                 uuid REFERENCES cases(id),
  -- Identificação
  tipo_peca               text NOT NULL,                            -- INICIAL_FIES_ADM, RECURSO_SGTES, ...
  titulo                  text NOT NULL,
  -- Versionamento
  version                 int NOT NULL DEFAULT 1,
  supersedes              uuid REFERENCES minutas(id),
  -- Geração
  prompt_template_id      uuid REFERENCES prompt_templates(id),
  generation_input        jsonb,                                    -- contexto enviado ao modelo
  generation_model        text,                                     -- 'claude-opus-4-7'
  generation_tokens_in    int,
  generation_tokens_out   int,
  generation_time_ms      int,
  generation_cost_usd     numeric(10,4),
  -- Conteúdo
  content_md              text NOT NULL,                            -- Markdown (canônico)
  content_html            text,                                     -- renderizado
  content_docx_path       text,                                     -- arquivo Word final
  content_pdf_path        text,                                     -- PDF final
  -- Mapa de fontes
  sources_map             jsonb NOT NULL DEFAULT '[]'::jsonb,       -- [{type:'tese',id:..., section:'fundamentação',text:'...'}, ...]
  -- Validação automatizada
  validation_status       text NOT NULL DEFAULT 'PENDING',          -- PENDING | PASSED | FAILED | OVERRIDDEN
  validation_issues       jsonb,                                    -- lista de issues detectadas
  -- Workflow de aceite
  status                  text NOT NULL DEFAULT 'DRAFT',            -- DRAFT | UNDER_REVIEW | APPROVED | REJECTED | PROTOCOLED | ARCHIVED
  reviewed_by_id          uuid REFERENCES users(id),
  reviewed_at             timestamptz,
  approved_by_id          uuid REFERENCES users(id),
  approved_at             timestamptz,
  approved_with_edits     boolean,                                  -- humano editou antes de aprovar
  edits_summary           text,                                     -- resumo do que mudou
  -- Auditoria
  created_by              uuid REFERENCES users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_minuta_case ON minutas(case_id);
CREATE INDEX idx_minuta_tipo ON minutas(tipo_peca, status);
```

### 5.2 Tabela `prompt_templates`

```sql
CREATE TABLE prompt_templates (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  tipo_peca           text NOT NULL,
  version             int NOT NULL DEFAULT 1,
  system_prompt       text NOT NULL,                          -- prompt cached
  user_prompt_template text NOT NULL,                          -- com placeholders {{client.name}}, etc.
  generation_config   jsonb,                                  -- {model, temperature, max_tokens, ...}
  validation_rules    jsonb,                                  -- regras de validação automática
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, tipo_peca, version)
);
```

### 5.3 Tabela `pecas_validadas` (banco de peças do escritório)

```sql
CREATE TABLE pecas_validadas (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  tipo_peca           text NOT NULL,
  titulo              text NOT NULL,
  content_md          text NOT NULL,
  outcome             text,                                       -- DEFERIDO | INDEFERIDO | DESCONHECIDO
  case_id             uuid REFERENCES cases(id),                 -- caso de origem
  embedding           vector(3072),
  tags                text[],
  status              text NOT NULL DEFAULT 'CADASTRADA',         -- CADASTRADA | APROVADA | ARQUIVADA
  approved_by_id      uuid REFERENCES users(id),
  approved_at         timestamptz,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pecas_tipo ON pecas_validadas(tipo_peca, status);
CREATE INDEX idx_pecas_embedding ON pecas_validadas USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 5.4 Tabela `checklist_prontidao`

```sql
CREATE TABLE checklist_prontidao (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         uuid NOT NULL REFERENCES organizations(id),
  case_id                 uuid NOT NULL REFERENCES cases(id),
  tipo_peca               text NOT NULL,
  -- Status checklist (snapshot)
  docs_required           jsonb NOT NULL,                           -- [{code,name,status:'received|missing'}]
  docs_missing_count      int NOT NULL DEFAULT 0,
  facts_extracted         jsonb,                                    -- fatos identificados nos docs
  inconsistencies         jsonb,                                    -- inconsistências detectadas
  teses_relacionadas      uuid[],
  decisoes_sugeridas      uuid[],
  -- Nível de prontidão
  readiness_score         numeric(5,2),                             -- 0-100
  readiness_level         text,                                     -- BLOQUEADO | INSUFICIENTE | BOM | OTIMO
  -- Auditoria
  generated_at            timestamptz NOT NULL DEFAULT now(),
  generated_by            uuid REFERENCES users(id)
);
```

---

## 6. Pipeline RAG

### 6.1 Fluxo

```
[Botão "Gerar Minuta" em caso]
   ↓
[Verificar checklist de prontidão]
   ↓
[Se prontidão < BOM]: alertar advogado, oferecer mesmo assim ou aguardar
   ↓
[Coletar contexto]:
  - Dados cliente + caso (P1)
  - Documentos (texto OCR) (P1)
  - Movimentações Projuris (P2)
  - Teses aprovadas relacionadas (P2 — RAG por tipo)
  - Decisões cadastradas relacionadas (P2 — RAG)
  - Peças validadas similares (P3 — RAG)
   ↓
[Build prompt]:
  - System (cached): regras anti-alucinação + estilo + ética
  - Contexto: top-K trechos relevantes + dados estruturados
  - Instrução: "Gere [tipo] para este caso"
   ↓
[Claude Opus 4.7 — geração inicial]
   ↓
[Self-critique pass]:
  - Segundo prompt: "Revise a minuta abaixo. Liste afirmações sem fonte. Liste possíveis alucinações."
   ↓
[Validação automatizada]:
  - Regex: CPF, datas, números processo, valores
  - Cross-check DB: nomes batem? CPF bate? datas consistentes?
  - Trechos sem fonte marcados com [INFERÊNCIA NÃO VERIFICADA]
   ↓
[Build mapa de fontes]:
  - Para cada afirmação, link ao trecho original (tese/decisão/peça/doc)
   ↓
[Salvar em `minutas`]:
  - status = DRAFT
  - watermark "MINUTA — NÃO REVISADA"
   ↓
[Notificar advogado responsável]
```

### 6.2 System prompt (cached, exemplo para INICIAL_FIES)

```
Você é assistente de redação jurídica especializado em FIES (Lei 10.260/2001).
Atua como REDATOR, NÃO como advogado. Sua função é montar minutas tecnicamente corretas
para que o advogado revise.

REGRAS INVIOLÁVEIS:
1. Toda afirmação factual deve ter fonte rastreável (documento, tese, decisão, dados do caso).
2. Marque com [INFERÊNCIA NÃO VERIFICADA] qualquer afirmação sem fonte clara.
3. NUNCA invente dados (nomes, CPFs, datas, valores, processos, jurisprudência).
4. Se faltar dado essencial, escreva [DADO FALTANTE: descrição] em vez de inventar.
5. Use português jurídico claro, sem rebuscamento desnecessário.
6. Siga estrutura padrão: endereçamento, qualificação, fatos, direito, pedidos, documentos.
7. Cite fundamentos legais com artigos exatos. Verifique se a norma citada existe e é vigente.
8. Não dê opinião jurídica subjetiva. Apresente fatos + fundamentação + pedido.

OUTPUT: Markdown estruturado com seções claras.
```

### 6.3 Validação automatizada

```typescript
async function validateMinuta(minuta: Minuta, case_: Case, client: Client) {
  const issues: ValidationIssue[] = []

  // 1. CPF do cliente bate
  const cpfPattern = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g
  const cpfsInText = minuta.content_md.match(cpfPattern) || []
  for (const cpf of cpfsInText) {
    if (cpf !== client.cpf) {
      issues.push({ severity: 'high', message: `CPF ${cpf} encontrado mas cliente é ${client.cpf}` })
    }
  }

  // 2. Nome do cliente bate
  if (!minuta.content_md.includes(client.full_name)) {
    issues.push({ severity: 'high', message: `Nome do cliente "${client.full_name}" não encontrado` })
  }

  // 3. Datas consistentes
  // ... (regras específicas por tipo de peça)

  // 4. Inferências marcadas
  const inferenceCount = (minuta.content_md.match(/\[INFERÊNCIA NÃO VERIFICADA\]/g) || []).length
  if (inferenceCount > 0) {
    issues.push({ severity: 'medium', message: `${inferenceCount} inferências não verificadas` })
  }

  // 5. Dados faltantes marcados
  const missingCount = (minuta.content_md.match(/\[DADO FALTANTE:.+?\]/g) || []).length
  if (missingCount > 0) {
    issues.push({ severity: 'medium', message: `${missingCount} dados faltantes` })
  }

  return issues
}
```

---

## 7. Checklist de prontidão

### 7.1 Algoritmo

Antes de gerar minuta, sistema verifica:

```typescript
async function checkReadiness(caseId: string, tipoPeca: string): Promise<Readiness> {
  const required = await getRequiredDocs(tipoPeca)
  const caseDocs = await getCaseDocs(caseId)
  const missing = required.filter(r => !caseDocs.some(d => d.document_code === r.code && d.status === 'APROVADO'))

  const facts = await extractFacts(caseDocs)
  const inconsistencies = detectInconsistencies(facts)
  const teses = await searchRelatedTeses(caseId, tipoPeca)
  const decisoes = await searchRelatedDecisoes(caseId, tipoPeca)

  let score = 100
  score -= missing.length * 15
  score -= inconsistencies.length * 10

  let level: ReadinessLevel
  if (score >= 90) level = 'OTIMO'
  else if (score >= 70) level = 'BOM'
  else if (score >= 40) level = 'INSUFICIENTE'
  else level = 'BLOQUEADO'

  return { score, level, missing, facts, inconsistencies, teses, decisoes }
}
```

### 7.2 UI Checklist

```
┌──────────────────────────────────────────────────────────────┐
│ Prontidão para Inicial FIES                                  │
│                                                              │
│ Score: 82/100  •  Nível: 🟢 BOM                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ✅ Documentos disponíveis (8/10)                             │
│ ✓ Procuração (DOC-01)                                       │
│ ✓ Contrato de honorários (DOC-02)                           │
│ ✓ CPF (DOC-03)                                              │
│ ✗ DGM (DOC-06)  ← FALTANTE                                  │
│ ✓ CRM (DOC-04)                                              │
│ ✓ CNES (DOC-05)                                             │
│ ...                                                          │
│                                                              │
│ ⚠ Inconsistências detectadas (1)                            │
│ • Período declarado (Mar/2020) diverge do CNES (Abr/2020)   │
│                                                              │
│ 📚 Teses relacionadas (3)                                    │
│ • Tese: FIES abatimento COVID — interpretação extensiva     │
│ • Tese: ESF DGM ausente — alternativa CNES                  │
│ • ...                                                        │
│                                                              │
│ ⚖ Decisões favoráveis (5)                                    │
│ • TRF1 3ª Turma — Acórdão 12345 (favorável)                 │
│ • ...                                                        │
│                                                              │
│ [Gerar Minuta Agora] [Aguardar Docs] [Ignorar Pendências]   │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Banco de peças validadas

### 8.1 Cadastro

- Quando advogado aprova minuta (status APPROVED) e protocola, oferece "Adicionar ao banco de peças validadas?".
- Se sim, copia minuta para `pecas_validadas` com tags do caso.
- Embedding calculado.

### 8.2 Outcome tracking

- Quando caso recebe decisão (deferida/indeferida), atualiza `pecas_validadas.outcome` da peça relacionada.
- Permite filtrar "peças com outcome favorável" no RAG.

### 8.3 Importação inicial

- Hyago/Adavio podem fazer upload de peças históricas do escritório (em PDF/DOCX).
- Sistema extrai texto, sugere tipo, calcula embedding.
- Humano valida.

### 8.4 RAG prioriza peças validadas com outcome favorável

Score de relevância:
```
score_final = score_semântico × 1.0
            + outcome_favoravel ? 0.3 : 0
            + recencia_score
            + tag_match_score
```

---

## 9. Telas

### 9.1 Editor de Minuta

```
┌──────────────────────────────────────────────────────────────┐
│ ← Caso FIES-2026-0042   Inicial FIES Administrativa   v1     │
│ ⚠ MINUTA — NÃO REVISADA                              [Salvar]│
├──────────────────┬───────────────────────────────────────────┤
│                  │                                            │
│ 📚 Fontes (12)   │ [editor rich text com markdown]           │
│ ─────────────    │                                            │
│ 📜 Teses         │ EXMO. SR. SECRETÁRIO DE GESTÃO...        │
│  • FIES abatim.. │                                            │
│  • ESF DGM alt.. │ JOÃO SILVA, brasileiro, casado, médico,  │
│ ⚖ Decisões       │ CRM 12345/AL, inscrito no CPF 123.456...  │
│  • TRF1 3ª T.    │                                            │
│  • STJ Resp 12.. │ DOS FATOS                                  │
│ 📋 Docs caso     │                                            │
│  • CPF.pdf       │ 1. O Requerente é médico atuante na     │
│  • CRM.pdf       │ Estratégia Saúde da Família (ESF) ...   │
│  • Contrato.pdf  │                                            │
│                  │ DO DIREITO                                 │
│ ⚠ Issues (2)     │                                            │
│  • CPF: ok       │ Conforme entendimento desta Casa, o      │
│  • Nome: ok      │ abatimento de 1% mensal previsto no     │
│  • Inferência:1  │ art. 6º-B da Lei 10.260/2001 [Tese 1] │
│  • Faltante: 0   │                                            │
│                  │                                            │
│                  │ DOS PEDIDOS                                │
│                  │                                            │
│                  │ a) [DADO FALTANTE: % solicitado]        │
│                  │                                            │
├──────────────────┴───────────────────────────────────────────┤
│ [Regenerar seção] [Editar] [Aprovar e Marcar Revisada]      │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 Painel "Minutas"

Lista de minutas com filtros: tipo, status, caso, advogado.

### 9.3 Banco de Peças Validadas

Pesquisa + tags + outcomes.

---

## 10. Épicos e Stories

### Épico 1 — Infraestrutura RAG
- **Story 1.1:** Pipeline embedding teses/decisões/peças
- **Story 1.2:** Função SQL search_combined (busca em N tabelas)
- **Story 1.3:** Cache de prompt system

### Épico 2 — Geração de Minuta
- **Story 2.1:** Edge function `/api/ai/peticao/generate`
- **Story 2.2:** Template Inicial FIES
- **Story 2.3:** Self-critique pass
- **Story 2.4:** Validação automatizada
- **Story 2.5:** Mapa de fontes

### Épico 3 — Tipos de Peça (1 story por tipo)
- 3.1 a 3.9 — cada tipo

### Épico 4 — Checklist de Prontidão
- **Story 4.1:** Algoritmo + UI

### Épico 5 — Editor
- **Story 5.1:** Editor rich-text Markdown
- **Story 5.2:** Painel lateral fontes
- **Story 5.3:** Painel issues
- **Story 5.4:** Regeneração de seção

### Épico 6 — Workflow de Aprovação
- **Story 6.1:** DRAFT → UNDER_REVIEW → APPROVED
- **Story 6.2:** Watermark MINUTA NÃO REVISADA
- **Story 6.3:** Export DOCX + PDF

### Épico 7 — Banco de Peças
- **Story 7.1:** CRUD
- **Story 7.2:** Upload + extração inicial
- **Story 7.3:** Outcome tracking

### Épico 8 — Configuração
- **Story 8.1:** Editor de prompt templates
- **Story 8.2:** Configuração de validações

---

## 11. Métricas

- **Tempo médio geração:** < 60s
- **Score validação ≥ 90:** ≥ 80% das minutas geradas
- **Aprovação sem edição:** ≥ 30%
- **Aprovação com edições mínimas (<10% changes):** ≥ 60%
- **Alucinação detectada:** ≤ 2% (correções factuais pelo advogado)
- **Custo médio por minuta:** < $0.50 (Opus + caching)

---

## 12. Critérios de aceitação

- ✅ 9 tipos de peça implementados
- ✅ 100 minutas geradas em produção com validação
- ✅ Banco de peças validadas com ≥ 50 peças aprovadas
- ✅ Métricas em dashboard
- ✅ Treinamento advogados (4h)

---

## 13. Riscos

| # | Risco | Mitigação |
|---|---|---|
| **R3.1** | IA gerar peça com erro factual protocolado | Marcação watermark indelével + revisão obrigatória + validação automatizada |
| **R3.2** | Custo IA escala | Caching agressivo + budget guard |
| **R3.3** | Advogado confia demais na IA | Treinamento + KPI "alucinação detectada" público |
| **R3.4** | Banco de peças com peça ruim | Status APROVADA somente por advogado titular |

---

> **Status:** Aprovado. **Próximo:** PRD Projeto 4 — Comercial/CRM.
> _— @pm + @architect + @qa 🎯_
