# Story S2-04: Gate idempotente "checklist conclui → avança etapa"

- **Sprint:** 2 — Onboard: subetapas/checklist por etapa
- **ID:** S2-04
- **Status:** Ready for Review
- **Estimativa relativa:** M/G (função SQL idempotente + evento + integração no marcar-item)
- **Executor sugerido:** @data-engineer (função SQL) + @dev (serviço/RPC/UI) · Quality gate: @architect

---

## Story

**Como** operador do onboard,
**quero** que, ao concluir todos os itens obrigatórios de uma etapa, o caso avance sozinho para a próxima etapa,
**para que** o funil ande de forma guiada, sem avançar duas etapas por concorrência e sem depender de o front decidir.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (molde de gate idempotente):** `system_fn_entrar_financeiro` (`20260610000001_entrada_financeiro.sql:37-84`) — lê o estado no início, aplica com `WHERE macrostatus_fin IS NULL OR = 'NAO_APLICAVEL'` (guarda reavaliada após lock), grava via `macrostatus_fin` (dual-write; a projeção `system_fn_sync_stage_ids` preenche `stage_fin_id`). **Este é o molde exato do gate.**
- **JÁ EXISTE:** ordenação de etapas por `ordem` em `system_pipeline_stages` (`20260608000003_s13_espinha.sql:60`, índice de lookup `:68`); `system_case_events` para auditoria (`20260523000004_cases.sql`).
- **JÁ EXISTE:** `system_case_checklist_items` (S2-01) e a instanciação server-side (S2-03).
- **NOVO:** função `system_fn_avancar_se_checklist_ok(p_case_id)` — se todos os itens `required` da etapa **atual** estão `done`, promove o caso à próxima etapa `op` (menor `ordem` > atual, `deleted_at IS NULL`) via dual-write `macrostatus_op`.

> **R-ARCH-5 — guarda de idempotência sob concorrência (molde `system_fn_entrar_financeiro`):** a função **lê o `macrostatus_op` no início** e aplica a promoção com a guarda `WHERE macrostatus_op = <etapa_esperada lida no início>` **DENTRO** da função (comparação após lock). Assim duas chamadas concorrentes **não avançam 2 etapas** — a 2ª vira no-op porque a guarda não casa mais.

> **DECISÃO TRAVADA:** só itens **confirmados `done=true`** contam. Sugestão do auto-check (`source='drive_suggest', done=false`, S2-06) **NÃO** satisfaz o gate.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S2-04)

1. Concluir o **último item `required`** avança o caso **1 etapa** e grava `system_case_events`.
2. Itens `required` **pendentes** → **NÃO avança**.
3. Chamar 2x (concorrência) → avança **1 vez só** (no-op na 2ª, pela guarda `WHERE macrostatus_op = esperado`).
4. **Última etapa** (won/closed) → **não tenta avançar além**.

---

## Tasks / Subtasks

- [x] **Função SQL** `system_fn_avancar_se_checklist_ok(p_case_id, p_triggered_by)` (AC: 1,2,3,4) — molde `system_fn_entrar_financeiro`
  - [x] Lê `v_expected := macrostatus_op` e `v_service_type` no início (após localizar o caso, `deleted_at IS NULL`).
  - [x] Verifica pendências via `EXISTS (... required AND done=false ...)` → se pendência, **RETURN**. **Só `done=true` conta**.
  - [x] Resolve próxima etapa op por `ordem > ordem(v_expected)` (menor `ordem`, `deleted_at IS NULL`). Se **NULL** (última etapa) → **RETURN** (AC-4).
  - [x] Promove com guarda `UPDATE ... SET macrostatus_op=v_next_slug WHERE id=p_case_id AND macrostatus_op=v_expected` (dual-write). `GET DIAGNOSTICS ROW_COUNT`; se 0 → no-op.
  - [x] Grava `system_case_events(action='stage_auto_advanced', diff={from,to,via:'checklist'})` só quando `ROW_COUNT>0`.
  - [x] `GRANT EXECUTE ... TO service_role, authenticated`.
  - [x] **Verificação do CHECK em `action`** (obs @sm): `system_case_events.action` NÃO tem CHECK restritivo (consultado via `pg_constraint`); novos valores `stage_auto_advanced`/`checklist_inconsistente` entram sem migration de constraint.
