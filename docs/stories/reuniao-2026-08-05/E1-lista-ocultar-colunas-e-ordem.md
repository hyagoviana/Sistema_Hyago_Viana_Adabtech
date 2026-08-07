# Story E1: Lista — ocultar coluna "Tema" redundante, ocultar colunas/filtros e ordem Tema → Tipo de caso

- **Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
- **ID:** E1
- **Status:** Ready for Review
- **Estimativa relativa:** S/M (só UI da Lista — reusa `hidden_in_list`; sem migration nova)
- **Executor sugerido:** @dev (UI) · Quality gate: @qa
- **Risco:** BAIXO (ajuste de apresentação da Lista; nenhuma mudança de dados)

---

## Story

**Como** operador vendo a **Lista de casos de um único tema**,
**quero** (a) **ocultar a coluna "Tema"** quando ela é redundante com "Tipo de caso" (dentro de um tema, "Tema" repete o mesmo valor em toda linha), (b) poder **ocultar colunas/filtros** que não me interessam na lista, e (c) ver as colunas na ordem **Tema → Tipo de caso** (mais legível),
**para que** a Lista fique enxuta e legível quando estou focado num tema, sem repetição inútil.

> **Frases do levantamento (Bloco E):**
> - **E1:** *"Coluna 'tipo de caso' vs 'tema' redundante quando se está vendo a lista de um único tema. Quando estou dentro do tema '1% FIES', não repetir 'tema' em cada linha. Ajuste de UI + opção de ocultar filtros/colunas na lista."* (PARCIAL 🟡)
> - **E2:** *"Ordem sugerida das colunas: Tema → Tipo de caso (fica mais legível)."* (PARCIAL 🟢)

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (base a reusar)

- **A Lista** `sistema-hv/src/routes/casos.lista.tsx`:
  - Colunas fixas definidas em `columns` (`:354-366`): `Código`, `Cliente`, `Tipo de Caso`, `Tema`, `Frente`, `Operacional`, `Financeiro`, `Responsáveis`, `Município`, (`Valor` sob gate), `Criado em`. **A ordem atual é `Tipo de Caso` (`:356`) ANTES de `Tema` (`:357`)** — o inverso do pedido E2.
  - Cabeçalhos renderizados em `:510-533`; células em `:587-591` (`Tipo de Caso` = `resolveTipo(c)`; `Tema` = `temaName.get(c.tema_id)`).
  - **Tema efetivo:** `effectiveTemaId` (`:137-146`) — resolve o tema quando a Lista foi aberta a partir do Kanban (`cat`) OU escolhido no dropdown (`temaFilter`). **Este é o sinal de "estou dentro de um único tema"** → base para esconder a coluna "Tema".
  - **Colunas dinâmicas do tema** (`dynamicDefs`, `:179`) já filtram `hidden_in_list` (campos do tema marcados "ocultar na lista" saem da coluna). Precedente de "ocultar coluna".
  - Ordenação por coluna (`SortKey`, `toggleSort`) — a ordem do array `columns` define a ordem visual.
- **Toggle `hidden_in_list`** (campos do tema): `system_tema_field_defs.hidden_in_list` — some da COLUNA, continua no filtro/ficha. Editor: `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx`. **Reuso:** este toggle já existe para os campos dinâmicos do tema; E1 trata das **colunas FIXAS** (Tema, Tipo, etc.), que NÃO têm esse toggle hoje.
- **Painel de filtros** `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` (Lista + Kanban) — o mesmo componente; `filterableDefs` já respeita `hidden_in_filters` (A2). E1 pede também poder **ocultar colunas/filtros na lista** (preferência de visualização).
- **`InlineCanonicalCell`** `sistema-hv/src/components/cases/InlineCanonicalCell.tsx` — renderiza as células dos campos do tema (read-only na lista). **Não** precisa mudar para E1 (E1 é sobre colunas FIXAS + ordem).

