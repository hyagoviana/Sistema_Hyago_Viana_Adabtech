# Story S9-07: UI — Leads (roster com sub-abas) em Inteligência + Clientes (só clientes)

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-07
- **Status:** Ready for Review
- **Estimativa relativa:** M (realocar/renomear a lista existente para "Leads/roster" em Inteligência; reduzir a página Clientes a só clientes)
- **Executor sugerido:** @dev (UI) · Quality gate: @ux-design-expert / @architect

---

## Story

**Como** operador,
**quero** uma **lista de Leads (roster)** com sub-abas Todos/Leads/Clientes/Perdidos (em Inteligência) e uma página **Clientes** que mostra **só clientes**,
**para que** o cadastro único por CPF (pessoa) apareça na lista de Leads, e "Clientes" fique reservado a quem já fechou ao menos um caso.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (lista com sub-abas):** `src/routes/clientes.index.tsx` (S1-05) — já tem as abas **Todos/Leads/Clientes/Perdidos** (`LIFECYCLE_TABS`, `:88-93`), busca por campos, filtro por tipo, `useClientsByLifecycle`/`useClientsList` (`:108-113`). É exatamente o **roster** que o modelo novo quer como "Leads (Inteligência)".
- **JÁ EXISTE (views):** `system_clients_leads`/`system_clients_clientes`/`system_clients_perdidos` (`20260702000002_views_leads_clientes.sql`) — pessoas distintas por lifecycle de caso. `system_clients_clientes` é a fonte de "só clientes".
- **JÁ EXISTE (hooks):** `useClientsByLifecycle(tab)` já consulta as views por aba.
- **NOVO:** (a) **realocar/renomear** o roster (clientes.index) para o módulo **Inteligência** como "Leads" (rota/label/breadcrumb "Inteligência › Leads"), preservando as 4 sub-abas; (b) a página **Clientes** passa a listar **só clientes** (`system_clients_clientes`), **sem** o seletor de abas de lead (ou fixa a aba `cliente`). Decidir se é a mesma rota reconfigurada ou uma rota nova — ver Decisão abaixo.

> **DECISÃO DE ROTEAMENTO (recomendada):** manter `clientes.index.tsx` como a página **Clientes = só clientes** (remover/ocultar as sub-abas de lifecycle; consumir `system_clients_clientes` diretamente) **e** criar/realocar o **roster completo** (as 4 sub-abas) sob **Inteligência › Leads** (nova rota, ex.: `inteligencia.leads.tsx` ou reuso de `comercial.*`), reaproveitando o componente de lista (extrair para um componente compartilhado). Isso evita duplicar a UI e deixa cada tela com um propósito único. **Confirmar a rota/label exata com o owner/UX** (Inteligência vs Comercial como guarda-chuva).

---

## Acceptance Criteria

1. Existe um **roster de Leads** (em Inteligência) com as sub-abas **Todos / Leads / Clientes / Perdidos**, busca e filtro por tipo, reusando o componente de lista atual (`clientes.index`) — sem regressão de busca/filtros/menu de card.
2. A página **Clientes** lista **apenas clientes** (fonte `system_clients_clientes`), **sem** o seletor de sub-abas de lifecycle (ou com ele fixado/oculto em `cliente`). Contagem/subtítulo refletem só clientes.
3. Breadcrumbs/títulos coerentes: roster → "Inteligência › Leads" (ou o guarda-chuva confirmado); Clientes → "Operação › Clientes" (ou o atual). Sem links quebrados.
4. O componente de lista é **compartilhado** (extraído) entre as duas telas para não duplicar código; props controlam quais abas aparecem e qual fonte de dados.
5. Nenhuma escrita nova de dados; só leitura (views existentes). RBAC/gates preservados (mesmos de hoje).
6. `npm run typecheck` / `npm run lint` verdes (só os 3 erros pré-existentes de `service_type_id`). Rotas resolvem (atenção ao `routeTree.gen.ts` no OneDrive — ver Dev Notes).

---

## Tasks / Subtasks

