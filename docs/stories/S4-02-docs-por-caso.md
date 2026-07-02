# Story S4-02: Docs por caso (documentos vivem DENTRO do caso)

- **Sprint:** 4 — Virada automática em SANDBOX + docs/notas/timeline
- **ID:** S4-02
- **Status:** Ready for Review
- **Estimativa relativa:** P/M (reorganização de UI + garantir gravação por `case_id`; sem mudança de schema)
- **Executor sugerido:** @dev (UI + serviço) · Quality gate: @architect

---

## Story

**Como** operador do escritório,
**quero** que **todo documento viva DENTRO do caso** ao qual pertence (procuração, docs gerados, enviados ou recebidos por ZapSign), sem uma aba geral que agregue/misture documentos de vários casos do mesmo cliente,
**para que** um cliente com vários casos não misture documentos e cada caso mostre apenas o que é dele.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (schema — não reconstruir):** `system_case_documents (case_id, doc_kind, zapsign_doc_token, status, drive_file_id)` (`20260608000001_case_documents.sql` + `20260622000006`). O schema **já é por `case_id`** — esta story é **REMOÇÃO/reorganização de UI**, não mudança de schema.
- **JÁ EXISTE (UI por caso):** `CaseDocumentsTab` renderizado na ficha do caso (`sistema-hv/src/routes/casos.$id.tsx:496`), com upload/download e validação de magic bytes.
- **JÁ EXISTE (aba geral a REMOVER):** na ficha do cliente (`sistema-hv/src/routes/clientes.$id.tsx`) existem HOJE **duas** seções de documento acima dos casos:
  - `Documentos do cliente` → `ClientDocumentsSection` (`:213-219`) — pasta **geral** do cliente no Drive, **não** por caso.
  - `Documentos dos casos` → `ClientCaseDocumentsSection` (`:221-227`) — **agrega** os docs de todos os casos do cliente numa lista só ("Procurações e demais documentos gerados nos casos deste cliente").
  A decisão do owner é que documentos **não** fiquem numa aba geral que agrega tudo — devem viver **dentro do caso**.
