# 🏁 Sprints de Fechamento — Projetos 1 e 2 (v1.1)

> **Autoria:** @pm John · **Validação:** @architect Winston + @qa Quinn · **Orquestração:** Orion (aios-master)
> **Data:** 2026-06-08 · **Status:** ✅ **APROVADO COM RESSALVAS** (v1.1 incorpora os BLOCKERs das duas revisões)
> **Base:** ata `reuniao-cliente-2026-06-05-virada-arquitetural.md` + `docs/levantamento-entrega-projetos-1-2.md` + Sprint 12 (em curso) + PRD 1 §9–11.
> Reviews completos: [`_review-architect.md`](./_review-architect.md) · [`_review-qa.md`](./_review-qa.md)

---

## 0. Vereditos da validação

| Validador | Veredito | Convergência |
|---|---|---|
| **@architect** | APROVADO COM RESSALVAS | 5 BLOCKERs + 6 ADRs + quebrar S17 |
| **@qa** | APROVADO COM RESSALVAS | 9 gaps (G-01..G-09) + 7 casos P0 no DoD |

**Os dois bateram nos mesmos pontos** (bifurcação por string, numeração concorrente, idempotência do webhook, dupla bifurcação, imutabilidade do Termo, segregação, baseline de regressão) — tratados como **condição de entrada** das sprints afetadas.

---

## 1. BLOCKERs incorporados (condição para codar)

| # | Achado | Correção | Entra em |
|---|---|---|---|
| B1 | Trigger de bifurcação compara strings de enum | `stage_id` vira fonte da verdade; `macrostatus_*` = projeção; gatilho desacoplado de strings | S13 (ADR-1) |
| B2 | Etapas dinâmicas sem marcador semântico | `system_pipeline_stages.stage_role` (`normal\|won\|lost\|closed`) ou `triggers_financeiro bool` | S13 (ADR-2) |
| B3 | `document_number` race condition | `pg_advisory_xact_lock(hashtext(case_id))` + `UNIQUE(case_id, document_number)` | **S12** |
| B4 | Idempotência do webhook (ADR-005) nunca migrada | criar `webhook_dedupe` (`UNIQUE(provider, external_id)`) antes de plugar o handler | **S12** |
| B5 | Dupla bifurcação (trigger + botão) | função única idempotente `fn_bifurcar_para_financeiro(case_id)` (no-op se já bifurcado); flag só escolhe o gatilho | S16 (ADR-3) |
| B6 | Imutabilidade do Termo só via RLS (service_role bypassa) | trigger `prevent_termo_mutation_after_approval()` + trava de quem seta `conferidor_id` | S17a/b (ADR-5) |
| B7 | Migração sem baseline de regressão / sem critério | baseline pré-migração + 0 órfãos + 100% enums mapeados + idempotência + rollback testado em staging | S13 |

## 2. ADRs obrigatórios antes de codar

1. **ADR-007** — Fonte da verdade no dual-write (`stage_id` canônico) — *pré-S13, bloqueante*
2. **ADR-008** — Marcador semântico de etapa (`stage_role`) — *pré-S13, bloqueante*
3. **ADR-009** — Bifurcação: trigger vs botão vs ambos (função única idempotente) — *pré-S16*
4. **ADR-010** — Modelo do "acerto parcial" (coluna vs tabela) — *pré-S16*
5. **ADR-011** — Imutabilidade + segregação do Termo — *pré-S17*
6. **ADR-005 (atualizar)** — Idempotência ZapSign efetivamente migrada — *pré-S12*

---

## 3. Sequência de sprints (v1.1)

