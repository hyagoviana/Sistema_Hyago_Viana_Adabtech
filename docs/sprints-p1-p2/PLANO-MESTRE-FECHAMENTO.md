# PLANO-MESTRE DE FECHAMENTO — Projetos 1 e 2

> **Autoria:** @pm John · **Validação:** @architect Winston + @qa Quinn (ambos APROVADO COM RESSALVAS) · **Orquestração:** Orion (aios-master) · **Data:** 2026-06-10 · **Versão:** v1.1 (incorpora os achados da validação) · **Status:** PROPOSTA (aguarda aprovação do owner)
>
> **🔴 Achados críticos da validação incorporados nesta v1.1:**
> - **S26 re-escopada** — o drop de `macrostatus_*` NÃO é só migration: a coluna é lida/escrita em **63 ocorrências / 18 arquivos** e o trigger de projeção `system_fn_sync_stage_ids` deriva `stage_id` **a partir de** `macrostatus` (a fonte da verdade real ainda é `macrostatus`, ao contrário da intenção do ADR-007). Split em **S26a (refatorar app + inverter projeção) + S26b (drop gated)**.
> - **Portal (S23) exige fundação de auth de cliente** — hoje não há login de cliente nem RLS por `client_id` (RLS de `system_parcelas` é só org-scoped). Sem **ADR-020**, o portal vazaria parcelas de todos os clientes. S23 depende do ADR-020.
> - **Harness de teste de RPC promovido para S20-0** (antes era S25-1) — S21/S22/S23 criam RPCs que precisam dele para testar 403/424; hoje não há nenhum teste em `src/rpc/*`.
> - **Baseline pré-migração (S26-0)** + **regressão integral pós-cutover/deploy (S29)** + critérios de "Entregue" verificáveis adicionados.
> **Base:** estado real verificado nesta sessão + Sprint S19 (`sprint-19-entrada-financeiro.md`, aprovada) + ADR-012..016 (`_adrs/`) + README/levantamento das sprints S12–S18.
> **Última migration aplicada:** `20260609000001_pipelines_por_tipo.sql`. **Próxima (S19):** `20260610000001_entrada_financeiro.sql`. Migrations novas seguem numeração de data a partir daí.
> **Convenção DB:** prefixo `system_*`. **Restrição transversal:** tudo que não depende de n8n é feito aqui (Supabase + `src/rpc` + frontend); cobrança externa (n8n) fica em **Fase Futura**.

---

## 1. Visão geral

O sistema está **funcionalmente em produção** (P1 operacional em dual-write; P2 com miolo Termo→parcelas→bifurcação pronto), mas **nenhum dos dois projetos está formalmente "entregue"**. O fechamento se divide em **duas trilhas paralelizáveis**: a **Trilha P2 (financeiro)** — completar as pontas que o cliente usa no dia a dia (entrada manual, dashboard, baixa de parcela, refinos do Termo, portal de boletos, QA) — e a **Trilha P1 (entrega/operação)** — fechar a dívida do dual-write, migrar os ~2500 casos reais, configurar produção e validar com o owner (RBAC + LGPD). As trilhas só convergem no **gate final (S29)**. A cobrança externa via n8n fica **fora deste plano**, com a **baixa manual (S22)** como substituto provisório.

### Ordem das sprints (S19 já existe; novas a partir de S20)

```
TRILHA P2 (financeiro) — código puro, pode começar já
  S19   Entrada no Financeiro (botão Duplicar/Somente-fin + desliga trigger) ── JÁ APROVADA
   │
  S20-0 Harness de RPC autenticada (infra de teste — PRÉ-REQUISITO de S21/22/23)
   │
   ├─ S20  Refinos do Termo (7 critérios auto + COMPLEMENTAR/À VISTA + RECUSADO)
   ├─ S21  Dashboard Financeiro (recebimentos/projeções/inadimplência por parcela)
   └─ S22  Baixa manual de parcela (marcar como paga)   ← substituto provisório da cobrança n8n
            │
            ├─ S23  Portal de Boletos do cliente  (depende de ADR-020: auth de cliente + RLS client_id)
            └─ S24  Calibração do Termo com 30 casos reais (depende de S20)  [PRÉ-REQ owner]
                     │
                     S25  Suíte de QA P2 (consolida P0)   ← gate de release P2

TRILHA P1 (entrega) — dívida de dual-write + dados + prod, em paralelo (depois de S19)
  S26-0 Baseline pré-cutover (snapshot de contagens + checksum)
   │
  S26a  Cutover-app: refatorar app/service/hooks/RPC p/ escrever stage_*_id; inverter projeção  [maior dívida P1]
   │
  S26b  Cutover-db: DROP macrostatus_* (gated) + costura docs→service_type_id
   │
  S27   Migração dos ~2500 casos reais (de-para versionado, baseline, rollback em staging)  [BLOQUEANTE p/ prod]
   │
  S28   Configuração de produção (ZapSign prod, Google OAuth, vars Vercel, db:push em 2 releases, deploy)  [PRÉ-REQ owner]

GATE FINAL (converge as duas trilhas)
  S29   Validação no navegador + Matriz RBAC final + LGPD + REGRESSÃO INTEGRAL pós-deploy
```

