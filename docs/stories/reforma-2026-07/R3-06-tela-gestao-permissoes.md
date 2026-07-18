# Story R3-06: Tela de gestão — editar permissões por usuário×módulo (ver/editar/não ver)

- **Épico:** R3 — Permissões por módulo + reorganização de módulos (B3 / D3 / E4 — tela de gestão)
- **ID:** R3-06
- **Status:** Draft
- **Estimativa relativa:** M (matriz usuário×módulo na aba Permissões + RPC de leitura/escrita de overrides, admin-only)
- **Executor sugerido:** @dev + @ux-design-expert · Quality gate: @architect + @qa
- **Ordem:** por último no épico (consome toda a infra; valida o efeito de ponta a ponta).

---

## Story

**Como** administrador,
**quero** uma tela para definir, por **usuário × módulo**, o acesso **ver / editar / não ver**,
**para que** eu ajuste permissões finas sem trocar o papel da pessoa, e o efeito apareça imediatamente no Sidebar, nos gates e no dashboard.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (verificado)
- **Aba Permissões** `src/routes/permissoes.tsx` — hoje renderiza `UsersAdmin` (`src/components/settings/UsersAdmin.tsx`), restrita a admin (`permissoes.tsx:14,25`).
- `UsersAdmin` já edita **papel** e status por usuário (`UsersAdmin.tsx:71-205,283`), com `useUsers`/`setRole` (`src/hooks/useUsers.ts`, `src/rpc/users.ts:163`).
- Guards admin: `requireRole(ADMIN_ONLY)` (padrão em `clientFields.ts`/`checklist.ts`) e o novo `requireModule` (R3-03).
- Infra R3-01: tabela `system_user_module_perms`, `MODULES`, `permissaoEfetiva`, `getUserModulePerms`.

### NOVO
- Sub-tela/painel na aba Permissões: **matriz usuário × módulo** com seletor `não ver | ver | editar` por célula (default = "herda do papel" quando não há override).
- RPC admin: `getUserModulePermsFn(userId)` (leitura) + `setUserModulePermFn(userId, module, access)` / `clearUserModulePermFn(userId, module)` (escrita/limpeza → volta a herdar do papel).

> **DECISÃO TRAVADA:** editar por **usuário×módulo** com 3 níveis; "sem override" = herda do papel (linha base). Aditivo — a edição de papel/status existente permanece. Admin-only.

---

## Acceptance Criteria

1. Na aba Permissões (admin), há uma matriz por usuário mostrando cada `Module` com o seletor **Não ver / Ver / Editar** e um estado **"Herdar do papel"** (= sem override; default).
2. Salvar uma célula grava em `system_user_module_perms` (`upsert`); escolher "Herdar do papel" **remove** o override (DELETE) e a permissão volta a derivar do papel.
3. Efeito **imediato**: após salvar, `useMyModulePerms` do usuário afetado reflete a mudança (Sidebar/gates/dashboard); a matriz mostra o estado efetivo (override ou herdado).
4. **Admin-only**: leitura e escrita dos overrides exigem admin (`requireModule('sistema','edit')` com piso admin, ou `requireRole(['admin'])`); um não-admin recebe 403 e não vê a matriz.
5. **Não rebaixa a gestão de usuários**: overrides de módulo `sistema` não concedem a não-admin o poder de editar papéis/convidar/excluir usuários (piso admin preservado — coerente com R3-02/R3-03).
6. Mostrar de forma legível o "valor herdado do papel" (para o admin entender o que muda ao criar um override) — ex.: badge "herdado: Ver".

---

## Tasks / Subtasks

- [ ] **RPC** `src/rpc/permissions.ts` (estende R3-01):
  - [ ] `getUserModulePermsFn(userId)` (admin) — overrides de um usuário.
  - [ ] `setUserModulePermFn(userId, module, access)` (admin) — upsert.
  - [ ] `clearUserModulePermFn(userId, module)` (admin) — DELETE (volta a herdar).
  - [ ] Todos com guard admin (`requireModule('sistema','edit')` + piso admin) (AC: 4,5).