### NOVO nesta story

1. **Ocultar a coluna "Tema" quando há tema efetivo (E1a):** quando a Lista está escopada a um único tema (`effectiveTemaId` presente), a coluna "Tema" fica redundante — ocultá-la (ou dar a opção de ocultar). Idem raciocínio: dentro de um tema, "Tema" é constante.
2. **Reordenar colunas fixas: Tema → Tipo de caso (E2).** Trocar a ordem no array `columns` para `Tema` antes de `Tipo de Caso`.
3. **Opção de ocultar colunas/filtros na lista (E1b):** um controle (menu "Colunas" / toggles) para o usuário esconder colunas fixas que não quer ver na Lista, e/ou recolher o painel de filtros. Escopo v1: começar simples (esconder "Tema" auto quando há tema efetivo + um menu de colunas para as fixas). O nível de persistência (só na sessão vs por usuário) deve ser travado com o owner.

---

## Decisão a travar (com @dev/owner, ANTES de codar — registrar no Change Log)

### Ponto 1 — "ocultar Tema" automático vs opção manual
- **Opção A (RECOMENDADA para E1a):** quando `effectiveTemaId` está presente (Lista dentro de um único tema), a coluna "Tema" é **omitida automaticamente** (é constante, não informa nada). Quando a Lista é "Todos os temas" (`effectiveTemaId` vazio), a coluna "Tema" aparece. Zero configuração, resolve o pedido direto.
- **Opção B:** um toggle manual "mostrar coluna Tema". Mais controle, mais UI. **Sugestão:** combinar — auto-ocultar quando há tema efetivo (A) + o menu de colunas de E1b permite reexibir se o usuário quiser.

### Ponto 2 — escopo e persistência do "ocultar colunas/filtros" (E1b)
- Onde vive a preferência? **(i)** só no estado local da tela (reseta ao sair) — mais simples, sem migration; **(ii)** por usuário (persistido) — precisa storage. **Recomendação v1:** estado local (i) — um menu "Colunas" com checkboxes das colunas fixas + botão para recolher o painel de filtros. Persistência por usuário fica como follow-up (evita migration nesta story S/M).

### Ponto 3 — ordem (E2)
- Trocar no array `columns`: `Tema` antes de `Tipo de Caso`. Baixo risco — só apresentação. Confirmar que a ordenação (`SortKey`) segue funcionando (as keys `tema`/`case_type` não mudam, só a posição no array).

---

## Acceptance Criteria

1. **Coluna "Tema" oculta dentro de um tema (E1a).** Quando a Lista está escopada a um único tema (`effectiveTemaId` presente — via `?cat=`/`?tema=` ou dropdown), a coluna "Tema" **não é renderizada** (nem cabeçalho nem células). Quando a Lista é "Todos os temas" (`effectiveTemaId` vazio), a coluna "Tema" **aparece** normalmente.
2. **Ordem Tema → Tipo de caso (E2).** No cabeçalho e nas linhas, quando ambas as colunas aparecem (visão "Todos os temas"), "Tema" vem **antes** de "Tipo de Caso". A ordenação por clique em cada coluna continua funcionando (keys `tema` e `case_type` inalteradas).
3. **Menu de colunas / ocultar (E1b).** Há um controle na Lista (ex.: botão "Colunas") que permite o usuário **ocultar/mostrar** colunas FIXAS (ao menos as não-essenciais: Tema, Frente, Município, Responsáveis, etc.). As escolhas afetam cabeçalho + células juntos (sem descompasso de colunas).
4. **Ocultar/recolher o painel de filtros (E1b).** O usuário pode **recolher** o painel de filtros da Lista (`CaseFiltersPanel`) quando não quer usá-lo (toggle "mostrar/ocultar filtros"). Recolher não altera os filtros aplicados; só a visibilidade do painel.
5. **`colSpan`/contagem de colunas coerentes.** `colCount` e os `colSpan` dos estados vazio/carregando refletem o número REAL de colunas visíveis (fixas visíveis + dinâmicas), sem célula sobrando/faltando ao ocultar colunas.
6. **Reuso do `hidden_in_list` para colunas dinâmicas.** As colunas de campos do tema continuam governadas por `hidden_in_list` (já implementado) — E1 NÃO duplica esse eixo; o menu de colunas de E1b trata das FIXAS. (Onde fizer sentido, o menu pode listar as dinâmicas também, mas a fonte da verdade das dinâmicas permanece `hidden_in_list`.)
7. **Regressão zero na visão "Todos os temas".** Sem tema efetivo, a Lista mantém todas as colunas (agora com Tema antes de Tipo), a busca, ordenação, paginação e os campos dinâmicos exatamente como hoje. Nenhuma linha some; nenhum filtro muda de comportamento.
8. **Sem migration.** E1 é 100% UI (`casos.lista.tsx` + eventualmente `CaseFiltersPanel.tsx`). Nenhuma alteração de banco. `typecheck`/`lint`/`build` verdes.

