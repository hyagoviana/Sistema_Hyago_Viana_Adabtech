# Story H5: ID ProJuris + flag "participa da distribuição" no cadastro de Usuários/Permissões

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-05
- **ID:** H5
- **Status:** Ready for Review
- **Estimativa relativa:** M
- **Executor sugerido:** @dev + @data-engineer · Quality gate: @qa
- **Risco:** BAIXO/MÉDIO — mexe na tela de Usuários (admin) e escreve em `system_projuris_executor_mapping`; migration aditiva simples; sem tocar RBAC de login.
- **Origem:** Levantamento 2026-08-05 (`docs/reunioes/levantamento-2026-08-05-melhorias-e-motor-projuris.md`), Bloco **H, item H5** (*ACTION ITEM*). Sequência do motor (H.2) coloca H5 no passo 1 (junto de H1) porque "sem isso nada é rastreável".

---

## Story

**Como** administrador do escritório (gestão de Usuários e Permissões),
**quero** informar, no cadastro de cada usuário interno, o **ID do executor no ProJuris** (`projuris_responsavel_id`) e uma **flag "participa da distribuição"**, junto das regras do motor vinculadas a essa pessoa (**elegível a tarefas complexas** e **peso** na fila),
**para** que o motor de distribuição saiba **quem** são os executores reais, case cada tarefa do ProJuris (que só traz números) ao usuário certo do sistema, e distribua a carga com as regras corretas — tudo configurado **uma vez** na tela de usuário, sem reconfigurar a cada rodada (alinhado ao I2: menus de config como fonte da verdade).

> **DECISÕES TRAVADAS (reunião 2026-08-05):**
> 1. **Executor = usuário interno.** O executor do motor é a mesma pessoa que existe (ou pode existir) em `system_users`; o mapeamento é `projuris_responsavel_id (código ProJuris) ↔ system_users.id`.
> 2. **A fonte da verdade do executor passa a ser a tela de Usuários/Permissões**, não a tela `/controladoria/distribuicao/executores` (que hoje edita `system_projuris_executor_mapping` "solta", sem casar com o usuário de login). Setar o ID + flag no usuário **popula/atualiza** `system_projuris_executor_mapping`.
> 3. Os **códigos ProJuris já são conhecidos** via `GET /usuario` (A9 descobriu: THIAGO CORREIA SILVA=128858, THAISE=204546, etc. — 15 colaboradores). O admin pode **digitar** o código ou **escolher de uma lista** carregada do ProJuris (nice-to-have; digitar é o mínimo).
> 4. **Peso** e **elegível complexo** vivem no mapping (já existem como colunas). `authorized_task_types[]`/`authorized_themes[]` continuam configuráveis (mínimo: manter o default `{}`; expor na UI é nice-to-have desta story ou fica pra H6).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Tela de Usuários/Permissões:** `sistema-hv/src/routes/permissoes.tsx` (gate admin) → `sistema-hv/src/components/settings/UsersAdmin.tsx` (lista + diálogo "Editar usuário" com nome/telefone/cargo + `UserModulePermsEditor`).
- **Camada de dados de usuários:** `sistema-hv/src/rpc/users.ts` (server fns: `listUsersFn`, `updateUserProfileFn`, `setUserRoleFn`, …, todas via `handle()` + `requireAuth()`); serviço `sistema-hv/src/lib/users-service.ts` (`listUsers()` lê `system_users_active` → `id, email, full_name, phone, role, status, created_at`); hooks em `sistema-hv/src/hooks/useUsers.ts` (`useUsers`, `useUpdateUserProfile`, …).
- **Tabela do mapping (destino):** `system_projuris_executor_mapping` — criada em `sistema-hv/supabase/migrations/20260728000001_distribution_schema.sql:114` (`projuris_responsavel_id TEXT NOT NULL`, `executor_id UUID NOT NULL → system_users(id)`, `active`, UNIQUE `(projuris_responsavel_id, organization_id)`); estendida em `20260728000003_distribution_config.sql:29` com `weight NUMERIC(5,2) DEFAULT 1.0`, `eligible_complex BOOLEAN DEFAULT TRUE`, `authorized_task_types TEXT[] DEFAULT '{}'`, `authorized_themes TEXT[] DEFAULT '{}'`.
- **Seed dos executores reais:** `sistema-hv/supabase/migrations/20260805000001_distribution_executors_seed.sql` — já criou 15 `system_users` sintéticos (`projuris-<codigo>@projuris.local`, role `operacional`) + o mapping de cada um (UUID v5 determinístico por código). **Ponto de atenção:** esses são "executores do motor", NÃO contas de login. H5 precisa permitir casar/mesclar esses registros com usuários **reais** de login (ver Dev Notes / D-merge).
- **Tela atual de executores (a ser mantida como leitura/avançado):** `sistema-hv/src/routes/controladoria.distribuicao.executores.tsx` + hooks `useExecutorMappings`/`useUpsertExecutorMapping` em `sistema-hv/src/hooks/useDistribuicao.ts`. Hoje ela edita o mapping isolado (inclusive com o bug de usar `projuris_responsavel_id` como `executor_id` no "Novo Executor" — linha `:59`).
- **Como o motor consome:** `sistema-hv/src/lib/distribuicao/sync-core.ts:190-253` lê `system_projuris_executor_mapping` (`executor_id, active, weight, eligible_complex, authorized_task_types, authorized_themes`) + `system_users` (`id, full_name, status`) e só considera executor quem tem mapping ativo **e** `system_users.status === 'ACTIVE'`.

