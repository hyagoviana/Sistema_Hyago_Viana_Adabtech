# Story S9-08: UI — Comercial (Kanban promovido a "Comercial"; rótulo GANHO="Procuração assinada")

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-08
- **Status:** Ready for Review
- **Estimativa relativa:** P/M (rótulos + renome do Kanban de Leads → "Comercial"; sem lógica nova de dados)
- **Executor sugerido:** @dev (UI) · Quality gate: @ux-design-expert

---

## Story

**Como** operador do comercial,
**quero** que o Kanban de leads seja apresentado como **"Comercial"** e que a etapa terminal comercial (GANHO) apareça como **"Procuração assinada"**,
**para que** a linguagem da tela reflita o modelo novo (a pipeline comercial termina na procuração assinada, e o caso segue LEAD até o contrato).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (Kanban de leads):** `src/routes/comercial.leads.tsx` — seleção de tipo → `LeadsKanban` com `useStages(serviceType.id, "comercial")` (`:108`), `useLeadsByServiceType`, `useMoveCaseStageComercial`, `StageEditor kind="comercial"` (`:196`), colunas por `stage.slug`/`stage.label` com `roleColor` (won/lost/…). Breadcrumb/título "Comercial › Leads".
- **JÁ EXISTE (esteira comercial + rótulos editáveis):** as etapas comerciais são parametrizáveis (S5/S6 `StageEditor`); o `label` da etapa GANHO já é editável no editor de funil.
- **NOVO:** (a) apresentar o módulo como **"Comercial"** (breadcrumb/título/eyebrow) em vez de "Leads" quando for o Kanban da pipeline (a lista/roster de leads vira a S9-07); (b) o **rótulo** da etapa terminal `won` (GANHO) exibido como **"Procuração assinada"** — via `label` da etapa no seed/editor **ou** um mapeamento de exibição, sem quebrar o `slug='GANHO'` (que os gatilhos usam).

> **DECISÃO (recomendada):** o `slug` da etapa terminal comercial **permanece `GANHO`** (os gatilhos S9-03 gravam `macrostatus_comercial='GANHO'`). O que muda é o **`label`** exibido. Preferir **atualizar o `label` no seed/editor** (dado, não código) para "Procuração assinada"; se o owner quiser travar visualmente, adicionar um fallback de exibição na UI. **NÃO** renomear o `slug` (quebraria os gatilhos e o histórico).

---

## Acceptance Criteria

1. O Kanban comercial é apresentado como **"Comercial"** (eyebrow/título/breadcrumb) — a palavra "Leads" deixa de rotular a pipeline (a lista de leads é o roster da S9-07). Navegação/menu coerentes.
2. A coluna terminal `stage_role='won'` (slug `GANHO`) exibe o rótulo **"Procuração assinada"** — preferencialmente via `label` da etapa (seed/editor), sem alterar o `slug`. Os cards, DnD e `moveCaseToStageComercial` seguem funcionando.
3. Nenhuma mudança em `slug`/`macrostatus_comercial` gravado (gatilhos intactos). Mover para "Procuração assinada" manualmente continua gravando `GANHO` (comportamento existente; NÃO dispara promoção a CLIENTE — isso é só do contrato).
4. `StageEditor kind="comercial"` continua permitindo editar rótulos/ordem (o owner pode ajustar "Procuração assinada" e demais).
5. Sem migration; só UI/labels (e, se via seed, um `UPDATE` de `label` idempotente pode entrar como dado — decidir com @data-engineer se vira migration de seed).
6. `npm run typecheck` / `npm run lint` verdes (só os 3 erros pré-existentes de `service_type_id`). Rotas resolvem.

---

## Tasks / Subtasks

