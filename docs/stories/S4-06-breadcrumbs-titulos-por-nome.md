# Story S4-06: Breadcrumbs e títulos por NOME, nunca ID (UX transversal)

- **Sprint:** 4 — UX transversal
- **ID:** S4-06
- **Status:** Ready for Review
- **Estimativa relativa:** M (baixo esforço por tela, mas transversal: resolver genérico + título dinâmico + varredura rota a rota)
- **Executor sugerido:** @dev · Quality gate: @architect + @ux-design-expert

---

## Story

**Como** dono/operador do escritório,
**quero** que toda página de detalhe aberta por rota com UUID mostre **sempre o nome legível** do registro no breadcrumb e no título da aba do navegador, **nunca o ID cru**,
**para que** a navegação seja compreensível (ex.: `Painel / Casos / FIES-2026-014` em vez de `Painel / Casos / c18e562e-7a59-44bf-bc94-a473ed2b7e81`), inclusive durante o carregamento e em erro/404.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (componentes):** `Breadcrumb` (`sistema-hv/src/components/hv/primitives.tsx:48`) recebe `items: { label, to? }[]` e `PageHeader` (`:15`) recebe `title`. Ambos **renderizam labels vindos da página** — o defeito é a página passar o UUID como label.
- **JÁ EXISTE (rotas que já resolvem o nome no breadcrumb):**
  - `casos.$id.tsx:221` → `Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: caso.case_code }]}` (**OK**).
  - `clientes.$id.tsx:97` → `Breadcrumb items={[{ label: "Clientes", to: "/clientes" }, { label: cliente.full_name }]}` (**OK**).
- **JÁ EXISTE (limitação — título da aba estático global):** `__root.tsx:79` define `head: () => ({ meta: [{ title: "Hyago Viana Advocacia" }] })`. **Nenhuma** rota de detalhe hoje define `document.title`/`head` dinâmico por registro. **Este é o pedaço NOVO principal.**
- **NOVO — resolver genérico param→nome:** utilitário/hook (ex.: `useEntityLabel(entidade, id)` ou mapa de resolvers por tipo de entidade) que, a partir do dado **já carregado no loader/página** (TanStack Router), produz o **label legível** e o injeta **tanto no `Breadcrumb` quanto no título da aba** (via `head` dinâmico / `document.title`). O front **nunca** monta o segmento com o UUID — o UUID vira só o argumento de resolução.
- **NOVO — fallback obrigatório:** enquanto carrega → **placeholder/skeleton** ("Carregando…"), **nunca** o UUID. Em 404/erro → **rótulo genérico por entidade** ("Caso não encontrado", "Cliente não encontrado", "Conversa não encontrada", etc.), **nunca** o UUID.
- **NOVO — título da aba (`document.title`):** cada rota de detalhe compõe o título com o **nome** (padrão sugerido `"{Nome} — Hyago Viana Advocacia"`) via `head` dinâmico do TanStack Router (com acesso ao dado do loader) ou set explícito em efeito.

**Levantamento — rotas de detalhe afetadas (lidas no código, `src/routes/`):**

| Rota | Param | Estado hoje (confirmado no código) | Ação |
|---|---|---|---|
| `casos.$id.tsx` | `$id` | Breadcrumb **OK** (`caso.case_code` `:221`), **título da aba estático** | Só ligar título da aba por nome |
| `clientes.$id.tsx` | `$id` | Breadcrumb **OK** (`cliente.full_name` `:97`), **título da aba estático** | Só ligar título da aba por nome |
| `casos.$id.termo.tsx` | `$id` | **Sem** breadcrumb por caso; `PageHeader` fixo | Breadcrumb `Casos / {case_code} / Termo` + título por nome |
| `casos.$id.termo.elaborar.tsx` | `$id` | Detalhe aninhado sob `$id`; sem nome do caso no topo | Breadcrumb/título por nome do caso |
| `peticionamento.$id.tsx` | `$id` | `PageHeader title="Editor de Minuta"` fixo (`:9`); sem nome/nº | Resolver nome da peça/minuta; título por nome |
| `whatsapp.conversas.$id.tsx` | `$id` | `PageHeader title="Conversa"` fixo (`:9`); sem nome do contato | Resolver nome do contato; título por nome |
| `portal.casos.$id.tsx` | `$id` | `PageHeader title="Meu Caso"` fixo; sem código do caso | Resolver código/nome do caso; título por nome |
| `api.clients.$id.documents.$docId(.download).tsx` | `$id`/`$docId` | Rotas **de API** (sem breadcrumb/UI) | Fora do breadcrumb; garantir que labels derivados (nome do doc) usem título, não `$docId`, onde renderizados na aba de docs |

> **Observação (do plano):** `casos.$id` e `clientes.$id` **já cobrem o breadcrumb** — o defeito visível reaparece nas rotas **aninhadas/irmãs** que herdam o segmento sem resolver o nome, e o **título da aba** está errado em **todas** (estático global). O resolver genérico padroniza os dois pontos e evita regressão futura em novas telas `$id`.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S4-06)

