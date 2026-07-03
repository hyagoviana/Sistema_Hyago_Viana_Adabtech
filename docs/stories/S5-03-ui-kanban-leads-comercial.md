# Story S5-03: UI — `/comercial/leads` deixa de ser stub → Kanban de leads (DnD) + toggle lista

- **Sprint:** 5 — Módulo Comercial/Leads (pipeline + lista)
- **ID:** S5-03
- **Status:** Ready for Review
- **Estimativa relativa:** G (materializar rota stub → Kanban DnD + lista com toggle; reusar KanbanBoard/StageEditor; wire no menu)
- **Executor sugerido:** @dev (front) · Quality gate: @architect + @ux-design-expert

---

## Story

**Como** operador do comercial,
**quero** que **Inteligência → Comercial → Leads** (`/comercial/leads`) mostre um **pipeline de leads (Kanban) com drag-and-drop** e um **toggle para visão em lista**, em vez do stub atual,
**para que** eu enxergue e mova os leads pelas etapas comerciais (Novo → Em contato → Proposta → Aguardando assinatura → Ganho/Perdido) exatamente como o CRM da reunião previu, com o card saindo da pipeline quando o lead assina a procuração (vira CLIENTE).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (stub-alvo):** `sistema-hv/src/routes/comercial.leads.tsx` (`:4-13`) é hoje um **`StubPage`** ("Lista de Leads", crumbs `Comercial / Leads`). **É o arquivo a materializar.**
- **JÁ EXISTE (menu):** `Sidebar.tsx` grupo **"Inteligência"** já tem `{ to: "/comercial", label: "Comercial" }` (`:63`) e `/comercial/assinaturas` (`:64`). **NÃO existe** item para `/comercial/leads` no menu. A esteira comercial hoje só é alcançável via aba Leads em **Operação → Clientes** (`clientes.index.tsx`, view `system_clients_leads`).
- **JÁ EXISTE (molde de Kanban por tipo):** `pipeline.tsx` (op) e `casos.financeiro.index.tsx` (fin) — padrão **seleção de tipo de serviço → `KanbanBoard` + `StageEditor` + `useMoveCaseStage*`**, com `roleColor`, colunas derivadas de `useStages`, `getColumn`, `onMove`→toast. **Reusar esse padrão para `kind='comercial'`.**
- **JÁ EXISTE (KanbanBoard genérico):** `components/cases/KanbanBoard.tsx` (DnD @dnd-kit, `columns`/`items`/`getId`/`getColumn`/`renderCard`/`onMove`). **JÁ EXISTE (card):** `CaseCardReal.tsx` (card de caso op — reusável; o `MoveCaseDialog` interno é op-específico, ver risco). **JÁ EXISTE (editor de etapas):** `StageEditor` (usado com `kind`).
- **JÁ EXISTE (título por nome — S4-06):** padrão `useDocumentTitle` + breadcrumb por nome (`use-document-title.ts`).
- **NOVO:** rota `/comercial/leads` materializada: **seleção de tipo → Kanban comercial (DnD)** + **toggle "Pipeline / Lista"**; item no menu Inteligência; card de lead (reuso/variante de `CaseCardReal`); (opcional) `/comercial` (índice) com resumo dos leads.

> **DECISÃO (exibição de GANHO/PERDIDO — parametrizável):** o Kanban comercial lista **apenas** casos `lifecycle='LEAD'` (fonte `listLeadsByServiceType` da S5-02). As colunas terminais `GANHO`/`PERDIDO` mostram só o instantâneo recém-movido (o filtro-fonte não repovoa leads antigos ganhos/perdidos). Se o owner quiser um histórico persistente de "ganhos/perdidos do mês", isso vira uma visão à parte (fora do escopo desta story). **Etapas e labels reais são editáveis pelo owner no editor de funil (S2) com `kind='comercial'`.**

---

## Acceptance Criteria

