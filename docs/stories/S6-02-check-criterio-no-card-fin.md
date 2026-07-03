# Story S6-02: Check do critério DENTRO do card do Kanban financeiro

- **Sprint:** 6 — Financeiro incremental (critérios editáveis + check no card) `[Frente A]`
- **ID:** S6-02
- **Status:** Ready for Review
- **Estimativa relativa:** M (front — extrair subcomponente compartilhado da lista de itens + expand/popover no `CaseCardFin`; reusa `useChecklist`/`marcarItemChecklist`; **SEM migration**)
- **Executor sugerido:** @dev (front) · Quality gate: @architect

---

## Story

**Como** operador do financeiro,
**quero** dar **check** nos critérios da etapa atual **direto no card** do Kanban financeiro (sem abrir a ficha do caso),
**para que** eu conclua o checklist e o card avance sozinho para a próxima etapa — reusando o gate `system_fn_avancar_fin_se_ok` (S3-02) que já dispara ao marcar o último `required`.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (check na FICHA — S3-02/S2-04):** `src/components/cases/CaseChecklistPanel.tsx` renderiza os itens do checklist do caso, agrupados por `stage_slug`, com `Checkbox`, badge "Obrigatório", tratamento de sugestão (`source='drive_suggest'`), via `useCaseChecklistItems(caseId)` + `useMarcarItemChecklist(caseId)`. Usado hoje **só** na ficha do caso (`src/routes/casos.$id.tsx`).
- **JÁ EXISTE (marcar item + gate — S3-02):** `marcarItemChecklist` (`src/lib/checklist-service.ts`) roteia para `avancarSeChecklistOk` (op) e/ou `avancarFinSeOk` (fin) conforme o `kind` da etapa do item; `useMarcarItemChecklist` **já invalida caso/timeline/kanban**. Ou seja, **marcar o último `required` de uma etapa fin já move o card** — falta só o ponto de marcação estar no card.
- **JÁ EXISTE (card fin):** `src/components/cases/CaseCardFin.tsx` — card do Kanban fin (código, cliente, tipo, dias, botão "Mover financeiro" → `MoveCaseFinDialog`). **NÃO** tem check de critério; para marcar, o operador precisa abrir a ficha.
- **JÁ EXISTE (Kanban fin):** `src/routes/casos.financeiro.index.tsx` renderiza `CaseCardFin` dentro do `KanbanBoard` (colunas por `macrostatus_fin`).
- **NOVO (só front):**
  1. **Extrair** o corpo da lista de itens do `CaseChecklistPanel` para um subcomponente compartilhado **`ChecklistItemsList`** (recebe `caseId` e, opcionalmente, filtro por `stage_slug` da etapa atual + variante compacta), reusado **pela ficha E pelo card**.
  2. **`CaseCardFin`** ganha um **expand/popover** que abre `ChecklistItemsList` **filtrado pela etapa fin atual** (`caso.macrostatus_fin`), com os checkboxes reusando `useCaseChecklistItems`/`useMarcarItemChecklist`.
  3. Ao marcar o **último `required`**, o gate fin (`system_fn_avancar_fin_se_ok`, S3-02) move o card; a invalidação da query da coluna do Kanban (já feita por `useMarcarItemChecklist`) atualiza a posição na hora.

> **DECISÃO DO OWNER (INCREMENTAL — travada):** só o **check no card** + critérios editáveis (S6-01). Sem regressão automática ao desmarcar (a regra S2-05 "checklist inconsistente" continua valendo, não é reescrita aqui), sem segregação/hold/flag judicial (BACKLOG).

---

## Acceptance Criteria

1. No card fin do Kanban (`CaseCardFin`), um **expand/popover** exibe os itens de checklist **da etapa fin atual** do caso (`stage_slug = caso.macrostatus_fin`), cada um com **checkbox** e badge "Obrigatório" quando `required`.
2. Marcar/desmarcar um item no card chama `marcarItemChecklist` (via `useMarcarItemChecklist`) e **persiste** — o mesmo caminho usado pela ficha (nada só-em-memória).
3. Ao marcar o **último item `required`** da etapa fin no card, o card **avança de coluna** (gate `system_fn_avancar_fin_se_ok`, S3-02) e a **query da coluna do Kanban é invalidada** (a posição atualiza sem reload).
4. **Componente compartilhado:** a lista de itens é um subcomponente único (`ChecklistItemsList`) reusado pela **ficha** (`CaseChecklistPanel`) e pelo **card** (`CaseCardFin`) — **sem duplicar** a lógica de render/marcação. A ficha continua exibindo o checklist como hoje (agrupado por etapa).
5. **Sugestão não fecha o gate:** item `source='drive_suggest', done=false` aparece como sugestão (comportamento atual do painel) e **não** conta como `required` cumprido — igual à ficha (S2-06/S3-02).
6. **Regressão:** clicar no checkbox dentro do card **não** dispara a navegação do `Link` do card (para a ficha) nem o DnD — usar o mesmo padrão `stopPropagation`/`stopAll` já presente no `CaseCardFin` para o botão "Mover". **SEM migration.**

---

## Tasks / Subtasks

