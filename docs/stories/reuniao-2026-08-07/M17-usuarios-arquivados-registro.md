# Story M17: Usuários ARQUIVADOS do ProJuris entram como REGISTRO (sem acesso) para o espelho de tarefas

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-07
- **ID:** M17
- **Status:** Implementado (mecanismo) — consumido pelo M15 no import em massa
- **Estimativa relativa:** S/M
- **Executor sugerido:** @data-engineer + @dev · Quality gate: @qa
- **Risco:** MÉDIO — mexe no CHECK de `status` de `system_users` (ou adiciona flag) e na regra de quem aparece em seletores de atribuição; erro pode (a) deixar um arquivado logar ou (b) sumir com o histórico/autor de tarefa espelhada. Mitigado por: arquivado **não tem conta Auth** (não consegue autenticar de qualquer jeito) + gate de exibição por `requireAuth`.
- **Origem:** áudio 4 do Thiago (`docs/reunioes/dados-thiago-2026-08-08.md`, seção "Usuários ARQUIVADOS") + a planilha `docs/reunioes/Cadastro-Colaboradores-PREENCHIDO-2026-08-08.xlsx` (~24 das 39 linhas vêm `Status usuário projuris = Desabilitado` e/ou `Status colaborador = Inativo`).

---

## Story

**Como** administrador do escritório (gestão de Usuários),
**quero** que os colaboradores **arquivados/desabilitados no ProJuris** (que já saíram do escritório e tiveram o e-mail do Drive excluído) sejam cadastrados no sistema como **REGISTRO SEM ACESSO** — existem no `system_users` para fins de vínculo/autoria, mas **não recebem convite, não têm login e não aparecem em seletores de atribuição ativa** —,
**para** que quando as **tarefas do ProJuris forem espelhadas** na aba do processo (espelho judicial — G1), o **autor/responsável histórico** dessas tarefas continue resolvendo para um usuário do nosso sistema (nome exibível), sem que o espelhamento quebre por falta do registro, e sem abrir uma porta de acesso indevido.

> **MOTIVO (do áudio 4, literal):** "os arquivados aparecem nas tarefas do ProJuris que vamos espelhar na aba do processo; se não existirem no nosso sistema, o espelhamento quebra. São só arquivo/vínculo, não logam." O e-mail corporativo/Drive deles já foi excluído — então **não há para quem mandar convite**, e eles **não devem** poder acessar.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **`system_users`** (`sistema-hv/supabase/migrations/20260602000004_rbac_lgpd.sql:11`): `status TEXT CHECK (status IN ('INVITED','ACTIVE','SUSPENDED'))` + `deleted_at`. View `system_users_active = WHERE deleted_at IS NULL`.
- **Gate de login (`requireAuth`)** — `sistema-hv/src/lib/supabase/auth-guard.ts:90`: já **nega acesso** quando `deleted_at` está setado OU `status = 'SUSPENDED'` (linha `:125`). `requireRole`/`requireModule` exigem `status = 'ACTIVE'` (rejeitam INVITED e qualquer outro). ⇒ **um usuário arquivado, com status ≠ ACTIVE e sem conta Auth, já não consegue logar.**
- **Espelho judicial (G1)** — `sistema-hv/src/lib/projuris/judicial-sync.ts`: hoje resolve o **responsável de cada tarefa espelhada** por **código ProJuris → nome** via `GET /usuario` (`fetchUserMap`), gravando `responsavel_projuris_cod` + `responsavel_nome` em `system_case_judicial_tasks`. **Não** casa hoje com `system_users`. O registro do arquivado serve para (a) o de-para código→usuário (quando quisermos linkar o autor a um `system_users.id`) e (b) evitar que qualquer join futuro com `system_users` (ex.: exibir avatar/perfil do autor) fique órfão.
- **Mapping de executores** — `system_projuris_executor_mapping` (`executor_id → system_users(id)`): o arquivado pode ter um mapping histórico (código `PES.*`) mas **inativo** (`active=false`) — não distribui.
- **Importador (M15)** — consome esta story: classifica cada linha da planilha em ativo × arquivado e cria o arquivado por aqui (sem `inviteUser`).
- **Convite** — `sistema-hv/src/lib/users-service.ts` `inviteUser()` (cria conta Auth + `system_users` INVITED). **NÃO** deve ser chamado para arquivados.

