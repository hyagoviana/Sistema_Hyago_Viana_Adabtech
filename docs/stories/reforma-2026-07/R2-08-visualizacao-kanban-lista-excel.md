# Story R2-08: Visualização Kanban + Lista (tipo Excel) com filtros por tema/frente — N3

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **ID:** R2-08
- **Status:** Draft
- **Estimativa relativa:** M (alternância Kanban↔Lista + filtros tema/frente + colunas ricas na lista)
- **Executor sugerido:** @dev + @ux-design-expert · Quality gate: @architect
- **Risco:** MÉDIO (apresentação; sem migration; consome o modelo já reapontado)

---

## Story

**Como** usuário operacional,
**quero** ver os casos em **Kanban** (esteira por etapa) **e** em **Lista tipo Excel** (linhas/colunas densas, ordenável/filtrável), com **filtros por tema e por frente**,
**para que** eu escolha a visualização conforme a tarefa (fluxo vs análise em massa).

> **DECISÃO TRAVADA (N3, doc-mestre §4, §3.3):** manter as duas visões — Kanban (`pipeline.tsx`) e Lista (`casos.lista.tsx`) — agora organizadas por TEMA com filtro de frente; a Lista evolui para "tipo Excel" (colunas densas + ordenação + filtros), sobre a base client-side atual.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (Kanban):** `src/routes/pipeline.tsx` — board por categoria, toggle op/fin (`:316, :382-397`), DnD (`KanbanBoard`), filtros implícitos (esconde comercial/somente-fin `:332-341`).
- **JÁ EXISTE (Lista):** `src/routes/casos.lista.tsx` — tabela com busca client-side (`:36-50`), paginação `PAGE_SIZE=50` (`:22, :52-55`), colunas código/cliente/tipo/etapa/município/valor.
- **JÁ EXISTE (fonte):** `useCasesList`/`listCases` (`cases-service.ts:1316-1373`) com visibilidade (`getVisibleCaseIds`) e busca JSONB.
- **NOVO (depende de R2-05):** seleção/agrupamento por `tema_id`; filtro por `frente_slug`; na Lista, colunas adicionais (tema, frente, responsáveis) + ordenação por coluna; alternância explícita Kanban↔Lista dentro do contexto do tema.

> Esta story é a camada de **apresentação** de N3. O reaponte de dados (Kanban/lista por tema, filtro de frente respeitando etapas condicionais) é feito em **R2-05**; aqui refinamos a UX (toggle de visão, colunas Excel, ordenação, filtros combinados). Se R2-05 já cobrir o mínimo, R2-08 é o incremento de UX — pode ser fundida com R2-05 se o time preferir; mantida separada para não inflar a fase 5e.

### Fronteira de escopo com R2-05 (C6) — travada

Espelha a fronteira registrada em R2-05, para **evitar dupla-implementação** do toggle Kanban↔Lista e do filtro de frente:

- **R2-05 ENTREGA (não repetir aqui):** reaponte de DADOS — Kanban/Lista por `tema_id`; **filtro de frente funcional** (respeitando `system_pipeline_stages.frente_slug`, ocultando colunas condicionais vazias). R2-08 **consome** isso, não re-implementa.
- **R2-08 (esta story) ENTREGA:** a **alternância explícita Kanban↔Lista** no contexto do tema, a **Lista "tipo Excel"** (colunas densas + ordenação por coluna) e o refino visual dos filtros combinados.
- **Decisão alternativa:** R2-08 pode ser **fundida em R2-05** a critério do time. Enquanto separadas, vale esta fronteira.

---

## Acceptance Criteria

1. Dentro de um TEMA, o usuário alterna entre **Kanban** e **Lista** mantendo o filtro de tema (e o filtro de frente aplicado).
2. **Filtro por frente** disponível nas duas visões (chips/select), respeitando etapas condicionais no Kanban (`system_pipeline_stages.frente_slug`, R2-03).
3. **Lista tipo Excel:** colunas densas (código, cliente, tema, frente, etapa op, etapa fin, responsáveis, município, valor, criado em), **ordenação por coluna** e busca combinada (client-side sobre o conjunto visível).
4. Visibilidade RBAC preservada: advogado vê só seus casos (reuso de `getVisibleCaseIds`/`listCases`); telas de $ respeitam gate financeiro (cruzamento R1/R3) — a coluna "valor" só aparece com permissão.
5. Sem migration; sem tocar `system_cases`/view; dual-write intacto.
6. **Performance (quantificada — C9):** a Lista **mantém `PAGE_SIZE=50`** (`casos.lista.tsx:22`) e o tempo de render/interação (ordenação + filtro combinado sobre o conjunto visível) fica **≤ ao tempo atual** da Lista para o mesmo volume — sem regressão de latência mensurável (comparar antes/depois com o dataset atual). As novas colunas Excel e a ordenação **não** aumentam o número de requisições nem o `PAGE_SIZE`.

