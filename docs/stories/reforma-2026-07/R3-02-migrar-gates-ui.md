# Story R3-02: Migrar gates de UI para `permissaoEfetiva` (incremental, com fallback)

- **Épico:** R3 — Permissões por módulo + reorganização de módulos (bloco B3 / D3 / E4)
- **ID:** R3-02
- **Status:** Draft
- **Estimativa relativa:** M (troca dos call-sites de `can`/`role===` no front por `permissaoEfetiva`, mantendo o mesmo resultado quando não há override)
- **Executor sugerido:** @dev · Quality gate: @architect
- **Ordem:** depois de R3-01 (infra). Pode ir em paralelo a R3-03 (guards) — arquivos distintos.

---

## Story

**Como** usuário com override de módulo,
**quero** que os **botões/telas do front** respeitem minha permissão efetiva (`ver`/`editar`/`não ver`) por módulo,
**para que** um advogado sem acesso ao financeiro deixe de ver ações de `$`, sem que ninguém sem override tenha seu comportamento alterado.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (gates de UI a migrar — verificado)
- `src/routes/casos.$id.tsx:100-101` — `podeFinanceiro = can(role,'financeiro.manage')`, `podeGerirCaso = can(role,'casos.manage')`.
- `src/routes/pipeline.tsx:95,322` — `can(role,'config.manage')`.
- `src/routes/casos.financeiro.index.tsx:75,227` — `can(role,'config.manage')`.
- `src/routes/comercial.leads.tsx:54` — `can(role,'config.manage')`.
- `src/routes/comercial.funil.tsx:209` — `can(role,'config.manage')`.
- `src/components/clients/ClientRoster.tsx:130` — `can(role,'config.manage')` (edição de defs de campos).
- `src/routes/permissoes.tsx:14` — `role === 'admin'`.
- `src/routes/configuracoes.tsx:18` — `role === 'admin'`.
- `src/components/cases/CaseFormDialog.tsx:73-75` — `isAdvogado(...)` (filtro de responsáveis; **NÃO** é gate de módulo — manter).

### JÁ EXISTE (infra R3-01)
- `permissaoEfetiva(role, overrides, module, action)` + `useMyModulePerms()` (`src/hooks/usePermissions.ts`).

### NOVO
- Hook conveniente `useCan(module, action)` que combina `useAuth().role` + `useMyModulePerms()` + `permissaoEfetiva` (evita repetir a colagem em cada tela).

> **DECISÃO TRAVADA:** migração **incremental** e **com fallback**. Cada gate migrado deve produzir o **mesmo** resultado de hoje **quando não há override**. `isAdvogado` no `CaseFormDialog` (filtro de quem pode ser responsável) **não** é permissão de módulo — permanece com `isAdvogado`.

---

## Mapeamento gate atual → módulo/ação

| Local | Hoje | Vira |
|-------|------|------|
| `casos.$id.tsx:100` `podeFinanceiro` | `can(role,'financeiro.manage')` | `useCan('financeiro','edit')` |
| `casos.$id.tsx:101` `podeGerirCaso` | `can(role,'casos.manage')` | `useCan('operacional','edit')` |
| `pipeline.tsx:95,322` | `can(role,'config.manage')` | `useCan('sistema','edit')` (editar etapas = config) |
| `casos.financeiro.index.tsx:75,227` | `can(role,'config.manage')` | `useCan('sistema','edit')` |
| `comercial.leads.tsx:54` | `can(role,'config.manage')` | `useCan('sistema','edit')` |
| `comercial.funil.tsx:209` | `can(role,'config.manage')` | `useCan('sistema','edit')` |
| `ClientRoster.tsx:130` | `can(role,'config.manage')` | `useCan('sistema','edit')` |
| `permissoes.tsx:14` | `role === 'admin'` | `useCan('sistema','edit')` **e** manter `role==='admin'` como piso (gestão de usuários é admin) |
| `configuracoes.tsx:18` | `role === 'admin'` | idem |

> A correspondência `config.manage → sistema:edit` e `financeiro.manage → financeiro:edit` já está codificada no mapa base `ROLE_MODULE_ACCESS` de R3-01 — por isso o fallback é idêntico. **Validar a equivalência papel-a-papel antes de trocar** (AC-3).

---

## Acceptance Criteria

