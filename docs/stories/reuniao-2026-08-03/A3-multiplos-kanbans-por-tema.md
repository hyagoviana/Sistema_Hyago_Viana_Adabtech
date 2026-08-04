# Story A3: Múltiplos Kanbans (boards/listas) por TEMA — mesmo caso, etapas próprias, campos/filtros compartilhados

- **Épico:** Reunião 2026-08-03 — 8 Ajustes
- **ID:** A3
- **Status:** In Progress (núcleo entregue — migration + serviço + UI mínima; follow-ups declarados)
- **Estimativa relativa:** L/XL (item de MAIOR esforço estrutural do épico — nova entidade `board`, coluna aditiva em `system_pipeline_stages`, nova tabela de posição por board, refactor do Kanban/StageEditor/seletor e da ficha do caso)
- **Executor sugerido:** @architect (modelagem) + @data-engineer (migration) + @dev (UI) · Quality gate: @architect + @qa
- **Risco:** ALTO (estrutural — mexe em pipeline/casos, no trigger de projeção `system_fn_sync_stage_ids`, na view enumerada `system_cases_active`, no gate de checklist por etapa e no DnD dos dois Kanbans)

---

## Story

**Como** dono do escritório operando um TEMA (ex.: "1%", "Mais Médicos", "Indenização"),
**quero** ter **várias visualizações Kanban ("Lista 1, Lista 2, Lista 3" / boards)** do **MESMO caso** dentro do tema, cada board com suas **PRÓPRIAS etapas** (colunas), mas com os **MESMOS campos e MESMOS filtros** em todos os boards,
**para que** eu possa manter um fluxo principal (ex.: "aguardando documento") e sub-fluxos paralelos (ex.: "cobrança de documento": cobrei 1x → 2x → 3x → 4x) sem duplicar cadastro, sem quebrar o financeiro e sem "virar bagunça" (os filtros NÃO mudam por board — essa é a regra dura da reunião).

> **Frase do owner na reunião:** "esse processo está correto". O owner descreveu: dentro de um tema, além da lista principal, quer criar "Lista 2 / Lista 3" que são recortes de fluxo do mesmo caso; a lista principal mostra "aguardando documento" e a Lista 2 é o sub-fluxo "cobrança de documento" (1x, 2x, 3x, 4x). Todo caso **nasce na lista principal (obrigatória), na 1ª etapa**; entra nas demais listas **opcionalmente**. Nomes de board/lista são **editáveis** (1% → "renovação"; Indenização → "solicitação no SIGIN"). Ao entrar num tema há um **menu de pré-seleção** de qual board visualizar (espelha o toggle Kanban↔Lista que já existe). Para adicionar um caso a outro board há um **botão na ficha** ("Adicionar à lista/board"), espelhando o "Enviar para financeiro". O **FINANCEIRO** permanece um board **especial, separado/oculto** (RBAC — não visível para todos) e com **campos extras**.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (não reinventar — reusar como molde)

