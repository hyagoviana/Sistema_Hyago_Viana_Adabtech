# Story S6-01: Página de casos prioritários da controladoria

- **Sprint:** S6 — Controladoria
- **ID:** S6-01 · **Item do Thiago:** 14 · **Decisão:** D5
- **Status:** Ready for Review
- **Estimativa relativa:** G
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** controladoria,
**quero** uma página com os casos prioritários e **quando cada um se moveu pela última vez**,
**para que** eu saiba onde olhar sem abrir caso por caso.

---

## Contexto

Anotações do Thiago nos desenhos 42-50:

- *"Vamos adicionar uma nova página vinculada a controladoria, em que teremos uma listagem e algumas
  informações de processos prioritários."*
- Estrutura desenhada: **Cliente / Caso** → e, para cada um, **Data última movimentação judicial** e
  **Data última movimentação administrativa**.
- *"Se o caso prioritário possui mais de 1 processo judicial / recurso, todos eles são listados aqui 1 por
  1 (compartilham a mesma informação de movimentação administrativa, mas a data de movimento judicial é
  individual por processo judicial vinculado)."*
- *"Como data de última movimentação administrativa, vamos considerar a data de última mudança de etapa
  do caso."*
- *"Todas as informações já existem vinculadas ao caso, apenas temos que trazer espelhar aqui. E apenas
  aparecem aqui aqueles marcados como casos prioritários."*

**Decisão D5:** "marcado como prioritário" = a **urgência do caso** já existente (`prioritario` ou
`urgente`), definida no menu do caso — nenhum campo novo.

---

## Acceptance Criteria

1. Rota nova em Controladoria: **Prioritários**, listando os casos com urgência `prioritario` ou `urgente`.
2. **Uma linha por processo judicial vinculado** ao caso (`system_case_judicial_processos` /
   `system_case_projuris_processos`). Caso prioritário **sem** processo judicial aparece em uma linha só,
   com a coluna judicial vazia (caso administrativo pode nunca ter processo).
3. Colunas: Cliente · Caso · Tema · Urgência · Processo (CNJ) · **Última movimentação judicial** (por
   processo) · **Última movimentação administrativa** (= data da última mudança de etapa do caso) ·
   Responsável.
4. **Ordenação padrão** pelo mais parado: maior tempo desde a última movimentação (a pergunta que a página
   responde é "o que está esquecido?").
5. Destaque visual para o que passou de um limiar de dias sem movimentação (limiar configurável na
   própria tela, começando em 30 dias).
6. Filtros: tema, responsável, urgência, e "sem movimentação há mais de N dias".
7. Clicar na linha abre o caso (e, na coluna do processo, a aba Judicial).
8. **RBAC**: respeita a visibilidade de casos por usuário já existente e o módulo Controladoria.
9. Performance: uma consulta agregada; sem N+1 por processo.
10. `npx tsc --noEmit` e `npm run lint` sem erro novo.

---

## Tasks / Subtasks

- [x] Query agregada: casos prioritários + processos + última movimentação judicial + última mudança de
      etapa (AC 1-3, 9).
- [x] Rota + tabela + filtros + ordenação + destaque (AC 1, 3-7).
- [x] Item no menu da Controladoria com o gate do módulo (AC 8).

---

## Dev Notes

- **Última movimentação judicial**: usar a data que a sincronização do ProJuris já traz por processo
  (`judicial-sync.ts` grava a última movimentação); não inventar cálculo novo.
- **Última movimentação administrativa**: a timeline do caso já registra mudança de etapa
  (`system_case_events` / timeline) — pegar o evento mais recente de mudança de etapa.
- A urgência já existe em `system_cases` (`cases-service.ts:2095`) e é editável no menu do caso (S4-01) —
  as duas stories se completam: uma define, a outra mostra.

## Definition of Done

- [ ] A controladoria consegue responder "o que está parado?" numa tela
- [ ] Um caso com 3 processos aparece em 3 linhas, com datas judiciais distintas

---

## Dev Agent Record (03/09/2026)

**Implementado.**
- `src/lib/prioritarios-service.ts` — consulta agregada (5 queries fixas, nenhuma dentro de laço),
  reusando `getVisibleCaseIds` para a visibilidade por usuário.
- `src/rpc/prioritarios.ts` + `src/hooks/usePrioritarios.ts` — leitura gate-ada por
  `requireModule("controladoria", "view")`.
- `src/routes/controladoria.prioritarios.tsx` — tabela com filtros (tema, responsável, urgência,
  limiar de dias), destaque do que passou do limiar, linha clicável para o caso e o número do processo
  levando à aba Judicial.
- Menu: item "Casos prioritários" no grupo Inteligência **e** entrada em `ROUTE_MODULE` do `rbac.ts` —
  sem essa segunda parte o item sumiria para todo mundo que não é admin (armadilha já registrada no
  próprio arquivo, na linha da rota de Distribuição).

**Estado dos dados:** hoje **nenhum** dos 411 casos tem urgência marcada, então a tela nasce vazia. O
empty-state explica onde marcar ("Editar caso" → Prioritário/Urgente).

---

## QA Results — 03/09/2026 (Quinn)

**Gate: PASS (após correção de 1 achado HIGH)**

### HIGH — a coluna Processo vinha vazia (CORRIGIDO)

A primeira versão lia os processos só de `system_case_judicial_processos`. Rodando contra o banco real,
a coluna Processo saiu **null**. Investigando, existem **duas** tabelas com metades diferentes da
informação:

| Tabela | Linhas | O que tem |
|---|---|---|
| `system_case_projuris_processos` | 211 (todas com CNJ) | o **vínculo** caso↔processo e o `numero_cnj` |
| `system_case_judicial_processos` | 4 (nenhuma com número) | o **espelho** do detalhe: tribunal e `data_ultima_modificacao` |

E há casos em **cada um dos lados sem o outro**: 211 vínculos sem espelho, e o
`INADIMPLENCIAHV-2026-0422` com espelho e **sem** vínculo. Ler só uma das tabelas esconderia processo da
controladoria — exatamente o que a tela existe para evitar.

Corrigido: união das duas por `codigo_processo` (bigint) ↔ `projuris_codigo_processo` (texto), com
normalização de tipo, e limpeza do sufixo `" (CNJ)"` que o ProJuris devolve no número.

### Verificação contra o banco real

`scripts/qa-prioritarios.ts` marca temporariamente três casos, roda o serviço de verdade e **restaura o
estado no `finally`** (inclusive se algo estourar). 10/10 verificações:

- lista vazia quando nada está marcado; os três casos aparecem quando marcados;
- caso com vínculo traz o CNJ limpo; caso só com espelho vira linha mesmo sem CNJ;
- caso sem processo nenhum vira uma linha com a coluna judicial vazia;
- urgência espelhada do caso; nome de cliente resolvido (sem UUID cru na tela);
- ordenação do mais parado para o mais recente;
- **visibilidade aplicada**: o usuário com papel restrito viu 0 de 3.

Ao final, a lista voltou a 0 linhas — nenhum rastro no banco.

**Observação para o Thiago:** dos 211 processos vinculados, só 4 têm o espelho com data de movimentação.
Para os outros, a coluna "Últ. mov. judicial" vai aparecer como *sem registro* até a sincronização do
ProJuris preencher o detalhe. Não é defeito da tela — é o estado dos dados hoje, e vale ele saber antes
de olhar.
