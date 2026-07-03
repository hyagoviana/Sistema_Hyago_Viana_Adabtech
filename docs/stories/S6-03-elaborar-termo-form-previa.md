# Story S6-03: Tela "Elaborar termo" (stub → real) — form com inputs + prévia de valores + snapshot RASCUNHO

- **Sprint:** 6 — Termo de Acerto (documento editável com 2 opções) `[Frente B]`
- **ID:** S6-03
- **Status:** Ready for Review
- **Estimativa relativa:** M (front — substituir o `StubPage` por form + prévia via `calcularTermo`; reusa `useCalcTermo`/`useCreateTermo`; **provável SEM migration**; ver ⚠ do `remanescente`)
- **Executor sugerido:** @dev (front) + @data-engineer (só se o `remanescente` exigir schema) · Quality gate: @architect

---

## Story

**Como** operador do financeiro,
**quero** elaborar o Termo de Acerto numa tela com os inputs (tipo PARCIAL/COMPLEMENTAR, saldos, parcelas pagas, remanescente se complementar, defaults de % e parcela) e **ver a prévia dos valores calculados na própria tela**,
**para que** eu confira honorários total, N×parcela + última e valor à vista **antes** de gerar o documento — criando um snapshot em RASCUNHO que a S6-04 usa para gerar o doc editável.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (rota alvo — STUB):** `src/routes/casos.$id.termo.elaborar.tsx` — hoje é um `StubPage` ("Elaborar Termo · Wizard em 4 etapas"). Já tem breadcrumb/título por nome do caso (S4-06). **É o alvo desta story.**
- **JÁ EXISTE (calculadora — servidor):** `calcularTermo(input)` (`src/lib/termo-service.ts:54`) — em CENTAVOS, truncamento (floor): recebe `saldoAntesCentavos`, `saldoDepoisCentavos`, `parcelasPagasCentavos?`, `percentual?`, `valorParcelaCentavos?`, `descontoAvistaPct?`; devolve `valor_efetivo_centavos`, `valor_total_centavos`, `qtd_parcelas`, `valor_parcela_centavos`, `valor_ultima_parcela_centavos`, `valor_avista_centavos`, `percentual_honorarios`, `desconto_avista_pct`. **Defaults:** `TERMO_DEFAULTS` = honorários 15%, parcela R$500 (50000), desconto à vista 10%.
- **JÁ EXISTE (RPC + hooks):** `calcularTermoFn`/`useCalcTermo` (preview sem salvar), `createTermoFn`/`useCreateTermo(caseId)` (cria snapshot v(n+1) RASCUNHO via `createTermo`), `listTermosFn`/`useTermos`. `createTermo` aceita `formaPagamento` (PARCELADO/A_VISTA) e `tipoTermo` (PARCIAL/COMPLEMENTAR) e `elaboradoPorId`.
- **JÁ EXISTE (snapshot — schema):** `system_termo_snapshots` (`20260608000007_s17_termo.sql`) — valores em centavos, `forma_pagamento`, `tipo_termo`, `status` (RASCUNHO…), `drive_file_id`/`drive_url` (PDF), imutabilidade após aprovação por trigger. **NÃO alterar schema nesta rodada.**
- **NOVO (só front, provável):** substituir o `StubPage` por um **form**:
  - inputs: `tipo_termo` (PARCIAL | COMPLEMENTAR), `saldo antes`, `saldo depois`, `parcelas pagas`, `% honorários` (default 15), `valor parcela` (default R$500), `% desconto à vista` (default 10); e **`remanescente anterior`** (input manual, **só quando COMPLEMENTAR**);
  - **prévia na tela** via `useCalcTermo`/`calcularTermo` (debounced): mostra **honorários total**, **N × parcela + última** e **valor à vista**;
  - botão **"Salvar rascunho"** → `useCreateTermo` cria o snapshot RASCUNHO (`status='RASCUNHO'`) com `tipo_termo`/`forma_pagamento`.

> **DECISÃO DO OWNER (travada):** 2 MODELOS de termo (PARCIAL e COMPLEMENTAR), cada um com as **duas** formas de pagamento (parcelado + à vista) **no mesmo documento**, para o cliente escolher. Portanto o form calcula e mostra **ambas** as formas (parcelado E à vista) sempre — a "escolha" do cliente é no documento (S6-04), não um radio que esconde a outra opção.