- **Etapas por tema/tipo:** `system_pipeline_stages` (`organization_id`, `service_type_id` FK→`system_service_types` `ON DELETE CASCADE`, `kind` CHECK `'op'|'fin'`, `slug`, `label`, `ordem`, `active`, `stage_role ∈ normal/won/lost/closed`, `color`) — `UNIQUE(service_type_id, kind, slug)`. Def base: `sistema-hv/supabase/migrations/20260608000003_s13_espinha.sql:50-107`. Op reescrita por tipo: `20260609000001_pipelines_por_tipo.sql`. Coluna dormente `frente_slug` (exibição-only): `20260719000003_pipeline_op_unica_por_tema.sql`.
- **Op↔Fin já SÃO, na prática, DOIS Kanbans do mesmo caso** — o mesmo `system_cases` tem `macrostatus_op`/`stage_op_id` (board op) e `macrostatus_fin`/`stage_fin_id` (board fin). **Este é o precedente exato de "vários boards do mesmo caso".** A3 generaliza esse padrão de 2 boards fixos (op/fin) para N boards nomeáveis por tema.
- **Board financeiro = o molde de "board separado/oculto":** o financeiro já é um board à parte (`kind='fin'`), com RBAC de visibilidade (`requireModule('financeiro')` / `rbac.ts:369`), campos extras (checklist fin, honorários) e board ÚNICO via funil sentinela (`GLOBAL_FUNNEL_SERVICE_TYPE_ID`). A3 **preserva o financeiro exatamente como está** — ele é o "board reservado" da nova modelagem, não uma linha nova em `system_pipeline_boards`.
- **Molde "enviar para outro board" (ficha):** `MoveCaseFinDialog.tsx` (`sistema-hv/src/components/cases/MoveCaseFinDialog.tsx`) — select das etapas do board destino + `move.mutateAsync`. Botão de entrada no financeiro na ficha: `casos.$id.tsx:583` ("Somente financeiro" / `useEntrarFinanceiro`). O botão A3 "Adicionar à lista/board" **espelha** esse.
- **Trigger de projeção (dual-write) — INTOCÁVEL na lógica op/fin:** `system_fn_sync_stage_ids()` + `trg_system_cases_sync_stages` (`20260608000003_s13_espinha.sql:124-151`). Projeta `case_type→service_type_id`, `macrostatus_op→stage_op_id`, `macrostatus_fin→stage_fin_id` por slug. A3 **não** roteia os boards extras por esse trigger — a posição num board extra vive em tabela nova (ver decisão), fora do dual-write.
- **View enumerada (recriar ao tocar `system_cases`):** `system_cases_active` **ENUMERA colunas** (não usa `c.*`). Toda migration que altere `system_cases` deve **DROP+CREATE** a view preservando 100% das colunas + grants nos 3 roles (extrair a def **VIGENTE** via `pg_get_viewdef`, não confiar em migration antiga). A3 **provavelmente NÃO precisa** tocar `system_cases` (a posição por board vai em tabela filha), então a view fica intacta — confirmar em design.
- **Serviços:** `sistema-hv/src/lib/pipeline-service.ts` (CRUD de etapas: `listStages/createStage/updateStage/reorderStages/softDeleteStage`; move: `moveCaseToStageOp/Fin`; guardas `loadActiveCaseWithServiceType`/`loadStageForServiceType`). `sistema-hv/src/lib/cases-service.ts`. `sistema-hv/src/lib/tema-service.ts` (createTema→createServiceType interno espelho 1:1 semeia etapas; `getTemaServiceType`).
- **UI Kanban:** `sistema-hv/src/components/cases/KanbanBoard.tsx` (colunas + DnD). Editor de etapas: `sistema-hv/src/components/cases/StageEditor.tsx`. Checklist por etapa: `sistema-hv/src/components/pipeline/StageChecklistEditor.tsx`. Rota do Kanban op dinâmico por tema: `sistema-hv/src/routes/pipeline.tsx` (search param `cat` = service_type_id; toggle Kanban↔Lista já existe, ícones `List`/`Layers`). Ficha: `casos.$id.tsx`. Financeiro: `casos.financeiro.*`.
- **Campos/filtros por tema (a "regra dura"):** os campos e filtros já são **por TEMA** (`system_tema_field_defs` + `canonical_fields`; serviços `tema-field-defs-service.ts`, `tema-field-value.ts`, RPC `tema-field-defs.ts`; painel `CaseFiltersPanel`/`applyCaseFilters` em `pipeline.tsx`). Como os campos são do tema (e não do board), **compartilhá-los entre boards é o comportamento natural** — A3 só precisa GARANTIR que o board NÃO introduz um escopo próprio de campos/filtros.

### NOVO (o que A3 acrescenta)

- **Conceito de BOARD (lista) por tema.** Hoje "board" é implícito (op/fin). A3 torna-o uma entidade de primeira classe: um tema tem **N boards nomeáveis**, sendo **1 obrigatório (principal)** + o **financeiro reservado**.
- **Etapas agrupadas por board** (não só por `kind`).
- **Posição do caso em CADA board extra** (o caso pode estar simultaneamente na etapa "cobrei 2x" da Lista 2 e em "aguardando documento" da lista principal).
- **Menu de pré-seleção de board** ao entrar no tema (espelha o toggle Kanban↔Lista).
- **Botão "Adicionar à lista/board" na ficha** (espelha "Enviar para financeiro") + registro na timeline (integra com A6).

---

## Decisão de modelagem a travar (com @architect, ANTES de codar — registrar no Change Log, estilo R2-01)

> **Regra da reunião que constrange TODA a modelagem:** campos e filtros são do **TEMA**, **iguais em todos os boards**. Board só define **etapas (colunas)** e **posição do caso naquele board**. Modelagem que permita campo/filtro por board está **PROIBIDA** (o owner: "senão vira bagunça").

### Opção A — RECOMENDADA: board como entidade aditiva (`system_pipeline_boards`) + `board_id` em stages + tabela de posição por board

1. **`system_pipeline_boards`** (por tema/service_type):
   - `id`, `organization_id` FK, `service_type_id` FK→`system_service_types` `ON DELETE CASCADE` (o service_type interno espelho 1:1 do tema; molde `tema-service.ts`), `slug`, `label` (EDITÁVEL), `ordem`, `active`, `is_principal BOOLEAN NOT NULL DEFAULT FALSE`, `kind TEXT NULL` (reservado: `NULL`=board custom; `'op'`/`'fin'` marcam os boards-espelho legados se um dia forem materializados), timestamps, `deleted_at`.
   - `UNIQUE(service_type_id, slug) WHERE deleted_at IS NULL`.
   - **Índice parcial único garantindo NO MÁXIMO 1 principal por service_type:** `UNIQUE(service_type_id) WHERE is_principal AND deleted_at IS NULL`.
