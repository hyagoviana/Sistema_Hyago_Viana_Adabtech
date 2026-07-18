# Story R2-03: Unificar pipeline operacional por TEMA (etapa comum vs condicional por frente)

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **Fase da Sequência Segura §7:** 5c (unificar pipeline op + migrar macrostatus_op)
- **ID:** R2-03
- **Status:** Ready for Review
- **Estimativa relativa:** L (consolida etapas divergentes + backfill de `macrostatus_op` + decisão de etapa condicional; o item mais sensível do épico junto de R2-02)
- **Executor sugerido:** @data-engineer + @architect (decisão de etapas) · Quality gate: @architect
- **Risco:** CRÍTICO (mexe em `system_pipeline_stages` op, `macrostatus_op`, projeção `stage_op_id` e gates de checklist ancorados em `stage_slug`)

---

## Story

**Como** arquiteto,
**quero** que cada TEMA tenha **UMA pipeline operacional** (etapas consolidadas), decidindo explicitamente quais etapas são **comuns do tema** e quais são **condicionais por frente** (ex.: `DGM_ENVIADA`), migrando `macrostatus_op` dos casos existentes sem que nenhum caso fique órfão de etapa,
**para que** o Kanban por tema (R2-05) tenha um conjunto único de colunas coerente.

> **DECISÃO TRAVADA (D2, doc-mestre §2, §4.2, §10-R2):** pipeline op **unificada por tema**. As etapas hoje separadas por `service_type` (ex.: FIES_DGM tem `DGM_ENVIADA`, FIES_ESF não) precisam de decisão: **`DGM_ENVIADA` vira etapa comum do tema FIES/1%** OU **etapa condicional exibida só na frente DGM**. Registrar a escolha no Change Log.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (op por service_type):** `system_pipeline_stages` kind='op' filtrado por `service_type_id` — seed `20260609000001_pipelines_por_tipo.sql:28-101`. FIES_DGM tem `DGM_ENVIADA` (ordem 3); FIES_ESF não. Demais slugs coincidem (ONBOARDING, TRIAGEM, DOCS_PENDENTES, PRONTO_PROTOCOLO, ACOMPANHAMENTO_ADM, JUDICIAL_OPERACIONAL, IMPLANTADO, ENCERRADO_OPERACIONAL, CANCELADO).
- **JÁ EXISTE (projeção):** `system_fn_sync_stage_ids()` resolve `stage_op_id` por `(service_type_id, kind='op', slug=macrostatus_op)` — `s13_espinha.sql:132-135`. **Isto é o gargalo:** hoje a etapa é por `service_type_id`, não por tema.
- **JÁ EXISTE (checklist ancorado em slug):** `system_stage_checklist_defs (service_type_id, stage_slug, key)` — `20260703000001_stage_checklist.sql:20-42`; guarda de exclusão de etapa conta itens por `(service_type_id, stage_slug)` — `pipeline-service.ts:377-385`.
- **JÁ EXISTE (revive por ON CONFLICT):** upsert de etapas `ON CONFLICT (service_type_id, kind, slug) DO UPDATE ... deleted_at = NULL` — `20260609000001:96-101`.
- **JÁ EXISTE (`caseCodePrefix`/hooks `useStages`):** consumem `service_type_id` — reapontados em R2-05.
- **NOVO:** conjunto de etapas op **canônico por tema** + coluna `frente_condicional`/`frente_slug` na etapa (para etapa condicional) + backfill do `macrostatus_op` dos casos para os slugs consolidados.

> **DECISÃO DE ARQUITETURA a travar (registrar no Change Log):** como o trigger resolve `stage_op_id` por `service_type_id`, há 2 caminhos:
> - **A (preferido, menor blast radius):** **manter `system_pipeline_stages` por service_type**, mas **garantir que todos os service_types do MESMO tema tenham o MESMO conjunto de slugs op** (via upsert `ON CONFLICT`), incluindo `DGM_ENVIADA` em AMBOS (FIES_ESF e FIES_DGM). A "unificação" é lógica (mesmos slugs) e o Kanban por tema (R2-05) une os cards de todos os service_types do tema. Trigger **intocado**. Etapa condicional: adicionar coluna `system_pipeline_stages.frente_slug NULL` (NULL=comum; setado=condicional) só para o FILTRO na UI.
> - **B:** reancorar a projeção em `tema_id` (etapas por tema, novo `stage_op_id` resolvido por tema). Exige alterar `system_fn_sync_stage_ids` → **maior risco**; adiar salvo necessidade.
> Esta story assume **Opção A** salvo decisão contrária.