1. Todos os gates de UI da tabela acima passam a chamar `permissaoEfetiva` (via `useCan`) em vez de `can(role,...)`/`role===`.
2. **Regressão zero sem override:** para cada um dos 9 papéis, com a tabela `system_user_module_perms` vazia, cada tela mostra/oculta **exatamente** os mesmos botões de antes (checado por papel — ver Testing).
3. **Override funciona:** um usuário com `system_user_module_perms(financeiro='none')` deixa de ver o bloco/ações financeiras em `casos.$id`, mesmo que o papel permitisse; com `financeiro='edit'` volta a ver.
4. `isAdvogado` no `CaseFormDialog` **não** é alterado (não é módulo).
5. `permissoes`/`configuracoes` continuam **restritas a admin** no mínimo (o override não pode "rebaixar" a exigência de admin da gestão de usuários — piso `role==='admin'` preservado; ver Dev Notes).

---

## Tasks / Subtasks

- [ ] **Hook** `useCan(module, action)` em `src/hooks/usePermissions.ts` (combina `role` + overrides + `permissaoEfetiva`; enquanto `role`/overrides carregam, retornar postura conservadora coerente com a de hoje — o Sidebar hoje mostra tudo até o papel carregar, mas gates de ação seguram; manter esse contrato).
- [ ] Migrar `casos.$id.tsx:100-101` → `useCan('financeiro','edit')` / `useCan('operacional','edit')` (AC: 1,3).
- [ ] Migrar `pipeline.tsx:95,322`, `casos.financeiro.index.tsx:75,227`, `comercial.leads.tsx:54`, `comercial.funil.tsx:209`, `ClientRoster.tsx:130` → `useCan('sistema','edit')` (AC: 1).
- [ ] `permissoes.tsx:14` / `configuracoes.tsx:18` → manter `role==='admin'` como piso e, opcionalmente, `useCan('sistema','edit')` (AC: 5). Documentar que gestão de usuários é admin-only.
- [ ] **Não** tocar `CaseFormDialog` `isAdvogado` (AC: 4).
- [ ] **Testes** (AC: 2,3) — snapshot de visibilidade de gate por papel (9 papéis) antes/depois; caso de override `none`/`edit` no financeiro. `npx tsc --noEmit` + `npm run lint` verdes.

---

## Dev Notes

**Estratégia de fallback:** `useCan` sempre resolve por `permissaoEfetiva`, que sem override devolve o resultado do papel. Como o mapa `ROLE_MODULE_ACCESS` (R3-01) foi calibrado para reproduzir `can`/`ROLE_NAV`, cada troca é **comportamentalmente neutra** sem override. **Não** migrar todos de uma vez sem testar — fazer arquivo a arquivo, rodando o snapshot por papel a cada um.

**Piso de admin (AC-5):** gestão de usuários/permissões é sensível. O override de módulo `sistema` **não deve** conceder acesso à tela de gestão a quem não é admin nesta rodada — manter `role==='admin'` como condição obrigatória em `permissoes`/`configuracoes` (o `useCan('sistema','edit')` pode ser adicional, nunca substituto do piso). Isso evita escalonamento de privilégio via override.

**Não migrar aqui:** guards de RPC (R3-03), Sidebar/`canSeeRoute` (R3-04), visibilidade de casos `seesOnlyOwnCases` (fica no papel; reavaliar em R6/P7). Gates de `$` que hoje só têm `requireAuth` no server são **R4**.

**Regras de ouro:** aditivo; não quebrar guards; sem migration nesta story (só front).

### Testing
- Para cada papel, comparar a árvore de gates renderizada antes×depois (sem override) — idênticas.
- Override `financeiro='none'` em advogado_titular ⇒ some bloco financeiro em `casos.$id`.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** R3-01 (`permissaoEfetiva`, `useMyModulePerms`).
- **Habilita:** R3-06 (tela de gestão testa o efeito visual); complementa R4 (que reforça os gates no server).

---

## Cruzamentos

- **R4:** os gates de `$` do front migrados aqui casam com o reforço server-side de R4 (defesa em profundidade).
- **P3 (regra transversal $):** blocos de valor no front usam `useCan('financeiro','view')`.

---

## File List

- `sistema-hv/src/hooks/usePermissions.ts` (`useCan`)
- `sistema-hv/src/routes/casos.$id.tsx`
- `sistema-hv/src/routes/pipeline.tsx`
- `sistema-hv/src/routes/casos.financeiro.index.tsx`
- `sistema-hv/src/routes/comercial.leads.tsx`
- `sistema-hv/src/routes/comercial.funil.tsx`
- `sistema-hv/src/components/clients/ClientRoster.tsx`
- `sistema-hv/src/routes/permissoes.tsx`
- `sistema-hv/src/routes/configuracoes.tsx`

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (fatiado de B3/D3/E4) | @sm |