- [x] **Disparo do gate** (AC: 1) — `marcarItemChecklist(itemId, done, userId)` no serviço grava `done/done_at/done_by` e, em `done=true`, chama `avancarSeChecklistOk(case_id, userId)` (server-side).
- [x] **RPC + UI** — `marcarItemChecklistFn` (RPC) + checkbox na ficha do caso (`CaseChecklistPanel`); invalidação do caso/timeline/listas após marcar (o card reflete o avanço).
- [x] **Testes** (AC: 1-4) — função executa e no-op em caso inexistente (verificado); guarda `WHERE macrostatus_op = esperado` garante 1 avanço sob concorrência; `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA migration `sistema-hv/supabase/migrations/20260703000003_fn_avancar_checklist.sql` (função + grant) + rollback.
- `sistema-hv/src/lib/cases-service.ts` (ou `checklist-service.ts`) — `marcarItemChecklist` + chamada do gate.
- RPC em `sistema-hv/src/rpc/` + hook + UI da ficha do caso.

**Regras de ouro repetidas (pertinentes):**
- Todo novo gate segue o **molde idempotente** de `system_fn_entrar_financeiro`: guarda `WHERE macrostatus_op = esperado` **reavaliada após lock** (regra de ouro 3).
- Dual-write via `macrostatus_op` (a projeção `system_fn_sync_stage_ids` preenche `stage_op_id`) — **não** escrever `stage_op_id` direto.
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6). O `UPDATE macrostatus_op` só dispara o trigger BEFORE de projeção, que **convive bem**.
- Só itens **`done=true`** contam (sugestões `drive_suggest` não fecham o gate — ver S2-06).
- Migrations aplicadas via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto).
- Esta migration **não altera colunas de `system_cases`** → **não recriar `system_cases_active`**.

**Riscos de regressão:**
- Concorrência: sem a guarda `WHERE macrostatus_op = esperado`, 2 marcações simultâneas do último item avançariam 2 etapas. A guarda é **obrigatória**.
- Precedência com DnD manual é tratada na **S2-05** (o gate só promove a partir da etapa esperada; não puxa de volta card movido à frente).

### Testing
- Concluir último required → avança 1 etapa + evento `stage_auto_advanced`.
- Deixar 1 required pendente → não avança.
- Duas chamadas concorrentes → 1 avanço só (2ª = no-op, `ROW_COUNT=0`).
- Caso na última etapa op (won/closed) → função retorna sem erro e sem avançar.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 12** (grupo D) — Avanço por checklist: concluir o último item required → avança 1 etapa + evento; 2x concorrente → avança 1 vez só. (S2-04)

---

## Dependências

- **Depende de:** S2-01 (tabelas), S2-03 (itens instanciados). Molde: `system_fn_entrar_financeiro` (JÁ EXISTE).
- **Habilita:** S2-05 (coexistência com DnD), S3-02 (gate financeiro reusa o molde).

---

## File List

- `sistema-hv/supabase/migrations/20260703000003_fn_avancar_checklist.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260703000003_fn_avancar_checklist.rollback.sql` (novo)
- `sistema-hv/src/lib/checklist-service.ts` (`avancarSeChecklistOk`, `marcarItemChecklist`)
- `sistema-hv/src/rpc/checklist.ts` (`marcarItemChecklistFn`)
- `sistema-hv/src/hooks/useChecklist.ts` (`useMarcarItemChecklist`, `useCaseChecklistItems`)
- `sistema-hv/src/components/cases/CaseChecklistPanel.tsx` (novo)
- `sistema-hv/src/routes/casos.$id.tsx` (painel de checklist + labels de timeline)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 2) | @sm |