### NOVO (a construir nesta story)

- **Mecanismo de "arquivado / sem acesso" em `system_users`.** Duas opções (decidir em T0):
  - **Opção A (recomendada):** ampliar o CHECK de `status` para incluir **`'ARCHIVED'`** — `status IN ('INVITED','ACTIVE','SUSPENDED','ARCHIVED')`. Semântica: registro histórico, sem login. Reusa toda a lógica de gate (que já rejeita ≠ ACTIVE) e as views.
  - **Opção B:** flag booleana **`sem_acesso BOOLEAN DEFAULT FALSE`** (ou `arquivado`) ortogonal ao status. Mais explícita, mas duplica intenção com o status.
  - Em ambos: **sem conta no Supabase Auth** (o arquivado nunca é criado via `inviteUser`/`inviteUserByEmail`).
- **Função de criação de registro-sem-acesso** em `users-service.ts` (ex.: `createArchivedUser({ full_name, email?, projuris_responsavel_id?, role? })`): insere em `system_users` com `status='ARCHIVED'` (ou flag), **sem** tocar em Auth, **sem** e-mail. Idempotente (casa por e-mail quando houver; senão por nome + ID ProJuris).
- **Ocultar de seletores de atribuição ATIVA:** os componentes que listam "para quem atribuir" (responsável do caso, assignee de tarefa/checklist — `AssigneeMultiSelect`, `CaseFormDialog`, `ChecklistItemsList`, etc.) devem filtrar **apenas usuários ativos** (não-arquivados). Um endpoint/consulta `listAssignableUsers()` que devolve só `status='ACTIVE'` (ou não-arquivado), separado de `listUsers()` (que na tela de admin ainda mostra todos, inclusive arquivados, com badge).
- **Permitir aparecer como AUTOR histórico:** o espelho de tarefas (e telas de histórico/dossiê) continua podendo **exibir** o nome de um arquivado (autoria passada). O de-para código ProJuris → `system_users` (quando existir mapping) resolve o nome; se não houver mapping, cai no `responsavel_nome` já resolvido pelo `/usuario` (comportamento atual preservado).
- **Badge "Arquivado / sem acesso"** na lista de Usuários (admin) para o admin distinguir registro histórico de conta ativa.

---

## Acceptance Criteria

1. **Registro sem acesso:** existe um caminho (função de serviço, consumido pelo importador M15 e/ou botão admin) que cria um `system_users` marcado como **arquivado** (`status='ARCHIVED'` ou flag `sem_acesso=true`) **sem** criar conta no Supabase Auth e **sem** enviar e-mail de convite.
2. **Não loga:** um usuário arquivado **não consegue autenticar** — como não tem conta Auth, não há login; e mesmo que existisse, `requireAuth`/`requireRole`/`requireModule` negam acesso a status ≠ ACTIVE. Confirmado por teste/gate. (AC de segurança.)
3. **Some dos seletores de atribuição ativa:** nas telas de atribuição (responsável do caso, assignee de tarefa/checklist), o arquivado **não aparece** como opção selecionável. `listAssignableUsers()` (ou filtro equivalente) devolve só não-arquivados.
4. **Aparece como autor histórico:** o espelho judicial (`judicial-sync.ts`) e as telas de histórico continuam **exibindo** o nome do arquivado quando ele é autor/responsável de uma tarefa espelhada do ProJuris — o espelhamento **não quebra** por falta de registro (o registro existe) nem por o usuário estar arquivado.
4b. **Espelho robusto:** sincronizar um caso cujo autor de tarefa é um código ProJuris de arquivado **não falha**; o nome resolve (via mapping→`system_users` quando existir, senão via `/usuario`), e o registro arquivado garante que qualquer join com `system_users` não fique órfão.
5. **Idempotência:** criar o mesmo arquivado 2× (mesmo e-mail, ou mesmo nome+ID ProJuris quando sem e-mail) **não duplica** o `system_users`.
6. **Visível na admin com badge:** na tela de Usuários (admin), o arquivado aparece na lista com badge **"Arquivado / sem acesso"**, distinto de ACTIVE/INVITED/SUSPENDED; não some da gestão.
7. **Autorização:** criar/alterar o estado arquivado exige **admin** (mesmo padrão dos demais writes de usuário em `src/rpc/users.ts`).
8. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; `db:types` regenerado (novo status/flag); RLS org-scoped preservada; a distribuição (`sync-core.ts`) **não considera** arquivado como executor ativo (mapping `active=false`); nenhum segredo/PII em log.

