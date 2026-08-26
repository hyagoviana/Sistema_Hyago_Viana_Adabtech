# Story TK1: Status de tarefa igual ao ProJuris (sem "Pendente") + filtro por status e por advogado na agenda

**Épico:** Reunião 2026-08-26 · **ID:** TK1 (item 12 do owner) · **Onda:** 1
**Executor:** @data-engineer (migration + backfill) + @dev (serviço, UI) · Quality gate: @qa
**Status:** Ready for Review — implementada em 2026-08-26 (T1-T6). Falta o passeio manual na UI (T7).
**Risco:** MÉDIO — mexe no CHECK e nos dados de `system_case_tasks`, que **9 arquivos** leem. O risco não é conceitual, é de **esquecer um ponto de leitura**. A lista completa está aqui.

---

## Story

**Como** administrador que confere a agenda do time,
**quero** que a tarefa do SHV tenha **os mesmos status do ProJuris**,
**para que** eu saiba o que de fato já foi feito, e possa filtrar a agenda por status e por advogado.

Thiago: "o ProJuris tem esses status de tarefa: pendente, concluído com sucesso, concluído sem sucesso. Não sei se a gente tá fazendo essa identificação, é um filtro importante." E depois: "os nossos tipos de tarefas aqui do sistema ter esses mesmos status".

**Decisão do owner (26/08):** tira o `PENDENTE`. O ciclo passa a ser
**Em andamento → Concluída com sucesso / Concluída sem sucesso / Cancelada**.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Tabela:** `system_case_tasks` (`supabase/migrations/20260602000002_case_dossie.sql:11`) com
  `status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDA'))` e `completed_at`.
- **Serviço:** `src/lib/dossie-service.ts`
  - `setCaseTaskStatus` (linha ~83) — grava status, seta `completed_at` quando CONCLUIDA e emite evento (`task_completed` / `task_started` / `task_status_changed`).
  - `listWorkItems` (linha ~363) — a aba Tarefas; filtra com `.neq("status","CONCLUIDA")` (linha ~383) e cria itens de checklist com `status: "PENDENTE"` (linha ~468).
- **RPC:** `src/rpc/dossie.ts:108` (`setCaseTaskStatus`) — e na linha 113 dispara o **workflow** `task_completed` quando o status é `CONCLUIDA`.
- **UI que lê status de tarefa (TODOS os pontos):**
  - `src/components/cases/CaseDossie.tsx:246-255` — checkbox que alterna PENDENTE ⇄ CONCLUIDA.
  - `src/routes/tarefas.tsx:121-125` — select "Todos os status / Pendente / Em andamento".
  - `src/components/hv/Sidebar.tsx:220` — contador do menu (`status !== CONCLUIDA`).
  - `src/hooks/useControladoria.ts:91`, `src/hooks/useExceptions.ts:45`, `src/components/settings/UserReportDialog.tsx:87` — todos com `!== CONCLUIDA`.
  - `src/components/cases/CaseTimeline.tsx:116` e `CaseFeed.tsx:152` — texto do evento `task_status_changed`.
- **ProJuris (o de-para já existe parcialmente):**
  - `src/lib/projuris/criar-tarefa.ts:202` — cria com `codigoTarefaEventoSituacao: 1` (Pendente), `situacaoConcluida: false`; o comentário do arquivo registra que **2 = Concluída com sucesso**.
  - `src/lib/projuris/judicial-sync.ts:234` e `processo-detalhe.ts:316` — leem `situacao` / `flagSituacaoConcluida` de volta.
- **Agenda/calendário:** `src/routes/controladoria.distribuicao.calendario.tsx` — já filtra por **executor** (`useExecutorMappings`, linha ~238) e usa `listDistributionTasksByDayFn`.

### NÃO CONFUNDIR (não tocar)

`PENDENTE` também é usado em **parcelas** (`asaas/service.ts`, `contaazul/service.ts`, `ClientFinanceiroSection`, `AsaasCobrancasPanel`, `admin-dashboard-service`) e em **movimentos do motor** (`staging-core.ts` — `MovementDecisao`). **Essas duas famílias ficam exatamente como estão.** Esta story é só `system_case_tasks`.

