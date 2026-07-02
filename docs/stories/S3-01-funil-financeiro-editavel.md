# Story S3-01: Funil financeiro editável por tipo

- **Sprint:** 3 — Estrutura do funil financeiro (SEM termo completo)
- **ID:** S3-01 (STORY-FUNDAÇÃO da Sprint 3 — reusa o editor de funil da S2-02 para `kind='fin'`)
- **Status:** Ready for Review
- **Estimativa relativa:** M (média — front; estende o editor da S2-02 para `kind='fin'`, sem migration nova)
- **Executor sugerido:** @dev (front + RPC) · Quality gate: @architect

---

## Story

**Como** administrador do escritório,
**quero** editar as etapas do funil FINANCEIRO (por tipo de serviço) — label/ordem/role,
**para que** cada tipo tenha seu próprio funil fin configurável, sem alterar `slug` de etapa em uso e sem corromper casos já no financeiro.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (schema):** etapas `kind='fin'` em `system_pipeline_stages` (`20260608000003_s13_espinha.sql:13-66`), com seed op/fin por tipo em `20260609000001_pipelines_por_tipo.sql`. UNIQUE `(service_type_id, kind, slug)` — **etapas revivem por slug**.
- **JÁ EXISTE (entrada no fin):** `system_fn_entrar_financeiro` (`20260610000001_entrada_financeiro.sql:37-84`) resolve a **1ª etapa fin real** por `kind='fin' AND slug <> 'NAO_APLICAVEL'`, menor `ordem`, `deleted_at IS NULL` (`:54-61`). **Não** pode ser quebrada pelo editor.
- **JÁ EXISTE (serviço CRUD de etapas):** `pipeline-service.ts` — `listStages`, `createStage`, `updateStage` (**só `label`/`stage_role`/`color`/`ordem`/`active` — NÃO expõe `slug`**), `reorderStages`, `softDeleteStage` (já bloqueia 409 delete de etapa com casos, contando `stage_op_id`/`stage_fin_id`). O `kind` (`op`/`fin`) já é parâmetro de `listStages`.
- **JÁ EXISTE (editor de funil — S2-02):** `sistema-hv/src/routes/comercial.funil.tsx` (materializado na S2-02) + `StageChecklistEditor` + `softDeleteStage` estendido (bloqueia 409 quando há checklist items ancorados). **Reusar exatamente**, apenas habilitando a visão `kind='fin'`.
- **NOVO (UI):** expor no editor da S2-02 a edição das etapas `kind='fin'` (label/ordem/stage_role) — **mesma regra R-ARCH-7** (não altera `slug` em uso; delete de etapa em uso bloqueado). Sem migration nova.

> **REGRA (R-ARCH-7) — editor não altera slug em uso:** o editor **NUNCA** altera o `slug` de uma etapa fin **em uso** (só `label`/`ordem`/`stage_role`). **Criar etapa nova = novo slug.** **Bloquear delete** de etapa fin em uso (que tenha casos **ou** checklist items ancorados). `updateStage` já **não expõe `slug`** — a UI **não deve** adicionar campo editável de slug para etapa existente.

**Risco de regressão travado:** esta story é **front/serviço** — **NÃO** toca colunas de `system_cases`, portanto **NÃO recriar `system_cases_active`**. **NÃO recriar `trg_system_cases_bifurcacao`** (dropado na 0022 — regra de ouro 6).

---

## Acceptance Criteria

(CAs do plano v2.3, seção S3-01)

1. Admin edita etapas fin de um tipo (label/ordem/role); `system_fn_entrar_financeiro` **continua achando a 1ª etapa real** (`slug <> 'NAO_APLICAVEL'`, menor `ordem`, `deleted_at IS NULL`).
2. Editar etapas fin **não corrompe** casos já no financeiro (posição/`macrostatus_fin` de casos existentes preservada; reordenar só muda `ordem`).
3. **(R-ARCH-7)** Editor **não altera** o `slug` de etapa fin **em uso**; nova etapa fin é criada com **novo slug**. **Delete** de etapa fin em uso é **bloqueado** (409).

---

## Tasks / Subtasks

- [x] **UI — habilitar visão `kind='fin'` no editor da S2-02** (AC: 1,2,3)
  - [x] Em `comercial.funil.tsx`, ao selecionar um tipo, listar etapas `op` **e** `fin` — **JÁ IMPLEMENTADO** na S2-02: `FunilEditor` renderiza duas seções `<StageList ... kind="op">` e `<StageList ... kind="fin">` (`comercial.funil.tsx:257-263`); a coluna `fin` é editável (label/ordem/role); slug exibido como imutável (`comercial.funil.tsx:139`) — sem campo de edição de slug para etapa existente.
  - [x] Criar etapa fin nova pede `slug` novo; editar etapa fin em uso **não** expõe campo de slug — `updateStage` (`pipeline-service.ts:111`) não aceita `slug` no patch.
  - [x] Reordenar/editar etapas fin só chama `updateStage`/`reorderStages` (muda `ordem`/`label`/`role`) — **nunca** remapeia `macrostatus_fin` de casos.