---

## 2. Sequência de sprints

### TRILHA P2 — Fechamento do Financeiro

#### S19 — Entrada no Financeiro: Duplicar vs Somente Financeiro *(JÁ APROVADA — ver `sprint-19-entrada-financeiro.md`)*
Botão + popup "Duplicar / Somente financeiro" na ficha; desliga a bifurcação automática (entrada manual, reversível). Primeira do P2-fechamento. ADRs: ADR-012..016 (aceitos).

---

#### S20-0 — Harness de RPC autenticada *(infra de teste — pré-requisito de S21/S22/S23)*
**Objetivo:** criar `scripts/test-rpc.ts` (estilo `test-rls.ts`) que autentica por papel (admin/operacional/financeiro/cliente via JWT) e exercita a camada `src/rpc/*` — hoje **não há nenhum teste** nessa camada. Reusável por S19/S21/S22/S23/S25.

| ID | Título | Agente | Est. |
|---|---|---|---|
| S20-0.1 | Harness `test-rpc.ts`: sessão por papel + helpers de asserção 403 (RBAC) e 424 (negócio) | @qa | M |
| S20-0.2 | Auto-teste do harness: 403 numa RPC gated existente + 424 num erro forçado | @qa | P |

**Aceite:** harness prova 403/424 server-side por papel; documentado para reuso nas RPCs novas. **Bloqueia S21-4, S22-4, S23-3.**

---

#### S20 — Refinos do Termo de Acerto
**Objetivo:** completar os 7 critérios de aprovação automática, expor COMPLEMENTAR e À VISTA na UI e implementar o caminho RECUSADO.

| ID | Título | Agente | Est. |
|---|---|---|---|
| S20-1 | ADR-017: definir os 7 critérios da auto-aprovação (hoje `avaliarAuto` tem 3) — owner valida a regra | @architect + @pm | P |
| S20-2 | `termo-service.ts`: expandir `avaliarAuto` p/ 7 critérios; snapshot dos critérios no `finalizarAprovacao` | @dev | M |
| S20-3 | UI `casos.$id.termo.elaborar.tsx`: seletor tipo (PARCIAL/COMPLEMENTAR) + forma (PARCELADO/À VISTA); service já aceita | @dev + @ux | M |
| S20-4 | Caminho RECUSADO (status existe): ação no Termo APRESENTADO → RECUSADO + auditoria; não gera parcelas | @dev | M |
| S20-5 | QA: 7 critérios nas bordas, COMPLEMENTAR/À VISTA no PDF, RECUSADO sem parcelas | @qa | M |

**Aceite:** 7 critérios documentados+implementados (paridade service↔UI); COMPLEMENTAR/À VISTA selecionáveis e refletidos no cálculo/PDF; RECUSADO encerra sem parcelas e auditado.

---

#### S21 — Dashboard Financeiro
**Objetivo:** transformar o stub `routes/dashboards.financeiro.tsx` em dashboard real (recebimentos/projeções/inadimplência).

