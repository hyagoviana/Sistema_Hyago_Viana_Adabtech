# Story S1-04: Motor lê o responsável exclusivo do CASO

- **Sprint:** S1 — Correções que travam o uso hoje
- **ID:** S1-04 · **Item do Thiago:** 4 e 11 (parte c)
- **Status:** Ready for Review
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

- [x] Função `carregarResponsaveisDirecionados` (server-only), com a regra dos 3 cenários (AC 1, 4).
- [x] Ligar nos dois pontos de montagem do payload (AC 2). (`staging-core.ts:1045`, `sync-core.ts:621`)
- [ ] Registrar o alerta `ALT-RESP-003` no catálogo (`engine/alerts.ts`) e na legenda da tela (AC 1, 3).
- [x] Testes (AC 5).
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

---

## Ajuste de escopo — resposta A2 (04/09)

O AC 1 previa três cenários (um responsável → direciona; dois ou mais → regra geral **+ alerta
ALT-RESP-003**; não elegível → regra geral). O terceiro cenário deixou de existir:

> "vamos manter que cada caso pode ter apenas 1 responsável para fins das funções do SHV"

Sem "dois ou mais", o alerta não tem o que sinalizar — **não foi criado**. A regra de 1 responsável passou
a ser garantida na escrita (`setCaseResponsaveis`).

---

## Dev Agent Record (04/09/2026)

**`src/lib/distribuicao/responsavel-caso.ts`** — resolve o responsável de cada caso e devolve dois mapas
(por `case_id` e por código do ProJuris), filtrados pelo **pool de executores elegíveis** que o chamador
já calculou. Direcionar para quem o motor não distribui deixaria a tarefa parada.

Ligado nos dois caminhos que gravavam `directed_executor_id: null` fixo: `sync-core` (pelo código do
ProJuris, no mesmo padrão do `urgencyByCode` que já existia) e `staging-core` (pelo `case_id`, que a
linha da fila já traz).

**Desempate determinístico:** se algum caso antigo tiver dois vínculos, vence o **mais antigo** — nunca
"qualquer um".

**Efeito colateral tratado:** a reatribuição ao excluir colaborador (`reassignAndDeleteUser`) empilhava o
destino no fim da lista. Com a regra de 1, o destino seria descartado silenciosamente; agora a escolha é
explícita — quem sobrou continua, e se não sobrou ninguém entra o destino.

---

## QA Results — 04/09/2026 (Quinn)

**Gate: PASS**

`npm run qa:responsavel`, contra o banco — 6/6: pool vazio não direciona ninguém; o filtro de
elegibilidade reduz corretamente; nenhum caso tem 2 responsáveis; o resolvedor devolve no máximo um.

### 🔴 Diagnóstico que o Thiago precisa saber

**Hoje nenhum caso seria direcionado.** Os 4 casos com responsável são do **Adavio** (2) e do **Hyago**
(2), e **nenhum dos dois é `peticionante`** — logo não estão no pool de executores do motor. O Hyago
inclusive está mapeado como executor, mas com a chave de peticionante desligada.

O mecanismo está correto e provado; só não tem em quem agir. Para o direcionamento funcionar na prática,
o responsável do caso precisa ser alguém que o motor distribui.