---

## Tasks / Subtasks

- [ ] **Toggle Kanban↔Lista por tema** (AC: 1) — no contexto do tema (`pipeline.tsx`) adicionar entrada para Lista filtrada pelo tema, ou parametrizar `casos.lista.tsx` por `?tema=`/`?frente=`.
- [ ] **Filtro de frente** (AC: 2) — controle compartilhado; no Kanban, colunas condicionais ocultam-se por frente vazia.
- [ ] **Lista Excel** (AC: 3) — colunas adicionais + ordenação por coluna (client-side) + busca combinada; reuso de labels de tema/frente.
- [ ] **RBAC/gate $** (AC: 4) — coluna valor sob `permissaoEfetiva(...,'financeiro','view')` (cruzamento R1/R3) ou gate atual até R3 entrar.
- [ ] **Testes** (AC: 1-4) — alternância, filtro de frente, ordenação, visibilidade por papel.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/pipeline.tsx`, `sistema-hv/src/routes/casos.lista.tsx`.
- `sistema-hv/src/components/cases/KanbanBoard.tsx` (filtro de frente se necessário).
- hooks `useCases`/`usePipeline`.

**Regras de ouro:**
- Sem migration — só apresentação. Não tocar `system_cases_active`.
- Visibilidade e gate de $ **não** podem regredir — reusar `getVisibleCaseIds`; valor sob gate financeiro (R1/R3).
- Reaproveitar `KanbanBoard`/labels existentes (não duplicar).

**Riscos de regressão:**
- **Vazar $ para não-financeiro:** adicionar coluna valor sem gate. Mitigação: renderizar sob permissão.
- **Kanban esconder casos** ao aplicar filtro de frente de forma estrita. Mitigação: filtro de frente oculta colunas condicionais vazias, nunca cards de outras frentes do tema sem filtro ativo.
- **Ordenação client-side** sobre página parcial dá impressão errada. Mitigação: ordenar o conjunto filtrado completo antes de paginar (como a busca atual `:36-55`).

## Testing

- Alternar Kanban↔Lista no tema FIES/1% preserva tema e frente.
- Filtro frente ESF: Kanban some coluna `DGM_ENVIADA` vazia; Lista mostra só casos ESF.
- Ordenar Lista por "criado em"/"cliente" funciona sobre todo o filtrado.
- Advogado vê só seus casos; coluna valor oculta sem permissão financeira.
- `npm run typecheck` / `npm run lint` verdes.

## Dependências

- **Depende de:** R2-05 (Kanban/lista já reapontados por tema+frente). Pode ser **fundida** com R2-05 se o time preferir.
- **Cruzamento com R1 (desacoplar financeiro / gate $) e R3 (permissão efetiva):** a coluna valor e a visibilidade dependem desses gates. Coordenar.
- **BLOQUEADA parcialmente por PENDÊNCIA DO CLIENTE:** só no conteúdo (temas/frentes reais); a mecânica funciona com o modelo provisório.

## File List

- `sistema-hv/src/routes/pipeline.tsx`
- `sistema-hv/src/routes/casos.lista.tsx`
- `sistema-hv/src/components/cases/KanbanBoard.tsx`
- `sistema-hv/src/hooks/useCases.ts`, `sistema-hv/src/hooks/usePipeline.ts`

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — N3 (Kanban + Lista Excel, filtros tema/frente) do épico R2 | @sm |
| 2026-07-18 | 0.2 | C6 (QA/Architect): cravada a fronteira de escopo com R2-05 (nova subseção) — R2-05 entrega dados+filtro de frente; R2-08 entrega toggle explícito + Lista Excel; opção de fundir registrada. Sem dupla-implementação. C9 (QA): AC-6 de performance quantificado — manter `PAGE_SIZE=50` e tempo ≤ atual, sem aumentar requisições. | @sm |
