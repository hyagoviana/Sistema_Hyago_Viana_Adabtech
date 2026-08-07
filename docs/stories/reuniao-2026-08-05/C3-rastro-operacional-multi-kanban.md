# Story C3: Rastro operacional MULTI-KANBAN — a ficha mostra TODOS os kanbans/etapas do caso

- **Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
- **ID:** C3
- **Status:** Ready for Review
- **Estimativa relativa:** M/L (leitura agregada nova + serviço + hook + UI da ficha; sem migration nova — reusa toda a infra A3)
- **Executor sugerido:** @dev (leitura agregada + UI) · Quality gate: @qa
- **Risco:** MÉDIO (mexe no bloco "Rastro Operacional" da ficha do caso, área central; e depende de derivar o rótulo da etapa do board custom a partir de `stage_slug`)

---

## Story

**Como** operador que abriu a ficha de um caso que foi **DUPLICADO em mais de um kanban do mesmo tema** (ex.: "Mais Médicos › Documentos iniciais" **e** "Inadimplência › Cobrança total"),
**quero** que o bloco **"Rastro Operacional"** da ficha liste **TODOS** os kanbans/etapas em que o caso está posicionado (não só um),
**para que** eu enxergue de relance a situação do caso em cada sub-fluxo paralelo, sem precisar abrir cada kanban para descobrir onde ele está.

> **Frase do levantamento (Bloco C, item C3):** *"Rastro operacional deve mostrar todos os Kanbans/etapas em que o caso está (quando duplicado em 2). Hoje mostra um só. Ex.: 'Mais Médicos › Documentos iniciais' e 'Inadimplência › Cobrança total'."* Status **PARCIAL**, prioridade 🔴.

Hoje o bloco "Rastro Operacional" (`casos.$id.tsx:390-397`) mostra **apenas** o `macrostatus_op` do caso — que é a posição no board **principal** (espelho do operacional). Quando o caso foi duplicado (via A3 / "Adicionar à lista" / "Mover status" para outro kanban), sua posição nos boards **custom** vive em `system_case_board_positions` e **não é lida** por essa ficha. Esta story soma essas posições ao rastro.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (não reinventar — reusar como base)

- **A3 (Reunião 2026-08-03) entregou toda a modelagem de múltiplos boards por tema:**
  - `system_pipeline_boards` (boards por `service_type_id`; 1 `is_principal` + N custom) — `sistema-hv/supabase/migrations/20260804000004_pipeline_boards.sql`.
  - `system_pipeline_stages.board_id` (etapas de board custom; op/fin legado = NULL).
  - `system_case_board_positions` (`case_id`, `board_id`, `stage_id`, `stage_slug`, `entered_at`, `exclusive`, `deleted_at`) + view `system_case_board_positions_active` — **a posição do caso em cada board custom.**
- **Board principal = espelho virtual do operacional:** a posição no principal é `system_cases.macrostatus_op` (lida on-read, sem linha em `system_case_board_positions`). O rótulo op vem de `MACRO_OP_LABELS` (`sistema-hv/src/lib/cases/constants.ts`) — é o `opLabel` já computado em `casos.$id.tsx:213`.
- **Serviço de board** `sistema-hv/src/lib/board-service.ts`:
  - `listCaseBoards(caseId)` → `string[]` de `board_id` **custom** ativos do caso (só IDs).
  - `listBoards(serviceTypeId)` → boards do tema (id, label, is_principal, ordem).
  - `listStagesByBoard(boardId)` / `firstStageOfBoard` — etapas de um board custom (id, slug, label, stage_role, ordem).
  - As etapas do board custom têm `slug` (interno único) + `label` (exibido). A posição guarda `stage_slug` → para exibir o **label** da etapa é preciso casar `stage_slug` com a etapa do board.
- **Ficha do caso** `sistema-hv/src/routes/casos.$id.tsx`:
  - Bloco **"Rastro Operacional"** em `:390-397` (`<Eyebrow>Rastro Operacional</Eyebrow>` + `opLabel` + "há N dias neste estado").
  - Bloco **"Rastro Financeiro"** logo ao lado (`:399-421`) — **fora de escopo** desta story (o financeiro é board reservado).
  - Já tem `caso.service_type_id`, `caso.macrostatus_op`, `caso.tema_id`.
- **Hooks de board** `sistema-hv/src/hooks/useBoards.ts`: `useCaseBoards(caseId)`, `useBoards(serviceTypeId)`, `useBoardStages(boardId)`. **Nota:** `useCaseBoards` hoje só devolve IDs — não traz label do board nem label da etapa; por isso um agregador novo é mais barato que orquestrar 3 hooks na ficha.
- **Timeline** `sistema-hv/src/components/cases/CaseTimeline.tsx` já rotula os eventos `board_added` / `board_moved_exclusive` / `board_stage_changed` / `board_removed` — **contexto histórico** (não é o rastro atual; o rastro é o estado corrente).
- **RPC** `sistema-hv/src/rpc/boards.ts` (molde de `createServerFn` + `requireModule("operacional")` para writes, `requireAuth` para reads).