### NOVO (a construir nesta story)

- **Campos no diálogo "Editar usuário"** (`UsersAdmin.tsx`): "ID ProJuris (executor)" (texto/numérico), "Participa da distribuição" (switch), "Elegível a tarefas complexas" (switch), "Peso na fila" (número). Só admin (a tela já é admin-only).
- **Indicador na lista** de usuários: badge/coluna "Distribuição: sim/não" (+ código ProJuris) para o admin ver rapidamente quem é executor.
- **Server fn** `setUserDistributionFn` (novo em `src/rpc/users.ts`) + serviço `setUserDistribution()` (em `users-service.ts`) que faz **upsert** em `system_projuris_executor_mapping` a partir de `system_users.id`: grava `projuris_responsavel_id`, `active` (= flag participa), `weight`, `eligible_complex`. `ON CONFLICT (projuris_responsavel_id, organization_id)` e também trata o caso de o usuário já ter um mapping (update por `executor_id`).
- **Leitura conjunta:** `listUsers()` (ou um endpoint irmão) passa a devolver, por usuário, os dados de distribuição (`projuris_responsavel_id`, `participa`=active, `weight`, `eligible_complex`) via join/lookup em `system_projuris_executor_mapping`.
- **Migration** só se necessária (ver Dev Notes): as colunas do mapping já existem; provável DDL **zero**. Se for preciso um índice por `executor_id` (para lookup rápido usuário→mapping) ou relaxar algo, migration aditiva + rollback.

---

## Acceptance Criteria

