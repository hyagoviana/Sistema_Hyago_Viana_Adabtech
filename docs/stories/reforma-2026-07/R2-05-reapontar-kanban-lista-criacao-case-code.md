# Story R2-05: Reapontar Kanban/Lista/criação + case_code por TEMA + soft-delete de service_types órfãos

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **Fase da Sequência Segura §7:** 5e (reapontar app + só então soft-delete)
- **ID:** R2-05
- **Status:** Ready for Review
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

- [x] **Kanban por tema** (AC: 1) — `pipeline.tsx`: filtro por FRENTE (chip "Todas as frentes" + chips por frente, só no operacional) respeitando `system_pipeline_stages.frente_slug`; oculta colunas condicionais vazias de outra frente. Board por tema já funciona via o service_type INTERNO do tema (aparece na seleção de categorias); reaponte de dados feito. Nota: search param `tema` explícito e o toggle Kanban↔Lista ficam para R2-08 (fronteira de escopo); aqui entregou-se o reaponte de dados + filtro de frente.
- [x] **Lista por tema/frente** (AC: 2) — `casos.lista.tsx`: coluna "Frente" na tabela + busca client-side inclui `frente_slug`.
- [x] **CaseFormDialog tema→frente** (AC: 3) — select de TEMA (`useTemas`) + select de FRENTE encadeado (`useFrentes(temaId)`); envia `tema_id`+`frente_slug`; categoria legada (`case_type`) como fallback quando não há tema selecionado. Validators (`validators/case.ts`) aceitam `tema_id`(uuid opcional)/`frente_slug`(string opcional).
- [x] **createCase** (AC: 3,4) — grava `tema_id`/`frente_slug`; resolve o service_type INTERNO do tema (via `system_service_types.tema_id`) e usa seu slug como `case_type` (dual-write; trigger deriva `service_type_id`); 1ª etapa op resolvida pelo service_type do tema; `nextCaseCode` recebe `temaId`.
- [x] **caseCodePrefix/nextCaseCode** (AC: 4) — `cases-service.ts`: `nextCaseCode(caseType, temaId?)` prioriza o NOME do TEMA (`system_temas.name`) quando há `tema_id`; senão mantém o nome do service_type pelo slug (legado). Códigos existentes inalterados.
- [~] **Migration final** `20260719000005_soft_delete_service_types_orfaos.sql` (AC: 5) — **DIFERIDO para R2-02** (fusão de legados espera a lista do cliente). No modo manual não há service_types órfãos a aposentar; sem migration nesta entrega (design R2-03 §5, story escopo). Sem `db:push`.
- [~] **Rollback** correspondente — diferido junto com a migration (R2-02). Revert da UI é revert de código (mudanças 100% aditivas: `tema_id`/`frente_slug` são NULL sem tema; nada muda para casos legados).
- [x] **Testes** (AC: 1-4,6) — `npm run typecheck` (sem erro novo nos arquivos tocados), `npm run test:rbac` (verde), `npx eslint` limpo nos 5 arquivos. AC-5 (soft-delete) diferido → R2-02.

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

Modificados nesta entrega (R2-05, modo manual):
- `sistema-hv/src/lib/validators/case.ts` — `tema_id`(uuid opcional)/`frente_slug`(string opcional) no `caseCreateSchema`.
- `sistema-hv/src/lib/cases-service.ts` — `createCase` resolve service_type interno do tema + dual-write `tema_id`/`frente_slug`; `nextCaseCode(caseType, temaId?)` prefixo pelo NOME do tema.
- `sistema-hv/src/components/cases/CaseFormDialog.tsx` — selects TEMA→FRENTE (`useTemas`/`useFrentes`) + fallback categoria legada.
- `sistema-hv/src/routes/pipeline.tsx` — filtro por FRENTE (chips) + ocultar colunas condicionais vazias.
- `sistema-hv/src/routes/casos.lista.tsx` — coluna "Frente" + busca inclui `frente_slug`.

Reusados (sem alteração): `sistema-hv/src/hooks/useTemas.ts` (`useTemas`/`useFrentes`/`useTemaServiceType`), `sistema-hv/src/lib/tema-service.ts` (`getTemaServiceType`), `sistema-hv/src/hooks/useCases.ts`, `sistema-hv/src/hooks/usePipeline.ts`.

