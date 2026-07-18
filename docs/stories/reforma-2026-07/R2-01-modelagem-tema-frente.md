# Story R2-01: Modelagem TEMA + FRENTE/TIPO (aditiva, sem tocar service_types)

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2 do doc-mestre)
- **Fase da Sequência Segura §7:** 5a (criar entidades aditivas)
- **ID:** R2-01
- **Status:** Ready for Review
- **Estimativa relativa:** M (2 tabelas novas + colunas aditivas nullable + views/grants/RLS)
- **Executor sugerido:** @data-engineer (migration) + @architect (revisão de modelagem) · Quality gate: @architect
- **Risco:** MÉDIO (aditivo puro; nada de dual-write é tocado, mas define o contrato de todas as fases seguintes)

---

## Story

**Como** arquiteto do sistema jurídico,
**quero** introduzir as entidades **TEMA** e **FRENTE/TIPO** como camada **aditiva** (novas tabelas + colunas nullable no caso), **sem tocar** em `system_service_types`, `case_type`, `macrostatus_*` nem no trigger de dual-write,
**para que** as fases seguintes (backfill, unificação de pipeline, pastas, Kanban) tenham um alvo estável e nenhum caso existente quebre.

> **DECISÃO TRAVADA (D1/D2, doc-mestre §2, §4.1):** o `service_type` atual vira **TEMA**; ESF/DGM/Censo/Portaria viram **FRENTE/TIPO** do caso (`frente_slug`). Pipeline operacional passa a ser **ÚNICA por TEMA** (consolidada nas fases seguintes). Esta story só **cria a estrutura** — não migra dado nem reaponta nada.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (núcleo a NÃO tocar aqui):** `system_service_types` (`id`, `slug` UNIQUE imutável, `name`, `active`, `ordem`) — `20260608000003_s13_espinha.sql:13-45`.
- **JÁ EXISTE:** `system_pipeline_stages` (op por `service_type_id`) — `20260608000003_s13_espinha.sql:50-107`; op reescrita por tipo em `20260609000001_pipelines_por_tipo.sql:28-101` (inclui `DGM_ENVIADA` só em `FIES_DGM`).
- **JÁ EXISTE (trigger dual-write — INTOCÁVEL nesta fase):** `system_fn_sync_stage_ids()` + `trg_system_cases_sync_stages` — `20260608000003_s13_espinha.sql:124-151`. Projeta `case_type→service_type_id`, `macrostatus_op→stage_op_id`, `macrostatus_fin→stage_fin_id`.
- **JÁ EXISTE (view a recriar quando tocar colunas de `system_cases`):** `system_cases_active` enumera colunas (NÃO usa `c.*` na versão vigente) — última recriação em `20260703000004_case_canonical_fields.sql:24-69` (63 = colunas + `client_name`/`client_cpf_cnpj`).
- **JÁ EXISTE (molde de tabela filha de service_type):** `system_service_type_folders` (FK `ON DELETE CASCADE` para `system_service_types`, `kind` CHECK, view `_active`, grants) — `20260709000030_service_type_folders.sql:19-45`.
- **JÁ EXISTE (molde de coluna JSONB + view recriada):** `20260703000004_case_canonical_fields.sql` (S2-07).
- **NOVO:** tabela `system_temas` (camada TEMA) — inicialmente **vazia** ou espelhando `service_types` sem FK dura; ver decisão abaixo.
- **NOVO:** tabela `system_tema_frentes` (FRENTE/TIPO por tema: `tema_id`, `slug`, `label`, `ordem`, `active`).
- **NOVO:** colunas aditivas nullable em `system_cases`: `tema_id UUID` (FK nullable) e `frente_slug TEXT` (nullable). **Sem** default, **sem** CHECK novo, **sem** backfill (o backfill é R2-02).

