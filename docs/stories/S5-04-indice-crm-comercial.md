# Story S5-04: Índice CRM `/comercial` (resumo dos leads) + validação da jornada comercial ponta a ponta

- **Sprint:** 5 — Módulo Comercial/Leads (pipeline + lista)
- **ID:** S5-04
- **Status:** Draft
- **Estimativa relativa:** M (índice `/comercial` com números reais + roteiro de validação E2E da jornada lead→CLIENTE)
- **Executor sugerido:** @dev (front) + @qa (validação E2E) · Quality gate: @architect
- **Escopo:** OPCIONAL/consolidação — só faz sentido depois de S5-01/02/03. Pode ser cortada se o owner priorizar só pipeline+lista.
- **Status:** Ready for Review (índice `/comercial` real entregue; validação E2E pendente com @qa)

---

## Story

**Como** dono do escritório,
**quero** que **Inteligência → Comercial** (`/comercial`) mostre um **resumo real do funil de leads** (contagens por etapa e por tipo, atalho para o pipeline) em vez do stub fixo, e que a jornada comercial (lead entra → move nas etapas → assina procuração → vira CLIENTE e sai da pipeline) esteja **validada ponta a ponta**,
**para que** o CRM comercial tenha uma porta de entrada com panorama e a virada lead→cliente esteja comprovadamente funcionando.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (stub-alvo):** `sistema-hv/src/routes/comercial.index.tsx` (`:4-13`) é `StubPage` "Comercial · CRM" com números **fixos** ("47 leads ativos · 32% conversão · LTV médio R$ 38K").
- **JÁ EXISTE (fonte de leads):** `useLeadsPipeline()`/`listLeadsPipeline` (S5-02) e `useLeadsByServiceType` (por tipo); `useStages(..., "comercial")` para os labels de etapa.
- **JÁ EXISTE (virada lead→CLIENTE):** `liberarCasoComercial` (webhook ZapSign / manual) e `promoverCasoManual` (S1-03) setam `lifecycle='CLIENTE'`; a S5-02 acrescentou o carimbo `macrostatus_comercial='GANHO'` e a saída do Kanban.
- **JÁ EXISTE (assinatura):** aba `/comercial/assinaturas` (menu Inteligência, `Sidebar.tsx:64`) lista casos `aguardando_assinatura_at`.
- **NOVO:** `/comercial` com contagens reais (por etapa comercial e por tipo) + atalhos ("Ver pipeline de leads" → `/comercial/leads`, "Assinaturas" → `/comercial/assinaturas`); roteiro de validação E2E da jornada.

> **Parametrizável / aguardando owner:** as métricas exibidas (conversão, LTV, ticket médio) são **placeholders** enquanto o owner não define a fórmula real. Nesta story exibimos só o que é **derivável do dado existente** (nº de leads por etapa/tipo, nº aguardando assinatura, nº ganhos/perdidos recentes). Conversão/LTV ficam **fora** ou como "em breve" até o owner definir.

---

## Acceptance Criteria

1. `/comercial` **deixa de ser stub**: mostra contagens **reais** de leads por etapa comercial (e/ou por tipo de serviço), lidas de `useLeadsPipeline`/`useStages("comercial")`, com estados loading/erro/vazio.
2. A página tem **atalhos** para `/comercial/leads` (pipeline) e `/comercial/assinaturas` (assinaturas pendentes), e mostra o nº de casos `aguardando_assinatura_at` (reusa a contagem já feita no `Sidebar.tsx:150-153`).
3. Métricas ainda **não definidas** pelo owner (conversão/LTV) **não** aparecem com valores inventados — ou são omitidas, ou marcadas "em breve".
4. **Breadcrumb/título por nome** (padrão S4-06): `Comercial` / título coerente; nunca UUID.
5. **Validação E2E (jornada comercial)** documentada e executada por @qa: criar caso-lead → aparece no Kanban comercial (`NOVO`) → mover pelas etapas (persiste) → enviar/assinar procuração → caso vira CLIENTE e **sai** da pipeline de leads → aparece em Clientes; caminho alternativo: marcar PERDIDO → sai para PERDIDO. Sem regressão nos Kanbans op/fin.

---

## Tasks / Subtasks

