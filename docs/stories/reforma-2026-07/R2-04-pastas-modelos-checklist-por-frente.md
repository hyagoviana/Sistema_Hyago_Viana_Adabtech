# Story R2-04: Migrar pastas/modelos/checklist para (TEMA, FRENTE)

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **Fase da Sequência Segura §7:** 5d (migrar pastas/modelos/checklist)
- **ID:** R2-04
- **Status:** Ready for Review
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

1. `system_service_type_folders` ganha `frente_slug TEXT NULL`. **[Dev v0.3]** O UPDATE das 3 pastas de caso do FIES_ESF (`ESF`/`CENSO`/`PORTARIA`) foi **movido para R2-02/fusão** (por instrução do épico: "NÃO popular pastas legadas — espera a lista"). A migration só cria a coluna; todas as linhas nascem `frente_slug=NULL` (vale p/ o tema todo) até o cliente refinar.
2. `system_stage_checklist_defs` ganha `frente_slug TEXT NULL` (aditivo; NULL = def comum do tema). Índice/UNIQUE ajustados para incluir `frente_slug` **sem** quebrar defs existentes. **[C4] Padrão obrigatório:** o índice UNIQUE usa `COALESCE(frente_slug,'')` (NULLs contam como valores distintos no Postgres → duplicatas silenciosas se `frente_slug` entrar cru no UNIQUE) — alinhado com o padrão de R2-07 (`UNIQUE(tema_id, COALESCE(frente_slug,''), key) WHERE deleted_at IS NULL`).
3. Serviço de resolução de pastas/modelos passa a filtrar por `(service_type_id/tema, frente_slug do caso OU frente_slug NULL)`; **fallback por `case_type` preservado** quando não houver vínculo por frente.
4. Instanciação/reconciliação de checklist considera `frente_slug` (def com frente só instancia para casos daquela frente; def sem frente instancia para todas).
5. `deleteServiceType`/exclusão de categoria continua consistente (cascata inclui os novos vínculos por frente sem órfãos).
6. Nenhuma migration aqui toca `system_cases` (não recria `system_cases_active`) — confirmar. Dual-write intacto; trigger de bifurcação não recriado.
7. Rollback: DROP das colunas `frente_slug` das 2 tabelas + restaura índices/uniques anteriores; sem perda de vínculos legados.

---

## Tasks / Subtasks

- [x] **Migration** `20260719000004_folders_checklist_por_frente.sql` (AC: 1,2,7)
  - [x] `ALTER TABLE system_service_type_folders ADD COLUMN IF NOT EXISTS frente_slug TEXT`.
  - [~] `UPDATE` das 3 pastas de caso do FIES_ESF com `frente_slug` (ESF/CENSO/PORTARIA) — **movido para R2-02/fusão** (espera a lista definitiva do cliente). A migration só cria a COLUNA; NÃO popula legados, conforme instrução do épico. Coluna nasce NULL para todos.
  - [x] Ajustar `UNIQUE(service_type_id, kind, drive_folder_id)` para índice único parcial `UNIQUE(service_type_id, kind, drive_folder_id, COALESCE(frente_slug,'')) WHERE deleted_at IS NULL` — **[C4]** aplicado. Constraint antigo (auto-nomeado do CREATE TABLE) dropado via DO-block por catálogo (idempotente).
  - [x] `ALTER TABLE system_stage_checklist_defs ADD COLUMN IF NOT EXISTS frente_slug TEXT`; `system_stage_checklist_defs_uq` recriado incluindo `COALESCE(frente_slug,'')` (mesmo padrão C4).
  - [x] Recriar views `_active` das 2 tabelas expondo `frente_slug`.
  - [x] Atualizar `system_fn_instanciar_checklist` para filtrar por `frente_slug` (AC-4 no SQL — a fn lê o `frente_slug` do caso).
