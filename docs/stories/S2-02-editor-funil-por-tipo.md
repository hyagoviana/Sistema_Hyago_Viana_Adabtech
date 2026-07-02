# Story S2-02: Editor de funil por tipo (etapas + checklist)

- **Sprint:** 2 — Onboard: subetapas/checklist por etapa
- **ID:** S2-02
- **Status:** Ready for Review
- **Estimativa relativa:** G (grande — tela admin de CRUD de etapas + defs de checklist; reusa infra existente)
- **Executor sugerido:** @dev (front + RPC) · Quality gate: @architect

---

## Story

**Como** administrador do escritório,
**quero** editar as etapas do funil por tipo de serviço (label/ordem/role) e os itens de checklist de cada etapa,
**para que** cada tipo tenha seu próprio onboard configurável, sem quebrar casos existentes nem alterar `slug` de etapa em uso.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (serviço):** `pipeline-service.ts` já traz o CRUD de etapas: `listServiceTypes` (`:23`), `createServiceType` (que **semeia** etapas op/fin padrão `:34-67`), `listStages` (`:70`), `createStage` (`:82`), `updateStage` (**só `label`/`stage_role`/`color`/`ordem`/`active` — NÃO expõe `slug`** `:110-131`), `reorderStages` (`:133`), `softDeleteStage` (que **já bloqueia** delete de etapa com casos: conta `stage_op_id/stage_fin_id` e lança **409** `:142-159`).
- **JÁ EXISTE (RPC):** `sistema-hv/src/rpc/pipeline.ts` expõe `listStagesFn`, `createStageFn`, etc.
- **JÁ EXISTE (molde de UI de defs):** `sistema-hv/src/components/clients/ClientFieldsManagerDialog.tsx` (editor de `system_client_field_defs`) — **reusar o padrão** de lista/adicionar/editar/reordenar/soft-delete para os `checklist_defs`.
- **JÁ EXISTE (rota-alvo):** `sistema-hv/src/routes/comercial.funil.tsx` é hoje um **`StubPage`** ("Funil de Vendas") — bom ponto para materializar o editor (ou uma nova rota admin sob `configuracoes`, à escolha do @dev).
- **NOVO:** UI admin que edita etapas (label/ordem/stage_role) **e** os itens de checklist (`system_stage_checklist_defs` de S2-01) por etapa/tipo. RPCs de CRUD de `checklist_defs`.

> **REGRA (R-ARCH-7) — editor não altera slug em uso:** o editor **NUNCA** altera o `slug` de uma etapa **em uso** (só `label`/`ordem`/`stage_role`). **Criar etapa nova = novo slug.** **Bloquear delete** de etapa em uso (que tenha casos **ou checklist items** ancorados). Observação: `updateStage` já **não expõe `slug`** — a UI **não deve** adicionar campo editável de slug para etapa existente.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S2-02)

1. Admin cria/edita/reordena etapas de um tipo sem quebrar casos existentes. **Delete de etapa em uso é bloqueado** (não órfã casos); editar `label`/`ordem`/`role` de etapa em uso é permitido.
2. **(R-ARCH-7)** Tentar alterar o `slug` de uma etapa **em uso** é **rejeitado**; nova etapa é criada com **novo slug**.
3. Admin adiciona/edita itens de checklist por etapa; `required` marcável.
4. Alteração de defs **não** reescreve retroativamente instâncias já concluídas (items `done` de casos existentes permanecem intactos).

---

## Tasks / Subtasks

- [x] **Serviço — CRUD de checklist defs** em novo `checklist-service.ts` (AC: 3,4)
  - [x] `listChecklistDefs(serviceTypeId, stageSlug)` — lê `system_stage_checklist_defs_active`.
  - [x] `createChecklistDef({ service_type_id, stage_slug, label, ordem, required, expected_doc_pattern? })` — `key` gerado por slugify único na etapa.
  - [x] `updateChecklistDef(id, patch)` — **NÃO** permite trocar `service_type_id`/`stage_slug`/`key`; só `label`/`ordem`/`required`/`active`/`expected_doc_pattern`.
  - [x] `reorderChecklistDefs(ids)` e `softDeleteChecklistDef(id)` — soft-delete **não** apaga instâncias já criadas.
