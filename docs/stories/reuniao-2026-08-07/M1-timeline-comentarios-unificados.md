# Story M1: Linha do tempo + comentários = um fluxo só (estilo Trello)

**Épico:** Reunião 2026-08-07 — Melhorias até segunda
**ID:** M1
**Status:** Ready for Review
**Estimativa relativa:** L
**Executor sugerido:** @dev (UI + RPC de comentário na timeline) + @data-engineer (se precisar coluna/gate de ownership) · Quality gate: @qa
**Risco:** MÉDIO — mexe na `CaseTimeline` (leitura de `system_case_events`) e nas Notas (`system_case_notes` scope `geral`); precisa costurar duas fontes num único feed cronológico sem regredir edição/exclusão de eventos manuais nem o gate de scope financeiro.

---

## Story

**Como** advogado/operacional que acompanha um caso,
**quero** que a **Linha do tempo** e os **comentários (Notas)** virem **um único fluxo cronológico** e visual (cards, estilo Trello), no qual eu possa **comentar** direto na linha do tempo,
**para que** eu tenha o histórico completo do caso — eventos automáticos do sistema **+** comentários de pessoas — num lugar só, sem duplicar informação em dois blocos separados ("grande e pequeno").

Hoje há DOIS blocos separados na ficha (`casos.$id.index.tsx`): a **Linha do tempo** (`CaseTimeline`, read-only para eventos automáticos, montada em `:596`) e o bloco **Notas** (`NotesBlock`, comentários livres, montado em `:600`). O Thiago quer unificá-los num fluxo só, mais visual (cards), **renomear "Notas" → "Notas / Linha do tempo"** e **subir o bloco para perto do topo** da ficha. Deve ser possível **comentar** na linha do tempo. Regra de **editar/excluir** (metodologia Trello): cada usuário edita/exclui o **próprio** comentário; **admin** pode **excluir** o de qualquer pessoa (mas **não editar** o dos outros — para não adulterar o que a pessoa escreveu). Eventos automáticos do sistema continuam **read-only**. Quando o feed ficar grande, aparece **barra de rolagem**.

> **NOTA (dependência leve):** o Thiago vai mandar um **print do Trello** como referência visual. Isso é **refinamento visual** (espaçamento/tamanho dos cards) — a story pode ser executada sem o print; ajustar o polimento visual quando ele chegar. Não bloqueia.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

**Ficha do caso (onde os dois blocos moram hoje):**
- `sistema-hv/src/routes/casos.$id.index.tsx` — a ficha comum. Ordem atual: `CaseTimeline` (`:596`, sob "Linha do tempo") → `OrnamentalDivider` → `NotesBlock target="case"` (`:600`, sob "Notas"). Os dois estão hoje **no meio/fim** da ficha (depois de canonical fields e checklist). Esta story **sobe** o bloco unificado para perto do topo.

**Linha do tempo (eventos automáticos + manuais):**
- `sistema-hv/src/components/cases/CaseTimeline.tsx` — lê `useCaseEvents(caseId)` (`system_case_events`), ordena DESC, e filtra na apresentação toda `action` que começa com `fin_` (F1, `:164`). `renderEventLabel` (`:47-148`) mapeia todas as `action` para rótulos. Já existe **entrada manual** (`marco`/`nota_manual`) editável/apagável via `useUpdateManualCaseEvent`/`useDeleteManualCaseEvent` (`sistema-hv/src/hooks/useTimeline.ts`), com `isManualEvent` (`:43`) gate-ando os botões de editar/apagar SÓ nesses eventos manuais. Eventos automáticos = read-only real (bloqueio no servidor em `cases-service.loadEditableManualEvent`).
- Cada nota criada JÁ gera um evento `note_added` na timeline (`notes-service.ts:136-149`, best-effort, exceto scope `financeiro`).