---

## Tasks / Subtasks

### T0 — Decisão de mecanismo (@architect + @data-engineer) — antes de codar
- [ ] Escolher **Opção A (`status='ARCHIVED'`)** vs **Opção B (flag `sem_acesso`)**. Recomendação: **A** (reusa o gate que já rejeita ≠ ACTIVE; menos superfície nova). Registrar a decisão aqui.
- [ ] Confirmar com o owner que arquivado **nunca** recebe convite/e-mail (e-mail do Drive já excluído).

### T1 — Schema (@data-engineer)
- [ ] Migration aditiva `2026080700000X_users_archived.sql` (+ rollback): (A) `ALTER ... DROP CONSTRAINT / ADD CONSTRAINT status CHECK (... ,'ARCHIVED')` **ou** (B) `ADD COLUMN IF NOT EXISTS sem_acesso BOOLEAN NOT NULL DEFAULT FALSE`. Recriar `system_users_active` se necessário (arquivado continua com `deleted_at IS NULL` — ele NÃO é soft-delete; é um estado). `db:types` atualizado. Aplicar via `db-apply-pg.ts` (2× idempotente).
- [ ] Alinhar com a migration de M15 (nível/time/peticionante) — pode ser o mesmo passo de DDL.

### T2 — Camada de dados (@dev)
- [ ] `createArchivedUser(input)` em `sistema-hv/src/lib/users-service.ts`: insert `system_users` arquivado, SEM Auth, SEM convite; idempotente (por e-mail; senão nome+ID ProJuris). Opcional: também cria/atualiza mapping histórico `active=false` quando houver `PES.*`.
- [ ] `listAssignableUsers()` (ou parâmetro em `listUsers`) que devolve só não-arquivados, para os seletores de atribuição. `listUsers()` (admin) passa a expor o estado arquivado por linha.
- [ ] `setUserArchived(userId, archived)` (opcional) + `setUserArchivedFn` no RPC (gate admin) — para arquivar/desarquivar manualmente.

### T3 — UI (@dev)
- [ ] Trocar as origens de dados dos seletores de atribuição (`AssigneeMultiSelect` e chamadas em `CaseFormDialog`, `ChecklistItemsList`, `CaseChecklistPanel`, `CaseSigiloSection`, responsável do caso) para `listAssignableUsers()` (só ativos).
- [ ] Badge "Arquivado / sem acesso" em `UsersAdmin.tsx` na lista.

### T4 — Espelho judicial (@dev)
- [ ] Garantir que `judicial-sync.ts` **não quebra** com autor arquivado (hoje resolve por `/usuario`; validar que o registro arquivado não interfere e que qualquer join futuro com `system_users` usa o registro). Se/quando o autor for linkado a `system_users.id`, o registro arquivado é o alvo.

