# Story R5-07: A3 — Termo de acerto com 15% e R$500 editáveis + puxar do contrato/caso

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-07
- **Status:** Draft
- **Estimativa relativa:** S/M (expor campos editáveis + pré-preencher do caso) — **cruza com R4**
- **Executor sugerido:** @dev · Quality gate: @qa
- **Item do documento-mestre:** §8 **A3** — "15%/R$500 editáveis · `TERMO_DEFAULTS` + `system_case_honorarios`"; §5.3

---

## Story

**Como** advogado elaborando o Termo de Acerto,
**quero** editar o percentual de honorários (hoje fixo em 15%) e o valor da parcela (hoje fixo em R$500) — e que eles venham pré-preenchidos do contrato/caso,
**para que** o termo reflita o acordo real de cada cliente, não só o padrão.

---

## Contexto / o que JÁ EXISTE vs NOVO (arquivo:linha)

- **JÁ EXISTE (cálculo já aceita override):** `calcularTermo(input)` já lê `input.percentual`, `input.valorParcelaCentavos`, `input.descontoAvistaPct` opcionais, caindo em `TERMO_DEFAULTS` (15% / R$500 / 10%) quando ausentes — `sistema-hv/src/lib/termo-service.ts:58-97`. O motor **já suporta** valores editáveis; o problema é a **UI não os expõe**.
- **JÁ EXISTE (defaults):** `TERMO_DEFAULTS = { percentual_honorarios: 15, valor_parcela_centavos: 50000, desconto_avista_pct: 10, ... }` — `termo-service.ts:18-23`.
- **JÁ EXISTE (fonte do contrato/caso):** `getHonorariosForCase(caseId)` lê `system_case_honorarios_active` (`percentual_honorarios`, `valor_parcela_centavos`, `desconto_avista_pct`, `honorarios_total_centavos`) — `termo-service.ts:114-125`. Persistido na revisão da procuração (memória `project_sprint_s7`/S7-01).
- **ROOT CAUSE (limitação):** a dialog "Elaborar Termo de Acerto" (`sistema-hv/src/components/cases/TermoPanel.tsx:649-689`) só coleta saldos; a descrição diz textualmente "O cálculo usa 15% / R$500 / 10% (padrão PRD)" (`:656`) e **não passa** `percentual`/`valorParcela`/`descontoAvista` — por isso sempre cai no default.
- **NOVO:** campos editáveis de **% honorários** e **valor da parcela** (e opcionalmente desconto à vista) na dialog, **pré-preenchidos** por `getHonorariosForCase` (contrato/caso), passando os valores para o cálculo/criação do snapshot.

> **DECISÃO TRAVADA:** manter `TERMO_DEFAULTS` como **fallback** (quando o caso não tem honorários registrados). Pré-preencher da fonte do caso (`system_case_honorarios`) e permitir edição pontual. Preservar a imutabilidade do termo pós-aprovação (trigger).

---

## ⚠️ Cruzamento com R4 (financeiro) — obrigatório documentar

- R4 desacopla o financeiro (gates de $, painel do cliente). Esta story mexe no **fluxo de honorários/termo**, que é financeiro.
- **Regra de não-conflito:** não alterar as regras de bifurcação/entrada no financeiro (S19) nem a imutabilidade do termo. Apenas expor edição + pré-preenchimento. Quando R4 aplicar gates de $, a dialog do termo deve respeitar `financeiro:view/edit` (a story de R4 cobre o gate; aqui garantir que os campos ficam dentro de tela já gated). **A3 ↔ R4** + usa `system_case_honorarios`.

---

## Acceptance Criteria

1. A dialog "Elaborar Termo de Acerto" mostra campos **editáveis** de % de honorários e valor da parcela (e opcionalmente desconto à vista).
2. Esses campos vêm **pré-preenchidos** de `getHonorariosForCase(caseId)` quando o caso tem honorários registrados; senão caem em `TERMO_DEFAULTS`.
3. Os valores editados são passados ao `calcularTermo` e persistidos no snapshot do termo (`percentual_honorarios`, `valor_parcela_centavos`, `desconto_avista_pct`).
4. O documento gerado reflete os valores editados (placeholders `percentual_*`, parcela).
5. Imutabilidade pós-aprovação preservada; `TERMO_DEFAULTS` continua como fallback.

---

## Tasks / Subtasks

- [ ] **UI** — em `TermoPanel.tsx` (dialog Elaborar): adicionar inputs de % honorários e valor da parcela (e desconto à vista), com máscara adequada; remover/ajustar o texto "usa 15%/R$500/10%".
- [ ] **Pré-preenchimento** — ao abrir a dialog, buscar `getHonorariosForCase(caseId)` e semear os campos; fallback `TERMO_DEFAULTS`.
- [ ] **Fiação** — passar `percentual`/`valorParcelaCentavos`/`descontoAvistaPct` ao caminho de "Calcular e revisar"/criação do snapshot (o serviço já aceita).
- [ ] **Testes** (AC 1-5) — editar % e parcela → snapshot e documento refletem; caso com honorários pré-preenche; caso sem → default; termo aprovado imutável. `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/components/cases/TermoPanel.tsx` (dialog + pré-preenchimento).
- `sistema-hv/src/lib/termo-service.ts` (`getHonorariosForCase` já existe; `calcularTermo`/criação já aceitam overrides — só fiar).
- RPC/hook do termo (passar os campos).

**Regras de ouro pertinentes:**
- **Provavelmente sem migration** (colunas do snapshot já persistem % / parcela / desconto). Se precisar, `npx tsx scripts/db-apply-pg.ts` + rollback.
- Preservar imutabilidade pós-aprovação (trigger) e `TERMO_DEFAULTS` como fallback.
- Respeitar futuros gates de R4 (tela de $).

### Testing
- Caso com `system_case_honorarios` (ex.: 20% / R$700) → dialog abre pré-preenchida com esses valores.
- Editar para 12% → snapshot e doc mostram 12%.
- Caso sem honorários → 15% / R$500 default.

---

## Dependências

- **Depende de:** S7-01 (persistência de honorários da procuração em `system_case_honorarios`) — já existe.
- **Cruzamentos:** **A3 ↔ R4** (financeiro; respeitar gates de $) e usa `system_case_honorarios`.
- **Habilita:** termos fiéis ao acordo por cliente.

---

## File List

- `sistema-hv/src/components/cases/TermoPanel.tsx`
- `sistema-hv/src/lib/termo-service.ts` (fiação/leitura — já existe)
- RPC/hook do termo

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — A3 15%/R$500 editáveis (cruza R4) | @sm |
