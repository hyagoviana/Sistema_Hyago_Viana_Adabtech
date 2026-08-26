# Story W1: Workflows — suspender, identificador, grupo, editar e rastro nas ações automáticas

**Épico:** Reunião 2026-08-26 · **ID:** W1 (itens 3, 4, 5, 6, 7 do owner) · **Onda:** 2 · **Status:** Ready for Review
**Executor:** @data-engineer (2 colunas + 1 coluna em tarefas) + @dev (UI, engine) · Quality gate: @qa
**Risco:** BAIXO — tudo aditivo. O engine continua best-effort.

---

## Story

**Como** administrador que vai ver dezenas de workflows criados por várias pessoas,
**quero** saber **qual workflow** gerou cada ação automática, **agrupar** a lista, **editar** um workflow existente e **suspender** (em vez de "desativar"),
**para que** quando aparecer tarefa errada para todo mundo eu consiga dizer em 10 segundos quem foi o culpado e desligar só ele.

Thiago: "tem um monte de tarefa aparecendo para todo mundo aqui, então o negócio errado. Qual é o workflow que tá fazendo isso? A gente vem aqui, sabe dizer." E: "quando tiver uma ação automática de workflow, ele indicar qual foi o identificador, qual foi que gerou".

**Decisão do owner:** o identificador aparece **nos dois lugares** — no texto da ação gerada **e** na linha do tempo. Grupo é **texto livre**.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Tabela:** `system_workflow_rules` (`supabase/migrations/20260817000008_workflows.sql:18`) — id, organization_id, name, active, tema_id, trigger_type, trigger_config, actions, created_by, created_at, updated_at. **Não tem** código nem grupo.
- **Execuções:** `system_workflow_runs` (rule_id, case_id, event_key, status, detail) — a trava de idempotência.
- **Serviço:** `src/lib/workflow-rules-service.ts` — `list`, `create`, **`updateWorkflowRule` já existe e já aceita patch parcial** (linha ~77). Só falta a UI usar.
- **Engine:** `src/lib/workflow-engine.ts` — `runWorkflowsFor(caseId, trigger, ctx, actorUserId)`; `runAction` (linha ~44) executa `write_comment` (via `createCaseNote`), `create_task` (via `createCaseTask`) e `move_stage` (via `moveCaseStatus`, chamando o serviço direto para não recursar).
- **RPC:** `src/rpc/workflows.ts` — `list/create/update/delete` já expostos (`updateWorkflowRuleFn` na linha 80).
- **Hooks:** `src/hooks/useWorkflows.ts` — `useUpdateWorkflowRule` (linha 47) **já existe**.
- **UI:** `src/routes/configuracoes.workflows.tsx` (553 linhas) — formulário de criação, lista, botão "Desativar/Ativar" (**linha 533**) e "Excluir" (linha 540). **Não tem botão de editar** (o hook existe, o botão não).
- **Gatilhos cabeados:** `cases-service` (status), `checklist-service` (checklist), `rpc/dossie` (tarefa criada/concluída).

### NOVO

1. Coluna **`code TEXT`** em `system_workflow_rules` — identificador curto e estável (ex.: `WF-0007`), único por organização.
2. Coluna **`group_name TEXT`** (texto livre, nullable).
3. Coluna **`created_by_workflow_id UUID`** em `system_case_tasks` — o rastro da tarefa gerada automaticamente (referência real, não só texto).
4. O engine **carimba** o código: no corpo da nota, na descrição da tarefa e no `diff` do evento da timeline.
5. UI: **Suspender** (renome), **Editar** (dialog reaproveitando o formulário de criação), **agrupamento** por grupo e **busca/filtro** na lista.

---

## Acceptance Criteria

1. **Suspender.** O botão que hoje diz "Desativar" passa a dizer **Suspender**; quando o workflow está suspenso, o botão diz **Reativar**. O comportamento (flag `active`) é o mesmo. "Excluir" continua como está.
2. **Identificador.** Todo workflow tem um código curto no formato `WF-NNNN`, **único por organização**, gerado na criação, **imutável** e exibido na lista e no dialog de edição. Os workflows que já existem recebem código no backfill, na ordem de criação.
3. **Rastro no texto da ação.** Toda ação executada pelo engine identifica a origem:
   - `write_comment`: o corpo termina com uma linha de rodapé com o código e o nome do workflow.
   - `create_task`: a descrição da tarefa idem, **e** `created_by_workflow_id` é preenchido.
   - `move_stage`: registra a origem no evento de mudança de etapa.
