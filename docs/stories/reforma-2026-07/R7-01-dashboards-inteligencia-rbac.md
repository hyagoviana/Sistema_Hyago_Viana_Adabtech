# Story R7-01: Dashboards de Inteligência com RBAC (admin vê totais; áreas veem o seu)

- **Épico:** R7 — Inteligência (bloco B7)
- **ID:** R7-01
- **Status:** Draft — DESIGN (spec de dashboards + gates)
- **Estimativa relativa:** M (catálogo de indicadores + regras de escopo por papel)
- **Executor sugerido:** @architect + @dev · Quality gate: @qa
- **Natureza:** ALTO NÍVEL / DESIGN. Entregável = **catálogo de dashboards + matriz de visibilidade aprovados**.

---

## 🔴 PRÉ-REQUISITOS BLOQUEANTES

- **R3 / D3 (permissão efetiva)** — `permissaoEfetiva(user,module,action)` disponível como fonte única dos gates. Sem isso, os dashboards não têm como filtrar "admin vê totais; áreas veem o seu". *(bloco B3 da fundação — precede este)*
- **Definição do cliente:** quais indicadores por área importam (comercial, operacional, financeiro, controladoria). *(pendência §9)*
- **Mockup/lista de KPIs** desejados.

---

## Story

**Como** admin ou responsável de área,
**quero** dashboards de inteligência onde **o admin vê os totais** do escritório e **cada área vê apenas o seu recorte**,
**para que** cada perfil tenha a visão certa sem vazar dados de outras áreas (especialmente valores $, que exigem `financeiro:view`).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (rotas casca):** `src/routes/inteligencia.leads.tsx` e o grupo **Inteligência** na Sidebar (`components/hv/Sidebar.tsx`). Base de UI.
- **JÁ EXISTE (dashboards parciais):** `dashboards.financeiro.tsx`, `relatorio-financeiro.tsx` — **renderizados hoje SEM gate de $** (§3.6/§5.3 do doc-mestre). R7 precisa herdar o gate de B4 (desacoplar financeiro).
- **JÁ EXISTE (RBAC):** `src/lib/rbac.ts` (9 papéis, capabilities, `ROLE_NAV`), `visibility.ts` (escopo por caso). R7 consome, não reinventa.
- **NOVO:** catálogo de dashboards de Inteligência + a **matriz papel×dashboard×escopo** (total vs próprio) aplicada via permissão efetiva.

> **DECISÃO A TRAVAR:** escopo dos dashboards deriva de `permissaoEfetiva` (D3) + `visibility.ts` (recorte por caso/área); **nenhum dashboard de $ renderiza sem `financeiro:view`** (regra transversal §4.4).

---

## Acceptance Criteria (de DESIGN)

1. **Catálogo de dashboards aprovado** em `docs/reforma-2026-07/spec-inteligencia.md`: lista de painéis, KPIs por área (comercial/operacional/financeiro/controladoria) e fonte de dados de cada um.
2. **Matriz de visibilidade definida:** para cada dashboard, quem vê **total** (admin) vs **próprio** (área), expressa em termos de `permissaoEfetiva(module,action)` — não `role` hardcoded.
3. **Gate de $ herdado de B4:** todo painel com valores exige `financeiro:view` no mínimo; documentado que R7 não pode expor $ sem esse gate.
4. **Reaproveitamento definido:** quais indicadores reusam `dashboards.financeiro`/`relatorio-financeiro` e o que é novo em `inteligencia.*`.
5. **IA fora de escopo aqui:** o agente de IA é R7-02 (futuro); esta story é só dashboards por lógica/consulta.
6. **Sem produção:** entregável é a spec + matriz; implementação incremental depois de B3/B4.

---

## Tasks / Subtasks

- [ ] **Design — catálogo de KPIs** (AC:1) — por área; separar métricas de $ (gated) das operacionais. *(depende de lista do cliente)*
- [ ] **Design — matriz papel×dashboard×escopo** (AC:2) — total vs próprio, via `permissaoEfetiva`.
- [ ] **Design — herança do gate de $** (AC:3) — amarrar a B4 (`financeiro:view`).
- [ ] **Design — mapa de reuso** (AC:4) — o que vem de `dashboards.financeiro`/`relatorio-financeiro`; o que é novo em `inteligencia.*` + grupo Inteligência da Sidebar.
- [ ] **Escrever** `docs/reforma-2026-07/spec-inteligencia.md` e submeter a @architect/@qa.

---

## Dev Notes

**Regras de ouro:**
- Escopo por **permissão efetiva** (D3) + `visibility.ts` — nunca `role` hardcoded nos dashboards.
- **Nenhum valor $ sem `financeiro:view`** (§4.4) — herda B4.
- Reusar rotas/grupo Inteligência existentes; não criar navegação paralela.

### Testing (de design)
- Matriz cobre todos os 9 papéis: cada um vê exatamente o escopo definido.
- Cenário: papel operacional NÃO vê valores $ em nenhum dashboard.
- QA valida que admin vê totais e área vê próprio.

---

## Cruzamentos

- **R7↔R3 (D3):** escopo total/próprio via permissão efetiva.
- **R7↔R4/B4:** gate de $ nos painéis financeiros.
- **R7↔R6:** painéis de controladoria (atrasos/distribuição) consomem dados de R6-03/04.

---

## Dependências

- **Bloqueada por:** B3 (permissão efetiva), B4 (gate de $), lista de KPIs do cliente.
- **Habilita:** R7-02 (IA sobre os mesmos dados/painéis).

## File List

- `docs/reforma-2026-07/spec-inteligencia.md` (novo — design)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft de alto nível (dashboards RBAC) — bloco B7 | @sm |
