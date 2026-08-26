# Story T1: Tipo de tarefa — uma configuração só + escolher pela CLASSE em todo seletor

**Épico:** Reunião 2026-08-26 · **ID:** T1 (itens 2 e 13-a do owner) · **Onda:** 1 · **Status:** Draft
**Executor:** @dev · Quality gate: @qa
**Risco:** MÉDIO — some uma tela que o time já usa. Sem migration.

---

## Story

**Como** quem cria tarefa (no caso, no workflow ou distribuindo no motor),
**quero** escolher primeiro a **classe** (Judicial / Administrativo / Comercial / Financeiro) e só então o **tipo**,
**para que** a lista pare de despejar tudo de uma vez — e **quero uma configuração só** de tipo de tarefa, não duas.

Thiago: "eu vou primeiro selecionar, eu quero ver quais são as tarefas da classe administrativo, da classe comercial. Aí eu clico, aí vai aparecer as tarefas que são dessa classe, a lista, mais limpa." E sobre a duplicidade: "tá uma configuração aqui, uma lá — jogar para um só."

**Decisão do owner:** sobrevive **`/configuracoes/tipos-tarefa`**. A aba do motor vira atalho.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **A classe já está no banco.** `system_task_type_mapping.classe` com CHECK `JUDICIAL/ADMINISTRATIVO/COMERCIAL/FINANCEIRO` (migration `20260824000001_task_types_entity_e_motor_staging.sql`).
- **Constantes prontas e puras:** `src/lib/task-types-shared.ts` — `TASK_TYPE_CLASSES`, `TASK_TYPE_CLASSE_LABEL`, interface `TaskType`. **É o arquivo que as rotas devem importar** (o serviço puxa `auth-guard` e não pode ir para o bundle do cliente — está documentado no cabeçalho dele).
- **Tela vencedora — `/configuracoes/tipos-tarefa`** (`src/routes/configuracoes.tipos-tarefa.tsx`, 631 linhas). Já faz **tudo**: criar, editar, arquivar/restaurar, classe, pontos, prazos, `aparece_no_motor`, `sync_projuris`, exclusivo geral e exceções por tema, **sincronizar com o ProJuris** (`useSyncTaskTypes`, linha 41/70) e **criar tipo lá** (`useCriarTipoNoProjuris`).
- **Tela a ser aposentada — `/controladoria/distribuicao/tipos-tarefa`** (436 linhas): usa `useTaskTypeMappings`, `useUpsertTaskTypeMapping`, `useSyncTaskTypes`, `useExecutorMappings`. **Não tem nada que a outra não tenha** (conferido campo a campo: complexidade, temporal, pontos, executor exclusivo).
- **Seletores de tipo de tarefa hoje (os 5 pontos):**
  - `src/components/cases/CaseDossie.tsx` — criar tarefa no caso.
  - `src/routes/configuracoes.workflows.tsx:175` — sub-opção "só quando a tarefa é do tipo X".
  - `src/routes/controladoria.distribuicao.andamentos.tsx` — distribuir tarefa a partir do andamento.
  - `src/routes/controladoria.distribuicao.a-distribuir.tsx` — editar o tipo antes de rodar o motor.
  - `src/routes/controladoria.distribuicao.lista.tsx` — filtro da lista.
- **Nav do motor:** `src/routes/controladoria.distribuicao.tsx:58` (aba "Tipos Tarefa", grupo Configuração).

### NOVO

1. **Componente único de seleção** `TaskTypePicker` (dois selects encadeados: Classe → Tipo, com opção **Todas** na classe), usado nos 5 pontos.
2. **Aba do motor vira atalho**: a rota `/controladoria/distribuicao/tipos-tarefa` passa a **redirecionar** para `/configuracoes/tipos-tarefa` (mantendo o link antigo funcionando para quem tem favorito).
3. **Agrupamento visual por classe** também na própria tela de configuração (lista agrupada, não uma sopa alfabética).

---

## Acceptance Criteria

1. **Uma configuração só.** Existe **uma** tela de cadastro de tipo de tarefa: `/configuracoes/tipos-tarefa`. A antiga rota do motor **redireciona** para ela (sem erro 404, sem tela duplicada). A aba na navegação do motor passa a apontar para a tela de configurações.
2. **Nada se perde.** Todos os campos que a tela do motor editava continuam editáveis na tela vencedora: pontos, complexidade, nível temporal, executor exclusivo, sincronizar com ProJuris.
3. **Seleção em dois passos.** Em cada um dos 5 seletores: primeiro **Classe**, depois **Tipo**. Ao escolher uma classe, a lista de tipos mostra **só** os daquela classe. Existe a opção **Todas** na classe, que mostra a lista completa.
4. **É filtro, não regra.** Não há bloqueio de negócio: qualquer tipo pode ser escolhido; a classe só organiza a visualização (o Thiago foi explícito: "é só um filtro da visualização, só porque fica mais intuitivo").
5. **Tipo sem classe não some.** Tipos com `classe = NULL` aparecem sob **Sem classe** quando a seleção é "Todas".
6. **Motor respeita `aparece_no_motor`.** Nos seletores dentro do motor (andamentos, a distribuir, lista), continuam listados **apenas** os tipos com `aparece_no_motor = true` — a classe filtra **dentro** desse conjunto.
7. **Agrupamento na tela de configuração.** A lista de tipos é exibida agrupada por classe, com contagem por grupo.
8. **Regressão.** `typecheck` + `lint` limpos; distribuir uma tarefa continua funcionando ponta a ponta (motor → aprovação → ProJuris); o gatilho de workflow por tipo continua funcionando.