### T5 — QA (@qa)
- [ ] Criar arquivado → confirmar que não há conta Auth e que ele não loga.
- [ ] Confirmar que some dos seletores de atribuição mas aparece na admin com badge.
- [ ] Rodar `syncCaseJudicial` num caso com autor arquivado → espelho não quebra, nome aparece.
- [ ] Idempotência (criar 2× não duplica); `sync-core` não o considera executor ativo; `typecheck`/`lint` verdes.

---

## Dev Notes

- **Arquivado ≠ soft-delete.** `deleted_at` é remoção; arquivado é um **estado histórico visível**. Manter `deleted_at IS NULL` para o arquivado (ele continua na `system_users_active` para joins de autoria) — o que o impede de logar é a **falta de conta Auth** + `status ≠ ACTIVE`. Se preferir escondê-lo de `system_users_active`, criar uma view irmã `system_users_assignable` (só ACTIVE) em vez de tirar da _active.
- **Por que o espelho "quebraria".** O espelho de tarefas do ProJuris traz o **autor/responsável** de cada tarefa. Ao exibir/associar esse autor a um perfil do nosso sistema (nome, e futuramente avatar/link), se o autor for alguém que **saiu** e não existe em `system_users`, qualquer associação fica órfã. Criar o arquivado como registro fecha esse buraco. Hoje o `judicial-sync.ts` resolve por `/usuario` (nome cru) — o registro arquivado é a **base para o de-para código→usuário** e para não quebrar joins.
- **Sem convite, sem e-mail.** O e-mail corporativo/Drive dos arquivados já foi excluído (áudio). `createArchivedUser` **nunca** chama `inviteUserByEmail`. O e-mail (se houver na planilha) é guardado só como dado histórico — pode até ficar nulo. Cuidar do índice único `system_users_email_active_unique (organization_id, email) WHERE deleted_at IS NULL`: se dois arquivados vierem sem e-mail, usar e-mail nulo (permitido) ou um sentinela por ID ProJuris para não colidir.
- **Quem é arquivado (regra do importador M15):** `Status usuário projuris = Desabilitado` **OU** `Status colaborador/e-mail = Inativo` **OU** sem e-mail ProJuris. Na planilha real: Nicole (júnior/`nicole@`), Micael, Rodrigo, Matheus Rocha da Silva, mariana felix, Maria Flavia, Luis emanuel, Laura Franca, Jose Marques, Gabriel Mourão, Eduarda, Carolina, Anna, Aimee, etc. (~24 linhas). Cada um traz um `PES.*` histórico.
- **Migrations via pg direto** (`reference_aplicar_migrations_pg_direto`): `npx tsx scripts/db-apply-pg.ts` da pasta `sistema-hv/`; dev=prod; rollback simétrico.

**Riscos:**
- **R1 — arquivado consegue logar.** Mitigação: sem conta Auth + gate `status ≠ ACTIVE`. Teste explícito (AC-2).
- **R2 — sumir histórico/autor.** Não usar `deleted_at`; manter o registro visível para joins de autoria. (AC-4)
- **R3 — colisão de índice único de e-mail** com arquivados sem e-mail. Mitigação: e-mail nulo ou sentinela por ID ProJuris.
- **R4 — arquivado vazando em seletor de atribuição.** Mitigação: `listAssignableUsers()` (só ativos) em TODOS os seletores; QA cobre cada tela.

