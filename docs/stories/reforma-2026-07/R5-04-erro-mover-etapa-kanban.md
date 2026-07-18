# Story R5-04: Bug B5 — erro ao mover etapa do Kanban operacional

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-04
- **Status:** Draft
- **Estimativa relativa:** S (diagnóstico + guarda no serviço/trigger) — **cruza com R2**
- **Executor sugerido:** @dev + @architect (por causa do trigger dual-write) · Quality gate: @qa
- **Item do documento-mestre:** §8 **B5** — "erro ao mover etapa · `moveCaseToStageOp` + trigger"

---

## Story

**Como** operador que arrasta um card no Kanban operacional,
**quero** que mover o caso para outra etapa conclua sem erro,
**para que** a etapa fique gravada (dual-write `macrostatus_op` → `stage_op_id`) e o card apareça na coluna certa.

---

## Contexto / o que JÁ EXISTE vs NOVO (arquivo:linha)

- **JÁ EXISTE (serviço):** `moveCaseToStageOp(caseId, stageId)` — `sistema-hv/src/lib/pipeline-service.ts:428-448`. Lê a etapa por `id`, valida `kind='op'`, grava `UPDATE system_cases SET macrostatus_op = stage.slug`, seleciona `stage_op_id` de volta. Dispara o **trigger de projeção** `system_fn_sync_stage_ids()`.
- **JÁ EXISTE (trigger, ADR-007):** `system_fn_sync_stage_ids()` — `sistema-hv/supabase/migrations/20260608000003_s13_espinha.sql:124+`. Projeta `macrostatus_op (slug)` → `stage_op_id (UUID)` **buscando a etapa por (`service_type_id`, `kind='op'`, `slug`)**. As etapas op são **customizadas por `service_type`** (`system_pipeline_stages` tem `UNIQUE(service_type_id, kind, slug)` — `:65`); ex.: `DGM_ENVIADA` só existe para FIES_DGM (`20260609000001_pipelines_por_tipo.sql:37`).
- **CANDIDATOS A ROOT CAUSE (a confirmar em runtime):**
  1. **Slug de etapa inexistente para o `service_type_id` do caso** → a projeção não acha a etapa e `stage_op_id` fica NULL / ou o `.select().single()` do serviço quebra. Acontece quando o Kanban oferece uma coluna cujo slug não pertence ao tipo daquele caso (divergência de etapas por tipo).
  2. **`service_type_id` NULL no caso** (caso legado sem tipo resolvido) → trigger não consegue ancorar a busca de stage.
  3. **`.single()` em `moveCaseToStageOp`/`moveCaseToStageFin`** falha se o UPDATE não retornar exatamente 1 linha (caso soft-deletado / id errado). **[C3]** O `.eq("id", caseId)` (`pipeline-service.ts:441` op / `:464` fin) **não** filtra `deleted_at IS NULL` — mover um caso soft-deletado casa 0 linha e o `.single()` estoura **500**. Causa plausível do B5.
- **NOVO:** cravar a causa, blindar `moveCaseToStageOp` (erro legível quando a etapa não pertence ao tipo do caso; garantir `service_type_id` resolvido) e **documentar o cruzamento com R2** para que a correção não conflite com a unificação de pipeline por TEMA.

> **DECISÃO A CONFIRMAR:** a correção de curto prazo é **defensiva** (validar que a etapa-destino pertence ao `service_type_id` do caso e devolver 422 legível; garantir projeção correta). A causa estrutural (etapas divergentes por tipo) é resolvida por **R2** (pipeline op unificada por TEMA) — não antecipar essa migração aqui.

---

## ⚠️ Cruzamento com R2 (unificação de pipeline) — obrigatório documentar

- R2 (doc-mestre §4.2, §5.1, R2 dos riscos) **unifica a pipeline op por TEMA**: consolida as etapas hoje separadas por `service_type_id` e faz backfill de `macrostatus_op`. O bug B5 é sintoma da fragmentação atual (etapas por tipo).
- **Regra de não-conflito:** a correção de B5 **NÃO** deve alterar a modelagem de `system_pipeline_stages` (não migrar/unificar etapas aqui), nem deletar `case_type`/`macrostatus_*`. Deve apenas **blindar a operação de mover** dentro do modelo atual (guarda de aplicação + trigger correto). Quando R2 unificar as etapas por tema, esta guarda continua válida (etapa-destino pertence ao tema) e não precisa ser desfeita.
- **Preservar dual-write:** continuar gravando `macrostatus_op` (slug) como fonte de verdade; `stage_op_id` é projeção. Não inverter.

---

## Acceptance Criteria

