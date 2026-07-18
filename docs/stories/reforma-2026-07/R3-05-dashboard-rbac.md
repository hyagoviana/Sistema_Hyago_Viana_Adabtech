# Story R3-05: Dashboard "de hoje" respeitando 3 níveis (admin/área/pessoa)

- **Épico:** R3 — Permissões por módulo (M5/N2 — dashboard RBAC; parte de B7 alto nível)
- **ID:** R3-05
- **Status:** Draft
- **Estimativa relativa:** M (aplicar escopo por permissão efetiva aos números do dashboard; hoje o `getDashboardAdmin` retorna totais globais só com `requireAuth`)
- **Executor sugerido:** @dev · Quality gate: @architect + @qa
- **Ordem:** depois de R3-01 (e idealmente R3-03, para reusar `requireModule`).

---

## Story

**Como** usuário do sistema,
**quero** que o dashboard "de hoje" mostre números conforme meu nível — **admin vê os totais**, **áreas veem o do seu módulo**, **pessoa vê o seu** —,
**para que** ninguém veja indicadores (inclusive de `$`) fora do seu escopo.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (verificado)
- RPC `getDashboardAdminFn` (`src/rpc/admin-dashboard.ts:22-24`) → `getDashboardAdmin()` em `src/lib/admin-dashboard-service.ts`. **Guard: só `requireAuth()`** (`admin-dashboard.ts:9`) — qualquer autenticado obtém **totais globais** hoje. ← ponto a fechar.
- Rota `/hoje` (visível a todos) e `/dashboards`.
- Visibilidade de casos por usuário: `getVisibleCaseIds(userId)` em `src/lib/visibility.ts:12-70` (null = vê tudo; array = escopo próprio) — **base para o nível "pessoa"**.
- `seesOnlyOwnCases` (`rbac.ts:97-107`).

### NOVO
- Três níveis de agregação no dashboard, resolvidos por permissão efetiva + visibilidade:
  - **admin** (`sistema:edit` ou papel admin) → totais globais (comportamento atual).
  - **área** (papel/override de módulo, ex.: `financeiro`, `comercial`, `operacional`, `controladoria`) → números **do seu módulo**.
  - **pessoa** (advogado/prestador `seesOnlyOwnCases`) → números **dos seus casos** (via `getVisibleCaseIds`).
- Regra transversal **P3**: cartões de `$` só para quem tem `financeiro:view`.

> **DECISÃO TRAVADA (doc-mestre M5/N2):** dashboard respeita os 3 níveis; áreas veem o seu; pessoa vê o seu. Dados de valor exigem `financeiro:view`. Aditivo — não quebrar o dashboard admin atual.

---

## Acceptance Criteria

1. `getDashboardAdmin` (e/ou uma nova função `getDashboardScoped(userId)`) passa a **escopar** os números pelo nível do usuário:
   - admin ⇒ totais globais (igual a hoje).
   - área ⇒ agrega só o módulo do usuário (ex.: financeiro vê métricas financeiras; comercial vê funil comercial).
   - pessoa (`seesOnlyOwnCases`) ⇒ agrega só `getVisibleCaseIds(userId)`.
2. **Cartões de `$` (valores) só aparecem/são calculados** se `permissaoEfetiva(user,'financeiro','view')` — caso contrário são omitidos (P3). (Cruza com R4.)
3. Guard do RPC reforçado: em vez de só `requireAuth`, resolve o **escopo** a partir do usuário logado (não confiar em parâmetro do cliente para escopo).
4. **Regressão para admin:** um admin continua vendo exatamente os mesmos totais de hoje.
5. Nível "pessoa" não vaza casos fora de `getVisibleCaseIds` (reusa a visibilidade existente — mesma fonte do dossiê/tarefas).

---

## Tasks / Subtasks

- [ ] **Serviço** — `getDashboardScoped(userId)` em `admin-dashboard-service.ts` que resolve nível (admin/área/pessoa) via papel + overrides + `getVisibleCaseIds`; admin mantém o cálculo atual (AC: 1,4,5).
- [ ] **Gate de `$`** — omitir/anular cartões de valor quando `!permissaoEfetiva(user,'financeiro','view')` (AC: 2).
- [ ] **RPC** — `admin-dashboard.ts` resolve o `userId` de `requireAuth()` e chama `getDashboardScoped(user.id)`; não aceitar escopo por parâmetro do cliente (AC: 3). Opcional: usar `requireModule('inteligencia','view')` para acesso ao painel geral e degradar para o escopo pessoal quando não houver.
- [ ] **Front** (`/hoje` / `/dashboards`) — não renderizar cartões vazios/`$` para quem não tem `financeiro:view` (usa `useCan('financeiro','view')` de R3-02).
- [ ] **Testes** (AC: 1-5) — admin (totais == atual); financeiro (só métricas fin, com `$`); advogado (só seus casos, sem `$` se não tiver override); comercial (funil próprio). `npx tsc --noEmit` + `npm run lint` verdes.

---

## Dev Notes

**Estratégia de fallback:** o nível deriva de `permissaoEfetiva`/papel — sem override, um admin continua admin (totais), um advogado continua `seesOnlyOwnCases` (pessoal). A função de escopo pessoal **reusa `getVisibleCaseIds`** (mesma verdade da visibilidade de casos), evitando divergência entre dashboard e listas.

**P3 (cruza com R4):** o gate de `$` no dashboard usa a mesma regra que R4 aplicará às telas financeiras (`financeiro:view`). Manter a checagem **no server** (o cálculo dos valores nem deve ocorrer se o usuário não pode vê-los) e **no front** (não renderizar placeholder).

**Definição das métricas por área:** mapear cada bloco do dashboard atual a um módulo (financeiro→métricas de `$`/inadimplência; comercial→funil; operacional→casos/pipeline; controladoria→prazos/exceções). Onde a métrica não pertencer a nenhum módulo do usuário, omitir.

**Alto nível (B7):** o doc-mestre trata Inteligência como design de alto nível (IA futura). Esta story cobre **só** o dashboard "de hoje" com RBAC de 3 níveis; IA fica fora.

**Regras de ouro:** aditivo; não quebrar o dashboard admin; escopo resolvido no server.

### Testing
- Admin: números idênticos ao atual.
- Financeiro: vê `$`; advogado sem `financeiro:view`: sem `$`, só seus casos.
- Pessoa: contagem == `getVisibleCaseIds(userId)`.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** R3-01 (`permissaoEfetiva`), R3-02 (`useCan` no front). Reusa `getVisibleCaseIds` (já existe). Idealmente R3-03 (`requireModule`).
- **Relaciona-se com:** R4 (regra `financeiro:view` para `$`).

---

## Cruzamentos

- **R4/P3:** cartões de `$` no dashboard = mesmo gate `financeiro:view`.
- **R6/P7:** métricas de Controladoria por frente/tipo — só quando R6 existir.

---

## File List

- `sistema-hv/src/lib/admin-dashboard-service.ts` (`getDashboardScoped`)
- `sistema-hv/src/rpc/admin-dashboard.ts` (escopo por usuário)
- rota do dashboard (`/hoje` e/ou `/dashboards`) — gate de `$` no front

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (M5/N2 dashboard RBAC) | @sm |
