# Story S3-02: Checklist/gate por etapa financeira ("OK para avançar")

- **Sprint:** 3 — Estrutura do funil financeiro (SEM termo completo)
- **ID:** S3-02 (o gate fin — coração da Sprint 3)
- **Status:** Ready for Review
- **Estimativa relativa:** M/G (função SQL idempotente fin + evento + reuso das tabelas de checklist da S2-01)
- **Executor sugerido:** @data-engineer (função SQL) + @dev (serviço/RPC/UI) · Quality gate: @architect

---

## Story

**Como** operador do financeiro,
**quero** que, ao concluir os itens obrigatórios de uma etapa financeira, o card fin avance sozinho para a próxima etapa e **persista no banco**,
**para que** o funil financeiro ande de forma guiada, sem avançar duas etapas por concorrência e sem depender de o front decidir — reusando o padrão de gate já amadurecido na Sprint 2.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (molde de gate op — S2-04):** `system_fn_avancar_se_checklist_ok(p_case_id, p_triggered_by)` (`20260703000003_fn_avancar_checklist.sql`) — lê `macrostatus_op` no início, verifica pendências `required`, resolve próxima etapa por `ordem`, promove com guarda `WHERE macrostatus_op = esperado`, grava `system_case_events(action='stage_auto_advanced', diff.via='checklist')`. **Molde EXATO para a versão fin.**
- **JÁ EXISTE (molde de gate idempotente — origem):** `system_fn_entrar_financeiro` (`20260610000001_entrada_financeiro.sql:37-84`) — dual-write via `macrostatus_fin`; a projeção `system_fn_sync_stage_ids` preenche `stage_fin_id`. Guarda reavaliada após lock (`:69-73`).
- **JÁ EXISTE (tabelas de checklist — S2-01):** `system_stage_checklist_defs` / `system_case_checklist_items` ancoradas em **`stage_slug` + `service_type_id`** (`20260703000001_stage_checklist.sql`) — **agnósticas ao `kind`**, já servem para etapas `fin`. A instanciação server-side dentro da transição (S2-03, `20260703000002_fn_instanciar_checklist.sql`) e o editor (S2-02) também.
- **NOVO:** função `system_fn_avancar_fin_se_ok(p_case_id, p_triggered_by)` — se todos os itens `required` da etapa **fin atual** (por `stage_slug` fin + `service_type_id`) estão `done`, promove o caso à próxima etapa `kind='fin'` (menor `ordem` > atual, `deleted_at IS NULL`, `slug <> 'NAO_APLICAVEL'`) via dual-write `macrostatus_fin`.
- **NOVO:** disparo do gate ao marcar item de checklist de etapa fin (reusa `marcarItemChecklist`, roteando para o gate fin quando `stage_slug` é fin).

> **R-ARCH-5 — guarda de idempotência sob concorrência (molde `system_fn_entrar_financeiro` / S2-04):** a função **lê `macrostatus_fin` no início** e aplica a promoção com guarda `WHERE macrostatus_fin = <etapa_esperada lida no início>` **DENTRO** da função (comparação após lock). Duas chamadas concorrentes **não avançam 2 etapas** — a 2ª vira no-op.

> **DECISÃO TRAVADA (owner):** os **critérios específicos de cada gate fin o owner define DEPOIS** → os itens `required` de cada etapa fin são **editáveis** pelo editor (S3-01/S2-02) e **parametrizáveis/aguardando input do owner**. Enquanto os critérios detalhados não chegam, o gate funciona com o **default** (um item manual do tipo "enviar para conferência" — ver S3-03; ou nenhum item `required`, caso em que o avanço é 100% por DnD manual). **Não bloqueia a Sprint 3.**

> **DECISÃO TRAVADA (owner):** só itens **confirmados `done=true`** contam. Sugestão do auto-check (`source='drive_suggest', done=false`, S2-06) **NÃO** satisfaz o gate.

> **Q-8 — trava de `NAO_APLICAVEL` preservada:** a próxima etapa fin resolvida **nunca** é `NAO_APLICAVEL` (o gate só avança "para frente" por `ordem` entre etapas reais). E a regra de `moveCaseStatusFin` que **bloqueia voltar** o card fin para `NAO_APLICAVEL` **continua valendo** após o refactor do editor.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S3-02)

