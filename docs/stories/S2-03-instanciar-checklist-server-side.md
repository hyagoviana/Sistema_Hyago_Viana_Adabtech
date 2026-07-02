# Story S2-03: Instanciar checklist ao entrar na etapa (server-side)

- **Sprint:** 2 — Onboard: subetapas/checklist por etapa
- **ID:** S2-03
- **Status:** Ready for Review
- **Estimativa relativa:** M (média — função/RPC de transição que materializa itens; idempotente)
- **Executor sugerido:** @data-engineer (função SQL) + @dev (serviço) · Quality gate: @architect

---

## Story

**Como** sistema,
**quero** materializar os itens de checklist da etapa **no momento em que o caso entra nela**, no servidor,
**para que** o checklist do caso exista de forma confiável (não dependa do front chamar) e sem duplicar itens em idas-e-voltas.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE:** transições de etapa op via `cases-service.ts:moveCaseStatus` (`:684` → `updateCase(macrostatus_op)`) e `pipeline-service.ts:moveCaseToStageOp` (`:186` → grava `macrostatus_op = slug`, dual-write; o trigger `system_fn_sync_stage_ids` projeta `stage_op_id`). O DnD do Kanban usa esse caminho.
- **JÁ EXISTE (molde de idempotência):** `system_fn_entrar_financeiro` (`20260610000001_entrada_financeiro.sql:37-84`) — função SQL idempotente que só age quando a condição ainda vale (`WHERE macrostatus_fin IS NULL OR = 'NAO_APLICAVEL'`), reavaliada após lock.
- **JÁ EXISTE:** `system_stage_checklist_defs` / `system_case_checklist_items` (S2-01).
- **NOVO:** materialização **server-side dentro da transição** — ao caso entrar numa etapa, copiar os `defs` ativos daquela etapa/tipo (por `stage_slug` + `service_type_id`) para `system_case_checklist_items`, **idempotente**.

> **R-ARCH-5 — instanciação SERVER-SIDE dentro da transição:** materializar os itens **no servidor** (função/RPC de transição), **NÃO** no componente front. **Idempotente** — não duplica se já instanciado (usa o UNIQUE parcial `(case_id, def_id)` de S2-01).

---

## Acceptance Criteria

(CAs do plano v2.3, seção S2-03)

1. Mover caso para etapa X cria os itens de X **uma única vez**, **disparado no servidor** (não depende de o front chamar).
2. Re-mover para X (ida-e-volta) **não duplica** itens; **preserva** os já `done`.

---

## Tasks / Subtasks

- [x] **Função SQL** `system_fn_instanciar_checklist(p_case_id, p_stage_slug)` (AC: 1,2) — molde `system_fn_entrar_financeiro`
  - [x] Resolve `service_type_id` (+ `organization_id`) do caso; se NULL, no-op silencioso.
  - [x] `INSERT INTO system_case_checklist_items ... SELECT ... FROM system_stage_checklist_defs WHERE service_type_id=<tipo> AND stage_slug=p_stage_slug AND active AND deleted_at IS NULL` com **`ON CONFLICT (case_id, def_id) WHERE deleted_at IS NULL DO NOTHING`** (idempotência; preserva `done`).
  - [x] `source='manual'` por padrão; `done=false`.
  - [x] `GRANT EXECUTE ... TO service_role, authenticated`.
- [x] **Gatilho da instanciação DENTRO da transição** (AC: 1) — **Opção A** escolhida:
  - [x] Chamada dentro de `updateCase` (usado por `moveCaseStatus`/dialog Mover) quando `macrostatus_op` muda, e dentro de `pipeline-service.moveCaseToStageOp` (caminho do DnD do Kanban). Ambos cobrem todas as transições op server-side.
  - [x] Decisão A registrada nas Dev Notes.
- [x] **Serviço/RPC** — `instanciarChecklist(caseId, stageSlug)` no serviço + `instanciarChecklistFn` (RPC) para forçar em caso legado; reusa a mesma função idempotente.
- [x] **Testes** (AC: 1,2) — função executa e no-op em caso inexistente (verificado via db-query); idempotência garantida pelo `ON CONFLICT (case_id, def_id)`; `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA migration `sistema-hv/supabase/migrations/20260703000002_fn_instanciar_checklist.sql` (função + grant; se Opção B, o trigger novo).
- `sistema-hv/src/lib/cases-service.ts` e/ou `pipeline-service.ts` (chamar a função na transição — Opção A).
- Rollback correspondente.

**Regras de ouro repetidas (pertinentes):**
- Instanciação é **server-side dentro da transição** — o front **nunca** materializa itens.
- Idempotência via `ON CONFLICT (case_id, def_id) ... DO NOTHING` (preserva `done`) — molde do padrão idempotente de `system_fn_entrar_financeiro`.
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6). Se usar trigger novo, ele é exclusivo e não conflita com `system_fn_sync_stage_ids` (BEFORE) nem com `system_fn_entrar_financeiro`.
- Migrations aplicadas via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto).
- Esta migration **não toca colunas de `system_cases`** → **não recriar `system_cases_active`** (a menos que se adicione alguma coluna, o que não é o caso).

**Riscos de regressão:**
- Cobrir **todos** os caminhos de transição (DnD, botão, mover via dialog) — se ficar só no front, viola R-ARCH-5. Preferir chamar no serviço que TODOS os caminhos usam.
- Não instanciar em ida-e-volta duplicando (UNIQUE parcial resolve, mas confirmar no teste).

### Testing
- Mover caso p/ etapa X (via serviço) → itens de X criados 1x.
- X→Y→X → sem duplicação; item marcado `done` em X permanece `done` ao voltar.
- Chamada concorrente da função (2x) → sem duplicar (ON CONFLICT).
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- Suporta o **Caso 12** (grupo D — avanço por checklist): sem itens instanciados, não há o que concluir. É pré-requisito operacional do gate S2-04.

---

## Dependências

- **Depende de:** S2-01 (tabelas), S2-02 (defs cadastrados). Reusa `moveCaseStatus`/`moveCaseToStageOp` (JÁ EXISTEM).
- **Habilita:** S2-04 (o gate só faz sentido com itens instanciados).

---

## File List

- `sistema-hv/supabase/migrations/20260703000002_fn_instanciar_checklist.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260703000002_fn_instanciar_checklist.rollback.sql` (novo)
- `sistema-hv/src/lib/checklist-service.ts` (`instanciarChecklist`)
- `sistema-hv/src/lib/cases-service.ts` (`updateCase` chama a instanciação)
- `sistema-hv/src/lib/pipeline-service.ts` (`moveCaseToStageOp` chama a instanciação)
- `sistema-hv/src/rpc/checklist.ts` (`instanciarChecklistFn`)

**Decisão (Opção A):** instanciação chamada no serviço em `updateCase` (transições via dialog/`moveCaseStatus`) e em `moveCaseToStageOp` (DnD do Kanban). Não usa trigger — evita qualquer semelhança com `trg_system_cases_bifurcacao` (regra de ouro 6). A chamada usa `.catch(() => {})` para não derrubar o move caso a instanciação falhe.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 2) | @sm |