### NOVO

1. Novo domínio de status: `EM_ANDAMENTO` (default), `CONCLUIDA_SUCESSO`, `CONCLUIDA_SEM_SUCESSO`, `CANCELADA`.
2. Backfill: `PENDENTE → EM_ANDAMENTO`, `CONCLUIDA → CONCLUIDA_SUCESSO`.
3. Constante compartilhada de status + rótulos (arquivo puro, como `task-types-shared.ts`), para UI e servidor usarem a mesma lista.
4. De-para para o ProJuris na criação e na leitura.
5. Filtros de **status** e de **advogado** na agenda/calendário da distribuição.

---

## Acceptance Criteria

1. **Domínio novo no banco.** `system_case_tasks.status` aceita exatamente `EM_ANDAMENTO`, `CONCLUIDA_SUCESSO`, `CONCLUIDA_SEM_SUCESSO`, `CANCELADA`. Default = `EM_ANDAMENTO`. Nenhuma linha fica com valor fora do CHECK.
2. **Backfill sem perda.** Toda tarefa que era `PENDENTE` vira `EM_ANDAMENTO`; toda `CONCLUIDA` vira `CONCLUIDA_SUCESSO` (mantendo `completed_at`). A contagem total de tarefas antes e depois é idêntica.
3. **Concluída = qualquer uma das duas.** `completed_at` é preenchido quando o status vira `CONCLUIDA_SUCESSO` **ou** `CONCLUIDA_SEM_SUCESSO`, e limpo se voltar para `EM_ANDAMENTO`. `CANCELADA` **não** preenche `completed_at`.
4. **Nada mais some da lista de trabalho.** Onde hoje se filtra `!== CONCLUIDA` (aba Tarefas, contador da sidebar, controladoria, exceções, relatório de usuário), passa a valer "**não é concluída nem cancelada**" — ou seja, só `EM_ANDAMENTO` conta como trabalho aberto.
5. **UI do dossiê.** Em `CaseDossie`, o checkbox binário vira um seletor com os 4 status (mantendo o clique rápido para "Concluída com sucesso"). O rótulo mostrado é em português: Em andamento / Concluída com sucesso / Concluída sem sucesso / Cancelada.
6. **Filtro na aba Tarefas.** O select de status passa a listar os 4 valores novos (mais "Todos").
7. **Workflow continua disparando.** O gatilho `task_completed` (`src/rpc/dossie.ts:113`) dispara para **as duas** conclusões (com e sem sucesso) e **não** dispara para `CANCELADA`.
8. **ProJuris de-para.** Ao criar tarefa lá (`criar-tarefa.ts`), a situação enviada corresponde ao status do SHV (`EM_ANDAMENTO → 1/pendente`; conclusões → o código de concluída com `situacaoConcluida: true`). Ao ler de volta (`judicial-sync`, `processo-detalhe`), a situação do ProJuris é traduzida para o vocabulário novo.
9. **Agenda filtrável.** No calendário da distribuição existe filtro por **status da tarefa** e por **advogado/executor**; usuário comum vê só as suas, administrador vê de todos (mesma regra de visibilidade que já existe em `listDistributionTasksByDayFn`).
10. **Regressão.** `typecheck` + `lint` limpos, `db:types` regenerado, migration aplicada 2× (idempotente) e rollback simétrico testado. Parcelas e movimentos do motor **inalterados**.

---

## Tasks / Subtasks

### T1 — Migration + backfill (@data-engineer)
- [x] `supabase/migrations/20260826XXXX_case_tasks_status_projuris.sql`: dropar o CHECK antigo por nome dinâmico (molde: `20260722000001_tema_field_defs_boolean.sql`), **UPDATE de backfill**, criar o CHECK novo, trocar o DEFAULT. Ordem obrigatória: backfill **antes** do CHECK novo. (AC-1, AC-2)
- [x] Rollback simétrico em `supabase/rollbacks/`. Aplicar 2× via `npx tsx scripts/db-apply-pg.ts`. Regenerar `db:types`. (AC-10)

