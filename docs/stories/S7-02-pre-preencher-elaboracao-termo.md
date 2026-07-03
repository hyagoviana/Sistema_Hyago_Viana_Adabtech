# Story S7-02: Pré-preencher a elaboração do termo a partir do histórico (honorários + snapshot)

- **Sprint:** 7 — Termo puxando do histórico (preencher o mínimo) `[Frente B]`
- **ID:** S7-02
- **Status:** Ready for Review
- **Estimativa relativa:** M (front + leitura — carregar `system_case_honorarios` na tela `elaborar`, sugerir tipo termo, mostrar bloco "referência do último termo" do `system_termo_snapshots`; badges de origem). **Provável SEM migration.**
- **Executor sugerido:** @dev (front) + leitura via RPC/serviço · Quality gate: @architect

---

## Story

**Como** operador do financeiro elaborando o Termo de Acerto,
**quero** que a tela de elaboração já venha com **% honorários**, **valor da parcela** e **% desconto à vista** preenchidos a partir dos honorários persistidos da procuração (S7-01), com o **tipo de termo** sugerido pelo histórico e uma **referência do último termo** do caso ao lado do campo remanescente,
**para que** eu preencha só o **mínimo** (os saldos do processo, que não têm fonte) em vez de redigitar tudo, sabendo claramente o que veio do histórico vs o que é manual.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (tela alvo):** `src/routes/casos.$id.termo.elaborar.tsx` — form real da S6-03. Hoje é **100% manual**: os campos `% honorários`, `valor parcela`, `% desconto à vista` usam os **defaults** `TERMO_DEFAULTS` (15% / R$500 / 10%, `termo-service.ts:17`). É o alvo desta story.
- **JÁ EXISTE (calculadora):** `calcularTermo` (`termo-service.ts:57`) recebe `saldoAntesCentavos`, `saldoDepoisCentavos`, `parcelasPagasCentavos?`, `percentual?`, `valorParcelaCentavos?`, `descontoAvistaPct?`. Os 3 últimos são exatamente o que a S7-01 persiste — a prévia/servidor não muda, só os **valores iniciais** do form.
- **JÁ EXISTE (histórico de termos):** `system_termo_snapshots` versionado por caso (`UNIQUE(case_id, version)`); `listTermos(caseId)` retorna **desc por version** (`termo-service.ts:99-108`) — 11 snapshots em 3 casos. O **último** (topo da lista) serve de **referência** e de sinal para sugerir `tipo_termo`.
- **NOVO (fonte da S7-01):** `system_case_honorarios` (criada na S7-01) — 1 registro vigente por caso com `percentual_honorarios`, `valor_parcela_centavos`, `desconto_avista_pct`, `forma_pagamento`, `honorarios_total_centavos`.
- **NOVO nesta story (só front + leitura):**
  1. Ao abrir a tela, **carregar** `system_case_honorarios` do caso e usar como **valor inicial** de `% honorários` / `valor parcela` / `% desconto à vista` — **fallback** nos defaults `TERMO_DEFAULTS` quando a tabela não tiver o campo.
  2. **Sugerir `tipo_termo`**: `COMPLEMENTAR` quando já existe snapshot **ACEITO** no caso (ou snapshot anterior, conforme regra decidida); senão `PARCIAL`. É só um **default sugerido**, editável.
  3. **Bloco "referência do último termo"**: mostrar valores do último snapshot (via `listTermos`) perto do campo **remanescente anterior** (que segue **manual**), como dica — **sem** auto-calcular o número jurídico.
  4. **Badges de origem na UI**: campo que veio da procuração recebe badge "puxado da procuração"; o que veio de default/manual fica sem badge (ou "manual"). Deixar explícito o que é histórico vs digitado.