> **DECISÃO DE MODELAGEM a travar com @architect antes de codar (registrar no Change Log):**
> - **Opção A (recomendada):** `system_temas` é tabela NOVA independente; `system_service_types` recebe coluna `tema_id UUID NULL` (vínculo aditivo N service_types → 1 tema). Preserva 100% do dual-write; o tema é "puxado" via `service_type.tema_id`. Fusão ESF+DGM = 2 service_types apontando pro mesmo tema.
> - **Opção B:** promover `system_service_types` a TEMA in-place (renomear conceitualmente). **Rejeitada nesta fase** — viola "aditivo primeiro" e arrisca o trigger.
> Esta story assume **Opção A** salvo decisão contrária registrada.

---

## Acceptance Criteria

1. Migration cria `system_temas` e `system_tema_frentes` (idempotente: `CREATE TABLE IF NOT EXISTS`, view `_active`, RLS por org, grants `service_role`/`anon`/`authenticated`, auditoria + `updated_at` triggers — molde `system_service_type_folders` + `s13_espinha`).
2. `system_service_types` ganha `tema_id UUID NULL REFERENCES system_temas(id)` (aditivo, **sem** popular).
3. `system_cases` ganha `tema_id UUID NULL REFERENCES system_temas(id)` + `frente_slug TEXT NULL` (aditivos, **sem** backfill, **sem** CHECK).
4. Como a migration TOCA `system_cases`, `system_cases_active` é **recriada (DROP+CREATE)** expondo as 2 novas colunas **+ todas as colunas pré-existentes** (enumeradas) + grants nos 3 roles.
5. Trigger `trg_system_cases_sync_stages` e `system_fn_sync_stage_ids()` **inalterados**; `trg_system_cases_bifurcacao` **não** é recriado.
6. Nenhum caso existente muda de comportamento: `SELECT count(*)` por `case_type`/`macrostatus_op`/`stage_op_id` idêntico antes e depois; `tema_id`/`frente_slug` = NULL em todos os casos.
7. Rollback: DROP das 2 colunas de `system_cases` + recria a view sem elas (preservando as demais), DROP `tema_id` de `system_service_types`, DROP das 2 tabelas novas + views. Não recria o trigger de bifurcação.

---

## Tasks / Subtasks

- [x] **Decisão de modelagem** (AC: —) — Opção A confirmada e travada; registrada no Change Log v0.3.
- [x] **Migration** `20260719000001_tema_frente_modelagem.sql` (AC: 1-5)
  - [x] `CREATE TABLE IF NOT EXISTS system_temas` (`id`, `organization_id` FK, `name`, `slug` UNIQUE por org [índice parcial], `active`, `ordem`, `created_by`, timestamps, `deleted_at`). Trigger `updated_at` + auditoria + view `system_temas_active`.
  - [x] `CREATE TABLE IF NOT EXISTS system_tema_frentes` (`id`, `organization_id` FK, `tema_id` FK `ON DELETE CASCADE`, `slug`, `label`, `ordem`, `active`, timestamps, `deleted_at`, `UNIQUE(tema_id, slug) WHERE deleted_at IS NULL`). View `_active`.
  - [x] RLS por org (molde `s13_espinha:166-176`) + grants (`service_role` ALL; `anon`/`authenticated` SELECT/INSERT/UPDATE/DELETE; views SELECT nos 3 roles).
  - [x] `ALTER TABLE system_service_types ADD COLUMN IF NOT EXISTS tema_id UUID REFERENCES system_temas(id)`.
  - [x] `ALTER TABLE system_cases ADD COLUMN IF NOT EXISTS tema_id UUID REFERENCES system_temas(id)` + `ADD COLUMN IF NOT EXISTS frente_slug TEXT`.
  - [x] Índices parciais: `idx_system_cases_tema (tema_id) WHERE deleted_at IS NULL`, `idx_system_service_types_tema (tema_id)`.
  - [x] **RECRIAR `system_cases_active` (DROP+CREATE)** — base = def **VIGENTE** extraída do banco (`pg_get_viewdef`, não da 20260703000004 que estava desatualizada) + `c.tema_id`, `c.frente_slug`; grants nos 3 roles. Nenhuma coluna perdida.