- [ ] **Serviço** `rbac-perms-service.ts` — `setUserModulePerm` / `clearUserModulePerm` (validam `module`∈`MODULES`, `access`∈`{none,view,edit}`).
- [ ] **Hooks** `usePermissions.ts` — `useUserModulePerms(userId)`, `useSetUserModulePerm()`, `useClearUserModulePerm()` (invalidação de cache pós-mutação).
- [ ] **UI** — componente `ModulePermMatrix` (novo, em `src/components/settings/`) embutido na aba Permissões (`permissoes.tsx`), por usuário selecionado; célula com Select `Herdar | Não ver | Ver | Editar`; badge do valor herdado do papel (AC: 1,2,6).
- [ ] **Efeito imediato** — invalidar `useMyModulePerms` / relançar carga do perfil afetado (AC: 3).
- [ ] **Testes** (AC: 2,4,5) — upsert/clear gravam corretamente; não-admin recebe 403; override em `sistema` não dá poder de editar papéis. `npx tsc --noEmit` + `npm run lint` verdes.

---

## Dev Notes

**Modelo de estado da célula:** cada célula tem 4 estados de UI — `Herdar do papel` (sem linha em `system_user_module_perms`) + `none|view|edit` (com linha). "Herdar" ≠ "none": herdar cai no papel; none bloqueia explicitamente. Deixar isso claro na UI (badge do herdado).

**Segurança (AC-5, repetido de R3-02/03):** a tela de gestão é o vetor óbvio de escalonamento. Gravar overrides é admin-only; e o módulo `sistema=edit` concedido a um não-admin **não** deve destravar a própria gestão de usuários/papéis — manter `role==='admin'` como piso nesses endpoints. Documentar a fronteira (o que `sistema:edit` libera vs. o que só admin libera).

**Reuso:** aproveitar `UsersAdmin` (já lista usuários) — a matriz pode abrir a partir da linha do usuário ("Editar permissões") em vez de duplicar a listagem.

**P7 (design de alto nível):** a permissão operacional por frente/tipo (Controladoria) pode, no futuro, virar uma segunda matriz (usuário×frente) nesta mesma tela — deixar o layout extensível. Não implementar agora (R6).

**Regras de ouro:** aditivo (mantém edição de papel/status); prefixo `system_`; admin-only; sem nova migration (tabela veio em R3-01).

### Testing
- Salvar `financeiro=Não ver` p/ um advogado ⇒ some grupo Financeiro e gates de `$` para ele; matriz mostra "Não ver".
- "Herdar do papel" ⇒ DELETE do override; volta ao comportamento do papel.
- Não-admin ⇒ 403, matriz não aparece.
- `sistema=Editar` em não-admin ⇒ não consegue trocar papel de terceiros.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** R3-01 (tabela + `permissaoEfetiva` + RPC base), R3-02 (`useCan`, para ver o efeito), R3-04 (Sidebar reflete). Idealmente R3-03 (`requireModule` admin).
- **Habilita:** operação real do RBAC aditivo (fecha o épico R3).

---

## Cruzamentos

- **R4:** ao setar `financeiro` por usuário aqui, controla quem vê `$` nas telas financeiras (R4) — mesma tabela.
- **R2/P4:** "criar Tema/Frente = só admin" — a matriz **não** deve conceder isso via `sistema:edit` (piso admin).
- **R6/P7:** futura matriz usuário×frente na mesma tela (design de alto nível).

---

## File List

- `sistema-hv/src/rpc/permissions.ts` (get/set/clear overrides, admin)
- `sistema-hv/src/lib/rbac-perms-service.ts` (`setUserModulePerm`, `clearUserModulePerm`)
- `sistema-hv/src/hooks/usePermissions.ts` (`useUserModulePerms`, `useSetUserModulePerm`, `useClearUserModulePerm`)
- `sistema-hv/src/components/settings/ModulePermMatrix.tsx` (novo)
- `sistema-hv/src/routes/permissoes.tsx` (embute a matriz)
- `sistema-hv/src/components/settings/UsersAdmin.tsx` (ponto de entrada "Editar permissões")

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (tela de gestão B3/D3/E4) | @sm |