2. **`system_pipeline_stages` ganha `board_id UUID NULL REFERENCES system_pipeline_boards(id)`** (aditivo, nullable — etapas op/fin legadas ficam com `board_id = NULL` e continuam roteadas por `kind`+`service_type_id` como hoje; etapas de boards custom carregam `board_id`). **Nenhuma etapa op/fin existente é migrada** — regressão zero.
3. **`system_case_board_positions`** (posição do caso em cada board extra):
   - `id`, `organization_id` FK, `case_id` FK→`system_cases` `ON DELETE CASCADE`, `board_id` FK→`system_pipeline_boards` `ON DELETE CASCADE`, `stage_id UUID` FK→`system_pipeline_stages` (etapa atual naquele board) **+ `stage_slug TEXT`** (dual-write leve, espelhando o padrão macrostatus↔stage), `entered_at TIMESTAMPTZ`, timestamps, `deleted_at`.
   - `UNIQUE(case_id, board_id) WHERE deleted_at IS NULL` (um caso ocupa **uma** etapa por board).
   - **Board principal:** ao nascer o caso, insere-se automaticamente uma linha na etapa `ordem=0` do board principal (ou, se preferir custo zero de escrita no INSERT do caso, o board principal é resolvido "on-read" reconciliando — ver AC-4/decisão fina). **Recomendação:** materializar a posição no board principal via a MESMA rota que já cria o caso (`createCase`), para o Kanban principal não depender de reconciliação.

   **Por que NÃO reusar `macrostatus_op`/`stage_op_id` para os boards extras:** essas colunas são a espinha do dual-write op e do trigger; empilhar N boards nelas quebraria a projeção. A tabela de posição isola os boards extras do trigger, mantendo op/fin 100% intactos.

- **Campos/filtros compartilhados:** garantido **por construção** — `system_pipeline_boards` **não tem** colunas de campos/filtros, e a UI de filtros continua lendo `system_tema_field_defs` (do tema), NUNCA do board.
- **Financeiro:** permanece board **reservado** (não é linha em `system_pipeline_boards`; continua via `kind='fin'` + funil sentinela + `requireModule('financeiro')`). O seletor de board **inclui** "Financeiro" como entrada especial gateada por RBAC, apontando para a rota `casos.financeiro.*` já existente — **sem** reimplementar o financeiro.

### Opção B — REJEITADA: explodir cada board em um `service_type` próprio
Cada "lista" viraria um service_type (reusando o padrão tema→service_type espelho). **Rejeitada:** quebra a regra dura — campos/filtros/checklist são ancorados por `service_type_id`, então boards em service_types distintos teriam **campos e filtros diferentes** ("vira bagunça"). Também multiplicaria pipelines, checklists e o funil sentinela. Fere o objetivo central.

### Opção C — REJEITADA: board_id só em stages, sem tabela de posição (posição = etapa "espelhada" em `macrostatus_*`)
Sem `system_case_board_positions`, a posição do caso em cada board precisaria de novas colunas em `system_cases` por board (não escala) ou de sobrecarregar `macrostatus_op` (quebra o trigger). **Rejeitada.**

**➡ Recomendação: Opção A.** Aditiva pura, isola os boards extras do dual-write, garante campos/filtros compartilhados por construção e preserva o financeiro. Travar com @architect antes de escrever a migration.

### ✅ Decisão fina TRAVADA (2026-08-04, @architect+@dev)

Opção A implementada com estas escolhas nos 3 pontos abertos:

1. **Board principal = ESPELHO VIRTUAL do operacional (reconciliação on-read).** O board principal é uma linha `is_principal=true` em `system_pipeline_boards` (para nome/ordem/seletor), mas **suas colunas são as etapas op existentes** (`system_pipeline_stages` com `board_id IS NULL`, `kind='op'`) e **a posição do caso é `macrostatus_op`** (lida on-read). ⇒ **NÃO tocamos `createCase`, NÃO tocamos o trigger `system_fn_sync_stage_ids`, NÃO tocamos `system_cases`.** Regressão ZERO. Todo caso já "nasce" no principal por definição (AC-4 satisfeito sem escrita extra).
2. **Op/fin legados ficam `board_id=NULL`.** Nenhuma etapa op/fin existente foi migrada. Etapas de boards CUSTOM carregam `board_id`.
3. **Checklist/`stage_role` won/lost/closed em boards custom = FORA da v1 (AC-12).** Boards custom são sub-fluxos PUROS de movimentação; nascem sem gate de checklist. Backend aceita `stage_role` (default `normal`), mas a UI v1 não expõe.