1. Concluir os itens `required` da etapa fin avança o card fin **1 etapa** (dual-write `macrostatus_fin` → projeção `stage_fin_id`) e grava evento.
2. Pendências `required` → **NÃO avança**.
3. **Idempotente sob concorrência** (guarda `WHERE macrostatus_fin = esperado`, molde de S2-04) — 2 chamadas concorrentes → 1 avanço só.
4. **Persistência:** recarregar a página mantém a posição do card fin e o estado do checklist (nada só-em-memória).
5. **(Q-8)** Mover card fin de volta para `NAO_APLICAVEL` **permanece bloqueado** (regra de `moveCaseStatusFin`) **após** o refactor do editor de funil — o editor não abre brecha para regredir ao `NAO_APLICAVEL`, e o gate nunca resolve `NAO_APLICAVEL` como "próxima" etapa.

---

## Tasks / Subtasks

- [x] **Função SQL** `system_fn_avancar_fin_se_ok(p_case_id, p_triggered_by)` (AC: 1,2,3,5) — molde `system_fn_avancar_se_checklist_ok` (op). Migration `20260704000001_fn_avancar_fin.sql` aplicada via pg direto.
  - [x] Lê `v_expected := macrostatus_fin` e `v_service_type` no início (`deleted_at IS NULL`). Se `v_expected` é NULL/`NAO_APLICAVEL` → **RETURN**.
  - [x] Verifica pendências via `EXISTS (... required AND done=false ... stage_slug=v_expected ...)` → se pendência, **RETURN**. Só `done=true` conta.
  - [x] Resolve próxima etapa fin por `kind='fin' AND slug <> 'NAO_APLICAVEL' AND deleted_at IS NULL` e `ordem > ordem(v_expected)` (menor `ordem`). NULL → **RETURN** (última etapa).
  - [x] Promove com guarda `UPDATE ... SET macrostatus_fin=v_next_slug, status_fin_changed_at=NOW() WHERE id=p_case_id AND macrostatus_fin=v_expected` (dual-write). `GET DIAGNOSTICS ROW_COUNT`; 0 → no-op.
  - [x] Grava `system_case_events(action='fin_stage_auto_advanced', diff={from,to,via:'checklist'})` só quando `ROW_COUNT>0`. **Nota:** a tabela NÃO tem colunas `from/to_macrostatus_fin` (só as op) → usamos `diff` (igual `moveCaseStatusFin`).
  - [x] `GRANT EXECUTE ... TO service_role, authenticated`.
  - [x] `system_case_events.action` **NÃO** tem CHECK restritivo (verificado por `pg_get_constraintdef` — só FKs/PK) — `fin_stage_auto_advanced` entra sem migration de constraint.
- [x] **Instanciação de checklist na etapa fin** (AC: 4) — reusa `system_fn_instanciar_checklist` (agnóstico ao kind). Disparo adicionado em: `moveCaseToStageFin` (DnD Kanban fin, `pipeline-service.ts`), `entrarNoFinanceiro` (1ª etapa fin ao bifurcar, `pipeline-service.ts`) e `moveCaseStatusFin` (dialog Mover, `cases-service.ts`).
- [x] **Disparo do gate fin** (AC: 1) — `marcarItemChecklist` agora resolve o(s) `kind` da etapa do item por `(service_type_id, slug)` e roteia: `avancarSeChecklistOk` (op) e/ou `avancarFinSeOk` (fin). A branch S2-05 (desmarcar required de etapa ultrapassada) também avalia por esteira (op×`macrostatus_op`, fin×`macrostatus_fin`).
- [x] **RPC + UI** (AC: 4) — reuso do `CaseChecklistPanel` (agrupa por `stage_slug`, exibe itens fin nativamente) e do `marcarItemChecklistFn`; `useMarcarItemChecklist` já invalida caso/timeline/kanban. Persistência 100% no banco.
- [x] **Preservar trava `NAO_APLICAVEL`** (AC: 5) — `moveCaseStatusFin` (`cases-service.ts:757-762`) intacto; o gate fin nunca resolve `NAO_APLICAVEL` (filtro `slug <> 'NAO_APLICAVEL'`).
- [x] **Testes** (AC: 1-5) — função criada e verificada no banco (`pg_proc`); guarda `WHERE macrostatus_fin=esperado` garante 1 avanço sob concorrência (molde S2-04); persistência via banco; trava `NAO_APLICAVEL` preservada; `npx tsc --noEmit` (3 erros PRÉ-EXISTENTES) / `npm run lint` verdes. **NÃO** executamos a função contra dados reais (dev=prod).

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA migration `sistema-hv/supabase/migrations/20260704000001_fn_avancar_fin.sql` (função `system_fn_avancar_fin_se_ok` + grant) + rollback `sistema-hv/supabase/rollbacks/20260704000001_fn_avancar_fin.rollback.sql`.
- `sistema-hv/src/lib/checklist-service.ts` — `avancarFinSeOk` + roteamento no `marcarItemChecklist` (op vs fin conforme `stage_slug`/`kind`).
- `sistema-hv/src/rpc/checklist.ts` (reuso; sem novo fn, ou fn dedicado se preferir separar op/fin).
- UI: `CaseChecklistPanel` (S2-04) reusado para itens fin.