1. `/comercial/leads` **deixa de ser stub**: mostra a seleção de tipo de serviço (molde `pipeline.tsx`) e, ao escolher um tipo, um **Kanban comercial com DnD** (colunas = etapas `kind='comercial'` do tipo via `useStages(..., "comercial")`; cards = leads via `useLeadsByServiceType`; `onMove` → `useMoveCaseStageComercial`).
2. **Toggle "Pipeline / Lista":** um controle (molde do toggle op/fin de `pipeline.tsx:245-260`) alterna entre o Kanban e uma **lista** dos mesmos leads (tabela/cards com nome, tipo, etapa comercial, dias parado). A lista lê a mesma fonte (`listLeadsByServiceType`).
3. **DnD persiste** (recarregar mantém a coluna) e mover dispara toast de sucesso/erro (molde `handleMove` de `pipeline.tsx`/`casos.financeiro.index.tsx`).
4. **Saída da pipeline:** quando um lead vira CLIENTE (procuração assinada, via fluxo existente) ele **some** do Kanban de leads (filtro `lifecycle='LEAD'` da S5-02); quando vira PERDIDO, idem. (Validado abrindo o Kanban após a transição.)
5. **Menu:** o grupo **Inteligência** do `Sidebar.tsx` ganha um item apontando para `/comercial/leads` (ex.: label "Leads", ícone coerente), respeitando o RBAC `canSeeRoute`.
6. **Breadcrumb/título por nome** (padrão S4-06): breadcrumb `Comercial / Leads / {nome do tipo}` e `document.title` por nome do tipo; loading → "Carregando…", nunca UUID.
7. **(Opcional)** `/comercial` (índice, hoje stub `comercial.index.tsx`) mostra um resumo real dos leads (contagem por etapa/tipo) em vez do texto fixo "47 leads ativos…".

---

## Tasks / Subtasks

