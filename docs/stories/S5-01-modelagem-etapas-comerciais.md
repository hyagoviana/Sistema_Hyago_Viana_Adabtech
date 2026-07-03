# Story S5-01: Modelagem — etapas comerciais (`kind='comercial'`) + estágio comercial no caso + projeção + seed

- **Sprint:** 5 — Módulo Comercial/Leads (pipeline + lista)
- **ID:** S5-01
- **Status:** Ready for Review
- **Estimativa relativa:** M/G (1 migration que TOCA `system_cases` → recria `system_cases_active`; estende CHECK de `kind`; estende a projeção `system_fn_sync_stage_ids`; seed idempotente)
- **Executor sugerido:** @data-engineer (migration) · Quality gate: @architect

---

## Story

**Como** administrador do escritório,
**quero** que o modelo de dados reconheça um **estágio comercial por caso** e uma **terceira esteira de etapas (`kind='comercial'`)** no mesmo mecanismo já usado por op/fin,
**para que** o pipeline de leads (Kanban) do Comercial reuse toda a infraestrutura existente (editor de funil da S2, projeção `stage_*_id`, padrão de Kanban) sem inventar tabela nova nem quebrar o que existe.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (espinha, migration `20260608000003_s13_espinha.sql`):** `system_pipeline_stages` com **`kind TEXT NOT NULL CHECK (kind IN ('op','fin'))`** (`:54`), `slug`/`label`/`stage_role`/`ordem`/`active`; `system_cases.stage_op_id`/`stage_fin_id` (`:113-114`); projeção **`system_fn_sync_stage_ids`** (`:124-146`) que preenche `stage_op_id`/`stage_fin_id` a partir de `macrostatus_op`/`macrostatus_fin`; trigger `trg_system_cases_sync_stages` **BEFORE INSERT OR UPDATE OF case_type, macrostatus_op, macrostatus_fin, service_type_id** (`:149-151`); view `system_pipeline_stages_active`.
- **JÁ EXISTE (lifecycle, migration `20260702000001_case_lifecycle.sql`):** `system_cases.lifecycle ∈ {LEAD,CLIENTE,PERDIDO}` (default `LEAD`), `perdido_at`, `perdido_motivo`, com CHECKs de invariante e recriação da `system_cases_active`.
- **JÁ EXISTE (fase comercial, `20260622000003_caso_comercial.sql`):** `aguardando_assinatura_at`/`assinatura_liberada_at`/`assinatura_liberada_by`.
- **JÁ EXISTE (view canônica atual):** a definição **vigente** de `system_cases_active` está em `20260703000004_case_canonical_fields.sql:24-69` — ela **ENUMERA colunas** (não usa `c.*`) e é a que deve ser COPIADA como base ao recriar a view (acrescentando as colunas novas desta story).
- **JÁ EXISTE (seed de etapas por tipo):** `pipeline-service.ts:createServiceType` (`:35-68`) semeia etapas op+fin padrão ao criar um tipo — esta story acrescenta o bloco `comercial` a esse seed (na S5-02/serviço) e semeia os tipos já existentes na migration.
- **NOVO:** (a) estender o CHECK de `kind` para `('op','fin','comercial')`; (b) adicionar `system_cases.stage_comercial_id UUID REFERENCES system_pipeline_stages(id)` + coluna de macrostatus comercial (`macrostatus_comercial TEXT`) espelhando o padrão op/fin; (c) estender `system_fn_sync_stage_ids` para projetar `macrostatus_comercial → stage_comercial_id`; (d) **recriar `system_cases_active`** expondo as 2 colunas novas; (e) **seed idempotente** das etapas comerciais default para cada `system_service_type` existente.

> **DECISÃO DE MODELAGEM (recomendada — ver seção "Decisão de modelagem"):** um **lead É um caso** com `lifecycle='LEAD'`. A pipeline de leads é um Kanban desses casos por **etapa comercial** (`macrostatus_comercial`/`stage_comercial_id`), gerida pelo MESMO editor de funil (S2) via `kind='comercial'`. **Não** se cria tabela de "lead" separada.

---

## Decisão de modelagem (recomendação + prós/contras)

**Recomendação: reusar `system_pipeline_stages` com `kind='comercial'` + coluna `macrostatus_comercial`/`stage_comercial_id` no caso, espelhando o padrão op/fin.**

- **Prós:**
  - Reusa o **editor de funil** da S2 (`comercial.funil.tsx` + `useStages(serviceTypeId, kind)`), o **KanbanBoard** genérico (DnD @dnd-kit) e o padrão `moveCaseToStage*`/`useMoveCaseStage*` — quase zero UI/serviço novos de baixo nível.
  - Etapas **parametrizáveis pelo owner** (o CRUD de etapas já existe e passa a aceitar `kind='comercial'`).
  - Projeção `stage_*_id` é a mesma máquina (`system_fn_sync_stage_ids`) — consistência ADR-007.
  - Lead = caso `lifecycle='LEAD'` já é o modelo travado na S1; não duplica dados nem cria find-or-create paralelo.
