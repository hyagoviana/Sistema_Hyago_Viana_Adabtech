# Story R3-01: Infraestrutura de permissão efetiva (tabela + `permissaoEfetiva`)

- **Épico:** R3 — Permissões por módulo + reorganização de módulos (bloco B3 / D3 / E4)
- **ID:** R3-01
- **Status:** Ready for Review
- **Estimativa relativa:** M (migration tabela `system_user_module_perms` + 1 função pura `permissaoEfetiva` + RPC/hook de leitura, **zero mudança de comportamento**)
- **Executor sugerido:** @data-engineer (migration) + @dev (rbac.ts/serviço/RPC) · Quality gate: @architect
- **Ordem na Sequência Segura (doc-mestre §7):** passo 1 — **base de tudo**; nenhuma outra story de R3/R4 começa antes desta.

---

## Story

**Como** administrador do sistema,
**quero** uma camada de **permissão efetiva** que combine o papel (base) com **overrides por usuário×módulo** (`ver`/`editar`/`não ver`),
**para que** eu possa liberar/restringir módulos por pessoa **sem** trocar o papel dela e **sem** quebrar nenhum gate existente (cai de volta no papel quando não há override).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (verificado no código)
- **9 papéis** em `src/lib/rbac.ts:7-19` (`ROLES`, `Role`), 1 por usuário (`system_users.role`, CHECK).
- **7 capabilities** em `rbac.ts:48-89`: `ROLE_CAPABILITIES` + `can(role, cap)`.
- **Navegação** `ROLE_NAV` + `canSeeRoute(role, to)` (`rbac.ts:118-169`).
- **Visibilidade** `seesOnlyOwnCases` / `OWN_CASES_ONLY_ROLES` (`rbac.ts:97-107`) + `isAdvogado` (`rbac.ts:110-112`).
- **Guards RPC** `requireAuth` / `requireRole` (`src/lib/supabase/auth-guard.ts:88-170`).
- **Contexto de auth** `useAuth()` já expõe `{ session, profile, role }` (`src/lib/auth.tsx:100-108`) lendo de `system_users_active`.
- **Migrations** aplicadas via `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` (pg direto; CLI Supabase quebrado no Windows/OneDrive). Padrão de rollback em `sistema-hv/supabase/rollbacks/*.rollback.sql`.

### NOVO
- Tabela `system_user_module_perms (user_id, module, access)` — overrides opcionais.
- Tipo `Module` + `ModuleAccess` (`none | view | edit`) e a função pura **`permissaoEfetiva(user, module, action)`** em `rbac.ts` (fonte única).
- RPC + hook de leitura dos overrides do usuário logado, para o front decidir gates (as stories seguintes consomem).

> **DECISÃO TRAVADA (doc-mestre D3, §4.4, §5.4):** **ADITIVO**. Papel continua a base; overrides por usuário×módulo apenas somam/subtraem. `permissaoEfetiva` **cai de volta no papel** se não houver override. **NÃO fazer apagão** dos 42 pontos de `role` — esta story só cria a infra; a migração ponto-a-ponto é R3-02/R3-03.

---

## Módulos canônicos (doc-mestre §4.3)

`comercial` · `operacional` · `financeiro` · `controladoria` · `inteligencia` · `marketing` · `sistema` (config/permissões).

> A definição da lista `MODULES` e o **mapa papel→módulo→acesso** (derivação base) ficam nesta story, em `rbac.ts`, para servir de fonte única. O mapa deve reproduzir **exatamente** o comportamento atual de `ROLE_NAV`/`ROLE_CAPABILITIES` (ver AC-4 / teste de regressão).

---

## Acceptance Criteria

1. **Migration** cria `system_user_module_perms` com `user_id` (FK `system_users.id`, `ON DELETE CASCADE`), `module TEXT` (CHECK na lista de módulos), `access TEXT` CHECK `IN ('none','view','edit')`, PK/UNIQUE `(user_id, module)`, `created_at/updated_at`, grants nos 3 roles (`anon, authenticated, service_role`) coerentes com as demais tabelas `system_*`. Rollback correspondente (DROP tabela).
2. `permissaoEfetiva(user, module, action)` retorna:
   - Se **existe** override para `(user, module)` → decide **pelo override** (`none`⇒bloqueia; `view`⇒permite `view`, nega `edit`; `edit`⇒permite ambos).
   - Se **não existe** override → decide **pelo papel** (mapa base que espelha o comportamento atual).
   - `user`/`role` nulo ⇒ `false` (mesma postura defensiva de `can`/`canSeeRoute`).
