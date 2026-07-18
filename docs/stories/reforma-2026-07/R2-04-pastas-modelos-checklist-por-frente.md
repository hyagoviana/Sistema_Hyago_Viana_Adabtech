# Story R2-04: Migrar pastas/modelos/checklist para (TEMA, FRENTE)

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **Fase da Sequência Segura §7:** 5d (migrar pastas/modelos/checklist)
- **ID:** R2-04
- **Status:** Draft
- **Estimativa relativa:** L (vincula pastas Drive + modelos + checklist à frente, preservando fallback por case_type)
- **Executor sugerido:** @data-engineer (schema) + @dev (serviço/hooks) · Quality gate: @architect
- **Risco:** ALTO (documentos/Drive são caminho crítico do onboarding; espalha em geração de doc, ZapSign, checklist)

---

## Story

**Como** operador que gera documentos,
**quero** que pastas do Drive, modelos e defs de checklist passem a ser filtrados por **(TEMA, FRENTE)** — não mais só por `service_type`/`case_type` — **mantendo o fallback legado**,
**para que** ao cadastrar um caso escolhendo tema+frente eu veja exatamente os modelos e o checklist daquela frente.

> **DECISÃO TRAVADA (doc-mestre §4.2, §5.2):** `system_service_type_folders` passa a carregar `frente_slug` (pastas por tema+frente). Modelos filtrados por frente dentro do tema. Checklist defs reancorados ao tema (+ opcional frente). Fallback por `case_type` preservado.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (pastas por categoria):** `system_service_type_folders (service_type_id, kind IN ('caso','procuracao'), drive_folder_id, name, ordem)` + `UNIQUE(service_type_id, kind, drive_folder_id)` + view `_active` — `20260709000030_service_type_folders.sql:19-45`. FIES_ESF tem 3 pastas de caso (ESF/Censo/Portaria) — `:56-58`; FIES_DGM 1 pasta — `:61`.
- **JÁ EXISTE (consumo):** `useTypeFolders` → `useTemplatesByFolders` (por `source_folder_id`) com fallback legado por `case_type` — doc-mestre §3.5; pickers filtrados por categoria (`GenerateCaseDocumentFlow`, `CaseSignActions`, `CaseDocumentsTab`) — MEMORY `filtro_modelos_por_categoria`.
- **JÁ EXISTE (modelos):** `system_document_templates` (via `case_type` OU `source_folder_id`) — `20260709000002_template_source_folder.sql`.
- **JÁ EXISTE (checklist defs):** `system_stage_checklist_defs (service_type_id, stage_slug, key)` — `20260703000001_stage_checklist.sql:20-42`.
- **JÁ EXISTE (exclusão de categoria em cascata):** `deleteServiceType` mexe em folders/templates/stages — `pipeline-service.ts:141-225`.
- **NOVO:** `system_service_type_folders.frente_slug TEXT NULL` (NULL = vale para todo o tema; setado = só aquela frente). Opcional `system_stage_checklist_defs.frente_slug NULL`. Serviço/hooks passam a filtrar por frente do caso.

---

## Acceptance Criteria