| ID | Título | Agente | Est. |
|---|---|---|---|
| S21-1 | **Criar** view/RPC de agregação por **parcela**: recebido (`data_pagamento`), projeção (vencimentos futuros), inadimplência (parcelas vencidas em `system_parcelas`). ⚠️ NÃO existe view de inadimplência hoje — a tela atual filtra por etapa `macrostatus_fin='INADIMPLENTE'` (stage-based). Conciliar os dois conceitos (etapa vs parcela vencida) | @data-engineer | M |
| S21-2 | `rpc/financeiro.ts`: `getDashboardFinanceiroFn` com gate RBAC server-side (ADR-015) | @dev | M |
| S21-3 | UI: cards (recebido/a receber/inadimplente) + série temporal + lista; substitui o stub | @dev + @ux | G |
| S21-4 | QA: números batem com `system_parcelas`; vazio não quebra; RBAC na RPC | @qa | M |

**Aceite:** dashboard consistente com `system_parcelas`; estados vazios tratados; acesso restrito por papel na RPC.

---

#### S22 — Baixa manual de parcela *(substituto provisório da cobrança n8n)*
**Objetivo:** ação "marcar como paga" (colunas `data_pagamento`/`valor_pago_centavos`/`metodo_pagamento` já existem em `system_parcelas`).

| ID | Título | Agente | Est. |
|---|---|---|---|
| S22-1 | RPC `darBaixaParcelaFn` + service idempotente (não rebaixa parcela paga) + gate `financeiro.manage` + auditoria; erro de negócio → 424 | @dev | M |
| S22-2 | Migration opcional: `CHECK`/índice de consistência (paga exige os 3 campos) | @data-engineer | P |
| S22-3 | UI ficha/financeiro: "Registrar pagamento" (valor/data/método) + badge "Paga" + estorno opcional | @dev + @ux | M |
| S22-4 | QA: baixa idempotente, estorno, RBAC, reflexo na inadimplência/dashboard | @qa | M |

**Aceite:** baixa grava os 3 campos atomicamente; idempotente; reflete em inadimplência e dashboard (S21); RBAC server-side; auditado.

---

#### S23 — Portal de Boletos do cliente *(depende de ADR-020 — fundação de auth de cliente)*
**Objetivo:** transformar o stub `routes/portal.boletos.tsx` em listagem real (leitura; emissão de boleto fica na Fase Futura n8n). ⚠️ **Hoje o portal é 100% stub** ("Dr. João" hard-coded), **não há login de cliente** e a RLS de `system_parcelas` é **só org-scoped** — um cliente `authenticated` veria parcelas de TODA a organização. Sem a fundação de identidade, S23 vaza dados. **Não inicie sem ADR-020.**

| ID | Título | Agente | Est. |
|---|---|---|---|
| S23-0 | **ADR-020**: modelo de identidade/auth do cliente no portal (como o cliente loga, mapeamento `auth.uid()`→`system_clients.id`) + **policy RLS `client_id`-scoped** em `system_parcelas` | @architect | M |
| S23-1 | Fundação de auth de cliente (sessão do portal isolada do staff) conforme ADR-020 | @dev | G |
| S23-2 | RPC `listMinhasParcelasFn` — parcelas do cliente da sessão (escopo `client_id`), nunca de outros | @dev | M |
| S23-3 | UI portal: lista (valor/vencimento/status); placeholder "2ª via" desabilitado (gancho Fase Futura) | @dev + @ux | M |
| S23-4 | QA (usa S20-0): isolamento por cliente — **teste negativo** A não vê parcelas de B; status corretos | @qa | M |

**Aceite:** cliente loga e vê **só** as próprias parcelas; RLS `client_id`-scoped ativa; isolamento validado por teste negativo; sem dependência de n8n.

---

#### S24 — Calibração do Termo com 30 casos reais *(depende de S20)* — **PRÉ-REQ owner**
**Objetivo:** ajustar `TERMO_DEFAULTS` (hoje 15% / R$500 / 10% / faixa R$1k–20k) com 30 casos reais do Hyago.

| ID | Título | Agente | Est. |
|---|---|---|---|
| S24-1 | Coletar 30 casos (planilha do owner); rodar a calculadora atual; comparar com o esperado | @analyst + @pm | M |
| S24-2 | Ajustar `TERMO_DEFAULTS` (e critérios de S20 se preciso); ADR-018 registra os valores finais | @architect + @dev | M |
| S24-3 | QA de regressão: cálculo das bordas mantém-se correto após recalibração | @qa | P |

**Aceite:** defaults validados contra os 30 casos; divergências aprovadas pelo owner; ADR-018 grava os valores.

---

