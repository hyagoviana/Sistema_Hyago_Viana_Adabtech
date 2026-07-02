# Story S1-01: Estado de ciclo de vida explícito do caso (LEAD | CLIENTE | PERDIDO)

- **Sprint:** 1 — Lead/Cliente por caso (destrava o uso)
- **ID:** S1-01 (STORY-FUNDAÇÃO — primeira da Sprint 1)
- **Status:** Ready for Review
- **Estimativa relativa:** G (grande — é a fundação; migration + invariantes + refactor de serviço)
- **Executor sugerido:** @data-engineer (migration/invariantes) + @dev (serviço) · Quality gate: @dev/@architect

---

## Story

**Como** advogado/operador do escritório,
**quero** que cada caso tenha um estado de ciclo de vida de 1ª classe (`LEAD`, `CLIENTE` ou `PERDIDO`) materializado e auditado,
**para que** o sistema deixe de inferir "lead/cliente/perdido" de flags implícitas e passe a filtrar, promover e reverter casos de forma confiável, com trilha de auditoria.

---

## Contexto / o que JÁ EXISTE vs NOVO

Hoje "lead perdido" **não tem estado terminal**. O ciclo de vida é inferido de flags:
- `system_cases.aguardando_assinatura_at` (NULL = fora da fase comercial) → LEAD implícito.
- `system_cases.assinatura_liberada_at` / `_by` → CLIENTE implícito.
Ambas adicionadas em `20260622000003_caso_comercial.sql:16-17` (a migration já recria `system_cases_active` com `DROP VIEW` + `CREATE VIEW` + `GRANT ... TO anon, authenticated, service_role`, ver `:37-43`).

- **JÁ EXISTE:** `liberarCasoComercial(caseId, { via, userId })` em `cases-service.ts:455` — limpa `aguardando_assinatura_at`, seta `assinatura_liberada_at/_by` e grava `system_case_events(action='liberado_comercial', diff.via, triggered_by)` (`:486-492`). É idempotente por causa do no-op em `:469` (ver S1-03).
- **JÁ EXISTE:** `system_case_events (action, from/to_macrostatus_op, diff, triggered_by)` em `20260523000004_cases.sql:98-107`; grants em `:141-143`.
- **JÁ EXISTE:** trigger `BEFORE` de projeção `system_fn_sync_stage_ids()` (`20260608000003_s13_espinha.sql:124`) que preenche `stage_op_id/stage_fin_id` a partir dos `macrostatus_*` — convive bem com nova coluna desde que NÃO se introduza trigger AFTER conflitante.
- **NOVO:** coluna `system_cases.lifecycle` + `perdido_at` + `perdido_motivo`, invariantes com CHECK/trigger, backfill inicial e recriação da view.

**Risco de regressão travado:** `trg_system_cases_bifurcacao` foi **DROPADO** na migration 0022 (`20260610000001_entrada_financeiro.sql:28`). **NENHUMA migration desta story pode recriá-lo.**

---

## Acceptance Criteria

(CAs do plano v2.3, seção S1-01)

1. Migration aplica **recriando `system_cases_active` (DROP+CREATE)** expondo `lifecycle` / `perdido_at` / `perdido_motivo` e mantendo grants `anon` / `authenticated` / `service_role`.
2. Caso com procuração já assinada (`assinatura_liberada_at IS NOT NULL`) → `lifecycle='CLIENTE'` após backfill.
3. Caso novo comercial → nasce `lifecycle='LEAD'`.
4. Ao liberar (webhook OU manual), grava `system_case_events(action='liberado_comercial', diff.via ∈ {'webhook','manual'}, triggered_by)`. No caminho **manual**, `triggered_by` é **obrigatoriamente o usuário autenticado (não-null)**; no **webhook**, `triggered_by = null` e `diff.via='webhook'`.
5. Marcar PERDIDO grava `perdido_at`, `perdido_motivo` e evento; caso some das views ativas de LEAD.
6. **Invariante:** tentativa de gravar `lifecycle='LEAD'` com `assinatura_liberada_at` preenchido é **rejeitada** pelo CHECK/trigger.
7. **Edge (QA):** pessoa é LEAD no caso A e CLIENTE no caso B **simultaneamente** — as duas views retornam a mesma pessoa sem duplicar.

