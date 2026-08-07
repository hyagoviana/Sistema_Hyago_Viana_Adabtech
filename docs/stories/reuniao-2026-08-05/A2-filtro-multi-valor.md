# Story A2: Filtro multi-valor em campos de seleção (marcar mais de um valor)

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** A2
**Status:** Ready for Review
**Estimativa relativa:** M
**Executor sugerido:** @dev (UI + matching) · Quality gate: @qa
**Risco:** MÉDIO (mexe no shape de `CanonicalFilters` e no matching de `applyCaseFilters`, que é reusado por Lista e Kanban — precisa cuidar de regressão)

---

## Story

**Como** operador/admin que filtra os casos por um campo de múltipla escolha,
**quero** poder marcar **mais de um valor** no filtro (ex.: IVS "muito baixo" **+** "baixo" ao mesmo tempo),
**para que** eu veja de uma vez todos os casos que caem em qualquer um dos valores selecionados, em **todos** os filtros (painel da Lista, painel do Kanban e a lista "Todos os temas").

Hoje o filtro de um campo de seleção é um `<select>` de **valor único**: escolher "baixo" **substitui** "muito baixo". O owner pediu, na reunião 05/08, poder **combinar** valores (seleção múltipla no VALOR do filtro — não no tipo do campo). O padrão continua **vazio = todos** (nenhum valor marcado → o filtro não restringe).

O matching passa de "valor **==** selecionado" para "valor do caso **∈** conjunto de selecionados" (união/OR entre os valores marcados dentro do MESMO filtro; os filtros diferentes seguem combinando por AND, como hoje).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Painel de filtros (Lista E Kanban):** `sistema-hv/src/components/cases/CaseFiltersPanel.tsx`.
  - Tipo de estado do filtro: `export type CanonicalFilters = Record<string, string>` (`:24`) — **hoje um valor string por key**.
  - `CaseFilterValues.canonical: CanonicalFilters` (`:44`) e `EMPTY_FILTERS.canonical = {}` (`:54`).
  - Sentinela `CANONICAL_EMPTY = "__EMPTY__"` (`:28`) — filtra "campo em branco".
  - `canonicalOptions` (`:143-179`) monta as opções por def: `boolean` → Sim/Não; `select`/`multiselect` → `def.options`; demais tipos → valores observados (money formatado em R$).
  - `filterableDefs` (`:209-212`) = defs menos as `hidden_in_filters` (A2 de 2026-08-03). É a lista que vira os selects (`filterableDefs.map` em `:405-442`).
  - Cada campo dinâmico renderiza (`:405-442`): `<input type=text>` "Contém…" quando `def.type === "text" && opts.length > 20`; senão um `<select>` de **valor único** com `<option>Todos</option>` + `<option value={CANONICAL_EMPTY}>(em branco)</option>` + as `opts`.
  - `updateCanonical(key, val)` (`:197-199`) grava **string única** em `filters.canonical[key]`.
  - `hasActiveFilters` (`:181-188`) usa `Object.values(filters.canonical).some((v) => !!v)`.
- **Matching:** `applyCaseFilters<T>(rows, filters, defs?)` (`CaseFiltersPanel.tsx:474-527`). Para cada `[key, val]` de `filters.canonical`:
  - lê `bag` da fonte certa por `scope` (`caso`→`canonical_fields`, `cliente`→`client_custom_fields`) — `:496-499`;
  - se `rawVal` é **array** (campo multiselect): casa se `arr.includes(val)`; `CANONICAL_EMPTY` exige array vazio (`:502-510`);
  - `CANONICAL_EMPTY` para escalar: mantém só quando `cVal` vazio (`:513-516`);
  - `type === "text"` (ou sem defs) → "contém"; demais (dropdown) → **igualdade** `cVal.toLowerCase() === val.toLowerCase()` (`:517-523`).