**Notas (comentários livres do caso):**
- `sistema-hv/src/components/notes/NotesBlock.tsx` — CRUD de comentários (`useCaseNotes`/`useCreateCaseNote`/`useUpdateNote`/`useSoftDeleteNote` de `sistema-hv/src/hooks/useNotes.ts`). Título "Notas" (`:99`), com editar/excluir SEM restrição de dono hoje (qualquer autenticado edita/exclui qualquer nota).
- `sistema-hv/src/rpc/notes.ts` — `createCaseNoteFn`/`updateNoteFn`/`softDeleteNoteFn` (scope `geral`), gate `requireAnyModule(["comercial","operacional"], "edit")`. Cada nota grava `created_by` (o ator).
- `sistema-hv/src/lib/notes-service.ts` — `listCaseNotes(caseId, scope='geral')` (via view `system_case_notes_active`), `createCaseNote` (grava `created_by` + gera `note_added` na timeline se scope≠financeiro), `updateNote`, `softDeleteNote` (grava `deleted_by`/`deleted_at`). `attachAuthorNames` (`:57`) resolve `created_by → full_name`.
- Tabela `system_case_notes` (colunas `id, case_id, body, scope, created_by, created_at, updated_at, deleted_at, deleted_by`) + view `system_case_notes_active`.

**Gate / usuário atual (para a regra Trello):**
- Server: `requireModule`/`requireAnyModule` retornam `{ id, email, role }` (`sistema-hv/src/lib/supabase/auth-guard.ts:194,228`). O `role` do banco (`system_users.role`) permite saber se é `admin`.
- Client: `useAuth()` expõe `role` (`sistema-hv/src/lib/auth.ts`); `can(role, ...)` e helpers em `sistema-hv/src/lib/rbac.ts`.

### NOVO nesta story

1. **Um componente de FEED UNIFICADO** (ex.: `sistema-hv/src/components/cases/CaseFeed.tsx`) que mescla os `system_case_events` (eventos automáticos + marcos/notas manuais) **e** as notas `scope='geral'` de `system_case_notes` num ÚNICO array ordenado por data (mais recente no topo OU no fim — combinar com o visual Trello). Cada item renderiza como **card** (mais visual que a lista atual).
2. **Comentar na linha do tempo:** caixa de comentário (Textarea + "Adicionar") no topo do feed, reusando `useCreateCaseNote` (scope `geral`). O comentário aparece imediatamente no feed.
3. **Regra Trello de editar/excluir** aplicada aos **comentários** (não aos eventos automáticos): o **autor** edita/exclui o próprio; o **admin** pode **excluir** o de qualquer um (nunca editar o de outro). Eventos automáticos do sistema seguem read-only; marcos/notas manuais (`system_case_events`) seguem a regra atual (autor/manual).
4. **Rename + reposição:** o bloco unificado se chama **"Notas / Linha do tempo"** e **sobe para perto do topo** da ficha (`casos.$id.index.tsx`). O `NotesBlock` "Notas" separado deixa de ser montado na ficha (some a duplicação; ver AC-4).
5. **Barra de rolagem** no feed quando passar de uma altura-limite (container com `max-h-[...] overflow-y-auto`).
6. **Gate de dono nas notas** (server): `updateNoteFn` só pelo autor; `softDeleteNoteFn` pelo autor **ou** admin. (Hoje é livre — endurecer sem regredir a criação.)

---

## Acceptance Criteria

1. **Feed único cronológico.** Existe UM bloco na ficha do caso ("Notas / Linha do tempo") que mostra, em ordem cronológica, tanto os eventos automáticos do sistema (`system_case_events`, sem os `fin_*` — mantém o isolamento F1) quanto os comentários das pessoas (`system_case_notes` scope `geral`), sem duplicar (a nota NÃO aparece duas vezes — ver Dev Notes sobre o `note_added`). O visual é de **cards** (mais visual que a lista de linhas atual), estilo Trello.

2. **Comentar na linha do tempo.** Há uma caixa de comentário no bloco unificado. Ao enviar, o comentário é criado (scope `geral`, `created_by` = usuário) e aparece no feed. Usa o gate de escrita atual das notas (`requireAnyModule(["comercial","operacional"], "edit")`).

3. **Editar/excluir estilo Trello (comentários).** Para cada **comentário** (nota `geral` e marco/nota manual): o **autor** vê botões de **editar** e **excluir** do próprio; um **admin** vê botão de **excluir** em qualquer comentário (mas **não** "editar" no de outra pessoa). Um usuário não-autor e não-admin **não** vê editar nem excluir naquele comentário. A regra é imposta no **servidor** (não só na UI): `updateNote` só pelo autor; `softDeleteNote` pelo autor ou admin — resposta 403 caso contrário.