### T2 — Constante compartilhada (@dev)
- [x] `src/lib/task-status-shared.ts` (módulo **puro**, sem imports de servidor — mesma razão documentada em `task-types-shared.ts`): lista, tipo e `TASK_STATUS_LABEL`. Exportar helper `isConcluida(status)`. (AC-5, AC-6)

### T3 — Serviço + RPC (@dev)
- [x] `dossie-service.ts` — `setCaseTaskStatus`: `completed_at` para as duas conclusões, limpo em `EM_ANDAMENTO`, nulo em `CANCELADA`; evento da timeline com o rótulo novo. (AC-3)
- [x] `dossie-service.ts` — `listWorkItems`: trocar `.neq("status","CONCLUIDA")` por "não concluída e não cancelada"; item de checklist deixa de nascer `PENDENTE` (usar `EM_ANDAMENTO`). (AC-4)
- [x] `rpc/dossie.ts:113` — disparar `task_completed` para as duas conclusões, nunca para cancelada. (AC-7)

### T4 — UI (@dev)
- [x] `CaseDossie.tsx` — seletor de status. (AC-5)
- [x] `tarefas.tsx` — select com os 4 status. (AC-6)
- [x] `Sidebar.tsx:220`, `useControladoria.ts:91`, `useExceptions.ts:45`, `UserReportDialog.tsx:87` — usar o helper `isConcluida` + cancelada. (AC-4)
- [x] `CaseTimeline.tsx` / `CaseFeed.tsx` — texto do evento com o rótulo em português. (AC-5)

### T5 — ProJuris (@dev)
- [x] `criar-tarefa.ts` — mapear status do SHV para `codigoTarefaEventoSituacao` + `situacaoConcluida`. (AC-8)
- [x] `judicial-sync.ts` / `processo-detalhe.ts` — **decisão na execução: NÃO traduzir.** Esses dois gravam/exibem a situação da tarefa **do ProJuris** (`system_case_judicial_tasks.situacao` é espelho do sistema deles). Reescrever "Pendente" como "Em andamento" ali seria distorcer o dado da fonte. O de-para vale para a **escrita** (`task-situacao.ts`). (AC-8)

### T6 — Agenda (@dev)
- [x] `controladoria.distribuicao.calendario.tsx` — filtro de status + filtro de advogado (reusar `useExecutorMappings`, já montado ali). (AC-9)

### T7 — QA (@qa)
- [ ] Contagem de tarefas antes/depois do backfill idêntica; nenhum valor fora do CHECK. (AC-1, AC-2)
- [ ] Concluir com sucesso e sem sucesso: as duas fecham `completed_at` e as duas disparam workflow; cancelar não faz nem uma coisa nem outra. (AC-3, AC-7)
- [ ] Contador da sidebar e aba Tarefas não contam canceladas. (AC-4)
- [ ] Criar tarefa que espelha no ProJuris e conferir a situação lá. (AC-8)
- [ ] Parcelas (financeiro) e fila do motor continuam com seus PENDENTE intactos. (AC-10)

---

## Dev Notes

- **A ordem da migration importa.** Se criar o CHECK novo antes do UPDATE, ele falha com as linhas antigas. Backfill primeiro, sempre.
- **Por que remover PENDENTE:** decisão do owner. Uma tarefa distribuída **já é trabalho em andamento**; "pendente" e "em andamento" no SHV eram a mesma coisa na prática e confundiam o filtro.
- **`CANCELADA` é novidade de comportamento:** não é conclusão. Todo lugar que hoje pergunta "está concluída?" precisa passar a perguntar "está aberta?" — por isso o helper compartilhado, para não espalhar comparação de string.
- **ProJuris:** o código 1 = Pendente e o 2 = Concluída com sucesso estão confirmados no comentário de `criar-tarefa.ts:201-202`. O código de "concluída sem sucesso" **precisa ser confirmado** contra a API (ver `material/integracoes/projuris/application.wadl` e `sistema-hv/docs/referencia-api-projuris.md`) — se não for descoberto a tempo, enviar como concluída e registrar o "sem sucesso" na descrição, **sem travar a story**.
- **Nada de tocar em parcelas.** É o erro mais fácil de cometer aqui: um "substituir tudo" de `PENDENTE` quebraria o financeiro.

## Testing