---

## Tasks / Subtasks

- [x] **T1 — Decisão (@dev/owner)** (AC: 1, 3, 4) — travado (Opção B combinada): (a) auto-ocultar "Tema" quando há `effectiveTemaId`; (b) menu de colunas = FIXAS, persistência LOCAL (estado da tela, reseta ao sair); (c) recolher painel de filtros = local à Lista (wrapper condicional, não mexe no `CaseFiltersPanel`).
- [x] **T2 — Reordenar colunas fixas (@dev)** (AC: 2) — array `columns` renomeado p/ `allColumns` com `Tema` ANTES de `Tipo de Caso`; corpo passou a iterar por `columns` (componente `CaseCell`), então cabeçalho e células seguem a MESMA ordem automaticamente.
- [x] **T3 — Ocultar "Tema" com tema efetivo (@dev)** (AC: 1, 5) — `temaColRedundant = !!effectiveTemaId`; `isColHidden` remove "tema" de `columns`; corpo itera por `columns`, então a `<td>` de Tema some junto. `colCount = columns.length + dynamicDefs.length` (recalcula).
- [x] **T4 — Menu "Colunas" (@dev)** (AC: 3, 5, 6) — estado `hiddenCols: Set<SortKey>` + Popover "Colunas" (Columns3) com Checkboxes de `toggleableColumns`. Usei Popover+Checkbox (padrão já usado em A2/`CaseFiltersPanel`; não há `ui/dropdown-menu`). Dinâmicas seguem governadas por `hidden_in_list` (não duplicado).
- [x] **T5 — Recolher painel de filtros (@dev)** (AC: 4) — checkbox "Mostrar filtros" no mesmo Popover controla `filtersVisible`; `CaseFiltersPanel` envolto em `{filtersVisible && (...)}`. Não altera `panelFilters`.
- [x] **T6 — Coerência células×cabeçalho (@dev)** (AC: 5, 7) — cabeçalho e corpo iteram o MESMO array `columns`; ocultar coluna remove `<th>` e `<td>` juntos; `colSpan={colCount}` dos estados loading/vazio usa a contagem real.
- [x] **T7 — Gates + smoke UI (@qa)** (AC: 1, 2, 7) — `typecheck` verde (só erro pré-existente `contaazul/service.ts`); `eslint casos.lista.tsx` = 0 erros (2 warnings pré-existentes de exhaustive-deps; a versão original tinha 3). Smoke UI Playwright/manual: PENDENTE @qa.

---

## Dev Notes

