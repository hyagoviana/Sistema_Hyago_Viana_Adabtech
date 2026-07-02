# Story S2-06: Auto-check por upload no Drive (modo SUGESTÃO)

- **Sprint:** 2 — Onboard: subetapas/checklist por etapa
- **ID:** S2-06
- **Status:** Partial (estrutura pronta) · **⚠ AGUARDANDO INPUT DO OWNER (convenção de nomes) — matcher DESLIGADO por default**
- **Estimativa relativa:** M (estrutura de sugestão + dedupe; regra de matching fica parametrizável/stub aguardando o owner)
- **Executor sugerido:** @dev · Quality gate: @architect + @qa

---

## Story

**Como** operador que sobe documentos ao caso,
**quero** que um upload cujo nome case com um item de checklist gere uma **sugestão** de marcação (não marque sozinho),
**para que** o checklist ajude sem nunca fechar um gate por conta própria — a confirmação é sempre humana.

---

## ⚠ Bloqueio de escopo (decisão do owner v2.2)

> **A convenção de nomes dos arquivos AINDA SERÁ ENVIADA pelo owner.** Portanto a **regra de matching nome→item** fica **PARAMETRIZÁVEL / aguardando** — **sem regras fixas hardcoded**. A **estrutura pode ser construída** (sugestão, dedupe, confirmação humana, coluna `expected_doc_pattern` já criada em S2-01), mas **enquanto a convenção não chega o auto-check pode ficar DESLIGADO / em stub**.
>
> **Esta story NÃO bloqueia a Sprint 2:** o **checklist manual (S2-03/S2-04/S2-05) funciona sem o auto-check**; todos os itens podem ser marcados manualmente e o gate de S2-04 fecha só com itens `done=true` marcados à mão. **Executar S2-06 por último** na sprint (ou parcialmente: estrutura + stub agora, matching quando a convenção chegar).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (upload pelo app + magic bytes):** validação combinada mime declarado + magic bytes em `sistema-hv/src/lib/validators/file.ts` (anti-spoofing; testes em `file.test.ts`). O fluxo de upload por caso vive em `sistema-hv/src/routes/api.clients.$id.documents.index.tsx` (handler multipart) → `case-documents-service.ts`, que grava `drive_file_id` no Drive/Supabase (ex.: `:295`).
- **JÁ EXISTE:** `system_case_checklist_items` com colunas `source ('manual'|'drive_suggest')` e `drive_file_id` (dedupe), + `system_stage_checklist_defs.expected_doc_pattern` (S2-01).
- **NÃO EXISTE (esclarecimento R-ARCH-6):** **não há polling do n8n** sobre o Drive hoje. A sugestão nasce **NO MOMENTO DO UPLOAD PELO APP** (o fluxo de upload já grava `drive_file_id`). Varredura de arquivos criados **fora do app** vai para o **BACKLOG B-08**, não é esta story.
- **NOVO:** ao concluir um upload pelo app, comparar o nome do arquivo contra os `expected_doc_pattern` dos itens da etapa atual do caso e, se casar, criar uma **sugestão** (`source='drive_suggest'`, `done=false`), com dedupe por `drive_file_id`.

> **R-ARCH-6 — mecanismo de detecção:** sugestão **no momento do upload pelo app**, **NÃO** por polling. Polling externo → BACKLOG **B-08**.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S2-06)

1. Upload **pelo app** que casa um padrão de nome de item → cria **sugestão** (`source='drive_suggest'`, `done=false`), **não marca `done` sozinho**.
2. Usuário **confirma** → `done=true`, `done_by` = usuário.
3. **Dedupe:** mesmo `drive_file_id` **não gera 2 sugestões**.
4. **(Q-7)** Sugestão `source='drive_suggest', done=false` **NÃO satisfaz** o gate de S2-04 — **só itens `done=true` (confirmados)** contam como `required` cumprido. Uma sugestão pendente **não avança** o card.
5. **Edge (QA):** nome **fora do padrão** → **fallback manual + alerta**, nunca trava silenciosamente nem marca item errado.
6. **(v2.2)** A regra de matching nome→item é **parametrizável** (não hardcoded) e **fica aguardando a convenção do owner**; com o auto-check **desligado/em stub**, o **checklist manual funciona normalmente** e o gate de S2-04 conclui só com itens marcados manualmente (a Sprint 2 **não fica bloqueada**).

---

## Tasks / Subtasks

- [x] **Estrutura de sugestão (feita)** (AC: 1,3)
  - [x] Gancho `sugerirChecklistPorUpload(caseId, fileName, driveFileId)` chamado no servidor em `finalizeCaseDocument` (ponto onde o arquivo ganha `drive_file_id`), com `.catch(() => {})`.
  - [x] `sugerirChecklistPorUpload`: para cada item da etapa atual com `expected_doc_pattern`, avalia o **matcher parametrizável**; se casar e não `done`, marca o item `source='drive_suggest'`, `done=false`, `drive_file_id=<id>`.
  - [x] **Dedupe:** se já existe item com o mesmo `drive_file_id`, não cria 2ª sugestão.