```
S12 (docs/ZapSign) ── paralelo, serializar migrations c/ S13
      │
      ▼
S13 (Fase A — espinha) ──DESTRAVA──► S14 (Fase B — pipeline op dinâmica)
      │                                      │
      └──────────► S15 (cliente manual + n8n + drop) ──── FIM P1
                                             │
                                             ▼ (reusa mecânica B, kind='fin')
                   S16 (pipeline fin + bifurcação botão + acerto parcial)
                                             │
                                             ▼
                   S17a (calculadora + snapshot imutável + PDF/hash)
                                             │
                                             ▼
                   S17b (conferência segregada + aprovação híbrida + supersedes)
                                             │
                                             ▼
                   S18 (parcelas + cobrança Conta Azul/Asaas via n8n) ── FIM P2
```

### 🖋️ S12 — Finalização Documentos + ZapSign  *(em curso — P1)*
**Objetivo:** jornada *gerar → editar (embutido) → finalizar PDF/DOCX → ZapSign → assinado na pasta do caso*.

| ID | Título | Agente | Est. |
|---|---|---|---|
| S12-1 | `case-documents-service` (banco↔motores) + pasta Drive do caso ao gerar | @dev | M |
| S12-2 | Pasta do caso no Drive ao **criar caso** (idempotente) | @dev | P |
| S12-3 | `system_document_templates` + CRUD admin de modelos | @data-engineer + @dev | M |
| S12-4 | Aba "Documentos" no caso + editor embutido (+ **nova aba como caminho primário**, B/R2) + ações | @dev + @ux | G |
| S12-5 | Publicar webhook (Vercel) **+ `webhook_dedupe`** (B4) idempotente | @devops + @dev | M |
| **S12-6** | **Corrigir numeração concorrente** (B3) — advisory lock + UNIQUE | @data-engineer | P |
| S12-7 | QA e2e docs + **PDF assinado = original por hash** (G-07) + race webhook (P1.8) + obrigatório vazio bloqueia (G-08) | @qa | M |

### 🦴 S13 — Fase A: Nova espinha *(P1 — prioridade máxima, maior risco)*
**Objetivo:** trocar `case_type`/`macrostatus_*` fixos por entidades configuráveis, com **dual-write reversível**. Só banco + migração.

| ID | Título | Agente | Est. |
|---|---|---|---|
| S13-0 | **ADR-007 + ADR-008** (fonte da verdade + `stage_role`) | @architect | P |
| S13-1 | `system_service_types` (+ seed dos 6 tipos atuais) | @data-engineer | M |
| S13-2 | `system_pipeline_stages` (op+fin, **`stage_role`** B2) + seed dos 10 MACRO_OP / 12 MACRO_FIN | @data-engineer | M |
| S13-3 | FKs `service_type_id`+`stage_id` em `system_cases` (**dual-write**, B1) + bifurcação desacoplada de strings | @data-engineer | M |
| S13-4 | Migração casos de teste (de-para **versionada**, R7) — 0 órfãos, idempotente | @data-engineer + @dev | M |
| S13-5 | QA: **baseline de regressão** (B7/G-01) + integridade (G-02) + **rollback testado em staging** | @qa | M |

### 🟦 S14 — Fase B: Pipeline operacional dinâmica *(P1)*
| ID | Título | Agente | Est. |
|---|---|---|---|
| S14-1 | Tela de seleção de Tipo de Serviço (cards de `system_service_types`) | @dev + @ux | M |
| S14-2 | Kanban com colunas dinâmicas (`pipeline_stages` kind='op'; reusa `KanbanBoard`) | @dev | M |
| S14-3 | Editor de etapas (admin/dono) — **não remover/renomear etapa `stage_role` sem reatribuir** | @dev + @ux | G |
| S14-4 | Costura docs ↔ `service_type_id` (`templates.case_type` → FK) | @data-engineer + @dev | P |
| S14-5 | QA: paridade c/ Kanban atual + tipo sem etapas não quebra + RBAC edição | @qa | M |

