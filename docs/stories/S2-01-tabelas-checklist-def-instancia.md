# Story S2-01: Tabelas de checklist por etapa (def + instância)

- **Sprint:** 2 — Onboard: subetapas/checklist por etapa
- **ID:** S2-01 (STORY-FUNDAÇÃO da Sprint 2 — schema do checklist)
- **Status:** Ready for Review
- **Estimativa relativa:** M (média — 2 tabelas novas + RLS/grants/índices no padrão do sistema; sem lógica de gate)
- **Executor sugerido:** @data-engineer (migration) · Quality gate: @architect

---

## Story

**Como** administrador do escritório,
**quero** que cada etapa do funil (por tipo de serviço) possa ter uma definição de checklist e que cada caso tenha instâncias desses itens,
**para que** o onboard passe a ser guiado por subetapas verificáveis, ancoradas de forma durável no `stage_slug` (não em `stage_id`).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE:** `system_pipeline_stages (kind op/fin, slug, label, ordem, stage_role, service_type_id)` e `system_service_types` em `20260608000003_s13_espinha.sql:13-66`. O **UNIQUE** de etapa é `(service_type_id, kind, slug)` (`:65`) e o seed usa `ON CONFLICT (service_type_id, kind, slug) DO NOTHING` (`:107`) — ou seja, **etapas revivem por slug**.
- **JÁ EXISTE (molde de defs+valores):** `system_client_field_defs` (defs) + `system_clients.custom_fields JSONB` (valores) em `20260622000002_client_custom_fields.sql:17-60`. Padrão de UNIQUE parcial por `(organization_id, key) WHERE deleted_at IS NULL` (`:38-40`), `updated_at` trigger, view `_active`, auditoria, RLS por org e grants (`:90-113`). **Reusar esse padrão exatamente.**
- **NOVO:** `system_stage_checklist_defs` (definição por `service_type_id` + `stage_slug`) e `system_case_checklist_items` (instância por `case_id` + `def`).

> **ANCORAGEM (R-ARCH-5):** o checklist é ancorado em **`stage_slug` + `service_type_id`**, **NÃO** em `stage_id`. Motivo: etapas **revivem por slug** via `ON CONFLICT (service_type_id, kind, slug)` (recriar etapa com mesmo slug reusa/atualiza a linha), então `stage_id` não é estável entre migrations; `stage_slug` é a chave lógica durável.

**Risco de regressão travado:** esta migration **NÃO toca colunas de `system_cases`** — portanto **NÃO** precisa (e **NÃO deve**) recriar `system_cases_active`. **NÃO recriar `trg_system_cases_bifurcacao`** (dropado na 0022 — regra de ouro 6).

---

## Acceptance Criteria

(CAs do plano v2.3, seção S2-01)

1. Migrations criam **ambas** as tabelas com **RLS por org** + **grants** no padrão do sistema (`service_role` ALL; `anon/authenticated` SELECT/INSERT/UPDATE/DELETE; view `_active` SELECT p/ todos).
2. **UNIQUE impede def duplicada por etapa:** UNIQUE parcial em `(service_type_id, stage_slug, key) WHERE deleted_at IS NULL`. **UNIQUE `(case_id, def_id)`** impede item duplicado por caso.
3. `system_cases_active` **intacta** (não é afetada — esta migration não toca `system_cases`).

---

## Tasks / Subtasks