### Testing
- `createArchivedUser({full_name:'Fulano', projuris_responsavel_id:'PES.0000040'})` → 1 linha `system_users` status ARCHIVED, sem Auth; 2ª chamada não duplica.
- Login com esse usuário → impossível (sem conta) / negado pelo gate.
- Seletor de responsável/assignee não lista o arquivado; admin lista com badge.
- `syncCaseJudicial` de caso com tarefa de autor arquivado → não quebra; nome exibido.
- `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Depende de (entregues):** `system_users` + `system_users_active` + `requireAuth`/`requireRole`/`requireModule` (`auth-guard.ts`); espelho judicial `judicial-sync.ts` (G1); `users-service.ts`/`rpc/users.ts`/`useUsers.ts`; seletores de atribuição (`AssigneeMultiSelect` e telas de caso/checklist).
- **Habilita:** **M15** (o importador de colaboradores cria os ~24 arquivados por este mecanismo, sem convite).
- **Relaciona com:** H5 (mapping por usuário — o arquivado pode ter mapping histórico `active=false`), G1/G5 (espelho judicial — autoria das tarefas), M12/M13 (motor não considera arquivado como executor ativo).

## File List (previsto — nada implementado até T0)

- `sistema-hv/supabase/migrations/2026080700000X_users_archived.sql` (+ rollback) — status `'ARCHIVED'` (ou flag `sem_acesso`) em `system_users`; possível view `system_users_assignable`.
- `sistema-hv/src/lib/supabase/types.ts` — novo status/flag.
- `sistema-hv/src/lib/users-service.ts` — `createArchivedUser`, `listAssignableUsers`, (opcional) `setUserArchived`; `listUsers` expõe estado arquivado.
- `sistema-hv/src/rpc/users.ts` — (opcional) `setUserArchivedFn` (gate admin).
- `sistema-hv/src/hooks/useUsers.ts` — hook para seletores só-ativos + estado arquivado.
- `sistema-hv/src/components/settings/UsersAdmin.tsx` — badge "Arquivado / sem acesso".
- `sistema-hv/src/components/cases/*` (seletores de atribuição) — trocar origem para `listAssignableUsers()`.
- `sistema-hv/src/lib/projuris/judicial-sync.ts` — garantir robustez com autor arquivado (de-para código→usuário).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-08 | v0.1 | Draft. Usuários **arquivados/desabilitados** do ProJuris entram como **REGISTRO sem acesso** em `system_users` (sem conta Auth, sem convite, sem login) para não quebrar o **espelho de tarefas do ProJuris** (aparecem como autor/responsável histórico). Mecanismo: `status='ARCHIVED'` (Opção A, recomendada) ou flag `sem_acesso` (Opção B) — a decidir em T0. Reusa o gate `requireAuth`/`requireRole` (já rejeita ≠ ACTIVE) + a ausência de conta Auth. Novo: `createArchivedUser`, `listAssignableUsers` (esconde arquivado dos seletores de atribuição ativa), badge na admin. Consumido por **M15** (importador cria os ~24 arquivados da planilha). | @sm (Bob) |
| 2026-08-08 | v1.0 | **Implementado** (@aios-master/Orion). **T0 = Opção A** (`status='ARCHIVED'`). Migration `20260808000060_users_archived_status.sql` (CHECK de status += `'ARCHIVED'` + reexpande view `system_users_active`) aplicada 2×. `createArchivedUser` em `users-service.ts`: insert SEM Auth/convite, `status='ARCHIVED'`+`status_projuris='desabilitado'`, id via `randomUUID()`, e-mail NOT NULL → sentinela `arquivado.<PES|slug>@sem-acesso.local`; idempotente (por e-mail, senão nome). `setUserStatus` passa a aceitar `ARCHIVED` (arquivar/desarquivar via RPC admin). **Some dos seletores de atribuição:** os principais (Tarefas/Prazos/Checklist/CaseForm/StageEditor) JÁ filtravam `status==='ACTIVE'` → arquivado excluído automático; corrigido também o `CaseSigiloSection` (não filtrava). Badge **"Arquivado / sem acesso"** no `UsersAdmin`. `sync-core` já ignora ≠ ACTIVE (M8). Typecheck+lint verdes. PENDENTE: RPC/hook `createArchivedUserFn` + wiring de-para código→system_users no `judicial-sync` (T4) ficam com o **M15** (importador em massa), que é o consumidor real. Não commitado. | @aios-master (Orion) |
