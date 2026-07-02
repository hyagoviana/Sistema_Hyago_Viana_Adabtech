# Story S4-03: Bloco de notas livre (cliente e caso)

- **Sprint:** 4 — Virada automática em SANDBOX + docs/notas/timeline
- **ID:** S4-03
- **Status:** Ready for Review
- **Estimativa relativa:** M (tabela(s) nova(s) `system_*` + RLS/grants + RPC + UI em 2 lugares)
- **Executor sugerido:** @data-engineer (migration/RLS) + @dev (serviço/RPC/UI) · Quality gate: @architect

---

## Story

**Como** qualquer usuário autenticado do escritório,
**quero** escrever notas livres tanto no **cliente** (histórico do cliente) quanto no **caso** (histórico do caso), com edição e exclusão suave,
**para que** o histórico contextual fique registrado por pessoa e por caso, sem perder rastreabilidade (auditoria + soft-delete, nunca apagar de verdade).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (molde de tabela — S2-01):** `system_stage_checklist_defs` / `system_case_checklist_items` (`20260703000001_stage_checklist.sql`) — **padrão completo a copiar**: `organization_id` NOT NULL + FK, `created_by`/`created_at`/`updated_at`/`deleted_at`, trigger `system_update_updated_at_column`, view `_active` (`WHERE deleted_at IS NULL`), trigger de auditoria `system_fn_audit`, RLS por org (`system_current_organization_id()`), grants nos 3 roles (`service_role` = ALL; `anon, authenticated` = SELECT/INSERT/UPDATE/DELETE; view `_active` = SELECT nos 3).
- **JÁ EXISTE (soft-delete/auditoria):** funções `system_update_updated_at_column()`, `system_fn_audit()`, `system_current_organization_id()` (usadas por todas as tabelas `system_*`).
- **JÁ EXISTE (pontos de montagem UI):** ficha do caso `sistema-hv/src/routes/casos.$id.tsx` (usa `OrnamentalDivider` entre seções — `:490-518`) e ficha do cliente `sistema-hv/src/routes/clientes.$id.tsx` (`ClientCasesSection` etc.).
- **NOVO (schema):** tabela(s) `system_*` de notas com `body TEXT`, `created_by`, timestamps e soft-delete (`deleted_by`/`deleted_at`). Duas opções de modelagem (o executor decide, mantendo o padrão S2-01):
  - **(A) tabela única polimórfica** `system_notes (target_type CHECK IN ('client','case'), target_id, body, ...)`; ou
  - **(B) duas tabelas** `system_case_notes (case_id, ...)` e `system_client_notes (client_id, ...)`.
  **Recomendação do @sm:** **(B) duas tabelas** — FKs reais (`case_id`/`client_id`) com `ON DELETE CASCADE`, índices e RLS mais simples, alinhado ao padrão do sistema (`system_case_*`). O plano cita "`system_case_notes` (e/ou notas de cliente)".
- **NOVO (serviço/RPC):** CRUD server-side de notas (criar/editar/soft-delete) para cliente e caso; listagem por `client_id`/`case_id`.
- **NOVO (UI):** bloco de notas na ficha do **caso** e na ficha do **cliente** (lista + criar/editar/excluir).

> **DECISÃO TRAVADA (owner) — SEM restrição por papel:** **qualquer usuário autenticado** lê/escreve notas (ação exige **apenas login**). **REMOVIDA** a exigência de papel (`advogado_titular / advogado_associado / admin`) e o 403-por-cargo. **MANTIDOS:** soft-delete com `deleted_by`/`deleted_at` (**nunca hard-delete**) e trilha de auditoria (ator + timestamps). A RLS continua por **org** (isolamento de organização), só **sem** filtro por cargo.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S4-03)

1. Criar/editar/excluir nota no **caso** e no **cliente**; persiste. **Qualquer usuário autenticado** consegue (sem 403-por-cargo); só chamada **não autenticada** é rejeitada (`created_by`/ator null → recusa).
2. **(v2.2)** RLS/guard garantem apenas **isolamento por org** — usuário de outra org **não** vê as notas; **não** há bloqueio por papel dentro da mesma org.
3. Nota some da lista ao **soft-delete** (**nunca hard-delete**); `deleted_by`/`deleted_at` gravados e **preservados** (trilha de auditoria intacta).

---

## Tasks / Subtasks

- [x] **Migration** `20260705000001_case_client_notes.sql` (AC: 1,2,3) — molde S2-01. Duas tabelas (modelagem B):
  - [x] `system_case_notes (id, organization_id FK, case_id FK ON DELETE CASCADE, body TEXT NOT NULL, created_by UUID, created_at, updated_at, deleted_at, deleted_by UUID)`.
  - [x] `system_client_notes (id, organization_id FK, client_id FK ON DELETE CASCADE, body TEXT NOT NULL, created_by UUID, created_at, updated_at, deleted_at, deleted_by UUID)`.
  - [x] Índices por `(case_id, created_at DESC)` / `(client_id, created_at DESC)` `WHERE deleted_at IS NULL`.
  - [x] Triggers `system_update_updated_at_column` + auditoria `system_fn_audit`; views `_active`.
  - [x] RLS por org (4 policies cada) + grants nos 3 roles (padrão S2-01).
  - [x] Rollback em `sistema-hv/supabase/rollbacks/20260705000001_case_client_notes.rollback.sql`.
  - [x] **Aplicada via `db-apply-pg.ts` (pg direto)** e verificada por leitura (tabelas, 4 views, 4 policies/tabela, grants nos 3 roles).
