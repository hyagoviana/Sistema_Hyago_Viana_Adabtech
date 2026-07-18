# Story R1-04: Ficha da pessoa ramificada por TEMA → caso — N1

- **Sprint/Epic:** Reforma 2026-07 · **R1 — Modelo Pessoa/Lead/Cliente por caso** (bloco B1)
- **ID:** R1-04
- **Status:** Ready for Review
- **Estimativa relativa:** M (agrupamento por tema na ficha; UI condicionada à existência de R2)
- **Executor sugerido:** @dev (UI) + @architect (contrato com R2) · Quality gate: @qa

---

## Story

**Como** operador que abre a ficha de uma pessoa com vários casos,
**quero** ver os casos **agrupados por TEMA** (a pessoa pode ter 3 casos de 3 temas diferentes: tema → caso),
**para que** eu navegue por assunto e entenda rapidamente as frentes daquela pessoa.

---

## Contexto / o que JÁ EXISTE vs NOVO

> **Pedido (doc-mestre B1 / item N1):** *"ficha da pessoa ramificada por TEMA (pessoa pode ter 3 casos de 3 temas; agrupar por tema → caso)."*
> **ATENÇÃO — cruzamento com R2:** o conceito de **TEMA** é entregue pelo épico **R2 (B2 do doc-mestre)**. Enquanto R2 não existir, o "tema" é representado pelo campo legado **`system_cases.case_type`** (o service_type atual, que VIRA tema — doc-mestre §4.2). Esta story constrói a **ramificação** de forma que **funcione hoje com `case_type`** e **passe a usar o TEMA quando R2 chegar**, sem reescrever a UI.

- **JÁ EXISTE (agrupador atual disponível):** `system_cases.case_type` (slug do service_type) — exposto em `system_cases_active` e presente em cada card via `c.case_type` (`ClientCasesSection.tsx:74`). Labels em `CASE_TYPE_LABELS` (`src/lib/cases/constants.ts`).
- **JÁ EXISTE (nome amigável do agrupador):** o **nome** da categoria vem de `system_service_types.name` (por `slug`) — `cases-service.ts:52-59` já resolve nome por slug.
- **JÁ EXISTE (lista particionada por lifecycle):** R1-03 introduz a partição LEAD/CLIENTE na mesma `ClientCasesSection`.
- **NOVO:** camada de **agrupamento por TEMA** dentro da ficha:
  - Nível 1 = **TEMA** (hoje derivado de `case_type`/service_type; amanhã do `tema_id` de R2);
  - Nível 2 = **casos** daquele tema (reusando os cards/seções LEAD/CLIENTE de R1-03).
- **NOVO (isolamento de dependência):** um **adaptador** `getCaseTemaKey(case)` que hoje retorna `case_type`/service_type e, quando R2 existir, passa a retornar o `tema_id`/`tema_slug`. A UI consome só o adaptador → troca sem refatorar a ficha.

> **DECISÃO TRAVADA:** a ramificação por tema entra **atrás de um adaptador** (`getCaseTemaKey`) para não acoplar a UI ao modelo pré-R2. Com R2 ausente, agrupa por `case_type` (comportamento útil desde já); com R2 presente, agrupa por TEMA real. **Sem migration nesta story.**

---

## Acceptance Criteria

1. Na ficha da pessoa, os casos aparecem agrupados por **TEMA** (nível 1), e dentro de cada tema por lifecycle (LEAD/CLIENTE), reusando R1-03.
2. Uma pessoa com 3 casos de 3 temas distintos mostra **3 grupos de tema**, cada um com seu(s) caso(s).
3. O rótulo do tema usa o **nome** amigável (via `system_service_types.name` hoje; via nome do TEMA quando R2 existir), com fallback para o slug.
4. A UI consome **exclusivamente** o adaptador `getCaseTemaKey`/`getCaseTemaLabel`; trocar a implementação do adaptador (de `case_type` para `tema_id`) **não** exige alterar o componente de ficha.
5. Enquanto R2 não estiver mergeado, o agrupamento por tema pode ficar atrás de flag/feature simples OU operar com `case_type` sem quebrar (decisão: **operar com `case_type` desde já**, pois é útil e reversível).
6. Nenhuma query nova além da já usada (`useCasesList({ client_id })`); agrupamento client-side.

---

## Tasks / Subtasks