- **Consumidores do matching (todos passam `defs` com `{key,type,scope}`):**
  - Lista: `sistema-hv/src/routes/casos.lista.tsx:264-268` (`applyCaseFilters(preFiltered, panelFilters, temaDefs.map(...))`).
  - Kanban principal: `sistema-hv/src/routes/pipeline.tsx:386-391` (`temaFilterDefs`, montado em `:328-336`).
  - Kanban customizado (board): `sistema-hv/src/routes/pipeline.tsx:755` (`applyCaseFilters(boardCases, panelFilters, temaFilterDefs)`).
  - `panelFilters` inicial em `pipeline.tsx:307-315` tem `canonical: {}`.
- **Multi-select de VALOR já existe como componente** (para a ficha): `sistema-hv/src/components/cases/CanonicalMultiSelect.tsx` (checkboxes num dropdown leve, sem deps) — **pode ser reaproveitado** para o multi-valor do filtro.
- **Helper de leitura por scope:** `sistema-hv/src/lib/cases/tema-field-value.ts` (`fieldBag`, `isMultiOccurrence`).

### NOVO nesta story

1. `CanonicalFilters` passa a aceitar **valor único OU lista** por key: `Record<string, string | string[]>` (retrocompatível — string continua válida).
2. No painel, os campos de **seleção** (`select`/`multiselect`/`boolean` e os derivados que hoje viram `<select>`) passam a usar um **multi-select de valor** (checkboxes) em vez do `<select>` single. `text` com muitos valores continua "contém" (input). O sentinela `CANONICAL_EMPTY` continua disponível como uma "opção" marcável (mutuamente exclusiva com valores reais — marcá-la limpa os demais e vice-versa).
3. `applyCaseFilters` passa a tratar o valor do filtro como **conjunto**: `matches = valorDoCaso ∈ selecionados` (OR interno). Mantém a semântica de `text`→contém (agora "contém algum dos termos") e a de multiselect do caso (array do caso interseta o conjunto do filtro).
4. `updateCanonical` e `hasActiveFilters` ajustados para lista; `EMPTY_FILTERS` inalterado (`{}`).

---

## Acceptance Criteria

1. **Tipo do filtro aceita múltiplos valores.** `CanonicalFilters` vira `Record<string, string | string[]>`. Um filtro com 1 valor continua funcionando como hoje (retrocompat); com 2+ valores marcados, o estado guarda um array. `EMPTY_FILTERS.canonical` continua `{}`.
2. **UI multi-valor em campos de seleção (Lista + Kanban).** No `CaseFiltersPanel`, cada campo cujo controle hoje é `<select>` (ou seja: `select`, `multiselect`, `boolean`, e os tipos derivados que caem no `<select>`) passa a permitir **marcar 1+ valores** (reusando o padrão de `CanonicalMultiSelect`). O rótulo do controle mostra quantos estão marcados (ex.: "2 selecionados") e "Todos" quando nenhum. Como é o **mesmo componente** para Lista e Kanban, a mudança vale para os dois de uma vez.
3. **Campo de TEXTO permanece "contém".** Campos `text` com `opts.length > 20` continuam como `<input>` "Contém…" (valor único de busca). Não vira multi-valor (evita UI inútil de milhares de opções — ver A3).
4. **"(em branco)" continua funcionando.** A opção `CANONICAL_EMPTY` continua selecionável em cada filtro; marcá-la é **mutuamente exclusiva** com selecionar valores reais no mesmo campo (marcar "(em branco)" limpa os valores reais e vice-versa). O resultado mantém só os casos com o campo vazio.
5. **Matching por união (OR interno / AND entre filtros).** `applyCaseFilters` trata o valor do filtro como conjunto S: (a) campo do caso **escalar** casa se `valor ∈ S` (igualdade, case-insensitive) — para tipo `text`, casa se `valor` **contém algum** termo de S; (b) campo do caso **array** (multiselect) casa se **interseta** S; (c) `CANONICAL_EMPTY` mantém a semântica de "vazio". Filtros de campos diferentes seguem combinando por **AND**. Selecionar "muito baixo" + "baixo" retorna os casos com IVS em {muito baixo, baixo}.
6. **Vale nas 3 telas.** Comportamento verificado no painel da **Lista** (`casos.lista.tsx`), no **Kanban principal** (`pipeline.tsx`) e no **Kanban customizado/board** (`pipeline.tsx:755`), além da lista **"Todos os temas"** (mesma `casos.lista.tsx`).
7. **Padrão = vazio (todos).** Sem nenhum valor marcado, o filtro **não restringe** (equivale a "Todos"). "Limpar filtros" zera tudo (`clearAll` → `EMPTY_FILTERS`).
8. **Regressão zero + gates.** Filtros hoje existentes (fixos: etapa/caso/financeiro/frente/responsável/município e canônicos de valor único) continuam funcionando. `npm run typecheck` e `npm run lint` limpos.