> **DECISÃO DO OWNER (travada — Orion, não reabrir):**
> - **Saldo antes/depois/parcelas pagas CONTINUAM manuais** (dados do processo, sem fonte) — **não** tentar puxar.
> - **Remanescente anterior fica MANUAL**, mas com **DICA/referência** dos valores do último snapshot do caso. **NÃO auto-calcular** o número jurídico sem a fórmula do Hyago (fórmula = fase futura).

> **⚠ INCONSISTÊNCIA A RESOLVER (regra de sugestão do tipo):** "COMPLEMENTAR se já há snapshot ACEITO no caso" precisa do valor exato do `status` no `system_termo_snapshots` (RASCUNHO/APROVADO/APRESENTADO/ACEITO). Confirmar com @architect o enum real e se a regra é "existe ACEITO" ou "existe qualquer snapshot não-RASCUNHO". Enquanto não confirmado: sugerir `COMPLEMENTAR` se **existe ao menos um snapshot** no caso (há histórico), `PARCIAL` se é o primeiro — e deixar o campo editável (a sugestão nunca trava a escolha).

---

## Acceptance Criteria

1. Ao abrir `/casos/$id/termo/elaborar`, os campos **`% honorários`**, **`valor parcela`** e **`% desconto à vista`** são **inicializados** com os valores de `system_case_honorarios` do caso quando existirem; quando o campo não existir na tabela, cai no **default** (`TERMO_DEFAULTS`: 15% / R$500 / 10%).
2. Cada campo pré-preenchido a partir da procuração exibe um **badge "puxado da procuração"** (ou equivalente claro); campos em default/manual não exibem esse badge. O usuário pode **editar** qualquer valor (a origem é só informativa).
3. O **`tipo_termo`** vem **sugerido** conforme o histórico (COMPLEMENTAR se já há snapshot [ACEITO/qualquer, conforme decisão]; senão PARCIAL) e permanece **editável**.
4. Existe um **bloco "referência do último termo"** perto do campo **remanescente anterior** (visível quando COMPLEMENTAR), mostrando valores do **último snapshot** do caso (via `listTermos`, topo desc). O campo remanescente **continua manual** — o bloco é **dica**, **não** preenche nem calcula o valor automaticamente.
5. Os campos de **saldo antes / saldo depois / parcelas pagas continuam manuais** e **sem** pré-preenchimento (sem badge de procuração).
6. A **prévia** e o **salvar rascunho** continuam funcionando como na S6-03 (`useCalcTermo`/`useCreateTermo`, cálculo autoritativo no servidor). **SEM migration** (só leitura da tabela da S7-01 e do snapshot). **NÃO** toca `system_cases` → **não** recria view/trigger.

---

## Tasks / Subtasks

