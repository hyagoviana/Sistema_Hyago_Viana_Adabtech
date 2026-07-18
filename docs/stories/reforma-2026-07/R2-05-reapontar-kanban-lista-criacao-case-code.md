# Story R2-05: Reapontar Kanban/Lista/criação + case_code por TEMA + soft-delete de service_types órfãos

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **Fase da Sequência Segura §7:** 5e (reapontar app + só então soft-delete)
- **ID:** R2-05
- **Status:** Draft
- **Estimativa relativa:** L (mexe em Kanban, lista, CaseFormDialog, createCase, caseCodePrefix; encerra a migração)
- **Executor sugerido:** @dev + @data-engineer (soft-delete final) · Quality gate: @architect
- **Risco:** ALTO (reaponta UI de criação e boards; case_code afeta só casos novos)

---

## Story

**Como** operador,
**quero** que o Kanban e a Lista sejam organizados por **TEMA** (com filtro por frente), a criação de caso escolha **tema + frente** (puxando docs da frente), e o `case_code` derive do **nome do TEMA** — só então aposentando (soft-delete) service_types órfãos,
**para que** a jornada reflita o modelo TEMA→CASO→FRENTE de ponta a ponta sem quebrar casos existentes.

> **DECISÃO TRAVADA (doc-mestre §4.2, §5.1):** `case_code` prefixo passa a derivar do **nome do TEMA** (`caseCodePrefix()`). **Só afeta casos NOVOS** — não reescrever códigos antigos (MÉDIO §5.1). Soft-delete de service_types órfãos é o **último** passo, após tudo reapontado.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (Kanban):** `src/routes/pipeline.tsx` — search param `?cat={service_type_id}` (`:52-60`, `:83-86`); colunas `useStages(serviceTypeId, kind)` (`:317`); cards `useCasesByServiceType(serviceTypeId)` (`:318`); esconde comercial/somente-fin (`:332-341`).
- **JÁ EXISTE (Lista):** `src/routes/casos.lista.tsx` — busca client-side por código/cliente/tipo/etapa/município (`:36-50`); usa `CASE_TYPE_LABELS`/`MACRO_OP_LABELS`.
- **JÁ EXISTE (criação):** `CaseFormDialog` seleciona `case_type` = slug do service_type (`CaseFormDialog.tsx:64,78,110`); `createCase` resolve 1ª etapa op por `service_type` e gera `case_code` via `nextCaseCode(case_type)` (`cases-service.ts:48-68, 92-117`).
- **JÁ EXISTE (`caseCodePrefix`):** deriva do NOME da categoria (`system_service_types.name` pelo slug) — `cases-service.ts:39-59`. **Hoje já é "nome da categoria"; como o service_type vira TEMA, precisa derivar do NOME DO TEMA.**
- **JÁ EXISTE (service_type CRUD/soft-delete):** `pipeline-service.ts:141-225` (`deleteServiceType` com tombstone de slug).
- **NOVO:** Kanban/lista por `tema_id` (+ filtro `frente_slug`); `CaseFormDialog` com selects tema→frente; `createCase`/`nextCaseCode` derivam prefixo do TEMA; filtro de etapas condicionais por frente (consumindo `system_pipeline_stages.frente_slug` de R2-03).

---

## Acceptance Criteria

1. **Kanban** (`pipeline.tsx`): seleção passa a ser por **TEMA** (`?tema={tema_id}` — manter `cat` como alias legado que resolve tema, se necessário); colunas op unem as etapas do tema; cards = casos do tema (todos os service_types do tema); **filtro por frente** (chip/select) que respeita etapas condicionais (`frente_slug` da etapa).
2. **Lista** (`casos.lista.tsx`): coluna/filtro por **TEMA** e por **FRENTE**; busca client-side inclui tema e frente. (Visão "tipo Excel" = a lista atual servindo de base; melhorias de colunas configuráveis ficam fora do escopo mínimo.)
3. **Criação** (`CaseFormDialog`): usuário escolhe **TEMA** e depois **FRENTE**; o caso nasce com `tema_id` + `frente_slug` (além de `case_type`/`service_type_id` legados para dual-write); documentos/checklist puxados pela frente (R2-04).
4. **case_code**: `nextCaseCode`/`caseCodePrefix` derivam do **nome do TEMA** do caso; casos NOVOS recebem prefixo do tema; **códigos existentes NÃO são reescritos**.
5. **Soft-delete final**: service_types que ficaram órfãos após a fusão (se algum) são soft-deletados com tombstone (molde `deleteServiceType`), **somente** após verificar 0 casos ativos apontando e 0 dependências (pastas/modelos/checklist reapontados). FIES_ESF/FIES_DGM permanecem como service_types (dual-write) mesmo compartilhando o tema FIES/1% — **não** deletar quem tem casos.
6. Dual-write intacto: `case_type`/`macrostatus_*`/`service_type_id` continuam gravados e resolvidos pelo trigger. Migration final só toca `system_cases` se necessário (se sim, recria `system_cases_active`).
7. Rollback: reverte a UI (feature flag ou revert de código) e re-ativa qualquer service_type soft-deletado indevidamente.

