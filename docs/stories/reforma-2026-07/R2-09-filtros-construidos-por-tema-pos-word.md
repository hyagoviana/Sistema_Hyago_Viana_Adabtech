# Story R2-09: Filtros construídos pelo usuário por TEMA + preenchimento pós-Word + edição na lista

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **ID:** R2-09
- **Status:** Ready for Review
- **Estimativa relativa:** L (reusa `system_tema_field_defs`/`canonical_fields`; entrega: tipo booleano + editor plugado + pop-up pós-Word + edição/filtro-vazio na lista)
- **Executor sugerido:** @dev (UI/serviço) + @data-engineer (migration aditiva) · Quality gate: @architect/@qa
- **Risco:** MÉDIO (reuso de mecanismo existente; risco concentra-se na UX da lista e no gatilho pós-Word — sem tocar `system_cases`)
- **Origem:** Reunião Matheus × Adávio (`ajuste sistema hyago.txt`) — 2026-07-22

---

## Story

**Como** operador da controladoria (usuário do sistema),
**quero** **criar meus próprios filtros por TEMA** (texto, múltipla escolha, data, booleano, número/valor) e **preenchê-los por caso** — no pop-up que abre **depois de concluir o Word** e/ou direto **na lista** —,
**para que** cada tema tenha a visualização/planilha que a operação precisa, sem depender de nós definirmos antecipadamente quais filtros cada frente usa.

> **DECISÃO TRAVADA (reunião 2026-07-22):**
> 1. **Filtro é do TEMA**, não do caso e não do documento. A DEFINIÇÃO dos filtros vive no nível do tema (`frente_slug = NULL`); o VALOR é por caso.
> 2. Existem **dois tipos** de filtro: os **pré-definidos** (já puxam sozinho — nome, endereço, etc.) e os **customizados** (o usuário cria dentro do tema).
> 3. O **preenchimento é opcional** (pode ficar em branco) e **retroativo** (filtro criado depois deve poder ser preenchido em casos que já existem).
> 4. **Quando preencher:** o pop-up dos filtros customizados abre **após "Concluí a edição (Finalizar)"** do Word — mostra só os customizados (os automáticos não vão no pop-up).
> 5. **Onde editar depois:** caminho principal é a **LISTA** (edição inline + poder puxar os "em branco"); dentro do caso o usuário **só marca o valor** (já existe via `CaseCanonicalFields`). Tirar qualquer "editar filtro" do **cadastro do cliente**.

---

## Contexto / o que JÁ EXISTE vs NOVO

**JÁ EXISTE (reusar — é ~70% da feature):**
- **Defs de campo por tema** → `system_tema_field_defs` (`tema_id`, `frente_slug`, `key`, `label`, `type ∈ {text,select,money,number,date}`, `options`, `ordem`, `required`, `active`). Migration `20260719000006_tema_field_defs.sql`. Serviço `src/lib/tema-field-defs-service.ts`; RPC `src/rpc/tema-field-defs.ts`; hooks `src/hooks/useTemaFieldDefs.ts`. **É o "filtro criado no tema".**
- **Valor por caso** → `system_cases.canonical_fields` (JSONB) + índice GIN + `updateCaseCanonicalFields` (merge, remove vazios). **É o "preenche por caso do cliente".** Não precisa tocar `system_cases`.
- **Render/edição do valor na ficha do caso** → `src/components/cases/CaseCanonicalFields.tsx` (renderiza defs do tema por tipo, grava em `canonical_fields`). **É o "dentro do caso só marca o valor".**
- **Filtro dinâmico na lista** → `src/components/cases/CaseFiltersPanel.tsx` já lê `useTemaFieldDefs(temaId)` e filtra por `canonical_fields` (hoje só `text`/`select`). `applyCaseFilters` em `casos.lista.tsx`.
- **Editor de defs** → `src/components/pipeline/TemaFieldDefsEditor.tsx` **existe, mas está ÓRFÃO** (não é renderizado em lugar nenhum; o `FrentesEditor` que o hospedava foi removido junto com a camada FRENTE — ver `project_remocao_frente_2026_07_21`).
- **Gatilho pós-Word** → `src/components/cases/GenerateCaseDocumentFlow.tsx`, handler do botão "Concluí a edição (Finalizar)" → `finalize.mutateAsync(editorDocId)` → `setFinalized(true)` (~linha 247). **Ponto de encaixe do pop-up.**