### NOVO nesta story

1. **Leitura agregada "rastro do caso":** uma função de serviço `listCaseOperationalTrail(caseId)` que retorna, para UM caso, a **lista** de posições operacionais:
   - o **principal** (label do board principal + label da etapa op derivada de `macrostatus_op` + `entered_at` aproximado, se disponível), e
   - **cada board custom** em que o caso está posicionado (label do board + label da etapa, via `stage_slug` → `stages.label`, + `entered_at`).
2. **Hook** `useCaseOperationalTrail(caseId)`.
3. **UI:** o bloco "Rastro Operacional" da ficha passa a renderizar **N linhas** (uma por kanban): `"{board.label} › {stage.label}"` + "há X dia(s)". Se o caso está só no principal (caso comum), o bloco fica **idêntico ao de hoje** (uma linha) — regressão visual zero.

---

## Decisão a travar (com @dev, ANTES de codar — registrar no Change Log)

> **Regra de ouro herdada de A3:** a posição no board principal é `macrostatus_op` (NÃO tem linha em `system_case_board_positions`). O rastro NUNCA deve escrever nada — é **read-only** puro. Não tocar o trigger `system_fn_sync_stage_ids`, `system_cases`, nem os handlers de move op/fin.

### Ponto aberto 1 — onde montar a agregação
- **Opção A (RECOMENDADA):** nova função `listCaseOperationalTrail(caseId)` em `board-service.ts` que faz o join `system_case_board_positions_active × system_pipeline_boards_active × system_pipeline_stages_active` e devolve as linhas já com labels resolvidos, incluindo o principal (derivado de `macrostatus_op` + label do board principal + `MACRO_OP_LABELS`... — ou devolvendo `stage_slug` cru e deixando a ficha rotular o principal com o `opLabel` que já tem). **Vantagem:** uma chamada, sem N+1 de hooks na ficha.
- **Opção B (REJEITADA):** orquestrar `useCaseBoards` + `useBoards` + `useBoardStages` (um por board) na ficha. **Rejeitada:** N+1 de hooks, mais re-renders, e teria que casar `stage_slug`→label no cliente para cada board.

### Ponto aberto 2 — rótulo da etapa op do principal
- O principal não tem `stage_slug` em `system_case_board_positions`; sua etapa é `macrostatus_op`. **Decisão sugerida:** deixar o **serviço** devolver a linha do principal com `stage_slug = macrostatus_op` e `stage_label = null` (a ficha usa o `opLabel` que já computa) OU o serviço resolve o label do principal via `system_pipeline_stages` (kind='op', slug=macrostatus_op, board_id IS NULL). Travar qual — o mais simples é a ficha manter o `opLabel` para o principal e usar o serviço só para os customs. **Recomendação:** serviço devolve **ambos** (principal + customs) com labels resolvidos, para a UI só iterar; assim o comportamento fica uniforme.

### Ponto aberto 3 — "há N dias neste estado" do principal
- Para os customs, `entered_at` existe em `system_case_board_positions`. Para o principal, a ficha hoje calcula `dias` a partir de algum campo do caso (verificar `casos.$id.tsx` — provavelmente `updated_at`/`stage_op` timestamp). **Decisão:** manter o cálculo do principal como está; para os customs usar `entered_at`. Se não houver `entered_at` para uma linha, omitir o "há N dias".

---

## Acceptance Criteria

