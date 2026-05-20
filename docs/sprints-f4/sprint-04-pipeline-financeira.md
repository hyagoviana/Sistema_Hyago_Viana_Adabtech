# Sprint 4 — Pipeline Financeira + Views complementares

> **Versão:** 1.0 · **Status:** Pendente
> **Estimativa:** 8 dias úteis · **Épico PRD 1:** 3 (rastro financeiro)

---

## Objetivo

Completar o **rastro financeiro** simétrico ao operacional: Pipeline Fin (15 colunas), as 8 views complementares (Aguardando Ativação, Atrasadas, Inadimplência, etc.), bifurcação automática IMPLANTADO → ELABORANDO_TERMO funcionando ponta a ponta, Ficha do Caso com rastro financeiro real ao lado do operacional. Cobrança em si (geração de parcelas via API) **não** entra aqui — fica reservada ao Sprint 9 quando a integração Conta Azul/Asaas é tratada.

---

## Stories cobertas (PRD 1 §6)

| Story PRD | Título | Estimativa |
|---|---|---|
| **3.3** | Pipeline Financeira (Kanban + 8 views) | 5d |
| **3.4** (final) | Ficha Caso — rastro financeiro lado a lado | 3d |

---

## Telas Lovable tocadas

- `casos.financeiro.tsx` — Pipeline Fin Kanban
- `casos.financeiro.inadimplencia.tsx` — uma das views (já em rota separada no Lovable; demais 7 ficam em tabs/segments dentro de `casos.financeiro.tsx`)
- `casos.$id.tsx` — bloco financeiro do dossiê
- `controladoria.excecoes.tsx` — view "Análise Pré-Decisão" (TERMO_EM_DISCORDANCIA)

---

## Entregas-chave

### Pipeline Fin (Story 3.3)
- 15 colunas (NAO_APLICAVEL → QUITADO + estados terminais)
- Mesmas funcionalidades do Pipeline Op (gates, drag-drop, filtros, densidade, realtime)
- Cards diferenciados visualmente (badge financeiro)

### 8 Views complementares (Story 3.3)
1. **Aguardando Ativação** — `TERMO_ACEITO` sem cobrança ativada
2. **Parcelas Atrasadas** — `ATIVO` + parcela vencida 1-29d
3. **Inadimplência** — `INADIMPLENTE`
4. **Pendências Judiciais** — `SUSPENSO` + hold=`AGUARDANDO_DECISAO_JUDICIAL`
5. **Readequação Parcela** — `SUSPENSO` + hold=`PENDENTE_READEQUACAO_PARCELA`
6. **Cliente Inerte** — `APRESENTANDO_TERMO` >15d sem aceite
7. **Cobrança Judicial** — `COBRANCA_JUDICIAL`
8. **Tramitação Judicial** — `JUDICIAL_FINANCEIRO`
9. **Análise Pré-Decisão** — `TERMO_EM_DISCORDANCIA` (vai em `controladoria.excecoes.tsx`)

Cada view é uma materialized view ou view do Postgres; refresh on-demand para Inadimplência (rápida) e nightly para as derivadas (Aguardando Ativação, Cliente Inerte).

### Bifurcação automática validada ponta a ponta
- Trigger `trg_bifurcar` (criado no Sprint 1) testado com Playwright: mover caso para IMPLANTADO via UI → após 1s o rastro fin aparece em ELABORANDO_TERMO + evento `BIFURCACAO_AUTOMATICA` no timeline

### Ficha Caso (Story 3.4 final)
- Bloco financeiro com macrostatus, dias-em-estado, SLA, responsável fin, histórico
- Aba Financeiro lista snapshots de Termo (read-only até Sprint 8) + parcelas (read-only até Sprint 9)
- Cálculo de "próxima ação" via SQL function `next_action_financeiro(case_id)`

---

## Riscos principais

| # | Risco | Mitigação |
|---|---|---|
| **S4-R1** | Materialized views ficam stale | `pg_cron` refresh nightly; Inadimplência refresh on-demand antes de abrir view |
| **S4-R2** | 15 colunas no Kanban estouram horizontal | Scroll horizontal + densidade compacto; permitir ocultar colunas no localStorage |
| **S4-R3** | Bifurcação dispara loop (op → fin → op) | CHECK no trigger: só dispara WHEN `OLD.macrostatus_op IS DISTINCT FROM NEW` e novo é IMPLANTADO |
| **S4-R4** | View "Cliente Inerte" precisa rodar a cada navegação | Cache 5min + invalidação ao mudar caso |

---

## Definition of Done (além do global)

- [ ] 2 stories com ACs cumpridos
- [ ] Smoke E2E: bifurcação automática observada via UI
- [ ] 8 views cobertas por teste (cada uma com pelo menos 1 caso fixture na seed de teste)
- [ ] Performance: Pipeline Fin 15 colunas com 2500 casos < 600ms p95

---

## Próximo sprint

[**Sprint 5 — Documentos + Geradores**](./sprint-05-documentos.md)

---

> _— @pm John, sob coordenação do Orion 🎯_
