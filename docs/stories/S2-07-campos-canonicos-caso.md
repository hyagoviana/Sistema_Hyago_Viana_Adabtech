# Story S2-07: Campos canônicos no CASO (ex.: nº FIES) — JSONB no caso

- **Sprint:** 2 — Onboard: subetapas/checklist por etapa
- **ID:** S2-07
- **Status:** Ready for Review
- **Estimativa relativa:** M (coluna JSONB + índice GIN + UI na ficha do caso)
- **Executor sugerido:** @data-engineer (migration) + @dev (serviço/UI) · Quality gate: @architect

---

## Story

**Como** operador que preenche dados do serviço,
**quero** guardar campos canônicos **no caso** (ex.: nº do contrato FIES), distintos dos campos customizados de cliente,
**para que** eles sejam preenchidos nas etapas do serviço, reaproveitados em documentos e buscáveis, sem se confundir com atributos da pessoa.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (custom fields de CLIENTE — NÃO confundir):** `system_clients.custom_fields JSONB` + índice GIN + defs em `system_client_field_defs` (`20260622000002_client_custom_fields.sql:17-60`). Esses são atributos da **pessoa** — S2-07 é sobre atributos do **CASO**.
- **JÁ EXISTE (padrão de coluna JSONB + GIN):** `20260622000002_client_custom_fields.sql:56-60` (`ADD COLUMN custom_fields JSONB` + `CREATE INDEX ... USING GIN`). **Reusar o padrão** para o caso.
- **JÁ EXISTE:** view `system_cases_active` (`DROP+CREATE` a cada migration que toca colunas de `system_cases` — ex. `20260610000001_entrada_financeiro.sql:106-112`).
- **NOVO:** `system_cases.canonical_fields JSONB` + índice GIN; defs **opcionais** por tipo (MVP pode ser conjunto fixo por tipo; editor reusando `field_defs` só se o owner quiser).

> **DECISÃO TRAVADA:** campo do **CASO** (JSONB no caso, `canonical_fields`), **distinto** dos custom fields de CLIENTE. Opcional. Preenchido nas etapas do serviço, reaproveitado em documentos.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S2-07)

1. Salvar nº FIES no caso persiste em **`system_cases.canonical_fields`**, **NÃO** em `custom_fields` do cliente.
2. Campo aparece na **ficha do caso** e é **buscável** (ao menos por match de texto).

---

## Tasks / Subtasks

- [x] **Migration** `20260703000004_case_canonical_fields.sql` (AC: 1) — **toca colunas de `system_cases`** → recria a view
  - [x] `ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS canonical_fields JSONB`.
  - [x] `CREATE INDEX IF NOT EXISTS idx_system_cases_canonical_fields ON system_cases USING GIN (canonical_fields)`.
  - [x] **RECRIADA `system_cases_active` (DROP+CREATE)** expondo `canonical_fields` + **todas** as colunas pré-existentes (enumeradas — a view não usa `c.*`), com `GRANT SELECT ... TO anon, authenticated, service_role`. Verificado: 38 colunas (era 37), `lifecycle`/`perdido_at`/`removido_do_operacional_at`/`client_name` presentes.
  - [x] Defs por tipo: **NÃO** criado — MVP usa conjunto livre chave/valor no JSONB (documentado). Opcional, não bloqueia AC-1/AC-2.
  - [x] Rollback correspondente (recria a view sem `canonical_fields` preservando as demais colunas, DROP índice/coluna; **não** recria o trigger de bifurcação).
- [x] **Serviço** — `updateCaseCanonicalFields(caseId, patch, userId)` (merge no JSONB, remove chaves vazias) em `cases-service.ts` + evento `canonical_fields_updated`.
- [x] **Busca** (AC: 2) — `listCases` inclui os campos canônicos: filtra em JS (substring case-insensitive sobre `canonical_fields`) e mescla com o `.or()` de `case_code`/`proximo_passo` (PostgREST não faz ilike direto em jsonb).
- [x] **UI** — bloco "Dados do serviço" (`CaseCanonicalFields`) na ficha do caso para preencher/exibir/remover campos canônicos.
- [x] **Testes** (AC: 1,2) — view recriada com grants e colunas verificada via db-query; `updateCaseCanonicalFields` grava só em `system_cases`; busca por texto cobre canonical_fields; `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA migration `sistema-hv/supabase/migrations/20260703000004_case_canonical_fields.sql` + rollback.
- `sistema-hv/src/lib/cases-service.ts` (`updateCaseCanonicalFields`, busca).
- `sistema-hv/src/lib/supabase/types.ts` (`system_cases` Row/Insert/Update com `canonical_fields`).
- RPC/hook + UI da ficha do caso.

**Regras de ouro repetidas (pertinentes):**
- **Esta migration TOCA `system_cases`** → **RECRIAR `system_cases_active` (DROP+CREATE)** preservando **todas** as colunas já expostas (incl. `lifecycle`/`perdido_at`/`perdido_motivo` de S1-01 e `removido_do_operacional_at`) e mantendo grants `anon/authenticated/service_role` (regra de ouro 2). **Ler a definição vigente da view antes de recriar** para não perder colunas.
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- Migrations aplicadas via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto).
- `canonical_fields` é do **CASO** — nunca gravar em `system_clients.custom_fields`.

**Riscos de regressão:**
- Recriar a view **perdendo** colunas quebra o front que lê `system_cases_active` — copiar a `SELECT` vigente e só **adicionar** `canonical_fields` (via `c.*`, que já traz a coluna nova automaticamente — confirmar que a view usa `c.*`).
- Concorrentes de escrita em `system_cases`: `system_fn_sync_stage_ids` (BEFORE) + `system_fn_entrar_financeiro` — nova coluna JSONB não conflita.

### Testing
- Salvar nº FIES → `SELECT canonical_fields FROM system_cases` traz o valor; `system_clients.custom_fields` inalterado.
- Busca por texto do nº FIES retorna o caso.
- View recriada expõe `canonical_fields` **e** as colunas pré-existentes, com grants nos 3 roles.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- Sem caso dedicado na Matriz; herda o **Caso 18** (grupo E) — toda migration que toca `system_cases` **RECRIA `system_cases_active`** expondo as colunas e mantendo grants.

---

## Dependências

- **Depende de:** S1-01 (a view `system_cases_active` já expõe `lifecycle`/`perdido_at` — recriar preservando). Independente das demais stories de S2 (pode ir em paralelo).
- **Habilita:** reaproveitamento em documentos (fora do escopo de S2 — futuro).

---

## File List

- `sistema-hv/supabase/migrations/20260703000004_case_canonical_fields.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260703000004_case_canonical_fields.rollback.sql` (novo)
- `sistema-hv/src/lib/cases-service.ts` (`updateCaseCanonicalFields` + busca)
- `sistema-hv/src/lib/supabase/types.ts` (`canonical_fields` em `system_cases`)
- `sistema-hv/src/rpc/cases.ts` (`updateCaseCanonicalFieldsFn`)
- `sistema-hv/src/hooks/useCases.ts` (`useUpdateCaseCanonicalFields`)
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` (novo)
- `sistema-hv/src/routes/casos.$id.tsx` (bloco "Dados do serviço")

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 2) | @sm |