- [x] **Renomear apresentação → "Comercial"** (AC: 1) — eyebrow/título/breadcrumb em `comercial.leads.tsx` agora "Inteligência › Comercial" (seleção de tipo) e "Inteligência › Comercial › {tipo}" (Kanban, eyebrow "Pipeline comercial"). Rota mantida em `/comercial/leads` (menu "Pipeline comercial"); item "Leads" da S9-07 é o roster. Subtítulo passa a contar "casos no comercial".
- [x] **Rótulo "Procuração assinada"** (AC: 2) — fallback de exibição na UI: `displayStageLabel()` mapeia `stage_role='won'` → "Procuração assinada" quando o label ainda é o default "Ganho"/"GANHO"; respeita label customizado no editor. Aplicado às colunas do Kanban, à lista e ao toast de mover.
- [x] **Preservar slug/gatilhos** (AC: 3) — só o rótulo EXIBIDO muda; `slug='GANHO'` e `macrostatus_comercial` intactos; `moveCaseToStageComercial` inalterado.
- [x] **(Opcional) Seed de label** (AC: 5) — NÃO aplicado; optou-se pelo fallback de exibição (sem migration/dado), respeitando labels customizados do owner. Se o owner preferir por dado, é um UPDATE idempotente futuro.
- [x] **FILTRO comercial (S9-08 escopo do PO)** — `listLeadsByServiceType` agora filtra `lifecycle='LEAD'` E (`aguardando_assinatura_at IS NOT NULL` OU `procuracao_assinada_at IS NOT NULL`): só casos que ENTRARAM no fluxo comercial (procuração enviada/assinada). Cadastros sem procuração enviada ficam só no roster de Leads.
- [x] **Testes** (AC: 6) — typecheck (3 erros pré-existentes de `service_type_id`); lint sem erros novos (CRLF ignorado); rotas resolvem. Teste funcional (DnD grava `GANHO`, segue LEAD) p/ @qa.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/comercial.leads.tsx` (rótulos/breadcrumb; possível renome de rota).
- Componente de navegação (menu "Comercial").
- (Opcional) `sistema-hv/supabase/migrations/<...>_seed_label_procuracao_assinada.sql` se a mudança de label for por dado.
- `sistema-hv/src/lib/pipeline-service.ts` (seed `createServiceType` — se o default do label da etapa `GANHO` comercial deve nascer como "Procuração assinada" em tipos novos).

**REGRAS DE OURO (pertinentes):**
- **UI/labels** — evitar migration; se houver seed de label, é dado (não recria view/trigger). **NÃO** tocar `system_cases`.
- **Não renomear `slug`** — os gatilhos S9-03/S9-05 dependem de `macrostatus_comercial='GANHO'`.
- **Gotcha TanStack** (memória): se renomear/aninhar a rota, seguir o padrão layout+index; OneDrive trava `routeTree.gen.ts` (rebuild).

**Riscos de regressão:**
- Confusão de escopo com S9-07: a **lista** de leads (roster) é da S9-07; **esta** story é o **Kanban** (pipeline comercial). Alinhar a navegação para não haver dois "Comercial/Leads" conflitantes.
- Se o label vier por seed, cuidar para não sobrescrever um label que o owner já customizou (idempotência conservadora / só onde ainda for o default).

### Testing
- Abrir o Kanban comercial → título/breadcrumb "Comercial"; coluna terminal "Procuração assinada".
- Arrastar um card até "Procuração assinada" → grava `GANHO`, caso **segue LEAD** (não vira CLIENTE).
- Editor de funil comercial → consegue renomear/reordenar as etapas.

---

## Dependências

- **Depende de:** S5/S6 (Kanban comercial + StageEditor — JÁ EXISTEM). Coerente com S9-03 (GANHO = procuração assinada). Alinhar navegação com S9-07.
- **Habilita:** linguagem da tela coerente com o modelo. Independe de S9-01..06 no código.

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **apresentação "Comercial" + rótulo "Procuração assinada"** sem alterar `slug`/gatilhos. Complementa a matriz do Kanban (S5-03).

---

## File List

- `sistema-hv/src/routes/comercial.leads.tsx` (apresentação "Comercial"; rótulo `won` → "Procuração assinada")
- `sistema-hv/src/lib/pipeline-service.ts` (`listLeadsByServiceType` — filtro de entrada no comercial)
- `sistema-hv/src/components/hv/Sidebar.tsx` (menu "Pipeline comercial")

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft inicial — UI Comercial (Kanban promovido a "Comercial"; rótulo "Procuração assinada") (Sprint 9) | @sm |
| 2026-07-03 | 1.0 | Implementada. Apresentação "Comercial" (eyebrow/título/breadcrumb); `won` exibido como "Procuração assinada" (fallback de UI, slug intacto); filtro de entrada no comercial (procuração enviada/assinada) em `listLeadsByServiceType`. Sem migration. typecheck/lint ok. | @dev |