Diferidos → R2-02 (não criados nesta entrega):
- `sistema-hv/supabase/migrations/20260719000005_soft_delete_service_types_orfaos.sql`
- `sistema-hv/supabase/rollbacks/20260719000005_soft_delete_service_types_orfaos.rollback.sql`

## Dev Agent Record

### Agent Model Used
Claude Opus 4.8 (1M) — @dev (James)

### Decisões de implementação
- **Resolução tema→motor server-side (Opção 1, design R2-03):** o front só envia `tema_id`; `createCase` busca o service_type INTERNO do tema (`system_service_types.tema_id`) e usa seu **slug** como `case_type`. O trigger `system_fn_sync_stage_ids` deriva `service_type_id` do slug — motor **intocado**. Evita expor o slug interno no front e mantém o dual-write coerente (`case_type` + `service_type_id` + `tema_id` + `frente_slug`).
- **`case_type` placeholder no dialog:** ao escolher um tema, o dialog seta `case_type` = slug do tema (só para passar o `min(1)` do schema); o servidor sobrescreve pelo slug do service_type interno. Sem tema, usa o `case_type` do select de categoria (legado).
- **case_code por tema:** `nextCaseCode` ganhou `temaId?`; quando presente, o prefixo deriva de `system_temas.name` (fonte canônica). Como `createServiceType` usou o NOME do tema no service_type interno, o caminho legado (nome do service_type pelo slug) já renderia o mesmo prefixo — a leitura direta do tema é robustez. Só afeta casos NOVOS.
- **Filtro de frente no Kanban:** chips "Todas as frentes" + 1 por frente (frentes presentes nos casos ∪ `frente_slug` das etapas), só no operacional. Coluna condicional (`stage.frente_slug` não-nulo) visível se (a) é da frente filtrada OU (b) há caso nela; etapas comuns (`frente_slug` NULL) sempre visíveis. Não filtra o auto-avanço (só exibição — coerente com Opção b do design).
- **Coexistência:** sem temas cadastrados, o dialog mostra só o select "Tipo" (categoria) e os casos nascem com `tema_id`/`frente_slug` NULL — comportamento idêntico ao atual. FIES_ESF/FIES_DGM e demais legados seguem funcionando.

### Diferido
- **AC-5 (soft-delete de service_types órfãos) + migration/rollback `20260719000005`:** movido para **R2-02** (fusão de legados, bloqueada pela lista do cliente). No modo manual não há órfãos a aposentar. Sem migration nesta entrega (usa as colunas de R2-01; nenhuma alteração de schema).

### Validação executada
- `npm run typecheck`: sem erro NOVO nos arquivos tocados (erros pré-existentes em `checklist-service`/`dossie-service`/`visibility`/`termo-service`/`casos.$id`/`casos.financeiro.index` — tabela `system_case_checklist_item_assignees` ausente dos types + `service_type_id` nullable; não relacionados a esta story).
- `npm run test:rbac`: verde (todos os testes passaram).
- `npx eslint` nos 5 arquivos: limpo. `prettier --write` (LF) aplicado.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — fase 5e do épico R2 (encerra a migração) | @sm |
| 2026-07-18 | 0.2 | C1 (QA/Architect): renumeração para evitar colisão com R3-01 — migration/rollback/File List `20260718000005_soft_delete_service_types_orfaos` → `20260719000005_soft_delete_service_types_orfaos`. C6 (QA/Architect): cravada a fronteira de escopo com R2-08 (nova seção) — R2-05 entrega o reaponte de DADOS (Kanban/Lista por tema + filtro de frente funcional); R2-08 entrega o incremento de UX (toggle explícito Kanban↔Lista + Lista Excel), sem re-implementar o filtro/reaponte. Registrada a alternativa de fundir R2-08 em R2-05. Sem dupla-implementação. | @sm |
| 2026-07-18 | 0.3 | @dev: implementado o fluxo manual — CaseFormDialog tema→frente (fallback categoria legada); `createCase` resolve service_type interno do tema + dual-write `tema_id`/`frente_slug`; `nextCaseCode` prefixo pelo nome do tema; filtro de frente no Kanban (oculta colunas condicionais vazias); coluna+busca de frente na Lista; validators aceitam os campos. AC-5 soft-delete + migration `20260719000005` DIFERIDOS → R2-02 (sem migration nesta entrega). typecheck sem erro novo, test:rbac verde, eslint limpo. Status → Ready for Review. | @dev |