- [x] **Reforço R-ARCH-7 no serviço de etapas** (AC: 1,2)
  - [x] `updateStage` já não aceita `slug` (confirmado — patch só expõe label/stage_role/color/ordem/active); a UI não adiciona campo editável de slug para etapa existente.
  - [x] `softDeleteStage`: estendido para bloquear (409) quando há **checklist items ancorados** por `(service_type_id, stage_slug)` — via `countChecklistItemsForStage`.
- [x] **RPC** — novo `sistema-hv/src/rpc/checklist.ts` expõe os fns de checklist defs (`createServerFn` + zod). Mutações admin-only (`requireRole(['admin'])`).
- [x] **UI admin** (AC: 1,2,3) — rota `comercial.funil.tsx` (substituiu o `StubPage`):
  - [x] Selecionar tipo de serviço → listar etapas op/fin (editáveis: label/role; **sem** campo de slug para etapa existente; criar etapa nova pede slug).
  - [x] Por etapa, sub-lista de itens de checklist (`StageChecklistEditor`, molde `ClientFieldsManagerDialog`): adicionar/reordenar/marcar `required`/soft-delete.
  - [x] Delete de etapa em uso → mostra o erro 409 do serviço via toast.
- [x] **Gating por RBAC** — mutações admin-only no servidor; UI em modo leitura quando `!config.manage`.
- [x] **Testes** (AC: 1-4) — bloqueio 409 (casos + checklist items) coberto no serviço; soft-delete de def não apaga instâncias; `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/pipeline-service.ts` (CRUD de checklist defs + reforço de `softDeleteStage`) — ou novo `checklist-service.ts`.
- `sistema-hv/src/rpc/pipeline.ts` (novos fns) — ou novo `sistema-hv/src/rpc/checklist.ts`.
- `sistema-hv/src/routes/comercial.funil.tsx` (materializar o editor no lugar do `StubPage`).
- `sistema-hv/src/components/...` (novo componente de editor, molde `ClientFieldsManagerDialog.tsx`).
- Hooks em `sistema-hv/src/hooks/` (padrão `useClientFields`).

**Regras de ouro repetidas (pertinentes):**
- **Nunca** reconstruir o CRUD de etapas — só **estender** (`pipeline-service.ts` já existe).
- Editor **nunca** altera `slug` de etapa em uso (R-ARCH-7). Nova etapa = novo slug.
- **Bloquear delete** de etapa em uso (casos **ou** checklist items ancorados).
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6). Esta story é front/serviço — sem migration de `system_cases`.

**Riscos de regressão:**
- Não abrir brecha para editar `slug` (quebraria a ancoragem por `stage_slug` de S2-01/03/04).
- Reordenar etapas não pode remapear `macrostatus_*` de casos existentes (só muda `ordem`).

### Testing
- Delete de etapa com caso → 409; delete de etapa com checklist item → 409.
- Editar label/ordem/role de etapa em uso → OK; nenhuma tentativa de trocar slug persiste.
- Adicionar/editar def com `required` marcado; editar def não reescreve items `done`.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- Sem caso dedicado na Matriz, mas suporta os casos **12/13/14** (grupo D) e a regra R-ARCH-7 reusada por **S3-01** (funil financeiro).

---

## Dependências

- **Depende de:** S2-01 (tabela `system_stage_checklist_defs`).
- **Habilita:** S2-03 (instancia os defs), S2-04 (gate), S3-01 (reusa este editor para `kind='fin'` com a mesma regra R-ARCH-7).

---

## File List

- `sistema-hv/src/lib/checklist-service.ts` (novo — CRUD defs + countChecklistItemsForStage)
- `sistema-hv/src/lib/pipeline-service.ts` (softDeleteStage estendido)
- `sistema-hv/src/rpc/checklist.ts` (novo — RPC defs, admin-only)
- `sistema-hv/src/hooks/useChecklist.ts` (novo — hooks defs)
- `sistema-hv/src/routes/comercial.funil.tsx` (StubPage → editor)
- `sistema-hv/src/components/pipeline/StageChecklistEditor.tsx` (novo)
- `sistema-hv/src/lib/queryKeys.ts` (chaves checklistDefs/checklistItems)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 2) | @sm |