- [x] **Rollback** `20260719000004_folders_checklist_por_frente.rollback.sql` (restaura UNIQUEs anteriores, dropa colunas, restaura fn 20260710000003).
- [x] **Serviço (leitura de pastas/modelos)** (AC: 3) — `listTypeFolders`/`listTypeFolderIds` (`service-type-folders-service.ts`) aceitam `frenteSlug` e filtram `frente_slug = <frente> OR frente_slug IS NULL`; `useTypeFolders`/RPC propagam; `GenerateCaseDocumentFlow`/`CaseSignActions`/`CaseDocumentsTab` passam `caso.frente_slug`. **Fallback `case_type`** preservado (só atua quando não há pastas → modelos legados nunca somem).
- [x] **UI de vínculo por frente** (destrava R2-06 AC-3) — `CategoryFoldersEditor` ganhou dropdown de frente ("Todo o tema"=NULL) e grava `frente_slug`; integrado no `FrentesEditor` do `TemasManagerDialog` (via `useTemaServiceType`). TODOs removidos.
- [x] **Checklist** (AC: 4) — instanciação por frente feita na fn `system_fn_instanciar_checklist` (usada por `instanciarChecklist` e pela reconciliação on-read de `listCaseChecklistItems`): def com frente só instancia p/ casos daquela frente; def NULL p/ todas. Reconciliação on-read preservada.
- [x] **Exclusão de categoria** (AC: 5) — `deleteServiceType` (`pipeline-service.ts:169-197`) já cascateia por `service_type_id` → pega os vínculos por frente automaticamente. Confirmado, sem alteração necessária.
- [x] **Types** — `frente_slug` em `system_service_type_folders` e `system_stage_checklist_defs` (`supabase/types.ts`).
- [~] **Testes** (AC: 3,4) — validação via `typecheck` (sem erro novo), `test:rbac` (verde), `eslint`/`prettier`. Testes automatizados dedicados por frente ficam para quando houver dados de frente (R2-02) — não há harness de DB nesta base.

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
- `sistema-hv/src/lib/service-type-folders-service.ts` (`listTypeFolders`/`listTypeFolderIds`/`linkExistingFolder`/`createAndLinkFolder` c/ `frenteSlug`)
- `sistema-hv/src/rpc/service-type-folders.ts` (`frenteSlug` nos 3 fns)
- `sistema-hv/src/hooks/useServiceTypeFolders.ts` (`useTypeFolders`/`useCreateTypeFolder`/`useLinkTypeFolder` c/ `frenteSlug`)
- `sistema-hv/src/rpc/temas.ts` (`getTemaServiceTypeFn`)
- `sistema-hv/src/hooks/useTemas.ts` (`useTemaServiceType`)
- `sistema-hv/src/components/pipeline/CategoryFoldersEditor.tsx` (dropdown de frente; grava `frente_slug`; TODO(R2-04) removido)
- `sistema-hv/src/components/pipeline/TemasManagerDialog.tsx` (`FrentesEditor` reusa `CategoryFoldersEditor`; TODOs removidos)
- `sistema-hv/src/components/cases/GenerateCaseDocumentFlow.tsx` (prop `frenteSlug`)
- `sistema-hv/src/components/cases/CaseSignActions.tsx` (prop `frenteSlug`)
- `sistema-hv/src/components/cases/CaseDocumentsTab.tsx` (prop `frenteSlug`)
- `sistema-hv/src/routes/casos.$id.tsx` (passa `caso.frente_slug` aos componentes)
- `sistema-hv/src/lib/supabase/types.ts` (`frente_slug` nas 2 tabelas)
- `sistema-hv/src/lib/checklist-service.ts` (sem mudança de código — a lógica por frente vive na fn SQL `system_fn_instanciar_checklist`, chamada por `instanciarChecklist`/`listCaseChecklistItems`)
- `sistema-hv/src/lib/pipeline-service.ts` (`deleteServiceType` — confirmado sem alteração; cascata por `service_type_id` já cobre frentes)

