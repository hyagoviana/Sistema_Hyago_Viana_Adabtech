# Story S5-02: Serviço/RPC — mover lead entre etapas comerciais + entrada/saída da pipeline

- **Sprint:** 5 — Módulo Comercial/Leads (pipeline + lista)
- **ID:** S5-02
- **Status:** Ready for Review
- **Estimativa relativa:** M (serviço `moveCaseToStageComercial` + listagem de leads + entrada ao criar caso-lead + saída ao virar CLIENTE/PERDIDO; RPCs auth-only)
- **Executor sugerido:** @dev (serviço + RPC) · Quality gate: @architect

---

## Story

**Como** operador do comercial,
**quero** mover um lead entre etapas comerciais (DnD), listar os leads da pipeline e garantir que o lead **entra** na pipeline comercial ao ser criado e **sai** quando vira CLIENTE (procuração assinada) ou PERDIDO,
**para que** o CRM comercial funcione ponta a ponta reusando as mesmas funções de transição/persistência já usadas por op/fin.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (mover op/fin — molde):** `pipeline-service.ts:moveCaseToStageOp` (`:205`) e `moveCaseToStageFin` (`:231`) — leem `slug, kind` do stage, validam o `kind`, e fazem dual-write de `macrostatus_op`/`macrostatus_fin` (a projeção da espinha preenche `stage_*_id`). **Reusar o MESMO padrão para comercial.**
- **JÁ EXISTE (listagem — molde):** `listCasesByServiceTypeFn`/`useCasesByServiceType` (hooks `usePipeline.ts:59`) e `listAllBifurcatedCasesFn`/`useAllBifurcatedCases` (`:50`) — molde para listar leads.
- **JÁ EXISTE (seed de etapas por tipo):** `pipeline-service.ts:createServiceType` (`:35-68`) semeia op+fin ao criar um tipo — **acrescentar o bloco `comercial`** (mesmos slugs default da S5-01) para novos tipos nascerem com a esteira comercial.
- **JÁ EXISTE (criação de caso):** `cases-service.ts:createCase` (`:50-133`) — o caso nasce `lifecycle='LEAD'` (default da coluna, S1-01) e grava evento `created`/`created_comercial`. **NÃO seta hoje `macrostatus_comercial`.**
- **JÁ EXISTE (saída para CLIENTE):** `liberarCasoComercial` (`:464-507`) e `promoverCasoManual` (`:519-564`) já setam `lifecycle='CLIENTE'`. **JÁ EXISTE (saída para PERDIDO):** `marcarCasoPerdido` (`:572+`) seta `lifecycle='PERDIDO'` + `perdido_at`.
- **NOVO:** `moveCaseToStageComercial(caseId, stageId)` (dual-write `macrostatus_comercial`); `listLeadsPipeline`/`listLeadsByServiceType` (leads = casos `lifecycle='LEAD'`); ao criar caso-lead, **semear** `macrostatus_comercial` na 1ª etapa comercial do tipo; ao virar CLIENTE/PERDIDO, o card **sai** da pipeline de leads (regra de filtro + carimbo `GANHO`/`PERDIDO` na esteira comercial).

> **DECISÃO (saída da pipeline — recomendada):** a pipeline de leads (Kanban) exibe **apenas** casos `lifecycle='LEAD'`. Quando o caso vira **CLIENTE** (via `liberarCasoComercial`/`promoverCasoManual`) o card **some** da pipeline de leads automaticamente (o filtro `lifecycle='LEAD'` já exclui). Para deixar o histórico visível como coluna terminal, `liberarCasoComercial`/`promoverCasoManual` também carimbam `macrostatus_comercial='GANHO'`; `marcarCasoPerdido` carimba `macrostatus_comercial='PERDIDO'`. **A coluna GANHO/PERDIDO no Kanban mostra só o instantâneo recém-movido; o filtro-fonte permanece `lifecycle='LEAD'` para não repovoar leads antigos.** (Detalhe de exibição de GANHO/PERDIDO fica **parametrizável** na S5-03.)

---

## Acceptance Criteria