---

## Tasks / Subtasks

### T1 — Componente compartilhado (@dev)
- [ ] `src/components/hv/TaskTypePicker.tsx`: props `value`, `onChange`, `somenteMotor?: boolean`, `disabled?`. Importa **só** de `task-types-shared.ts` e do hook de catálogo. Estado interno da classe; "Todas" como padrão. (AC-3, AC-4, AC-5, AC-6)

### T2 — Trocar os 5 seletores (@dev)
- [ ] `CaseDossie.tsx` (criar tarefa do caso). (AC-3)
- [ ] `configuracoes.workflows.tsx:175` (sub-opção do gatilho). (AC-3)
- [ ] `controladoria.distribuicao.andamentos.tsx` (distribuir). (AC-3, AC-6)
- [ ] `controladoria.distribuicao.a-distribuir.tsx` (editar antes de rodar). (AC-3, AC-6)
- [ ] `controladoria.distribuicao.lista.tsx` (filtro). (AC-3, AC-6)

### T3 — Aposentar a tela duplicada (@dev)
- [ ] Antes de apagar, **conferir campo a campo** a tela antiga contra a nova e anotar no PR o que foi verificado. (AC-2)
- [ ] `controladoria.distribuicao.tipos-tarefa.tsx` vira redirect para `/configuracoes/tipos-tarefa`. (AC-1)
- [ ] `controladoria.distribuicao.tsx:58` — a aba "Tipos Tarefa" passa a levar para a tela de configurações (mantendo o item visível no grupo Configuração, que é onde o time procura). (AC-1)

### T4 — Agrupamento na configuração (@dev)
- [ ] `configuracoes.tipos-tarefa.tsx`: lista agrupada por classe com contador. (AC-7)

### T5 — QA (@qa)
- [ ] Abrir a URL antiga: cai na nova. (AC-1)
- [ ] Editar pontos/complexidade/executor exclusivo na tela nova e conferir que o motor usa o valor. (AC-2)
- [ ] Nos 5 seletores: escolher classe filtra; "Todas" mostra tudo, inclusive sem classe. (AC-3, AC-5)
- [ ] Um tipo com `aparece_no_motor = false` não aparece nos seletores do motor, mas aparece no caso e no workflow. (AC-6)
- [ ] Distribuição ponta a ponta + gatilho de workflow por tipo. (AC-8)

---

## Dev Notes

- **Por que a tela de configurações venceu:** ela é a do doc 21.08 (tipo de tarefa como entidade do sistema) e **já tem tudo**, incluindo o sync com o ProJuris. A do motor é a versão antiga, de quando tipo de tarefa era "coisa do motor".
- **Import-protection:** a rota **não pode** importar `task-types-service.ts` (puxa `auth-guard` → servidor no bundle do cliente). Use `task-types-shared.ts`. Está escrito no cabeçalho do arquivo e já quebrou o build antes.
- **Redirect em vez de deletar a rota:** o time do Thiago tem link salvo e vai clicar nele na sexta. Redirecionar é mais barato que explicar 404.
- **Cuidado com `aparece_no_motor`:** a classe é uma segunda camada de filtro. As duas convivem — nunca substituir uma pela outra.

## Testing

- **UI:** os 5 seletores + tela de configuração agrupada.
- **Integração:** distribuir tarefa de teste; workflow com filtro de tipo.
- **Gates:** typecheck + lint.

## Dependências

- **TK1** também toca `CaseDossie.tsx` (status). Se as duas andarem juntas, TK1 entra depois e re-lê o arquivo.
- **W1** toca `configuracoes.workflows.tsx`. Mesma regra.
- **T2** (centralizar tema/vínculo) mexe na mesma nav `controladoria.distribuicao.tsx` — fazer T1 primeiro, T2 depois.

## File List

**Novos**
- `sistema-hv/src/components/hv/TaskTypePicker.tsx`

**Alterados**
- `sistema-hv/src/routes/controladoria.distribuicao.tipos-tarefa.tsx` (vira redirect)
- `sistema-hv/src/routes/controladoria.distribuicao.tsx` (destino da aba)
- `sistema-hv/src/routes/configuracoes.tipos-tarefa.tsx` (agrupamento)
- `sistema-hv/src/components/cases/CaseDossie.tsx`
- `sistema-hv/src/routes/configuracoes.workflows.tsx`
- `sistema-hv/src/routes/controladoria.distribuicao.andamentos.tsx`
- `sistema-hv/src/routes/controladoria.distribuicao.a-distribuir.tsx`
- `sistema-hv/src/routes/controladoria.distribuicao.lista.tsx`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial; owner confirmou a tela de Configurações como sobrevivente | @sm (River) |