- [x] **Migration** `20260703000001_stage_checklist.sql` (AC: 1,2,3)
  - [x] `CREATE TABLE IF NOT EXISTS system_stage_checklist_defs`: `id`, `organization_id` FK `system_organizations`, `service_type_id` FK `system_service_types ON DELETE CASCADE`, **`stage_slug TEXT NOT NULL`** (chave de ancoragem, **sem FK para stage_id**), `key TEXT NOT NULL` (slug estável do item), `label TEXT NOT NULL`, `ordem INT NOT NULL DEFAULT 0`, `required BOOLEAN NOT NULL DEFAULT FALSE`, `expected_doc_pattern TEXT` (opcional — usado por S2-06, pode ficar NULL agora), `active BOOLEAN NOT NULL DEFAULT TRUE`, timestamps + `deleted_at`.
  - [x] UNIQUE parcial `system_stage_checklist_defs_uq ON (service_type_id, stage_slug, key) WHERE deleted_at IS NULL` (espelha `system_client_field_defs_key_org_active_unique`).
  - [x] Índice de lookup `ON (service_type_id, stage_slug, ordem) WHERE deleted_at IS NULL`.
  - [x] `CREATE TABLE IF NOT EXISTS system_case_checklist_items`: `id`, `organization_id`, `case_id` FK `system_cases ON DELETE CASCADE`, `def_id` FK `system_stage_checklist_defs`, **`stage_slug TEXT NOT NULL`** (redundante p/ query por etapa sem join), `done BOOLEAN NOT NULL DEFAULT FALSE`, `done_at TIMESTAMPTZ`, `done_by UUID`, `source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','drive_suggest'))`, `drive_file_id TEXT` (dedupe do auto-check S2-06), timestamps + `deleted_at`.
  - [x] UNIQUE parcial `system_case_checklist_items_uq ON (case_id, def_id) WHERE deleted_at IS NULL`.
  - [x] Índice `ON (case_id, stage_slug) WHERE deleted_at IS NULL` (+ índice de dedupe por `drive_file_id`).
  - [x] Views `_active` de ambas (`WHERE deleted_at IS NULL`).
  - [x] `updated_at` trigger em ambas (`system_update_updated_at_column`).
  - [x] Auditoria `system_fn_audit` (AFTER I/U/D) em ambas.
  - [x] RLS por org (`system_current_organization_id()`) + grants — copiado o bloco de `20260622000002_client_custom_fields.sql` adaptando os nomes.
  - [x] Rollback correspondente em `sistema-hv/supabase/rollbacks/20260703000001_stage_checklist.rollback.sql` (DROP das 2 tabelas + views).
- [x] **Tipos** — adicionados `system_stage_checklist_defs` / `system_case_checklist_items` (Row/Insert/Update) + views `_active` + FKs em `sistema-hv/src/lib/supabase/types.ts` (tipados à mão).
- [x] **Testes** (AC: 1-3) — verificado via `db-query.ts`: 2 tabelas com RLS, UNIQUE parciais, índices, grants nos 3 roles em tabelas e views; `system_cases_active` inalterada por esta migration; `npx tsc --noEmit` (só 3 erros pré-existentes) / `npm run lint` verdes.

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA migration `sistema-hv/supabase/migrations/20260703000001_stage_checklist.sql`.
- NOVO rollback `sistema-hv/supabase/rollbacks/20260703000001_stage_checklist.rollback.sql`.
- `sistema-hv/src/lib/supabase/types.ts` (tipagem das 2 tabelas).

**Regras de ouro repetidas (pertinentes):**
- Esta migration **NÃO toca `system_cases`** → **NÃO recriar `system_cases_active`** (a regra de ouro 2 só se aplica a migrations que alteram colunas de `system_cases`; recriar a view sem necessidade seria ruído/risco).
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- Migrations aplicadas via **conexão pg direta**: `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` (CLI e Management API não funcionam no Windows/OneDrive — `reference_aplicar_migrations_pg_direto`).

**Invariantes / decisões travadas:**
- Ancorar **SEMPRE** em `stage_slug` + `service_type_id`, **nunca** em `stage_id` (etapas revivem por slug).
- `expected_doc_pattern` já entra no schema (coluna nullable) mas **fica sem regra fixa** — S2-06 (auto-check Drive) é quem consome, e a convenção de nomes ainda virá do owner (parametrizável).

### Testing
- SQL de verificação aplicado via pg direto: existência das 2 tabelas, UNIQUE parciais, RLS habilitada, grants nos 3 roles, views `_active`.
- Confirmar que `system_cases_active` continua idêntica (nenhum DROP/CREATE dela nesta migration).
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- Fundação schema — não tem caso próprio na Matriz, mas é **pré-requisito** dos casos **12** (avanço por checklist), **13** (sugestão não fecha gate) e **14** (desmarcar required após avanço), grupo D.

---

## Dependências

- **Depende de:** S1 (estado do caso já definido; `service_type_id` já projetado no caso). **Requer** `system_pipeline_stages`/`system_service_types` (JÁ EXISTEM).
- **Habilita:** S2-02 (editor edita os defs), S2-03 (instanciação materializa os defs em items), S2-04 (gate lê os items `required`), S2-06 (auto-check grava items `source='drive_suggest'`).

---

## File List

- `sistema-hv/supabase/migrations/20260703000001_stage_checklist.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260703000001_stage_checklist.rollback.sql` (novo)
- `sistema-hv/src/lib/supabase/types.ts` (tabelas + views + FKs das 2 tabelas)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 2) | @sm |