---

## Acceptance Criteria

1. Todos os service_types de um mesmo tema passam a ter o **mesmo conjunto de slugs op** (upsert idempotente `ON CONFLICT` reavivando/criando slugs faltantes — ex.: `DGM_ENVIADA` criado também em FIES_ESF, marcado como condicional da frente DGM).
2. `system_pipeline_stages` ganha `frente_slug TEXT NULL` (NULL = etapa comum do tema; setado = condicional daquela frente). `DGM_ENVIADA` recebe `frente_slug='DGM'`.
3. `macrostatus_op` de casos existentes migrado para os slugs consolidados quando aplicável; **nenhum caso** fica com `macrostatus_op` cujo slug não exista mais nas etapas do seu service_type (verificação: 0 órfãos).
4. Projeção `stage_op_id` continua resolvendo para todos os casos após a migração (trigger reexecutado via `UPDATE ... SET macrostatus_op=macrostatus_op` ou toque explícito) — 0 casos com `stage_op_id` NULL para `macrostatus_op` NOT NULL.
5. Checklist defs ancorados em `(service_type_id, stage_slug)` **não** quebram: se um slug foi renomeado, defs são reancoradas (UPDATE do `stage_slug`) idempotente.
6. Dual-write intacto (`case_type`/`macrostatus_*` vivos); `trg_system_cases_bifurcacao` **não** recriado; view `system_cases_active` só recriada SE alguma coluna de `system_cases` for tocada (aqui não deve ser — confirmar).
7. Rollback: restaura o conjunto de etapas op anterior (soft-delete das criadas, reviver as aposentadas), reverte `frente_slug`, e restaura `macrostatus_op` mapeado de volta (tabela de-para simétrica).
8. **[C2] Auto-avanço respeita a frente:** um caso de uma frente (ex.: ESF) que auto-avança **não** para em etapa condicional de outra frente (ex.: `DGM_ENVIADA`, `frente_slug='DGM'`). Garantido pela decisão travada na task C2 — opção (a) patch das duas funções de auto-avanço com `AND (frente_slug IS NULL OR frente_slug = <frente do caso>)`, OU opção (b) etapas condicionais promovidas a etapas comuns do tema (sem `frente_slug` em stage, gap eliminado sem tocar as funções).

---

## Tasks / Subtasks

- [x] **Decisão de etapas** (AC: 1,2) — TRAVADA no design (Opção 1 + Opção b): tema manual nasce com o conjunto op **genérico padrão** de `createServiceType` (NOVO/EM_ANDAMENTO/GANHO/ENCERRADO/CANCELADO), 100% editável; **todas as etapas são comuns do tema** (`frente_slug` NULL). Registrado no Change Log v0.3.
- [x] **[C2] Auto-avanço vs etapa condicional de frente** (AC: 8) — **Opção (b) escolhida** (design §2.2/§7): etapas do tema manual são comuns; **nenhuma** etapa recebe `frente_slug` no seeding → as funções `system_fn_avancar_se_checklist_ok` e `system_fn_avancar_fin_se_ok` **NÃO são tocadas**, o gap é eliminado na raiz. A coluna `frente_slug` é criada (exibição-only, R2-05), nunca consultada pelo auto-avanço. Opção (a) fica como contingência documentada para a fusão do legado `DGM_ENVIADA` (R2-02). *(Nota: nome real da fn fin é `system_fn_avancar_fin_se_ok`, corrigido no design §2.1.)*
- [x] **Migration** `20260719000003_pipeline_op_unica_por_tema.sql` (AC: 2, 6) — **SÓ a coluna aditiva** (design §5). Consolidação/backfill/de-para/reancoragem/soft-delete de legados → **R2-02** (bloqueado pela lista do cliente).
  - [x] `ALTER TABLE system_pipeline_stages ADD COLUMN IF NOT EXISTS frente_slug TEXT` (+ COMMENT "exibição-only").
  - [~] Upsert do conjunto op canônico para service_types legados — **R2-02** (fusão FIES_ESF+FIES_DGM; depende da lista).
  - [~] De-para de `macrostatus_op` legado → consolidado — **R2-02**.
  - [~] Reexecutar projeção (`UPDATE ... SET macrostatus_op=macrostatus_op`) — **R2-02** (não há consolidação aqui).
  - [~] Reancorar checklist defs por slug — **R2-02** (nenhum slug renomeia no tema manual).
  - [~] Soft-delete de slugs obsoletos — **R2-02**.
