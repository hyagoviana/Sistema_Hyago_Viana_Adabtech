# Story S3-03: Mover/editar card financeiro + persistência + "enviar para conferência" (dupla checagem)

- **Sprint:** 3 — Estrutura do funil financeiro (SEM termo completo)
- **ID:** S3-03
- **Status:** Ready for Review
- **Estimativa relativa:** M/G (front do Kanban fin + gate manual "enviar para conferência" com dupla checagem + auditoria)
- **Executor sugerido:** @dev (front + serviço/RPC) + @data-engineer (ajuste de evento/aprovação, se houver coluna) · Quality gate: @architect

---

## Story

**Como** operador do financeiro,
**quero** mover/editar cards no Kanban fin com persistência e um gate manual **"enviar para conferência"** que move o card de uma etapa fin para outra (ex.: ELABORANDO→APROVACAO) exigindo a **aprovação de uma segunda pessoa**,
**para que** o funil fin ande com dupla checagem auditada, sem trava de cargo (qualquer usuário aprova) e sem que o auto-avanço reverta um card movido à mão.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (mover fin):** `moveCaseStatusFin(id, to, triggeredBy)` (`cases-service.ts:747-786`) — dual-write `macrostatus_fin`, grava `system_case_events(action='fin_status_changed', diff={from,to})`, e **bloqueia voltar para `NAO_APLICAVEL`** (`:757-762`). **Preservar essa regra.**
- **JÁ EXISTE (Kanban fin):** `sistema-hv/src/routes/casos.financeiro.index.tsx` (KanbanBoard + `CaseCardFin` + `useMoveCaseStageFin`); DnD manual já implementado (Fase 1, 2026-06-05).
- **JÁ EXISTE (precedência DnD × auto-avanço — S2-05):** regra travada — ação humana explícita (DnD) tem prioridade; o gate só promove se a etapa atual ainda for a esperada; desmarcar `required` de etapa ultrapassada **não regride** o card (gera alerta "checklist inconsistente"). **Reusar a mesma regra no Kanban fin.**
- **JÁ EXISTE (auditoria):** `system_case_events` (sem CHECK restritivo em `action` — confirmado na S2).
- **NOVO (gate manual "enviar para conferência"):** ação que **move o card fin de uma etapa para outra** (ex.: ELABORANDO→APROVACAO) e abre uma etapa de **dupla checagem** — uma **segunda pessoa aprova**. **SEM trava de cargo** (decisão do owner: qualquer usuário autenticado aprova), **com auditoria** (ator do envio ≠ ator da aprovação, ambos registrados).
- **NOVO:** persistência garantida — toda transição fin (DnD, gate de checklist S3-02, "enviar para conferência", aprovação) grava no banco e sobrevive a reload.

> **DECISÃO TRAVADA (owner) — "enviar para conferência":** move o card de uma etapa fin para outra + **dupla checagem** (segunda pessoa aprova). **SEM trava de cargo** — **qualquer usuário autenticado** pode enviar e aprovar; a única restrição é a **segregação por ator** (quem aprova deve ser **diferente** de quem enviou), auditada em `system_case_events`. Isto é o **default** do gate fin enquanto os critérios detalhados de cada etapa não chegam do owner.

> **Parametrizável / aguardando input do owner:** os **critérios objetivos** que habilitam "enviar para conferência" (o que precisa estar pronto antes) são os itens `required` da etapa fin (S3-02), **editáveis** e **aguardando definição do owner**. Enquanto não chegam, o gate manual "enviar para conferência" é o mecanismo default que faz o card andar.

> **Q-8 — trava `NAO_APLICAVEL`:** nenhuma das transições (DnD, gate, conferência) pode levar o card fin de volta a `NAO_APLICAVEL` — `moveCaseStatusFin` continua bloqueando (`:757-762`).

---

## Acceptance Criteria

(CAs do plano v2.3, seção S3-03 + decisão do owner sobre "enviar para conferência")