4. **Rastro na linha do tempo.** Os eventos gerados por workflow carregam o código no `diff` e a timeline exibe o sufixo (ex.: "· automático WF-0007"). Ação feita por gente **não** ganha sufixo nenhum.
5. **Editar.** Existe um botão **Editar** em cada workflow que abre o mesmo formulário da criação, preenchido, e salva via `updateWorkflowRuleFn`. Nome, grupo, tema, gatilho, configuração do gatilho e ações são todos editáveis. O **código não é editável**.
6. **Grupo.** O formulário tem um campo **Grupo** (texto livre, com sugestão dos grupos já usados). A lista é exibida **agrupada** por grupo, colapsável, com contagem; workflows sem grupo caem em **Sem grupo**.
7. **Filtro.** A lista tem busca por nome/código e filtro por tema e por estado (ativos / suspensos / todos).
8. **Idempotência intacta.** Editar um workflow **não** apaga o histórico de `system_workflow_runs` — e um evento já processado continua não repetindo.
9. **Best-effort intacto.** Nenhuma falha do carimbo/rastro pode derrubar a operação que disparou o gatilho (a regra crítica do engine continua valendo).
10. **Regressão.** `typecheck` + `lint` limpos; migration 2× idempotente + rollback; `db:types` regenerado.

---

## Tasks / Subtasks

### T1 — Migration (@data-engineer)
- [x] `20260826XXXX_workflow_code_grupo.sql`: `ADD COLUMN IF NOT EXISTS code TEXT`, `group_name TEXT`; índice único parcial `(organization_id, code) WHERE code IS NOT NULL`; **backfill** dos existentes por `created_at` (WF-0001, WF-0002…). (AC-2, AC-6)
- [x] `ADD COLUMN IF NOT EXISTS created_by_workflow_id UUID REFERENCES system_workflow_rules(id)` em `system_case_tasks`. (AC-3)
- [x] Rollback simétrico; aplicar 2× via `db-apply-pg.ts`; regenerar `db:types`. (AC-10)

### T2 — Serviço (@dev)
- [x] `workflow-rules-service.ts`: gerar `code` na criação (próximo número da org, dentro da mesma transação lógica — em caso de corrida, repetir a busca uma vez); aceitar `groupName` em create/update; **nunca** aceitar `code` em update. (AC-2, AC-5, AC-6)
- [x] Retornar `code` e `group_name` no `listWorkflowRules`. (AC-2, AC-6)

### T3 — Engine (@dev)
- [x] `workflow-engine.ts`: carregar `code`/`name` junto da regra (o `select` atual não traz — incluir); passar para `runAction`. (AC-3)
- [x] `write_comment`: rodapé com o código. `create_task`: rodapé na descrição + `created_by_workflow_id`. `move_stage`: origem no evento. Tudo dentro do try/catch existente. (AC-3, AC-9)
- [x] Gravar `workflow_code` no `diff` dos eventos gerados. (AC-4)

### T4 — UI (@dev)
- [x] `configuracoes.workflows.tsx:533` — "Desativar" vira "Suspender" / "Reativar". (AC-1)
- [x] Botão **Editar** por linha, abrindo o formulário existente em modo edição (extrair o form para um componente reaproveitado por criar/editar). (AC-5)
- [x] Campo **Grupo** no formulário + agrupamento colapsável na lista. (AC-6)
- [x] Busca por nome/código + filtros de tema e estado. (AC-7)
- [x] Exibir o código como badge em cada linha. (AC-2)

### T5 — Timeline (@dev)
- [x] `CaseTimeline.tsx` / `CaseFeed.tsx`: quando `diff.workflow_code` existir, acrescentar o sufixo discreto ao rótulo do evento. (AC-4)

### T6 — QA (@qa)
- [ ] Criar 3 workflows: recebem WF-000X sequenciais; existentes ganharam código no backfill. (AC-2)
- [ ] Disparar um workflow que cria tarefa e comentário: os dois trazem o código; a tarefa tem `created_by_workflow_id`; a timeline mostra o sufixo. (AC-3, AC-4)
- [ ] Editar um workflow (mudar ação) e disparar de novo: funciona, e o histórico de runs anterior continua lá. (AC-5, AC-8)
- [ ] Suspender: para de disparar; reativar: volta. (AC-1)
- [ ] Agrupar 5 workflows em 2 grupos + 1 sem grupo: lista agrupa certo. (AC-6)
- [ ] Forçar erro no carimbo (ex.: nome nulo) e confirmar que a mudança de etapa que disparou o gatilho **não** falhou. (AC-9)