## Dev Agent Record

**Agente:** James (@dev) · Modelo: Opus 4.8 · Data: 2026-07-18

**Decisões / notas de implementação:**
- **Checklist por frente na FN SQL, não no TS.** `instanciarChecklist` e a reconciliação on-read de `listCaseChecklistItems` chamam a mesma RPC `system_fn_instanciar_checklist`. Alterar só a fn (que passou a ler `system_cases.frente_slug` e filtrar `d.frente_slug IS NULL OR d.frente_slug = v_frente`) cobre AC-4 nos dois caminhos sem duplicar lógica no TS. Preserva idempotência (ON CONFLICT), herança de `assigned_to` e a propagação N:N de responsáveis.
- **`onConflict` com índice de expressão.** O UNIQUE parcial usa `COALESCE(frente_slug,'')`, uma EXPRESSÃO — o `upsert(...onConflict)` do PostgREST só casa lista de colunas literais. `linkExistingFolder` passou a fazer check-then-insert/update manual (mesma semântica idempotente do upsert anterior) para não depender do onConflict.
- **Fallback `case_type` preservado.** O filtro por frente é aditivo em `system_service_type_folders`; quando o caso não tem frente, `useTypeFolders` recebe `frenteSlug` `undefined`/`null` e o serviço de modelos (`document-templates-service`) só recai em `case_type` quando não há pastas — modelos legados nunca somem. Sem tocar `listDocumentTemplates`.
- **UI de vínculo por frente:** `CategoryFoldersEditor` ganhou prop `frentes` opcional; quando presente, cada seção (caso/procuração) mostra dropdown "Todo o tema" (NULL) + frentes e grava `frente_slug` na nova pasta. Reusado no `FrentesEditor` via `useTemaServiceType` (novo RPC `getTemaServiceTypeFn` → `getTemaServiceType` já existente).
- **Não toca cases/trigger:** a migration só adiciona colunas em `system_service_type_folders` e `system_stage_checklist_defs`. NÃO altera `system_cases`, NÃO recria `system_cases_active`, NÃO recria o trigger de bifurcação (AC-6 confirmado).
- **Migration NÃO aplicada** (por instrução) — aguarda revisão + `db-apply-pg`.

**Validação:**
- `npm run typecheck` — nenhum erro NOVO (22 erros pré-existentes idênticos ao HEAD; a única linha nova é o deslocamento +1 do erro pré-existente de `MoveCaseFinDialog` em `casos.$id.tsx`).
- `npm run test:rbac` — 🎉 todos verdes.
- `npx eslint` nos arquivos tocados — limpo; `prettier --write` (LF) aplicado.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — fase 5d do épico R2 | @sm |
| 2026-07-18 | 0.2 | C1 (QA/Architect): renumeração para evitar colisão com R3-01 — migration/rollback/File List `20260718000004_folders_checklist_por_frente` → `20260719000004_folders_checklist_por_frente`. C4 (Architect): padronizado `COALESCE(frente_slug,'')` nos índices UNIQUE de `system_service_type_folders` e `system_stage_checklist_defs` (NULLs distintos no Postgres → duplicatas silenciosas), alinhado ao padrão já usado em R2-07. Atualizados AC-2, task de migration e risco de regressão. | @sm |
| 2026-07-18 | 0.3 | Implementação (@dev): migration aditiva (colunas + UNIQUEs COALESCE + views + fn de instanciação por frente); serviço/hooks/RPC de pastas por frente c/ fallback `case_type`; UI de vínculo por frente no `CategoryFoldersEditor`/`FrentesEditor`; checklist por frente via `system_fn_instanciar_checklist`; `deleteServiceType` confirmado sem alteração; types. UPDATE FIES_ESF movido p/ R2-02. typecheck/test:rbac/eslint OK. Migration NÃO aplicada. Status → Ready for Review. | @dev |
