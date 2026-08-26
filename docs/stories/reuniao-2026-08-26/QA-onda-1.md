# QA — Onda 1 da reunião 2026-08-26 (MO1, TK1, T1)

**Revisor:** @qa (Quinn) · **Data:** 2026-08-26 · **Escopo:** código não commitado + migration `20260826000001` já aplicada em produção (dev = prod)

| Story | Gate (1ª rodada) | Gate (após correção) | Motivo |
|---|---|---|---|
| **MO1** | ✅ PASS | ✅ **PASS** | Faz o que promete; nenhum efeito colateral encontrado. |
| **TK1** | ❌ FAIL | ✅ **PASS** | 3 pontos de leitura esquecidos — corrigidos e revalidados. |
| **T1** | ⚠️ CONCERNS | ✅ **PASS** | Defeito do `TaskTypePicker` corrigido e revalidado. |

**Status final da onda 1: PASS**, com o T7/T5 (passeio manual na UI) ainda em aberto nas três stories — nenhuma delas foi exercitada em navegador.

> O risco que a própria story TK1 declarou — *"o risco não é conceitual, é de esquecer um ponto de leitura"* — se materializou. A lista de pontos na story tinha 6 arquivos; o código tem **9**.

---

## 🔴 P0 — quebra em produção

### QA-1 · Concluir tarefa pela Controladoria viola o CHECK do banco
**Arquivo:** `sistema-hv/src/routes/controladoria.index.tsx:791`

```ts
markDone.mutate({ id: t.id, status: "CONCLUIDA" });
```

`CONCLUIDA` **não existe mais** no domínio. O CHECK novo aceita apenas
`EM_ANDAMENTO | CONCLUIDA_SUCESSO | CONCLUIDA_SEM_SUCESSO | CANCELADA`.

**Como reproduzir:** Controladoria → lista de tarefas → botão de concluir.
**Resultado esperado:** tarefa concluída. **Resultado real:** erro de constraint (23514), a tarefa não fecha e o usuário vê falha genérica.
**Correção:** trocar por `CONCLUIDA_SUCESSO` (o clique rápido equivale a "concluída com sucesso", mesma decisão já tomada em `CaseDossie`).

---

## 🟠 P1 — número errado na cara do usuário

### QA-2 · Relatório do colaborador conta tarefa concluída como pendente
**Arquivo:** `sistema-hv/src/lib/users-service.ts:574`

```ts
tarefas_pendentes: tarefas.filter((t) => t.status !== "CONCLUIDA").length,
```

Como nenhuma tarefa tem mais o status `CONCLUIDA`, **todas** entram na conta —
inclusive as 11 concluídas. O relatório que o admin abre em Permissões passa a
mentir para cima.
**Correção:** `isTaskAberta(t.status)` (helper já criado na própria story).

### QA-3 · Tela "Hoje" lista tarefas concluídas como se fossem do dia
**Arquivo:** `sistema-hv/src/routes/hoje.tsx:167`

```ts
(t) => t.status !== "CONCLUIDA" && (t.assignee_id === userId || !t.assignee_id)
```

Mesma causa. É a **primeira tela** que o time abre de manhã — o efeito é visível
para todo mundo já na sexta.
**Correção:** `isTaskAberta(t.status)`.

### QA-4 · `TaskTypePicker` pode distribuir com o tipo errado
**Arquivo:** `sistema-hv/src/components/hv/TaskTypePicker.tsx`

```ts
onValueChange={(v) => {
  setClasse(v);
  if (value && !(tipos ?? []).some((t) => t.id === value)) onChange(null);
}}
```

