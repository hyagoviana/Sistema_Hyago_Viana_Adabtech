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

## Pedido A — sub-opção de TIPO no gatilho (PROPOSTA p/ decisão — 2026-08-18)

**Pedido:** cada gatilho ter uma "sub-opção". Ex.: "Tarefa criada" → escolher **qual
tipo de tarefa** ativa o gatilho, reaproveitando os tipos da controladoria p/ padronizar.

**Fato técnico:** as tarefas do caso (`system_case_tasks`) **não têm campo "tipo"** hoje.
Então, antes da sub-opção no gatilho, a tarefa precisa passar a ter um **tipo** vindo de
um **catálogo padronizado**. A única decisão de fundo é: **qual catálogo.**

### A ÚNICA decisão do Thiago: a fonte dos tipos

**Opção 1 — Reusar os tipos da controladoria (`system_task_type_mapping`).**
São os tipos de **manifestação do ProJuris** (têm nome/`projuris_tipo_descricao`,
pontuação, complexidade). 
- ✅ Padronização única; já conecta com a pontuação/motor da controladoria.
- ⚠️ O vocabulário é de **manifestações do ProJuris** (intimações). Se as tarefas que
  vocês criam manualmente no caso (ex.: "elaborar petição", "reunião com cliente",
  "protocolar") **não** estiverem nessa lista, não haverá tipo pra elas.

**Opção 2 — Catálogo próprio de tipos de tarefa (`system_case_task_types`).**
Lista simples e editável em Configurações (nome, ativo, ordem), com o vocabulário do
escritório.
- ✅ Livre e desacoplado; cobre qualquer tarefa interna.
- ⚠️ É mais uma lista pra manter; não herda a pontuação da controladoria (a não ser que
  a gente mapeie depois).

**Opção 3 (RECOMENDADA) — Catálogo próprio + vínculo OPCIONAL ao tipo da controladoria.**
`system_case_task_types` com um campo opcional `task_type_mapping_id`. Começa simples
(vocabulário do escritório) e, quando quiserem, "casa" cada tipo com o da controladoria
p/ herdar pontuação. Junta o melhor das duas sem travar nada.

> **Pergunta única pro Thiago:** os tipos da controladoria (manifestações do ProJuris)
> cobrem TODAS as tarefas que vocês criam manualmente num caso? Se **sim** → Opção 1
> (mais rápido). Se **não / na dúvida** → Opção 3 (recomendada).

### Build (rápido) assim que ele decidir
1. Migration: campo `task_type_id` (FK) em `system_case_tasks` + (se Opção 2/3) tabela
   `system_case_task_types` (+ CRUD em Configurações).
2. Formulário de tarefa (`CaseDossie.tsx`): dropdown de tipo (opcional).
3. Builder de workflow: sub-opção `trigger_config.task_type_id` nos gatilhos
   `task_created` / `task_completed` (dropdown de tipos).
4. Motor (`workflow-engine.ts`): filtro — só dispara quando o tipo da tarefa casa
   (tarefa sem tipo continua disparando as regras sem filtro de tipo · retrocompat).