1. `system_service_type_folders` ganha `frente_slug TEXT NULL`; as 3 pastas de caso do FIES_ESF recebem `frente_slug` (`ESF`/`CENSO`/`PORTARIA`) coerente com R2-02; pastas de procuração e demais temas ficam com `frente_slug=NULL` (vale para o tema todo) até o cliente refinar.
2. `system_stage_checklist_defs` ganha `frente_slug TEXT NULL` (aditivo; NULL = def comum do tema). Índice/UNIQUE ajustados para incluir `frente_slug` **sem** quebrar defs existentes. **[C4] Padrão obrigatório:** o índice UNIQUE usa `COALESCE(frente_slug,'')` (NULLs contam como valores distintos no Postgres → duplicatas silenciosas se `frente_slug` entrar cru no UNIQUE) — alinhado com o padrão de R2-07 (`UNIQUE(tema_id, COALESCE(frente_slug,''), key) WHERE deleted_at IS NULL`).
3. Serviço de resolução de pastas/modelos passa a filtrar por `(service_type_id/tema, frente_slug do caso OU frente_slug NULL)`; **fallback por `case_type` preservado** quando não houver vínculo por frente.
4. Instanciação/reconciliação de checklist considera `frente_slug` (def com frente só instancia para casos daquela frente; def sem frente instancia para todas).
5. `deleteServiceType`/exclusão de categoria continua consistente (cascata inclui os novos vínculos por frente sem órfãos).
6. Nenhuma migration aqui toca `system_cases` (não recria `system_cases_active`) — confirmar. Dual-write intacto; trigger de bifurcação não recriado.
7. Rollback: DROP das colunas `frente_slug` das 2 tabelas + restaura índices/uniques anteriores; sem perda de vínculos legados.

---

## Tasks / Subtasks

- [ ] **Migration** `20260719000004_folders_checklist_por_frente.sql` (AC: 1,2,7)
  - [ ] `ALTER TABLE system_service_type_folders ADD COLUMN IF NOT EXISTS frente_slug TEXT`.
  - [ ] `UPDATE` das 3 pastas de caso do FIES_ESF com `frente_slug` (ESF/CENSO/PORTARIA) — coerente com o mapa de R2-02; idempotente (`WHERE frente_slug IS NULL`).
  - [ ] Ajustar `UNIQUE(service_type_id, kind, drive_folder_id)` para tolerar frente via índice único parcial `UNIQUE(service_type_id, kind, drive_folder_id, COALESCE(frente_slug,'')) WHERE deleted_at IS NULL` — **[C4] `COALESCE(frente_slug,'')` obrigatório** (NULLs são distintos no Postgres; sem `COALESCE` o UNIQUE permite duplicatas silenciosas de pasta sem frente). Padrão idêntico ao de R2-07.
  - [ ] `ALTER TABLE system_stage_checklist_defs ADD COLUMN IF NOT EXISTS frente_slug TEXT`; revisar `system_stage_checklist_defs_uq` incluindo `COALESCE(frente_slug,'')` (mesmo padrão C4) sem quebrar defs com frente NULL.
  - [ ] Recriar views `_active` das 2 tabelas expondo `frente_slug`.
- [ ] **Rollback** `20260719000004_folders_checklist_por_frente.rollback.sql`.
- [ ] **Serviço (leitura de pastas/modelos)** (AC: 3) — no resolvedor de pastas por categoria (consumido por `useTypeFolders`/`useTemplatesByFolders`, `GenerateCaseDocumentFlow`, `CaseSignActions`, `CaseDocumentsTab`), incluir filtro por `frente_slug` do caso (OU NULL) mantendo fallback `case_type`.
- [ ] **Checklist** (AC: 4) — `instanciarChecklist`/`listCaseChecklistItems` (`checklist-service.ts`) consideram `frente_slug` da def vs frente do caso.
- [ ] **Exclusão de categoria** (AC: 5) — revisar `deleteServiceType` (`pipeline-service.ts:141-225`) para cascata coerente com os novos vínculos.
- [ ] **Types** — `frente_slug` nas 2 tabelas.
- [ ] **Testes** (AC: 3,4).

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA `sistema-hv/supabase/migrations/20260719000004_folders_checklist_por_frente.sql` + rollback.
- `sistema-hv/src/lib/checklist-service.ts` (instanciação/reconciliação por frente).
- Resolvedor de pastas/modelos por categoria (hooks `useTypeFolders`/`useTemplatesByFolders`; componentes `GenerateCaseDocumentFlow`, `CaseSignActions`, `components/cases/CaseDocumentsTab`).
- `sistema-hv/src/lib/pipeline-service.ts` (`deleteServiceType` cascata).
- `sistema-hv/src/lib/supabase/types.ts`.