**Isolamento op/fin:** boards custom têm serviço PRÓPRIO (`board-service.ts` — `createBoardStage`/`softDeleteBoardStage`/`moveCaseInBoard`) que escreve SÓ em `system_pipeline_stages.board_id` e `system_case_board_positions`. Nunca em `macrostatus_*`/`stage_*_id`. Confirmado por smoke: mover um caso num board custom **não altera** `macrostatus_op`/`stage_op_id` do caso.

**Financeiro:** preservado como board reservado — NÃO é linha em `system_pipeline_boards`. Aparece no `BoardSelector` como entrada especial gateada por `financeiro.manage`, apontando para `casos.financeiro` (rota existente).

---

## Acceptance Criteria

1. **CRUD de boards por tema:** admin cria/renomeia/reordena/soft-deleta boards de um tema (via editor de etapas/tema). `label` editável (ex.: renomear board padrão de "1%" para "renovação"; "Indenização" → "solicitação no SIGIN"). Guardas: não soft-deletar board com casos posicionados nele (409, molde `deleteServiceType`/`softDeleteStage`); não soft-deletar o board **principal**.
2. **Etapas próprias por board:** cada board tem seu conjunto de etapas (colunas) editável em `StageEditor` — criar/renomear/reordenar/excluir etapas **do board selecionado**, com `board_id` gravado. Guarda de exclusão de etapa reusa `softDeleteStage` (conta casos naquela etapa/board + checklist ancorado). Exemplo real coberto: Lista 2 = "cobrança de documento" com etapas "cobrei 1x / 2x / 3x / 4x".
3. **MESMOS campos e MESMOS filtros em todos os boards (regra dura):** o painel de filtros e os campos exibidos são idênticos em qualquer board do tema (fonte única = `system_tema_field_defs` do tema). Teste explícito: trocar de board **não** altera o conjunto de campos nem o conjunto de filtros disponíveis. Não existe caminho de UI/serviço para definir campo/filtro por board.
4. **Board principal obrigatório + caso nasce nele:** todo tema tem exatamente 1 board `is_principal=true` (garantido por índice único parcial). Todo caso novo passa a ocupar a **1ª etapa (ordem 0) do board principal** (via `createCase` OU reconciliação on-read idempotente — decidir na modelagem). Caso não pode existir sem posição no board principal.
5. **Adicionar caso a board extra pela ficha:** botão "Adicionar à lista/board" na ficha do caso (`casos.$id.tsx`), espelhando "Enviar para financeiro" — abre diálogo (molde `MoveCaseFinDialog`) que insere `system_case_board_positions` na 1ª etapa do board escolhido. Idempotente (já está no board → no-op). **Registra evento na timeline** (`system_case_events`, action `board_added`) — integra com A6.
6. **Mover caso entre etapas dentro de um board:** no Kanban de um board, arrastar (ou diálogo "mover") atualiza `system_case_board_positions.stage_id`/`stage_slug`/`entered_at` do par (case, board). Dual-write leve (stage_id + slug) consistente. Op/fin continuam movendo pelos caminhos atuais (`moveCaseToStageOp/Fin`) — **inalterados**.
7. **Menu de pré-seleção de board:** ao entrar num tema (`pipeline.tsx`), o usuário escolhe qual board visualizar (dropdown/segmented), espelhando o toggle Kanban↔Lista existente (persistido em search param, ex.: `board`). O board default é o **principal**. O toggle Kanban↔Lista continua funcionando por board.
8. **Financeiro preservado como board separado + RBAC:** o financeiro NÃO vira linha em `system_pipeline_boards`; continua via `kind='fin'`/funil sentinela/`casos.financeiro.*`. No seletor de board ele aparece como entrada especial **gateada** (`requireModule('financeiro')` no servidor; `usePodeVer`/equivalente no front) — invisível para quem não tem o módulo. Campos extras do financeiro (checklist fin, honorários) permanecem só no board financeiro.
9. **Migração aditiva, idempotente, com rollback:** migration cria `system_pipeline_boards` + `system_case_board_positions` (RLS por org, views `_active`, grants nos 3 roles, `updated_at` + auditoria — molde `s13_espinha`) e `ALTER TABLE system_pipeline_stages ADD COLUMN IF NOT EXISTS board_id ...` (`IF NOT EXISTS` em tudo). Seed idempotente: para cada service_type/tema existente, cria **1 board principal** (`is_principal=true`) reaproveitando as etapas op atuais (associação por `board_id` OU board principal "virtual" que representa o op legado — decidir na modelagem sem migrar dado desnecessário). Rollback correspondente. **Aplicar via `npx tsx scripts/db-apply-pg.ts` (dev=prod).**
10. **View `system_cases_active` intacta/recriada:** se (e somente se) a migration tocar `system_cases`, a view é **DROP+CREATE** preservando 100% das colunas + grants (base = def VIGENTE via `pg_get_viewdef`). Se A3 não tocar `system_cases` (esperado na Opção A), a view **não é alterada** e isso é verificado.
11. **Regressão zero para temas que só usam op+fin:** temas/casos que não usam boards extras se comportam exatamente como hoje (Kanban op, Kanban fin, DnD, checklist, gate de avanço, filtros). Contagens por `case_type`/`macrostatus_op`/`macrostatus_fin`/`stage_*_id` idênticas antes/depois. Trigger `system_fn_sync_stage_ids` e `trg_system_cases_bifurcacao` **inalterados**.
12. **Gate de checklist e stage_role coerentes por board:** se um board custom tiver etapas com checklist (`StageChecklistEditor`) ou `stage_role` won/lost/closed, o comportamento é consistente e **não** vaza para op/fin (ancoragem por board+slug, não só slug). Se checklist em boards custom ficar fora de escopo na v1, isso é declarado explicitamente (owner decide) e o board custom nasce sem gate.

