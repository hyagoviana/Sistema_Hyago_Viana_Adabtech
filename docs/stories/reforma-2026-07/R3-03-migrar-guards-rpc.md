# Story R3-03: Migrar guards de RPC para permissão efetiva (`requireModule`)

- **Épico:** R3 — Permissões por módulo + reorganização de módulos (bloco B3 / D3 / E4)
- **ID:** R3-03
- **Status:** Draft
- **Estimativa relativa:** M (novo guard `requireModule` + migração incremental dos `requireRole` para consultar a permissão efetiva, mantendo o fallback)
- **Executor sugerido:** @dev · Quality gate: @architect + @qa (segurança)
- **Ordem:** depois de R3-01. Pode ir em paralelo a R3-02 (arquivos distintos: server vs front).

---

## Story

**Como** administrador,
**quero** que os **guards de servidor** (fronteira RPC) também respeitem overrides por módulo,
**para que** um usuário sem permissão a um módulo seja bloqueado **no back-end** (defesa em profundidade, não só na UI), sem regressão para quem não tem override.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (guards a migrar — verificado)
- `src/lib/supabase/auth-guard.ts:88-142` — `requireAuth()` (checa `system_users` ACTIVE/INVITED; **não** muda aqui).
- `src/lib/supabase/auth-guard.ts:150-170` — `requireRole(allowed[])` (checa ACTIVE + papel ∈ allowed).
- `requireRole(ADMIN_ONLY)` em:
  - `src/rpc/clientFields.ts:60,74,83,94,103`
  - `src/rpc/checklist.ts:74,97,106,115`
- Só `requireAuth()` (sem gate por módulo/papel) em: `src/rpc/financeiro.ts:16`, `src/rpc/asaas.ts`, `src/rpc/contaazul.ts`, `src/rpc/termo.ts` → **alvo de R4** (não desta story; aqui apenas deixamos o guard pronto).

### NOVO
- `requireModule(module, action)` em `auth-guard.ts`: valida `requireAuth`, carrega papel + overrides (`getUserModulePerms`), aplica `permissaoEfetiva`; lança `AuthError(403)` se negar. Retorna `{ id, email, role }`.

> **DECISÃO TRAVADA:** aditivo e incremental. `requireRole([...])` **continua existindo** e funcionando. Migrar call-site a call-site para `requireModule` **só** onde o mapeamento papel→módulo é 1:1 e testável. Onde a semântica for "admin puro" (gestão de usuários), pode-se manter `requireRole(['admin'])` ou usar `requireModule('sistema','edit')` com piso admin — decidir por endpoint.

---

## Mapeamento guard atual → módulo/ação

| Endpoint(s) | Hoje | Vira |
|-------------|------|------|
| `clientFields.ts` (defs de campos de cliente) | `requireRole(ADMIN_ONLY)` | `requireModule('sistema','edit')` (config) — equivalente ao admin no fallback |
| `checklist.ts` (defs de checklist) | `requireRole(ADMIN_ONLY)` | `requireModule('sistema','edit')` |
| `financeiro.ts` / `asaas.ts` / `contaazul.ts` / `termo.ts` | só `requireAuth()` | **R4**: `requireModule('financeiro','view'|'edit')` — só a assinatura fica pronta aqui |

> No fallback (tabela vazia), `permissaoEfetiva(role,[],'sistema','edit')` deve dar `true` **apenas** para os papéis que hoje passam em `ADMIN_ONLY`. Isso é garantido pelo mapa `ROLE_MODULE_ACCESS` de R3-01 — **validar antes de trocar** (AC-2).

---

## Acceptance Criteria

