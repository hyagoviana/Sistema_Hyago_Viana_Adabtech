# Story C4: Pop-up de seleção de kanban ao entrar num TEMA com mais de 1 kanban

- **Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
- **ID:** C4
- **Status:** Ready for Review
- **Estimativa relativa:** M (só UI/roteamento — sem migration, sem serviço novo; reusa `useBoards`)
- **Executor sugerido:** @dev (UI/roteamento) · Quality gate: @qa
- **Risco:** BAIXO (não toca dados; muda o comportamento de navegação ao selecionar um tema no Pipeline)

---

## Story

**Como** operador que clica num TEMA na tela do Pipeline,
**quero** que, se o tema tiver **mais de um kanban** (principal + custom, ex.: "Mais Médicos" + "Inadimplência"), apareça um **pop-up com quadradinhos** (título de cada board + prévia dos funis/etapas) para eu **escolher em qual kanban entrar**; e que, se o tema tiver **só 1 kanban**, eu entre **direto** (sem pop-up),
**para que** a escolha do sub-fluxo seja explícita e rápida, sem uma "página do meio" que atrapalhe a usabilidade.

> **Frase do levantamento (Bloco C, item C4):** *"Pop-up de seleção de Kanban ao entrar num tema com >1 Kanban (quadradinhos com título + funis). Se só há 1, entra direto. Decisão final: pop-up (não 'página do meio'), pra não quebrar usabilidade."* Status **NOVO**, prioridade 🟡.

Hoje, ao clicar num card de tema em `pipeline.tsx` (`ServiceTypeSelection` → `onPick`), a navegação vai **direto** para o kanban principal (`DynamicKanban` sem `board`). Já existe um seletor de kanban DENTRO da esteira (o `KanbanDropdown`/"Escolher kanban" da toolbar), mas o owner quer a escolha **na entrada**, via pop-up visual com prévia dos funis — não escondida num dropdown.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (não reinventar)

- **Tela de seleção de temas:** `sistema-hv/src/routes/pipeline.tsx` → `ServiceTypeSelection` (`:103-223`). Cada card chama `onPick({ id: service_type_id, name })` que faz `navigate({ to:"/pipeline", search:{ cat, catName } })` (`:86-87`). O `cat` no search param abre o `DynamicKanban`.
- **`DynamicKanban`** (`:228-283`) já resolve o board via `useBoards(serviceType.id)` + search param `board`; delega a `PrincipalKanban` (board principal) ou `CustomBoardKanban`. **A infra de "abrir num board específico" já existe** — basta semear o `board` correto na entrada.
- **`useBoards(serviceTypeId)`** (`sistema-hv/src/hooks/useBoards.ts`) → lista os boards do tema (id, label, is_principal, ordem). `ensurePrincipalBoard` garante ≥1 board principal.
- **`useBoardStages(boardId)`** → etapas (funil) de um board custom. Para o principal, as etapas são as op (`useStages(serviceType.id, "op")`, `sistema-hv/src/hooks/usePipeline.ts`) — usadas para a prévia dos funis do principal.
- **`KanbanDropdown`** (`pipeline.tsx:569-618`) — o seletor de kanban da toolbar (dropdown textual). O pop-up C4 é a **entrada visual** (quadradinhos), enquanto o dropdown continua servindo para **trocar** de kanban já dentro da esteira. Ambos coexistem.
- **Molde de Dialog:** `sistema-hv/src/components/ui/dialog.tsx` (usado em `AddCaseToBoardDialog.tsx`, `MoveCaseFinDialog.tsx`) — `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`.
- **Cards visuais (molde de "quadradinho"):** o card de tema em `ServiceTypeSelection` (`:178-211`, `card-hero`, ícone `FolderKanban`, gradiente gold) é o padrão visual a espelhar nos quadradinhos de board.
- **RBAC do financeiro:** o board financeiro é reservado (gate `requireModule('financeiro')` / `usePodeVer`) — **não** entra nos boards de `system_pipeline_boards`; o pop-up C4 lista só os boards operacionais (principal + custom). (Se o owner quiser o Financeiro como quadradinho gateado, isso é um follow-up — hoje o financeiro tem rota própria.)

### NOVO nesta story

1. **Interceptar o clique no card de tema:** em vez de navegar direto, resolver os boards do tema. Se **>1 board** → abrir o **pop-up** de seleção. Se **1 board** → navegar direto ao principal (comportamento atual).
2. **Componente `KanbanPickerDialog`** (novo): pop-up com um grid de quadradinhos, um por board (principal + customs), cada um com **título** (label) e **prévia dos funis** (nomes das etapas em sequência, ex.: "Documentos iniciais → Protocolo → …"). Clicar num quadradinho navega para `/pipeline?cat=…&board=…` (ou sem `board` para o principal).
3. **Regra "entra direto com 1 kanban":** temas recém-criados / sem boards custom não veem o pop-up (paridade com hoje).

---

## Decisão a travar (com @dev, ANTES de codar — registrar no Change Log)