1. **Campo ID ProJuris no usuário:** no diálogo "Editar usuário" (`UsersAdmin.tsx`), o admin vê e edita um campo **"ID ProJuris (executor)"** que corresponde ao `projuris_responsavel_id` do `system_projuris_executor_mapping` daquele usuário. Aceita o código numérico do ProJuris (ex.: `128858`). Vazio = usuário sem código ProJuris.
2. **Flag participa da distribuição:** no mesmo diálogo há um switch **"Participa da distribuição"**. Ligado ⇒ o mapping do usuário fica `active=true`; desligado ⇒ `active=false` (o motor deixa de considerá-lo — `sync-core.ts` filtra `active`). A flag só faz sentido quando há um ID ProJuris; a UI orienta (não deixa "participa" sem código, ou avisa).
3. **Regras vinculadas ao usuário:** o diálogo permite setar **"Elegível a tarefas complexas"** (→ `eligible_complex`) e **"Peso na fila"** (→ `weight`, numérico > 0). Defaults: `eligible_complex=true`, `weight=1.0` (batem com as colunas).
4. **Persistência via mapping:** salvar essas regras faz **upsert** em `system_projuris_executor_mapping` com `executor_id = system_users.id`, `projuris_responsavel_id = <ID digitado>`, `organization_id = DEFAULT_ORG`, respeitando o UNIQUE `(projuris_responsavel_id, organization_id)`. Reexecutar o save **não duplica** (upsert idempotente). Trocar o ID ProJuris de um usuário atualiza o mapping existente (não cria órfão).
5. **Autorização:** o endpoint que grava a distribuição do usuário exige **admin** (mesmo padrão de `setUserRoleFn`/`reassignAndDeleteUserFn` em `src/rpc/users.ts`: `requireAuth()` + `getUserRole(me.id) === 'admin'`, 403 caso contrário).
6. **Leitura na lista:** a lista de usuários (`UsersAdmin.tsx`) indica, por linha, se o usuário **participa da distribuição** e mostra o **código ProJuris** (badge/coluna discreta), consumindo os dados devolvidos por `listUsers()` (ou endpoint irmão) com o join no mapping.
7. **O motor casa por esse mapeamento:** após configurar 2+ usuários como executores via a tela, uma sincronização (`runSync` em `sync-core.ts`) considera exatamente esses usuários (mapping ativo + `system_users.status='ACTIVE'`) e nenhum outro; o `byExecutor` do `SyncSummary` mostra os nomes reais.
8. **Compatibilidade com o seed:** os 15 executores já semeados (`20260805000001`) continuam funcionando; a tela permite (a) **editar** peso/elegível/flag deles e (b) **re-apontar** o `executor_id` para um usuário de login real quando o admin fizer o merge (ver Dev Notes / decisão D-merge), sem violar o UNIQUE nem deixar 2 mappings para o mesmo código.
9. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; `db:types` regenerado se houver DDL; RLS org-scoped preservada; a tela `/controladoria/distribuicao/executores` continua funcionando (ou é marcada como "avançada/leitura"); nenhum segredo/PII vaza para log.

---

## Tasks / Subtasks

### T0 — Decisão de merge executor↔usuário (@architect + @dev) — antes de codar
- [x] Resolver **D-merge** (ver Dev Notes): **Opção A travada.** A tela de Usuários edita a distribuição do usuário REAL; o `setUserDistribution` re-aponta o `executor_id` do mapping do código para o usuário real (UPDATE por código quando o código já existe — ex.: sintético do seed). Um código tem no máximo 1 executor (UNIQUE). O antigo mapping do usuário (se apontava outro código) é removido para não deixar 2 mappings. Sem migration. (AC-8)

### T1 — Camada de dados (@dev)
- [x] `setUserDistribution(userId, { projuris_responsavel_id, participa, weight, eligible_complex })` em `sistema-hv/src/lib/users-service.ts`: upsert em `system_projuris_executor_mapping` (por `executor_id`/UNIQUE), `active = participa`. Trata troca de código (update do registro existente, sem insert órfão) e re-aponta código de sintético→real. (AC-4, AC-8)
- [x] Estendi `listUsers()` para trazer `projuris_responsavel_id`, `participa_distribuicao`, `weight`, `eligible_complex` por usuário (lookup no mapping por `executor_id`). Novo tipo `UserWithDistribution`. (AC-6)
- [x] `setUserDistributionFn` em `sistema-hv/src/rpc/users.ts` (gate admin, padrão `setUserRoleFn`). (AC-5)