**NOVO (o escopo real desta story):**
1. Tipo **`boolean`** (true/false) nas defs de tema (a reunião pediu explicitamente; hoje só existe em `system_client_field_defs`).
2. **Re-plugar o editor** de filtros numa porta de entrada acessível **no nível do TEMA** (`frente_slug = NULL`) — "Adicionar filtro".
3. **Pop-up pós-Word** (`CaseFilterFillDialog`) — abre após finalizar o documento, lista os filtros customizados do tema do caso, preenchimento **opcional**, grava em `canonical_fields`.
4. **Lista turbinada:** edição **inline** do valor por linha + filtro **"(em branco)"** por campo + suporte a `boolean`/`date`/`number`/`money` como filtro.

---

## Decisões técnicas (travadas para execução)

- **REUSAR, não recriar:** a feature = `system_tema_field_defs` (definição) + `system_cases.canonical_fields` (valor). **Não** criar tabela "filtros" nova. Isso zera risco de divergência e respeita o mecanismo já validado (R2-07/S2-07).
- **Nível do tema:** todas as defs de filtro desta feature usam `frente_slug = NULL` (a UI de frente foi removida). **Não reviver a frente.** As colunas `frente_slug` seguem dormentes.
- **"Pré-definidos vs customizados":** os pré-definidos são os campos fixos que a lista já resolve (código, cliente, tipo/`caso_pasta_nome`, responsável, município, etapas) + os automáticos do autofill. Os **customizados** = linhas de `system_tema_field_defs`. O pop-up pós-Word mostra **só os customizados**.
- **Sem vazamento para o documento:** `canonical_fields` alimenta o autofill de documento **apenas** quando o template tem um placeholder com nome equivalente (`canonicalLookup` por `normKey`). Um filtro sem placeholder correspondente **nunca** aparece no Word. Logo, reuso é seguro; não há necessidade de namespacing. Guardrail: filtros **não** entram na lista de campos obrigatórios do template (essa lista vem do template, não das defs).
- **Não tocar `system_cases`** → **não** recriar `system_cases_active`; **não** recriar trigger de bifurcação (regras de ouro 2 e 6). A migration é **aditiva**: só relaxa o CHECK de `type`.

---

## Acceptance Criteria

1. **Tipo booleano:** migration aditiva permite `type = 'boolean'` em `system_tema_field_defs` (relaxa o CHECK, idempotente, com rollback). Serviço/validators/editor/render passam a suportar `boolean` (checkbox/tri-state: sim/não/vazio). Nenhuma outra coluna tocada; `system_cases` **não** tocado.
2. **Editor plugado (criar filtro no tema):** existe uma porta de entrada acessível ao **admin** (gate `config.manage` server-side, já em `rpc/tema-field-defs.ts`) para CRUD das defs **no nível do tema** (`frente_slug = NULL`), a partir da pipeline/lista do tema. O usuário escolhe **nome + tipo** (texto/múltipla escolha/data/booleano/número/valor-R$) e, para múltipla escolha, define as **opções**. `TemaFieldDefsEditor` deixa de estar órfão.
3. **Pop-up pós-Word:** ao clicar "Concluí a edição (Finalizar)" em `GenerateCaseDocumentFlow` e finalizar com sucesso, abre um pop-up com **os filtros customizados do tema do caso** (defs `frente_slug NULL`), pré-carregando valores já existentes de `canonical_fields`. Preenchimento **opcional** (salvar com campos em branco é válido). Salvar grava via `updateCaseCanonicalFields` (mecanismo inalterado). Fechar sem salvar não perde o documento já finalizado.
4. **Edição na lista (caminho principal):** na visão de lista (`casos.lista.tsx`), cada filtro customizado do tema vira **coluna editável inline** (texto/select/boolean/date/number/money) — editar grava em `canonical_fields` do caso da linha. Sem navegar para a ficha.
5. **Filtro "(em branco)":** o painel de filtros (`CaseFiltersPanel`) oferece, por campo customizado, a opção **"(em branco)"** para listar casos com o valor **não preenchido** — e suporta `boolean`/`date`/`number`/`money` além de `text`/`select`.
6. **Retroativo:** criar uma def nova no tema faz a coluna/filtro aparecer para **todos os casos** daquele tema (inclusive antigos), com valor vazio até ser preenchido (na lista ou no pop-up).
7. **Cadastro do cliente limpo:** nenhum "editar filtro" do tema aparece no **cadastro do cliente** (o vínculo de valor é por caso). Verificar `ClientFormDialog`/cadastro e garantir ausência.
8. **Sem regressão:** valores livres já gravados em `canonical_fields` continuam visíveis (nunca apagar chave sem def); autofill de documento inalterado; `npm run typecheck` / `npm run lint` / `npm run test:rbac` verdes.