1. `requireModule(module, action)` implementado em `auth-guard.ts`: `requireAuth` → carrega papel+overrides → `permissaoEfetiva` → `AuthError(403)` se negar; retorna `{ id, email, role }`. Cacheável por request (reusar padrão `tokenCache`/admin client já existente no arquivo).
2. **Regressão zero sem override:** os endpoints de `clientFields.ts` e `checklist.ts` migrados continuam **permitindo os mesmos papéis** que `ADMIN_ONLY` hoje e **negando** os demais (403). Provado por teste por papel.
3. **Override funciona:** um usuário não-admin com `sistema='edit'` passa a poder chamar os endpoints migrados; um admin com `sistema='none'` é bloqueado (403) — demonstrando a precedência do override.
4. `requireRole` e `requireAuth` **permanecem** exportados e usados onde ainda não migrado (sem apagão).
5. `financeiro.ts`/`asaas.ts`/`contaazul.ts`/`termo.ts` **não** são migrados nesta story (ficam para R4) — mas `requireModule` está disponível e testado para eles.

---

## Tasks / Subtasks

- [ ] **Guard** `requireModule(module, action)` em `src/lib/supabase/auth-guard.ts` (AC: 1)
  - [ ] Reusa `requireAuth`; busca `role` + `getUserModulePerms(userId)`; aplica `permissaoEfetiva`.
  - [ ] `AuthError(403)` com mensagem clara; status coerente com o handler dos RPCs.
- [ ] Migrar `src/rpc/clientFields.ts:60,74,83,94,103` → `requireModule('sistema','edit')` (AC: 1,2,3).
- [ ] Migrar `src/rpc/checklist.ts:74,97,106,115` → `requireModule('sistema','edit')` (AC: 1,2).
- [ ] **NÃO** migrar `financeiro/asaas/contaazul/termo` (R4) — apenas confirmar que `requireModule('financeiro',...)` funciona em teste (AC: 5).
- [ ] **Testes** (AC: 2,3) — por papel: quem passava em `ADMIN_ONLY` continua passando; overrides `none`/`edit` invertem o resultado; endpoints não migrados intactos. `npx tsc --noEmit` + `npm run lint` verdes.

---

## Dev Notes

**Estratégia de fallback:** `requireModule` delega a decisão a `permissaoEfetiva`. Sem override, o resultado espelha o papel — logo, os endpoints migrados mantêm a mesma matriz de acesso. **Segurança:** o guard server é a fronteira real; R3-02 (UI) é conveniência. Não confiar só no front.

**Cuidado com `setUserRole` (`users.ts:163`) e gestão de usuários:** essas são operações de administração de identidade — manter `requireRole(['admin'])` ou usar `requireModule('sistema','edit')` **com piso admin**; não permitir que um override de módulo conceda poder de trocar papéis de terceiros (evitar escalonamento). Decidir explicitamente por endpoint e documentar.

**Não migrar aqui:** visibilidade de casos (`visibility.ts`, `dossie-service.ts:361`, `case-responsaveis-service.ts`) — `seesOnlyOwnCases` continua ancorado no papel nesta rodada; a permissão operacional por frente/tipo (P7) é design de alto nível em R6.

**Regras de ouro:** aditivo (não remover `requireRole`/`requireAuth`); não quebrar guards existentes; sem migration de banco nesta story (a tabela veio em R3-01).

### Testing
- Matriz por papel: `clientFields`/`checklist` — mesmos papéis autorizados de hoje (403 p/ os demais).
- Override `sistema='edit'` em papel não-admin ⇒ 200; `sistema='none'` em admin ⇒ 403.
- `financeiro.ts` ainda aceita qualquer autenticado (não regrediu; será fechado em R4).
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** R3-01 (`permissaoEfetiva`, `getUserModulePerms`).
- **Habilita:** R4 (reusa `requireModule('financeiro',...)` para fechar os endpoints de `$`).

---

## Cruzamentos

- **R4:** esta story entrega o guard; R4 o aplica aos RPCs financeiros (P3 — dados de `$` exigem `financeiro:view`).
- **R2/P4:** criar Tema/Frente = admin → guard do endpoint de criação de tema usará `requireModule('sistema','edit')`/piso admin.

---

## File List

- `sistema-hv/src/lib/supabase/auth-guard.ts` (`requireModule`)
- `sistema-hv/src/rpc/clientFields.ts`
- `sistema-hv/src/rpc/checklist.ts`

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (fatiado de B3/D3/E4) | @sm |