- [x] **Rollback** `20260719000001_tema_frente_modelagem.rollback.sql` (AC: 7).
- [x] **Types** — editado `src/lib/supabase/types.ts`: `system_temas`, `system_tema_frentes` (+ views `_active`), `system_cases.tema_id/frente_slug`, `system_service_types.tema_id`.
- [x] **Validação** (AC: 6) — diff coluna-a-coluna da view (41 vigentes + 2 novas = 43); `npm run typecheck` sem erro novo (22 erros pré-existentes, 0 referentes a tema/frente). Migration NÃO aplicada (aguarda revisão do arquiteto).

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA `sistema-hv/supabase/migrations/20260719000001_tema_frente_modelagem.sql` + rollback em `sistema-hv/supabase/rollbacks/`.
- `sistema-hv/src/lib/supabase/types.ts`.

**Regras de ouro (doc-mestre §5.1, §5.5):**
- **NUNCA deletar `case_type`/`macrostatus_*`** — dual-write vivo o tempo todo.
- **Migration toca `system_cases` → RECRIAR `system_cases_active` (DROP+CREATE)** preservando TODAS as colunas + grants. Ler a definição vigente (`20260703000004`) antes.
- **NÃO recriar `trg_system_cases_bifurcacao`.**
- Views enumeram colunas → recriar ao mudar. CHECKs de lifecycle (`lifecycle IN`, `assinatura⇒≠LEAD`, `perdido⇒PERDIDO`) **não** remover.
- Migrations aplicadas via **`npx tsx scripts/db-apply-pg.ts <arquivo.sql>`** + rollback. Prefixo `system_`.

**Riscos de regressão (este épico tem os maiores):**
- Recriar a view **perdendo** colunas quebra todo o front que lê `system_cases_active` (listCases, pipeline, comercial, financeiro). Mitigação: diff coluna-a-coluna contra a versão vigente.
- Adicionar CHECK ou NOT NULL em `frente_slug`/`tema_id` nesta fase quebraria INSERTs de casos legados. Mitigação: **estritamente nullable, sem CHECK** até R2-05.
- FK de `system_cases.tema_id` para `system_temas` vazia é segura (NULL não valida FK).

## Testing

- Contagem de casos por `case_type` e por `macrostatus_op` idêntica antes/depois.
- `SELECT count(*) FROM system_cases WHERE tema_id IS NOT NULL` = 0 pós-migration.
- View recriada expõe `tema_id`, `frente_slug` + todas as colunas de `20260703000004` (verificar via `information_schema.columns`) com grants nos 3 roles.
- Aplicar rollback → `system_temas`/`system_tema_frentes` somem, view volta sem as 2 colunas, casos intactos.
- `npm run typecheck` / `npm run lint` verdes.

## Dependências

- **Depende de:** nada (primeira story do épico). Só executar após a **fundação** (B3-parte1 permissão efetiva, B4 desacoplar $) estar estável, conforme Sequência Segura §7 — cruzamento com **R1** (B4/financeiro) e **R3** (B3/permissões).
- **Habilita:** R2-02 (backfill), e todas as demais fases.
- **PRÉ-REQUISITO DE NEGÓCIO (bloqueia R2-02, NÃO esta story):** lista definitiva de TEMAS + frentes/tipos por tema (doc-mestre §9 item 1). Esta story cria estrutura vazia; o mapeamento é R2-02.

## File List

- `sistema-hv/supabase/migrations/20260719000001_tema_frente_modelagem.sql` (novo) ✅
- `sistema-hv/supabase/rollbacks/20260719000001_tema_frente_modelagem.rollback.sql` (novo) ✅
- `sistema-hv/src/lib/supabase/types.ts` (tipos: `system_temas`, `system_tema_frentes`, views `_active`, `system_cases.tema_id/frente_slug`, `system_service_types.tema_id`) ✅