1. Mover um caso para uma etapa op válida do seu tipo conclui sem erro e `macrostatus_op`/`stage_op_id` ficam consistentes.
2. Tentar mover para uma etapa que **não pertence** ao `service_type_id` do caso retorna erro legível (422) — não um 500 opaco nem `stage_op_id` NULL silencioso.
3. Caso com `service_type_id` ainda não resolvido é tratado (resolve pelo `case_type` ou erro claro) — sem quebrar o trigger.
4. A correção **não** altera `system_pipeline_stages` nem remove `case_type`/`macrostatus_*` (compatível com R2).
5. **[C3]** Mover um caso **soft-deletado** (`deleted_at` setado) via `moveCaseToStageOp`/`moveCaseToStageFin` não resulta em 500 — o `.single()` é protegido pelo filtro `deleted_at IS NULL` no `.eq("id", caseId)` (`pipeline-service.ts:441` op / `:464` fin).

---

## Tasks / Subtasks

- [ ] **Diagnóstico** — reproduzir o movimento que falha (capturar erro/status do RPC `moveCaseToStageOp`); identificar se é slug fora do tipo, `service_type_id` NULL ou `.single()` sem linha.
- [ ] **Serviço** — em `pipeline-service.ts` `moveCaseToStageOp`: validar que a etapa-destino pertence ao `service_type_id` do caso (join por `service_type_id` além de `id`), devolvendo 422 legível quando não. Tratar `service_type_id` NULL.
- [ ] **[C3] Guarda `deleted_at IS NULL` no move** — em `moveCaseToStageOp` (`pipeline-service.ts:441`) **e** `moveCaseToStageFin` (`pipeline-service.ts:464`), adicionar `.is("deleted_at", null)` (ou `.eq(...)` equivalente) junto do `.eq("id", caseId)` que precede o `.single()`. Sem esse filtro, mover um caso **soft-deletado** faz o `UPDATE ... .single()` retornar 0/≠1 linha → **500** (causa plausível do próprio bug B5). Aplicar em AMBAS as funções (op e fin), junto da validação etapa-vs-tipo.
- [ ] **Trigger (se necessário, com @architect)** — se a projeção deixa `stage_op_id` NULL sem sinalizar, ajustar `system_fn_sync_stage_ids` para não silenciar (sem mudar a modelagem de etapas). **Migration idempotente + rollback** via `npx tsx scripts/db-apply-pg.ts`.
- [ ] **Front (Kanban)** — garantir que as colunas oferecidas para um card são as etapas do tipo daquele caso (`useStages(serviceTypeId, 'op')`), evitando oferecer destino inválido.
- [ ] **Testes** (AC 1-4) — mover para etapa válida OK; para etapa de outro tipo → 422; caso sem tipo tratado. `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/pipeline-service.ts` (`moveCaseToStageOp`).
- (se preciso) trigger em nova migration + rollback — **recriar `system_cases_active` se tocar colunas de `system_cases`** (aqui provavelmente NÃO toca colunas, só função).
- `sistema-hv/src/routes/pipeline.tsx` / hooks do Kanban (colunas por tipo).

**Regras de ouro pertinentes:**
- **Não conflitar com R2** (ver bloco acima). Não unificar/mexer nas etapas.
- **Dual-write intacto** — `macrostatus_op` é a fonte; `stage_op_id` projeção.
- Migration (se houver) via `npx tsx scripts/db-apply-pg.ts` + rollback. Se tocar `system_cases`, recriar a view.
- Nunca remover `case_type`/`macrostatus_*`.

### Testing
- DnD para etapa do próprio tipo → grava e projeta.
- Forçar etapa de outro tipo via RPC → 422 legível.
- Caso legado sem `service_type_id` → resolve por `case_type` ou erro claro; trigger não quebra.
- **[C3] Caso soft-deletado:** mover um caso com `deleted_at` setado (op e fin) → **NÃO** retorna 500 com `.single()` estourando; com o filtro `deleted_at IS NULL` o move é rejeitado de forma controlada (0 linhas ⇒ erro legível/no-op), não um 500 opaco. Caso ativo continua movendo normalmente.

---

## Dependências

- **Depende de:** nada para a guarda defensiva. **NÃO** depende de R2 (é fix pontual), mas **cruza** com R2.
- **Cruzamentos:** **B5 ↔ R2** (unificação de pipeline op por TEMA). A guarda aqui deve permanecer válida após R2. Documentado acima.
- **Habilita:** Kanban op estável antes de R2 mexer nas etapas.

---

## File List

- `sistema-hv/src/lib/pipeline-service.ts` (`moveCaseToStageOp:441`, `moveCaseToStageFin:464` — validação etapa-vs-tipo + guarda `deleted_at IS NULL` [C3])
- (condicional) nova migration do trigger + rollback
- `sistema-hv/src/routes/pipeline.tsx` / hooks do Kanban

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — bug B5 mover etapa (cruza R2) | @sm |
| 2026-07-18 | 0.2 | C3 (QA — ALTO): adicionada guarda `deleted_at IS NULL` no `.eq("id", caseId)` de `moveCaseToStageOp` (`pipeline-service.ts:441`) e `moveCaseToStageFin` (`:464`), junto da validação etapa-vs-tipo. O `.single()` sem esse filtro (mover caso soft-deletado → 0/≠1 linha → 500) é causa plausível do próprio B5. Atualizados candidato a root-cause #3, task nova [C3], AC-5, Testing e File List. | @sm |
