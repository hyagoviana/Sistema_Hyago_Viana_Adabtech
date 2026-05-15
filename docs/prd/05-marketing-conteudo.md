# 📣 PRD Projeto 5 — Módulo de Marketing / Conteúdo

> **Plataforma Unificada Hyago Viana Advocacia**
> **Versão:** 1.0 · **Data:** 2026-05-15 · **Owners:** @pm + @architect + @qa · **Orquestração:** Orion
> **Status:** Aprovado para épicos/stories
>
> Consome: PRD Master + 0 + 1 + 2 + 4.

> ⚠ **Alinhamento com estratégia design-first (v1.1):**
> Quando este PRD entrar em execução (Fase **F8** do roadmap, paralelo com Projeto 4), as telas de Marketing (Calendário Editorial, Editor multi-tab de conteúdo, Banco de Mídia, Brand Guidelines) **JÁ ESTARÃO IMPLEMENTADAS** com fixtures. Este PRD foca em: schema, engine de sugestões IA (cron noturno consumindo Projetos 2 e 4), geradores Claude (Reels/Podcast/Copy), checker OAB compliance, integrações de plataformas externas (HeyGen, ElevenLabs). **UI pronta — foco é IA + workflow.**

---

## Sumário
1. [Visão](#1-visão)
2. [Personas](#2-personas)
3. [Escopo](#3-escopo)
4. [Frentes editoriais](#4-frentes-editoriais)
5. [Schema](#5-schema)
6. [Pipeline editorial](#6-pipeline-editorial)
7. [Geradores IA](#7-geradores-ia)
8. [Calendário editorial inteligente](#8-calendário-editorial-inteligente)
9. [Banco de mídia](#9-banco-de-mídia)
10. [Compliance OAB](#10-compliance-oab)
11. [Telas](#11-telas)
12. [Épicos e Stories](#12-épicos-e-stories)
13. [Métricas](#13-métricas)
14. [Critérios de aceitação](#14-critérios-de-aceitação)
15. [Riscos](#15-riscos)

---

## 1. Visão

> **"Produção interna de conteúdo do escritório com pipeline assistido por IA — pesquisa, roteirização, copy, compliance OAB e aprovação humana."**

Foco principal:
- Reels/Shorts (Instagram, TikTok)
- Podcast (roteiros + perguntas-guia)
- Posts (legendas, copy)
- E-mail marketing (templates integrados com Projeto 4)

Frentes temáticas:
- Mais Médicos
- INSS / Previdenciário
- Residência Médica
- ANMR (associação)
- AMPB (associação)
- FIES
- Defesa ético-disciplinar

---

## 2. Personas

| Persona | Responsabilidades |
|---|---|
| **Marketing (interno ou freelancer)** | Briefing, revisão, publicação |
| **Advogados (consultor)** | Aprovar conteúdo técnico-jurídico |
| **Designer (parceiro)** | Produzir mídia visual a partir de briefings |
| **Admin** | Aprovação final, compliance OAB |

---

## 3. Escopo

### Em escopo
- ✅ Geração de roteiros Reels/Shorts (briefing, cenas, fala, duração, elementos visuais)
- ✅ Geração de roteiros de podcast (abertura, blocos, encerramento, perguntas, fontes)
- ✅ Geração de copy (posts, legendas, e-mails)
- ✅ Calendário editorial gerado por IA a partir de:
  - Movimentações jurídicas (Projeto 2)
  - Oportunidades comerciais (Projeto 4)
  - Datas relevantes (calendário OAB, datas comemorativas)
- ✅ Banco de mídia (assets + metadados + busca)
- ✅ Pipeline com aprovações (revisão IA → revisão humana → aprovação)
- ✅ Compliance OAB: revisão automatizada de ética publicitária
- ✅ Integração com plataformas externas (HeyGen para vídeos AI, ElevenLabs para voz, Canva via link)

### Fora de escopo
- ❌ Publicação automática em redes sociais (V2) — V1 apenas gera e exporta
- ❌ Edição de vídeo dentro do app

---

## 4. Frentes editoriais

| Frente | Persona-alvo | Tom |
|---|---|---|
| **Mais Médicos** | Médicos do programa | Informativo, encorajador |
| **INSS / Previdenciário** | Aposentados, segurados | Empático, claro |
| **Residência Médica** | Residentes | Direto, técnico |
| **ANMR** | Associados | Institucional |
| **AMPB** | Associados | Institucional |
| **FIES** | Médicos com dívida FIES | Esperançoso, factual |
| **Defesa CFM/CRM** | Médicos sob processo ético | Sério, garantista |

---

## 5. Schema

### 5.1 Tabela `content_calendar_items`

```sql
CREATE TABLE content_calendar_items (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             uuid NOT NULL REFERENCES organizations(id),
  -- Identificação
  title                       text NOT NULL,
  content_type                text NOT NULL,                            -- REEL | SHORT | PODCAST | POST_FEED | STORY | EMAIL | ARTICLE
  channel                     text NOT NULL,                            -- INSTAGRAM | TIKTOK | YOUTUBE | LINKEDIN | EMAIL_LIST | SITE
  frente                      text NOT NULL,                            -- MAIS_MEDICOS | INSS | RESIDENCIA | ANMR | AMPB | FIES | DEFESA_CFM
  -- Origem
  origin                      text NOT NULL DEFAULT 'MANUAL',           -- AI_SUGGESTED | MANUAL | TRIGGERED_BY_EVENT
  origin_trigger              jsonb,                                    -- {type:'projuris_decision', id:..., reason:'decisão favorável marco'}
  -- Datas
  planned_publish_at          timestamptz,
  published_at                timestamptz,
  -- Workflow
  stage                       text NOT NULL DEFAULT 'IDEIA',            -- IDEIA | BRIEFING | REDACAO | REVISAO | APROVADO | PUBLICADO | ARQUIVADO
  assigned_to_id              uuid REFERENCES users(id),
  approved_by_id              uuid REFERENCES users(id),
  -- Compliance
  compliance_score            int,                                      -- 0-100
  compliance_issues           jsonb,
  compliance_status           text,                                     -- PENDING | APPROVED | NEEDS_REVISION | REJECTED
  -- Conteúdo
  draft_id                    uuid REFERENCES content_drafts(id),
  -- Auditoria
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cal_planned ON content_calendar_items(planned_publish_at) WHERE stage NOT IN ('PUBLICADO', 'ARQUIVADO');
CREATE INDEX idx_cal_stage ON content_calendar_items(stage);
```

### 5.2 Tabela `content_drafts`

```sql
CREATE TABLE content_drafts (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  calendar_item_id    uuid REFERENCES content_calendar_items(id),
  -- Versionamento
  version             int NOT NULL DEFAULT 1,
  -- Conteúdo
  briefing            text,
  script_md           text,                                       -- roteiro completo
  copy_main           text,                                       -- legenda/copy principal
  copy_alt            text[],                                     -- variações
  cta                 text,
  hashtags            text[],
  -- Roteiro estruturado (para vídeo/podcast)
  structured          jsonb,                                      -- {scenes:[{duration,visual,voice,text}]}
  -- Generation
  ai_model            text,
  ai_tokens           int,
  ai_cost_usd         numeric(10,4),
  generation_input    jsonb,
  -- Status
  status              text NOT NULL DEFAULT 'DRAFT',              -- DRAFT | REVIEWED | APPROVED | REJECTED
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

### 5.3 Tabela `media_assets`

```sql
CREATE TABLE media_assets (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  title               text NOT NULL,
  description         text,
  asset_type          text NOT NULL,                              -- IMAGE | VIDEO | AUDIO | FILE | TEMPLATE
  storage_path        text NOT NULL,
  thumbnail_path      text,
  mime_type           text,
  size_bytes          bigint,
  duration_seconds    int,                                        -- para vídeo/áudio
  dimensions          jsonb,                                      -- {width, height}
  tags                text[],
  frente              text,
  used_in_items       uuid[],                                     -- referência reversa
  metadata            jsonb,
  uploaded_by         uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_type ON media_assets(asset_type, frente);
CREATE INDEX idx_media_tags ON media_assets USING gin(tags);
```

### 5.4 Tabela `marketing_briefings_templates`

```sql
CREATE TABLE marketing_briefings_templates (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         uuid NOT NULL REFERENCES organizations(id),
  content_type            text NOT NULL,                          -- REEL, PODCAST, ...
  name                    text NOT NULL,
  prompt_template         text NOT NULL,                          -- prompt cached
  expected_output_schema  jsonb,
  generation_config       jsonb,
  is_active               boolean NOT NULL DEFAULT true
);
```

### 5.5 Tabela `brand_guidelines`

```sql
CREATE TABLE brand_guidelines (
  organization_id     uuid PRIMARY KEY REFERENCES organizations(id),
  voice_tone          text,                                       -- prosa explicando tom de marca
  do_use              text[],                                     -- "fale 'caso' não 'processo'"
  do_not_use          text[],                                     -- "evite 'sucesso garantido'"
  visual_guidelines   jsonb,                                      -- cores, tipografia, exemplos
  oab_compliance_rules text,                                      -- regras éticas específicas
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

---

## 6. Pipeline editorial

### 6.1 Fluxo

```
IDEIA (calendário sugere ou usuário cria)
   ↓ Briefing escrito (IA assiste)
BRIEFING
   ↓ Geração inicial IA
REDACAO
   ↓ Marketing revisa (edita, refina)
REVISAO
   ↓ Advogado aprova (se conteúdo técnico-jurídico)
   ↓ Compliance OAB check (automático)
APROVADO
   ↓ Marketing publica (manual em V1; automático em V2)
PUBLICADO
```

### 6.2 Tarefas automáticas por estágio

- IDEIA → tarefa "Escrever briefing" (Marketing)
- BRIEFING → tarefa "Gerar conteúdo IA" (Marketing)
- REDACAO → tarefa "Revisar" (Marketing)
- REVISAO + jurídico → tarefa "Aprovar conteúdo técnico" (Advogado)
- APROVADO → tarefa "Publicar nas redes" (Marketing)

---

## 7. Geradores IA

### 7.1 Gerador de Reel/Short

**Input:**
- Frente temática
- Tema específico (ex: "novidade FIES após decisão TRF1")
- Duração desejada (15s, 30s, 60s)
- Tom (informativo, urgência, esperança)
- Referência (links de notícias, decisão cadastrada)

**Output (JSON estruturado):**
```json
{
  "title": "FIES: novidade que pode te ajudar",
  "duration_seconds": 30,
  "scenes": [
    { "duration": 4, "visual": "close no celular mostrando boleto FIES", "voice": "Você tem dívida do FIES?", "text_overlay": "FIES + R$ 0" },
    { "duration": 8, "visual": "decisão TRF1 em destaque", "voice": "TRF1 acaba de confirmar...", "text_overlay": "TRF1 confirma!" },
    ...
  ],
  "cta": "Quer saber se você tem direito? Toque no link.",
  "captions_main": "🔥 Decisão histórica do TRF1 ...",
  "hashtags": ["#FIES", "#MaisMedicos", "#MédicosDeAL"]
}
```

### 7.2 Gerador de Podcast

**Input:**
- Tema
- Convidado (opcional)
- Duração alvo
- Frente

**Output:**
```json
{
  "title": "Tudo sobre FIES e Mais Médicos — ep 12",
  "duration_minutes": 40,
  "structure": [
    { "block": "ABERTURA", "duration_minutes": 2, "text": "Olá pessoal..." },
    { "block": "BLOCO 1", "duration_minutes": 12, "text": "...", "questions": ["..."] },
    { "block": "BLOCO 2", "duration_minutes": 12, "text": "..." },
    { "block": "BLOCO 3", "duration_minutes": 10, "text": "..." },
    { "block": "ENCERRAMENTO", "duration_minutes": 4, "text": "..." }
  ],
  "sources": [ "Tese FIES Abatimento", "Decisão TRF1 12345" ]
}
```

### 7.3 Gerador de Copy

**Input:**
- Tipo (post feed, story, e-mail)
- Frente
- Briefing curto

**Output:**
- Copy principal + 2 variações
- Hashtags
- CTA

---

## 8. Calendário editorial inteligente

### 8.1 Engine de sugestões

```typescript
async function suggestContent() {
  const suggestions: ContentSuggestion[] = []

  // 1. Decisões favoráveis recentes
  const decisoes = await getRecentFavorableDecisions(30) // últimos 30d
  for (const d of decisoes) {
    suggestions.push({
      title: `Conteúdo sobre decisão ${d.tribunal} (${d.numero_processo})`,
      content_type: 'REEL',
      frente: inferFrenteFromDecision(d),
      origin: 'AI_SUGGESTED',
      origin_trigger: { type: 'projuris_decision', id: d.id }
    })
  }

  // 2. Datas comemorativas
  const dates = getDatesNext30Days() // Dia do Médico, etc.
  for (const date of dates) {
    suggestions.push({ ... })
  }

  // 3. Oportunidades de cross-sell altas
  const opps = await getHighScoreCrossSellOpps()
  // sugere conteúdo educativo sobre o tema da oportunidade

  return suggestions
}
```

### 8.2 Cron diário 6h

Roda engine → cria items em `IDEIA` com `origin = AI_SUGGESTED` → notifica Marketing.

### 8.3 Aprovação humana

Marketing decide: produzir / arquivar / editar briefing.

---

## 9. Banco de mídia

### 9.1 Upload
- Drag-drop arquivos
- Tagging manual ou IA (Vision API descreve imagem)
- Vincular a frente temática

### 9.2 Busca
- Por tags, frente, tipo, duração
- Full-text na descrição

### 9.3 Reuso
- Marca quais content_items já usaram cada asset
- Evita repetição

---

## 10. Compliance OAB

### 10.1 Regras vedadas (CED OAB + Provimento 205)

- ❌ Captação de clientela
- ❌ Promessa de resultado
- ❌ Comparação com outros advogados/escritórios
- ❌ Anúncios sensacionalistas
- ❌ Uso de termos "advocacia de massa", "advogado mais rápido", etc.

### 10.2 Checker automático

**Pipeline:**

```
Conteúdo gerado
   ↓
Claude Haiku com prompt cached específico OAB
   ↓
Output: { score (0-100), issues:[{rule, severity, suggestion}] }
   ↓
Se score < 70 ou issues HIGH/CRITICAL: bloqueia aprovação até revisão JUR
```

### 10.3 Audit trail

- Todo conteúdo publicado armazena `compliance_score` e `compliance_status`
- Em caso de questionamento OAB, histórico recuperável

---

## 11. Telas

### 11.1 Calendário Editorial

```
┌──────────────────────────────────────────────────────────────┐
│ Calendário Editorial · Maio 2026                              │
│ [+ Nova ideia] [Sugerir conteúdo IA]                         │
├──────────────────────────────────────────────────────────────┤
│         Seg   Ter   Qua   Qui   Sex   Sáb   Dom               │
│   1     [F]   [F]   [F]   [I]   [P]   [F]   [F]               │
│   2     [F]                                                    │
│  ...                                                           │
│                                                                │
│ Legenda: [F]eed [P]odcast [R]eel [I]de [E]mail               │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 Editor de Conteúdo

```
┌──────────────────────────────────────────────────────────────┐
│ ← Reel: "FIES — TRF1 decide" (v2)                            │
│ Stage: REVISAO  •  Frente: FIES  •  Publica: 20/05 19h        │
├──────────────────────────────────────────────────────────────┤
│ [Briefing] [Roteiro] [Copy] [Hashtags] [Mídia] [Compliance]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Roteiro (30s):                                                │
│ ┌─ Cena 1 (4s) ─────────────────────────────────────────────│
│ │ Visual: close celular mostrando boleto FIES                │
│ │ Voz: "Você tem dívida do FIES?"                            │
│ │ Texto: "FIES + R$ 0"                                       │
│ │ [Regenerar cena] [Editar]                                  │
│ └────────────────────────────────────────────────────────────│
│ ...                                                          │
│                                                              │
│ Compliance Check: 🟢 92/100  •  Sem issues críticas         │
│ [Aprovar] [Pedir revisão JUR] [Editar]                      │
└──────────────────────────────────────────────────────────────┘
```

### 11.3 Banco de Mídia

Grid com filtros.

---

## 12. Épicos e Stories

### Épico 1 — Calendário Editorial
- Story 1.1: Tela calendário (mês/semana/lista)
- Story 1.2: CRUD items
- Story 1.3: Engine de sugestões diário
- Story 1.4: Notificação Marketing

### Épico 2 — Geradores IA
- Story 2.1: Gerador Reel/Short
- Story 2.2: Gerador Podcast
- Story 2.3: Gerador Copy
- Story 2.4: Editor de prompt templates

### Épico 3 — Pipeline e Revisão
- Story 3.1: State machine items
- Story 3.2: Editor multi-tab
- Story 3.3: Tarefas automáticas

### Épico 4 — Banco de Mídia
- Story 4.1: Upload + storage
- Story 4.2: Tagging + busca
- Story 4.3: Tagging assistido IA (Vision)

### Épico 5 — Compliance OAB
- Story 5.1: Checker Claude Haiku
- Story 5.2: Prompt OAB cached
- Story 5.3: UI de issues
- Story 5.4: Bloqueio de aprovação

### Épico 6 — Brand Guidelines
- Story 6.1: CRUD guidelines
- Story 6.2: Injetar no prompt de geração

### Épico 7 — Integrações Externas (V2)
- HeyGen (vídeo)
- ElevenLabs (voz)
- Canva (link)
- Publicação direta Instagram/TikTok

---

## 13. Métricas

- Conteúdos publicados / mês: ≥ 20
- Tempo médio IDEIA → PUBLICADO: ≤ 7 dias
- Score compliance médio: ≥ 85
- Conteúdos com revisão jurídica: 100% dos técnico-jurídicos
- ROI de conteúdo: leads gerados via campanhas que linkam ao conteúdo

---

## 14. Critérios de aceitação

- ✅ Calendário em produção com 30+ items planejados
- ✅ 3 geradores IA funcionais (Reel/Podcast/Copy)
- ✅ Banco de mídia com 100+ assets organizados
- ✅ Compliance OAB checker em 100% dos conteúdos
- ✅ Brand guidelines preenchidos
- ✅ Pipeline operando E2E (IDEIA → PUBLICADO) em 10+ items
- ✅ Treinamento equipe marketing (2h)

---

## 15. Riscos

| # | Risco | Mitigação |
|---|---|---|
| **R5.1** | Sanção OAB por publicação inadequada | Compliance checker obrigatório + JUR aprova técnico |
| **R5.2** | Conteúdo IA genérico/repetitivo | Brand guidelines fortes + revisão Marketing |
| **R5.3** | Custo IA escala | Caching de prompts + uso parcimonioso Sonnet |
| **R5.4** | Falta capacidade interna de produção visual | Parcerias externas (designer freelancer) |

---

> **Status:** Aprovado. **Próximo:** Consolidação final e índice de PRDs.
> _— @pm + @architect + @qa 🎯_