#### S25 — Suíte de QA P2 *(gate de release do P2)*
**Objetivo:** consolidar os P0 do financeiro sobre o harness criado em S20-0. (O harness foi **promovido para S20-0** — não é mais entregável final.)

| ID | Título | Agente | Est. |
|---|---|---|---|
| S25-2 | P0: imutabilidade do Termo via `service_role` (alterar snapshot APROVADO → bloqueado) | @qa | M |
| S25-3 | P0: segregação elaborador≠conferidor (teste negativo) | @qa | M |
| S25-4 | P0: dupla bifurcação idempotente (`system_fn_bifurcar_financeiro` + `system_fn_entrar_financeiro`) | @qa | M |
| S25-5 | P0: cálculo de bordas — 3 cenários FIES + PARCIAL/COMPLEMENTAR (resto mínimo, faixa, centavos) | @qa | M |
| S25-6 | P0: **RECUSADO → 0 parcelas**; **À VISTA → exatamente 1 parcela**; **baixa idempotente** (rebaixar parcela paga → 424, sem duplicar `valor_pago`) | @qa | M |
| S25-7 | P0: **integração cruzada** — dar baixa numa parcela inadimplente a remove da inadimplência e atualiza os cards do dashboard | @qa | M |

**Aceite:** P0 verdes em CI (sobre o harness S20-0); relatório anexado ao fechamento do P2.

---

### TRILHA P1 — Entrega do Operacional

#### S26-0 — Baseline pré-cutover
**Objetivo:** capturar e **versionar** um snapshot do estado antes de qualquer migration destrutiva (oráculo para S26b, S27 e validação de rollback).

| ID | Título | Agente | Est. |
|---|---|---|---|
| S26-0.1 | Script `tsx` que dumpa `SELECT tipo, stage, status, COUNT(*)` + checksum agregado dos campos-chave dos casos; commitar o artefato | @data-engineer + @qa | P |

**Aceite:** baseline versionado no repo, reusável como oráculo de paridade em S26b/S27/rollback.

---

#### S26a — Cutover-app: inverter a fonte da verdade *(maior dívida técnica do P1)*
**Objetivo:** ⚠️ **Achado da validação:** `macrostatus_*` é **lido E escrito em 63 ocorrências / 18 arquivos** (`cases-service.ts`, `pipeline-service.ts`, RPC, hooks, validators, 7 rotas, cards) e o trigger `system_fn_sync_stage_ids` **deriva `stage_*_id` A PARTIR de `macrostatus`** — ou seja, a fonte de escrita real ainda é `macrostatus`, não `stage_id`. Antes de dropar, é preciso **inverter**: app passa a escrever `stage_*_id` direto e a projeção é invertida (`stage→macrostatus`) ou aposentada. Isso é refatoração de aplicação, não migration.

| ID | Título | Agente | Est. |
|---|---|---|---|
| S26a-0 | **ADR-019 (ampliado)**: estratégia de inversão da projeção + ordem de migração das ~10 funções/triggers que escrevem `macrostatus` + compatibilidade com a escrita de S19/`system_fn_bifurcar_financeiro` | @architect | M |
| S26a-1 | Refatorar `cases-service.ts`/`pipeline-service.ts`/RPC/hooks/validators para escrever e ler `stage_*_id`/`stage_role` (não `macrostatus_*`) | @dev + @data-engineer | G |
| S26a-2 | Inverter `system_fn_sync_stage_ids` (`stage→macrostatus` durante transição) ou removê-lo; ajustar `system_fn_bifurcar_financeiro`/`system_fn_entrar_financeiro` p/ escrever `stage_fin_id` | @data-engineer | M |
| S26a-3 | QA: paridade funcional — Kanbans op/fin, bifurcação, S19, dossiê continuam idênticos lendo `stage_*_id`; `test:cases`+`test:rls`+harness verdes | @qa | G |

**Aceite:** nenhuma escrita/leitura de regra de negócio depende mais de `macrostatus_*`; `stage_*_id` é a fonte da verdade de fato; paridade funcional comprovada.

---

#### S26b — Cutover-db: drop das colunas legadas
**Objetivo:** só depois de S26a, dropar `macrostatus_op`/`macrostatus_fin` (gated) e costurar docs→`service_type_id`.