1. **Serviço de leitura agregada.** Nova função `listCaseOperationalTrail(caseId)` em `sistema-hv/src/lib/board-service.ts` devolve, para um caso, um array ordenado de posições operacionais: (a) o **board principal** (label + rótulo da etapa op derivada de `macrostatus_op` + timestamp de entrada, se houver) sempre em primeiro; (b) **uma entrada por board custom** em que o caso tem posição ativa (`system_case_board_positions_active`), com `board_label`, `stage_label` (resolvido de `stage_slug` via `system_pipeline_stages_active` do board) e `entered_at`. Read-only — a função NÃO escreve.
2. **RPC + hook.** `listCaseOperationalTrailFn` (`createServerFn` GET, `requireAuth`) em `sistema-hv/src/rpc/boards.ts` + hook `useCaseOperationalTrail(caseId)` em `sistema-hv/src/hooks/useBoards.ts`. `npm run typecheck` limpo.
3. **UI — bloco "Rastro Operacional" multi-linha.** Em `sistema-hv/src/routes/casos.$id.tsx`, o bloco "Rastro Operacional" (`:390-397`) passa a renderizar **uma linha por kanban** no formato `"{board.label} › {stage.label}"` + "há N dia(s) neste estado" (quando houver `entered_at`). A ordem é: principal primeiro, depois os customs por `ordem` do board.
4. **Regressão visual para caso só no principal.** Um caso que NÃO está em nenhum board custom mostra **exatamente uma linha** (o principal), visualmente equivalente ao rastro de hoje (mesmo rótulo op, mesmo "há N dias"). Nenhum caso comum ganha ruído.
5. **Casamento etapa custom → label correto.** Para um caso duplicado num board custom "Inadimplência" na etapa "Cobrança total", a linha exibe "Inadimplência › Cobrança total" (o `stage_slug` interno é casado ao `label` da etapa do board — nunca exibe o slug cru).
6. **Não afeta o Rastro Financeiro nem op/fin.** O bloco "Rastro Financeiro" permanece inalterado. Mover/duplicar continua pelos caminhos A3 existentes. `macrostatus_op`/`stage_op_id` do caso não são lidos para escrita nem alterados.
7. **RBAC/visibilidade.** O rastro só aparece na ficha que o usuário já pode ver (a rota `casos.$id` já aplica visibilidade). O agregado não expõe boards/casos além do caso aberto. Se um board custom foi soft-deletado, sua posição não aparece (usa as views `_active`).
8. **Estado de carregamento e vazio.** Enquanto carrega, o bloco mostra o principal (dado já presente no `caso`) sem piscar; os customs aparecem quando o hook resolve. Se o agregado falhar, o bloco degrada para exibir só o principal (nunca quebra a ficha).

---

## Tasks / Subtasks

- [x] **T1 — Decisão de leitura (@dev)** (AC: 1) — Opção A travada: agregador `listCaseOperationalTrail` no serviço. O **principal** entra no array com label JÁ resolvido no serviço (label do board principal + rótulo op via `MACRO_OP_LABELS`), `board_id: null` marca a linha virtual. A ficha renderiza o principal como só a etapa op (regressão zero) e os customs como `board › etapa`.
- [x] **T2 — Serviço `listCaseOperationalTrail` (@dev)** (AC: 1, 5) — em `board-service.ts`:
  - [x] Carrega o caso (`system_cases`): `service_type_id`, `macrostatus_op`, `status_changed_at` (mesmo campo do `dias` da ficha).
  - [x] Carrega os boards do tema (`listBoards`) → identifica o principal.
  - [x] Monta a linha do **principal**: `board_label` = label do principal; `stage_label` = `MACRO_OP_LABELS[macrostatus_op]` (fallback: valor cru). `entered_at` = `status_changed_at`.
  - [x] Carrega `system_case_board_positions_active` do caso; casa `(board_id, stage_slug)` → `label` da etapa via `system_pipeline_stages_active` (1 leitura, sem N+1). Uma linha por board custom; posições de boards de outro tema/soft-deletados são descartadas (via `listBoards`).
  - [x] Retorna array ordenado (principal → customs por `ordem` do board).
- [x] **T3 — RPC (@dev)** (AC: 2) — `listCaseOperationalTrailFn` (GET, `requireAuth`) em `rpc/boards.ts`.
- [x] **T4 — Hook (@dev)** (AC: 2) — `useCaseOperationalTrail(caseId)` em `useBoards.ts` (queryKey `["case-op-trail", caseId]`).
- [x] **T5 — UI da ficha (@dev)** (AC: 3, 4, 8) — em `casos.$id.tsx`, bloco "Rastro Operacional" faz `.map` das entradas (principal só etapa op; custom = `board › etapa`; "há N dias" quando há `entered_at`). Fallback: sem `opTrail` resolvido → linha do principal com `opLabel`/`dias` já disponíveis (idêntico ao de hoje).
- [x] **T6 — Invalidação nos mutations de board (@dev)** (AC: 3) — `["case-op-trail", caseId]` invalidado em `useAddCaseToBoard`/`useMoveCaseBetweenBoards`/`useReturnCaseToPrincipal`/`useRemoveCaseFromBoard`/`useMoveCaseInBoard`.
- [ ] **T7 — Smoke DB (@qa)** (AC: 1, 5) — script que: cria board custom + etapa, duplica um caso nele, e confirma que `listCaseOperationalTrail` devolve 2 linhas (principal + custom com label correto). Rodar via `npx tsx` (molde `sistema-hv/scripts/smoke-*`).
- [x] **T8 — Gates (@dev/@qa)** — `npm run typecheck` limpo nos arquivos tocados (só resta o erro PRÉ-EXISTENTE `contaazul/service.ts`); `npx eslint` nos 4 arquivos alterados = 0. `npm run build`/smoke UI ficam p/ @qa.

