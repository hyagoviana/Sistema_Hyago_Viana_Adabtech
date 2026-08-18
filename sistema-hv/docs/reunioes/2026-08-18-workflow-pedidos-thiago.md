# Workflows — retorno do Thiago (2026-08-18)

Dois refinamentos do #2 (Workflows) após o Thiago testar a fundação.

## Pedido B — seletor de kanban no gatilho ✅ FEITO (commit 3af4efd)

**Problema:** o dropdown de etapas do gatilho só puxava as etapas do Kanban Principal
e do Financeiro.

**Entregue:**
- Seletor de **Kanban** no builder (Principal / Financeiro / kanbans custom do tema),
  puxando as etapas do kanban escolhido (`useBoards` / `useBoardStages`).
- O gatilho **status_changed** passou a disparar também:
  - no **Financeiro** (`moveCaseStatusFinFn`) — `board_key = "fin"`;
  - nos **kanbans custom** (`moveCaseInBoardFn`) — `board_key = <boardId>`.
  - (antes só o Principal disparava.)
- Escopo por kanban no motor: `WorkflowCtx.boardKey` + `trigger_config.board_key`
  (ausente = `"op"`, mantém regras antigas iguais). `event_key = status:<board>:<slug>`.
- A **ação** "Mudar etapa" segue só no **Principal** (o motor move `macrostatus_op`);
  a UI avisa isso. Estender a ação para fin/custom fica como evolução futura.

**Limitação conhecida:** o disparo em kanban custom cobre a **mudança de etapa dentro
do board** (`moveCaseInBoard`). Entrar no board já numa etapa (`addCaseToBoard`) ainda
não dispara — revisitar se necessário.

## Pedido A — sub-opção de TIPO no gatilho (ÉPICO — planejado, não iniciado)

**Pedido:** cada gatilho ter uma "sub-opção". Ex.: "Tarefa criada" → escolher **qual
tipo de tarefa** ativa o gatilho, reaproveitando os tipos de tarefa da controladoria
para padronizar.

**Diagnóstico:**
- As tarefas do caso (`system_case_tasks`) **não têm campo de tipo** hoje (só title,
  description, status, priority, assignee, due_date).
- Os "tipos da controladoria" = `system_task_type_mapping` (tipos de manifestação/tarefa
  do ProJuris, com pontuação) — hoje pensados para o **motor de distribuição**, não para
  as tarefas do dossiê do caso.

**Por que é um épico (precisa decisão do owner):**
1. **Fonte dos tipos:** adotar `system_task_type_mapping` como catálogo de tipos das
   tarefas do caso? Ou criar uma tabela própria de "tipos de tarefa" (desacoplada do
   ProJuris)? Decisão de modelagem.
2. **Campo na tarefa:** adicionar `task_type_id` (FK) em `system_case_tasks` +
   migration; expor o tipo no formulário de criação/edição de tarefa do caso.
3. **Sub-opção no gatilho:** `trigger_config.task_type_id` no builder (dropdown de
   tipos) + filtro no motor (`task_created`/`task_completed` só disparam quando o tipo
   casa).
4. **Retrocompat:** tarefas sem tipo continuam disparando os gatilhos sem filtro de tipo.

**Sequência sugerida quando aprovado:** (1) bater o martelo na fonte dos tipos →
(2) migration + campo na tarefa + UI de criação → (3) sub-opção no gatilho + filtro no
motor. Conecta com a organização da **controladoria** (o Thiago citou padronização).
