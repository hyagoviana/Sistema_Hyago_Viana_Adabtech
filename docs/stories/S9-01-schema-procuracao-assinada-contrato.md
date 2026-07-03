# Story S9-01: Schema — `procuracao_assinada_at` + redefinir CHECK de assinatura (contrato) + recriar view

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-01
- **Status:** Ready for Review
- **Estimativa relativa:** M (1 migration que TOCA `system_cases` → recria `system_cases_active`; novo carimbo; REDEFINE um CHECK existente que hoje bloqueia o modelo novo)
- **Executor sugerido:** @data-engineer (migration) · Quality gate: @architect

---

## Story

**Como** administrador do escritório,
**quero** que o modelo de dados separe **"procuração assinada" (comercial)** de **"contrato assinado" (operacional)** com carimbos distintos no caso,
**para que** um caso possa avançar no comercial (procuração assinada) **continuando LEAD** e só virar CLIENTE quando o **contrato do caso** for assinado — sem que o CHECK de invariante atual barre esse fluxo.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (lifecycle, `20260702000001_case_lifecycle.sql`):** `system_cases.lifecycle ∈ {LEAD,CLIENTE,PERDIDO}` + CHECK **`system_cases_assinatura_lifecycle_chk`** (`:60-66`): `assinatura_liberada_at IS NULL OR lifecycle <> 'LEAD'` — hoje interpreta `assinatura_liberada_at` como "procuração assinada" e **força NOT LEAD**. **No modelo novo isso barra** um caso com procuração assinada que deve SEGUIR LEAD.
- **JÁ EXISTE (fase comercial, `20260622000003_caso_comercial.sql`):** `aguardando_assinatura_at`/`assinatura_liberada_at`/`assinatura_liberada_by`.
- **JÁ EXISTE (esteira comercial, `20260706000001_stage_comercial.sql`):** `macrostatus_comercial`/`stage_comercial_id` + projeção `system_fn_sync_stage_ids` (bloco comercial) + a **definição VIGENTE de `system_cases_active`** (`:76+`, enumerada, com as 2 colunas comerciais). **É essa a base a copiar ao recriar a view.**
- **NOVO:** (a) `system_cases.procuracao_assinada_at TIMESTAMPTZ` (carimbo comercial, separado de `assinatura_liberada_at`); (b) **REDEFINIR** o CHECK `system_cases_assinatura_lifecycle_chk` para que `assinatura_liberada_at` passe a significar **CONTRATO assinado** (mantém a invariante `assinatura_liberada_at NOT NULL ⇒ lifecycle <> 'LEAD'`, que agora é a regra CORRETA: contrato assinado ⇒ CLIENTE/PERDIDO); (c) **recriar `system_cases_active`** expondo `procuracao_assinada_at`; (d) índice parcial.

> **REDEFINIÇÃO SEMÂNTICA (travada pelo owner 2026-07-03):** `assinatura_liberada_at` = **contrato do caso assinado** (evento operacional, vira CLIENTE). `procuracao_assinada_at` = **procuração assinada** (evento comercial, SEGUE LEAD). A invariante do CHECK **não muda de texto** (`assinatura_liberada_at NOT NULL ⇒ lifecycle <> 'LEAD'`) — muda o **significado** de `assinatura_liberada_at`. Nenhum CHECK novo prende `procuracao_assinada_at` ao lifecycle (procuração assinada convive com LEAD).

---

## Acceptance Criteria

1. `system_cases` ganha `procuracao_assinada_at TIMESTAMPTZ` (nullable), sem alterar colunas existentes. Idempotente (`ADD COLUMN IF NOT EXISTS`).
2. O CHECK `system_cases_assinatura_lifecycle_chk` é recriado (DROP + ADD `NOT VALID` + `VALIDATE`) mantendo `assinatura_liberada_at IS NULL OR lifecycle <> 'LEAD'`, **agora com a semântica "contrato assinado"** documentada em comentário. **NÃO** existe nenhum CHECK que force `procuracao_assinada_at NOT NULL ⇒ lifecycle <> 'LEAD'` (procuração assinada pode ser LEAD).
3. `system_cases_active` é **recriada (DROP+CREATE)** copiando a definição enumerada **vigente** (`20260706000001_stage_comercial.sql`) e ACRESCENTANDO `procuracao_assinada_at`, preservando **todas** as demais colunas (incl. `macrostatus_comercial`/`stage_comercial_id`) e os grants (`anon, authenticated, service_role`).
4. Índice parcial `idx_system_cases_procuracao_assinada ON system_cases(procuracao_assinada_at) WHERE deleted_at IS NULL` (ou similar) criado idempotentemente.
5. **NÃO** recria `trg_system_cases_bifurcacao` (permanece dropado). **NÃO** introduz trigger AFTER conflitante. Migration aplicável idempotentemente (rodar 2x sem erro).
6. `types.ts` reflete `procuracao_assinada_at` na Row/Insert/Update de `system_cases` (a view deriva da Row).

---

## Tasks / Subtasks