- **NOVO:** garantir que **todo** doc gerado/enviado/**recebido por ZapSign** (procuração assinada — S4-01/S1-09 já grava na pasta do caso) apareça na aba do **caso correto**, e reorganizar a ficha do cliente para **não** exibir a lista agregada de documentos de casos como aba geral do cliente.

> **DECISÃO TRAVADA (owner):** documentos do caso **DENTRO do caso** (não numa aba geral "documentos do cliente" que agrega tudo). Cliente com vários casos **não** deve misturar documentos. Como o schema já é por `case_id`, o trabalho é de **UI/organização**.

> **A DECIDIR COM O OWNER:** o que fazer com a seção `Documentos do cliente` (`ClientDocumentsSection` — pasta geral do cliente, ex.: RG/CPF/comprovantes que não pertencem a um caso específico). Duas leituras possíveis: (a) manter como "documentos pessoais do cliente" (não são de caso e não misturam casos entre si) e remover **apenas** a lista agregada `Documentos dos casos`; ou (b) remover ambas e concentrar 100% dentro do caso. **Recomendação do @sm:** remover a lista agregada `Documentos dos casos` da ficha do cliente (é ela que "mistura" casos) e **manter** `Documentos do cliente` como docs pessoais não-vinculados a caso — **confirmar com o owner** antes de apagar `ClientCaseDocumentsSection`/`ClientDocumentsSection`.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S4-02)

1. Doc **gerado / enviado / recebido** (inclusive procuração assinada via ZapSign) aparece na **aba do caso correto** (`CaseDocumentsTab` da ficha daquele `case_id`), nunca agregado a outro caso do mesmo cliente.
2. **Regressão:** upload/download preserva a **validação de magic bytes** (mesmo pipeline atual) na estrutura **por-caso**.
3. A ficha do cliente **não** exibe mais uma lista que **agrega documentos de vários casos** como se fossem "documentos do cliente" (remoção da aba geral que mistura casos — conforme decisão do owner e alinhamento do item "A DECIDIR").
4. Cliente com **2+ casos**: abrir o caso A mostra só docs de A; abrir o caso B mostra só docs de B (isolamento por `case_id`).

---

## Tasks / Subtasks

- [x] **Confirmar decisão com o owner** (aba geral) — decisão do briefing: remover **apenas** `Documentos dos casos` (agregado) e **manter** `Documentos do cliente` (pasta pessoal).
- [x] **Ficha do cliente** (AC: 3) — removida a seção agregada `Documentos dos casos` (`ClientCaseDocumentsSection`) de `clientes.$id.tsx` (import + JSX + subtítulo); `ClientDocumentsSection` mantida. `OrnamentalDivider` preservado.
- [x] **Ficha do caso** (AC: 1,4) — `CaseDocumentsTab` (`casos.$id.tsx`) já lista todos os docs por `case_id` (sem mudança necessária).
- [x] **Docs recebidos por ZapSign** (AC: 1) — inalterado; o doc assinado continua gravado por `case_id` e aparece no `CaseDocumentsTab` (nenhuma regressão introduzida).
- [x] **Regressão magic bytes** (AC: 2) — pipeline de upload/download **não** foi tocado; validação de magic bytes intacta.
- [x] **Testes** (AC: 1-4) — `tsc --noEmit` sem novos erros; lint verde nos arquivos alterados.

---

## Dev Notes

**Arquivos/UI a tocar:**
- `sistema-hv/src/routes/clientes.$id.tsx` (`:213-227`) — remover a seção agregada de docs de casos (e decidir a de docs do cliente).
- `sistema-hv/src/components/clients/ClientCaseDocumentsSection.tsx` — candidato a remoção/aposentadoria (após decisão do owner).
- `sistema-hv/src/components/clients/ClientDocumentsSection.tsx` — manter ou remover conforme decisão.
- `sistema-hv/src/routes/casos.$id.tsx` (`:496`) + `sistema-hv/src/components/cases/CaseDocumentsTab.tsx` — confirmar que lista tudo por `case_id`.

**Regras de ouro repetidas (pertinentes):**
- **Nenhuma migration nesta story** — o schema já é por `case_id` (`system_case_documents`). Trabalho é de UI/serviço. Portanto **NÃO recriar `system_cases_active`** (regra de ouro 2 só vale p/ migrations que alteram colunas de `system_cases`), **NÃO recriar `trg_system_cases_bifurcacao`**.
- Erros de dependência externa (Drive/ZapSign) → **424**, nunca 5xx.
- Manter a validação de **magic bytes** intacta (anti-spoofing do upload).

**Riscos de regressão:**
- Remover `ClientCaseDocumentsSection` não pode quebrar a rota `clientes.$id.tsx` (imports/JSX órfãos).
- Não perder acesso a docs já gerados: eles continuam acessíveis **pela ficha do caso**.

### Testing
- Abrir caso com procuração assinada → doc `ASSINADO` aparece no `CaseDocumentsTab` daquele caso.
- Cliente com 2 casos → docs não se misturam entre as fichas dos casos.
- Upload de arquivo inválido → rejeitado por magic bytes; válido → registrado.
- Ficha do cliente não mostra mais a lista agregada de documentos de casos.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 17** (grupo E) — **magic bytes** preservado no upload/download na estrutura **por-caso**. (S4-02 CA-2)

---

## Dependências

- **Depende de:** S1-09/S4-01 (webhook grava o doc assinado na pasta do caso — para o AC-1 do "recebido por ZapSign"). Roda em paralelo com S4-03/S4-04.
- **Aguarda input do owner:** decisão sobre remover **apenas** a lista agregada de docs de casos vs. também a pasta geral do cliente (ver "A DECIDIR").
- **Habilita:** —

---

## File List

- `sistema-hv/src/routes/clientes.$id.tsx` (remoção da seção agregada de docs de casos)
- `sistema-hv/src/components/clients/ClientCaseDocumentsSection.tsx` (remoção/aposentadoria — pós-decisão)
- `sistema-hv/src/components/clients/ClientDocumentsSection.tsx` (manter/remover — pós-decisão)
- `sistema-hv/src/routes/casos.$id.tsx` (confirmação; sem mudança esperada)
- `sistema-hv/src/components/cases/CaseDocumentsTab.tsx` (confirmação)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 4, S4-02) | @sm |
| 2026-07-02 | 1.0 | Removida a seção agregada `ClientCaseDocumentsSection` da ficha do cliente; `ClientDocumentsSection` mantida. Componente órfão preservado (não deletado). Ready for Review. | @dev |

## Dev Agent Record

- Removido apenas o import + JSX de `ClientCaseDocumentsSection` em `clientes.$id.tsx` (mais o subtítulo "Documentos dos casos"). O arquivo do componente `ClientCaseDocumentsSection.tsx` foi **mantido no repo** (aposentado, sem referências) — remoção física fica a critério do @qa/limpeza.
- Nenhuma migration. Pipeline de upload/magic bytes intocado.