- [x] **Rollback** `20260719000003_pipeline_op_unica_por_tema.rollback.sql` (AC: 7) — `DROP COLUMN IF EXISTS frente_slug` (simétrico à migration aditiva).
- [x] **Seeding do tema (Opção 1)** — `createTema` cria o `system_service_type` interno espelho via `createServiceType` e vincula `tema_id`; guarda de colisão de slug (`_T`/`_T2`…) para não estourar UNIQUE; compensação (soft-delete do tema) se o seeding falhar (R-1). `deleteTema` soft-deleta o service_type interno via `deleteServiceType` (guarda de casos por `service_type_id`/`case_type` → 409). Helper `getTemaServiceType`. `frente_slug` em types.ts.
- [~] **App (leitura)** — `useStages`/`listStages` filtrar por `frente_slug` no Kanban — **R2-05** (aqui só a coluna existe + está nos types).
- [~] **Validação de dados** (AC: 3,4) — 0 órfãos / 0 `stage_op_id` NULL — pertence ao backfill de **R2-02**; no tema manual não há de-para de `macrostatus_op`.

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA `sistema-hv/supabase/migrations/20260719000003_pipeline_op_unica_por_tema.sql` + rollback.
- `sistema-hv/src/lib/supabase/types.ts` (`system_pipeline_stages.frente_slug`).

**Regras de ouro:**
- **NUNCA deletar `case_type`/`macrostatus_*`.** A consolidação é sobre `system_pipeline_stages`, não sobre as colunas fonte.
- Reviver/criar etapa via `ON CONFLICT (service_type_id, kind, slug) DO UPDATE` (nunca DELETE duro de etapa com casos).
- Aposentar (soft-delete) etapa só após backfill provar 0 casos apontando (padrão `20260609000001`).
- **NÃO recriar `trg_system_cases_bifurcacao`**; **NÃO** alterar `system_fn_sync_stage_ids` na Opção A.
- `npx tsx scripts/db-apply-pg.ts` + rollback.

**Riscos de regressão (os MAIORES do épico):**
- **Órfão de etapa:** mudar `macrostatus_op` sem que o slug destino exista nas etapas do service_type → card some do Kanban e `stage_op_id` fica NULL. Mitigação: upsert das etapas ANTES do UPDATE de `macrostatus_op`; verificação final de 0 órfãos.
- **Checklist quebrado:** def ancorada em `stage_slug` antigo deixa de casar após rename → gate `system_fn_avancar_se_checklist_ok` some itens. Mitigação: reancorar defs no MESMO passo.
- **Gate de avanço fin/op** (`20260703000003_fn_avancar_checklist.sql`, `20260704000001_fn_avancar_fin.sql`) lê `stage_slug` — verificar que os slugs consolidados são os mesmos que a UI move.
- **[C2] Auto-avanço ignora `frente_slug`:** `system_fn_avancar_se_checklist_ok` (`20260703000003_fn_avancar_checklist.sql:71-79`) e `system_fn_avancar_fin` (`20260704000001_fn_avancar_fin.sql:73-87`) selecionam a próxima etapa por `service_type_id`+`ordem` **sem** filtrar `frente_slug`. Com etapa condicional no conjunto do tema, um caso de outra frente pode parar nela. Mitigação: decisão travada na task C2 — (a) patch das duas funções com `AND (frente_slug IS NULL OR frente_slug = <frente do caso>)`; ou (b) etapas condicionais viram comuns do tema (sem `frente_slug` em stage). Ver AC-8 e Testing.
- **`DGM_ENVIADA` como etapa condicional:** se exibida em frentes que não a usam, polui o board; se escondida errado, some progresso. Mitigação: `frente_slug` na etapa + filtro só na UI (R2-05), nunca removendo a etapa do banco.

## Testing

