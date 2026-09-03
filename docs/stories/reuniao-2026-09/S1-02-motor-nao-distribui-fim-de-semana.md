# Story S1-02: Motor não distribui em sábado, domingo nem dia bloqueado

- **Sprint:** S1 — Correções que travam o uso hoje
- **ID:** S1-02 · **Item do Thiago:** 11 (parte a)
- **Status:** Ready for Review
- **Estimativa relativa:** P
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** controladoria,
**quero** que o motor de distribuição **não rode** em sábados, domingos e dias bloqueados no calendário,
**para que** ninguém receba tarefa com prazo contado a partir de um dia em que o escritório não trabalha.

---

## Contexto / causa raiz

Thiago, na reunião (bloco 2, 22:30): *"Ele tá distribuindo sábado, tá? Sábado e domingo ele tá
distribuindo tarefa, está considerando como dia útil. Aí tem a opção da gente fazer e bloquear em todos
os sábados, né? Mas é muito sábado. Se a gente conseguisse que ele já sabia que final de semana ele não
joga tarefa."*

A engine **já sabe** o que é dia operacional — `src/lib/distribuicao/engine/date-utils.ts`:

```ts
export function isWeekday(iso: string)          // seg-sex
export function isOperationalDay(iso, blocks)   // seg-sex E sem bloqueio geral no calendário
```

O buraco está em **quem chama**: `src/routes/api.cron.daily.tsx:41` faz
`runSync(ymd(new Date()), 3)` **todo dia**, e o `distributionDate` do lote vira o próprio sábado.
A engine respeita dia útil só na *data-alvo* (`addOperationalDays`), não na *data de distribuição*.
O calendário (`system_distribution_calendar`) permite bloquear dia a dia, mas o Thiago recusou —
com razão — a ideia de cadastrar todo sábado do ano na mão.

---

## Acceptance Criteria

1. O cron diário **não distribui** quando o dia corrente não é operacional (fim de semana ou bloqueio
   geral no calendário). O retorno traz `{ skipped: "dia nao operacional" }` — não é erro, é pulo.
2. A **fila da controladoria continua sendo montada** todo dia (`syncMovements`), inclusive fim de semana:
   ver as intimações que chegaram no sábado é útil; o que não pode é *distribuir* tarefa.
3. A execução **manual** ("Distribuir tarefa" na tela) continua funcionando em qualquer dia — a trava é do
   automático. Se a data escolhida não for operacional, a tela avisa mas deixa seguir (decisão consciente
   de quem clicou).
4. `runSync` ganha a checagem no próprio núcleo (defesa em profundidade), com flag
   `{ force?: boolean }` usada só pelo caminho manual.
5. Teste unitário: `runSync` num sábado retorna `skipped`; num sábado com `force: true` executa; numa
   segunda-feira executa. Data bloqueada no calendário se comporta como sábado.
6. `npx tsc --noEmit` e `npm run lint` sem erro novo.

---

## Tasks / Subtasks

- [x] Expor helper `isOperationalDate(iso)` que carrega o calendário e reusa `isOperationalDay`
      (`src/lib/distribuicao/sync-core.ts`, reusando `buildGeneralBlockSet` de `engine/date-utils.ts`).
- [x] Guarda no `runSync` com `force` opcional (AC 4).
- [x] Guarda no cron: pula a distribuição, mantém `syncMovements` (AC 1, 2). (`src/routes/api.cron.daily.tsx`)
- [x] Aviso na tela quando a data escolhida não é operacional (AC 3).
- [x] Testes (AC 5).

---

## Dev Notes

- **Não** cadastrar sábados/domingos em `system_distribution_calendar` — a regra é de código, o calendário
  fica só para feriado/recesso (é o que o campo `general` da tela já significa).
- Cuidado com fuso: usar `ymd()`/`America/Sao_Paulo` como o resto do módulo. O cron roda 11:00 UTC.
- Segunda-feira deve continuar processando o que entrou no fim de semana (o `runSync` já varre janela de
  3 dias — segundo parâmetro).

## Definition of Done

- [ ] Uma semana de cron sem nenhuma distribuição gravada em sábado/domingo
- [ ] Distribuição manual segue funcionando
- [ ] testes + typecheck + lint verdes

---

## Dev Agent Record (03/09/2026)

**Implementado.**
- `isOperationalDate(iso)` em `sync-core.ts` — reusa `isWeekday` da engine + consulta o bloqueio
  `general` do calendário. Nenhuma regra nova de data foi escrita.
- `runSync(date, windowDays, { force })` — recusa dia não operacional; `force` só no caminho manual.
- `api.cron.daily.tsx` e `api.cron.distribuicao.tsx` pulam a distribuição e devolvem
  `{ skipped: "dia nao operacional" }`. A fila da controladoria (`syncMovements`) **continua rodando**.
- `rpc/distribuicao.ts` (botão Sincronizar) passa `force: true`; o painel avisa por toast quando a data
  escolhida cai em fim de semana.
- Teste novo `src/lib/distribuicao/engine/dia-operacional.test.ts` (8 asserções, todas passando),
  incluído em `npm run test:motor`.

**Pendente:** decisão do owner sobre carregar feriados nacionais automaticamente (pergunta A4 ao Thiago).

---

## QA Results — 03/09/2026 (Quinn)

**Gate: PASS (após correção de 1 achado HIGH)**

### HIGH — fail-open no bloqueio geral duplicado (CORRIGIDO)

A primeira versão de `isOperationalDate` consultava o calendário com `.maybeSingle()`. A UNIQUE da tabela é
`(date, block_type, executor_id, organization_id)` e `executor_id` é **NULL** nos bloqueios gerais — como
NULL não conflita com NULL no Postgres, a mesma data pode ter duas linhas `general`.

**Não é hipótese:** `2026-12-31` tem exatamente duas. Nesse caso o PostgREST devolve erro (PGRST116),
`data` volta `null`, e a função respondia **"é dia operacional"** — o recesso seria ignorado e o motor
distribuiria. Fail-open silencioso, no eixo do feriado em vez do fim de semana.

Corrigido: consulta por lista com `.limit(1)` + checagem de `length`, e o `error` passou a ser tratado
explicitamente (em falha de leitura, mantém a decisão de dia útil e registra no log).

### Verificação contra o banco real

Criado `scripts/qa-dia-operacional.ts`, que roda a função de verdade contra o banco:

| Data | Situação | Operacional? |
|---|---|---|
| 2026-12-31 | feriado com **2 linhas** duplicadas | não |
| 2026-09-07 | feriado (7 de setembro) | não |
| 2026-09-05 / 06 | sábado e domingo | não |
| 2026-09-04 / 08 | dias úteis comuns | sim |

6/6 casos corretos. O teste unitário (`dia-operacional.test.ts`, 8 asserções) continua verde.

### Observações

- O calendário **já tem feriados cadastrados** (02/09 e 07/09). Isso muda o peso da pergunta A4 ao Thiago:
  alguém já mantém isso à mão; carregar os nacionais automaticamente seria conveniência, não necessidade.
- A fila da controladoria continua rodando todo dia (AC 2) — verificado no cron.
- Disparo manual passa `force: true` (AC 3) — verificado na RPC.