- **Contras / mitigação:**
  - **Tocar `system_cases`** obriga a **recriar `system_cases_active`** (regra de ouro 2) — mitigado copiando a definição enumerada vigente e só ACRESCENTANDO 2 colunas.
  - O `kind` do enum de projeção cresce — mitigado estendendo `system_fn_sync_stage_ids` no MESMO padrão dos blocos op/fin (guarda por `NULL`).
  - `useStages`/hooks tipam `kind: "op" | "fin"` — a S5-02 amplia o tipo para incluir `"comercial"` (mudança aditiva).

**Alternativa descartada:** tabela `system_leads` separada + status próprio. Contras: reimplementa Kanban/editor/projeção do zero, cria segunda fonte de verdade de "estado do lead" divergente do `lifecycle` da S1, e quebra o princípio "status derivado por CASO". **Não recomendada.**

---

## Acceptance Criteria

1. `system_pipeline_stages.kind` aceita `'comercial'` (CHECK estendido para `('op','fin','comercial')`) sem quebrar linhas op/fin existentes.
2. `system_cases` ganha `macrostatus_comercial TEXT` e `stage_comercial_id UUID REFERENCES system_pipeline_stages(id)` (índice parcial), sem alterar colunas existentes.
3. `system_fn_sync_stage_ids` projeta `macrostatus_comercial → stage_comercial_id` (para o `service_type_id` do caso), no MESMO padrão de op/fin; o trigger passa a disparar também em UPDATE de `macrostatus_comercial`.
4. `system_cases_active` é **recriada (DROP+CREATE)** copiando a definição enumerada vigente (`20260703000004`) e ACRESCENTANDO `macrostatus_comercial` e `stage_comercial_id`, preservando **todas** as demais colunas e os grants (`anon, authenticated, service_role`).
5. **Seed idempotente:** para cada `system_service_type` ativo, são semeadas as etapas comerciais default (`ON CONFLICT (service_type_id, kind, slug) DO NOTHING`). Default sugerido: `NOVO`(normal,0) → `EM_CONTATO`(normal,1) → `PROPOSTA_ENVIADA`(normal,2) → `AGUARDANDO_ASSINATURA`(normal,3) → `GANHO`(won,4) → `PERDIDO`(lost,5).
6. **NÃO** recria `trg_system_cases_bifurcacao` (permanece dropado). **NÃO** introduz trigger AFTER conflitante. Migration aplicável idempotentemente.

---

## Tasks / Subtasks

- [x] **Estender CHECK de `kind`** (AC: 1) — constraint real confirmada `system_pipeline_stages_kind_check`; DROP + ADD nomeada `CHECK (kind IN ('op','fin','comercial'))`. Verificado: `CHECK ((kind = ANY (ARRAY['op','fin','comercial'])))`.
- [x] **Colunas no caso** (AC: 2) — `macrostatus_comercial TEXT` + `stage_comercial_id UUID REFERENCES system_pipeline_stages(id)` + índice parcial `idx_system_cases_stage_comercial`.
- [x] **Estender a projeção** (AC: 3) — bloco comercial acrescentado a `system_fn_sync_stage_ids` (guarda por NULL, ELSE NULL); trigger recriado com `macrostatus_comercial` no `UPDATE OF`.
- [x] **Recriar `system_cases_active`** (AC: 4) — DROP+CREATE copiando a def vigente + `c.macrostatus_comercial`/`c.stage_comercial_id`; grants preservados. Verificado: 40 colunas (38 antigas + 2 novas) + 3 grants SELECT (anon/authenticated/service_role).
- [x] **Seed idempotente** (AC: 5) — 6 etapas comerciais default por tipo, `ON CONFLICT DO NOTHING`. Verificado: 7 tipos × 6 = 42 etapas; re-aplicar 2x não duplica (segue 42).
- [x] **Aplicar** (AC: 6) — `npx tsx scripts/db-apply-pg.ts supabase/migrations/20260706000001_stage_comercial.sql` (OK, direct db).
- [x] **Regen de tipos** — `types.ts` ajustado à mão: `macrostatus_comercial`/`stage_comercial_id` na Row e Insert de `system_cases` (a view `system_cases_active` deriva da Row).

---

## Dev Notes

**Arquivo (migration nova):**
- `sistema-hv/supabase/migrations/20260706000001_stage_comercial.sql` (nome/ordem a confirmar — usar timestamp posterior à `20260705000001`).