- [x] **Matcher parametrizável (stub aguardando owner)** (AC: 6)
  - [x] Módulo isolado `src/lib/checklist/doc-matcher.ts` com `matchDocPattern(fileName, expectedDocPattern): boolean` (glob simples/substring — SEM regra de negócio fixa).
  - [x] Flag `AUTO_CHECK_DRIVE_ENABLED` (env) default **desligado**; enquanto desligado, `sugerirChecklistPorUpload` é no-op.
  - [x] TODO explícito no módulo: "convenção de nomes virá do owner". `expected_doc_pattern` já existe (S2-01) — nova regra sem migration.
- [x] **Confirmação humana** (AC: 2,4) — sugestão destacada na ficha (`CaseChecklistPanel`), botão "Confirmar" → `marcarItemChecklist(itemId, done=true)` → dispara o gate. Enquanto `done=false`, o gate de S2-04 ignora (só `done=true` conta).
- [x] **Fallback** (AC: 5) — nome fora do padrão: nenhum item marcado (no-op). Nunca marca item errado.
- [x] **Testes** (AC: 1-6, exceto matching real) — matcher desligado = no-op (checklist manual e gate funcionam); dedupe por `drive_file_id`; sugestão nunca marca `done` sozinha. `npx tsc --noEmit` / `npm run lint` verdes.

> **PENDENTE DE INPUT DO OWNER:** a **convenção de nomes real** dos arquivos → definir `expected_doc_pattern` por item (no editor de funil) e a regra dentro de `matchDocPattern`, então ligar `AUTO_CHECK_DRIVE_ENABLED=true`. Também fica pendente escolher o **ponto de upload de arquivo arbitrário por caso** (hoje o gancho está no finalize de documento gerado; quando existir upload livre de arquivo assinado, plugar o mesmo gancho lá).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/api.clients.$id.documents.index.tsx` e/ou `case-documents-service.ts` (gancho pós-upload).
- NOVO módulo de matcher parametrizável (ex.: `sistema-hv/src/lib/checklist/doc-matcher.ts`) — **sem regra fixa**.
- `sistema-hv/src/lib/checklist-service.ts` — `sugerirChecklistPorUpload`.
- RPC/hook + UI da ficha (destaque de sugestão + botão Confirmar).

**Regras de ouro / decisões travadas:**
- Sugestão **no momento do upload pelo app** (R-ARCH-6) — **não** polling n8n (isso é B-08).
- **Só itens `done=true` contam** no gate (S2-04 CA-4 / Q-7). Sugestão pendente nunca fecha.
- Dedupe por `drive_file_id`.
- Matching **parametrizável / aguardando o owner** — **auto-check desligado/stub** por default; **não bloqueia** a Sprint 2.
- Reusar a validação de **magic bytes** existente (`validators/file.ts`) — não duplicar validação de upload.

**Riscos de regressão:**
- Não alterar o pipeline de upload/magic bytes existente (só adicionar o gancho de sugestão após o upload).
- Sugestão nunca pode marcar `done=true` automaticamente (violaria a confirmação humana e poderia fechar gate indevidamente).

### Testing
- Upload com nome casando (matcher habilitado em teste) → sugestão `done=false`; confirmar → `done=true`.
- Mesmo `drive_file_id` 2x → 1 sugestão só.
- Sugestão `done=false` na etapa atual → gate S2-04 **não** avança.
- Matcher **desligado** → nenhum efeito; checklist manual e gate funcionam normalmente.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 13** (grupo D) — Sugestão não fecha gate: sugestão não confirmada (`done=false`) **não fecha o gate**. (S2-06 CA-4)

---

## Dependências

- **Depende de:** S2-01 (colunas `source`/`drive_file_id`/`expected_doc_pattern`), S2-04 (gate que ignora `done=false`) e do upload+magic bytes (JÁ EXISTE).
- **⚠ Bloqueada parcialmente por:** **input do owner** (convenção de nomes dos arquivos). Estrutura+stub podem ser construídos agora; o matcher só fica "ligado" com a convenção. **Não bloqueia** o resto da Sprint 2.
- **Relacionada ao BACKLOG:** B-08 (polling externo do Drive — fora desta story).

---

## File List

- `sistema-hv/src/lib/checklist/doc-matcher.ts` (novo — matcher parametrizável + flag)
- `sistema-hv/src/lib/checklist-service.ts` (`sugerirChecklistPorUpload`)
- `sistema-hv/src/lib/case-documents-service.ts` (gancho pós-finalize)
- `sistema-hv/src/rpc/checklist.ts` (`sugerirChecklistPorUploadFn`)
- `sistema-hv/src/components/cases/CaseChecklistPanel.tsx` (destaque de sugestão + botão Confirmar)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 2). Marcada dependente de input do owner (convenção de nomes). | @sm |
