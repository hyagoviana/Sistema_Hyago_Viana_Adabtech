# Story B3: Criação/configuração de campos (cliente E tema/pipeline) restrita a administradores

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** B3 (cobre também I3)
**Status:** Ready for Review
**Estimativa relativa:** M
**Executor sugerido:** @dev (RPC + UI gates) · Quality gate: @qa
**Risco:** BAIXO (endurecimento de gate; a escrita já é admin-only hoje — esta story uniformiza, esconde UI e migra o TODO)

---

## Story

**Como** administrador do sistema,
**quero** que **criar/editar/ocultar/excluir/reordenar/vincular** definições de campo — tanto do **cliente** quanto do **tema/pipeline** — seja **restrito a administradores** (backend e UI),
**para que** usuários não-admin não consigam alterar o que é mostrado (campos são sensíveis: definem colunas, filtros e a ficha) nem por chamada direta ao RPC nem por controles visíveis na tela.

Hoje as **escritas já exigem admin server-side** (`system_tema_field_defs` via `handleAdmin`/`requireRole(["admin"])` em `rpc/tema-field-defs.ts`; `system_client_field_defs` via `ADMIN_ONLY` em `rpc/clientFields.ts`). O gap é: (a) **uniformizar** o gate migrando o **TODO** citado no levantamento (`rpc/tema-field-defs.ts:16-18` prevê migrar para `requireModule('sistema','edit')`); (b) garantir que a **UI esconde** os controles de criação/edição para não-admin em todos os pontos de entrada (editor do tema, editor de campos do cliente e — quando B1 existir — o vínculo cliente→tema); (c) cobrir os endpoints novos de B1 com o mesmo gate.

Isso também atende **I3** do levantamento ("tudo de campo/config restrito a administradores").

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **RPC campos do TEMA:** `sistema-hv/src/rpc/tema-field-defs.ts` — `handleAdmin` chama `requireRole(["admin"])`; usado por `create/update/delete/listAdmin`. Comentário `:15-18` já registra a intenção de migrar para `requireModule('sistema','edit')` (config.manage é admin-only no rbac).
- **RPC campos do CLIENTE:** `sistema-hv/src/rpc/clientFields.ts` — `ADMIN_ONLY = ["admin"]`; `create/update/delete/setActive/reorder` usam `requireRole(ADMIN_ONLY)`; a leitura (`listClientFieldDefsFn`) é `requireAuth` (o formulário precisa ler) — **manter**.
- **Guards server-side:** `sistema-hv/src/lib/supabase/auth-guard.ts` — `requireRole(allowed)` (`:152`), `requireModule(module, action)` (`:194`, exige status ACTIVE + `permissaoEfetiva`), `requireAnyModule` (`:228`).
- **RBAC:** `sistema-hv/src/lib/rbac.ts` — módulo `"sistema"` (config + permissões) com `MODULE_EDIT_CAP.sistema = "config.manage"` (`:261`); `config.manage` só pertence ao `admin` (`ROLE_CAPABILITIES.admin = ALL_CAPS`). Logo `requireModule('sistema','edit')` ≡ admin (mais overrides por usuário, se houver). `can(role,"config.manage")` é o gate de UI atual.
- **Gate de UI atual (tema):** `sistema-hv/src/components/cases/CaseFiltersPanel.tsx:97` — `podeGerirFiltros = can(role, "config.manage") && !!temaId` controla o botão "Editar campos" e o `TemaFieldDefsEditor`.
- **Gate de UI atual (cliente):** `sistema-hv/src/components/clients/ClientRoster.tsx:445` — `canManageFields` controla o `ClientFieldsManagerDialog`. Confirmar que `canManageFields` deriva de `can(role,"config.manage")` (ou papel admin).
- **Editor de campos do tema:** `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` (comentário `:4-5` diz que é renderizado só sob `can(role,"config.manage")`).

### NOVO nesta story