- Para cada tema: `SELECT DISTINCT slug FROM system_pipeline_stages WHERE kind='op' AND service_type_id IN (service_types do tema)` — conjuntos idênticos entre service_types do mesmo tema.
- `SELECT count(*) FROM system_cases c WHERE c.deleted_at IS NULL AND c.macrostatus_op IS NOT NULL AND NOT EXISTS (SELECT 1 FROM system_pipeline_stages s WHERE s.service_type_id=c.service_type_id AND s.kind='op' AND s.slug=c.macrostatus_op AND s.deleted_at IS NULL)` = 0.
- `SELECT count(*) FROM system_cases WHERE macrostatus_op IS NOT NULL AND stage_op_id IS NULL AND deleted_at IS NULL` = 0.
- Checklist: itens instanciados continuam casando com defs pós-rename.
- **[C2] Auto-avanço/frente:** um caso da frente **ESF** com checklist completo que dispara auto-avanço **NÃO** para na etapa `DGM_ENVIADA` (`frente_slug='DGM'`) — pula direto para a próxima etapa comum. Testar em `system_fn_avancar_se_checklist_ok` (op) e `system_fn_avancar_fin` (fin) conforme a opção travada em C2. Caso da frente DGM continua parando/passando por `DGM_ENVIADA` normalmente.
- Rollback restaura contagens por etapa anteriores.
- `npm run typecheck` / `npm run lint` verdes.

## Dependências

- **Depende de:** R2-01 (estrutura), R2-02 (`tema_id`/`frente_slug` nos casos e service_types).
- **Habilita:** R2-05 (Kanban/lista por tema com filtro de frente), R2-06 (campos por tema/frente).
- **Cruzamento com R4 (checklist/etapas), se existir:** a reancoragem de defs por slug precisa alinhar com qualquer story de R4 que edite checklist. Coordenar ordem.
- **BLOQUEADA parcialmente por PENDÊNCIA DO CLIENTE:** decisão final de quais etapas são comuns vs condicionais depende do desenho de frentes (doc-mestre §9 item 1/2). Pode rodar com o conjunto atual (só FIES/1% tem divergência conhecida: DGM_ENVIADA).

## File List

- `sistema-hv/supabase/migrations/20260719000003_pipeline_op_unica_por_tema.sql` (novo — só `frente_slug` aditivo)
- `sistema-hv/supabase/rollbacks/20260719000003_pipeline_op_unica_por_tema.rollback.sql` (novo — `DROP COLUMN`)
- `sistema-hv/src/lib/supabase/types.ts` (`frente_slug` em `system_pipeline_stages`)
- `sistema-hv/src/lib/tema-service.ts` (seeding do service_type interno em `createTema` + guarda de colisão de slug `uniqueServiceTypeSlug` + `getTemaServiceType` + `deleteTema` soft-deleta o service_type interno)

## Dev Agent Record

**Agente:** @dev (James) · **Data:** 2026-07-18 · **Modelo:** design R2-03-design-pipeline-tema.md (Opção 1 + Opção b).

### Decisões de implementação
- **Opção 1 (service_type interno espelho 1:1):** `createTema` chama `createServiceType({name, slug, ordem})` (que já semeia op/fin/comercial) e faz `UPDATE system_service_types SET tema_id = tema.id`. O motor (trigger, checklist, moveCase*) fica **intocado** — casos rodam por `service_type_id` como hoje.
- **Guarda de colisão de slug (R-3):** `uniqueServiceTypeSlug` deriva o slug do service_type interno do MESMO slug do tema; se já houver service_type ATIVO com esse slug (ex.: legado "COVID"), **sufixa** `_T`/`_T2`… (respeitando o teto de 40 chars). NÃO reutiliza o legado — o tema precisa do seu próprio motor com etapas espelho recém-semeadas. O slug do tema (`system_temas`) é independente e mantém sua própria UNIQUE.
- **Compensação (R-1, atomicidade):** supabase-js não tem transação multi-statement; se o seeding falhar, o tema recém-criado é **soft-deletado** (+ tombstone do slug) e lança 500 legível — evita tema órfão sem pipeline.
- **`deleteTema`:** além da guarda por `tema_id`, chama `deleteServiceType(serviceType.id)` que traz a MESMA guarda de casos por `service_type_id` OU `case_type=slug` (→ 409) — cobre o alerta do arquiteto (R2-06) de que casos podem chegar via o service_type do motor, não só via `tema_id`.
- **Opção b (etapa comum):** nenhuma etapa recebe `frente_slug` no seeding; as 2 funções de auto-avanço **não foram tocadas**. `frente_slug` é criada só como coluna de exibição (consumida em R2-05).
- **Coexistência (não resolvida por decisão):** "Nova categoria" legada (service_type solto, `tema_id` NULL) e "Temas" (service_type interno) coexistem; unificação da UI é refinamento R2-05/R2-06 — documentado no header de `tema-service.ts`.