4. **Eventos automáticos read-only + sem duplicação.** Eventos automáticos do sistema (status, docs, tarefas, prazos, etc.) continuam **read-only** (sem editar/excluir). O comentário NÃO aparece duplicado como card de comentário **e** como evento `note_added` — escolher UMA representação (ver Dev Notes / D-M1a).

5. **Rename + reposição.** O bloco unificado se chama **"Notas / Linha do tempo"** e fica **perto do topo** da ficha (`casos.$id.index.tsx`), acima do rastro/checklist/documentos. Os dois blocos antigos separados ("Linha do tempo" via `CaseTimeline` + "Notas" via `NotesBlock`) deixam de ser montados na ficha comum (sem duplicação visual).

6. **Barra de rolagem.** Quando o feed passa de uma altura-limite, o container ganha barra de rolagem (`overflow-y-auto`) e não empurra o resto da página.

7. **Isolamento financeiro preservado (F1).** O feed da ficha comum **não** mostra eventos `fin_*` nem os comentários `scope='financeiro'` (esses seguem só no submenu financeiro). Nenhuma regressão no `FinNotesBlock`.

8. **Regressão + gates.** `npm run typecheck` e `npm run lint` limpos. O `CaseTimeline` continua funcionando onde ainda for usado (ou é substituído pelo feed na ficha). O selo de auditoria (`created_by_name`, `(editada)`) e o soft-delete (nunca hard-delete) são preservados. Se houver migration/alteração de gate, aplicar via `npx tsx scripts/db-apply-pg.ts` 2× sem erro.

---

## Tasks / Subtasks

### T0 — Decisões de arquitetura (SPIKE — @architect/@dev, antes de codar)
- [x] **D-M1a: como evitar duplicação nota × evento `note_added`.** Hoje criar nota gera `note_added` na timeline. No feed unificado isso viraria 2 cards. Recomendação SM: **filtrar `note_added` do feed de eventos** e mostrar SÓ o card de comentário (fonte `system_case_notes`), que já tem body/autor/editar/excluir. (AC-1, AC-4)
- [x] **D-M1b: fonte da ordenação e da mesclagem.** Feed = `merge(events\_sem\_fin\_e\_sem\_note_added, notesGeral)` ordenado por `created_at`. Definir topo=mais recente (como a timeline hoje) vs Trello (mais antigo em cima) — combinar com o print quando chegar; default: **mais recente no topo** (comportamento atual da timeline). (AC-1)

### T1 — Componente de feed unificado (@dev)
- [x] Criar `sistema-hv/src/components/cases/CaseFeed.tsx`: consome `useCaseEvents(caseId)` + `useCaseNotes(caseId)`; normaliza cada fonte num tipo `FeedItem` (`{ kind: 'event' | 'comment', id, created_at, body/label, author, editable, deletable }`); mescla e ordena. Renderiza como **cards** (reaproveitar tokens `card-editorial`). (AC-1)
- [x] Filtrar do feed: eventos `fin_*` (isolamento F1) e eventos `note_added` (D-M1a). (AC-4, AC-7)
- [x] Caixa de comentário no topo do feed (Textarea + "Adicionar"), via `useCreateCaseNote`. (AC-2)
- [x] Container com `max-h-[...] overflow-y-auto` (barra de rolagem). (AC-6)

### T2 — Regra Trello de editar/excluir na UI (@dev)
- [x] Para itens `kind:'comment'` (nota `geral`): mostrar **editar+excluir** se `n.created_by === currentUserId`; mostrar **só excluir** se `isAdmin`; nada caso contrário. `isAdmin` = `role === 'admin'` via `useAuth()`. (AC-3)
- [x] Marcos/notas manuais de `system_case_events` seguem `isManualEvent` (autor/manual) — reusar o padrão do `CaseTimeline`. (AC-3, AC-4)
- [x] Eventos automáticos: sem botões (read-only). (AC-4)