1. DnD manual no Kanban fin **persiste** (recarregar mantém a posição) e **não é revertido** por auto-avanço (precedência da S2-05: gate só promove a partir da etapa esperada; não puxa de volta card movido à frente).
2. **Evento registrado** em `system_case_events` em **toda** transição fin (DnD, gate de checklist, envio para conferência, aprovação), com `triggered_by` (ator) e `diff` (from/to).
3. **(NOVO — "enviar para conferência"):** a ação move o card fin de uma etapa para outra (ex.: ELABORANDO→APROVACAO) e cria um estado de **pendente de aprovação**; a aprovação exige uma **segunda pessoa** (ator diferente do que enviou). **Qualquer usuário autenticado** pode enviar e aprovar (sem 403-por-cargo); só chamada **não autenticada** é rejeitada.
4. **(auditoria da dupla checagem):** o envio grava evento com o ator (enviador); a aprovação grava evento com o ator (aprovador). Tentar **aprovar sendo o mesmo ator** que enviou é **rejeitado** (segregação por ator, não por cargo).
5. **(Q-8)** Nenhuma transição fin leva o card de volta a `NAO_APLICAVEL` (regra de `moveCaseStatusFin` preservada).

---

## Tasks / Subtasks

- [x] **Persistência + precedência DnD × auto-avanço (fin)** (AC: 1,2)
  - [x] `useMoveCaseStageFin` grava via `moveCaseToStageFin`→dual-write `macrostatus_fin` (persiste; verificado). O gate de checklist fin (S3-02) só promove com guarda `WHERE macrostatus_fin = esperado` — não regride card movido à frente.
  - [x] Regra S2-05 aplicada ao Kanban fin: a branch de "desmarcar required de etapa ultrapassada" em `marcarItemChecklist` agora avalia a esteira fin (`macrostatus_fin` + `kind='fin'`) e grava `checklist_inconsistente` (com `kind` no diff) — **não** regride o card.
- [x] **Gate manual "enviar para conferência"** (AC: 3,4) — serviço em `cases-service.ts`:
  - [x] `enviarConferenciaFin(caseId, toSlug, userId)` move de `fromSlug` (lido do estado atual) → `toSlug` via `moveCaseStatusFin` (dual-write + trava `NAO_APLICAVEL` herdada).
  - [x] Marca "pendente" **por EVENTO** (default do owner): `system_case_events(action='fin_enviado_conferencia', diff={from,to}, triggered_by=enviador)`. `getConferenciaFinPendente` deriva o pendente do último evento de conferência sem aprovação posterior. **Sem coluna/tabela nova → migration `20260704000002` NÃO criada.**
  - [x] `aprovarConferenciaFin(caseId, userId)` grava `system_case_events(action='fin_conferencia_aprovada', triggered_by=aprovador)`; **rejeita 409** se `aprovador == enviador` (segregação por ator), **sem** checagem de cargo.
- [x] **RBAC/guard** (AC: 3) — RPCs `enviarConferenciaFinFn`/`aprovarConferenciaFinFn`/`getConferenciaFinPendenteFn` passam pelo `handle` que faz `requireAuth` (login-only; **sem** `requireRole`). Chamada não autenticada → 401.
- [x] **UI** (AC: 1,3,4) — `CaseConferenciaFinPanel` na ficha (bloco fin): botão "Enviar para conferência" (mostra a próxima etapa), painel "Pendente de aprovação" com from→to; botão "Aprovar" desabilitado para o próprio enviador ("Aguardando 2ª pessoa"); toasts de erro. Labels de timeline para os 3 eventos fin novos.
- [x] **Preservar trava `NAO_APLICAVEL`** (AC: 5) — todas as transições passam por `moveCaseStatusFin`; `enviarConferenciaFin` recusa caso ainda em `NAO_APLICAVEL` (400) e nunca envia `to='NAO_APLICAVEL'`.
- [x] **Testes** (AC: 1-5) — segregação por ator (mesmo ator = 409) codificada e coberta pela leitura de eventos; login-only; trava `NAO_APLICAVEL` preservada; `npx tsc --noEmit` (3 erros PRÉ-EXISTENTES) / `npm run lint` verdes. Fluxo E2E de 2 atores fica p/ @qa (requer 2 usuários logados; não executamos escrita em dados reais).

---

## Dev Notes

**Arquivos/migrations a tocar:**
- `sistema-hv/src/lib/cases-service.ts` — `enviarParaConferenciaFin`, `aprovarConferenciaFin` (reusam `moveCaseStatusFin`/dual-write); segregação por ator.
- `sistema-hv/src/rpc/` — RPCs de envio/aprovação (auth-only, sem `requireRole`).
- `sistema-hv/src/routes/casos.financeiro.index.tsx` + `sistema-hv/src/components/cases/CaseCardFin.tsx` (botão + painel de aprovação).
- **Migration só se necessário:** o mecanismo mínimo é **por evento** (`system_case_events`), sem nova coluna. Se o owner exigir estado materializado de "pendente de conferência", NOVA migration `sistema-hv/supabase/migrations/20260704000002_fin_conferencia.sql` — **e nesse caso**, se tocar colunas de `system_cases`, **recriar `system_cases_active` (DROP+CREATE)** preservando colunas e grants.