---

## Tasks / Subtasks

- [x] **Migration aditiva** `20260722000001_tema_field_defs_boolean.sql` (AC: 1) — `DO $$` descobre e recria o CHECK de `type` incluindo `'boolean'` (idempotente); **rollback** simétrico. **Não** toca `system_cases`/view/trigger. **Aplicada** via `npx tsx scripts/db-apply-pg.ts` (pg direto).
- [x] **Serviço/validators** (AC: 1) — `TEMA_FIELD_TYPES` (`tema-field-defs-service.ts`) + zod (`z.enum(TEMA_FIELD_TYPES)`) aceitam `boolean`. `type` em types.ts já é `string` (sem mudança).
- [x] **Editor plugado** (AC: 2) — `TemaFieldDefsEditor` (com `frente_slug = NULL`) renderizado no editor de tema do `TemasManagerDialog` ("Filtros do tema"); tipo "Sim / Não" no editor. Deixou de ser órfão.
- [x] **Render do valor** (AC: 1,3,4) — `CaseCanonicalFields.TemaFieldInput` (exportado) + `InlineCanonicalCell` renderizam `boolean` tri-state (Sim/Não/não-definido), tolerante a `true`/`"true"`.
- [x] **Pop-up pós-Word** (AC: 3) — novo `CaseFilterFillDialog.tsx`; estado `showFilters` em `GenerateCaseDocumentFlow`; abre após finalizar (botão "Concluí a edição" **e** `enviarAoZapsign`); carrega defs via `useTemaFieldDefs`; salva com `useUpdateCaseCanonicalFields`; opcional; fecha sozinho se o tema não tem filtros; pré-carrega do `canonical_fields` bruto (correção QA BUG-1).
- [x] **Lista: colunas editáveis + filtro vazio** (AC: 4,5,6) — `casos.lista.tsx` renderiza colunas dinâmicas das defs do tema com `InlineCanonicalCell` (grava `canonical_fields`, `stopPropagation`, gate `usePodeEditar("operacional")`); `CaseFiltersPanel` com opção "(em branco)" (`CANONICAL_EMPTY`) + opções de todos os tipos; `applyCaseFilters(rows, filters, defs)` trata "(em branco)" e matching por tipo (dropdown=igualdade, texto=contém). `pipeline.tsx` também passa os defs.
- [x] **Cadastro do cliente** (AC: 7) — auditado `ClientFormDialog`; filtros de tema **não** aparecem lá.
- [x] **Types** (AC: 1) — `type` em `system_tema_field_defs` já é `string` genérico; nenhuma mudança necessária.
- [x] **Testes** (AC: 8) — `npm run typecheck` (só erro pré-existente em `contaazul/service.ts`) / `eslint` (0 erros; warnings pré-existentes) / `npm run test:rbac` verdes. QA adversarial: APROVADO-COM-RESSALVAS → BUG-1 corrigido.

---

## Dev Notes