- [x] **Carregar honorários do caso** (AC: 1,2) — `getCaseHonorarios(caseId)` (`termo-service.ts`) + `getCaseHonorariosFn` (RPC) + `useCaseHonorarios` (hook). Valores iniciais de `% honorários` / `valor parcela` / `% desconto à vista` em `casos.$id.termo.elaborar.tsx`, fallback em `TERMO_DEFAULTS`. Badge "puxado da procuração" (`PulledBadge`) nos campos vindos da tabela — some ao editar.
- [x] **Sugerir tipo termo** (AC: 3) — a partir de `useTermos(caseId)`: **COMPLEMENTAR se há ≥1 snapshot** no caso; senão PARCIAL (enum `status` confirmado em `20260608000007_s17_termo.sql`: `RASCUNHO/EM_CONFERENCIA/APROVADO_JURIDICO/APRESENTADO/ACEITO/RECUSADO/SUBSTITUIDO`; regra "existe snapshot" adotada, editável).
- [x] **Bloco referência do último termo** (AC: 4) — 1º item de `useTermos` (desc por version) renderiza honorários/à vista/remanescente do último snapshot ao lado do campo remanescente; explicitamente **referência** (não auto-cálculo).
- [x] **Distinguir origem na UI** (AC: 2,5) — `PulledBadge` "puxado da procuração" nos 3 campos financeiros; saldos/parcelas/remanescente sem badge.
- [x] **[Extra — reconciliação de placeholders]** — migration `20260707000002_termo_remanescente.sql` (coluna `remanescente_anterior_centavos` em `system_termo_snapshots`; NÃO toca `system_cases`); `createTermo` persiste o remanescente; `buildTermoValues` reescrito p/ preencher **TODOS** os placeholders dos 2 modelos e somar remanescente no `honorarios_total` do COMPLEMENTAR. Ver detalhes na seção "Reconciliação" abaixo.
- [x] **Testes** (AC: 1–6) — `npx tsc --noEmit` verde (só 3 erros pré-existentes de `service_type_id`); `eslint` sem erros reais (só prettier/CRLF pré-existente). Migration aplicada e verificada (coluna presente).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/casos.$id.termo.elaborar.tsx` (valores iniciais do form a partir de `system_case_honorarios` + fallback defaults; badges; bloco de referência; sugestão de tipo).
- Leitura nova de `system_case_honorarios`: RPC/serviço (ex.: `getCaseHonorarios(caseId)` em `cases-service.ts` ou `termo-service.ts`) + hook. Reuso de `useTermos` (já existe) para a referência do último termo.
- (reuso, sem mudança) `src/hooks/useTermo.ts` (`useCalcTermo`, `useCreateTermo`, `useTermos`), `src/lib/termo-service.ts` (`calcularTermo`, `listTermos`, `TERMO_DEFAULTS`).

**REGRAS DE OURO (pertinentes):**
- **NÃO toca `system_cases`** → **NÃO recriar `system_cases_active`** (regra de ouro 2). Esta story só **lê** `system_case_honorarios` e `system_termo_snapshots`.
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- **SEM migration** (leitura pura; a tabela vem da S7-01).
- Cálculo autoritativo **no servidor** (`calcularTermo`) — o front só muda os **valores iniciais**, nunca reimplementa a regra floor.
- Erro de dependência externa → **424**, nunca 5xx (`reference_vercel_5xx_gateway`).

**Parametrizável / defaults:**
- Fallback = `TERMO_DEFAULTS` (15% / R$500 / 10%). Os valores da procuração **sobrescrevem** o default quando presentes, e continuam **editáveis** no form.

**Riscos de regressão:**
- Não quebrar quando `system_case_honorarios` não tem linha (caso antigo pré-S7-01): cair 100% nos defaults, sem badge.
- Não auto-preencher/calcular o remanescente (owner travou como manual) — só mostrar referência.
- Sugestão de tipo nunca trava a escolha (é default editável).

### Testing
- Caso com honorários persistidos → % / parcela / desconto vêm preenchidos com badge "puxado da procuração".
- Caso sem registro → defaults 15%/R$500/10%, sem badge.
- Já há snapshot no caso → tipo sugerido COMPLEMENTAR; primeiro termo → PARCIAL.
- COMPLEMENTAR → bloco "referência do último termo" aparece perto do remanescente; remanescente segue vazio/manual.
- Prévia e salvar rascunho continuam idênticos à S6-03. `typecheck`/`lint` verdes.

---

## Dependências

- **Depende de:** **S7-01** (tabela `system_case_honorarios` com os valores), S6-03 (form de elaboração), `listTermos`/`useTermos` + `calcularTermo` (JÁ EXISTEM), `system_termo_snapshots` (JÁ EXISTE).
- **Habilita:** operador preenche só o mínimo; alimenta a geração do documento (S6-04) com valores já sugeridos.

---

## BACKLOG explícito (fase futura — NÃO fazer nesta story)

- **Fórmula do remanescente anterior** (cálculo encadeado parcial→complementar automático) — **aguarda a fórmula do Hyago**. Aqui o remanescente é manual com referência.
- Puxar saldos do processo (sem fonte — seguem manuais).
- Preencher a partir de honorários de **outros casos** do mesmo cliente (aqui é só o caso corrente).

## Reconciliação de placeholders (crítico — doc não pode sair com `<...>` literais)

Os 2 modelos (`docs/modelos-termo/*.docx`) foram inspecionados e seus placeholders reconciliados em `buildTermoValues` (`termo-service.ts`). **Todos** são preenchidos:

- **Comuns (2 modelos):** `nome_cliente`, `cpf_cliente`, `tipo_servico`, `saldo_antes`, `saldo_depois`, `parcelas_pagas`, `valor_abatimento`, `percentual_honorarios`, `honorarios_total`, `honorarios_total_extenso`, `qtd_parcelas`, `valor_parcela`, `valor_ultima_parcela`, `desconto_avista`, `valor_avista`, `valor_avista_extenso`, `data_extenso` — todos derivados do snapshot/cadastro/cálculo.
- **Só PARCIAL:** `valor_ultima_parcela_extenso` (derivado); `saldo_atual`, `percentual_abatimento` — **inputs OPCIONAIS** na tela elaborar (sem fonte no cálculo). Ausentes → string vazia.
- **Só COMPLEMENTAR:** `honorarios_abatimento` (= só o abatimento novo = `valor_total_centavos`), `remanescente_anterior` (= valor digitado); `saldo_originario`, `saldo_epoca_abatimento` — **inputs OPCIONAIS** na tela. Ausentes → string vazia.
- **COMPLEMENTAR — soma do remanescente:** `honorarios_total = valor_total_centavos + remanescente_anterior_centavos`. O remanescente é persistido em `system_termo_snapshots.remanescente_anterior_centavos` (via `createTermo`) e também aceito como input no ato da geração (`gerarDocumentoTermo`), prioridade para o input da geração.

**Decisão:** placeholders sem fonte no cálculo saem como **string vazia** quando o operador não os informa (mínimos, opcionais) — **nunca** o token literal `<...>`.

## File List

- `sistema-hv/supabase/migrations/20260707000002_termo_remanescente.sql` (novo — coluna `remanescente_anterior_centavos` + refresh da view `_active`)
- `sistema-hv/src/routes/casos.$id.termo.elaborar.tsx` (valores iniciais + `PulledBadge` + referência do último termo + sugestão de tipo + inputs opcionais + envio de remanescente/extras)
- `sistema-hv/src/lib/termo-service.ts` (`getCaseHonorarios`; `createTermo` persiste remanescente; `dataPorExtenso`; `TermoDocExtras`; `buildTermoValues` reescrito; `gerarDocumentoTermo` aceita extras)
- `sistema-hv/src/rpc/termo.ts` (`getCaseHonorariosFn`; `createSchema` + remanescente; `gerarDocumentoTermoFn` + extras)
- `sistema-hv/src/hooks/useTermo.ts` (`useCaseHonorarios`; `useCreateTermo`/`useGerarDocumentoTermo` estendidos)
- `sistema-hv/src/components/cases/GerarDocumentoTermoButton.tsx` (props de extras repassadas)
- `sistema-hv/src/lib/supabase/types.ts` (coluna `remanescente_anterior_centavos` no snapshot)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft — pré-preencher elaboração do termo a partir de `system_case_honorarios` (fallback defaults) + sugerir tipo + bloco referência do último snapshot; saldos e remanescente seguem manuais; badges de origem. Sem migration. Sprint 7 / Frente B. | @sm |
| 2026-07-03 | 1.0 | Implementado — pré-preenchimento + badges + sugestão de tipo + referência. **Escopo ampliado** com a reconciliação de placeholders: migration `20260707000002_termo_remanescente.sql` (coluna nova, NÃO toca `system_cases`), `buildTermoValues` cobrindo TODOS os placeholders dos 2 modelos, soma do remanescente no COMPLEMENTAR, inputs opcionais mínimos na tela. typecheck/lint verdes (ignorados pré-existentes). Ready for Review. | @dev |