---

## Dev Notes

- **Reuso máximo de A3:** nenhuma migration nova. A leitura já é possível com `system_case_board_positions_active` + `system_pipeline_boards_active` + `system_pipeline_stages_active`. O gargalo é só **resolver labels** (board e etapa) e **incluir o principal** (que é virtual).
- **Casar `stage_slug` → label:** as etapas de board custom têm slug interno único (`slugify(label)+token`), então o `stage_slug` guardado na posição casa 1:1 com a etapa do board via `system_pipeline_stages_active` (`board_id = pos.board_id AND slug = pos.stage_slug`). Nunca exibir o slug cru (AC-5).
- **Principal é virtual:** ele não tem linha em `system_case_board_positions`. Trate-o explicitamente como a primeira entrada, derivada de `macrostatus_op`. Isso preserva a regra de A3 (regressão zero op/fin).
- **Read-only:** o rastro JAMAIS escreve. Não chamar `moveCaseInBoard`/`addCaseToBoard` daqui.
- **`entered_at` do principal:** verificar em `casos.$id.tsx` qual campo alimenta `dias` hoje (não inventar). Reusar o mesmo para a linha do principal.
- **Financeiro fora:** o "Rastro Financeiro" é outro bloco e outro board (reservado). Não tocar.
- **dev = prod:** sem migration nesta story, mas se algum smoke precisar semear board/etapa, usar `db-apply-pg` só em dev-scripts, nunca em prod sem necessidade.

## Testing

- **Smoke DB:** duplicar um caso num board custom "Inadimplência" na etapa "Cobrança total" → `listCaseOperationalTrail` retorna `[{board:"principal", stage:<op label>}, {board:"Inadimplência", stage:"Cobrança total"}]`. Remover a posição custom → volta a 1 linha.
- **Regressão:** um caso sem posição custom → exatamente 1 linha (principal), idêntica ao rastro atual.
- **UI (manual/Playwright):** abrir a ficha de um caso duplicado em 2 kanbans → o bloco "Rastro Operacional" lista os 2 (`Tema1 › EtapaA` e `Tema/Board2 › EtapaB`). Abrir um caso comum → 1 linha.
- **Degradação:** simular falha do agregado → a ficha ainda mostra o principal (não quebra).
- `npm run typecheck` / `npm run lint` / `npm run build` verdes.

## Dependências

- **Depende de A3** (Reunião 2026-08-03) — toda a infra de `system_pipeline_boards` / `system_case_board_positions` / `board-service.ts` já está aplicada e no banco.
- **Cruza com C4** (pop-up de seleção de kanban) e **C2** ("vincular ao kanban" duplicar/mover) — o rastro reflete exatamente as posições que esses fluxos criam.
- **Não** depende de migration nova.

## File List

**Novos**
- (nenhum arquivo novo obrigatório — reusa A3)

**Alterados**
- `sistema-hv/src/lib/board-service.ts` (função `listCaseOperationalTrail`)
- `sistema-hv/src/rpc/boards.ts` (`listCaseOperationalTrailFn`)
- `sistema-hv/src/hooks/useBoards.ts` (`useCaseOperationalTrail` + invalidação nos mutations de board)
- `sistema-hv/src/routes/casos.$id.tsx` (bloco "Rastro Operacional" → multi-linha)
- `sistema-hv/scripts/` (smoke opcional do rastro agregado)

## Change Log

| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Opção A: novo `listCaseOperationalTrail(caseId)` em `board-service.ts` agrega principal (virtual, `macrostatus_op`→`MACRO_OP_LABELS`, `entered_at`=`status_changed_at`) + boards custom de `system_case_board_positions_active` com labels resolvidos (etapa casada por `(board_id, stage_slug)` nas `system_pipeline_stages_active`, 1 leitura), ordenado principal→customs por `ordem`; read-only puro. RPC `listCaseOperationalTrailFn` (GET, requireAuth) em `rpc/boards.ts`; hook `useCaseOperationalTrail` + invalidação `["case-op-trail", caseId]` nos 5 mutations de board em `useBoards.ts`; UI: bloco "Rastro Operacional" em `casos.$id.tsx` agora multi-linha com fallback ao principal (regressão zero p/ caso comum) — edição cirúrgica, trabalho da J2 (botão editar nome no título) preservado. Arquivos: `board-service.ts`, `rpc/boards.ts`, `hooks/useBoards.ts`, `routes/casos.$id.tsx`. Gates: typecheck limpo (só resta erro pré-existente `contaazul/service.ts`); eslint 0 nos 4 arquivos. Sem migration. T7 smoke DB p/ @qa. | @dev |
