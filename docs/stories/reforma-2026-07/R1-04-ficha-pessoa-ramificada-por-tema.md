# Story R1-04: Ficha da pessoa ramificada por TEMA → caso — N1

- **Sprint/Epic:** Reforma 2026-07 · **R1 — Modelo Pessoa/Lead/Cliente por caso** (bloco B1)
- **ID:** R1-04
- **Status:** Draft
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

- [ ] **Adaptador de tema** (AC:4) — criar `getCaseTemaKey(case)` e `getCaseTemaLabel(case, serviceTypeNameBySlug)` em `src/lib/cases/` (hoje: `case_type` + nome do service_type; TODO explícito marcando o ponto de troca para o `tema_id` de R2).
- [ ] **Resolver nomes de tema** (AC:3) — buscar `system_service_types (slug,name)` uma vez (hook/derivação) para rotular; fallback ao slug.
- [ ] **Agrupar na ficha** (AC:1,2,6) — em `ClientCasesSection`, agrupar por `getCaseTemaKey`; dentro de cada tema, reusar a partição LEAD/CLIENTE de R1-03.
- [ ] **Ponto de extensão R2** (AC:4,5) — comentar claramente onde o adaptador troca para o TEMA; garantir que a assinatura do adaptador não muda.
- [ ] **Testes** (AC:1-6) — ver Testing; `npx tsc --noEmit` / `npm run lint` verdes.

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

- `sistema-hv/src/lib/cases/case-tema.ts` (novo — adaptador de tema)
- `sistema-hv/src/components/cases/ClientCasesSection.tsx` (agrupamento por tema)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (N1 / B1; dependência explícita de R2) | @sm |