1. `moveCaseToStageComercial(caseId, stageId)` valida `stage.kind === 'comercial'`, faz **dual-write** de `macrostatus_comercial` (projeção preenche `stage_comercial_id`), grava `system_case_events(action='comercial_status_changed', diff={from,to})` com `triggered_by`, e é **idempotente** (mover para a mesma etapa não duplica evento). Persiste (sobrevive a reload).
2. Ao **criar um caso-lead** (fluxo comercial), o caso recebe `macrostatus_comercial` = **slug da 1ª etapa comercial** do seu `service_type` (ordem 0), entrando na pipeline. Casos criados fora do fluxo comercial não são forçados a ter etapa comercial (mas podem, se `lifecycle='LEAD'`).
3. `listLeadsByServiceType(serviceTypeId)` retorna os casos `lifecycle='LEAD'` do tipo (para o Kanban); `listLeadsPipeline()` retorna todos os leads (visão consolidada). Ambos leem `system_cases_active`.
4. **Saída:** ao virar CLIENTE (`liberarCasoComercial`/`promoverCasoManual`) o caso ganha `macrostatus_comercial='GANHO'`; ao virar PERDIDO (`marcarCasoPerdido`) ganha `macrostatus_comercial='PERDIDO'`. O filtro-fonte da pipeline (`lifecycle='LEAD'`) garante que o card **sai** da pipeline de leads.
5. `createServiceType` passa a semear também as etapas `kind='comercial'` (mesmos defaults da S5-01) — novo tipo nasce com a esteira comercial usável.
6. **RPCs auth-only:** as mutações (`moveCaseToStageComercialFn`) passam por `requireAuth` (login-only, sem `requireRole` — alinhado a S1-03/S3-03). Chamada não autenticada → 401.

---

## Tasks / Subtasks