### T3 — Endurecer o gate de dono no servidor (@dev + @data-engineer)
- [x] Em `notes-service.ts`: `updateNote` recebe `userId` e só atualiza quando `created_by = userId` (senão 403/404). `softDeleteNote` só quando `created_by = userId` **OU** `isAdmin` (passar flag `role`/`isAdmin` do RPC). (AC-3)
- [x] Em `rpc/notes.ts`: `updateNoteFn`/`softDeleteNoteFn` passam a resolver o `role` (via `requireAnyModule` já retorna `role`) e propagam `isAdmin` para o service. Retornar 403 quando a regra Trello barrar. (AC-3)
- [x] Verificar que o `FinNotesBlock`/RPCs financeiros de nota NÃO regridem (mesma regra pode valer lá, mas fora de escopo se ficar como está). (AC-7)

### T4 — Rename + reposição na ficha (@dev)
- [x] Em `casos.$id.index.tsx`: substituir a dupla `CaseTimeline` + `NotesBlock target="case"` por **um** `<CaseFeed caseId={caso.id} />` com título **"Notas / Linha do tempo"**, posicionado **perto do topo** (acima de canonical fields/checklist). Remover os `OrnamentalDivider` órfãos. (AC-1, AC-5)
- [x] Garantir que `CaseTimeline` (se ainda referenciado em outro lugar) não quebre; se ficar sem uso, avaliar manter para o submenu financeiro. (AC-8)

### T5 — QA / regressão (@qa)
- [x] `npm run typecheck` + `npm run lint` verdes (arquivos tocados; eslint 0 erros). (AC-8)
- [ ] Matriz Trello: autor edita/exclui o próprio; admin exclui de qualquer um e NÃO vê editar no alheio; terceiro não vê nada. Testar o bloqueio no servidor (403). (AC-3)
- [ ] Feed sem duplicar nota×`note_added`; sem eventos `fin_*`; sem comentário `scope='financeiro'`. (AC-1, AC-4, AC-7)
- [ ] Barra de rolagem aparece com muitos itens; ordem cronológica correta. (AC-6)
- [ ] Selo de autor/data + `(editada)` + soft-delete preservados. (AC-8)

---

## Dev Notes

- **Duas fontes, um feed:** o jeito de menor risco é NÃO fundir as tabelas — mesclar em memória no `CaseFeed` (`events` + `notes geral`), normalizando num `FeedItem`. Isso preserva o backend (eventos automáticos continuam em `system_case_events`; comentários em `system_case_notes`) e o gate de scope F1.
- **Duplicação nota×evento (D-M1a):** como criar nota já grava `note_added`, mostrar as duas fontes sem filtro duplicaria. Filtrar `action === 'note_added'` do feed de eventos e exibir o comentário pela fonte `system_case_notes` (que tem editar/excluir + autor). Não precisa mexer no `notes-service` (o `note_added` continua gravado para auditoria; só não é mostrado).
- **Regra Trello (metodologia confirmada pelo Thiago na transcrição, linha ~423):** "o próprio usuário pode excluir OU editar o dele; o dos outros não pode; admin pode EXCLUIR de qualquer um, mas NÃO editar (para não adulterar)". Impor no **servidor** — a UI só esconde botões; o `updateNote`/`softDeleteNote` precisam validar `created_by`/`role`.
- **`role` server-side:** `requireAnyModule([...], "edit")` já devolve `{ id, role }` — dá para saber `isAdmin = role === 'admin'` sem query extra. `admin` é o `Role` de topo em `rbac.ts`.
- **Isolamento F1 (AC-7):** manter o filtro `!action.startsWith("fin_")` do `CaseTimeline` no `CaseFeed`; e o feed da ficha só lê `useCaseNotes` (scope `geral`), nunca `useCaseFinNotes`.
- **Visual Trello (dependência leve):** cards em vez de linhas finas; deixar espaçamento/tamanho ajustáveis. O print do Thiago serve só para calibrar isso — não bloqueia a lógica.
- **Sem migration obrigatória:** a story é majoritariamente front + endurecimento de 2 RPCs. Só há migration se se decidir adicionar índice/coluna — não é necessário para os ACs. dev=prod; se aplicar algo, via `npx tsx scripts/db-apply-pg.ts`.