3. A função é **pura** (recebe os overrides já carregados como argumento — não faz I/O), para ser testável e usável no client e no server. Uma função server-side auxiliar carrega os overrides de `system_user_module_perms` (via admin client) e é cacheável por request (padrão do `tokenCache` do auth-guard).
4. **Regressão zero:** com a tabela **vazia** (nenhum override), `permissaoEfetiva` produz o **mesmo** resultado que `can`/`canSeeRoute` para **todos os 9 papéis** — provado por teste de tabela (papel × módulo × ação). Nenhum gate existente muda de comportamento nesta story.
5. RPC `getMyModulePermsFn` (GET, `requireAuth`) devolve os overrides do usuário logado; hook `useMyModulePerms()` disponível para o front (consumido em R3-02/R3-04/R3-05). Sem override configurado ⇒ lista vazia (front cai no papel).

---

## Tasks / Subtasks

- [x] **Migration** `supabase/migrations/20260718000001_user_module_perms.sql` (AC: 1)
  - [x] `CREATE TABLE IF NOT EXISTS system_user_module_perms (...)` com CHECKs de `module` e `access`, UNIQUE `(user_id, module)`, FK `ON DELETE CASCADE`.
  - [x] Índice `idx_system_user_module_perms_user` em `(user_id)`.
  - [x] `GRANT SELECT, INSERT, UPDATE, DELETE ... TO service_role` + `SELECT` a `authenticated` conforme padrão das demais tabelas `system_*` (espelhado de `system_case_checklist_item_assignees`).
  - [x] Trigger/`updated_at` via `system_update_updated_at_column()` (mesma função das demais tabelas `system_*`).
  - [x] **NÃO** tocar `system_cases`/views/CHECKs de lifecycle (regra de ouro 5 do doc-mestre).
  - [x] Rollback `supabase/rollbacks/20260718000001_user_module_perms.rollback.sql` (`DROP TABLE IF EXISTS ... CASCADE`).
- [x] **rbac.ts** (AC: 2,3,4)
  - [x] Exportar `MODULES` (`comercial|operacional|financeiro|controladoria|inteligencia|marketing|sistema`), tipos `Module`, `ModuleAccess = 'none'|'view'|'edit'`, `ModuleAction = 'view'|'edit'`.
  - [x] Mapa base `ROLE_MODULE_ACCESS: Record<Role, Record<Module, ModuleAccess>>` derivado de `ROLE_NAV`/`ROLE_CAPABILITIES` (correspondência rota↔módulo e cap↔módulo documentada no código).
  - [x] `permissaoEfetiva(role, overrides, module, action)` **pura**: override tem precedência; senão mapa base; `null`⇒false.
  - [x] **Não remover** `can`/`canSeeRoute`/`seesOnlyOwnCases`/`isAdvogado` — permanecem (R3-02/03 migram os call-sites incrementalmente).
- [x] **Serviço server** — `getUserModulePerms(userId)` em `src/lib/rbac-perms-service.ts` (novo) lendo `system_user_module_perms` (admin client), retornando `Partial<Record<Module, ModuleAccess>>`.
- [x] **RPC/hook** (AC: 5) — `getMyModulePermsFn` em `src/rpc/permissions.ts` (novo, `requireAuth`) + `useMyModulePerms()` em `src/hooks/usePermissions.ts` (novo).
- [x] **types.ts** — `system_user_module_perms` Row/Insert/Update em `src/lib/supabase/types.ts`.
- [x] **Testes** (AC: 4) — tabela papel×módulo×ação (9×7×2=126) provando equivalência com `can`/`canSeeRoute` quando não há override; casos de override (`none`/`view`/`edit`); `null`⇒false. Lint + typecheck verdes (sem regressão).

---

## Dev Notes

**Estratégia de fallback (o coração da story):** `permissaoEfetiva` é **aditiva**. A precedência é `override > papel`. Enquanto a tabela estiver vazia, todo consumidor futuro obtém exatamente o resultado do papel — por isso R3-01 pode entrar em produção sem risco (regressão zero, AC-4). Os 42 pontos NÃO mudam aqui.

**Inventário dos 42 pontos de `role` (16 arquivos) — mapa para R3-02/R3-03 (não migrar nesta story):**

*Gates de UI (migram em R3-02):*
- `src/routes/casos.$id.tsx:100-101` — `can(role,'financeiro.manage')`, `can(role,'casos.manage')`.
- `src/routes/pipeline.tsx:95,322` — `can(role,'config.manage')`.
- `src/routes/casos.financeiro.index.tsx:75,227` — `can(role,'config.manage')`.
- `src/routes/comercial.leads.tsx:54` — `can(role,'config.manage')`.
- `src/routes/comercial.funil.tsx:209` — `can(role,'config.manage')`.
- `src/components/clients/ClientRoster.tsx:130` — `can(role,'config.manage')`.
- `src/routes/permissoes.tsx:14` — `role === 'admin'`.
- `src/routes/configuracoes.tsx:18` — `role === 'admin'`.
- `src/components/cases/CaseFormDialog.tsx:73-75` — `isAdvogado`.
- `src/components/hv/Sidebar.tsx:34,227-229` — `canSeeRoute` + `role==='admin'` (migra em R3-04).

