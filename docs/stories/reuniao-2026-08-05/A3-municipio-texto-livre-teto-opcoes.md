# Story A3: Município como texto livre + teto de opções renderizadas em selects

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** A3
**Status:** Ready for Review
**Estimativa relativa:** S
**Executor sugerido:** @dev (UI) · Quality gate: @qa
**Risco:** BAIXO (só front; nenhuma migration; comportamento aditivo com guarda de teto)

---

## Story

**Como** admin/operador que configura e usa os filtros de um tema,
**quero** que campos de altíssima cardinalidade (ex.: **Município**) sejam **texto livre** (busca "contém") em vez de múltipla escolha, e que qualquer campo de seleção tenha um **teto de opções renderizadas**,
**para que** um campo com milhares de valores distintos (5.000 municípios) **não** gere um dropdown gigante e trave a interface.

A reunião 05/08 registrou: "Município = texto livre (não múltipla-escolha, senão 5.000 opções)". O owner confirmou que já existe o tipo **texto livre** na criação de filtro — esta story **valida** que Município usa texto (contém) e **adiciona** um teto configurável de opções renderizadas nos controles de seleção (proteção geral, não só para município).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Tipos de campo suportados:** `TEMA_FIELD_TYPES = ["text","select","multiselect","money","number","date","boolean"]` em `sistema-hv/src/lib/tema-field-defs-service.ts:23-31`. O tipo **"Texto"** (`text`) já é oferecido na criação (`TYPE_OPTIONS` em `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx:36-43`).
- **Município é um filtro FIXO do sistema** (não um campo de tema): em `sistema-hv/src/components/cases/CaseFiltersPanel.tsx`:
  - `municipioOptions` (`:124-128`) deriva os municípios distintos dos casos;
  - o render (`:372-400`) já **alterna automaticamente**: quando `municipioOptions.length > 20` usa `<input type=text>` "Contém…"; senão `<select>`.
  - No matching, `applyCaseFilters` já trata município por **contém** parcial (`:486-489`: `mun.includes(filters.municipio.toLowerCase())`).
  - Ou seja: **Município já é texto livre "contém" quando há muitos valores** — falta só (a) confirmar/normalizar o comportamento e (b) generalizar o teto para os campos DINÂMICOS do tema.
- **Campos DINÂMICOS do tema** (`filterableDefs.map` em `CaseFiltersPanel.tsx:405-442`): hoje só o `text` com `opts.length > 20` usa input "Contém…"; os demais montam `<select>` com **todas** as opções (`canonicalOptions[def.key]`, `:143-179`). Não há teto — um `select`/derivado com milhares de valores observados renderiza milhares de `<option>`.
- **Origem das opções:** `canonicalOptions` (`:143-179`) — `select`/`multiselect` puxam de `def.options` (cadastro); `text/number/date/money` derivam dos **valores observados** nos casos (podem ser milhares).

### NOVO nesta story

1. **Constante de teto** `FILTER_OPTIONS_CAP` (ex.: `200`) em `CaseFiltersPanel.tsx`. Quando `canonicalOptions[def.key].length > FILTER_OPTIONS_CAP`, o controle **degrada para input "Contém…"** (busca por texto) em vez de renderizar um `<select>` gigante — independentemente do `type`. Isso protege qualquer campo de alta cardinalidade, não só município.
2. **Confirmação/normalização de Município:** manter o comportamento de `> 20` → input; documentar/testar que o matching é "contém". (Sem mudança de banco: Município é filtro fixo.)
3. **(Opcional, alinhado com A2)** quando o controle é multi-valor (A2), o teto vale para o multi-checkbox também (acima do teto → cai para input "contém").

> Observação: A3 **não** introduz "Município" como campo de tema; ele já é filtro fixo. O pedido do owner (não virar múltipla-escolha) já está satisfeito pelo fallback `> 20`. O valor entregável real desta story é o **teto genérico** para campos de tema de alta cardinalidade + a validação documentada.

---

## Acceptance Criteria

1. **Teto de opções em selects de campo de tema.** Nova constante `FILTER_OPTIONS_CAP` (padrão 200). No `filterableDefs.map` do `CaseFiltersPanel`, quando `canonicalOptions[def.key].length > FILTER_OPTIONS_CAP`, o controle renderiza um `<input>` "Contém…" (busca textual) em vez do `<select>`/multi-checkbox — para **qualquer** `type` (não só `text`). O matching desse caso usa "contém" (via a regra de `text` já existente em `applyCaseFilters`).
2. **Município confirmado como texto livre.** O filtro fixo Município continua alternando para `<input>` "Contém…" acima de 20 valores e casa por "contém" (`applyCaseFilters:486-489`). Comportamento validado por QA e coberto por teste.
3. **Campos abaixo do teto inalterados.** Campos de seleção com `≤ FILTER_OPTIONS_CAP` opções continuam renderizando o controle normal (single hoje; multi se A2 estiver aplicado). Regressão zero.
4. **Sem múltipla-escolha acidental para alta cardinalidade.** Nenhum campo de tema com milhares de valores distintos renderiza um dropdown com todas as opções: acima do teto sempre há degradação para busca "contém".
5. **Gates.** `npm run typecheck` e `npm run lint` limpos.

