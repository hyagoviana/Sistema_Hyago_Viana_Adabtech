# Story S1-04: Motor lê o responsável exclusivo do CASO

- **Sprint:** S1 — Correções que travam o uso hoje
- **ID:** S1-04 · **Item do Thiago:** 4 e 11 (parte c)
- **Status:** Draft
- **Estimativa relativa:** M
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** coordenador que direcionou um caso para uma pessoa específica,
**quero** que o motor **entregue a ela** as tarefas daquele caso, em vez de distribuir por pontuação,
**para que** o direcionamento que eu fiz na ficha do caso valha de verdade.

---

## Contexto / causa raiz

Anotação do Thiago no desenho do menu de edição do caso: *"Temos que conferir se o motor de distribuição
está buscando corretamente se existe um responsável exclusivo para o caso que está rodando no motor (fora
da regra geral). Há essa indicação na programação dele. O local que ele encontra essa informação, é aqui
no caso."*

**Ele estava certo — não busca.** A precedência existe e está implementada:

`src/lib/distribuicao/engine/flow-selector.ts:44` — `detectAbsoluteResponsible`:
1. `process.directed_executor_id`
2. `task.theme_exclusive_executor_id`
3. `task.task_type_exclusive_executor_id`

Os níveis 2 e 3 funcionam (editáveis nas telas de Temas e Tipos de tarefa). O nível 1 **nunca é populado**:

- `src/lib/distribuicao/staging-core.ts:1045` → `directed_executor_id: null`
- `src/lib/distribuicao/sync-core.ts:621` → `directed_executor_id: null`

O vínculo do caso mora em `system_case_responsaveis` (N:N, `20260709000050_users_phone_responsaveis.sql`) —
o caso pode ter **vários** responsáveis, e o motor precisa de **um**.

---

## Acceptance Criteria

1. Ao montar o `Process` para o motor, `directed_executor_id` passa a ser resolvido a partir do **caso
   vinculado ao processo**:
   - caso com **exatamente um** responsável ativo (`deleted_at IS NULL`) **elegível no motor**
     (peticionante ligado + vínculo ProJuris ativo) → esse é o `directed_executor_id`;
   - caso com **nenhum** responsável, ou com responsável **não elegível** → `null` (segue a regra geral
     por pontuação — comportamento de hoje, sem regressão);
   - caso com **mais de um** responsável ativo → `null` **e** alerta `ALT-RESP-003` no resultado, para a
     controladoria saber por que não direcionou. Nada de escolher um "primeiro" arbitrário.
2. Vale para os dois caminhos de ingestão (`staging-core` e `sync-core`) — mesma função compartilhada,
   sem duplicar regra.
3. O **simulador** e a tela de resultado mostram o nível que decidiu (`process_directed` já existe em
   `AbsoluteResult.level`) — quem olha entende que veio do caso, não da pontuação.
4. Elegibilidade reusa a régua existente (`src/lib/distribuicao/elegibilidade-shared.ts`) — não criar
   critério novo.
5. Testes: caso com 1 responsável elegível → tarefa vai para ele; com 2 → cai na regra geral + alerta;
   com 1 não elegível → regra geral; sem caso vinculado → regra geral.
6. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [ ] Função `resolveDirectedExecutor(caseId)` (server-only), com a regra dos 3 cenários (AC 1, 4).
- [ ] Ligar nos dois pontos de montagem do payload (AC 2). (`staging-core.ts:1045`, `sync-core.ts:621`)
- [ ] Registrar o alerta `ALT-RESP-003` no catálogo (`engine/alerts.ts`) e na legenda da tela (AC 1, 3).
- [ ] Testes (AC 5).
- [ ] Validar em produção com um caso real direcionado (rodar o simulador antes de ligar).

---

## Dev Notes

- **Ordem de precedência não muda**: caso direcionado ganha do exclusivo do tema, que ganha do exclusivo
  do tipo de tarefa. Só estamos ligando o nível que estava mudo.
- Esta story conversa com a **S4-01** (menu "Editar caso" com campo Responsável): é lá que a pessoa vai
  definir o direcionamento. As duas podem ir juntas para o Thiago validar ponta a ponta.
- Cuidado com carga: resolver por caso dentro de um laço de N tarefas geraria N queries — carregar os
  responsáveis dos casos envolvidos **em lote** antes do laço.

## Definition of Done

- [ ] Caso direcionado recebe a tarefa na pessoa certa, provado no simulador e numa rodada real
- [ ] Casos sem direcionamento seguem exatamente como hoje (regressão zero)
- [ ] testes + typecheck + lint verdes