- [x] **Coluna nova** (AC: 1) — `ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS procuracao_assinada_at TIMESTAMPTZ;`
- [x] **Redefinir CHECK** (AC: 2) — `DROP CONSTRAINT IF EXISTS system_cases_assinatura_lifecycle_chk`; `ADD CONSTRAINT ... CHECK (assinatura_liberada_at IS NULL OR lifecycle <> 'LEAD') NOT VALID`; `VALIDATE CONSTRAINT`. Comentário SQL redefinindo semântica ("assinatura_liberada_at = contrato assinado").
- [x] **Índice parcial** (AC: 4) — `CREATE INDEX IF NOT EXISTS idx_system_cases_procuracao_assinada ...`.
- [x] **Recriar view** (AC: 3) — DROP+CREATE copiando a def de `20260706000001` (conferida por `pg_get_viewdef`, que era = à def vigente) + `c.procuracao_assinada_at`; grants preservados.
- [x] **Aplicar** (AC: 5) — `npx tsx scripts/db-apply-pg.ts supabase/migrations/20260708000001_procuracao_assinada.sql`. Aplicada + verificada (view com 41 colunas incl. `procuracao_assinada_at`; grants anon/authenticated/service_role; VALIDATE passou; idempotente 2x).
- [x] **Rollback** — `supabase/rollbacks/20260708000001_procuracao_assinada.rollback.sql` (dropa coluna/índice; restaura o CHECK e a view anteriores).
- [x] **Regen de tipos** (AC: 6) — `procuracao_assinada_at` na Row/Insert/Update de `system_cases` em `types.ts`.

---

## Dev Notes

**Arquivo (migration nova):**
- `sistema-hv/supabase/migrations/20260708000001_procuracao_assinada.sql` (nome/timestamp a confirmar — POSTERIOR à `20260707000002`).

**REGRAS DE OURO (pertinentes):**
- **Regra de ouro 2 — TOCA `system_cases` ⇒ RECRIAR `system_cases_active` (DROP+CREATE)** preservando TODAS as colunas já expostas + grants. **Base a copiar = a def enumerada VIGENTE em `20260706000001_stage_comercial.sql` (NÃO a `20260703000004` nem `c.*`).**
- **Regra de ouro 6 — NÃO recriar `trg_system_cases_bifurcacao`** (dropado; permanece dropado).
- Aplicar via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto; banco dev = prod). Supabase CLI não roda no Windows/OneDrive.
- O CHECK `system_cases_assinatura_lifecycle_chk` já é redefinível (foi criado nomeado na `20260702000001`) — o `NOT VALID`+`VALIDATE` reprova a migration explicitamente se houver dado divergente. Antes de aplicar em prod, garantir que **nenhum caso LEAD** tem `assinatura_liberada_at NOT NULL` (a S9-06 rebaixa/ajusta os legados — ver dependência abaixo). Se o VALIDATE falhar, é sinal de que a S9-06 precisa rodar ANTES nos dados legados (ou a migração de dados vai junto — decidir na S9-06).

**Ordem crítica:** esta é a **PRIMEIRA** story da Sprint 9. Reescrever os gatilhos (S9-03/S9-04) ANTES desta migration faria o CHECK atual **barrar** a escrita "procuração assinada + segue LEAD". Schema primeiro.

**Riscos de regressão:**
- Recriar a view com `c.*` ou copiando a def ERRADA (`20260703000004`, que não tem as colunas comerciais) quebra o contrato de colunas — **copiar a def enumerada vigente de `20260706000001`** e só ACRESCENTAR `procuracao_assinada_at`.
- Não confundir os dois carimbos: `procuracao_assinada_at` NÃO entra em nenhum CHECK de lifecycle.

### Testing
- `UPDATE system_cases SET procuracao_assinada_at = now()` num caso LEAD → **aceito** (não há CHECK barrando). Idem manter `lifecycle='LEAD'`.
- `UPDATE ... SET assinatura_liberada_at = now()` num caso LEAD → **rejeitado** pelo CHECK (contrato assinado exige NOT LEAD).
- `SELECT` em `system_cases_active` retorna `procuracao_assinada_at` + todas as colunas antigas (incl. comerciais) + grants para `authenticated`.
- Rodar a migration 2x → idempotente.

---

## Dependências

- **Depende de:** `20260702000001` (lifecycle + CHECK a redefinir), `20260706000001` (view vigente + colunas comerciais — base a copiar).
- **Habilita:** S9-02 (doc_kind='contrato'), S9-03 (gatilho comercial carimba `procuracao_assinada_at`), S9-04 (gatilho operacional carimba `assinatura_liberada_at`).
- **Atenção de ordem com S9-06:** o `VALIDATE` do CHECK pressupõe que não há LEAD com `assinatura_liberada_at`. Como hoje o legado usava `assinatura_liberada_at` para "procuração assinada = CLIENTE", os casos já estão CLIENTE (não LEAD) — o VALIDATE **passa**. A S9-06 depois **rebaixa** esse 1 caso para LEAD movendo o carimbo para `procuracao_assinada_at`; ou seja, S9-06 roda DEPOIS desta e usa a coluna criada aqui.

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **carimbo comercial não prende lifecycle** (procuração assinada + LEAD aceito) e **integridade da view** (`procuracao_assinada_at` exposto + grants). Complementa a matriz de lifecycle das S1/S5.

---

## File List

- `sistema-hv/supabase/migrations/20260708000001_procuracao_assinada.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260708000001_procuracao_assinada.rollback.sql` (novo)
- `sistema-hv/src/lib/supabase/types.ts` (ajuste à mão — `procuracao_assinada_at` na Row/Insert/Update de `system_cases`)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft inicial — schema `procuracao_assinada_at` + redefinição do CHECK de assinatura (contrato) + recriação da view (Sprint 9) | @sm |
| 2026-07-03 | 1.0 | Implementada e aplicada em prod (dev=prod). Migration `20260708000001` + rollback. View recriada com 41 colunas (todas as vigentes + `procuracao_assinada_at`) + 3 grants; CHECK redefinido (VALIDATE passou — nenhum LEAD com `assinatura_liberada_at`); índice parcial; `types.ts` atualizado. Idempotente 2x. | @dev |