**REGRAS DE OURO (pertinentes):**
- **Regra de ouro 2 — TOCA `system_cases` ⇒ RECRIAR `system_cases_active` (DROP+CREATE)** preservando TODAS as colunas já expostas + grants. **Base a copiar = `20260703000004_case_canonical_fields.sql:24-69`** (é a definição vigente, enumerada; NÃO usar `c.*`).
- **Regra de ouro 6 — NÃO recriar `trg_system_cases_bifurcacao`** (dropado desde a 0022; permanece dropado).
- `system_case_events.action` **não** tem CHECK restritivo — eventos comerciais entram sem migration de constraint (usado na S5-02).
- Aplicar via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** (pg direto). Banco dev = prod.
- CHECK de `kind` hoje é **inline** na criação da tabela (`20260608000003:54`) — para trocá-lo, dropar a constraint (descobrir o nome auto-gerado, ex.: `system_pipeline_stages_kind_check`) e recriar nomeada. Alternativa segura: `ALTER TABLE ... DROP CONSTRAINT IF EXISTS system_pipeline_stages_kind_check; ADD CONSTRAINT system_pipeline_stages_kind_chk CHECK (kind IN ('op','fin','comercial'));`

**Riscos de regressão:**
- Se a view for recriada com `c.*` em vez da lista enumerada, quebra o contrato de colunas de quem consome `system_cases_active` — **copiar a lista enumerada vigente**.
- Estender a projeção **sem** guarda por NULL faria `stage_comercial_id` ficar órfão para casos op/fin sem etapa comercial — usar o `ELSE ... := NULL` como op/fin fazem.
- Não semear etapas comerciais com `slug` que colida com `GANHO`/`PERDIDO` de op de outro tipo — o UNIQUE é `(service_type_id, kind, slug)`, então `kind='comercial'` isola; ok.

### Testing
- Inserir etapa `kind='comercial'` → aceita; inserir `kind='xpto'` → rejeitado pelo CHECK.
- `UPDATE system_cases SET macrostatus_comercial='EM_CONTATO'` num caso com `service_type_id` → `stage_comercial_id` preenchido pela projeção; setar para NULL → `stage_comercial_id` volta a NULL.
- `SELECT` em `system_cases_active` retorna as 2 colunas novas + todas as antigas; grants ok para `authenticated`.
- Rodar a migration 2x seguidas → idempotente (sem erro, sem duplicar seed).

---

## Dependências

- **Depende de:** `20260608000003` (espinha `system_pipeline_stages`/projeção), `20260702000001` (lifecycle), `20260703000004` (view canônica vigente — base a copiar).
- **Habilita:** S5-02 (serviço/RPC de mover lead + entrada/saída da pipeline), S5-03 (UI Kanban de leads). Reusa o editor de funil da S2 para `kind='comercial'`.

---

## Test cases (Matriz de Testes Mínimos)

- Novo caso próprio: **projeção comercial** (`macrostatus_comercial → stage_comercial_id`) e **integridade da view** (`system_cases_active` com as colunas novas + grants). Complementa os casos de espinha/lifecycle das S1/S2.

---

## File List

- `sistema-hv/supabase/migrations/20260706000001_stage_comercial.sql` (novo — aplicado)
- `sistema-hv/supabase/rollbacks/20260706000001_stage_comercial.rollback.sql` (novo)
- `sistema-hv/src/lib/supabase/types.ts` (ajuste à mão — `macrostatus_comercial`/`stage_comercial_id` na Row+Insert de `system_cases`)

## Dev Agent Record (@dev)

- Constraint de `kind` confirmada no banco: `system_pipeline_stages_kind_check` (inline auto-nomeada). DROP IF EXISTS + ADD nomeada com o mesmo nome.
- View base copiada de `20260703000004` (conferida por `pg_get_viewdef` — batia 1:1 com o arquivo). Recriada com as 2 colunas novas.
- Verificações (leitura): view = 40 colunas + 3 grants SELECT; kind check = 3 valores; seed = 42 etapas comerciais (7 tipos × 6); idempotência confirmada (2ª aplicação não duplica).
- `npx tsc --noEmit`: só os 3 erros PRÉ-EXISTENTES de `service_type_id` (ignorados).
- **Observação p/ @qa:** 33 casos LEAD legados têm `macrostatus_comercial = NULL` (criados antes desta migration). Aparecem na **Lista** (etapa "—") mas NÃO em nenhuma coluna do **Kanban** (não casam nenhuma etapa). A seed de entrada (S5-02) só vale p/ casos comerciais NOVOS. Backfill de leads legados NÃO foi feito (fora da AC; evita escrita de dados não solicitada). Decisão de backfill fica para o owner/@qa.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial — modelagem de etapas comerciais (`kind='comercial'`) + estágio comercial no caso + projeção + seed (Sprint 5) | @sm |