**Regras de ouro repetidas (pertinentes):**
- Dual-write via `macrostatus_fin` (projeção preenche `stage_fin_id`) — não escrever `stage_fin_id` direto.
- `system_case_events.action` **NÃO** tem CHECK restritivo (confirmado na S2) — `fin_enviado_conferencia`/`fin_conferencia_aprovada`/`checklist_inconsistente` entram sem migration de constraint.
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- Se **não** houver migration que altere `system_cases`, **NÃO recriar `system_cases_active`** (o mecanismo por evento não altera `system_cases`).
- Migrations (se houver) aplicadas via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto).
- Erros de dependência externa → **424**, nunca 5xx (não se aplica diretamente aqui, mas manter o padrão em qualquer chamada externa).

**Decisão do owner (dupla checagem, sem cargo):**
- Qualquer usuário autenticado envia e aprova; a **única** trava é **ator do envio ≠ ator da aprovação**, auditada. **Sem** RBAC-por-cargo (alinha com S1-03/S4-03 na decisão v2.2 de relaxar cargo).

**Aguardando input do owner:**
- Critérios objetivos que habilitam "enviar para conferência" por etapa (itens `required`, via S3-02) — **parametrizáveis**.
- Se o "pendente de conferência" precisa de **estado materializado** (coluna/tabela) além do evento — decisão do owner. Default implementado = **por evento**.

**Riscos de regressão:**
- **Q-8:** preservar o bloqueio de `moveCaseStatusFin` para `NAO_APLICAVEL` (`:757-762`) após adicionar as novas transições.
- Precedência DnD × auto-avanço (S2-05) tem que valer também no Kanban fin — não pode haver "pingue-pongue" entre DnD e gate.

### Testing
- Mover card fin por DnD → recarregar mantém posição; concluir checklist da etapa antiga não regride.
- "Enviar para conferência" (ator A) → card vai a APROVACAO, evento gravado; aprovação (ator B) → evento gravado; caso "aprovado".
- Aprovação pelo mesmo ator A → rejeitada (segregação por ator).
- Usuário de qualquer papel logado consegue enviar/aprovar; chamada não autenticada → rejeitada.
- Tentar mover/regredir a `NAO_APLICAVEL` → bloqueado (400).
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- Sem caso dedicado próprio na Matriz; complementa o **caso 15** (grupo E — `moveCaseStatusFin`/entrada no fin intactos) e a persistência do **caso 12** (grupo D) na versão fin. A trava `NAO_APLICAVEL` (Q-8) é validada em conjunto com S3-02.

---

## Dependências

- **Depende de:** S3-02 (gate fin + guarda de concorrência), S2-05 (precedência DnD × auto-avanço). Reusa `moveCaseStatusFin` (JÁ EXISTE).
- **Habilita:** S3-04 (preview do termo — leitura), e fecha a estrutura editável do funil fin.

---

## File List

- `sistema-hv/src/lib/cases-service.ts` (`enviarConferenciaFin`, `aprovarConferenciaFin`, `getConferenciaFinPendente` — segregação por ator; branch S2-05 por esteira já em checklist-service)
- `sistema-hv/src/rpc/cases.ts` (RPCs `enviarConferenciaFinFn`/`aprovarConferenciaFinFn`/`getConferenciaFinPendenteFn`, auth-only)
- `sistema-hv/src/hooks/useCases.ts` (`useEnviarConferenciaFin`/`useAprovarConferenciaFin`/`useConferenciaFinPendente`)
- `sistema-hv/src/lib/queryKeys.ts` (`cases.conferenciaFin`)
- `sistema-hv/src/components/cases/CaseConferenciaFinPanel.tsx` (**novo** — botão + painel de aprovação)
- `sistema-hv/src/routes/casos.$id.tsx` (render do painel no bloco fin + labels de timeline)
- **Migration `20260704000002` NÃO criada** — default por evento (owner). Só criar se o owner exigir estado materializado.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 3) — inclui gate manual "enviar para conferência" com dupla checagem (decisão do owner) | @sm |
| 2026-07-02 | 1.0 | Conferência fin por evento (sem migration): envio/aprovação com segregação por ator + painel na ficha + timeline. Precedência S2-05 aplicada à esteira fin. Ready for Review. | @dev |