**Arquivos a tocar (mapa de impacto):**
- NOVA `sistema-hv/supabase/migrations/20260722000001_tema_field_defs_boolean.sql` + rollback.
- `sistema-hv/src/lib/tema-field-defs-service.ts` (tipo boolean).
- `sistema-hv/src/lib/validators/*` (se houver validator dedicado de tema-field-defs) / zod inline.
- `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` (re-plugar + boolean).
- `sistema-hv/src/components/pipeline/TemasManagerDialog.tsx` **ou** cabeçalho da lista/pipeline (porta de entrada "Filtros do tema").
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` (boolean tri-state).
- NOVO `sistema-hv/src/components/cases/CaseFilterFillDialog.tsx` (pop-up pós-Word).
- `sistema-hv/src/components/cases/GenerateCaseDocumentFlow.tsx` (estado + gatilho após `setFinalized(true)`, ~linha 247).
- `sistema-hv/src/routes/casos.lista.tsx` (colunas dinâmicas editáveis + "(em branco)").
- `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` (tipos + opção "(em branco)" + `applyCaseFilters`).
- `sistema-hv/src/lib/supabase/types.ts` (`type: 'boolean'`).
- Auditar `sistema-hv/src/components/clients/ClientFormDialog.tsx` (AC-7).

**Regras de ouro (pertinentes):**
- **Não** tocar `system_cases` → **não** recriar `system_cases_active` nem o trigger de bifurcação.
- Valor SEMPRE em `system_cases.canonical_fields` via `updateCaseCanonicalFields`; **nunca** em `system_clients.custom_fields`.
- Defs restritas a `config.manage` (gate server-side já existente).
- `frente_slug = NULL` (nível tema) — **não** reviver a camada frente.
- Migrations via `npx tsx scripts/db-apply-pg.ts <arquivo.sql>`.

**Riscos de regressão e mitigação:**
- **Perder valores livres:** ao renderizar colunas por def, nunca esconder/apagar chaves de `canonical_fields` sem def (bloco "Outros campos" já faz isso em `CaseCanonicalFields`). Replicar a política na lista.
- **Vazamento p/ documento:** nenhum — autofill só preenche placeholders existentes no template (`canonicalLookup`/`normKey`). Não adicionar filtros à lista de campos obrigatórios do template.
- **Pop-up após finalizar bloquear o fluxo:** o pop-up é **não-bloqueante** (fechar mantém o documento finalizado). Não disparar o pop-up se o tema não tiver defs customizadas.
- **Performance da lista:** colunas dinâmicas + edição inline sobre lista paginada (50/pág) — manter mutations otimistas por linha, sem refetch global a cada edição.
- **CHECK constraint:** relaxar via `DO $$` idempotente; validar que não há linhas com `type` inválido antes.

### Testing
- Admin cria filtros de cada tipo no tema (texto/select/data/boolean/número/money), `frente_slug NULL` → aparecem para todos os casos do tema.
- Gerar documento → finalizar → pop-up mostra só os customizados; salvar vazio é válido; valores persistem em `canonical_fields`.
- Editar valor inline na lista grava no caso certo; filtro "(em branco)" lista os não preenchidos.
- Criar filtro novo depois → aparece retroativo nos casos antigos (valor vazio).
- Cadastro do cliente sem filtros de tema.
- Valor livre pré-existente continua visível; autofill de doc inalterado.
- `npm run typecheck` / `npm run lint` / `npm run test:rbac` verdes.

---

## Dependências

- **Depende de:** R2-01 (tema), R2-07 (`system_tema_field_defs` + `CaseCanonicalFields`), S2-07 (`canonical_fields`), R2-08 (visualização lista) — todos já entregues.
- **Relação com R2-07:** esta story **estende** R2-07 (adiciona `boolean`, re-pluga o editor órfão, adiciona o fluxo de preenchimento pós-Word e a edição na lista). Marcar em R2-07 que o editor foi re-plugado aqui.
- **Fora de escopo (futuro):** o "motor que raspa clientes do tema e mapeia filtros em lote" (botão "atualizar lista com os filtros") — a reunião marcou como risco (pode puxar errado sem lógica). Fica para story futura; o preenchimento manual (pop-up + lista) é o núcleo.

---

## File List

- `sistema-hv/supabase/migrations/20260722000001_tema_field_defs_boolean.sql` (novo — CHECK aceita `boolean`)
- `sistema-hv/supabase/rollbacks/20260722000001_tema_field_defs_boolean.rollback.sql` (novo)
- `sistema-hv/src/lib/tema-field-defs-service.ts` (`TEMA_FIELD_TYPES` + `boolean`)
- `sistema-hv/src/hooks/useTemaFieldDefs.ts` (`TemaFieldType` + `boolean`)
- `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` (tipo "Sim / Não")
- `sistema-hv/src/components/pipeline/TemasManagerDialog.tsx` (plugue "Filtros do tema", frente NULL)
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` (`TemaFieldInput` exportado + boolean tri-state)
- `sistema-hv/src/components/cases/CaseFilterFillDialog.tsx` (novo — pop-up pós-Word)
- `sistema-hv/src/components/cases/GenerateCaseDocumentFlow.tsx` (props `temaId`/`canonicalFields` + gatilho + render do pop-up)
- `sistema-hv/src/components/cases/CaseFormDialog.tsx` (`tema_id` no `CreatedCaseLite` + `onCreated`)
- `sistema-hv/src/components/cases/ClientCasesSection.tsx` (passa `temaId`)
- `sistema-hv/src/routes/casos.$id.tsx` (passa `temaId` + `canonicalFields`)
- `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` (opções por tipo + "(em branco)" + `applyCaseFilters` por tipo)
- `sistema-hv/src/components/cases/InlineCanonicalCell.tsx` (novo — célula editável inline)
- `sistema-hv/src/routes/casos.lista.tsx` (colunas dinâmicas editáveis + defs no `applyCaseFilters`)
- `sistema-hv/src/routes/pipeline.tsx` (defs no `applyCaseFilters`)

