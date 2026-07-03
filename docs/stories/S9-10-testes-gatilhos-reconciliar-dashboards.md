# Story S9-10: Testes dos gatilhos + reconciliar contagem de "clientes" nos dashboards

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-10
- **Status:** Draft
- **Estimativa relativa:** M (bateria de testes dos 2 gatilhos + roteamento; auditar/reconciliar KPIs de "clientes" que possam contar por procuração)
- **Executor sugerido:** @qa (testes) + @dev (ajuste de KPIs) · Quality gate: @architect

---

## Story

**Como** responsável pela qualidade,
**quero** testes cobrindo os gatilhos novos (procuração→comercial/LEAD; contrato→operacional/CLIENTE; roteamento do webhook) e a **reconciliação da contagem de "clientes"** nos dashboards,
**para que** o modelo novo esteja verificado ponta a ponta e nenhum indicador conte "cliente" pela procuração (só pelo contrato).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (gatilhos novos):** `registrarProcuracaoAssinada` (S9-03), `promoverCasoOperacional`/`promoverCasoManual` (S9-04), webhook roteando por `doc_kind` (S9-05).
- **JÁ EXISTE (fonte de "clientes"):** view `system_clients_clientes` (filtro `lifecycle='CLIENTE'`). Dashboards/KPIs que contam "clientes" devem derivar disso (ou de `lifecycle='CLIENTE'`), **não** de "procuração assinada".
- **NOVO:** (a) bateria de testes dos gatilhos e do roteamento (comportamento e idempotência); (b) **auditoria dos dashboards/indicadores** que exibem "nº de clientes"/"conversão" para garantir que contem por `lifecycle='CLIENTE'` (contrato), reconciliando qualquer contagem que ainda associe procuração a cliente; (c) reconciliar após o rebaixamento da S9-06.

> **PRINCÍPIO:** a única fonte de "é cliente" é `lifecycle='CLIENTE'` (contrato assinado). Nenhum KPI deve contar cliente por `procuracao_assinada_at`/`GANHO`. Onde houver, ajustar a consulta para `lifecycle='CLIENTE'`.

---

## Acceptance Criteria

1. **Testes do gatilho comercial (S9-03):** procuração assinada carimba `procuracao_assinada_at`+`GANHO`, mantém `lifecycle='LEAD'`, NÃO carimba `assinatura_liberada_at`; idempotente (2ª chamada no-op, sem duplicar evento).
2. **Testes do gatilho operacional (S9-04):** contrato assinado → `lifecycle='CLIENTE'`+`assinatura_liberada_at`, entra op/fin; idempotente; `promoverCasoManual` delega e preserva contrato/retorno.
3. **Testes do roteamento (S9-05):** doc `procuracao` assinado → gatilho comercial (LEAD); doc `contrato` assinado → gatilho operacional (CLIENTE); `doc_kind` NULL → só armazena; falha do gatilho não perde PDF; dedupe intacto.
4. **Invariante de banco (S9-01):** LEAD com `procuracao_assinada_at` é aceito; LEAD com `assinatura_liberada_at` é rejeitado pelo CHECK.
5. **Reconciliação de dashboards:** todo indicador de "clientes"/"conversão" conta por `lifecycle='CLIENTE'` (ou `system_clients_clientes`), NÃO por procuração/`GANHO`. Documentada a auditoria (quais dashboards, quais consultas) e corrigido o que divergir. Após a S9-06, a contagem de clientes reflete o rebaixamento (o caso ex-CLIENTE-por-procuração some da contagem de clientes e aparece em leads).
6. `npm run typecheck` / `npm run lint` verdes; os testes novos passam.

---

## Tasks / Subtasks

- [ ] **Testes gatilho comercial** (AC: 1) — cobre `registrarProcuracaoAssinada` (efeito + idempotência + não-mudança de lifecycle).
- [ ] **Testes gatilho operacional** (AC: 2) — cobre `promoverCasoOperacional` + delegação de `promoverCasoManual` + entrada op/fin.
- [ ] **Testes roteamento webhook** (AC: 3) — dois ramos + doc_kind NULL + best-effort + dedupe.
- [ ] **Teste de invariante** (AC: 4) — asserts do CHECK de S9-01 (aceita/rejeita).
- [ ] **Auditar dashboards** (AC: 5) — localizar consultas de "clientes"/"conversão" (Hoje/Inteligência/Financeiro); listar as que contam errado; corrigir para `lifecycle='CLIENTE'`/`system_clients_clientes`.
- [ ] **Reconciliar pós-S9-06** (AC: 5) — conferir que a contagem de clientes bate após o rebaixamento (ex-CLIENTE-por-procuração migra de "clientes" para "leads").

---

## Dev Notes

**Arquivos a tocar (indicativos):**
- Testes: `sistema-hv/src/lib/__tests__/` (ou o local padrão dos testes do projeto) — gatilhos e webhook.
- Dashboards/KPIs: localizar (ex.: `src/routes/hoje.*`, `src/routes/inteligencia.*`, `src/routes/comercial.index.tsx`, hooks/serviços que agregam contagens) e corrigir consultas.

**REGRAS DE OURO (pertinentes):**
- **Testes/leitura** — **NÃO** cria migration; **NÃO** toca `system_cases`; **NÃO** recria view/trigger. Se um KPI precisar de uma view derivada nova (evitar), aí sim seria migration — preferir corrigir a consulta.
- Fonte única de "cliente": `lifecycle='CLIENTE'`. Procuração assinada (`procuracao_assinada_at`/`GANHO`) NÃO é cliente.
- Escrita de lifecycle é server-side (regra de ouro 7) — os testes exercitam os serviços, não escrevem lifecycle direto.

**Riscos de regressão:**
- KPIs que hoje contam "aguardando assinatura" como proxy de conversão podem enganar — separar "procuração assinada" (comercial) de "cliente" (contrato).
- Testes precisam de dados de setup coerentes com o CHECK novo (LEAD não pode ter `assinatura_liberada_at`).

### Testing
- Suíte verde para os 3 gatilhos/roteamento.
- Auditoria: cada dashboard de "clientes" bate com `SELECT count(distinct client_id) FROM system_cases WHERE lifecycle='CLIENTE' AND deleted_at IS NULL` (ou a view).
- Cenário pós-S9-06: o caso rebaixado deixa a contagem de clientes e entra na de leads.

---

## Dependências

- **Depende de:** S9-01 (invariante), S9-03/S9-04/S9-05 (gatilhos/roteamento), S9-06 (rebaixamento — a reconciliação de contagem confirma o efeito). Idealmente S9-07/S9-08 aplicadas (as telas refletem as contagens).
- **Habilita:** fechamento verificado da Sprint 9.

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **suíte dos 2 gatilhos + roteamento + invariante** e **reconciliação de KPI de clientes**. É o gate de qualidade final do modelo novo.

---

## File List

- `sistema-hv/src/lib/__tests__/` (testes dos gatilhos + webhook — local padrão do projeto)
- Dashboards/KPIs de "clientes"/"conversão" (arquivos a localizar na auditoria)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft inicial — testes dos gatilhos + reconciliação de contagem de clientes nos dashboards (Sprint 9) | @sm |