- [x] **Serviço — mover comercial** (AC: 1) — `pipeline-service.ts:moveCaseToStageComercial(caseId, stageId, triggeredBy?)`: valida `kind==='comercial'`, lê `from`, no-op se `from===slug`, dual-write `macrostatus_comercial`, grava `system_case_events(action='comercial_status_changed', diff={from,to}, triggered_by)`.
- [x] **Serviço — listar leads** (AC: 3) — `listLeadsByServiceType(serviceTypeId)` e `listLeadsPipeline()` filtram `lifecycle='LEAD'` sobre `system_cases_active`.
- [x] **Entrada na pipeline** (AC: 2) — `createCase`: quando `comercial===true`, busca a 1ª etapa comercial (ordem 0) do tipo e seta `macrostatus_comercial` no insert (a projeção preenche `stage_comercial_id`). Best-effort (NULL se o tipo não tiver esteira comercial).
- [x] **Saída da pipeline** (AC: 4) — `macrostatus_comercial='GANHO'` no patch de `liberarCasoComercial`/`promoverCasoManual`; `='PERDIDO'` em `marcarCasoPerdido`. `lifecycle` inalterado.
- [x] **Seed no createServiceType** (AC: 5) — 6 etapas `kind='comercial'` acrescentadas ao array `defaults`.
- [x] **RPC** (AC: 6) — `moveCaseToStageComercialFn`, `listLeadsByServiceTypeFn`, `listLeadsPipelineFn` (`createServerFn` + zod); `handleAuthed` novo wrapper repassa o `userId` autenticado ao serviço (triggered_by); `kindSchema` estendido p/ `comercial`.
- [x] **Hooks** — `useMoveCaseStageComercial`, `useLeadsByServiceType`, `useLeadsPipeline` adicionados; tipo `StageKind` exportado (`op|fin|comercial`); `useStages`/`useCreateStage`/`useUpdateStage`/`useReorderStages`/`useDeleteStage` ampliados para `StageKind`.
- [x] **Testes** — `npx tsc --noEmit` só com os 3 erros pré-existentes de `service_type_id`; lint dos arquivos novos verde (ruído CRLF pré-existente em `usePipeline.ts` ignorado).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/pipeline-service.ts` (`moveCaseToStageComercial`, `listLeadsByServiceType`, `listLeadsPipeline`, seed comercial em `createServiceType`, `StageKind`).
- `sistema-hv/src/lib/cases-service.ts` (entrada em `createCase`; carimbo `macrostatus_comercial` em `liberarCasoComercial`/`promoverCasoManual`/`marcarCasoPerdido`).
- `sistema-hv/src/rpc/pipeline.ts` (RPCs comerciais, auth-only).
- `sistema-hv/src/hooks/usePipeline.ts` (hooks + tipo `kind`).
- `sistema-hv/src/lib/queryKeys.ts` (se usado; chaves `leads`/`comercial`).

**REGRAS DE OURO (pertinentes):**
- **Dual-write** via `macrostatus_comercial` (a projeção `system_fn_sync_stage_ids` da S5-01 preenche `stage_comercial_id`) — **não** escrever `stage_comercial_id` direto.
- `system_case_events.action` **não** tem CHECK → `comercial_status_changed` entra sem migration.
- **Esta story é serviço/RPC** — **não** cria migration nova; **não** toca `system_cases` (a coluna já foi criada na S5-01) → **NÃO** recria `system_cases_active`.
- **NÃO** recriar `trg_system_cases_bifurcacao`.
- Reusar o **padrão idempotente de transição** (checar `from === to` antes de gravar) já usado em op/fin/lifecycle.
- Escrita de `lifecycle` continua **RPC-only, centralizada** em `cases-service` (regra de ouro 7) — esta story **não** move a escrita de lifecycle; só ACRESCENTA o carimbo de esteira comercial junto.

**Riscos de regressão:**
- Não acoplar a saída da pipeline ao carimbo `GANHO`/`PERDIDO`: a **fonte de verdade da saída é `lifecycle`** (o Kanban filtra `lifecycle='LEAD'`). O carimbo comercial é só histórico/visual — se falhar, o lead ainda sai por `lifecycle`.
- `createCase` já tem lógica de "primeira etapa op" — não duplicar/estragar essa busca ao adicionar a comercial; extrair helper se necessário.
- Ampliar `StageKind` não pode quebrar chamadas `useStages(..., "op"|"fin")` existentes (mudança aditiva, ok).

### Testing
- Mover lead A→B na esteira comercial → persiste, evento gravado; mover A→A → no-op.
- Criar caso comercial → nasce em `NOVO` (1ª etapa comercial); aparece em `listLeadsByServiceType`.
- `liberarCasoComercial` → `lifecycle='CLIENTE'` + `macrostatus_comercial='GANHO'`; some da lista de leads.
- `marcarCasoPerdido` → `lifecycle='PERDIDO'` + `macrostatus_comercial='PERDIDO'`; some da lista de leads.
- Chamada não autenticada de `moveCaseToStageComercialFn` → 401.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** S5-01 (coluna `macrostatus_comercial`/`stage_comercial_id` + `kind='comercial'` + projeção + seed). Reusa `moveCaseToStageOp`/`createCase`/`liberarCasoComercial`/`marcarCasoPerdido` (JÁ EXISTEM).
- **Habilita:** S5-03 (UI Kanban de leads consome estes RPCs/hooks).

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **transição comercial idempotente + persistência** (move) e **entrada/saída da pipeline** (criar → NOVO; CLIENTE/PERDIDO → sai). Complementa os casos de lifecycle da S1.

---

## File List

- `sistema-hv/src/lib/pipeline-service.ts` (`moveCaseToStageComercial`, `listLeadsByServiceType`, `listLeadsPipeline`, seed comercial, `StageKind`)
- `sistema-hv/src/lib/cases-service.ts` (entrada em `createCase`; carimbo comercial na saída)
- `sistema-hv/src/rpc/pipeline.ts` (RPCs comerciais, auth-only)
- `sistema-hv/src/hooks/usePipeline.ts` (`useMoveCaseStageComercial`, `useLeadsByServiceType`, `useLeadsPipeline`, tipo `StageKind`)
- `sistema-hv/src/components/cases/StageEditor.tsx` (prop `kind` ampliada p/ `StageKind` — habilita o editor de funil comercial)

## Dev Agent Record (@dev)

- `moveCaseToStageComercial` é idempotente (retorna `{ noop: true }` quando `from===slug`) e grava `comercial_status_changed` só quando há transição real.
- `handleAuthed` foi criado no RPC p/ repassar o `userId` (ator) — as demais RPCs seguem no `handle` sem ator, como já era.
- Saída da pipeline: a fonte de verdade continua `lifecycle` (a listagem filtra `lifecycle='LEAD'`). O carimbo `GANHO/PERDIDO` é histórico/visual — segue junto no mesmo UPDATE do lifecycle (não é fatal isolado).
- `npx tsc --noEmit`: 3 erros pré-existentes de `service_type_id` (ignorados). Nenhum erro novo introduzido.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial — serviço/RPC de mover lead + entrada/saída da pipeline comercial (Sprint 5) | @sm |