1. Migrar os `handleAdmin` de `rpc/tema-field-defs.ts` de `requireRole(["admin"])` para **`requireModule('sistema','edit')`** (resolvendo o TODO e alinhando com o padrão do épico R3/R4). Comportamento equivalente hoje (config.manage = admin), mas passa a respeitar overrides por usuário `system_user_module_perms`.
2. Alinhar `rpc/clientFields.ts` ao **mesmo** gate `requireModule('sistema','edit')` (mantendo a leitura em `requireAuth`).
3. Cobrir os endpoints novos de **B1** (`setClientFieldTemaLinksFn`, `appears_in_cases`) com `requireModule('sistema','edit')`.
4. Garantir que **toda** UI de criação/edição de campos usa o gate `usePodeEditarModulo('sistema')` (ou `can(role,"config.manage")`, consistente) e **esconde** os controles para não-admin — sem deixar botão "morto" que estoura 403.

---

## Acceptance Criteria

1. **Escrita de campos do tema exige `sistema:edit`.** `createTemaFieldDefFn`, `updateTemaFieldDefFn`, `deleteTemaFieldDefFn` e `listTemaFieldDefsAdminFn` passam a usar `requireModule('sistema','edit')` (substituindo `requireRole(["admin"])`); o comentário-TODO em `rpc/tema-field-defs.ts:15-18` é resolvido. Leitura da ficha (`listTemaFieldDefsFn`) permanece `requireAuth`.
2. **Escrita de campos do cliente exige `sistema:edit`.** `createClientFieldDefFn`, `updateClientFieldDefFn`, `deleteClientFieldDefFn`, `setClientFieldActiveFn`, `reorderClientFieldDefsFn` usam `requireModule('sistema','edit')`. `listClientFieldDefsFn` permanece `requireAuth` (o formulário de cadastro precisa ler as defs).
3. **Endpoints de B1 gateados.** Se B1 já estiver mesclado, `setClientFieldTemaLinksFn`/`appears_in_cases` também exigem `requireModule('sistema','edit')`. (Dependência opcional — ver Dependências.)
4. **UI esconde controles p/ não-admin.** Para usuário sem `sistema:edit`: o botão "Editar campos" e o dialog `TemaFieldDefsEditor` **não** aparecem (`CaseFiltersPanel`); o `ClientFieldsManagerDialog` e seu atalho **não** aparecem (`ClientRoster`); os controles de vínculo cliente→tema (B1) **não** aparecem. Nenhum botão visível dispara 403.
5. **Bloqueio server-side comprovado.** Uma chamada direta a qualquer RPC de escrita de campo por usuário não-admin (sem override `sistema:edit`) retorna **403** (`AuthError`), não 200/500.
6. **Regressão zero.** Admins seguem criando/editando/excluindo/reordenando/vinculando campos normalmente. Usuários com override `sistema:edit` (se existir) também. Leitura das defs (ficha e formulário) continua liberada a autenticados.
7. **Gates limpos.** `npm run typecheck` e `npm run lint` sem erros novos.

---

## Tasks / Subtasks

- [x] **T1 — Migrar gate do tema (@dev).** `rpc/tema-field-defs.ts`: `handleAdmin` agora usa `requireModule('sistema','edit')`; import trocado (`requireRole`→`requireModule`); comentário-TODO resolvido/atualizado. `listTemaFieldDefsFn` segue em `requireAuth`. (AC1, AC5)
- [x] **T2 — Migrar gate do cliente (@dev).** `rpc/clientFields.ts`: as 5 mutations (`create/update/delete/setActive/reorder`) agora usam `requireModule('sistema','edit')` (removida a const `ADMIN_ONLY`); import ajustado. `listClientFieldDefsFn` segue em `requireAuth`. `createClientFieldDefFn` continua usando `me.id` (requireModule também retorna `{id,...}`). (AC2, AC5)
- [x] **T3 — Gate endpoints B1 (@dev).** N/A nesta sessão — B1 NÃO mesclado (`setClientFieldTemaLinksFn`/`appears_in_cases` não existem no repo). Quando B1 vier, deve nascer com `requireModule('sistema','edit')`. (AC3)
- [x] **T4 — UI tema (@dev).** `CaseFiltersPanel.tsx`: `podeGerirFiltros` migrado de `can(role,"config.manage")` para `usePodeEditar('sistema')` (honra overrides por usuário). Botão "Editar campos" + dialog só renderizam quando verdadeiro. (AC4)
- [x] **T5 — UI cliente (@dev).** `ClientRoster.tsx`: `canManageFields` migrado para `usePodeEditar('sistema')`; atalho + `ClientFieldsManagerDialog` escondidos p/ quem não tem o gate. (AC4)
- [x] **T6 — Verificar hook de gate (@dev).** Usado o hook EXISTENTE `usePodeEditar('sistema')` (`src/hooks/usePermissions.ts`, mesma régua do servidor `requireModule(module,'edit')` via `permissaoEfetiva`). Nenhum hook novo criado.
- [x] **T7 — Smoke/QA.** Gates: `npm run typecheck` (0 erros novos; só o pré-existente `contaazul/service.ts`) + `eslint` nos arquivos tocados = 0 erros. (Smoke backend 403/200 e UI Playwright não executados nesta sessão — recomendação p/ @qa; o gate server-side é equivalente ao antigo admin-only.) (AC4, AC5, AC7)