A intenção está no comentário do próprio código ("deixar um id invisível
selecionado é o tipo de coisa que faz a pessoa distribuir a tarefa errada"), mas
a checagem roda contra `tipos` da classe **anterior** — o valor escolhido está
sempre nela, então **nunca limpa**. Depois do refetch, o tipo selecionado pode
não estar mais na lista: o Select mostra o placeholder, o estado continua
preenchido, e "Distribuir tarefa" envia o tipo antigo.

**Como reproduzir:** Andamentos → classe "Todas" → escolher um tipo Judicial →
trocar a classe para "Comercial" → o campo parece vazio → clicar em Distribuir.
**Correção sugerida:** limpar a seleção sempre que a classe mudar para uma classe
específica, ou validar contra a lista já filtrada (`lista`) num efeito.

---

## 🟡 Observações (não bloqueiam)

- **QA-5 · Sem runner de teste.** Existem 9 arquivos `*.test.ts` no projeto e **nenhum runner instalado** (`npm test` não existe; vitest/jest não estão nas dependências). Dívida **pré-existente**, não introduzida por esta onda — mas é o motivo de os 3 bugs acima só aparecerem em leitura humana. Vale uma story própria.
- **QA-6 · `system_case_tasks_active`** (view) lista colunas explicitamente e **não** inclui `task_type_id`. Hoje ninguém a consome (só aparece em `types.ts`), então é inerte — mas quem for usá-la vai tropeçar.
- **QA-7 · MO1 AC-3** fala em "Arquivar / **Desarquivar** / Distribuir" para intimação; a UI só oferece **Arquivar**. Divergência entre story e tela é **anterior** a esta onda (o desarquivar existe no writeback, não na tela).

---

## ✅ O que foi verificado e está correto

**Banco (TK1)** — evidência coletada direto no Postgres:
- CHECK ativo: `status = ANY (EM_ANDAMENTO, CONCLUIDA_SUCESSO, CONCLUIDA_SEM_SUCESSO, CANCELADA)`.
- Backfill: 39 → `EM_ANDAMENTO`, 11 → `CONCLUIDA_SUCESSO`, `completed_at` preservado nas 11, total 50 (idêntico ao pré-migration).
- Migration reaplicada: idempotente.
- **Nenhuma view ou função do banco** filtra por status de tarefa → sem quebra silenciosa no lado do SQL.
- `system_parcelas` e `system_distribution_movements` (que também usam "PENDENTE") **intactos** — confirmado por leitura dos arquivos que os manipulam.

**Código**
- `isTaskConcluida` / `isTaskAberta` centralizam a regra; `listWorkItems` deriva o filtro do domínio em vez de comparar string.
- Workflow `task_completed` dispara nas duas conclusões e **não** dispara em `CANCELADA`.
- Timeline: evento antigo (sem `status_label`) cai no fallback sem quebrar.
- MO1: `origem` já vinha do serviço; `INICIAL_SHV` protegido do filtro — decisão acertada e documentada.
- T1: complexidade e temporalidade migradas **antes** do redirect (o AC-2 teria sido violado sem isso); RPC já aceitava os dois campos.
- Gates técnicos reproduzidos por mim: `typecheck` limpo, `eslint` limpo, `vite build` OK.

---

## Correção e revalidação (mesma sessão)

| Achado | Correção aplicada | Arquivo |
|---|---|---|
| QA-1 (P0) | `CONCLUIDA` → `CONCLUIDA_SUCESSO` | `routes/controladoria.index.tsx` |
| QA-2 (P1) | `!== "CONCLUIDA"` → `isTaskAberta(...)` | `lib/users-service.ts` |
| QA-3 (P1) | `!== "CONCLUIDA"` → `isTaskAberta(...)` | `routes/hoje.tsx` |
| QA-4 (P1) | comparação passa a ser pela **classe do tipo escolhido**, não pela lista antiga; "Todas" nunca limpa | `components/hv/TaskTypePicker.tsx` |

**Revalidação executada por mim:**
- Re-varredura do repositório inteiro: **nenhuma** ocorrência do status antigo sobrou
  (`grep '"CONCLUIDA"'` só retorna `CONCLUIDA_*` e o filtro local do calendário, que
  descreve a situação **do ProJuris** — não o status da tarefa do SHV).
- `typecheck` limpo · `eslint` limpo · `vite build` OK (37s).

## O que ainda depende de gente

O passeio manual na UI não foi feito por nenhum agente. Antes de o time do Thiago
usar na sexta, alguém precisa abrir o sistema e conferir:
1. Andamentos: abre em "Intimações"; "marcar lido" some na intimação e aparece no andamento.
2. Concluir uma tarefa pela **Controladoria** (era o P0) e pelo **dossiê**.
3. Contador do menu e tela "Hoje" com os números certos depois de concluir.
4. Trocar a classe no seletor com um tipo já escolhido (era o QA-4).
5. Abrir a URL antiga de tipos de tarefa e cair na de Configurações.

— Quinn, guardião da qualidade 🛡️