### T2 — UI (@dev)
- [x] Bloco "Distribuição (ProJuris)" no diálogo "Editar usuário" (`UsersAdmin.tsx`): ID ProJuris (Input), Participa (Switch), Elegível complexo (Switch), Peso (Input number). Valida "participa sem código" no cliente. (AC-1,2,3)
- [x] Hook `useSetUserDistribution` em `sistema-hv/src/hooks/useUsers.ts` (mutation + invalidate `["system-users"]` e `["executor-mappings"]`). `salvarPerfil` chama a mutation junto do perfil/cargo. (AC-4)
- [x] Badge discreto na lista ("Distribuição · <código>") para quem participa. (AC-6)
- [ ] (nice-to-have) autocomplete do código a partir de `GET /usuario` — NÃO feito (digitar o código é suficiente; H1 traz o de-para).

### T3 — Migration (só se necessária) (@data-engineer)
- [x] Verificado: as colunas do mapping (`weight`/`eligible_complex`/`authorized_*` de `20260728000003`) já cobrem tudo. **DDL zero** — nenhuma migration criada. `db:types` já contém as colunas. (AC-9)

### T4 — QA (@qa)
- [ ] Setar 2 usuários como executores pela tela; conferir mapping no banco (upsert, sem duplicata ao salvar 2×). (AC-4)
- [ ] Desligar "participa" de um; rodar `runSync` (ou simulação) e confirmar que ele sai do `byExecutor`. (AC-2,7)
- [ ] Tentar salvar como não-admin → 403. (AC-5)
- [ ] `typecheck` + `lint` verdes; tela `/controladoria/distribuicao/executores` intacta. (AC-9)

---

## Dev Notes

**A infra do mapping já existe — H5 é UI + endpoint + reconciliação.** As colunas `weight`/`eligible_complex`/`authorized_*` foram entregues em `20260728000003`; H5 provavelmente não precisa de DDL nova. O trabalho é: (1) trazer esses dados para a tela de Usuários (fonte da verdade, D2 da story), (2) um endpoint admin que faz o upsert por `system_users.id`, (3) reconciliar com o seed dos 15 sintéticos.

**D-merge (decisão de arquitetura — T0).** O seed `20260805000001` criou usuários **sintéticos** (`projuris-128858@projuris.local`, role `operacional`, status `ACTIVE`) só para satisfazer a FK `executor_id → system_users(id)`. Quando o escritório quiser que "THIAGO CORREIA SILVA" seja o **usuário de login real** que também é executor, o admin precisa poder **re-apontar** o mapping do código `128858` para o `system_users.id` do login real. O upsert de T1 deve suportar isso: dado o código, se já existe mapping, faz `UPDATE ... SET executor_id = <novo user>`; o UNIQUE é por `(projuris_responsavel_id, organization_id)`, então um código só tem 1 executor. Cuidar para não deixar o usuário sintético órfão sem uso (opcional: marcá-lo inativo).

**O motor filtra por status ACTIVE.** `sync-core.ts:242` só inclui executores cujo `system_users.status === 'ACTIVE'`. Então "participa da distribuição" (mapping `active`) **e** status do usuário ativo são condições combinadas — a UI deve deixar isso claro (um usuário suspenso não distribui, mesmo com a flag ligada).

**Bug legado a evitar/reparar.** `controladoria.distribuicao.executores.tsx:59` usa `executor_id: projurisId` no "Novo Executor" (grava o CÓDIGO ProJuris no campo que é FK UUID → quebra). H5 resolve isso movendo a origem da verdade para a tela de usuário (onde `executor_id` = `system_users.id` real). Considerar marcar a criação-de-executor-solta na tela antiga como somente-edição/leitura para não recriar o bug.

**Migrations via pg direto.** CLI Supabase quebrado no Windows/OneDrive — aplicar qualquer DDL/seed via `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/` (ver `reference_aplicar_migrations_pg_direto`). dev=prod; rollbacks em `sistema-hv/supabase/rollbacks/`.