- [x] **Adaptador de tema** (AC:4) — criado `getCaseTemaKey(caso)` e `getCaseTemaLabel(caso, maps)` em `src/lib/cases/case-tema.ts`. **R2 já aplicado**, então o adaptador usa o `tema_id` REAL quando presente (`tema:{id}`), cai para `case_type` legado (`ct:{slug}`) e, sem nenhum, `__none__`.
- [x] **Resolver nomes de tema** (AC:3) — mapas leves derivados de `useTemas` (tema_id→name) e `useServiceTypes` (slug→name), montados UMA vez na ficha (ambos com cache de 5min). Fallback: `CASE_TYPE_LABELS` → slug.
- [x] **Agrupar na ficha** (AC:1,2,6) — em `ClientCasesSection`, `groupCasesByTema` (nível 1 = TEMA, header + rótulo + contagem); dentro de cada tema, `TemaSection` reusa `partitionCasesByLifecycle` de R1-03 (Efetivados/Aguardando/Perdidos).
- [x] **Ponto de extensão R2** (AC:4,5) — comentado no topo de `case-tema.ts` que a troca `case_type→tema_id` **já está feita** (R2 aplicado). A UI consome só o adaptador; a assinatura (`getCaseTemaKey`/`getCaseTemaLabel`) é o contrato estável.
- [x] **Testes** (AC:1-6) — `src/lib/cases/case-tema.test.ts` (contrato: key/label/fallback + "trocar impl não muda a superfície"). `tsc --noEmit` sem erro novo; `eslint` sem erro; `test:rbac` verde.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases/` (novo `case-tema.ts` com `getCaseTemaKey`/`getCaseTemaLabel`).
- `sistema-hv/src/components/cases/ClientCasesSection.tsx` (agrupamento por tema × partição por lifecycle).
- (Opcional) hook para `system_service_types (slug,name)`.

**Regras de ouro (pertinentes):**
- **NÃO** deletar `case_type` — ele É o agrupador de tema hoje (e permanece por dual-write mesmo depois de R2).
- Sem migration; sem tocar `system_cases_active`.
- Não criar status/tema na PESSOA.

**Riscos de regressão:**
- Acoplar a UI direto a `case_type` re-trabalha tudo quando R2 chegar → **obrigatório** passar pelo adaptador.
- Casos sem `case_type` (legados) devem cair num grupo "Sem tema" para não sumirem.

### Testing
- Pessoa com casos FIES_ESF, COVID, RESIDENCIA → 3 grupos com nomes amigáveis.
- Trocar a implementação do adaptador (mock retornando `tema_id`) NÃO altera o JSX da ficha (teste de contrato).
- Caso sem `case_type` → grupo "Sem tema".
- Dentro do tema, casos LEAD e CLIENTE aparecem separados (R1-03).
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** R1-03 (partição por lifecycle na mesma seção) e R1-01 (lifecycle válido).
- **Cruzamento com R2 (TEMA) — EXPLÍCITO e DURO:** o agrupador definitivo (TEMA real, `tema_id`) vem de **R2/B2**. Esta story entrega a ramificação **atrás do adaptador** operando com `case_type`; a **ativação plena por TEMA** só acontece quando R2 fornecer `tema_id`/`tema_slug` no caso e o adaptador for repontado. **Não implementar a modelagem de TEMA aqui.**
- **Cruzamento com R5 (permissões, se existir):** o agrupamento não expõe valores ($); sem gate financeiro necessário.

## File List

- `sistema-hv/src/lib/cases/case-tema.ts` (novo — adaptador de tema: `getCaseTemaKey`/`getCaseTemaLabel` + `SEM_TEMA_KEY`)
- `sistema-hv/src/lib/cases/case-tema.test.ts` (novo — teste de contrato do adaptador, standalone via `tsx`)
- `sistema-hv/src/components/cases/ClientCasesSection.tsx` (agrupamento por tema × partição por lifecycle)

## Dev Agent Record

**Agent:** @dev (James) · **Data:** 2026-07-18

**Abordagem**
- **Adaptador `case-tema.ts`** — único ponto que a UI consulta para chave/rótulo do tema. Como **R2 já está aplicado** (`system_cases.tema_id` + `system_temas`), a troca `case_type→tema_id` **já está feita aqui**: `getCaseTemaKey` retorna `tema:{tema_id}` (temas reais de R2, com prioridade), senão `ct:{case_type}` (legado), senão `__none__`. Chaves namespaced para nunca colidir um UUID de tema com um slug de case_type. `getCaseTemaLabel` resolve o nome amigável: tema→`system_temas.name`; case_type→`system_service_types.name` (mapa) ou `CASE_TYPE_LABELS`; fallback ao slug; `"Sem tema"` para `__none__`.
- **Resolução de nomes sem query nova** — na ficha, `useTemas` e `useServiceTypes` (ambos já existentes, cache de 5min, compartilhados no app) são reduzidos a dois `Record` (`temaNameById`, `serviceTypeNameBySlug`) via `Object.fromEntries`, montados UMA vez em `useMemo`. Nenhuma query por caso.
- **Agrupamento na ficha** — `groupCasesByTema` (nível 1 = TEMA) preserva a ordem original dos casos e joga `__none__` para o final (casos legados nunca somem). Cada grupo vira um `TemaSection` (header + rótulo + contagem) que **reusa `partitionCasesByLifecycle` de R1-03** para as subseções Efetivados/Aguardando/Perdidos. O card e o `Link to="/casos/$id"` ficaram intactos.
- **Client-side, sem migration** — nenhuma tabela/view/trigger tocada; só a query existente `useCasesList({ client_id })` + os dois mapas de nomes. `case_type` preservado.

**Validação**
- `npx tsx src/lib/cases/case-tema.test.ts` → 12/12 asserções OK (key/label/fallback + contrato "trocar impl não muda a superfície").
- `npm run typecheck` → **sem erro novo**. Os 6 arquivos com erro (`checklist-service`, `dossie-service`, `termo-service`, `visibility`, `casos.$id`, `casos.financeiro.index`) já falhavam no baseline (confirmado stashando as mudanças); nenhum é arquivo tocado por esta story.
- `npm run test:rbac` → 🎉 todos passaram.
- `npx eslint` nos 3 arquivos → 0 erros; 1 warning `react-refresh/only-export-components` **pré-existente** (o export de `partitionCasesByLifecycle` de R1-03). `prettier --write --end-of-line lf` → tudo `unchanged`.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (N1 / B1; dependência explícita de R2) | @sm |
| 2026-07-18 | 0.2 | Implementado: adaptador `case-tema.ts` (**já usa o `tema_id` real de R2**, com fallback case_type→"Sem tema") + agrupamento tema→lifecycle na ficha reusando R1-03 + teste de contrato. Client-side, sem migration. Status → Ready for Review. | @dev |