- [x] **Reforço R-ARCH-7 no serviço (fin)** (AC: 3)
  - [x] `softDeleteStage` (`pipeline-service.ts:143`) é **agnóstico ao `kind`**: bloqueia 409 por `stage_fin_id` (`.or(stage_op_id.eq,stage_fin_id.eq)`) **e** por checklist items ancorados por `(service_type_id, stage_slug)` (`countChecklistItemsForStage`) — vale para `kind='fin'`.
  - [x] `system_fn_entrar_financeiro` (intacto) levanta `check_violation` se o tipo ficar sem etapa fin real; o serviço `entrarNoFinanceiro` traduz para 424 com mensagem legível (`pipeline-service.ts:280-287`).
- [x] **RPC/RBAC** — mutações de etapa admin-only no servidor (`rpc/pipeline.ts`); UI em leitura quando `!can(role,'config.manage')` (`comercial.funil.tsx:209,229`).
- [x] **Testes** (AC: 1-3) — nenhuma alteração de schema; `system_fn_entrar_financeiro` inalterado (verificado presente); `npx tsc --noEmit` (3 erros PRÉ-EXISTENTES de `service_type_id`) / `npm run lint` verdes nos arquivos tocados.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/comercial.funil.tsx` (habilitar visão/edição `kind='fin'`).
- `sistema-hv/src/lib/pipeline-service.ts` (confirmar `softDeleteStage`/`listStages`/`updateStage` cobrem `kind='fin'` — em geral já são agnósticos ao `kind`).
- `sistema-hv/src/rpc/pipeline.ts` / `sistema-hv/src/rpc/checklist.ts` (RPCs já existentes; sem novos, salvo ajuste de filtro por `kind`).

**Regras de ouro repetidas (pertinentes):**
- **Nunca** reconstruir o CRUD de etapas nem o editor — só **estender** a visão para `kind='fin'` (regra de ouro 1).
- Editor **nunca** altera `slug` de etapa fin em uso; nova etapa = novo slug; delete de etapa em uso bloqueado (R-ARCH-7).
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6). Esta story é front/serviço — **sem migration de `system_cases`** → **não recriar `system_cases_active`**.
- Migrations (se surgir alguma) aplicadas via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto).

**Riscos de regressão:**
- Reordenar/editar etapas fin não pode remapear `macrostatus_fin` de casos existentes (só muda `ordem`/`label`/`role`).
- Deixar o tipo **sem etapa fin real** quebraria `system_fn_entrar_financeiro` (levanta `check_violation`). O editor deve impedir/avisar antes de soft-deletar a última etapa fin real.
- A ancoragem por `stage_slug` (checklist S3-02) depende de **não** editar `slug` de etapa em uso.

### Testing
- Editar label/ordem/role de etapa fin em uso → OK; nenhuma tentativa de trocar slug persiste.
- Após reordenar etapas fin, `system_fn_entrar_financeiro(caso, ...)` continua resolvendo a 1ª etapa real (menor ordem, `slug <> 'NAO_APLICAVEL'`).
- Delete de etapa fin com caso → 409; delete de etapa fin com checklist item → 409.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- Sem caso dedicado na Matriz, mas suporta o **caso 15** (grupo E — `system_fn_entrar_financeiro` continua funcionando; `trg_system_cases_bifurcacao` NÃO recriado) e reusa a regra **R-ARCH-7** validada pela S2-02.

---

## Dependências

- **Depende de:** S1 (estado do caso), S2-02 (editor de funil por tipo — reusado para `kind='fin'`). Requer `system_pipeline_stages` (`kind='fin'`) e `system_fn_entrar_financeiro` (JÁ EXISTEM).
- **Habilita:** S3-02 (checklist/gate por etapa fin), S3-03 (mover/editar card fin).

---

## File List

Nenhum arquivo alterado — a S2-02 **já entregou** a visão/edição `kind='fin'` e o reforço R-ARCH-7 agnóstico ao kind. Arquivos que satisfazem a story (verificados, sem mudança):
- `sistema-hv/src/routes/comercial.funil.tsx` (já renderiza `<StageList kind="op">` + `<StageList kind="fin">`, slug imutável)
- `sistema-hv/src/lib/pipeline-service.ts` (`softDeleteStage`/`listStages`/`updateStage` agnósticos ao `kind`; `updateStage` não expõe `slug`)
- `sistema-hv/src/rpc/pipeline.ts` (mutações admin-only)

**Sem migration** (reusa infra existente).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 3) | @sm |
| 2026-07-02 | 1.0 | Verificado que a S2-02 já cobre o editor fin (R-ARCH-7 agnóstico ao kind). Sem código novo. Ready for Review. | @dev |