- [x] **Índice `/comercial` real** (AC: 1,2,3) — `StubPage` → painel com:
  - [x] Cards de contagem por etapa comercial (agrupa `useLeadsPipeline` por `macrostatus_comercial`, rótulos via mapa das etapas default + fallback slug, ordenados).
  - [x] Breakdown por tipo de serviço (`case_type` → `CASE_TYPE_LABELS`).
  - [x] Atalhos para `/comercial/leads` e `/comercial/assinaturas` + nº aguardando assinatura (mesma regra do Sidebar).
  - [x] Estados loading/erro/vazio; sem métricas inventadas (conversão/LTV omitidas).
- [x] **Breadcrumb + título** (AC: 4) — `Comercial` + `useDocumentTitle("Comercial")`.
- [ ] **Roteiro de validação E2E** (AC: 5) — **PENDENTE @qa**: executar a jornada lead→CLIENTE (manual via `promoverCasoManual` já que sandbox ZapSign não dispara e-mail) e lead→PERDIDO; confirmar saída do Kanban e ausência de regressão op/fin.
- [x] **Testes** — `npx tsc --noEmit` só com os 3 erros pré-existentes; lint dos arquivos novos verde.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/comercial.index.tsx` (StubPage → resumo real).
- Reusos: `useLeadsPipeline`/`useStages` (S5-02), contagem `aguardando_assinatura_at` (molde `Sidebar.tsx:150-153`), `useDocumentTitle` (S4-06), primitives (`PageHeader`/`Breadcrumb`/`Btn`).

**REGRAS DE OURO (pertinentes):**
- **Sem migration** (100% front, consome RPCs S5-02) — não toca `system_cases`/`system_cases_active`/`trg_system_cases_bifurcacao`.
- Não inventar métricas (conversão/LTV) — só derivar do dado real; o resto é "em breve".
- Não alterar a árvore de rotas (arquivo `comercial.index.tsx` já existe) — baixo risco de rebuild do `routeTree.gen.ts` (OneDrive).

**Riscos de regressão:**
- Contagens de `/comercial` e badges do `Sidebar` devem usar a MESMA fonte para não divergir (leads = `lifecycle='LEAD'`; aguardando = `aguardando_assinatura_at`).
- A validação E2E precisa de ZapSign — em sandbox o e-mail não dispara (ver `project_procuracao_revisao_envio`); usar a **liberação manual** (`promoverCasoManual`) como caminho de teste da virada lead→CLIENTE quando o webhook não estiver ativo.

### Testing
- Abrir `/comercial` → números batem com o Kanban de leads; atalhos navegam.
- Nenhuma métrica com valor fixo/inventado.
- Jornada E2E: lead criado → Kanban → mover → virar CLIENTE (manual ou webhook) → some da pipeline, entra em Clientes; PERDIDO → coluna Perdido.
- Kanbans op/fin inalterados.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** S5-01, S5-02, S5-03 (pipeline+lista funcionando). Reusa S1-03 (`promoverCasoManual`/`marcarCasoPerdido`), S4-06 (título).
- **Habilita:** fechamento do módulo Comercial/Leads; base para métricas de conversão quando o owner definir as fórmulas.

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **índice CRM com números reais** + **validação E2E da jornada comercial** (lead→CLIENTE / lead→PERDIDO) sem regressão op/fin.

---

## File List

- `sistema-hv/src/routes/comercial.index.tsx` (StubPage → resumo real dos leads)

## Dev Agent Record (@dev)

- Métricas exibidas: contagem por etapa comercial + por tipo de serviço + nº aguardando assinatura. Conversão/LTV/ticket NÃO exibidos (sem fórmula do owner) — nada inventado.
- Contagem por etapa usa a MESMA fonte do Kanban/lista (`useLeadsPipeline`, `lifecycle='LEAD'`) e o nº aguardando assinatura usa `aguardando_assinatura_at` (igual ao Sidebar) — não divergem.
- **Validação E2E (AC 5) fica para @qa** — requer criar lead, mover etapas, promover manual/assinar, e conferir saída do Kanban + Clientes sem regressão op/fin.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial — índice CRM `/comercial` + validação E2E da jornada comercial (Sprint 5, opcional/consolidação) | @sm |