- [x] **Serviço/RPC** (AC: 1,3) — `notes-service.ts`: `createCaseNote`/`createClientNote`, `updateNote`, `softDeleteNote` (grava `deleted_by`/`deleted_at`), `listCaseNotes`/`listClientNotes` (autor resolvido em lote via `system_users`). `rpc/notes.ts` com `requireAuth` (sem `requireRole`) — recusa chamada não autenticada.
- [x] **UI caso** (AC: 1) — `NotesBlock target="case"` montado em `casos.$id.tsx` (lista desc + criar/editar/soft-delete).
- [x] **UI cliente** (AC: 1) — `NotesBlock target="client"` montado em `clientes.$id.tsx` (idem).
- [x] **Testes** (AC: 1-3) — `tsc --noEmit` sem novos erros; lint verde nos arquivos alterados. Guard de auth e soft-delete no serviço; RLS por org confirmada no banco. (Teste funcional de gravação fica p/ @qa — dev=prod, não gravo dados.)

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA migration `sistema-hv/supabase/migrations/20260705000001_case_client_notes.sql` (+ rollback).
- NOVO `sistema-hv/src/lib/notes-service.ts` (CRUD + soft-delete + auditoria).
- NOVO `sistema-hv/src/rpc/notes.ts` (server functions).
- UI: `sistema-hv/src/routes/casos.$id.tsx`, `sistema-hv/src/routes/clientes.$id.tsx` (+ componente `NotesBlock` reusável em `src/components/`).

**Regras de ouro repetidas (pertinentes):**
- **Notas = tabela(s) nova(s) `system_*`** com RLS + grants nos **3 roles**, seguindo o padrão das tabelas de checklist da **S2-01** (molde exato de RLS/grants/view `_active`/auditoria).
- Esta migration **NÃO altera colunas de `system_cases`** → **NÃO recriar `system_cases_active`** (regra de ouro 2). **NÃO recriar `trg_system_cases_bifurcacao`**.
- Migrations aplicadas via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto).
- **Nunca hard-delete** — soft-delete com `deleted_by`/`deleted_at` obrigatórios; auditoria via `system_fn_audit`.
- Toda escrita passa por RPC server-side (padrão do sistema).

**Parametrizável / decisão de modelagem:**
- Tabela única polimórfica **(A)** vs duas tabelas **(B)** — recomendado **(B)**. Se optar por (A), o CHECK de `target_type` deve cobrir `client`/`case` e o índice compor `(target_type, target_id)`.

**Riscos de regressão:**
- Nenhum trigger AFTER conflitante em `system_cases` (a nota é tabela separada; FK apenas).
- Garantir que soft-delete **não** cai em cascade de auditoria que apague a trilha.

### Testing
- Criar nota no caso e no cliente → aparece na lista, `created_by` = usuário.
- Editar nota → `updated_at` muda, `body` atualizado.
- Excluir (soft) → sai da lista; `deleted_by`/`deleted_at` gravados; nada hard-deleted no banco.
- Usuário de outra org → não vê as notas (RLS por org).
- Chamada não autenticada → recusada.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- Não há um caso numerado específico de notas na Matriz v2.3 (o grupo de notas foi coberto pelas CAs internas desta story após o relaxamento de RBAC v2.2). As CAs 1-3 são o critério passa/falha.

---

## Dependências

- **Depende de:** infra `system_*` existente (funções de auditoria/updated_at/org). Molde: **S2-01**. Roda em paralelo com S4-02/S4-04.
- **Aguarda input do owner:** nenhum (RBAC relaxado; owner já decidiu "qualquer usuário pode").
- **Habilita:** —

---

## File List

- `sistema-hv/supabase/migrations/20260705000001_case_client_notes.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260705000001_case_client_notes.rollback.sql` (novo)
- `sistema-hv/src/lib/notes-service.ts` (novo)
- `sistema-hv/src/rpc/notes.ts` (novo)
- `sistema-hv/src/components/notes/NotesBlock.tsx` (novo — reusável cliente/caso)
- `sistema-hv/src/routes/casos.$id.tsx` (montar bloco de notas)
- `sistema-hv/src/routes/clientes.$id.tsx` (montar bloco de notas)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 4, S4-03) | @sm |
| 2026-07-02 | 1.0 | Migration aplicada (2 tabelas + views + RLS + grants); notes-service/rpc/hooks + `NotesBlock` montado em caso e cliente. Auth-only + soft-delete + auditoria. Ready for Review. | @dev |

## Dev Agent Record

- Modelagem **B** (duas tabelas). Autor exibido resolvido em query separada (`created_by` sem FK, padrão do sistema; evita embed PostgREST que falharia sem FK).
- `types.ts` recebeu as 2 tabelas + 2 views manualmente (CLI de `db:types` não roda no Windows/OneDrive).
- Migration aplicada em dev=prod; verificação por leitura OK (não gravei linhas de nota).