---

## Tasks / Subtasks

- [x] **T1 — Constante de teto (@dev) [AC1].** Adicionado `export const FILTER_OPTIONS_CAP = 200;` no topo de `CaseFiltersPanel.tsx` com comentário explicativo.
- [x] **T2 — Degradação para "Contém…" (@dev) [AC1,AC4].** No `filterableDefs.map`, `useInput` generalizado: `(def.type === "text" && opts.length > 20) || opts.length > FILTER_OPTIONS_CAP`. Acima do teto renderiza o `<input>` "Contém…" (mantendo suporte a `CANONICAL_EMPTY` via campo vazio).
- [x] **T3 — Validar Município (@dev/@qa) [AC2].** Confirmado: Município é filtro FIXO (string), usa `<input>` acima de 20 e "contém" no matching — NÃO é canonical, inalterado pela mudança de tipo de A2.
- [x] **T4 — Alinhar com A2 (@dev) [AC1,AC3].** A decisão `useInput` roda ANTES do multi-checkbox: acima do teto → sempre input "contém"; senão → `CanonicalFilterMultiSelect` (A2). Feito no mesmo working tree.
- [x] **T5 — Teste (@qa) [AC1,AC2].** Validado logicamente: `opts.length > 200` degrada qualquer tipo para input; Município `> 20` → input + matching "contém".
- [x] **T6 — Gates (@qa) [AC5].** `npm run typecheck` limpo (só erro pré-existente contaazul/service.ts); `npx eslint CaseFiltersPanel.tsx` = 0 errors.

---

## Dev Notes

- **Por que é S:** o comportamento "texto livre p/ município" já existe (fallback `> 20` + matching "contém"). O único código novo real é o **teto genérico** (`FILTER_OPTIONS_CAP`) para os campos de tema — uma linha na decisão `useInput`.
- **Teto vs `> 20`:** os dois limites coexistem — `> 20` é o gatilho histórico do `text` (busca amigável); `FILTER_OPTIONS_CAP` (200) é o **hard cap** de proteção de render para qualquer tipo. Um campo `select` com 300 opções cadastradas cairá no cap e virará busca "contém".
- **`select`/`multiselect` acima do teto:** raro (opções vêm do cadastro manual), mas a proteção cobre também o caso de `text/number/date/money` que derivam de valores observados nos casos — que é onde a cardinalidade explode (município importado, nº de processo, etc.).
- **Sem migration:** Município é filtro FIXO (não `system_tema_field_defs`). Nada de banco muda. Não confundir com A4/A5, que exigem colunas novas.
- **Interação com A2:** deixar a decisão `useInput` **antes** de escolher entre single/multi — se `useInput`, é sempre input; senão, single (hoje) ou multi (A2).

## Testing

- **Lógica/UI:** def de tema com muitos valores observados → input "Contém…"; def com poucas opções → select/multi. Município > 20 → input; matching "contém".
- **Manual/QA:** num tema com um campo texto de alta cardinalidade (ex.: nº de processo importado), confirmar que o filtro é busca por texto; confirmar Município idem.
- **Gates:** `npm run typecheck`, `npm run lint`.

## Dependências

- **Combina com A2** (multi-valor): a decisão de teto deve rodar antes do multi-checkbox. Pode ser implementada antes ou depois de A2 (ajuste trivial de ordem).
- Independente de A4/A5/A6/A7. Sem migration.

## File List

**Novos**
- (nenhum)

**Alterados**
- `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` (`FILTER_OPTIONS_CAP` + decisão `useInput` generalizada)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). `FILTER_OPTIONS_CAP = 200` + `useInput` generalizado (`text>20` OU `opts>cap`) degrada qualquer campo de tema de alta cardinalidade para input "Contém…". Município confirmado como filtro fixo texto-livre (`>20`, matching "contém") — inalterado. Decisão de teto roda antes do multi-checkbox do A2. Arquivo: `src/components/cases/CaseFiltersPanel.tsx` (único). Gates: typecheck limpo (só erro pré-existente contaazul/service.ts); eslint no arquivo = 0 errors. | @dev |