**Riscos:**
- **R1 — órfãos no mapping.** Trocar o ID ProJuris sem update do registro existente cria mapping órfão. Mitigação: upsert por `executor_id` primeiro, depois reconciliar por código.
- **R2 — colisão de código.** Dois usuários apontando o mesmo `projuris_responsavel_id` viola o UNIQUE. A UI deve tratar o erro (mensagem clara) e não permitir 2 usuários com o mesmo código.
- **R3 — confusão sintético×real.** Sem a decisão D-merge clara, o admin pode configurar peso no sintético e o motor usar o real (ou vice-versa). T0 trava isso antes de codar.

### Testing
- Setar `projuris_responsavel_id=128858`, participa=on, weight=1.5, elegível=on num usuário → conferir 1 linha em `system_projuris_executor_mapping` com esses valores. Salvar de novo → sem 2ª linha.
- Desligar participa → mapping `active=false`; `runSync` não o lista.
- Não-admin chamando `setUserDistributionFn` → 403.
- Lista de usuários mostra o badge "Distribuição: sim (128858)".
- `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Depende de (entregues):** `system_projuris_executor_mapping` + colunas de config (`20260728000001`/`20260728000003`); seed dos executores (`20260805000001`); tela/serviço/hooks de Usuários (`permissoes.tsx`, `UsersAdmin.tsx`, `users-service.ts`, `rpc/users.ts`, `useUsers.ts`); consumo pelo motor (`sync-core.ts`).
- **Relaciona com H1** (ID→nome no normalizador): H5 fornece o de-para executor→usuário que H1 usa para exibir nomes.
- **Relaciona com H6** (config de tipos de tarefa): `authorized_task_types[]`/`authorized_themes[]` do executor podem ser expostos aqui ou lá; alinhar.
- **Não** depende do write-back (H3/A9-fase-2) nem da auth (já destravada em A9).

## File List

**A definir na implementação. Previsto:**
- `sistema-hv/src/lib/users-service.ts` (novo `setUserDistribution` + estender `listUsers`).
- `sistema-hv/src/rpc/users.ts` (novo `setUserDistributionFn`, gate admin).
- `sistema-hv/src/hooks/useUsers.ts` (novo `useSetUserDistribution`; talvez ajustar `useUsers`).
- `sistema-hv/src/components/settings/UsersAdmin.tsx` (bloco Distribuição no diálogo + badge na lista).
- `sistema-hv/src/routes/controladoria.distribuicao.executores.tsx` (marcar como avançada/leitura; corrigir bug `executor_id`).
- `sistema-hv/supabase/migrations/20260805xxxxxx_executor_mapping_by_user.sql` (+ rollback) **só se** um índice/DDL for necessário.

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-05 | v0.1 | Draft inicial. ID ProJuris (`projuris_responsavel_id`) + flag "participa da distribuição" + peso + elegível-complexo no diálogo de Usuários/Permissões (`UsersAdmin.tsx`), gravando via upsert em `system_projuris_executor_mapping` por `executor_id = system_users.id` (endpoint admin). Reusa colunas já entregues em `20260728000003` e o seed `20260805000001`. Decisão D-merge (executor sintético↔usuário real) trava T0. Provável DDL zero. | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). D-merge = Opção A (tela de usuário é a fonte da verdade; `setUserDistribution` re-aponta o `executor_id` do código sintético→real, UNIQUE por código, sem órfãos). Arquivos: `src/lib/users-service.ts` (`setUserDistribution` + `listUsers` estendido → `UserWithDistribution`), `src/rpc/users.ts` (`setUserDistributionFn`, gate admin), `src/hooks/useUsers.ts` (`useSetUserDistribution`), `src/components/settings/UsersAdmin.tsx` (bloco Distribuição no diálogo + badge na lista + save junto), `src/routes/controladoria.distribuicao.executores.tsx` (tela marcada como AVANÇADA/edição-só; corrigido o bug legado `executor_id: projurisId` removendo a criação-solta; ID ProJuris read-only). Migrations: NENHUMA (DDL zero — colunas já existiam). Gates: `npm run typecheck` verde (só erro pré-existente em `contaazul/service.ts`); `eslint` 0 erros nos arquivos tocados (prettier + `any` tipados). db:push não necessário. | @dev |