- **Sinal de "dentro de um tema" = `effectiveTemaId`** (`casos.lista.tsx:137-146`), que já resolve tema por `?cat=` (vindo do Kanban), `?tema=` ou dropdown. É a condição natural para E1a (auto-ocultar "Tema").
- **Ordem = ordem do array `columns`** — E2 é só reposicionar o item no array + reposicionar as `<td>` correspondentes. Não mexer nas `SortKey` (a ordenação usa a key, não a posição).
- **Reuso `hidden_in_list`:** as colunas de **campos do tema** já saem via `hidden_in_list` (`:179` `dynamicDefs`). E1b trata das **fixas**, que não têm esse toggle. Não duplicar o eixo `hidden_in_list` — o menu de colunas é preferência de VISUALIZAÇÃO local, não config persistida do campo.
- **`colCount`** (`:367` = `columns.length + dynamicDefs.length`) precisa refletir as colunas realmente visíveis após os filtros de E1a/E1b — senão os `colSpan` dos estados vazio/loading quebram o layout.
- **Persistência:** v1 = estado local (reseta ao sair). Persistir por usuário = follow-up (evita migration nesta story). Se o owner exigir persistência, dimensionar como story separada.
- **Kanban:** E1 é sobre a **Lista**. O painel de filtros é compartilhado com o Kanban (`CaseFiltersPanel`), mas o recolher de E1b deve ser **local à Lista** (não afetar o Kanban) — usar estado da própria `casos.lista.tsx`, não mexer no componente compartilhado além do necessário (idealmente só envolver o `<CaseFiltersPanel>` num wrapper condicional na Lista).
- **Sem migration, sem serviço** — 100% front.

## Testing

- **UI (Playwright/manual):**
  - Abrir a Lista a partir do Kanban de um tema (`?cat=`) → coluna "Tema" ausente; demais colunas ok.
  - Selecionar "Todos os temas" no dropdown → coluna "Tema" aparece, **antes** de "Tipo de Caso".
  - Menu "Colunas" → ocultar "Município" some cabeçalho + células juntos; remostrar volta.
  - Toggle "Filtros" recolhe/expande o painel sem alterar os resultados filtrados.
  - Ordenar por "Tema" e por "Tipo de Caso" continua funcionando após a reordenação.
- **Regressão:** contagem de casos, paginação, busca textual e campos dinâmicos idênticos ao atual na visão "Todos os temas".
- `typecheck`/`lint`/`build` verdes.

## Dependências

- **Reusa** `effectiveTemaId` e `hidden_in_list` já existentes (R2-09 / A2). Não depende de C3/C4/C5.
- **Não** precisa de migration nem de A3 (embora conviva bem com o filtro por kanban `board` já presente na Lista).
- **Independe** dos demais itens do épico.

## File List

**Novos**
- (nenhum — 100% UI em arquivos existentes)

**Alterados**
- `sistema-hv/src/routes/casos.lista.tsx` (reordenar colunas Tema→Tipo; auto-ocultar "Tema" com tema efetivo; menu "Colunas"; toggle "Filtros"; `colCount`/`colSpan` coerentes)
- `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` (apenas se o recolher exigir um prop; preferir wrapper local na Lista)

## Change Log

| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). E1a: coluna "Tema" auto-oculta quando `effectiveTemaId` truthy. E2: reordem Tema→Tipo de Caso. E1b: menu "Colunas" (Popover+Checkbox) oculta/mostra colunas fixas + checkbox "Mostrar filtros" recolhe `CaseFiltersPanel`; estado LOCAL. Corpo da tabela refatorado p/ iterar por `columns` (novo componente `CaseCell`), garantindo cabeçalho↔célula sempre alinhados e `colCount` coerente. Reuso de `hidden_in_list` p/ colunas dinâmicas inalterado. Arquivo: `sistema-hv/src/routes/casos.lista.tsx` (único; `CaseFiltersPanel.tsx` NÃO tocado). Gates: `typecheck` verde (só erro pré-existente em `contaazul/service.ts`); `eslint casos.lista.tsx` 0 erros (2 warnings exhaustive-deps pré-existentes; original tinha 3). Smoke UI pendente @qa. | @dev |