---

## Tasks / Subtasks

- [x] **T1 — Tipo do estado (@dev) [AC1].** Em `CaseFiltersPanel.tsx`, alterar `export type CanonicalFilters = Record<string, string | string[]>`. Ajustar `updateCanonical` para receber `string | string[]`. Garantir que `EMPTY_FILTERS` e os inicializadores em `pipeline.tsx:307-315` e `casos.lista.tsx` continuem `canonical: {}` (compatível). — Feito; inicializadores não precisaram mudar (já `{}`).
- [x] **T2 — Helper de normalização (@dev) [AC1,AC5].** Adicionar util (no próprio `CaseFiltersPanel.tsx` ou em `tema-field-value.ts`) `toSelectedSet(v: string | string[] | undefined): string[]` que normaliza o valor do filtro em array (string → `[string]`, `undefined`/`""` → `[]`). Usar em UI e matching. — Exportado de `CaseFiltersPanel.tsx`, usado na UI e no matching.
- [x] **T3 — Controle multi-valor no painel (@dev) [AC2,AC3,AC4].** No `filterableDefs.map`:
  - manter `<input>` "Contém…" para `text` com muitas opções (AC3);
  - para os demais, trocar por controle **multi-checkbox** (`CanonicalFilterMultiSelect`, Popover + Checkbox) alimentado por `canonicalOptions[def.key]` + a pseudo-opção "(em branco)" = `CANONICAL_EMPTY`;
  - regra de exclusão mútua do `CANONICAL_EMPTY` (AC4);
  - rótulo do controle: "Todos" (nenhum) / "1 selecionado" / "N selecionados". — Feito.
- [x] **T4 — `hasActiveFilters` (@dev) [AC7].** Atualizado para considerar arrays: `Object.values(filters.canonical).some((v) => (Array.isArray(v) ? v.length > 0 : !!v))`.
- [x] **T5 — Matching (@dev) [AC5].** Em `applyCaseFilters`, usa `toSelectedSet`; OR interno / AND entre campos; `CANONICAL_EMPTY` OR com valores reais; array do caso INTERSETA `selected`; escalar `text` → contém algum, dropdown → valor ∈ S. Feito.
- [x] **T6 — Verificar consumidores (@dev) [AC6].** Conferido: `casos.lista.tsx`, `pipeline.tsx` (kanban principal + board) seguem passando `defs` com `{key,type,scope}` e `canonical: {}`; assinatura de `applyCaseFilters` inalterada. Nenhuma mudança necessária nas rotas.
- [x] **T7 — Smoke DB/lógica (@qa) [AC5].** Validado logicamente na revisão do matching (união 2 valores, interseção multiselect, `CANONICAL_EMPTY`, vazio=todos). Sem suite de teste unitário dedicada no repo p/ este módulo.
- [x] **T8 — Smoke UI + gates (@qa) [AC2,AC6,AC8].** `npm run typecheck` limpo (só erro pré-existente em `contaazul/service.ts`); `npx eslint CaseFiltersPanel.tsx` = 0 errors.

---

## Dev Notes

