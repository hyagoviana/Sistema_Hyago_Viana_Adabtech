# Story R8-01: Relatório de Inadimplência no Financeiro (filtro >90 dias)

- **Épico:** R8 — Inadimplência (E8, bloco B8)
- **ID:** R8-01
- **Status:** Draft — DESIGN (spec do relatório; codar após B4 + fonte de dados)
- **Estimativa relativa:** M (spec do relatório + fonte de débito + gate de $)
- **Executor sugerido:** @architect + @dev · Quality gate: @qa
- **Natureza:** ALTO NÍVEL / DESIGN. Entregável = **spec do relatório aprovada**.

---

## 🔴 PRÉ-REQUISITOS BLOQUEANTES

- **Fonte de dados de débito** — **API ProIuris/Conta Azul** para valores em aberto/vencidos (§9.4). Sem isso o >90 dias não tem base confiável. *(bloqueante)*
- **B4 (desacoplar Financeiro)** — gate `financeiro:view` disponível; relatório de $ **não** pode renderizar sem ele (§3.6/§5.3).
- **Definição do cliente:** régua de inadimplência (>90 dias a partir de quê? vencimento da parcela?), colunas desejadas.

---

## Story

**Como** admin/financeiro,
**quero** um relatório de inadimplência no módulo Financeiro que liste devedores com débito **>90 dias**, com valores e antiguidade,
**para que** a cobrança e a controladoria priorizem quem está mais atrasado — visível apenas a quem tem `financeiro:view`.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE:** `src/routes/casos.financeiro.inadimplencia.tsx` — lista casos com `macrostatus_fin='INADIMPLENTE'`, soma `valor_centavos`, usa `useCasesList({ macrostatus_fin: 'INADIMPLENTE' })`. **Base a evoluir** (hoje é binário, sem régua de dias nem antiguidade real).
- **JÁ EXISTE:** `system_parcelas` (com `provider`/`provider_ext_id`, vencimentos) + sync Conta Azul cron 08:30 — fonte de datas de vencimento para calcular ">90 dias".
- **JÁ EXISTE:** `relatorio-financeiro.tsx`, `dashboards.financeiro.tsx` — padrões de relatório (hoje sem gate de $, a corrigir em B4).
- **NOVO:** cálculo de **aging** (>90 dias) a partir de `system_parcelas`/fonte externa, colunas de antiguidade, e o gate de $.

> **DECISÃO A TRAVAR:** ">90 dias" calculado sobre **vencimento da parcela** (`system_parcelas`) e/ou dado externo (ProIuris/Conta Azul); a régua exata vem do cliente (bloqueante).

---

## Acceptance Criteria (de DESIGN)

1. **Spec do relatório aprovada** em `docs/reforma-2026-07/spec-inadimplencia.md`: fonte de dados (parcelas vs externo), fórmula de aging (>90 dias), colunas (cliente, caso, valor em aberto, dias de atraso, faixa de antiguidade).
2. **Régua definida:** a partir de qual data conta o atraso e faixas (ex.: 30/60/90/90+), aprovadas pelo cliente.
3. **Gate de $ herdado de B4:** relatório só renderiza com `financeiro:view` (§4.4); documentado.
4. **Reaproveitamento definido:** evolui `casos.financeiro.inadimplencia.tsx` (não cria rota paralela) e reusa padrões de `relatorio-financeiro`.
5. **Ligação com R8-02 definida:** como este relatório alimenta/gera o tema de atuação "Inadimplentes" (R8-02).
6. **Sem produção:** entregável é a spec; implementação após B4 + fonte de dados.

---

## Tasks / Subtasks

- [ ] **Design — fonte de dados** (AC:1) — `system_parcelas` (vencimentos) vs ProIuris/Conta Azul; decidir e documentar. *(bloqueado por API externa)*
- [ ] **Design — aging** (AC:1,2) — fórmula >90 dias e faixas; casos de borda (parcelas parciais, provider divergente).
- [ ] **Design — colunas/UI** (AC:1,4) — evoluir `casos.financeiro.inadimplencia.tsx` com dias de atraso e faixas; filtro >90.
- [ ] **Design — gate de $** (AC:3) — amarrar a B4 (`financeiro:view`).
- [ ] **Design — ponte com tema Inadimplentes** (AC:5) — cruza R8-02.
- [ ] **Escrever** `docs/reforma-2026-07/spec-inadimplencia.md` (seção relatório).

---

## Dev Notes

**Regras de ouro:**
- Relatório de $ **exige `financeiro:view`** (§4.4) — herda B4; hoje as telas de $ vazam para qualquer autenticado (§5.3), não repetir o erro.
- Evoluir a rota existente; **não** criar navegação paralela.
- Cálculo de aging não deve escrever em `case_type`/`macrostatus_*`.

### Testing (de design)
- Régua >90 dias validada contra dados de parcelas de exemplo.
- Papel operacional NÃO vê o relatório (sem `financeiro:view`).
- QA aprova as faixas de antiguidade.

---

## Cruzamentos

- **R8↔R4/B4:** gate de $ + fonte financeira (parcelas/Conta Azul).
- **R8↔R6-01:** pode reusar a integração ProIuris (dados de débito judicial).
- **R8↔R8-02:** relatório alimenta o tema de atuação "Inadimplentes".

---

## Dependências

- **Bloqueada por:** API ProIuris/Conta Azul; B4 (gate de $); régua do cliente.
- **Habilita:** priorização de cobrança; R8-02 (tema Inadimplentes).

## File List

- `docs/reforma-2026-07/spec-inadimplencia.md` (novo — seção relatório, design)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft de alto nível (relatório >90 dias) — bloco B8 | @sm |
