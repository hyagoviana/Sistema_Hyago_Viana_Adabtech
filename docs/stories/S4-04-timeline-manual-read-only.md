# Story S4-04: Timeline de atividades read-only (+ entrada manual gated)

- **Sprint:** 4 — Virada automática em SANDBOX + docs/notas/timeline
- **ID:** S4-04
- **Status:** Ready for Review
- **Estimativa relativa:** M (UI de timeline + RPC de entrada manual com guard de read-only real)
- **Executor sugerido:** @dev (serviço/RPC/UI) · Quality gate: @architect

---

## Story

**Como** operador do escritório,
**quero** ver, no perfil, uma timeline de atividades que espelha os eventos registrados (automáticos + manuais) em ordem cronológica, podendo adicionar marcos manuais,
**para que** o histórico do caso fique visível — sem poder editar/apagar os eventos automáticos do sistema (read-only real), e sem misturar caso com lead na estrutura.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (base de eventos):** `system_case_events (action, from_macrostatus_op, to_macrostatus_op, diff JSONB, triggered_by, created_at)` (`20260523000004_cases.sql:98-109`), índice `(case_id, created_at DESC)`. **`action` NÃO tem CHECK restritivo** — novas ações (ex.: `nota_manual`, `marco`) entram sem migration de constraint.
- **JÁ EXISTE (leitura):** `listCaseEvents(caseId, limit)` (`sistema-hv/src/lib/cases-service.ts:961`). Já alimenta transições automáticas (`created`, `status_changed`/`liberado_comercial`, `perdido`, `stage_auto_advanced`, `fin_stage_auto_advanced`).
- **JÁ EXISTE (rótulos de timeline na UI):** `casos.$id.tsx` já mapeia rótulos de `action` (ex.: label de `fin_stage_auto_advanced` foi adicionado em S3-02).
- **NOVO:** permitir **entrada manual** de eventos de timeline (nota/marco) exibidos **read-only** na ficha (base p/ IA futura — sem IA agora), gravando `triggered_by` (ator não-null).
- **NOVO (guard):** os **eventos automáticos do sistema são read-only reais** — o RPC de edição/remoção **bloqueia no servidor** qualquer tentativa de editar/apagar eventos automáticos; a UI apenas reflete isso.

> **DECISÃO TRAVADA (owner):** timeline é **read-only** (espelha atividades registradas), **sem misturar caso com lead na estrutura**. A entrada manual (se houver) é **gated** e **não permite editar/apagar eventos automáticos**.

> **NOTA de RBAC (Q-10 vs v2.2):** a Matriz v2.3 mantém o caso da timeline com "entrada manual **gated por RBAC** (guard no servidor)". Diferente das **notas** (S4-03), o relaxamento de RBAC v2.2 foi explicitamente apenas para **notas jurídicas** — a S4-04 (Q-10) **não** foi relaxada no CHANGELOG. **PONTO A CONFIRMAR COM O OWNER:** se a entrada manual de timeline também deve ficar "qualquer usuário autenticado" (coerente com o espírito v2.2), ou se mantém o gate por papel do Q-10. **Independente disso**, o essencial e não-negociável é: **eventos automáticos são read-only reais no servidor** (não só na UI).

---

## Acceptance Criteria

(CAs do plano v2.3, seção S4-04)

1. Timeline mostra eventos **automáticos** (`created`, `status_changed`, `liberado_comercial`, `perdido`, avanços de etapa) **+ manuais**, ordenados por **data desc**.
2. Entrada manual grava `triggered_by` (ator não-null) e **aparece imediatamente**; itens são **read-only após criados**.
3. **(Q-10)** Entrada manual de timeline é **gated** (guard no servidor) e **NÃO permite editar/apagar eventos automáticos do sistema** — eventos automáticos são **read-only reais** (bloqueio no RPC, **não** só na UI).

---

## Tasks / Subtasks

- [x] **RPC de entrada manual** (AC: 2,3) — `addManualCaseEvent(caseId, {action, body}, userId)` grava `system_case_events(action='nota_manual'|'marco', diff={body,manual:true}, triggered_by=userId)`. Recusa `userId` null. **`action` sem CHECK** → sem migration.
- [x] **Guard read-only real** (AC: 3) — `loadEditableManualEvent` recusa (403) qualquer evento que **não** seja `action∈{nota_manual,marco}` **e** `diff.manual=true`. `updateManualCaseEvent`/`deleteManualCaseEvent` só operam sobre manuais; eventos automáticos **não** podem ser editados/apagados (bloqueio no servidor).
- [x] **RBAC da entrada manual** (AC: 3) — **auth-only** (qualquer usuário autenticado), conforme instrução do briefing (espírito v2.2). Read-only dos automáticos é fixo, independente disso.
- [x] **UI timeline** (AC: 1,2) — `CaseTimeline` na ficha do caso, `created_at DESC`, rótulos por `action` (migrados da inline antiga); form marco/nota; editar/apagar **só** em itens manuais.
- [x] **Sem misturar caso×lead** (estrutura) — lê `system_case_events` por `case_id`; nenhuma fusão com lead.
- [x] **Testes** (AC: 1-3) — `tsc --noEmit` sem novos erros; lint verde nos arquivos alterados. Guard read-only validado por leitura de código; teste funcional de inserção/tentativa-de-editar-automático fica p/ @qa (dev=prod).