> **⚠ INCONSISTÊNCIA A RESOLVER (remanescente do COMPLEMENTAR):** hoje `calcularTermo` **NÃO** recebe nem soma `remanescente_anterior`, e `system_termo_snapshots` **NÃO** tem coluna para persistir esse valor. Opções (decidir com @architect antes de codar):
> - (A) **Sem persistir no snapshot** — o `remanescente` é só um input de tela repassado como **placeholder do documento** na S6-04 (não afeta o cálculo do snapshot). Mais simples, SEM migration. **Recomendado para o incremental.**
> - (B) **Estender `calcularTermo`** para aceitar `remanescenteAnteriorCentavos` e somar ao honorário total do complementar, **e** adicionar coluna no snapshot (migration + recriar view `system_termo_snapshots_active` — que hoje é `SELECT *`, sem grants extras). Mais correto, mas encosta em schema/cálculo. **Fica em BACKLOG** salvo decisão do owner.
> Enquanto não decidido, seguir **(A)**: o `remanescente` entra como campo do form e vai para o documento (S6-04) como placeholder, sem alterar o cálculo autoritativo nem o schema.

---

## Acceptance Criteria

1. A rota `/casos/$id/termo/elaborar` deixa de ser `StubPage` e renderiza um **form** com: `tipo_termo` (PARCIAL/COMPLEMENTAR), saldo antes, saldo depois, parcelas pagas, % honorários (default 15), valor parcela (default R$500), % desconto à vista (default 10) e **remanescente anterior** (visível **só** quando COMPLEMENTAR).
2. A **prévia dos valores** aparece na tela (via `useCalcTermo`, servidor autoritativo — não recalcular no front) e atualiza ao editar os inputs: mostra **honorários total**, **N × parcela + última parcela** e **valor à vista** (as duas formas de pagamento aparecem juntas).
3. **Salvar rascunho** cria um snapshot **`status='RASCUNHO'`** via `useCreateTermo`, gravando `tipo_termo` e `forma_pagamento` (o snapshot guarda `PARCELADO` por default; a apresentação das 2 formas fica no documento da S6-04). Após salvar, a tela reflete o rascunho criado (ou navega ao preview S3-04).
4. Valores em **centavos** no cálculo/persistência; a UI aceita entrada em reais e converte (padrão do `TermoPanel`/`brl` já existente). Nenhum valor negativo passa; `saldo depois` e `parcelas pagas` reduzem o efetivo (regra floor de `calcularTermo`).
5. **`remanescente anterior`** só aparece/for exigido em COMPLEMENTAR; em PARCIAL é ignorado. Tratado conforme a opção (A) acima (input de tela → placeholder na S6-04), **sem** alterar o cálculo do snapshot — salvo decisão do owner pela opção (B).
6. **Regressão:** `system_termo_snapshots` **não** tem schema alterado (opção A); o preview de leitura (S3-04, `casos.$id.termo.tsx`) continua funcionando e passa a exibir também os rascunhos criados aqui. **SEM migration** (opção A).

---

## Tasks / Subtasks