- **DB:** migration 2× + rollback; verificação por `SELECT status, count(*)` antes e depois.
- **Fluxo:** criar tarefa, concluir com sucesso, reabrir, concluir sem sucesso, cancelar — conferindo timeline, contador e workflow em cada passo.
- **Integração:** uma tarefa real espelhada no ProJuris.

## Dependências

- **Independente** de MO1 (arquivos diferentes) — podem andar em paralelo.
- **W1** também toca `dossie-service`/`rpc/dossie` (rastro do workflow na tarefa): quem entrar depois re-lê o arquivo.
- **T1** toca `CaseDossie.tsx` (seletor de tipo por classe) — coordenar: os dois mexem no mesmo formulário de tarefa.

## File List

**Novos**
- `sistema-hv/supabase/migrations/20260826000001_case_tasks_status_projuris.sql` (+ rollback)
- `sistema-hv/src/lib/task-status-shared.ts`
- `sistema-hv/src/lib/projuris/task-situacao.ts` (de-para do status para a situação do ProJuris)

**Alterados**
- `sistema-hv/src/lib/dossie-service.ts`
- `sistema-hv/src/rpc/dossie.ts`
- `sistema-hv/src/components/cases/CaseDossie.tsx`
- `sistema-hv/src/components/cases/CaseTimeline.tsx` · `CaseFeed.tsx`
- `sistema-hv/src/routes/tarefas.tsx`
- `sistema-hv/src/components/hv/Sidebar.tsx`
- `sistema-hv/src/hooks/useControladoria.ts` · `useExceptions.ts`
- `sistema-hv/src/components/settings/UserReportDialog.tsx`
- `sistema-hv/src/lib/projuris/criar-tarefa.ts` · `judicial-sync.ts` · `processo-detalhe.ts`
- `sistema-hv/src/routes/controladoria.distribuicao.calendario.tsx`
- `sistema-hv/src/rpc/distribuicao.ts` (situação real na agenda do dia)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial; domínio de status definido pelo owner (sem PENDENTE) | @sm (River) |
| 2026-08-26 | v0.2 | **Implementada** (T1-T6). Migration `20260826000001` aplicada **2×** (idempotente) com prova antes/depois: 39 PENDENTE → EM_ANDAMENTO e 11 CONCLUIDA → CONCLUIDA_SUCESSO, `completed_at` preservado nas 11, total de 50 inalterado. Teste funcional no banco (transacional, devolve o dado ao original): o CHECK **recusa** o status antigo, aceita os 4 novos e o DEFAULT é EM_ANDAMENTO. `db:types` **não** precisou ser regenerado — a migration não mexeu em coluna (`status` já era `string`). Decisões da execução: (a) a leitura do ProJuris **não** é traduzida (é espelho do sistema deles) — o de-para vale para a escrita, em `projuris/task-situacao.ts`; (b) o código de "concluída SEM sucesso" no ProJuris **não foi confirmado** contra a API, então cai em concluída (código 2) e virou pendência do spike da FN2; (c) o filtro de situação no calendário lê o **snapshot do quadro** (`system_distribution_kanban_tasks`), porque o calendário lista o que o motor distribuiu e quem sabe se foi feita é o ProJuris. typecheck OK, eslint OK, `vite build` OK. **Falta o T7 na UI.** | @dev (via Orion) |

## QA Results

**Revisor:** @qa (Quinn) · **Data:** 2026-08-26 · **Parecer completo:** `QA-onda-1.md`

**FAIL na 1ª rodada → PASS após correção.** A varredura achou 3 pontos de leitura fora da lista da story (`controladoria.index.tsx:791` gravava um status que o CHECK recusa — P0; `users-service.ts:574` e `hoje.tsx:167` contavam concluída como pendente). Corrigidos com o helper `isTaskAberta` e revalidados: nenhuma ocorrência do domínio antigo sobrou no repositório. Banco conferido direto no Postgres (CHECK, backfill 39+11, total 50, idempotência, nenhuma view/função dependente).

**Gates reproduzidos pelo QA:** `typecheck` limpo · `eslint` limpo · `vite build` OK.
**Pendente:** passeio manual na UI (nenhum agente exercitou a tela).