---

## Tasks / Subtasks

- [ ] **Kanban por tema** (AC: 1) — `pipeline.tsx`: novo search param `tema`; hooks `useCasesByTema`/`useStagesByTema` (ou reuso agregando os service_types do tema); filtro de frente respeitando `system_pipeline_stages.frente_slug`.
- [ ] **Lista por tema/frente** (AC: 2) — `casos.lista.tsx`: filtros e busca por tema/frente.
- [ ] **CaseFormDialog tema→frente** (AC: 3) — selects encadeados (tema → frentes do tema via `system_tema_frentes`); enviar `tema_id`+`frente_slug` no payload; validators (`validators/case.ts`) aceitam os campos.
- [ ] **createCase** (AC: 3,4) — gravar `tema_id`/`frente_slug`; resolver 1ª etapa op (conjunto consolidado do tema); `nextCaseCode` deriva do nome do TEMA.
- [ ] **caseCodePrefix/nextCaseCode** (AC: 4) — `cases-service.ts`: buscar `name` via `tema_id` (não mais só `case_type`→service_type.name).
- [ ] **Migration final** `20260719000005_soft_delete_service_types_orfaos.sql` (AC: 5) — soft-delete idempotente APENAS de service_types com 0 casos e 0 dependências; guarda dupla.
- [ ] **Rollback** correspondente (re-ativa) + estratégia de revert da UI (feature flag recomendável).
- [ ] **Testes** (AC: 1-6).

---

## Fronteira de escopo com R2-08 (C6) — travada

Para evitar dupla-implementação do toggle Kanban↔Lista e do filtro de frente:

- **R2-05 (esta story) ENTREGA:** o **reaponte de DADOS** — Kanban e Lista organizados por `tema_id`; o **filtro de frente funcional** (respeitando `system_pipeline_stages.frente_slug` de R2-03, ocultando colunas condicionais vazias); a criação por tema→frente; `case_code` por tema; soft-delete final. É o **mínimo funcional** das duas visões por tema+frente.
- **R2-08 ENTREGA (incremento de UX, sobre o que R2-05 deixou pronto):** a **alternância explícita Kanban↔Lista** dentro do contexto do tema, a **Lista "tipo Excel"** (colunas densas + ordenação por coluna) e o refino visual dos filtros combinados. R2-08 **não** re-implementa o reaponte de dados nem o filtro de frente — consome-os.
- **Decisão alternativa registrada:** se o time preferir, R2-08 pode ser **fundida em R2-05** (entregar toggle+Excel junto). Enquanto separadas, vale a fronteira acima — **sem dupla-implementação** do mesmo controle.

## Dev Notes

**Arquivos/migrations a tocar:**
- `sistema-hv/src/routes/pipeline.tsx`, `sistema-hv/src/routes/casos.lista.tsx`.
- `sistema-hv/src/components/cases/CaseFormDialog.tsx`.
- `sistema-hv/src/lib/cases-service.ts` (`createCase`, `nextCaseCode`, `caseCodePrefix`).
- `sistema-hv/src/lib/validators/case.ts` (`tema_id`, `frente_slug`).
- hooks `usePipeline`/`useCases` (novos por tema).
- NOVA `sistema-hv/supabase/migrations/20260719000005_soft_delete_service_types_orfaos.sql` + rollback.