**Regras de ouro:**
- Manter **fallback por `case_type`** (doc-mestre §5.2 mitigação) — nunca esconder modelos legados de casos sem frente.
- Idempotência via `ADD COLUMN IF NOT EXISTS` + `WHERE frente_slug IS NULL`.
- Nenhuma coluna de `system_cases` tocada → **não** recriar `system_cases_active` (confirmar); trigger de bifurcação intocado.
- `npx tsx scripts/db-apply-pg.ts` + rollback.

**Riscos de regressão (críticos):**
- **UNIQUE com NULL [C4]:** `UNIQUE(...,frente_slug)` trata NULLs como distintos no Postgres → permite duplicatas silenciosas de pasta sem frente. Mitigação **padronizada** (alinhada a R2-07): índice único parcial com `COALESCE(frente_slug,'')` nas 2 tabelas (folders e checklist_defs). Não deixar `frente_slug` cru no UNIQUE.
- **Sumiço de modelos:** filtro por frente estrito (sem incluir `frente_slug IS NULL`) esconde os modelos comuns do tema. Mitigação: sempre `frente_slug = <caso> OR frente_slug IS NULL`, + fallback `case_type`.
- **Checklist:** def com frente instanciando em caso de outra frente (ou não instanciando na frente certa) → gate de avanço fin quebra. Mitigação: testes por frente; reconciliação on-read (MEMORY `checklist_reconciliacao`) considera frente.
- **Exclusão de categoria** deixando vínculos por frente órfãos no Drive → lixo. Mitigação: cascata revisada.

## Testing

- Caso da frente ESF: geração de doc lista pasta ESF (não Censo/Portaria) + modelos comuns do tema; caso sem frente cai no fallback `case_type`.
- Checklist: def com `frente_slug='DGM'` só instancia em casos da frente DGM; def NULL instancia em todos.
- Excluir categoria remove vínculos por frente sem deixar template/pasta órfão.
- Rollback remove `frente_slug` sem perder vínculos legados.
- `npm run typecheck` / `npm run lint` verdes.

## Dependências

- **Depende de:** R2-02 (`frente_slug` nos casos), R2-03 (etapas consolidadas — checklist ancora em stage_slug consolidado).
- **Habilita:** R2-05 (criação de caso puxando docs por frente).
- **Cruzamento com R5 (geração de documentos / variáveis):** os modelos por frente alimentam a geração/autofill (doc-mestre §8 B5); coordenar com a story de R5 que trata `document-autofill.ts`.
- **BLOQUEADA parcialmente por PENDÊNCIA DO CLIENTE:** mapa definitivo de frentes × pastas/modelos (§9 item 1). Roda com o mapa provisório das 3 pastas FIES_ESF conhecidas.

## File List

- `sistema-hv/supabase/migrations/20260719000004_folders_checklist_por_frente.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260719000004_folders_checklist_por_frente.rollback.sql` (novo)
- `sistema-hv/src/lib/checklist-service.ts`
- `sistema-hv/src/lib/pipeline-service.ts` (`deleteServiceType`)
- resolvedor de pastas/modelos por categoria (hooks + componentes de documentos)
- `sistema-hv/src/lib/supabase/types.ts`

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — fase 5d do épico R2 | @sm |
| 2026-07-18 | 0.2 | C1 (QA/Architect): renumeração para evitar colisão com R3-01 — migration/rollback/File List `20260718000004_folders_checklist_por_frente` → `20260719000004_folders_checklist_por_frente`. C4 (Architect): padronizado `COALESCE(frente_slug,'')` nos índices UNIQUE de `system_service_type_folders` e `system_stage_checklist_defs` (NULLs distintos no Postgres → duplicatas silenciosas), alinhado ao padrão já usado em R2-07. Atualizados AC-2, task de migration e risco de regressão. | @sm |