---

## Dev Notes

**Arquivos/migrations a tocar:**
- **Sem migration de schema esperada** (a coluna `action` já é livre; nenhuma coluna nova em `system_cases`). Se o owner pedir campo dedicado de "tipo de marco", avaliar `diff` JSONB primeiro (evita migration).
- `sistema-hv/src/lib/cases-service.ts` — `addManualCaseEvent` + guard read-only (reusa `listCaseEvents`).
- `sistema-hv/src/rpc/` — server function da entrada manual.
- UI: `sistema-hv/src/routes/casos.$id.tsx` (bloco/aba de timeline) + componente `CaseTimeline` em `src/components/`.

**Regras de ouro repetidas (pertinentes):**
- **`system_case_events.action` NÃO tem CHECK restritivo** (verificado no schema `20260523000004_cases.sql`) → `nota_manual`/`marco` entram **sem** migration de constraint.
- Sem alteração de colunas de `system_cases` → **NÃO recriar `system_cases_active`** (regra de ouro 2). **NÃO recriar `trg_system_cases_bifurcacao`**.
- **Read-only real no servidor:** o bloqueio de editar/apagar eventos automáticos é no **RPC**, não só na UI (Q-10).
- Toda escrita passa por RPC server-side; ator (`triggered_by`) não-null nas entradas manuais.

**Parametrizável / a confirmar:**
- **PONTO A CONFIRMAR (owner):** entrada manual gated por papel (Q-10 original) vs apenas login (espírito v2.2). O read-only dos eventos automáticos é **fixo** independentemente disso.

**Riscos de regressão:**
- Não introduzir edição/remoção genérica de `system_case_events` que permita apagar a trilha de auditoria (eventos automáticos são histórico).
- Ordenação usa o índice `(case_id, created_at DESC)` existente.

### Testing
- Adicionar marco manual → aparece no topo com `triggered_by` = usuário.
- Tentar `update`/`delete` de um evento `liberado_comercial`/`status_changed` via RPC → **recusado** (read-only real).
- Timeline lista automáticos + manuais em `created_at DESC`.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- Coberto pelas CAs internas (grupo da timeline). O ponto crítico auditável: **eventos automáticos read-only reais no servidor** (Q-10, AC-3).

---

## Dependências

- **Depende de:** `system_case_events` + `listCaseEvents` (JÁ EXISTEM). Roda em paralelo com S4-02/S4-03.
- **Aguarda input do owner:** RBAC da entrada manual (gate por papel vs apenas login) — ver "PONTO A CONFIRMAR". Não bloqueia o read-only dos eventos automáticos.
- **Habilita:** —

---

## File List

- `sistema-hv/src/lib/cases-service.ts` (`addManualCaseEvent`, `updateManualCaseEvent`, `deleteManualCaseEvent`, `loadEditableManualEvent`, `MANUAL_EVENT_ACTIONS`)
- `sistema-hv/src/rpc/timeline.ts` (novo — server functions: add/update/delete manual)
- `sistema-hv/src/hooks/useTimeline.ts` (novo — hooks das mutações)
- `sistema-hv/src/components/cases/CaseTimeline.tsx` (novo — timeline read-only + entrada manual)
- `sistema-hv/src/routes/casos.$id.tsx` (timeline inline substituída por `<CaseTimeline>`; `fmtDateTime` movido p/ o componente)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 4, S4-04) | @sm |
| 2026-07-02 | 1.0 | Timeline read-only + entrada manual (marco/nota) auth-only; guard read-only real dos eventos automáticos no servidor. Ready for Review. | @dev |

## Dev Agent Record

- Sem migration (`action` livre). Entrada manual grava `diff.manual=true` como marcador; o guard exige `action∈{nota_manual,marco}` **E** `diff.manual=true` para permitir edição/remoção — todo o resto é read-only real (403 no RPC).
- Rótulos de `action` da timeline inline antiga migrados para `renderEventLabel` em `CaseTimeline.tsx`.