## Dev Agent Record

**Agente:** @dev (via Orion) · Modelo: Opus 4.8 (1M)

**Decisões de implementação:**
- **Reuso total** de `system_tema_field_defs` (definição) + `system_cases.canonical_fields` (valor) — nenhuma tabela nova; `system_cases`/view/trigger intocados. Migration só relaxa o CHECK de `type` para incluir `'boolean'`.
- **Editor re-plugado** no nível do tema (`frente_slug = NULL`) dentro do `TemasManagerDialog` — a UI de frente foi removida antes (`project_remocao_frente_2026_07_21`), deixando o editor órfão.
- **Boolean** grava boolean real em `canonical_fields` (o RPC aceita `string|number|boolean|null`); render tri-state tolerante a `true`/`"true"` (o autofill serializa como string).
- **Pop-up pós-Word** abre após finalizar nos 2 caminhos; fecha sozinho se o tema não tem filtros; pré-carrega do `canonical_fields` bruto (não do `autoFill.canonical`, que é rotulado em PT).
- **Lista:** colunas dinâmicas só com um tema selecionado; edição inline com `stopPropagation` (linha navega) e gate `usePodeEditar("operacional")`.
- **`applyCaseFilters(rows, filters, defs?)`:** matching por tipo (dropdown = igualdade, texto = contém), sentinela `CANONICAL_EMPTY` para "(em branco)"; sem `defs` mantém o comportamento antigo (compat). Ambos os callers (`casos.lista`, `pipeline`) passam os defs.

**Validação:** `npm run typecheck` sem erro novo (só `contaazul/service.ts` pré-existente); `eslint` 0 erros nos arquivos tocados (warnings react-refresh/exhaustive-deps pré-existentes); `npm run test:rbac` verde; migration **aplicada** via pg direto (banco dev=prod).

## QA Results

**QA:** @qa (Quinn, subagente) · Revisão adversarial dos 8 ACs + caça a regressões.

**Veredito:** APROVADO-COM-RESSALVAS → **ressalva corrigida**.
- AC-1..AC-8: PASS (evidência arquivo:linha no relatório de QA).
- **BUG-1 (MINOR) — CORRIGIDO:** o pop-up pós-Word recebia `autoFill.canonical` (rótulos em PT) em vez do `canonical_fields` bruto (slug), não pré-carregando valores já salvos. Corrigido: nova prop `canonicalFields` em `GenerateCaseDocumentFlow`, passada da ficha (`caso.canonical_fields`); caso recém-criado nasce vazio (aceitável).
- Verificações adversariais sem bug: isolamento canonical↔Word (autofill só preenche placeholders do template), matching "Inativo"⊄"Ativo" (igualdade p/ dropdown), boolean `false` sobrevive ao remove-vazios, "(em branco)" com boolean, compat sem defs, colCount/colSpan, colunas só com tema, `temaId` nos 2 callers, migration idempotente.
- Ressalvas NIT aceitas: rollback estreita o CHECK (documentado); money como filtro deriva opções de centavos (sem busca "contém").

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-22 | 0.1 | Draft inicial — filtros construídos por tema + pop-up pós-Word + edição na lista (reunião `ajuste sistema hyago.txt`). Reusa `system_tema_field_defs`/`canonical_fields`; análise de impacto prévia (editor órfão, gatilho pós-Word, não tocar `system_cases`). | @sm (via Orion) |
| 2026-07-22 | 1.0 | Implementação completa (@dev): migration boolean aplicada; editor re-plugado; pop-up pós-Word; edição inline + "(em branco)" na lista; matching por tipo. QA adversarial APROVADO-COM-RESSALVAS; BUG-1 corrigido. typecheck/eslint/test:rbac verdes. Status → Ready for Review. | @dev + @qa (via Orion) |