| ID | Título | Agente | Est. |
|---|---|---|---|
| S26b-1 | Script de gate: `COUNT(stage_*_id NULL)=0` + grep confirmando **zero** uso de `macrostatus_*` no código fora de compat | @data-engineer + @qa | M |
| S26b-2 | Migration: costura `templates.case_type`→`service_type_id` (FK hoje deferida) | @data-engineer | M |
| S26b-3 | Migration: `DROP COLUMN macrostatus_*` + recriar views/triggers remanescentes; rollback em `supabase/rollbacks/` | @data-engineer | M |
| S26b-4 | QA: `test:cases`+`test:rls`+harness verdes pós-drop; diff vs baseline (S26-0) = 0 linhas perdidas | @qa | M |

**Aceite:** colunas removidas só após gate 100% verde e S26a concluída; docs amarrados a `service_type_id`; diff vs baseline = 0; rollback testado.

> ⚠️ S26b **nunca** vai ao mesmo release que S19 (que ainda escreve `macrostatus_fin`). Sequência obrigatória: S19 em produção e estável → S26a → S26b.

---

#### S27 — Migração dos ~2500 casos reais *(BLOQUEANTE para produção)*
**Objetivo:** migrar os ~2500 casos reais com de-para versionado, 0 órfãos, idempotente, rollback testado em staging.

| ID | Título | Agente | Est. |
|---|---|---|---|
| S27-1 | De-para versionado (legado→`service_type_id`+`stage_*_id`), revisado pelo owner; casos sem tipo claro | @data-engineer + @pm | G |
| S27-2 | Script idempotente (rerun = no-op) + relatório de contagens **comparado contra o baseline S26-0** + detecção de órfãos | @data-engineer | G |
| S27-3 | Ensaio em staging: rodar, validar 0 órfãos, **rollback comparado ao baseline (igualdade exata)**, rerodar | @data-engineer + @qa | M |
| S27-4 | QA: paridade de contagens por tipo/etapa; nenhum caso sem pipeline; auditoria do batch | @qa | M |

**Aceite:** 100% dos casos com `service_type_id` e etapa válida; 0 órfãos; idempotência e rollback comprovados em staging antes da produção.

---

#### S28 — Configuração de produção — **PRÉ-REQ owner**
**Objetivo:** ZapSign prod, Google OAuth, vars Vercel, `db:push`, deploy.

| ID | Título | Agente | Est. |
|---|---|---|---|
| S28-1 | Token ZapSign sandbox→produção na Vercel + cadastrar webhook no painel ZapSign | @devops | M |
| S28-2 | `GOOGLE_OAUTH_CLIENT_ID/_SECRET/_REFRESH_TOKEN` na Vercel; **publicar o app OAuth (estado "In production")** — não basta "rotina documentada"; em "Testing" o refresh token expira em 7 dias | @devops | M |
| S28-3 | `db:push` em **dois releases**: (R1) S19–S22 ainda com `macrostatus`, validado em prod; (R2) S26a→S26b só depois. **Nunca** S19 e S26b no mesmo release | @devops | M |
| S28-4 | Smoke test em produção: geração Google Docs + envio ZapSign + webhook de retorno + **plano de rollback de prod ensaiado** (reverter migration + redeploy build anterior) | @qa + @devops | M |

**Aceite:** geração de doc + ZapSign funcionam com credenciais reais; webhook recebe retorno; refresh token resolvido (app publicado ou rotina documentada); migrations aplicadas.

---

### GATE FINAL

#### S29 — Validação com o owner + Matriz RBAC final + LGPD
| ID | Título | Agente | Est. |
|---|---|---|---|
| S29-1 | Roteiro de validação no navegador (jornada P1 + P2) com o owner; lista de ajustes | @pm + @qa | M |
| S29-2 | Matriz RBAC final + retroaplicar ADR-015 em `bifurcarCaseFn`/`moveCaseToStageFinFn` se ainda abertas | @architect + @dev | M |
| S29-3 | LGPD: retenção + export de docs/templates/Termo (reusa `system_consent_records`) | @dev + @architect | G |
| S29-4 | **Regressão integral pós-deploy/pós-migração**: rerodar harness (P0 do S25) + `test:cases` + `test:rls` + `smoke-test` contra o ambiente já migrado (~2500 casos reais) e deployado; só então checklist de "Entregue" assinado pelo owner | @qa + @pm | M |