### Ponto aberto 1 — onde resolver o número de boards
- O clique no card acontece em `ServiceTypeSelection`, mas `useBoards` precisa do `service_type_id` do tema clicado. **Opção A (RECOMENDADA):** ao clicar, setar um estado `pickerForServiceType={ id, name }` e montar o pop-up que **ele mesmo** chama `useBoards(id)`; quando resolver, se `boards.length <= 1` fecha e navega direto (efeito no `useEffect`), senão exibe os quadradinhos. **Opção B (REJEITADA):** pré-carregar `useBoards` de TODOS os temas na tela de seleção — desperdício (N queries) e complexidade.
- **Nuance:** com Opção A há um flash mínimo (abrir → resolver → talvez fechar-e-navegar). Mitigar: enquanto `isLoading`, mostrar um spinner curto no dialog; se 1 board, navegar sem renderizar os quadradinhos.

### Ponto aberto 2 — prévia dos "funis"
- Cada quadradinho mostra a sequência de etapas. Para o **principal**, as etapas vêm de `useStages(serviceType.id, "op")`; para **customs**, de `useBoardStages(boardId)`. Carregar as etapas de todos os boards ao abrir o pop-up pode ser N queries. **Decisão sugerida:** prévia **leve** — mostrar só a contagem de etapas + as 3 primeiras labels ("Etapa A · Etapa B · Etapa C · +2"), buscando etapas sob demanda por board (ou um endpoint agregado leve). Travar o nível de detalhe da prévia com o owner/@ux; começar simples (contagem + primeiras labels).

### Ponto aberto 3 — o Financeiro aparece no pop-up?
- Decisão registrada no levantamento: o pop-up é de **kanbans do tema** (operacionais). O Financeiro é board reservado com rota própria e RBAC. **Sugestão:** NÃO incluir o Financeiro no pop-up C4 na v1 (evita confundir a escolha operacional com o módulo financeiro). Confirmar com owner; se quiserem, entra como follow-up gateado.

---

## Acceptance Criteria

1. **Pop-up só com >1 kanban.** Ao clicar num card de tema em `pipeline.tsx`: se o tema tem **2+ boards** (principal + ≥1 custom), abre o `KanbanPickerDialog` (pop-up). Se tem **exatamente 1** (só o principal), navega **direto** para o kanban principal, sem pop-up (paridade com hoje).
2. **Quadradinhos por board.** O pop-up mostra um grid de quadradinhos, um por board, com: **título** (label do board; o principal aparece rotulado como principal), e uma **prévia dos funis** (contagem de etapas + primeiras labels em sequência). O principal vem primeiro; customs por `ordem`.
3. **Navegação ao escolher.** Clicar num quadradinho navega para `/pipeline?cat={service_type_id}&catName={name}` e, para board custom, adiciona `&board={board_id}`; para o principal, sem `board`. A esteira abre já no board escolhido (`DynamicKanban` respeita o search param).
4. **Sem "página do meio".** A seleção é um **Dialog/pop-up** sobre a tela de temas — nunca uma rota/página intermediária dedicada. Fechar o pop-up (Esc/backdrop/Cancelar) volta à tela de temas sem navegar.
5. **Estado de carregamento.** Enquanto `useBoards` resolve, o pop-up mostra um indicador curto; se o resultado for 1 board, fecha e navega sem exibir quadradinhos (sem flash de conteúdo vazio).
6. **Coexistência com o dropdown da toolbar.** O `KanbanDropdown`/"Escolher kanban" DENTRO da esteira continua funcionando (trocar de kanban sem voltar). O pop-up é só a **entrada**; nada do fluxo interno é removido.
7. **RBAC / boards ativos.** O pop-up lista só boards ativos (`system_pipeline_boards_active` via `useBoards`). O Financeiro não aparece no pop-up na v1 (board reservado). Usuário sem `config.manage` também vê o pop-up (é navegação, não edição) — só não vê os botões de gestão.
8. **Regressão zero.** Deep-links existentes (`/pipeline?cat=…&board=…`) continuam abrindo direto no board certo, sem passar pelo pop-up (o pop-up é acionado só pelo clique no card de tema, não pela presença de search params).

---

## Tasks / Subtasks

- [x] **T1 — Decisão (@dev)** (AC: 1, 2) — travada Opção A (pop-up resolve `useBoards` do tema clicado) + prévia leve dos funis (contagem via "+N" + 3 primeiras labels) + Financeiro fora da v1. Registrado no Change Log.
- [x] **T2 — Componente `KanbanPickerDialog` (@dev)** (AC: 2, 3, 4, 5) — novo `sistema-hv/src/components/pipeline/KanbanPickerDialog.tsx` (molde `BoardsManagerDialog.tsx` + card de `ServiceTypeSelection`):
  - [x] props: `open`, `onOpenChange`, `serviceType {id,name}`, `temaId`, `onNavigate`.
  - [x] `useBoards(serviceType.id)`; se `<=1` board e `open`, `onNavigate(null)` e fecha (via `useEffect`).
  - [x] grid de quadradinhos (principal primeiro + customs por `ordem`); título + prévia de etapas + selo "Principal".
  - [x] prévia leve dos funis (contagem + 3 primeiras labels) — principal via `useStages(op)`, custom via `useBoardStages` (lazy por card, sem N+1 upfront).
  - [x] ao clicar num quadradinho: `onNavigate(boardId|null)` → o chamador navega `/pipeline?cat&catName(&board)`.