### 🟢 S15 — Cliente manual + n8n + drop hardcoded *(fecha P1)*
| ID | Título | Agente | Est. |
|---|---|---|---|
| S15-1 | Cliente manual desacoplado do ZapSign + campos do painel | @dev + @ux | M |
| S15-2 | n8n e-mail → secundário + **fix bug `org_id`** | @devops | M |
| S15-3 | **DROP** colunas hardcoded — migration separada, **gated** (R6): `stage_id IS NULL`=0 + grep | @data-engineer + @dev | P |
| S15-4 | QA fecha P1: E2E completo + DoD P1 (§6) + rollback do drop documentado | @qa | M |

### 💰 S16 — Financeiro: pipeline fin + bifurcação botão + acerto parcial *(abre P2)*
| ID | Título | Agente | Est. |
|---|---|---|---|
| S16-0 | **ADR-009 + ADR-010** (bifurcação idempotente + modelo acerto parcial) | @architect | P |
| S16-1 | Pipeline financeira dinâmica (`pipeline_stages` kind='fin') | @dev | M |
| S16-2 | Bifurcação por **botão** via `fn_bifurcar_para_financeiro` **idempotente** (B5) | @dev + @data-engineer | M |
| S16-3 | Marcação "acerto parcial/judicial" (coluna **ou tabela** conf. ADR-010) + badge | @dev + @ux | M |
| S16-4 | QA: dupla bifurcação idempotente (G-04) + badge persiste + RBAC fin | @qa | M |

### 🧮 S17a — Termo: calculadora + snapshot imutável + PDF *(P2)*
| ID | Título | Agente | Est. |
|---|---|---|---|
| S17a-0 | **ADR-011** (imutabilidade + segregação) | @architect | P |
| S17a-1 | Calculadora §9.2 — **server-side em centavos (inteiros)**, truncamento, 3 cenários FIES, PARCIAL/COMPLEMENTAR | @dev | G |
| S17a-2 | Snapshot v1 (RASCUNHO) + **trigger anti-mutation** (B6/G-05) + PDF (reusa motor Docs) + SHA-256 | @dev + @data-engineer | M |
| S17a-3 | QA: imutabilidade via service_role → exceção + cálculo bordas (P1.9) + 30 casos reais | @qa | M |

### 🧮 S17b — Termo: conferência segregada + aprovação híbrida *(P2)*
| ID | Título | Agente | Est. |
|---|---|---|---|
| S17b-1 | Conferência segregada — trava de quem seta `conferidor_id` (B6/R4/G-06) | @data-engineer + @dev | M |
| S17b-2 | Aprovação híbrida (7 critérios PRD §11.1; auto <1min / manual) + supersedes v2 | @dev | M |
| S17b-3 | QA: 1 teste negativo por critério + segregação negativa + SLA fila aprovação | @qa | M |

### 💳 S18 — Parcelas + cobrança *(fecha P2)*
| ID | Título | Agente | Est. |
|---|---|---|---|
| S18-1 | Geração de parcelas do Termo aceito (`system_*_installments` + RLS) | @data-engineer + @dev | M |
| S18-2 | Cobrança via n8n (Conta Azul/Asaas) — adapter + **fallback manual** + idempotência (reusa B4) | @devops + @dev | G |
| S18-3 | Retorno de status → pipeline fin + badge inadimplência | @devops + @dev | M |
| S18-4 | QA fecha P2: E2E cobrança + DoD P2 (§6) + LGPD/auditoria smoke | @qa | M |

---

## 4. Tabela-resumo