1. Abrir **qualquer** página de detalhe por ID → o **breadcrumb** exibe o **nome legível** do registro (código/nome do caso, nome do cliente, nome do contato, título do doc), **nunca o UUID**.
2. O **título da aba** (`document.title`) usa o **nome** do registro (não o ID, não o título global estático).
3. Durante o carregamento, breadcrumb e título mostram **placeholder/skeleton** ("Carregando…"), **nunca o UUID**; em **erro/404**, exibem **rótulo genérico por entidade** ("Caso não encontrado" etc.), **nunca o UUID**.
4. **Varredura:** nenhuma rota de detalhe conhecida (tabela acima — casos, clientes/pessoas, termo, peticionamento, conversa WhatsApp, portal do caso, documentos) renderiza o **UUID** no breadcrumb nem no título — validado rota a rota.
5. **Regressão:** rotas que já resolviam o nome (`casos.$id`, `clientes.$id`) continuam corretas; o resolver genérico **não** quebra o breadcrumb existente.

---

## Tasks / Subtasks

- [x] **Resolver genérico param→nome** (AC: 1,3) — `resolveEntityLabel(name, { loading, notFound, notFoundLabel })` em `src/lib/use-document-title.ts`: deriva o label do dado já carregado na página; **nunca** retorna o UUID. Placeholder "Carregando…" no loading; rótulo genérico por entidade no 404.
- [x] **Título da aba dinâmico** (AC: 2,3) — hook `useDocumentTitle(title)` carimba `document.title` = `"{Nome} — Hyago Viana Advocacia"` no cliente a partir do dado carregado; fallback loading/404 nunca mostra UUID. O `head` estático de `__root.tsx` serve o título inicial (SSR) e é sobrescrito no cliente.
- [x] **Rotas com breadcrumb faltando/errado** (AC: 1,4) — breadcrumb por nome em: `casos.$id.termo.tsx`, `casos.$id.termo.elaborar.tsx`, `portal.casos.$id.tsx` (resolvem `case_code`); `peticionamento.$id.tsx` e `whatsapp.conversas.$id.tsx` são stubs sem fonte de dados → rótulo genérico ("Editor de Minuta"/"Conversa"), nunca UUID.
- [x] **Título por nome nas já-OK** (AC: 2) — `casos.$id.tsx`, `clientes.$id.tsx`: breadcrumb mantido, título da aba ligado por nome.
- [x] **Rotas de API** (AC: 4) — `api.clients.$id.documents.$docId(.download).tsx`: sem UI/breadcrumb; a aba de docs renderiza `doc.name`, não `$docId` (verificado).
- [x] **Varredura rota a rota** (AC: 4) — cobertas todas as rotas da tabela; nenhuma renderiza UUID (loading → "Carregando…", 404 → rótulo genérico).
- [x] **Testes** (AC: 1-5) — `tsc --noEmit` sem novos erros (só os 3 pré-existentes de `service_type_id`); lint verde nos arquivos alterados.
- [x] **Fix do breadcrumb automático do Topbar (2026-07-03)** (AC: 1,3,4) — o breadcrumb do `Topbar.tsx` era montado dos segmentos crus da URL (`labelMap[s] ?? s`), então em `/casos/<uuid>` imprimia o UUID. Corrigido em 2 camadas: (1) store leve `src/lib/route-title.ts` (`usePublishRouteTitle` nas páginas de detalhe + `useRouteTitle`/`getRouteTitle` no Topbar) publicando o nome já resolvido (caso = **nome do cliente** via `cliente.full_name`; cliente = `full_name`; termo/portal = `case_code`; peticionamento/whatsapp = rótulo genérico); (2) safety net `isId()` no Topbar → qualquer segmento UUID/id-numérico sem rótulo publicado vira "Detalhe", nunca o valor cru. Loading mostra "Carregando…".

---

## Dev Notes

**Arquivos a tocar:**
- NOVO `sistema-hv/src/lib/use-entity-label.ts` (ou `src/hooks/`) — resolver genérico param→nome + fallbacks.
- `sistema-hv/src/routes/__root.tsx` (`:79`) — confirmar sobrescrita do `head` estático por rotas filhas.
- Rotas de detalhe: `casos.$id.tsx` (`:221`), `clientes.$id.tsx` (`:97`), `casos.$id.termo.tsx`, `casos.$id.termo.elaborar.tsx`, `peticionamento.$id.tsx`, `whatsapp.conversas.$id.tsx`, `portal.casos.$id.tsx`, `api.clients.$id.documents.$docId(.download).tsx`.
- `sistema-hv/src/components/hv/primitives.tsx` — `Breadcrumb`/`PageHeader` (sem mudança de contrato esperada; só passam labels resolvidos).