- [x] **Materializar `/comercial/leads`** (AC: 1,3) — `StubPage` → `LeadsPage` com seleção de tipo (`useServiceTypes`) + `LeadsKanban` fixando `kind='comercial'`: colunas via `useStages(id,"comercial")`, itens via `useLeadsByServiceType`, `onMove` via `useMoveCaseStageComercial` → toast; `StageEditor kind="comercial"`.
- [x] **Toggle Pipeline / Lista** (AC: 2) — estado `view: "kanban" | "lista"`; a Lista (tabela) mostra nome, código, tipo, etapa comercial, dias parado, linkando p/ `/casos/$id`. Mesma fonte do Kanban.
- [x] **Card de lead** (AC: 1) — novo `LeadCard` (variante enxuta, SEM o `MoveCaseDialog` op); lê `macrostatus_comercial` via `getColumn`.
- [x] **Wire no menu** (AC: 5) — item `{ to: "/comercial/leads", label: "Leads", icon: UserPlus }` no grupo Inteligência; `rbac.ts` ganhou `/comercial/leads` p/ `comercial` e `advogado_associado` (admin/titular já têm `all`).
- [x] **Breadcrumb + título** (AC: 6) — `Comercial / Leads / {tipo}` + `useDocumentTitle` (`resolveEntityLabel`), nunca UUID.
- [x] **(Opcional) Índice `/comercial`** (AC: 7) — feito na S5-04 (resumo real + atalhos).
- [x] **Testes** — `npx tsc --noEmit` só com os 3 erros pré-existentes; lint dos arquivos novos verde.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/comercial.leads.tsx` (StubPage → Kanban + lista) — **arquivo principal.**
- `sistema-hv/src/components/hv/Sidebar.tsx` (`:58-69`) — item "Leads" no grupo Inteligência.
- `sistema-hv/src/components/cases/CaseCardReal.tsx` **ou** novo `sistema-hv/src/components/comercial/LeadCard.tsx` (card de lead).
- `sistema-hv/src/routes/comercial.index.tsx` (opcional — resumo real).
- Reusos: `KanbanBoard`, `StageEditor`, `useStages`/`useMoveCaseStageComercial`/`useLeadsByServiceType` (S5-02), `useDocumentTitle` (S4-06), `roleColor` (copiar helper de `pipeline.tsx:46-57`).

**REGRAS DE OURO (pertinentes):**
- **Sem migration** (mudança 100% front, consome RPCs da S5-02) — não toca `system_cases`/`system_cases_active`/`trg_system_cases_bifurcacao`.
- Reusar o **KanbanBoard genérico** e o **padrão de seleção de tipo** — **não** reimplementar DnD.
- **Nunca** exibir UUID no breadcrumb/título (S4-06): loading → placeholder, 404 → rótulo genérico.
- OneDrive trava o `routeTree.gen.ts` — como o **arquivo de rota já existe** (`comercial.leads.tsx`), materializá-lo **não** altera a árvore de rotas (baixo risco de rebuild). Se adicionar `/comercial` filhas, ver `reference_tanstack_nested_routes`.

**Riscos de regressão:**
- `CaseCardReal` embute `MoveCaseDialog` (op) e badge por `CASE_TYPE_LABELS` — num Kanban comercial isso pode confundir (mover op ≠ mover comercial). Preferir `LeadCard` sem o dialog op, ou parametrizar o card para ocultar o botão de mover op.
- O `getColumn` do KanbanBoard deve ler `macrostatus_comercial` (não `macrostatus_op`) — passar o acessor correto.
- Não filtrar leads no servidor por engano com filtros op/fin (`removido_do_operacional_at`/`aguardando_assinatura_at`) — a fonte da pipeline comercial é `lifecycle='LEAD'` (S5-02), sem esses filtros.
- Menu: garantir que `canSeeRoute(role, "/comercial/leads")` não esconda a rota para papéis que devem vê-la (checar `rbac.ts`).

### Testing
- Abrir `/comercial/leads` → seleção de tipo → Kanban com etapas comerciais; arrastar card entre colunas → persiste (reload), toast ok.
- Toggle → Lista mostra os mesmos leads; voltar ao Kanban mantém estado.
- Marcar um lead como CLIENTE (assinar procuração) → recarregar o Kanban → card sumiu.
- Menu Inteligência mostra "Leads" e navega para `/comercial/leads`.
- Breadcrumb/título por nome do tipo; loading sem UUID.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** S5-01 (modelo), S5-02 (RPCs/hooks `useLeadsByServiceType`/`useMoveCaseStageComercial`, `useStages` com `kind='comercial'`). Reusa S4-06 (título por nome) e S2 (`StageEditor`).
- **Habilita:** owner passa a operar o CRM de leads; o editor de funil (S2, `kind='comercial'`) permite ajustar as etapas reais.

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **Kanban comercial (DnD + persistência) + toggle lista + saída ao virar CLIENTE/PERDIDO**. Reusa o caso de "breadcrumb/título por NOME" (S4-06) para a nova rota de detalhe/tipo.

---

## File List

- `sistema-hv/src/routes/comercial.leads.tsx` (StubPage → Kanban comercial + lista)
- `sistema-hv/src/components/comercial/LeadCard.tsx` (novo — card de lead enxuto)
- `sistema-hv/src/components/hv/Sidebar.tsx` (item "Leads" no grupo Inteligência + ícone `UserPlus`)
- `sistema-hv/src/lib/rbac.ts` (`/comercial/leads` no nav de `comercial` e `advogado_associado`)

## Dev Agent Record (@dev)

- `getColumn` do Kanban lê `macrostatus_comercial ?? ""` — leads legados sem etapa comercial (NULL) caem numa coluna inexistente e NÃO aparecem no Kanban (mas SIM na Lista). Ver observação de backfill em S5-01.
- Card de lead é um `<Link>` simples (sem `MoveCaseDialog` op) — a movimentação é 100% por DnD, evitando confundir "mover op" com "mover comercial".
- Toggle Pipeline/Lista é estado local (mesma query em cache) — trocar de visão não refaz fetch.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial — UI Kanban de leads (DnD) + toggle lista + wire no menu (Sprint 5) | @sm |