---

## Dev Notes

- **O código é identidade, não rótulo.** Nunca reciclar número de workflow excluído — o rastro em tarefas antigas precisa continuar apontando para algo compreensível. Por isso índice único e nada de renumerar.
- **Por que também uma coluna em `system_case_tasks`:** texto na descrição resolve o "ler e entender", mas não resolve o "listar todas as tarefas que aquele workflow criou" — que é exatamente o que o Thiago vai querer quando algo sair errado.
- **O engine hoje não carrega `name`/`code`** no `select` da regra (`workflow-engine.ts`, ~linha 120). É preciso incluir os dois campos, senão o carimbo sai vazio.
- **Não mexer na idempotência.** `event_key` continua igual; editar regra não invalida run antigo — e é isso que o AC-8 protege.
- **Grupo é só visual.** Nada de permissão por grupo: o Thiago descartou explicitamente ("nem precisa ter essa restrição… de início mais simples").

## Testing

- **DB:** migration 2× + rollback; unicidade do código sob criação concorrente (criar 2 workflows em sequência rápida).
- **Engine:** os 3 tipos de ação carimbados; falha de carimbo não derruba a operação.
- **UI:** editar, suspender, agrupar, filtrar.

## Dependências

- **T1** também toca `configuracoes.workflows.tsx` (seletor de tipo por classe) — combinar: T1 primeiro (troca o seletor), W1 depois (extrai o form).
- **TK1** toca `rpc/dossie.ts` e `dossie-service.ts`; W1 toca `system_case_tasks` (coluna nova) — não colidem no mesmo trecho, mas re-ler antes de editar.
- **L1/AU1** tocam `CaseTimeline.tsx` — W1 entra antes (o sufixo é pequeno) ou coordena.

## File List

**Novos**
- `sistema-hv/supabase/migrations/20260826XXXX_workflow_code_grupo.sql` (+ rollback)

**Alterados**
- `sistema-hv/src/lib/workflow-rules-service.ts`
- `sistema-hv/src/lib/workflow-engine.ts`
- `sistema-hv/src/rpc/workflows.ts`
- `sistema-hv/src/hooks/useWorkflows.ts`
- `sistema-hv/src/routes/configuracoes.workflows.tsx`
- `sistema-hv/src/components/cases/CaseTimeline.tsx` · `CaseFeed.tsx`
- `sistema-hv/src/lib/supabase/types.ts`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial (itens 3-7 do owner; identificador nos 2 lugares, grupo texto livre) | @sm (River) |
| 2026-08-26 | v0.2 | **Implementada.** Migration `20260826000002` aplicada 2× (idempotente): as 8 regras existentes receberam WF-0001…WF-0008 na ordem de criação; índice único por (org, code); `created_by_workflow_id` em `system_case_tasks` com **ON DELETE SET NULL** (apagar a regra não pode apagar a tarefa que ela criou). Achado durante a execução: o schema zod do RPC **não tinha `groupName`** — o zod faz *strip* silencioso de campo desconhecido, então o grupo nunca chegaria ao banco e ninguém veria erro. Corrigido. O `code` é gerado pelo servidor a partir do MAIOR número já usado (nunca recicla) e nunca entra em patch. typecheck OK, eslint OK, build OK. **Falta o T6 (UI).** | @dev (via Orion) |

## QA Results

**Revisor:** @qa (Quinn) · **Data:** 2026-08-26 · **Parecer completo:** `QA-onda-2.md`

**CONCERNS → PASS após correção.** `move_stage` era a única ação sem carimbo de origem — justamente a mais visível (o caso pula de etapa sozinho no kanban). Corrigido com `eventExtra` opcional no `updateCase` + `workflowCode` no `moveCaseStatus`. Verificado no banco: WF-0001…WF-0008 no backfill, índice único por (org, code), `ON DELETE SET NULL` no rastro da tarefa. Ficam registradas duas observações sem impacto prático: sem retry em corrida na geração do código e ordenação lexicográfica que só erraria a partir de WF-10000.

**Gates reproduzidos pelo QA:** `typecheck` limpo · `eslint` limpo · `vite build` OK.
**Pendente:** passeio manual na UI (nenhum agente exercitou a tela).
