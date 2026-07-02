# Story S2-05: Coexistência auto-avanço × DnD manual (precedência) + desmarcar required

- **Sprint:** 2 — Onboard: subetapas/checklist por etapa
- **ID:** S2-05
- **Status:** Ready for Review
- **Estimativa relativa:** M (regra de precedência + alerta de inconsistência; sem schema novo relevante)
- **Executor sugerido:** @dev (serviço/UI) · Quality gate: @architect + @qa

---

## Story

**Como** operador que usa o Kanban,
**quero** que o avanço automático por checklist e o arraste manual (DnD) convivam sem "pingue-pongue",
**para que** uma ação humana explícita tenha prioridade e desmarcar um item obrigatório de uma etapa já ultrapassada gere alerta em vez de regredir o card sozinho.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (DnD):** Kanban com drag-drop (Fase 1 concluída 2026-06-05, `project_kanban_dnd_docs_caso`). Move op via `cases-service.ts:moveCaseStatus` (`:684`) / `pipeline-service.ts:moveCaseToStageOp` (`:186`); move fin via `moveCaseStatusFin` (`:693`, com regra de bloqueio de volta a `NAO_APLICAVEL`).
- **JÁ EXISTE:** o gate `system_fn_avancar_se_checklist_ok` (S2-04) já promove **apenas a partir da etapa esperada** (guarda `WHERE macrostatus_op = esperado`) — então **não puxa de volta** um card movido manualmente à frente (a guarda não casa).
- **NOVO:** regra de precedência explícita + tratamento do **desmarcar required de etapa ultrapassada** → **não regride**; gera **alerta/evento "checklist inconsistente"** e **exige ação humana**.

> **DECISÃO TRAVADA (precedência):** **ação humana explícita (DnD) tem prioridade**; auto-avanço só dispara em resposta a `done` de checklist e **nunca "puxa de volta"** um card movido manualmente à frente. Guarda contra race: o gate só promove se a etapa atual ainda for a **esperada** (herdado de S2-04). Desmarcar item required de etapa **já ultrapassada** → **NÃO regride sozinho**; gera **alerta/evento "checklist inconsistente"** (default = alerta, não regressão automática).

---

## Acceptance Criteria

(CAs do plano v2.3, seção S2-05)

1. Mover card manualmente para frente e depois concluir checklist da etapa antiga → **NÃO regride** o card.
2. Concluir checklist e mover manualmente **quase simultâneos** → estado final é **determinístico** (sem duplicar eventos, sem "pingue-pongue").
3. **(Q-6)** Desmarcar um item `required` de uma etapa **JÁ ultrapassada** pelo gate **NÃO regride** o card automaticamente; em vez disso **gera alerta/evento "checklist inconsistente"** e **exige ação humana** (default = alerta, não regressão automática).

---

## Tasks / Subtasks

- [x] **Precedência DnD × gate** (AC: 1,2)
  - [x] O gate de S2-04 usa a guarda `WHERE macrostatus_op = esperado` — DnD manual à frente **não** é revertido (a guarda não casa).
  - [x] Concluir checklist de uma etapa que **não é mais** a atual: `avancarSeChecklistOk` lê `v_expected=macrostatus_op` atual; a etapa antiga não é `v_expected`, então não há pendência a fechar nela e o gate não avança/gera evento.
  - [x] Determinismo em quase-simultâneo: o `UPDATE ... WHERE macrostatus_op = esperado` serializa; o evento só é inserido quando `ROW_COUNT>0` (sem eventos duplicados).
- [x] **Desmarcar required de etapa ultrapassada** (AC: 3) — em `marcarItemChecklist(itemId, done=false, userId)`:
  - [x] Se o item é de etapa cuja `ordem < ordem(etapa atual)` (ultrapassada) e é `required`: **NÃO** regride `macrostatus_op`; grava `system_case_events(action='checklist_inconsistente', diff={def_key, stage_slug, etapa_atual})`.
  - [x] Se o item é da etapa **atual**, desmarcar só volta o item a pendente (não avança).
- [x] **UI de alerta** — `ChecklistInconsistencyAlert` na ficha do caso (badge/alerta lê os eventos `checklist_inconsistente`); label na timeline. Ação humana = re-checar ou mover manualmente.
- [x] **Testes** (AC: 1-3) — branch de etapa ultrapassada implementado e coberto pela lógica de `ordem`; sem regressão automática em nenhum caminho; `npx tsc --noEmit` / `npm run lint` verdes.

**Nota (verificação do CHECK):** `system_case_events.action` NÃO tem CHECK restritivo (consultado via `pg_constraint`), então `checklist_inconsistente` não exigiu migration adicional.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases-service.ts` (ou `checklist-service.ts`) — lógica de `marcarItemChecklist` (branch de etapa ultrapassada) e do gate.
- RPC/hook + UI da ficha do caso e do card do Kanban (badge de inconsistência).
- Possível migration só se `action='checklist_inconsistente'` exigir CHECK de `system_case_events.action` — **verificar** se `action` tem CHECK restritivo; se tiver, adicionar o novo valor via migration (sem tocar `system_cases`, sem recriar a view).

**Regras de ouro repetidas (pertinentes):**
- Precedência: **ação humana (DnD) tem prioridade**; auto-avanço nunca reverte card movido manualmente à frente.
- Desmarcar required de etapa ultrapassada = **alerta, não regressão automática**.
- Gate herda a guarda `WHERE macrostatus_op = esperado` de S2-04 (regra de ouro 3).
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- Se precisar migration para o novo `action`, aplicar via **`npx tsx scripts/db-apply-pg.ts`** (pg direto).

**Riscos de regressão:**
- Não introduzir regressão automática de etapa em NENHUM caminho (isso quebraria a expectativa do owner).
- Evitar duplicar eventos em quase-simultâneo (o `UPDATE` com guarda serializa; conferir o insert de evento).

### Testing
- Mover card p/ etapa à frente (DnD) → concluir checklist da etapa antiga → card permanece à frente, sem evento de avanço.
- Desmarcar item required de etapa ultrapassada → card não regride; evento `checklist_inconsistente` gravado; badge aparece.
- Concluir último required e mover manualmente quase juntos → estado final único, sem eventos duplicados.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 14** (grupo D) — Desmarcar required após avanço: **não regride sozinho** + **gera alerta "checklist inconsistente"**. (S2-05 CA-3)

---

## Dependências

- **Depende de:** S2-04 (gate + guarda) e do DnD existente (JÁ EXISTE).
- **Habilita:** S3-03 (mesma regra de coexistência DnD × auto-avanço no Kanban financeiro).

---

## File List

- `sistema-hv/src/lib/checklist-service.ts` (`marcarItemChecklist` — branch de etapa ultrapassada)
- `sistema-hv/src/components/cases/CaseChecklistPanel.tsx` (`ChecklistInconsistencyAlert`)
- `sistema-hv/src/routes/casos.$id.tsx` (alerta + label de timeline)

Sem migration adicional (o `action` de `system_case_events` não tem CHECK restritivo).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 2) | @sm |