**Riscos:**
- **R1 — duplicação de itens** (nota aparecendo 2×). Mitigação: filtro `note_added` (D-M1a) + teste dedicado.
- **R2 — regressão de gate** ao endurecer `updateNote`/`softDeleteNote` (quebrar edição legítima). Mitigação: só bloquear quando `created_by`≠user e não-admin; testar autor/admin/terceiro.
- **R3 — `CaseTimeline` órfão** se removido da ficha mas usado alhures. Mitigação: grep de usos antes de remover; manter o componente se o financeiro usar.

## Testing

- **UI (feed):** mesclagem cronológica; cards; caixa de comentário cria e aparece; barra de rolagem com N itens; sem duplicação nota×evento; sem `fin_*`.
- **Gate (server):** `updateNote` por não-autor → 403; `softDeleteNote` por não-autor não-admin → 403; por autor → ok; por admin → ok (exclui) mas sem endpoint de editar alheio.
- **Regressão:** selo autor/data, `(editada)`, soft-delete; `FinNotesBlock` intacto; isolamento F1.
- **Gates:** `npm run typecheck` + `npm run lint` limpos.

## Dependências

- **Notas/Timeline existentes** (`NotesBlock`, `CaseTimeline`, `useNotes`, `useTimeline`, `notes-service`, `system_case_notes`, `system_case_events`) — base a reusar.
- **Isolamento financeiro F1** (filtro `fin_*` + scope de notas) — não pode regredir.
- **RBAC** (`role` via `requireAnyModule`, `useAuth`) — para a regra admin/autor.
- **Dependência leve:** print do Trello do Thiago (só calibração visual — não bloqueia).

## File List

**Novos**
- `sistema-hv/src/components/cases/CaseFeed.tsx` (feed unificado: eventos + comentários, cards, regra Trello)

**Alterados**
- `sistema-hv/src/routes/casos.$id.index.tsx` (troca `CaseTimeline`+`NotesBlock` por `CaseFeed` "Notas / Linha do tempo", sobe pro topo)
- `sistema-hv/src/lib/notes-service.ts` (`updateNote`/`softDeleteNote` com regra de dono/admin)
- `sistema-hv/src/rpc/notes.ts` (`updateNoteFn`/`softDeleteNoteFn` propagam `role`/`isAdmin`, retornam 403)
- `sistema-hv/src/hooks/useNotes.ts` (só se assinatura mudar)
- (avaliar) `sistema-hv/src/components/cases/CaseTimeline.tsx` (mantido para o submenu financeiro, ou aposentado da ficha)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-07 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-08 | v0.2 | Implementado (@dev via Orion). NOVO `src/components/cases/CaseFeed.tsx`: feed unificado em cards que mescla em memória `system_case_events` (sem `fin_*` e sem `note_added` — D-M1a/F1) + notas `scope='geral'`, ordenado por `created_at` DESC; caixa de comentário no topo (`useCreateCaseNote`); `max-h-[560px] overflow-y-auto` (rolagem); regra Trello na UI (autor edita/exclui; admin só exclui; eventos automáticos read-only; marcos/notas manuais via `useUpdate/DeleteManualCaseEvent`). Gate no SERVIDOR: `notes-service.updateNote`/`softDeleteNote` ganharam `opts.enforceOwner`/`isAdmin` (403 quando barra); `rpc/notes.ts updateNoteFn` liga `enforceOwner`, `softDeleteNoteFn` liga `enforceOwner+isAdmin` (via `role` do `requireAnyModule`) — RPCs financeiros NÃO passam enforceOwner (sem regressão F1). Ficha `casos.$id.index.tsx`: `CaseTimeline`+`NotesBlock` removidos; `<CaseFeed>` "Notas / Linha do tempo" subiu pro topo (após header/Drive, antes do Rastro). `CaseTimeline.tsx` preservado (órfão da ficha; `NotesBlock` segue em clientes). typecheck OK, eslint OK nos arquivos tocados. Sem migration. Pendente: matriz Trello manual (@qa) + calibração visual com print do Thiago. | @dev |