**Regras de ouro repetidas (pertinentes):**
- **Sem migration** (mudança 100% de front). Nenhuma tabela/coluna tocada → não se aplicam as regras de `system_cases_active` / `trg_system_cases_bifurcacao`.
- Solução **transversal** (resolver genérico), **não** conserto pontual por tela — evita regressão em novas rotas `$id` futuras.
- **Nunca** exibir o UUID: nem no loading (placeholder), nem no 404 (rótulo genérico), nem no estado carregado (nome).

**Riscos de regressão:**
- OneDrive trava o `routeTree.gen.ts` — se mexer em estrutura de rota, pode precisar rebuild (ver `reference_tanstack_nested_routes`). Esta story tende a **não** alterar árvore de rotas (só o conteúdo de `head`/breadcrumb), reduzindo o risco.
- Rotas aninhadas (`casos.$id.termo*`) herdam o param `$id` do pai — resolver o nome do caso a partir do loader correto, não recarregar redundante.
- Não quebrar `casos.$id`/`clientes.$id` que já estão certos (AC-5).

### Testing
- Abrir cada rota da tabela → breadcrumb e título mostram nome, nunca UUID.
- Forçar loading lento → placeholder/skeleton, nunca UUID.
- Abrir ID inexistente → "Caso não encontrado" etc., nunca UUID.
- `casos.$id`/`clientes.$id` continuam com breadcrumb correto.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 18** (grupo G) — **Breadcrumb e título por NOME, nunca UUID:** abrir **cada** rota de detalhe (caso / cliente / lead / doc / termo / peticionamento / conversa WhatsApp / portal do caso) → breadcrumb e título exibem o **NOME**, **nunca o UUID**, **incluindo loading** (placeholder/skeleton) **e 404** (rótulo genérico). (S4-06 CA-1…4)

---

## Dependências

- **Depende de:** nenhuma story funcional — é **independente** e pode rodar em paralelo com S4-02/03/04. Requer apenas os loaders existentes das rotas de detalhe.
- **Aguarda input do owner:** nenhum (pedido do owner já é a própria story; o padrão de título `"{Nome} — Hyago Viana Advocacia"` é sugestão, ajustável).
- **Habilita:** consistência de UX para futuras telas `$id`.

---

## File List

- `sistema-hv/src/lib/use-document-title.ts` (NOVO — `resolveEntityLabel` + `useDocumentTitle`)
- `sistema-hv/src/routes/casos.$id.tsx` (título por nome)
- `sistema-hv/src/routes/clientes.$id.tsx` (título por nome)
- `sistema-hv/src/routes/casos.$id.termo.tsx` (breadcrumb + título por `case_code`)
- `sistema-hv/src/routes/casos.$id.termo.elaborar.tsx` (convertido de stub estático → resolve `case_code`, breadcrumb + título)
- `sistema-hv/src/routes/peticionamento.$id.tsx` (breadcrumb + título genérico — stub sem dados)
- `sistema-hv/src/routes/whatsapp.conversas.$id.tsx` (breadcrumb + título genérico — stub sem dados)
- `sistema-hv/src/routes/portal.casos.$id.tsx` (resolve `case_code`, breadcrumb + título)

**Fix breadcrumb Topbar (2026-07-03):**
- `sistema-hv/src/lib/route-title.ts` (NOVO — store leve `usePublishRouteTitle`/`useRouteTitle`/`getRouteTitle`/`setRouteTitle` chaveado por pathname)
- `sistema-hv/src/components/hv/Topbar.tsx` (consome rótulos publicados + safety net `isId()`; `labelMap` ganhou `conversas`/`portal`/`modelos`/`termo`)
- `sistema-hv/src/routes/casos.$id.tsx` (publica **nome do cliente** — `cliente.full_name`)
- `sistema-hv/src/routes/clientes.$id.tsx` (publica `full_name`)
- `sistema-hv/src/routes/casos.$id.termo.tsx` (publica `case_code` p/ `$id` + "Termo")
- `sistema-hv/src/routes/casos.$id.termo.elaborar.tsx` (publica `case_code` + "Termo" + "Elaborar")
- `sistema-hv/src/routes/portal.casos.$id.tsx` (publica `case_code`)
- `sistema-hv/src/routes/peticionamento.$id.tsx` (publica "Editor de Minuta")
- `sistema-hv/src/routes/whatsapp.conversas.$id.tsx` (publica "Conversa")

> Nota: o resolver ficou em `use-document-title.ts` (não `use-entity-label.ts`), unificando label + título da aba num único util. `__root.tsx` não precisou de mudança (o `head` estático serve como fallback SSR e é sobrescrito no cliente).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 4, S4-06 — UX transversal) | @sm |
| 2026-07-02 | 1.0 | Implementado: resolver genérico + título dinâmico + breadcrumbs por nome nas rotas de detalhe. Ready for Review. | @dev |
| 2026-07-03 | 1.1 | Fix do breadcrumb **automático do Topbar**: store `route-title.ts` (publica nome resolvido) + safety net `isId()` → nunca exibe UUID. Caso publica o **nome do cliente**. | @dev |