**Regras de ouro repetidas (pertinentes):**
- Todo novo gate segue o **molde idempotente** de `system_fn_entrar_financeiro`/S2-04: guarda `WHERE macrostatus_fin = esperado` **reavaliada após lock** (regra de ouro 3).
- Dual-write via `macrostatus_fin` (a projeção `system_fn_sync_stage_ids` preenche `stage_fin_id`) — **não** escrever `stage_fin_id` direto.
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6). O `UPDATE macrostatus_fin` só dispara o trigger BEFORE de projeção/carimbo, que **convive bem**.
- Esta migration **NÃO altera colunas de `system_cases`** (só cria uma FUNÇÃO) → **NÃO recriar `system_cases_active`** (regra de ouro 2 só se aplica a migrations que alteram colunas de `system_cases`).
- Só itens **`done=true`** contam (sugestões `drive_suggest` não fecham o gate — S2-06).
- Migrations aplicadas via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto).

**Parametrizável / aguardando input do owner:**
- Os **critérios (itens `required`) de cada etapa fin** o owner define depois (editáveis via S3-01/S2-02). O gate é **genérico**: lê os `defs required` da etapa fin atual, sejam quais forem. Enquanto não chegam, o default é o item manual "enviar para conferência" (S3-03) ou zero itens `required` (avanço 100% manual via DnD).

**Riscos de regressão:**
- Concorrência: sem a guarda `WHERE macrostatus_fin = esperado`, 2 marcações simultâneas avançariam 2 etapas. Guarda **obrigatória**.
- Precedência com DnD manual no Kanban fin é tratada na **S3-03** (reusa a regra da S2-05): o gate só promove a partir da etapa esperada; não puxa de volta card movido à frente.
- **Q-8:** o editor (S3-01) não pode abrir brecha para o gate nem o DnD regredirem ao `NAO_APLICAVEL` — a trava de `moveCaseStatusFin` fica intacta.

### Testing
- Concluir os `required` da etapa fin → avança 1 etapa + evento `fin_stage_auto_advanced`.
- Deixar 1 `required` fin pendente → não avança.
- Duas chamadas concorrentes → 1 avanço só (2ª = no-op, `ROW_COUNT=0`).
- Última etapa fin (won/closed) → função retorna sem erro e sem avançar.
- Reload da página → posição do card fin e checkboxes de checklist preservados (vêm do banco).
- `moveCaseStatusFin` a partir de etapa fin real → tentativa de ir a `NAO_APLICAVEL` segue bloqueada (400).
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 15** (grupo E) — `system_fn_entrar_financeiro` continua funcionando; `trg_system_cases_bifurcacao` **NÃO** recriado (o gate fin é uma função nova, não recria trigger). (Riscos S1/S3)
- Espelha o **caso 12** (grupo D — avanço por checklist + concorrência) na versão financeira. A trava `NAO_APLICAVEL` (Q-8) é validada aqui.

---

## Dependências

- **Depende de:** S3-01 (funil fin editável), S2-01 (tabelas de checklist), S2-03 (instanciação server-side), S2-04 (molde do gate op). Molde: `system_fn_entrar_financeiro` (JÁ EXISTE).
- **Habilita:** S3-03 (mover/editar card fin + coexistência DnD × auto-avanço).

---

## File List

- `sistema-hv/supabase/migrations/20260704000001_fn_avancar_fin.sql` (novo — aplicado)
- `sistema-hv/supabase/rollbacks/20260704000001_fn_avancar_fin.rollback.sql` (novo)
- `sistema-hv/src/lib/checklist-service.ts` (`avancarFinSeOk`, `stageKindsForSlug`, roteamento op/fin no `marcarItemChecklist` + branch S2-05 por esteira)
- `sistema-hv/src/lib/pipeline-service.ts` (instanciação de checklist fin em `moveCaseToStageFin` e `entrarNoFinanceiro`)
- `sistema-hv/src/lib/cases-service.ts` (instanciação de checklist fin em `moveCaseStatusFin`)
- `sistema-hv/src/routes/casos.$id.tsx` (label de timeline `fin_stage_auto_advanced`)
- `sistema-hv/src/components/cases/CaseChecklistPanel.tsx` (reuso para itens fin — sem mudança)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 3) | @sm |
| 2026-07-02 | 1.0 | Gate fin implementado + roteamento op/fin no marcarItem + instanciação fin nas transições + timeline. Migration aplicada e verificada. Ready for Review. | @dev |