### Invariantes declaradas (R-ARCH-2) — devem ser garantidas no banco
- `assinatura_liberada_at IS NOT NULL ⇒ lifecycle = 'CLIENTE'`.
- `perdido_at IS NOT NULL ⇒ lifecycle = 'PERDIDO'`.
- **Nunca** `lifecycle = 'LEAD'` com `assinatura_liberada_at` preenchido.

---

## Tasks / Subtasks

- [x] **Migration** `20260702000001_case_lifecycle.sql` (AC: 1,2,6)
  - [x] `ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'LEAD'` + CHECK de domínio (`system_cases_lifecycle_domain_chk`).
  - [x] `ADD COLUMN IF NOT EXISTS perdido_at TIMESTAMPTZ` e `ADD COLUMN IF NOT EXISTS perdido_motivo TEXT`.
  - [x] Backfill idempotente: `UPDATE system_cases SET lifecycle='CLIENTE' WHERE assinatura_liberada_at IS NOT NULL AND lifecycle='LEAD'` (resto permanece `'LEAD'` pelo default). Exceções/legados assinados-por-fora são S1-06.
  - [x] Invariantes via `CHECK` (correção @sm): `CHECK (assinatura_liberada_at IS NULL OR lifecycle <> 'LEAD')` — permite a reversão CLIENTE→PERDIDO da S1-01b — e `CHECK (perdido_at IS NULL OR lifecycle='PERDIDO')`. Adicionadas DEPOIS do backfill como `NOT VALID` + `VALIDATE`. **NÃO** criei trigger AFTER de bifurcação.
  - [x] Índice parcial: `CREATE INDEX idx_system_cases_lifecycle ON system_cases(lifecycle) WHERE deleted_at IS NULL`.
  - [x] **Recriar view** (regra de ouro 2): `DROP VIEW IF EXISTS system_cases_active; CREATE VIEW ... (c.* expõe lifecycle/perdido_at/perdido_motivo)` + `GRANT SELECT ... TO anon, authenticated, service_role`. Espelha `20260622000003_caso_comercial.sql:37-43`.
  - [x] Rollback correspondente em `supabase/rollbacks/20260702000001_case_lifecycle.rollback.sql` (padrão do projeto).
- [x] **Serviço** — centralizar escrita de `lifecycle` (AC: 4)
  - [x] `liberarCasoComercial` (`cases-service.ts`) agora seta `lifecycle='CLIENTE'` no `UPDATE`, além de limpar `aguardando_assinatura_at`/setar `assinatura_liberada_at`. Idempotência do no-op preservada.
  - [x] Confirmado: o evento `liberado_comercial` já grava `diff.via` e `triggered_by` — no manual `userId` não-null; no webhook (`zapsign/webhook.ts` chama `{ via: "webhook" }` sem `userId`) `via='webhook'`, `triggered_by=null`.
- [x] **Regra de arquitetura** (AC: 6, regra de ouro 7)
  - [x] Escrita de `lifecycle` continua RPC-only: só `liberarCasoComercial` escreve por enquanto. `promoverCasoManual`/`marcarCasoPerdido` ficam para S1-03/S1-01b (só o gancho desta story está pronto). O front nunca escreve `lifecycle` direto.
- [~] **Testes** (AC: 1-7) — ver seção Test cases. TS `system_cases` tipado com `lifecycle`/`perdido_at`/`perdido_motivo`; `npm run lint` verde e `tsc --noEmit` sem erros novos (3 erros pré-existentes não relacionados). Teste de serviço/SQL de verificação roda após aplicar a migration no banco (dev=prod — aplicação é passo posterior com aprovação).

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA migration `sistema-hv/supabase/migrations/20260702000001_case_lifecycle.sql`.
- `sistema-hv/src/lib/cases-service.ts` (`liberarCasoComercial` `:455-495`).