---

## Tasks / Subtasks

- [x] **Decisão de modelagem** (AC: 1-4, 9) — Opção A TRAVADA (ver "Decisão fina" abaixo e Change Log 2026-08-04). (a) board principal = **reconciliação on-read** (espelho virtual do op — NÃO toca `createCase`); (b) op/fin legados ficam `board_id=NULL`, board principal é "virtual espelho do op"; (c) checklist em boards custom **FORA da v1** (AC-12, sub-fluxos puros).
- [x] **Migration** `sistema-hv/supabase/migrations/20260804000004_pipeline_boards.sql` (AC: 9, 10, 11) — aplicada via `db-apply-pg.ts` e confirmada no banco.
  - [x] `CREATE TABLE IF NOT EXISTS system_pipeline_boards` + `UNIQUE(service_type_id, slug) WHERE deleted_at IS NULL` (`uq_system_pipeline_boards_slug`) + `UNIQUE(service_type_id) WHERE is_principal AND deleted_at IS NULL` (`uq_system_pipeline_boards_principal`) + view `_active` + RLS + grants + `updated_at`/auditoria.
  - [x] `ALTER TABLE system_pipeline_stages ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES system_pipeline_boards(id) ON DELETE CASCADE` + índice parcial `(board_id, ordem)`.
  - [x] `CREATE TABLE IF NOT EXISTS system_case_board_positions` + `UNIQUE(case_id, board_id) WHERE deleted_at IS NULL` (`uq_system_case_board_positions`) + índices por `board_id`/`case_id` + view `_active` + RLS + grants + auditoria.
  - [x] **Seed idempotente do board principal por tema** (`NOT EXISTS`): 13 boards `is_principal=true` (1 por service_type ativo; sentinela global excluído), `label` = nome do tipo/tema.
  - [x] **Confirmado que `system_cases` NÃO é tocada** — `system_cases_active` intacta (45 colunas, verificado).
- [x] **Rollback** `.../rollbacks/20260804000004_pipeline_boards.rollback.sql` (AC: 9) — DROP das 2 tabelas + views, DROP `board_id`; NÃO recria trigger; view intacta.
- [x] **Types** — `sistema-hv/src/lib/supabase/types.ts`: `system_pipeline_boards`, `system_case_board_positions` (+ views `_active`), `system_pipeline_stages.board_id`.
- [x] **Serviço** `board-service.ts` (novo, molde `pipeline-service.ts`) (AC: 1, 5, 6)
  - [x] `listBoards/createBoard/updateBoard/reorderBoards/softDeleteBoard` (guardas: casos posicionados → 409, não excluir principal → 409, tombstone do slug).
  - [x] `listStagesByBoard/createBoardStage/softDeleteBoardStage` (grava `board_id`; guarda de exclusão conta posições por `stage_id`). **Nota:** boards custom têm serviço PRÓPRIO de etapas (não estendemos `pipeline-service.createStage` — mantém op/fin 100% isolado).
  - [x] `addCaseToBoard(caseId, boardId)` (insere posição na 1ª etapa; idempotente; evento `board_added`).
  - [x] `moveCaseInBoard(caseId, boardId, stageId)` (update de `system_case_board_positions`; dual-write stage_id+slug; idempotente; evento `board_stage_changed`).
  - [x] `listCasesByBoard(boardId, viewerUserId)` (join posições × `system_cases_active`; respeita `getVisibleCaseIds`).