**Aceite:** owner valida as duas jornadas; RBAC testada na RPC; LGPD export/retenção funcionais; **regressão integral verde sobre dados reais migrados** (não só sobre dados de teste); checklist (§6) assinado.

---

## 3. Tabela-resumo

| Sprint | Objetivo | Projeto | Depende de |
|---|---|---|---|
| S19 | Entrada manual no financeiro (Duplicar/Somente-fin) + desliga trigger | P2 | — (aprovada) |
| S20-0 | Harness de RPC autenticada (infra de teste) | P2 | S19 |
| S20 | Refinos do Termo: 7 critérios + COMPLEMENTAR/À VISTA + RECUSADO | P2 | S19 |
| S21 | Dashboard Financeiro real (por parcela) | P2 | S19, S20-0 |
| S22 | Baixa manual de parcela | P2 | S19, S20-0 |
| S23 | Portal de Boletos (auth de cliente + RLS client_id) | P2 | S22, **ADR-020** |
| S24 | Calibração do Termo com 30 casos reais | P2 | S20 + casos do owner |
| S25 | Suíte de QA P2 (consolida P0) — gate de release P2 | P2 | S20, S21, S22, S23 |
| S26-0 | Baseline pré-cutover (snapshot + checksum) | P1 | S19 |
| S26a | Cutover-app: inverter fonte da verdade (`stage_*_id`) | P1 | S26-0, S19 estável em prod |
| S26b | Cutover-db: drop `macrostatus_*` + costura docs | P1 | **S26a** |
| S27 | Migração dos ~2500 casos reais | P1 | S26b + de-para do owner |
| S28 | Configuração de produção (2 releases) | P1 | S27 + credenciais do owner |
| S29 | Validação + RBAC final + LGPD + regressão integral (gate de entrega) | P1+P2 | S25, S28 |

---

## 4. ADRs novos necessários

| ADR | Tema | Sprint |
|---|---|---|
| ADR-017 | Critérios canônicos da auto-aprovação do Termo (os 7) | S20 |
| ADR-018 | Defaults do Termo recalibrados com 30 casos reais | S24 |
| ADR-019 | **(ampliado)** Inversão da fonte da verdade `macrostatus→stage`: ordem de migração das ~10 funções/triggers + gate do drop + compat. c/ S19 | S26a |
| ADR-020 | **(novo)** Identidade/auth do cliente no portal + RLS `client_id`-scoped em `system_parcelas` | S23 |

*(ADR-012..016 já cobrem S19. ADR-015 — gate RBAC server-side — é **retroaplicado** em S21/S22/S23/S29.)*

---

## 5. Pré-requisitos do owner (bloqueantes)

| # | Pré-requisito | Bloqueia | Dono |
|---|---|---|---|
| 1 | Regra dos **7 critérios** de auto-aprovação | S20 | Owner |
| 2 | **30 casos reais** do Termo (planilha) | S24 | Owner |
| 3 | **Token ZapSign produção** + acesso ao painel p/ webhook | S28 | Owner |
| 4 | **Google OAuth** + decisão de publicar o app (vs renovar a cada 7 dias) | S28 | Owner / @devops |
| 5 | **Vars na Vercel** (ZapSign prod, Google OAuth) | S28 | Owner / @devops |
| 6 | **De-para dos ~2500 casos** revisado | S27 | Owner + @pm |
| 7 | **Matriz RBAC final** (quem vê/edita cada pipeline) | S29 | Owner + @architect |
| 8 | Acesso a **staging** com dados representativos | S27 | @devops |
| 9 | Disponibilidade do owner p/ **validação no navegador** | S29 | Owner |

---

## 6. Definição de "Entregue"

### Projeto 1 — Operacional
- [ ] Bifurcação automática desligada; entrada no financeiro 100% manual (S19).
- [ ] Colunas `macrostatus_*` legadas removidas após gate verde; docs amarrados a `service_type_id` (S26).
- [ ] ~2500 casos migrados: 0 órfãos, idempotente, rollback testado em staging (S27).
- [ ] App OAuth em estado **"In production"** (prova no console, não "rotina documentada"); ZapSign produção + webhook ativos; migrations aplicadas; deploy (S28).
- [ ] Fonte da verdade invertida: nenhuma regra de negócio lê/escreve `macrostatus_*`; `stage_*_id` canônico (S26a).
- [ ] Plano de rollback de produção ensaiado (S28-4).
- [ ] Smoke test em produção (doc + ZapSign + webhook) verde (S28).
- [ ] Matriz RBAC final testada na RPC (S29).
- [ ] LGPD: retenção + export de docs/templates/Termo (S29).
- [ ] Owner validou a jornada operacional e assinou o checklist (S29).

