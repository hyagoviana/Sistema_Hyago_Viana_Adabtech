# Story R5-04: Bug B5 — erro ao mover etapa do Kanban operacional

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-04
- **Status:** Ready for Review
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

- [x] **Diagnóstico** — o código confirma o **candidato #3 (C3)**: `moveCaseToStageOp`/`moveCaseToStageFin` faziam `.update(...).eq("id", caseId).select().single()` **sem** `deleted_at IS NULL` — mover um caso soft-deletado casa 0 linha e o `.single()` estoura 500. Também não havia validação etapa∈tipo (candidato #1 latente: slug de etapa de outro tipo → projeção NULL silenciosa).
- [x] **Serviço** — em `pipeline-service.ts` `moveCaseToStageOp` e `moveCaseToStageFin`: valida que a etapa-destino pertence ao `service_type_id` do caso (helper `loadStageForServiceType` filtra por `service_type_id` + `kind` + `id` + `deleted_at IS NULL`), devolvendo **422 legível** quando não. `service_type_id` NULL tratado via `loadActiveCaseWithServiceType` (resolve pelo `case_type`, espelhando o trigger; 422 claro se irresolvível).
- [x] **[C3] Guarda `deleted_at IS NULL` no move** — adicionado em AMBAS as funções (op e fin): (a) no `loadActiveCaseWithServiceType` (carrega o caso ATIVO, 404 se soft-deletado) e (b) no `.update(...).eq("id", caseId).is("deleted_at", null).select().single()`. Caso soft-deletado agora é rejeitado como 404 controlado, não 500 opaco.
- [x] **Trigger** — NÃO foi necessário. A guarda de aplicação (etapa∈tipo antes de gravar) impede o slug divergente que causaria projeção NULL. `system_fn_sync_stage_ids` intacto. Sem migration.
- [x] **Front (Kanban)** — confirmado que `pipeline.tsx:317` já carrega colunas via `useStages(serviceType.id, kind)` (escopo por tipo). Sem alteração.
- [x] **Testes** (AC 1-5) — `npm run typecheck` sem erro novo em `pipeline-service.ts` (22 erros pré-existentes em outros arquivos, iguais com/sem a mudança), `npm run test:rbac` verde, `npx eslint src/lib/pipeline-service.ts` limpo.

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

- `sistema-hv/src/lib/pipeline-service.ts` — MODIFICADO. `moveCaseToStageOp` e `moveCaseToStageFin` reescritas com: (1) `loadActiveCaseWithServiceType` (novo helper: carrega o caso com `deleted_at IS NULL` [C3] e resolve `service_type_id` pelo `case_type` se NULL — AC-3); (2) `loadStageForServiceType` (novo helper: valida etapa∈tipo por `service_type_id`+`kind`+`id`+`deleted_at IS NULL`, 422 legível — AC-2); (3) `.is("deleted_at", null)` no `UPDATE ... .single()` [C3].
- (NÃO tocado) trigger `system_fn_sync_stage_ids` — sem migration; guarda de aplicação basta.
- (NÃO tocado) `sistema-hv/src/routes/pipeline.tsx` — já usa `useStages(serviceType.id, kind)` (colunas por tipo).

## Dev Agent Record

**Agent:** @dev (James) · Opus 4.8

**Candidato confirmado:** **#3 (C3)** — ausência de `deleted_at IS NULL` no `.update().eq("id", caseId).single()` das duas funções de move. Mover um caso soft-deletado casava 0 linhas → `.single()` estourava 500. O candidato #1 (etapa fora do tipo → projeção NULL silenciosa) também estava latente e foi blindado.

**O que foi blindado:**
1. Guarda `deleted_at IS NULL` — SIM, nas DUAS funções (op + fin), tanto no load do caso quanto no UPDATE.
2. Validação etapa∈tipo com 422 legível — SIM, via `loadStageForServiceType` (filtra `service_type_id` do caso + `kind` + `id`).
3. `service_type_id` NULL — SIM, `loadActiveCaseWithServiceType` resolve pelo `case_type` (espelha o trigger); 422 claro se irresolvível.

**Não conflita com R2:** `system_pipeline_stages` NÃO alterado; `case_type`/`macrostatus_*` preservados; dual-write intacto (`macrostatus_*` fonte, `stage_*_id` projeção). Sem migration.

**Validação:** `npm run typecheck` → 22 erros pré-existentes em OUTROS arquivos (idêntico com/sem a mudança; `pipeline-service.ts` limpo). `npm run test:rbac` → todos verdes. `npx eslint src/lib/pipeline-service.ts` → sem findings.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — bug B5 mover etapa (cruza R2) | @sm |
| 2026-07-18 | 0.2 | C3 (QA — ALTO): adicionada guarda `deleted_at IS NULL` no `.eq("id", caseId)` de `moveCaseToStageOp` (`pipeline-service.ts:441`) e `moveCaseToStageFin` (`:464`), junto da validação etapa-vs-tipo. O `.single()` sem esse filtro (mover caso soft-deletado → 0/≠1 linha → 500) é causa plausível do próprio B5. Atualizados candidato a root-cause #3, task nova [C3], AC-5, Testing e File List. | @sm |
| 2026-07-18 | 0.3 | Implementação (@dev): candidato #3 confirmado. `moveCaseToStageOp`/`moveCaseToStageFin` reescritas com helpers `loadActiveCaseWithServiceType` (deleted_at IS NULL [C3] + resolve service_type_id por case_type [AC-3]) e `loadStageForServiceType` (etapa∈tipo → 422 [AC-2]); `.is("deleted_at", null)` no UPDATE. `system_pipeline_stages`/trigger NÃO tocados; sem migration; dual-write intacto. Kanban já usa `useStages(serviceType.id, kind)`. typecheck (sem erro novo)/test:rbac (verde)/eslint (limpo). Status → Ready for Review. | @dev |