| Sprint | Objetivo | Projeto | Agentes | Depende de |
|---|---|---|---|---|
| S12 | Documentos + ZapSign (wiring + webhook + numeração) | P1 | dev, data, ux, devops, qa | DOC-1 ✅, OAuth2 |
| S13 | Fase A — espinha (dual-write) | P1 | architect, data, dev, qa | — (máx. prioridade) |
| S14 | Fase B — pipeline op dinâmica | P1 | dev, ux, data, qa | **S13** |
| S15 | Cliente manual + n8n + drop → **fecha P1** | P1 | dev, ux, devops, data, qa | S13, S14 |
| S16 | Financeiro: pipeline fin + bifurcação botão + acerto parcial | P2 | architect, dev, data, ux, qa | **S14** |
| S17a | Termo: calculadora + snapshot imutável + PDF | P2 | architect, dev, data, qa | **S16** |
| S17b | Termo: conferência segregada + aprovação híbrida | P2 | data, dev, qa | S17a |
| S18 | Parcelas + cobrança n8n → **fecha P2** | P2 | data, dev, devops, qa | S17b |

---

## 5. Pré-requisitos do cliente (bloqueiam stories)

| # | Pendência | Bloqueia | Dono |
|---|---|---|---|
| 1 | OAuth2 conta-sistema Google | S12-4 | ✅ resolvido 2026-06-08 |
| 2 | ZapSign API produção + webhook secret | S12-5 | Hyago |
| 3 | Modelos de documento por tipo | S12-3/4 | Patrícia + equipe |
| 4 | Etapas de cada Tipo de Serviço (COVID complexo) | S13-2/S14-3 | Hyago/Patrícia |
| 5 | Campos do painel do cliente | S15-1 | Patrícia |
| 6 | Matriz RBAC (dono do processo) | S14-3/S16/S17 | Hyago |
| 7 | Bifurcação: botão/automática/ambas | S16 (ADR-009) | Hyago |
| 8 | Formato "acerto parcial" (tem histórico?) | S16 (ADR-010) | Hyago/Patrícia |
| 9 | Parâmetros do Termo (% / faixa auto / parcela) + 30 casos | S17a/b | Hyago |
| 10 | Provider de cobrança (Conta Azul ou Asaas) + credenciais | S18 | Hyago |

---

## 6. Definição de "Pronto"

### Projeto 1
- [ ] Admin cria/edita Tipos de Serviço e etapas (op) sem código
- [ ] Pipeline op abre por Tipo de Serviço, colunas dinâmicas, drag-drop persiste
- [ ] Cliente manual; caso vinculado a cliente+tipo; pasta Drive criada
- [ ] Documento gerado (auto-preenchido), editado, DOCX/PDF, numerado, vinculado
- [ ] ZapSign: "Enviar" → assinatura → PDF original na pasta do caso
- [ ] Casos de teste migrados sem perda; colunas hardcoded removidas

### Projeto 2
- [ ] Pipeline financeira dinâmica + bifurcação por botão
- [ ] Marcação "acerto parcial/judicial" acompanha o caso e é visível
- [ ] Termo: cálculo §9.2 + conferência segregada + aprovação híbrida + PDF imutável c/ hash
- [ ] Parcelas + cobrança via n8n + status na pipeline

### 🔴 Casos P0 anexados ao DoD (QA — bloqueiam release)
1. Regressão pós-migração idêntica · 2. Integridade migração (0 órfãos, idempotente) · 3. Imutabilidade Termo via service_role → exceção · 4. Segregação elaborador≠conferidor (negativo) · 5. PDF assinado = original por hash · 6. Numeração concorrente (5 paralelos únicos) · 7. Dupla bifurcação idempotente (1 evento/1 Termo)

### Transversais (QA): LGPD (docs/templates/Termo em retenção+export), auditoria exaustiva dos novos módulos, RBAC como AC de RLS.

---

## 7. Ordem de execução + gate de aprovação

1. **S12** já pode rodar (motores prontos; falta wiring) — começa assim que aprovado.
2. **Antes de S13:** fechar **ADR-007 + ADR-008** (fonte da verdade + `stage_role`).
3. **Antes de S16:** ADR-009 + ADR-010. **Antes de S17:** ADR-011.
4. Cada sprint: SM materializa stories no formato do S12 → Dev → QA (gate) → commit.

> **Aguardando aprovação do owner para iniciar a execução (começando por S12).**