### Projeto 2 — Financeiro
- [ ] Entrada manual Duplicar/Somente-financeiro reversível (S19).
- [ ] Termo: 7 critérios + COMPLEMENTAR/À VISTA na UI + RECUSADO (S20).
- [ ] **RECUSADO gera 0 parcelas; À VISTA gera exatamente 1** (verificado em S25-6).
- [ ] Defaults do Termo calibrados com 30 casos reais (S24).
- [ ] Dashboard Financeiro real, por parcela (S21).
- [ ] Baixa manual de parcela funcional, **idempotente** e auditada (S22).
- [ ] **Integração cruzada verificada**: baixa de parcela reflete na inadimplência e no dashboard (S25-7).
- [ ] Portal de Boletos: cliente loga e vê **só as próprias** parcelas; **RLS `client_id`-scoped** + teste negativo A≠B verde (S23).
- [ ] Suíte de QA P2 verde sobre o harness de RPC autenticada (S20-0/S25).
- [ ] Owner validou a jornada financeira (S29).

### Fora do escopo (Fase Futura — n8n)
- [ ] **Cobrança externa via n8n** (Conta Azul/Asaas): adapter + webhook de retorno + reflexo na inadimplência. Provider/credenciais a definir. A **baixa manual (S22)** é o substituto provisório.

---

## 7. Riscos e ordem de execução recomendada

**Riscos**
1. **Cutover (S26) é a maior dívida técnica do P1, não uma migration** — `macrostatus_*` está em 63 ocorrências/18 arquivos e é a fonte de escrita real (a projeção deriva `stage` dele). Dropar sem a refatoração S26a derruba o app inteiro. Mitigação: S26a (inversão da fonte da verdade) **antes** de S26b (drop), com ADR-019 ampliado e paridade funcional comprovada. Risco equiparável ao da migração dos 2500 casos.
   - **Janela cega da S19**: o `DROP TRIGGER` (S19-2) não pode ir a produção antes do backend+botão (S19-3/5/7); agrupar no mesmo release. S26b nunca vai junto com S19.
2. **Migração dos ~2500 casos (S27)** — risco mais alto. Mitigação: de-para versionado/revisado, script idempotente com relatório, ensaio + rollback obrigatório em staging antes da produção. Bloqueia S28.
3. **Refresh token Google OAuth expira em 7 dias** em "Testing" — pode derrubar a geração de docs em produção. Publicar o app (S28-2) ou documentar renovação + alerta.
4. **5xx mascarado pela Vercel** — toda RPC nova (S21/S22/S23) mapeia erro de negócio/dependência para **424**, nunca 5xx.
5. **RBAC só na UI é burlável** — S21/S22/S23/S29 dependem do gate server-side (ADR-015), ainda não consumido no backend; é design, não "+RBAC".
6. **Cutover irreversível (S26-4)** — executar só com gate 100% verde (S26-2) e rollback documentado.

**Ordem recomendada**
1. Começar já a Trilha P2: **S19 → S20-0 (harness) → (S20 ∥ S21 ∥ S22)** — paralelos (Termo, dashboard, parcela). O harness S20-0 vem **antes** de S21/22/23 (são testáveis só com ele).
2. **S23** depois de S22 **e do ADR-020** (fundação de auth de cliente); **S24** depois de S20 (+30 casos do owner); **S25** fecha o P2.
3. **Trilha P1 em paralelo** desde que depois de S19 estável em prod: **S26-0 → S26a → S26b → S27 → S28** (S27/S28 bloqueadas por pré-reqs do owner).
4. **Coletar cedo** os pré-requisitos do owner (token ZapSign, 30 casos, de-para, matriz RBAC) — caminho crítico real.
5. **S29 só ao final**, após S25 (release P2) e S28 (produção P1) — gate único de "Entregue", com regressão integral sobre os dados reais migrados.