- [x] **RPC/hooks** — `src/rpc/boards.ts` + `src/hooks/useBoards.ts` (`useBoards/useBoardStages/useCasesByBoard/useCreateBoard/useUpdateBoard/useReorderBoards/useDeleteBoard/useCreateBoardStage/useDeleteBoardStage/useAddCaseToBoard/useMoveCaseInBoard`).
- [x] **UI: seletor/menu de pré-seleção de board** (AC: 7) — `pipeline.tsx`: `BoardSelector` segmented (default principal) + search param `board`; **Financeiro** como entrada gateada (`financeiro.manage`) → rota `casos.financeiro`. Engrenagem (admin) abre o gestor de listas.
- [x] **UI: KanbanBoard por board** (AC: 6) — `CustomBoardKanban` (nova sub-tela em `pipeline.tsx`) reusa o `KanbanBoard` genérico com as colunas do board custom e `useMoveCaseInBoard` no DnD. **Op/fin (board principal) inalterados** — usam os handlers/rota atuais.
- [x] **UI: gestor de listas + etapas por board** (AC: 2) — `BoardsManagerDialog.tsx` (novo): criar/renomear/excluir boards custom + criar/excluir etapas de cada board. (StageEditor legado do op **não** foi tocado — evita risco no op/fin.)
- [x] **UI: botão "Adicionar à lista/board" na ficha** (AC: 5) — `casos.$id.tsx`: botão "Adicionar à lista" ao lado de "Vincular a um tema" + `AddCaseToBoardDialog` (molde `MoveCaseFinDialog`). Registra `board_added` na timeline.
- [x] **Garantia campos/filtros compartilhados** (AC: 3) — por CONSTRUÇÃO: `system_pipeline_boards` não tem colunas de campo/filtro; `CustomBoardKanban` NÃO monta `CaseFiltersPanel` próprio (regra dura); campos/filtros seguem lidos de `system_tema_field_defs` do TEMA.
- [x] **Nascimento no board principal** (AC: 4) — via **reconciliação on-read**: o board principal espelha as etapas op existentes; a posição do caso é `macrostatus_op`. Todo caso já "nasce" no principal por definição, sem escrita extra no `createCase`.
- [x] **Validação em 3 níveis** (AC: 11, 12) — smoke DB OK (13 principais 1:1, `uq_..._principal` rejeita 2º principal, `uq_case_board_positions` rejeita duplicata, mover no board NÃO altera `macrostatus_op`/`stage_op_id`), `tsc --noEmit` sem erro novo (só o baseline `contaazul/service.ts`), `eslint` exit 0 nos tocados, `vite build` verde. Smoke UI Playwright = FOLLOW-UP.

### Follow-ups declarados (NÃO entregues nesta rodada — nada quebrado)
- **Reordenar boards/etapas na UI** (drag/handles): o backend (`reorderBoards`) existe, mas o `BoardsManagerDialog` v1 só cria/renomeia/exclui (ordem = ordem de criação). 
- **Reordenar/editar `stage_role`/cor de etapas de board custom na UI**: só criar/excluir na v1 (backend aceita `stage_role`).
- **Optimistic move idempotente cross-refetch** já implementado; **DnD entre etapas do board custom** validado por código, ainda sem **smoke UI Playwright**.
- **Toggle Kanban↔Lista dentro de um board custom**: hoje o board custom só tem Kanban (a Lista/`casos.lista` continua no board principal).
- **Checklist/`stage_role` won/lost/closed em boards custom** (AC-12): declarado FORA de escopo v1 — boards custom nascem sem gate.

## Dev Notes

**Arquivos/migrations a tocar (paths absolutos-relativos ao repo):**
- NOVA `sistema-hv/supabase/migrations/2026080300000X_pipeline_boards.sql` + rollback em `sistema-hv/supabase/rollbacks/`.
- `sistema-hv/src/lib/supabase/types.ts`.
- NOVO `sistema-hv/src/lib/board-service.ts` (molde `pipeline-service.ts`).
- `sistema-hv/src/lib/pipeline-service.ts` (estender `createStage`/`softDeleteStage`/`listStages` p/ `board_id`).
- `sistema-hv/src/lib/cases-service.ts` (posicionar no board principal ao criar caso).
- `sistema-hv/src/components/cases/KanbanBoard.tsx`, `StageEditor.tsx`, `MoveCaseFinDialog.tsx` (molde para o novo diálogo "Adicionar à lista").
- `sistema-hv/src/components/pipeline/StageChecklistEditor.tsx` (se checklist por board na v1).
- `sistema-hv/src/routes/pipeline.tsx` (seletor de board + search param `board`), `sistema-hv/src/routes/casos.$id.tsx` (botão na ficha).
- `sistema-hv/src/rpc/*` + `sistema-hv/src/hooks/usePipeline.ts` (novos hooks).