*Guards / lógica server (migram em R3-03):*
- `src/lib/supabase/auth-guard.ts:150-170` — `requireRole` (adicionar variante módulo-aware `requireModule`).
- `src/rpc/clientFields.ts:60,74,83,94,103` — `requireRole(ADMIN_ONLY)`.
- `src/rpc/checklist.ts:74,97,106,115` — `requireRole(ADMIN_ONLY)`.
- `src/rpc/users.ts:163` — `setUserRole`.
- `src/rpc/financeiro.ts`, `src/rpc/asaas.ts`, `src/rpc/contaazul.ts`, `src/rpc/termo.ts` — hoje só `requireAuth()` (sem gate `$`; alvo de **R4**, que depende desta infra).
- `src/lib/visibility.ts:24-25,85-86` — `seesOnlyOwnCases` (visibilidade de casos).
- `src/lib/dossie-service.ts:361` — `seesOnlyOwnCases`.
- `src/lib/case-responsaveis-service.ts:24-27,66` — `seesOnlyOwnCases`.

**Migrations:** aplicar com `npx tsx scripts/db-apply-pg.ts supabase/migrations/20260718000001_user_module_perms.sql`. Banco dev == prod (memória do projeto) — cuidado.

**Regras de ouro (doc-mestre §7 / regras da tarefa):** aditivo (não remover papéis nem funções existentes); prefixo `system_`; migration idempotente + rollback; não quebrar guards existentes; não tocar `case_type`/`macrostatus_*`/views/CHECKs de lifecycle.

### Testing
- Tabela vazia ⇒ `permissaoEfetiva` == comportamento atual p/ os 9 papéis (AC-4).
- Override `none` no módulo `financeiro` p/ um `advogado_titular` ⇒ `permissaoEfetiva(...,'financeiro','view') === false`, mesmo que o papel permita.
- Override `edit` num módulo que o papel não teria ⇒ permite (aditivo).
- `getMyModulePermsFn` sem overrides ⇒ `[]`.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases

- Migration cria tabela com grants nos 3 roles (herda o padrão "Caso 18" do grupo E das matrizes anteriores, adaptado — tabela nova, não view).
- Regressão por papel (9×7×2) documentada no teste.

---

## Dependências

- **Depende de:** nada (é a base). Migrations recentes: última é `20260710000003` — o prefixo `20260718000001` é seguro.
- **Habilita:** R3-02 (gates UI), R3-03 (guards RPC), R3-04 (Sidebar/reorg), R3-05 (dashboard RBAC), R3-06 (tela de gestão) **e R4** (desacoplar $ — a regra transversal `financeiro:view` usa `permissaoEfetiva`).

---

## Cruzamentos com outros épicos

- **R4 (desacoplar Financeiro)** DEPENDE desta infra: gates de `$` = `permissaoEfetiva(user,'financeiro','view')` (doc-mestre §4.4, §5.3).
- **R2 (Tema/Frente)** usa a regra "criar Tema/Frente = só admin" — que passará por `permissaoEfetiva(...,'sistema','edit')` / `role==='admin'` (P4).
- **R6 (Controladoria)** usa permissão operacional (quais frentes/tipos cada usuário atende) — desenhada em alto nível em R3-04/R3-06 (P7).

---

## File List

- `sistema-hv/supabase/migrations/20260718000001_user_module_perms.sql` (novo — tabela + índice + trigger updated_at + grants)
- `sistema-hv/supabase/rollbacks/20260718000001_user_module_perms.rollback.sql` (novo — DROP tabela/trigger)
- `sistema-hv/src/lib/rbac.ts` (adicionado: `MODULES`, `MODULE_LABELS`, tipos `Module`/`ModuleAccess`/`ModuleAction`, `ROLE_MODULE_ACCESS`, `permissaoEfetiva`; nada removido)
- `sistema-hv/src/lib/rbac-perms-service.ts` (novo — `getUserModulePerms`, server-only, admin client, cache por request, tolerante à ausência da tabela)
- `sistema-hv/src/rpc/permissions.ts` (novo — `getMyModulePermsFn`, GET + `requireAuth`)
- `sistema-hv/src/hooks/usePermissions.ts` (novo — `useMyModulePerms`)
- `sistema-hv/src/lib/supabase/types.ts` (adicionado bloco `system_user_module_perms` Row/Insert/Update/Relationships)
- `sistema-hv/src/lib/rbac.test.ts` (novo — teste de regressão 9×7×2 + overrides + null, runner standalone `tsx`)
- `sistema-hv/package.json` (adicionado scripts `typecheck` e `test:rbac`)