### NÃO tocado (restrições cumpridas)
- `system_fn_sync_stage_ids` / `trg_system_cases_bifurcacao` / `trg_system_cases_sync_stages` — intocados.
- `system_fn_avancar_se_checklist_ok` / `system_fn_avancar_fin_se_ok` — intocadas (Opção b).
- `case_type` / `macrostatus_*` — não deletados. `system_cases` / `system_cases_active` — não tocados (migration não recria a view; AC-6/R-7 ok).
- **Sem** consolidação/backfill/de-para/reancoragem de legados (isso é R2-02).
- Migration **NÃO aplicada** no banco (aguarda revisão do owner).

### Validação
- `npm run typecheck`: **0 erros novos** em `tema-service.ts`/`pipeline-service.ts`/`types.ts`. Erros pré-existentes remanescem (dossie-service/termo-service/visibility/casos routes — `system_case_checklist_item_assignees` fora dos types gerados + narrowings `string | null`), não relacionados a este story.
- `npx eslint src/lib/tema-service.ts src/lib/supabase/types.ts`: **limpo** (exit 0).
- `npm run test:rbac`: **verde** (todos passaram).
- `prettier --write` aplicado aos `.ts` (LF); SQL não tem parser no prettier (esperado).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — fase 5c do épico R2; decisão A (mesmos slugs por tema, trigger intocado) proposta | @sm |
| 2026-07-18 | 0.2 | C1 (QA/Architect): renumeração para evitar colisão com R3-01 — migration/rollback/File List `20260718000003_pipeline_op_unica_por_tema` → `20260719000003_pipeline_op_unica_por_tema`. C2 (QA — CRÍTICO): funções de auto-avanço `system_fn_avancar_se_checklist_ok` (`20260703000003_fn_avancar_checklist.sql:71-79`) e `system_fn_avancar_fin` (`20260704000001_fn_avancar_fin.sql:73-87`) escolhem próxima etapa por `service_type_id`+`ordem` sem filtrar `frente_slug` → caso de outra frente pode parar em etapa condicional (ex.: ESF parando em `DGM_ENVIADA`). Adicionada task C2 com 2 opções (a: patch das duas funções com filtro de frente / b: promover condicionais a etapas comuns), AC-8 e caso de Testing (ESF não para em DGM ao auto-avançar). Decisão a travar neste Change Log no planejamento. | @sm |
| 2026-07-18 | 0.3 | **DECISÃO TRAVADA (design R2-03-design-pipeline-tema.md):** **Opção 1** (1 TEMA ⇔ 1 `system_service_type` interno espelho 1:1 — `createTema` semeia o service_type interno via `createServiceType` e vincula `tema_id`; motor/trigger intocados; casos rodam por `service_type_id`) + **Opção b / C2** (etapas do tema são comuns — nenhuma etapa recebe `frente_slug` no seeding → funções de auto-avanço **NÃO tocadas**, gap eliminado na raiz; `frente_slug` criada só p/ exibição em R2-05). **IMPLEMENTADO (@dev):** `createTema` (seeding + guarda de colisão de slug `_T` + compensação R-1), `deleteTema` (soft-delete do service_type interno via `deleteServiceType` c/ guarda de casos), helper `getTemaServiceType`, migration ADITIVA (só `frente_slug` + COMMENT) + rollback (DROP COLUMN), `frente_slug` em types.ts. **NÃO** consolida/faz backfill de legados (isso é R2-02, bloqueado pela lista). typecheck (0 erros novos) / eslint (limpo) / test:rbac (verde). Migration **não aplicada** (aguarda revisão). Status → Ready for Review. | @dev (James) |