**Regras de ouro:**
- **NUNCA tocar a lógica do dual-write op/fin.** `system_fn_sync_stage_ids()` e `trg_system_cases_sync_stages` ficam **inalterados**. Os boards extras vivem em `system_case_board_positions`, fora do trigger. `trg_system_cases_bifurcacao` **não** é recriado.
- **Campos/filtros são do TEMA, iguais em todos os boards** (regra dura da reunião). Board **jamais** define campo/filtro. Proibido criar qualquer coluna/serviço de campo-por-board.
- **Financeiro é board reservado — NÃO reimplementar.** É a entrada gateada (`requireModule('financeiro')`, `rbac.ts:369`) apontando para `casos.financeiro.*`. Não vira linha em `system_pipeline_boards`.
- **View enumerada:** só recriar `system_cases_active` (DROP+CREATE, def vigente via `pg_get_viewdef`) **se** a migration tocar `system_cases`. Na Opção A ela **não** é tocada — verificar e afirmar isso.
- **Migrations aplicadas via `npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (Supabase CLI quebrado no Windows/OneDrive). **dev=prod** — cuidado redobrado. Prefixo `system_` em tudo. `DEFAULT_ORG = '00000000-0000-0000-0000-000000000001'`.
- Idempotência de slug de board: `UNIQUE(service_type_id, slug) WHERE deleted_at IS NULL` + tombstone do slug ao soft-delete (molde `deleteServiceType`/`deleteTema`).

**Riscos ALTOS (mitigações):**
- **Trigger `sync_stage_ids`:** se a posição de board extra vazar para `macrostatus_op`, o trigger reprojetaria `stage_op_id` errado e corromperia o Kanban op. *Mitigação:* posição de board extra NUNCA escreve em `macrostatus_*`/`stage_*_id`; só em `system_case_board_positions`. Teste: mover no board extra não altera `stage_op_id`.
- **View enumerada:** recriar perdendo colunas quebra TODO o front que lê `system_cases_active`. *Mitigação:* preferir NÃO tocar `system_cases`; se tocar, diff coluna-a-coluna contra a def vigente.
- **Gate de checklist por etapa:** checklist é ancorado por `(service_type_id, stage_slug)` (`countChecklistItemsForStage`, `pipeline-service.ts:378`). Boards custom com etapas de slug colidente poderiam herdar checklist do op. *Mitigação:* ancorar checklist de board custom por `board_id`+slug, ou declarar checklist fora de escopo p/ boards custom na v1 (AC-12).
- **DnD dos dois Kanbans:** `KanbanBoard.tsx` hoje assume handler op/fin. Ao parametrizar por board, garantir que o board op/fin usa os handlers legados e o board custom usa `moveCaseInBoard` — sem cruzar os fios. *Mitigação:* branch por tipo de board no handler; testes de DnD nos dois modos.
- **Board principal obrigatório:** um tema sem board principal deixaria casos "sem lar". *Mitigação:* índice único parcial garante ≤1 principal; seed garante ≥1; `createCase` posiciona no principal; guarda impede excluir o principal.
- **Unicidade de posição:** `UNIQUE(case_id, board_id) WHERE deleted_at IS NULL` evita caso em 2 etapas do mesmo board.

## Testing

- **DB (smoke via `db-apply-pg`/pg direto):** aplicar migration → `system_pipeline_boards`, `system_case_board_positions`, `system_pipeline_stages.board_id` existem com RLS/grants/views. Seed cria exatamente 1 board principal por service_type. Índice único de principal rejeita 2º principal. `UNIQUE(case_id, board_id)` rejeita posição duplicada. Guardas: soft-delete de board com caso posicionado → 409; soft-delete do principal → recusado.
- **Regressão op/fin (AC-11):** contagens por `case_type`/`macrostatus_op`/`macrostatus_fin`/`stage_op_id`/`stage_fin_id` idênticas antes/depois. Mover caso num board extra → `stage_op_id`/`stage_fin_id` **inalterados**. Checklist/gate op e fin inalterados.
- **Fluxo (Playwright/manual):** entrar no tema → seletor mostra boards (principal default) + Financeiro só com módulo. Criar board "Cobrança" com etapas 1x/2x/3x/4x. Caso novo aparece na 1ª etapa do principal. "Adicionar à lista/board" → caso surge na Lista 2 + evento na timeline. Arrastar no board custom move a posição (não mexe no op). Renomear board reflete no seletor. Filtros/campos idênticos ao trocar de board.
- **RBAC:** usuário sem módulo financeiro NÃO vê o board Financeiro no seletor nem acessa a rota.
- **Rollback:** aplicar rollback → tabelas/coluna somem, view e trigger intactos, casos íntegros.
- `npm run typecheck` / `npm run lint` / `npm run build` verdes; sem erro novo além do baseline conhecido.

## Dependências

- **Depende de:** camada TEMA→service_type espelho 1:1 (R2-01/R2-03, já aplicadas) — os boards penduram no `service_type_id` interno do tema (`getTemaServiceType`). Campos/filtros por tema (R2-09 e melhorias 2026-07-29, aplicadas).
- **Integra com A6 (timeline):** os eventos `board_added` e `board_stage_changed` alimentam a timeline do caso — alinhar o schema de `system_case_events`/action names com A6.
- **Habilita:** sub-fluxos operacionais paralelos por tema (cobrança de documento, SIGIN, renovação) sem duplicar cadastro.
- **PRÉ-REQUISITO DE NEGÓCIO (não bloqueia a modelagem, bloqueia o povoamento):** lista dos boards extras que o owner quer por tema (nomes + etapas). A migration cria só o board principal; os boards custom são criados pelo admin na UI.
- **Cruza com:** RBAC de módulos (`rbac.ts`, `requireModule`) para o board financeiro.

## File List

**Entregues nesta rodada (2026-08-04):**
- `sistema-hv/supabase/migrations/20260804000004_pipeline_boards.sql` (novo — APLICADO)
- `sistema-hv/supabase/rollbacks/20260804000004_pipeline_boards.rollback.sql` (novo)
- `sistema-hv/src/lib/supabase/types.ts` (tipos: `system_pipeline_boards`, `system_case_board_positions`, views `_active`, `system_pipeline_stages.board_id`)
- `sistema-hv/src/lib/board-service.ts` (novo — CRUD boards/etapas + posição do caso)
- `sistema-hv/src/rpc/boards.ts` (novo — endpoints RPC de board)
- `sistema-hv/src/hooks/useBoards.ts` (novo — hooks de board)
- `sistema-hv/src/components/cases/AddCaseToBoardDialog.tsx` (novo — molde `MoveCaseFinDialog.tsx`)
- `sistema-hv/src/components/pipeline/BoardsManagerDialog.tsx` (novo — gestor de listas + etapas)
- `sistema-hv/src/routes/pipeline.tsx` (seletor `BoardSelector` + `CustomBoardKanban` + search param `board`; `DynamicKanban` virou wrapper que delega a `PrincipalKanban`/`CustomBoardKanban`)
- `sistema-hv/src/routes/casos.$id.tsx` (botão "Adicionar à lista" + `AddCaseToBoardDialog`)

**INTENCIONALMENTE NÃO tocados (evitar risco no op/fin — decisão travada):**
- `sistema-hv/src/lib/pipeline-service.ts` — boards custom têm serviço próprio; `createStage`/`softDeleteStage` do op ficam intactos.
- `sistema-hv/src/lib/cases-service.ts` — board principal via reconciliação on-read (sem escrita no `createCase`).
- `sistema-hv/src/components/cases/KanbanBoard.tsx` — já era genérico; reusado sem alteração.
- `sistema-hv/src/components/cases/StageEditor.tsx` / `StageChecklistEditor.tsx` — op/fin e checklist inalterados.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-08-03 | 0.1 | Draft inicial — item de maior esforço estrutural do épico Reunião 2026-08-03. Modelagem recomendada: Opção A (`system_pipeline_boards` + `system_pipeline_stages.board_id` + `system_case_board_positions`), aditiva, isolando boards extras do dual-write op/fin, campos/filtros compartilhados por tema (regra dura), financeiro preservado como board reservado gateado por RBAC. 12 Acceptance Criteria. Decisão de modelagem a travar com @architect antes de codar. | @sm |
| 2026-08-04 | 0.2 | **Núcleo estrutural IMPLEMENTADO + Opção A TRAVADA.** Migration `20260804000004_pipeline_boards.sql` aplicada e confirmada no banco (dev=prod): `system_pipeline_boards` (13 boards principais 1:1 por service_type, sentinela excluído), `system_pipeline_stages.board_id` (nullable, ON DELETE CASCADE), `system_case_board_positions` (UNIQUE case×board). RLS/grants/views `_active`/auditoria em ambas as tabelas. **Decisão fina:** board principal = espelho virtual do op (reconciliação on-read → `createCase`/trigger/`system_cases` INTOCADOS, regressão zero); op/fin legados `board_id=NULL`; checklist em boards custom fora da v1 (AC-12). Serviço `board-service.ts` (CRUD boards/etapas + `addCaseToBoard`/`moveCaseInBoard`/`listCasesByBoard`, guardas 409, tombstone de slug, eventos `board_added`/`board_stage_changed` na timeline — integra A6). RPC `rpc/boards.ts` + hooks `useBoards.ts`. UI: `BoardSelector` + `CustomBoardKanban` + search param `board` em `pipeline.tsx`; `BoardsManagerDialog` (criar/renomear/excluir board + etapas); botão "Adicionar à lista" + `AddCaseToBoardDialog` na ficha. Financeiro preservado como entrada gateada (`financeiro.manage`). **Validação:** smoke DB OK (unicidade do principal e da posição rejeitadas; mover em board custom NÃO altera `macrostatus_op`/`stage_op_id`), `tsc --noEmit` sem erro novo (só baseline `contaazul/service.ts`), `eslint` exit 0 nos tocados, `vite build` verde. **Follow-ups declarados** (nada quebrado): reordenar boards/etapas na UI (backend pronto), edição de `stage_role`/cor/ordem de etapas custom, smoke UI Playwright, toggle Kanban↔Lista dentro de board custom, checklist em boards custom. | @architect + @dev (Claude Opus 4.8) |