- [x] **T3 — Interceptar o clique no card (@dev)** (AC: 1, 8) — em `pipeline.tsx` `ServiceTypeSelection`: o card agora seta `pickerFor={serviceTypeId,name,temaId}` (abre o `KanbanPickerDialog`) em vez de navegar direto. O pop-up decide entrar direto (1 board) ou mostrar a escolha (>1). Deep-links (`cat`/`board` na URL) continuam abrindo `DynamicKanban` sem pop-up (o pop-up só é acionado pelo clique no card).
- [x] **T4 — Prévia de funis leve (@dev)** (AC: 2) — prévia sob demanda por board (cada card resolve suas etapas), formato "Etapa A · Etapa B · Etapa C · +N". Sem N+1 upfront.
- [x] **T5 — Gates (@dev)** (AC: 1, 3, 4) — `npm run typecheck` limpo (só o erro pré-existente `contaazul/service.ts`); `eslint` 0 nos arquivos tocados. Smoke UI Playwright pendente para @qa.

---

## Dev Notes

- **Não é rota nova:** decisão do owner é **pop-up**, não página intermediária. Usar `Dialog` sobre `ServiceTypeSelection`. Nenhuma alteração no `routeTree` (evita o gotcha do OneDrive travando `routeTree.gen.ts`).
- **`DynamicKanban` já faz o trabalho:** ele lê `board` do search param e escolhe `PrincipalKanban`/`CustomBoardKanban`. C4 só precisa **semear** o search param certo na entrada. Não reescrever a esteira.
- **Entrar direto com 1 board:** hoje o clique já entra direto no principal — preservar exatamente esse comportamento quando `boards.length <= 1`. O pop-up só existe para desambiguar >1.
- **Prévia de funis:** cuidado com N+1. Se ficar pesado, começar com só a **contagem** de etapas por board e evoluir. O owner pediu "quadradinhos com título + funis" — o essencial é título + noção do funil; detalhe pode ser incremental.
- **Coexistência:** NÃO remover o `KanbanDropdown` da toolbar (troca de kanban dentro da esteira). São dois pontos de entrada complementares.
- **Financeiro:** fora do pop-up na v1 (board reservado, rota própria, RBAC). Registrar como follow-up se o owner quiser.
- **Sem migration, sem serviço novo** — só UI/roteamento e reuso de hooks A3.

## Testing

- **UI (Playwright/manual):**
  - Tema com só o principal → clicar no card entra direto na esteira (sem pop-up).
  - Tema com principal + "Inadimplência" → clicar no card abre o pop-up com 2 quadradinhos; clicar em "Inadimplência" abre a esteira nesse board (`?board=`); clicar no principal abre sem `board`.
  - Esc/backdrop/Cancelar fecham o pop-up e permanecem na tela de temas.
  - Deep-link `/pipeline?cat=…&board=…` abre direto no board (sem pop-up).
- **Loading:** tema com boards ainda carregando → indicador; resolve p/ 1 → navega sem flash.
- `npm run typecheck` / `npm run lint` / `npm run build` verdes.

## Dependências

- **Depende de A3** (Reunião 2026-08-03) — `useBoards`, `DynamicKanban`, `system_pipeline_boards`. Sem A3 não há múltiplos boards para escolher.
- **Cruza com C5** (links úteis/wiki por tema) — o levantamento diz que a wiki "aparece na entrada do tema (junto ao pop-up C4)". Alinhar o layout: o `KanbanPickerDialog` pode hospedar (ou abrir ao lado) o bloco de links úteis do C5. Coordenar o ponto de montagem.
- **Cruza com C3** (rastro multi-kanban) — mesma família de features de múltiplos boards.

## File List

**Novos**
- `sistema-hv/src/components/pipeline/KanbanPickerDialog.tsx`

**Alterados**
- `sistema-hv/src/routes/pipeline.tsx` (`ServiceTypeSelection` intercepta o clique → abre o pop-up; entra direto com 1 board)

## Change Log

| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Novo `KanbanPickerDialog.tsx` (pop-up com quadradinhos por board + prévia leve dos funis + selo Principal; entra direto se ≤1 board via `useEffect`). `pipeline.tsx` `ServiceTypeSelection` intercepta o clique no card → `pickerFor{serviceTypeId,name,temaId}` abre o pop-up (removido o `onPick` direto do `PipelinePage`). Reusa `useBoards`/`useBoardStages`/`useStages`; navegação semeia o search param `board` (deep-links inalterados). Hospeda o quadro de Links úteis do C5 por `temaId`. Decisão: Opção A + Financeiro fora da v1. Sem migration. Arquivos: `src/components/pipeline/KanbanPickerDialog.tsx` (novo), `src/routes/pipeline.tsx`. Gates: typecheck OK (só erro pré-existente contaazul), eslint 0 nos tocados. | @dev |
