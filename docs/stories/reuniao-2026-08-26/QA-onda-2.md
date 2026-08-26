# QA — Onda 2 da reunião 2026-08-26 (L1, W1, N1, D1)

**Revisor:** @qa (Quinn) · **Data:** 2026-08-26 · **Escopo:** código não commitado, migrations `20260826000002` e `20260826000003` já aplicadas, backfill do Drive **executado em produção**

| Story | Gate (1ª rodada) | Gate (após correção) | Motivo |
|---|---|---|---|
| **L1** | ✅ PASS | ✅ **PASS** | Extração limpa; os filtros locais de cada componente foram preservados. |
| **W1** | ⚠️ CONCERNS | ✅ **PASS** | `move_stage` era a única ação que não carimbava a origem — corrigido. |
| **N1** | ✅ PASS | ✅ **PASS** | Mudança no `Breadcrumb` (36 telas) é retrocompatível. |
| **D1** | ⚠️ CONCERNS | ✅ **PASS** | O relatório do backfill mentia na reexecução — corrigido e reprovado na prática. |

---

## 🟠 P1 — corrigido nesta rodada

### QA-8 · A ação mais visível do workflow era a única sem assinatura
**Arquivo:** `sistema-hv/src/lib/workflow-engine.ts` (ação `move_stage`)

`write_comment` e `create_task` carimbavam o código; `move_stage` chamava
`moveCaseStatus(caseId, to, actor)` e pronto. Ou seja: o caso pulava de etapa
sozinho no kanban — que é justamente o que chama atenção — e a linha do tempo
não dizia que foi automação. O AC-3 pedia os três.

**Correção:** `updateCase` ganhou um `eventExtra` opcional (mesclado no `diff` do
evento, sem virar coluna) e `moveCaseStatus` um `workflowCode` opcional. O engine
passa `rule.code`. Chamadores existentes seguem idênticos — os dois parâmetros
são os últimos e opcionais.

### QA-9 · O relatório do backfill afirmava ter movido o que já estava lá
**Arquivo:** `sistema-hv/scripts/backfill-drive-auto-folder.ts`

Na 2ª execução o script dizia "arquivos movidos: 3" e "já estavam: 0" — o
contador `arquivosJaLa` nunca era incrementado (e o `--fix` do eslint até o
transformou em `const`, confirmando que era morto). Funcionalmente o move
repetido é no-op no Drive, mas o AC-9 promete "a segunda não faz nada" e o
relatório dizia o contrário. Em operação de arquivo de cliente, relatório que
mente é problema de verdade: é por ele que se decide se algo deu errado.

**Correção:** antes de mover, o script lista o que já está na subpasta e conta
como "já estava". **Reexecutado após a correção:**

```
subpastas criadas .... 0
subpastas já existiam  3
arquivos movidos ..... 0
arquivos já estavam .. 3
falhas ............... 0
```

Agora o AC-9 está comprovado na prática, não só na teoria.

---

## 🟡 Observações (não bloqueiam)

- **QA-10 · `proximoCodigo` sem retry em corrida.** A story previa "em caso de
  corrida, repetir a busca uma vez". Se dois admins criarem workflow no mesmo
  instante, o segundo INSERT falha no índice único e aparece erro genérico. O
  índice **protege o dado** (que era o essencial); o que falta é a mensagem boa.
  Probabilidade real: baixíssima (criação manual, por admin).
- **QA-11 · Ordenação lexicográfica do código.** `proximoCodigo` ordena `code`
  como texto. Funciona perfeitamente até `WF-9999`; no 10.000º workflow a
  ordenação passaria a errar. Registrado por honestidade, não por risco.
- **QA-12 · `--todos` ainda não foi exercido.** O backfill rodou no modo padrão
  (só casos com documento). Se o owner quiser a estrutura completa nas 409
  pastas, a flag existe mas nunca foi executada — e são 400+ chamadas ao Drive.

---

## ✅ O que foi verificado e está correto

**L1**
- O recorte da extração preservou o que era local de cada componente: o Feed
  continua filtrando `fin_*` **e** `note_added` (para não duplicar nota × evento);
  a Timeline continua filtrando `fin_*`. Nenhum comportamento sumiu junto.
- O `renderEventLabel` unificado é o **superset** (o do Timeline): eventos que no
  Feed caíam no `default` e apareciam como `action` crua (ex.: `fin_*`,
  `checklist_inconsistente`) agora têm frase — ganho colateral.
- `describeChangedFields` aceita os dois formatos de diff (o antigo e o `{from,to}`
  que a AU1 vai introduzir) — preparado sem quebrar o presente.

**W1** — evidência no banco:
- 8 regras receberam `WF-0001`…`WF-0008` na ordem de criação; migration reaplicada
  sem efeito (idempotente); índice único por `(organization_id, code)`.
- `created_by_workflow_id` com **ON DELETE SET NULL** — apagar a regra não apaga a
  tarefa que ela criou. É a escolha certa para rastro histórico.
- `updateWorkflowRule` trata todos os campos do payload de edição e **nunca**
  aceita `code`. O payload de edição não inclui `active`, então editar um
  workflow suspenso não o reativa por acidente.
- O achado do dev sobre o **strip silencioso do zod** (o `groupName` não estava no
  schema e sumiria sem erro) era real e está corrigido — confirmei o schema.

**N1**
- O `Breadcrumb` é usado em **36 telas** e nenhuma delas passa `search` hoje. Em
  JSX, prop ausente e `search={undefined}` chegam idênticas ao componente, então
  o comportamento das outras 35 telas não muda.

**D1**
- Separação manual × gerado confirmada no código: `uploadCaseDocument` continua em
  `ensureCaseFolder` (raiz); geração por modelo e retorno do ZapSign vão para
  `ensureCaseAutoFolder`.
- Os `drive_file_id` dos 3 documentos movidos continuam **os mesmos** de antes do
  move — prova de que foi move e não cópia (AC-8).
- A decisão do dev de **não** criar 406 subpastas vazias é acertada e está
  documentada com a flag de escape.

**Gates técnicos reproduzidos por mim:** `typecheck` limpo · `eslint` limpo nos
arquivos da onda · `vite build` OK.

---

## O que continua dependendo de gente

Nenhuma das 4 stories foi exercitada em navegador. Roteiro mínimo antes do uso real:

1. **W1** — criar um workflow (recebe WF-0009), colocá-lo num grupo, editar,
   suspender e reativar; disparar um que crie tarefa e comentário e conferir o
   código nos dois + na linha do tempo.
2. **L1** — mover um caso de etapa e ler a frase na ficha e no feed.
3. **N1** — entrar num caso pelo kanban do tema e voltar pelo caminho.
4. **D1** — gerar um documento (vai para a subpasta), anexar um manual (fica na
   raiz) e abrir um `drive_url` antigo dos 3 já movidos.

— Quinn, guardião da qualidade 🛡️