**Regras de ouro:**
- **NUNCA deletar `case_type`/`macrostatus_*`.** FIES_ESF/FIES_DGM seguem existindo como service_types (dual-write) mesmo sob o tema FIES/1%.
- **case_code só afeta casos NOVOS** — não reescrever códigos antigos (§5.1 MÉDIO).
- Soft-delete de service_type é o **último** passo e só se **órfão** (0 casos, dependências reapontadas) — molde `deleteServiceType` (tombstone de slug, guarda de casos) `pipeline-service.ts:156-215`.
- Se a migration final tocar `system_cases`, **recriar `system_cases_active`**; **não** recriar trigger de bifurcação.
- `npx tsx scripts/db-apply-pg.ts` + rollback.

**Riscos de regressão (encerram o épico — máxima atenção):**
- **Kanban perder cards:** agregar por tema mas esquecer algum service_type do tema esconde casos. Mitigação: `useCasesByTema` = união dos service_types com `tema_id` = tema; testar com FIES/1% (2 service_types).
- **Etapas condicionais:** não filtrar `frente_slug` mostra `DGM_ENVIADA` em frentes ESF; filtrar demais some progresso de casos DGM. Mitigação: coluna sempre visível se há caso nela; filtro só oculta colunas vazias da frente.
- **case_code por tema colidir:** dois temas com nomes que normalizam pro mesmo prefixo. Mitigação: `caseCodePrefix` + sequência global já garante unicidade do sufixo; validar prefixos dos temas.
- **Soft-delete indevido:** aposentar um service_type que ainda tem casos → casos órfãos de tipo. Mitigação: guarda dupla (0 casos por `service_type_id` E por `case_type=slug`), igual `deleteServiceType:156-167`.
- **Dual-write:** `createCase` precisa continuar gravando `case_type`/`service_type_id` (o trigger depende deles). `tema_id`/`frente_slug` são adicionais, não substitutos.

## Testing

- Kanban FIES/1%: cards de FIES_ESF e FIES_DGM aparecem no mesmo board; filtro de frente ESF esconde `DGM_ENVIADA` vazia mas mantém se houver caso lá.
- Lista filtra por tema e por frente; busca acha por nome do tema.
- Criar caso escolhendo tema+frente → grava `tema_id`+`frente_slug`+`case_type`+`service_type_id`; `case_code` com prefixo do tema; docs da frente disponíveis.
- `SELECT case_code FROM system_cases` — códigos antigos inalterados.
- Soft-delete só remove service_types com 0 casos; FIES_ESF/FIES_DGM permanecem.
- Rollback re-ativa e revert da UI restaura comportamento.
- `npm run typecheck` / `npm run lint` verdes.

## Dependências

- **Depende de:** R2-01, R2-02, R2-03, R2-04 (toda a base migrada). **Última fase** da migração.
- **Cruzamento com R3 (permissões por módulo):** o Kanban/lista por tema deve respeitar `permissaoEfetiva`/visibilidade (advogado vê só seus casos) — reusar `getVisibleCaseIds` como hoje.
- **Cruzamento com R5:** criação com frente alimenta os campos FIES estruturados (A2) e a geração de documentos.
- **BLOQUEADA por PENDÊNCIA DO CLIENTE:** lista definitiva de temas/frentes (§9 item 1/2) para os selects encadeados refletirem o modelo final.

## File List

- `sistema-hv/src/routes/pipeline.tsx`
- `sistema-hv/src/routes/casos.lista.tsx`
- `sistema-hv/src/components/cases/CaseFormDialog.tsx`
- `sistema-hv/src/lib/cases-service.ts`
- `sistema-hv/src/lib/validators/case.ts`
- `sistema-hv/src/hooks/usePipeline.ts`, `sistema-hv/src/hooks/useCases.ts`
- `sistema-hv/supabase/migrations/20260719000005_soft_delete_service_types_orfaos.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260719000005_soft_delete_service_types_orfaos.rollback.sql` (novo)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — fase 5e do épico R2 (encerra a migração) | @sm |
| 2026-07-18 | 0.2 | C1 (QA/Architect): renumeração para evitar colisão com R3-01 — migration/rollback/File List `20260718000005_soft_delete_service_types_orfaos` → `20260719000005_soft_delete_service_types_orfaos`. C6 (QA/Architect): cravada a fronteira de escopo com R2-08 (nova seção) — R2-05 entrega o reaponte de DADOS (Kanban/Lista por tema + filtro de frente funcional); R2-08 entrega o incremento de UX (toggle explícito Kanban↔Lista + Lista Excel), sem re-implementar o filtro/reaponte. Registrada a alternativa de fundir R2-08 em R2-05. Sem dupla-implementação. | @sm |