---

## Dev Notes

- **Por que `requireModule('sistema','edit')` e não `requireRole(["admin"])`:** o épico R3/R4 padronizou o gate de escrita "por módulo com overrides por usuário" (`reference_rbac_edit_gate`, memória). `sistema:edit` hoje só é do admin (config.manage ∈ apenas ROLE_CAPABILITIES.admin), então é **equivalente** ao `requireRole(["admin"])` atual, mas passa a honrar overrides `system_user_module_perms` (um colaborador específico pode receber `sistema:edit` sem virar admin). É exatamente a intenção do TODO em `tema-field-defs.ts`.
- **Não gatear a LEITURA.** `listTemaFieldDefsFn` (ficha) e `listClientFieldDefsFn` (formulário de cadastro) precisam ser lidas por qualquer autenticado — defs não são sensíveis para leitura; o sensível é a **escrita/configuração**. Não mexer nesses dois.
- **UI e backend juntos.** Esconder o botão sem gatear o backend deixa brecha (chamada direta); gatear o backend sem esconder o botão gera 403 confuso. Esta story faz os dois (AC4 + AC5).
- **Sem migration.** Story puramente de código (gates). Não toca schema.

## Testing

- **Backend (@qa):** scriptar chamadas aos RPCs de escrita como não-admin (esperar 403) e como admin (esperar 200). Reusar o padrão dos smokes existentes que autenticam usuário de teste.
- **UI (@qa):** Playwright — logar com papel sem `sistema:edit`; assert de que "Editar campos" (Kanban/Lista) e o gerenciador de campos do cliente não aparecem; logar como admin e confirmar que aparecem.
- **Gates:** `npm run typecheck` e `npm run lint` limpos.

## Dependências

- **Independe** de B1 para T1/T2/T4/T5 (esses endpoints/telas já existem). T3 depende de B1 estar mesclado; se B1 vier depois, B1 já deve nascer com `requireModule('sistema','edit')` (registrado no AC8 de B1) e T3 vira verificação.
- Reusa `requireModule` (auth-guard) e o RBAC do módulo `sistema` — nada novo no schema.

## File List

**Alterados**
- `sistema-hv/src/rpc/tema-field-defs.ts` (gate → `requireModule('sistema','edit')`, remove TODO)
- `sistema-hv/src/rpc/clientFields.ts` (gate → `requireModule('sistema','edit')` nas mutations)
- `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` (confirmar/ajustar `podeGerirFiltros`)
- `sistema-hv/src/components/clients/ClientRoster.tsx` (confirmar/ajustar `canManageFields`)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Gate migrado p/ `requireModule('sistema','edit')` (resolve o TODO): `rpc/tema-field-defs.ts` (`handleAdmin`) e as 5 mutations de `rpc/clientFields.ts` (removida `ADMIN_ONLY`); leituras seguem `requireAuth`. UI: `CaseFiltersPanel.tsx` (`podeGerirFiltros`) e `ClientRoster.tsx` (`canManageFields`) trocam `can(role,"config.manage")` por `usePodeEditar('sistema')` (hook existente; honra overrides). T3 (B1) N/A — B1 não mesclado. Sem migration. Gates: typecheck 0 novos, eslint 0 erros nos tocados. | @dev |