- [x] **Extrair componente de lista** (AC: 4) — corpo de `clientes.index.tsx` movido para `components/clients/ClientRoster.tsx` com props: `showLifecycleTabs` (roster completo vs só-clientes), `fixedLifecycle`, `eyebrow`/`title`/`breadcrumb`/`entityNoun`. Reusa `useClientsByLifecycle`/`useClientsList`.
- [x] **Roster em Inteligência** (AC: 1, 3) — nova rota `routes/inteligencia.leads.tsx` (`/inteligencia/leads`), 4 sub-abas, breadcrumb "Inteligência › Leads". routeTree.gen.ts regenerado via `@tanstack/router-generator` (OneDrive).
- [x] **Clientes = só clientes** (AC: 2, 3) — `clientes.index.tsx` reduzido a um wrapper de `ClientRoster` com `showLifecycleTabs=false` + `fixedLifecycle="cliente"` (fonte `system_clients_clientes`); sem sub-abas; subtítulo/contagem só de clientes.
- [x] **Navegação/menu** (AC: 3) — Sidebar (grupo Inteligência): novo item "Leads" → `/inteligencia/leads`; "Comercial" mantido; o Kanban vira "Pipeline comercial" (S9-08). RBAC `ROLE_NAV` ganhou `/inteligencia/leads` (admin/titular = all; advogado_associado + comercial).
- [x] **Testes** (AC: 6) — typecheck só com os 3 erros pré-existentes de `service_type_id`; lint dos arquivos novos sem erros (CRLF ignorado nos legados). Rotas resolvem. Teste funcional (contagens/duplicidade multi-caso) fica p/ @qa.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/clientes.index.tsx` (vira "só clientes"; extrai a lista).
- `sistema-hv/src/routes/inteligencia.leads.tsx` (ou equivalente — nome/rota a confirmar) — roster com 4 sub-abas.
- `sistema-hv/src/components/clients/ClientRoster.tsx` (novo — componente compartilhado, se extraído).
- `sistema-hv/src/hooks/useClients.ts` (reuso `useClientsByLifecycle`/`useClientsList`; talvez um `useClientes()` fixo em `system_clients_clientes`).
- Navegação (sidebar/menu — localizar o componente de navegação).

**REGRAS DE OURO (pertinentes):**
- **UI/leitura** — **NÃO** cria migration; **NÃO** toca `system_cases`; **NÃO** recria view/trigger.
- **Gotcha TanStack (memória):** rota com filhas precisa de layout explícito (`X.tsx` com `Outlet` + `X.index.tsx`); OneDrive pode travar `routeTree.gen.ts` (rebuild). Se criar rota aninhada em Inteligência, seguir o padrão.
- Preservar a semântica travada: **pessoa única por CPF**; a mesma pessoa pode aparecer como LEAD e CLIENTE simultaneamente (as views já resolvem por pessoa-distinta-por-lifecycle).

**Riscos de regressão:**
- Não perder os filtros avançados/`ClientCardMenu`/`ClientFieldsManagerDialog` ao extrair o componente.
- "Clientes" não deve virar um filtro do roster e sim consumir `system_clients_clientes` (senão uma pessoa LEAD-e-CLIENTE apareceria duplicada nas contagens).
- Confirmar o guarda-chuva (Inteligência vs Comercial) com o owner antes de criar a rota — a memória fala em "Leads (Inteligência)" e "Comercial (Inteligência)".

### Testing
- Roster: alternar sub-abas Todos/Leads/Clientes/Perdidos → contagens coerentes; busca/filtro OK.
- Clientes: só pessoas com >=1 caso CLIENTE; nenhuma pessoa só-LEAD aparece.
- Uma pessoa que é LEAD no caso A e CLIENTE no caso B aparece em "Leads" e em "Clientes" (nas telas respectivas), sem duplicar dentro da mesma lista.

---

## Dependências

- **Depende de:** views `system_clients_*` (JÁ EXISTEM) e do modelo lifecycle (S1). Coerente com S9-03/S9-04 (procuração segue LEAD; contrato vira CLIENTE) — a UI reflete o novo significado.
- **Habilita:** S9-08 (Comercial/Kanban), S9-09 (botões no detalhe). Independente de S9-01..06 no código, mas semanticamente depende do modelo novo.

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **roster com 4 sub-abas** + **Clientes = só clientes** + **pessoa multi-caso não duplica**. Reusa a matriz de S1-05.

---

## File List

- `sistema-hv/src/components/clients/ClientRoster.tsx` (NOVO — componente de lista compartilhado)
- `sistema-hv/src/routes/clientes.index.tsx` (reduzido a wrapper: só clientes)
- `sistema-hv/src/routes/inteligencia.leads.tsx` (NOVO — roster com 4 sub-abas)
- `sistema-hv/src/components/hv/Sidebar.tsx` (item "Leads" em Inteligência)
- `sistema-hv/src/lib/rbac.ts` (`/inteligencia/leads` no ROLE_NAV)
- `sistema-hv/src/routeTree.gen.ts` (regenerado)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft inicial — UI Leads (roster com sub-abas) + Clientes só clientes (Sprint 9) | @sm |
| 2026-07-03 | 1.0 | Implementada. `ClientRoster` extraído; roster em `/inteligencia/leads` (4 sub-abas); `clientes.index` = só clientes (`fixedLifecycle='cliente'`); Sidebar+RBAC atualizados; routeTree regenerado. Sem migration. typecheck/lint ok. | @dev |