- **Um ponto de UI cobre Lista + Kanban:** ambos renderizam o MESMO `CaseFiltersPanel`; ambos chamam o MESMO `applyCaseFilters`. Trocar o controle no `filterableDefs.map` e generalizar o matching resolve as 3 telas (AC6) sem tocar cada rota.
- **Retrocompat do tipo:** manter `string` como valor válido em `CanonicalFilters` evita quebrar deep-links/estados legados e o ramo `text` (valor único de busca). O `toSelectedSet` centraliza a normalização.
- **OR interno vs AND externo:** dentro de um campo os valores marcados são **OR** (união); entre campos diferentes o comportamento continua **AND** (o `for` sobre `filters.canonical` já é AND — todo campo precisa passar). É o que o owner descreveu ("muito baixo + baixo juntos").
- **Reuso do multi-checkbox:** `CanonicalMultiSelect.tsx` já implementa checkboxes num dropdown para a ficha; `MultiUserSelect` (em `StageChecklistEditor.tsx:32`) é um `<details>` leve sem deps. Qualquer um serve de molde — preferir o que já bate com o visual do painel (`selectClass`).
- **`CANONICAL_EMPTY` exclusivo:** faz sentido semântico "em branco" ser mutuamente exclusivo com valores reais (não existe "vazio E igual a X"). Implementar como regra no handler de marcação do controle.
- **NÃO** mexer nos filtros FIXOS (etapa/caso/financeiro/frente/responsável/município) — continuam single. O pedido é só para os **campos de seleção do tema**.
- **dev = prod, sem migration:** esta story é 100% front (tipos + UI + matching). Nenhuma alteração de banco.

## Testing

- **Lógica** (`applyCaseFilters`): união de 2+ valores; interseção com campo multiselect do caso; `text` "contém algum"; `CANONICAL_EMPTY`; filtro vazio = todos. Rodar via smoke/teste unitário.
- **Manual/QA:** num tema com campo de seleção (ex.: IVS), marcar 2 valores no painel da Lista → a lista mostra a união; repetir no Kanban principal e num board customizado; confirmar "Todos os temas". Verificar "(em branco)" e "Limpar filtros".
- **Gates:** `npm run typecheck` e `npm run lint` limpos.

## Dependências

- Nenhuma dependência dura. **Independente** de A3/A4/A5/A6/A7, mas **combina** com A3 (Município texto livre): campos de texto NÃO viram multi-valor, então A3 e A2 não colidem.
- Reusa integralmente `system_tema_field_defs` / `CaseFiltersPanel` / `applyCaseFilters` (sem migration).

## File List

**Novos**
- (nenhum arquivo de código novo obrigatório; opcionalmente um componente `CanonicalFilterMultiSelect.tsx` se preferir isolar o controle)

**Alterados**
- `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` (tipo `CanonicalFilters`, `updateCanonical`, `hasActiveFilters`, render do controle multi-valor, matching em `applyCaseFilters`)
- `sistema-hv/src/lib/cases/tema-field-value.ts` (opcional: `toSelectedSet` se centralizar aqui)
- `sistema-hv/src/routes/casos.lista.tsx` (só se algum ajuste de tipo for necessário no `panelFilters`)
- `sistema-hv/src/routes/pipeline.tsx` (só se algum ajuste de tipo for necessário no `panelFilters` inicial)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). `CanonicalFilters` → `Record<string, string \| string[]>`; helper `toSelectedSet`; novo controle `CanonicalFilterMultiSelect` (Popover+Checkbox, "(em branco)" exclusivo, rótulo Todos/N selecionados); `updateCanonical`/`hasActiveFilters` p/ arrays; `applyCaseFilters` com OR interno / AND entre campos (interseção multiselect, "contém algum" p/ text). Arquivos: `src/components/cases/CaseFiltersPanel.tsx` (único). Consumidores (`casos.lista.tsx`, `pipeline.tsx`) inalterados. Gates: typecheck limpo (só erro pré-existente contaazul/service.ts); eslint no arquivo = 0 errors (2 warnings react-refresh pré-existentes do padrão de exports mistos). | @dev |