## Dev Agent Record

**Agent:** @data-engineer (Opus 4.8) · **Data:** 2026-07-18 · **Status final:** Ready for Review

### Decisão registrada
**Opção A (travada):** `system_temas` criada como tabela NOVA independente; `system_service_types` e `system_cases` recebem apenas coluna(s) aditiva(s) `tema_id` (nullable) — e `frente_slug` no caso. Núcleo (`service_types`, `case_type`, `macrostatus_*`, dual-write) 100% intocado. Sem backfill/default/CHECK. Fusão futura ESF+DGM = 2 service_types apontando pro mesmo tema.

### Passo crítico executado (view vigente)
Em vez de confiar na migration `20260703000004` (desatualizada), extraí a def **VIGENTE** de `system_cases_active` via `pg_get_viewdef('system_cases_active'::regclass, true)`. A def vigente tem **41 colunas** (39 `c.*` + `client_name` + `client_cpf_cnpj`) — inclui `macrostatus_comercial`, `stage_comercial_id`, `procuracao_assinada_at` que NÃO existiam na 20260703000004. A recriação preserva as 41 colunas na ordem exata + acrescenta `c.tema_id` e `c.frente_slug` (43 no total). `system_cases.responsavel_user_id` existe na tabela mas NÃO era exposto na view vigente → mantido fora (fidelidade à def vigente).

### Molde de tabela adotado
Config-tables (`system_temas`/`system_tema_frentes`) seguem o molde `s13_espinha` (service_types): RLS habilitada + 4 policies por org (`organization_id = system_current_organization_id()`), trigger `updated_at` (`system_update_updated_at_column`), trigger de auditoria (`system_fn_audit`), views `_active` (`SELECT * WHERE deleted_at IS NULL`), grants (`service_role` ALL; `anon`/`authenticated` S/I/U/D; views SELECT nos 3 roles). Idempotência via `IF NOT EXISTS` / `DROP POLICY IF EXISTS` / `DROP TRIGGER IF EXISTS` / `DROP VIEW IF EXISTS`.

### Validação
- **NÃO aplicada no banco** (sem `db-apply-pg`), sem commit/push — apenas arquivos criados. Aguarda revisão do arquiteto.
- Trigger `trg_system_cases_sync_stages` / `system_fn_sync_stage_ids` e `trg_system_cases_bifurcacao`: **intocados** (não recriados). CHECKs de lifecycle: **não** removidos.
- `npm run typecheck`: 22 erros — **idênticos ao baseline** (medido com `git stash` de types.ts). Zero erros referentes a `tema`/`frente`/`system_temas`/`system_tema_frentes`. Erros pré-existentes vêm de `system_case_checklist_item_assignees`/`system_user_module_perms` ausentes no types.ts manual + narrowing de nullable, todos anteriores a esta story.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — fase 5a do épico R2 (doc-mestre §7 item 5) | @sm |
| 2026-07-18 | 0.2 | C1 (QA/Architect): resolvida colisão de timestamp de migration com R3-01. R3-01 (passo 1 da Sequência Segura) mantém `20260718000001`; o bloco R2 foi renumerado para a faixa `20260719000001+`. Esta story: migration/rollback/File List/Dev Notes de `20260718000001_tema_frente_modelagem` → `20260719000001_tema_frente_modelagem`. | @sm |
| 2026-07-18 | 0.3 | Implementação (@data-engineer): criados migration + rollback `20260719000001_tema_frente_modelagem` e tipos. **Opção A** registrada. View `system_cases_active` recriada a partir da def VIGENTE do banco (41 col → 43 c/ `tema_id`+`frente_slug`), não da 20260703000004 desatualizada. RLS+audit+updated_at por molde `s13_espinha`. NÃO aplicado no banco, trigger/CHECKs intocados, typecheck sem erro novo. Status → Ready for Review. | @data-engineer |