**Invariantes / regras de ouro:**
- Toda migration que toca colunas de `system_cases` recria `system_cases_active` (DROP+CREATE) com grants `anon/authenticated/service_role` (regra de ouro 2).
- **NÃO recriar `trg_system_cases_bifurcacao`** (dropado na 0022 — regra de ouro 6).
- Escrita de `lifecycle` é **RPC-only** (regra de ouro 7).
- Concorrentes reais de escrita em `system_cases`: `system_fn_entrar_financeiro` + projeção `system_fn_sync_stage_ids` (BEFORE). Ambos convivem — **não** introduzir trigger AFTER conflitante.

**Riscos de regressão a vigiar:**
- View sem grants → quebra front que lê `system_cases_active`.
- CHECK muito restritivo pode barrar backfill; aplicar o `UPDATE` de backfill ANTES de adicionar o CHECK, ou adicionar CHECK `NOT VALID` + `VALIDATE`.
- Migrations aplicadas via **conexão pg direta** (CLI quebrado no Windows/OneDrive — `reference_aplicar_migrations_pg_direto`).

### Testing
- SQL de verificação da migration + view/grants aplicado via pg direto.
- Testes de serviço no padrão existente de `cases-service` (mesmo diretório de testes usado pelas stories anteriores).
- `npm run typecheck` e `npm run lint` verdes antes de concluir.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 1** (grupo A) — LEAD ⇄ CLIENTE simultâneos (AC-7).
- **Caso 18** (grupo E) — toda migration que toca `system_cases` RECRIA `system_cases_active` expondo `lifecycle`/`perdido_at` com grants (AC-1).

---

## Dependências

- **Nenhuma** (é a fundação). **Habilita** S1-03, S1-01b, S1-05, S1-06, S1-04 (indiretamente), S4-01.

---

## Dev Agent Record

### File List

**Criados:**
- `sistema-hv/supabase/migrations/20260702000001_case_lifecycle.sql` — coluna `lifecycle` (default `'LEAD'` + CHECK de domínio), `perdido_at`, `perdido_motivo`; backfill idempotente (`assinatura_liberada_at IS NOT NULL → 'CLIENTE'`); invariantes CHECK (`assinatura_liberada_at IS NULL OR lifecycle <> 'LEAD'` e `perdido_at IS NULL OR lifecycle='PERDIDO'`) via `NOT VALID`+`VALIDATE`; índice parcial `idx_system_cases_lifecycle`; recriação de `system_cases_active` (DROP+CREATE) com grants.
- `sistema-hv/supabase/rollbacks/20260702000001_case_lifecycle.rollback.sql` — reverte colunas/constraints/índice e refaz a view (não recria o trigger de bifurcação).

**Alterados:**
- `sistema-hv/src/lib/cases-service.ts` — `liberarCasoComercial` seta `lifecycle='CLIENTE'` no UPDATE (escrita centralizada, RPC-only).
- `sistema-hv/src/lib/supabase/types.ts` — `system_cases` Row/Insert com `lifecycle` / `perdido_at` / `perdido_motivo`.

### Completion Notes
- Correção do @sm aplicada: invariante de assinatura usa `lifecycle <> 'LEAD'` (não `= 'CLIENTE'` estrito), habilitando a reversão CLIENTE→PERDIDO da S1-01b.
- `trg_system_cases_bifurcacao` NÃO foi recriado (segue dropado desde a 0022).
- Migration **não aplicada** no banco (dev=prod) — aplicação é passo posterior com aprovação do owner.
- `npm run lint` verde nos arquivos tocados; `tsc --noEmit` sem erros novos (3 erros pré-existentes em `casos.$id.tsx` e `casos.financeiro.index.tsx`, sobre `service_type_id: string | null`, não relacionados a esta story).

### Debug Log / Notas
- Line endings: a verificação de "erros pré-existentes" via `git stash pop` disparou o `autocrlf` do git e converteu `cases-service.ts`/`types.ts` para CRLF (prettier reprovou). Renormalizados para LF; diff final = apenas as 9 linhas de inserção pretendidas.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 | @sm |
| 2026-07-02 | 0.2 | Implementação: migration + rollback + serviço + tipos; lint/typecheck; status Ready for Review | @dev |