- [x] **Extrair `ChecklistItemsList`** (AC: 4) — criado `src/components/cases/ChecklistItemsList.tsx` com dois exports: `ChecklistItemsRows` (render puro de uma lista já resolvida — consumido pela ficha, que agrupa por etapa) e `ChecklistItemsList` (wrapper com fetch próprio + filtro por `stageSlug` + `compact` — consumido pelo card). `CaseChecklistPanel` refatorado para usar `ChecklistItemsRows` por grupo de etapa.
- [x] **Expand/popover no `CaseCardFin`** (AC: 1,2,3) — ícone `ListChecks` abre um `Popover` com `<ChecklistItemsList caseId={caso.id} stageSlug={caso.macrostatus_fin} compact />`. Reusa `useCaseChecklistItems`/`useMarcarItemChecklist` (o hook já invalida caso/timeline/kanban → o card "pula" de coluna).
- [x] **Isolar o clique** (AC: 6) — gatilho e `PopoverContent` envolvidos com o `stopAll` (`preventDefault`+`stopPropagation` em `onClick`/`onPointerDown`) já usado no card; o trigger fica no mesmo container absoluto do botão "Mover".
- [ ] **Estado de contagem no card (opcional)** — NÃO feito (não é AC).
- [x] **Testes** (AC: 1–6) — `npx tsc --noEmit`: só 3 erros PRÉ-EXISTENTES (nenhum novo). Lint dos arquivos tocados: só ruído CRLF pré-existente. Teste funcional em runtime (marcação persiste, card pula, sugestão não fecha gate, clique não navega/arrasta) pendente p/ @qa.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/components/cases/ChecklistItemsList.tsx` (**novo** — subcomponente compartilhado).
- `sistema-hv/src/components/cases/CaseChecklistPanel.tsx` (refactor — passa a consumir `ChecklistItemsList`; mantém o agrupamento por etapa e o `ChecklistInconsistencyAlert` inalterado).
- `sistema-hv/src/components/cases/CaseCardFin.tsx` (expand/popover com `ChecklistItemsList` filtrado por `stage_slug`).
- (reuso, sem mudança) `src/hooks/useChecklist.ts` (`useCaseChecklistItems`, `useMarcarItemChecklist`), `src/lib/checklist-service.ts` (`marcarItemChecklist` + roteamento op/fin — S3-02).

**REGRAS DE OURO (pertinentes):**
- **NÃO toca `system_cases`** → **NÃO recriar `system_cases_active`** (regra de ouro 2).
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- O gate fin (`system_fn_avancar_fin_se_ok`) já existe e é idempotente sob concorrência (guarda `WHERE macrostatus_fin = esperado`) — **não** reimplementar; só disparar via `marcarItemChecklist`.
- **SEM migration.**

**Riscos de regressão:**
- **Clique dentro de card DnD:** o `CaseCardFin` é arrastável e é um `Link`. Todo controle interativo (checkbox, gatilho do popover) precisa de `stopPropagation`/`preventDefault` (padrão `stopAll` já existente) para não navegar nem iniciar arrasto.
- **Refactor do painel da ficha:** ao extrair `ChecklistItemsList`, preservar o agrupamento por `stage_slug`, o estado vazio ("Nenhum item de checklist…") e o `ChecklistInconsistencyAlert` (S2-05) exatamente como estão.
- **Etapa atual x itens de outras etapas:** o card filtra por `stage_slug = macrostatus_fin`; itens de etapas passadas/futuras não aparecem no card (a ficha continua mostrando todos, agrupados).

### Testing
- Card fin → abrir checklist → marcar item persiste (reload confirma).
- Marcar último `required` → card muda de coluna sem reload (query invalidada).
- Sugestão `drive_suggest` pendente no card → não avança o card.
- Ficha do caso → checklist segue agrupado por etapa, alerta de inconsistência intacto.
- Checkbox no card → não navega p/ ficha nem arrasta o card.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** S6-01 (critérios editáveis por etapa — alimenta os itens que aparecem no card), S3-02 (gate fin + roteamento de `marcarItemChecklist`), S2-04 (`CaseChecklistPanel` base). Todos JÁ EXISTEM / S6-01 é irmã.
- **Habilita:** nada nesta rodada (fecha a Frente A).

---

## BACKLOG explícito (fase futura — NÃO fazer nesta story)

- Regressão automática de coluna ao desmarcar `required` de etapa ultrapassada (mantido o comportamento S2-05: alerta, não regride).
- Check no card **operacional** (`CaseCardReal`) — o pedido do owner é o card **financeiro**; estender ao op pode ser feito depois reusando o mesmo `ChecklistItemsList`.
- Segregação conferidor≠elaborador / hold / flag judicial no fluxo financeiro.

## File List

- `sistema-hv/src/components/cases/ChecklistItemsList.tsx` (novo — `ChecklistItemsRows` + `ChecklistItemsList`)
- `sistema-hv/src/components/cases/CaseChecklistPanel.tsx` (refactor — consome `ChecklistItemsRows`; mantém agrupamento por etapa + `ChecklistInconsistencyAlert`)
- `sistema-hv/src/components/cases/CaseCardFin.tsx` (expand/popover `ListChecks` com checklist da etapa atual)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft — check do critério dentro do card do Kanban fin; extrai `ChecklistItemsList` compartilhado; reusa gate fin (S3-02). Frente A / Sprint 6. | @sm |
| 2026-07-03 | 1.0 | Ready for Review — `ChecklistItemsList` extraído (rows puros + wrapper com fetch); `CaseChecklistPanel` refatorado; popover no `CaseCardFin` filtrado por `macrostatus_fin`, com `stopAll`. Sem migration. Typecheck: só 3 erros pré-existentes. | @dev |