- [x] **Form de elaboração** (AC: 1,4,5) — `StubPage` substituído por form real em `casos.$id.termo.elaborar.tsx` (helpers `brl`/`toCents` no padrão do `TermoPanel`). Inputs: tipo (PARCIAL/COMPLEMENTAR), saldo antes/depois, parcelas pagas, % honorários (15), valor parcela (R$500), % desconto (10). Campo `remanescente` condicional a `tipo === 'COMPLEMENTAR'`.
- [x] **Prévia via servidor** (AC: 2) — `useCalcTermo` disparado por `useEffect` debounced (350ms) sobre um `calcInput` memoizado; exibe efetivo, honorários total, parcelado (N×parcela + última) e à vista. Fórmula NÃO duplicada no front.
- [x] **Salvar rascunho** (AC: 3) — botão "Gerar termo (rascunho)" chama `useCreateTermo(caseId)` com `tipoTermo`, `formaPagamento='PARCELADO'`, `elaboradoPorId=profile.id`, os %/parcela/desconto e saldos; toast + navega ao preview S3-04.
- [x] **Decidir remanescente** (AC: 5) — adotada **opção (A)**: `remanescente` é input de tela, NÃO altera cálculo nem schema; repassado como placeholder na S6-04 (`remanescenteAnteriorCentavos`). Sem migration.
- [x] **Testes** (AC: 1–6) — `npx tsc --noEmit`: só 3 erros PRÉ-EXISTENTES. Lint: só ruído CRLF. Teste funcional em runtime pendente p/ @qa.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/casos.$id.termo.elaborar.tsx` (`StubPage` → form + prévia + salvar).
- (reuso, sem mudança) `src/hooks/useTermo.ts` (`useCalcTermo`, `useCreateTermo`, `useTermos`), `src/rpc/termo.ts` (`calcularTermoFn`, `createTermoFn`), `src/lib/termo-service.ts` (`calcularTermo`, `createTermo`), `src/components/cases/TermoPanel.tsx` (referência de máscara/formatação).
- **SÓ na opção (B):** `src/lib/termo-service.ts` (`calcularTermo`/`createTermo` + `remanescenteAnteriorCentavos`), `src/rpc/termo.ts` (schema), migration nova + rollback + recriar view `system_termo_snapshots_active`.

**REGRAS DE OURO (pertinentes):**
- **NÃO toca `system_cases`** → **NÃO recriar `system_cases_active`** (regra de ouro 2).
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- Erros de dependência externa → **424**, nunca 5xx (`reference_vercel_5xx_gateway`).
- Se a opção (B) exigir migration, aplicar via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto).
- Cálculo autoritativo **no servidor** (`calcularTermo`) — o front só exibe; nunca reimplementar a regra floor no browser.

**Parametrizável / defaults:**
- `% honorários = 15`, `valor parcela = R$500`, `% desconto à vista = 10` (de `TERMO_DEFAULTS`). São **defaults editáveis** no form, não hardcode fixo.

**Riscos de regressão:**
- Não disparar a imutabilidade do snapshot: só criar RASCUNHO (INSERT); conferência/aprovação/PDF continuam no `TermoPanel`/fluxo S17b existente.
- O snapshot guarda **uma** `forma_pagamento`; a exibição das **duas** formas juntas é do documento (S6-04) e da prévia da tela — não confundir o que persiste com o que o cliente escolhe.

### Testing
- Editar inputs → prévia recalcula (honorários total, N×parcela+última, à vista).
- Tipo COMPLEMENTAR → campo remanescente aparece; PARCIAL → some.
- Salvar rascunho → snapshot RASCUNHO criado; preview S3-04 mostra.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** `calcularTermo`/`createTermo` + RPC/hooks (JÁ EXISTEM), `system_termo_snapshots` (JÁ EXISTE), S3-04 (preview de leitura, para ver o rascunho criado).
- **Habilita:** S6-04 (geração do documento editável a partir do snapshot RASCUNHO).

---

## BACKLOG explícito (fase futura — NÃO fazer nesta story)

- **Calculadora encadeada parcial→complementar automática** (o remanescente é input manual aqui, opção A).
- **Persistir `remanescente_anterior` no snapshot** + somá-lo ao cálculo (opção B) — só se o owner exigir.
- **Por-extenso completo** dos valores (só os principais entram no documento na S6-04).
- Conciliação com ERP; captura digital da escolha do cliente via portal.

## File List

- `sistema-hv/src/routes/casos.$id.termo.elaborar.tsx` (`StubPage` → form + prévia debounced + salvar rascunho + gancho S6-04)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft — tela Elaborar termo (form + prévia via calcularTermo + snapshot RASCUNHO). Registra a inconsistência do `remanescente` (calc/schema não suportam hoje). Frente B / Sprint 6. | @sm |
| 2026-07-03 | 1.0 | Ready for Review — form real com prévia ao vivo (useCalcTermo debounced), defaults 15%/R$500/10% editáveis, remanescente condicional (opção A — input de tela), salvar RASCUNHO via useCreateTermo. Sem migration. Typecheck: só 3 erros pré-existentes. | @dev |