## Dev Agent Record

### Agent Model Used
Opus 4.8 (1M context) — @dev (James)

### Debug Log / Comandos de validação
- `npm run test:rbac` → **18/18 asserts verdes**, incluindo as 126 combinações papel×módulo×ação (AC-4, regressão zero), overrides `none`/`view`/`edit`, isolamento por módulo e postura defensiva (`role` nulo ⇒ false).
- Typecheck (`npx tsc --noEmit`): **0 erros nos arquivos desta story**. A base do repo já tinha erros de `types.ts` desatualizado (tabelas `system_case_checklist_item_assignees`/`system_stage_checklist_def_assignees`/etc. nunca foram adicionadas ao placeholder). Baseline **41** erros → com esta story **22** (a adição do bloco `system_user_module_perms` estreitou a inferência do union do PostgREST e reduziu ruído). Nenhum dos 22 remanescentes está em arquivo criado/alterado por mim (checklist-service/dossie-service/termo-service/visibility/casos.*). Regressão de typecheck = **zero**.
- Lint (`eslint`) nos 6 arquivos novos/alterados: **0 erros** (após `prettier --write` — `rbac.ts` estava com CRLF por causa do OneDrive; normalizado para LF).

### Completion Notes
1. `permissaoEfetiva` é **pura**: recebe `overrides` já carregados, sem I/O. Precedência `override > papel`; sem override cai em `ROLE_MODULE_ACCESS`; `role` nulo ⇒ `false`.
2. `ROLE_MODULE_ACCESS` é **derivado** de `ROLE_NAV`/`ROLE_CAPABILITIES` no load do módulo (não hardcoded) via `MODULE_VIEW_ROUTE` (view) + `MODULE_EDIT_CAP` (edit). O teste usa um **oráculo independente** (chama `can`/`canSeeRoute` direto, sem tocar `ROLE_MODULE_ACCESS`) para provar equivalência — se a derivação divergir do comportamento atual, o teste quebra.
3. Módulos sem capability de escrita dedicada hoje (`inteligencia`, `marketing`): `edit == view` (não existe gate mais estrito para espelhar). Documentado no código.
4. `getUserModulePerms` é **tolerante à ausência da tabela** (retorna `{}` em qualquer erro) — regressão zero mesmo ANTES de aplicar a migration.

### Decisões / Desvios
- **Runner de teste:** o projeto não tem vitest/jest nem script `test` — o padrão real é `.test.ts` standalone via `tsx` (ex.: `src/lib/validators/client.test.ts`). Segui esse padrão e adicionei `test:rbac` ao `package.json` (em vez de introduzir vitest, o que seria fora de escopo).
- **`typecheck` script:** não existia; adicionei `"typecheck": "tsc --noEmit"` ao `package.json` para atender à validação pedida.
- **Migration NÃO aplicada** ao banco (dev==prod) conforme restrição — arquivo `.sql` pronto para aplicação posterior autorizada via `npx tsx scripts/db-apply-pg.ts`.
- **Sem git commit/push** — mudanças deixadas no working tree.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (fatiado de B3/D3/E4 do doc-mestre reforma-2026-07-18) | @sm |
| 2026-07-18 | 0.3 | Implementação completa: migration+rollback `system_user_module_perms`, `MODULES`/tipos/`ROLE_MODULE_ACCESS`/`permissaoEfetiva` em rbac.ts, serviço `getUserModulePerms`, RPC `getMyModulePermsFn` + hook `useMyModulePerms`, tipos em types.ts, teste de regressão 9×7×2. Lint/typecheck verdes (regressão zero). Migration não aplicada. Status → Ready for Review. | @dev |
| 2026-07-18 | 0.4 | Nota de régua: a régua BASE do `ROLE_MODULE_ACCESS` mudou APENAS para o módulo `financeiro` (decisão do dono, épico R4). O `financeiro` deixou de espelhar o NAV — passou a `{ admin: edit, financeiro: edit, demais: none }` via override pós-derivação em rbac.ts. É a primeira aba com régua de NEGÓCIO própria; os demais módulos seguem espelhando ROLE_NAV/ROLE_CAPABILITIES (regressão zero preservada). O teste de regressão passou a tratar `financeiro` como exceção documentada (108 combinações 9×6×2 vs oráculo + casos explícitos do financeiro). `permissaoEfetiva` e a precedência de overrides não mudaram. | @dev |
