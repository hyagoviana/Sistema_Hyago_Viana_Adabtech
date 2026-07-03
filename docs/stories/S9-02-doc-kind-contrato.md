# Story S9-02: `doc_kind='contrato'` — geração + `sendCaseDocumentToZapsign` + seleção de template de contrato (degrada 424)

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-02
- **Status:** Ready for Review
- **Estimativa relativa:** M (estende a geração/envio de doc para um 2º `doc_kind`; sem migration — `doc_kind` é TEXT livre; degrada gracioso 424 quando não há template de contrato)
- **Executor sugerido:** @dev (serviço) · Quality gate: @architect

---

## Story

**Como** operador do escritório,
**quero** poder gerar e enviar ao ZapSign um **CONTRATO do caso** como um documento distinto da procuração (`doc_kind='contrato'`),
**para que** o fluxo operacional (contrato assinado → vira CLIENTE) use um documento próprio, reusando toda a máquina de geração/finalização/envio já existente e **degradando gracioso (424)** enquanto o owner não fornecer o modelo puro de contrato.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (`doc_kind` livre):** `system_case_documents.doc_kind` é **TEXT sem CHECK** (`20260622000003_caso_comercial.sql:27`; só um índice parcial). Hoje só usa `'procuracao'` (ou NULL). **Adicionar `'contrato'` NÃO exige migration.**
- **JÁ EXISTE (geração):** `case-documents-service.ts:generateCaseDocumentFromTemplate` (`:154`) já aceita `docKind?: string` (`:159`) e grava `doc_kind` (`:223`). `cases-service.ts:generateProcuracaoFromTemplate` (`:285`) é o molde de "gerar doc a partir de template p/ um caso".
- **JÁ EXISTE (envio):** `case-documents-service.ts:sendCaseDocumentToZapsign` (`:400`) — exporta PDF, cria doc no ZapSign, marca `ENVIADO_ZAPSIGN`. **Ramo específico de procuração** (`:459`): quando `doc_kind==='procuracao'` carimba `aguardando_assinatura_at`. **Esse ramo NÃO deve rodar para contrato** (o contrato tem seu próprio efeito operacional — ver S9-04/S9-05).
- **JÁ EXISTE (degradação 424):** o serviço usa `EXTERNAL_DEP_FAILED = 424` (`:36`) e `"Modelo não encontrado", 404` (`:178`) — padrão de degradação gracioso (igual ao termo da S6-04). Vercel mascara 5xx (memória `reference_vercel_5xx_gateway`).
- **NOVO:** (a) `generateContratoFromTemplate(caseId, templateId, clientId, triggeredBy?)` em `cases-service.ts` — espelho de `generateProcuracaoFromTemplate` com `docKind='contrato'` e idempotência por `doc_kind='contrato'`; (b) seleção de **template de contrato** (por ora reusa o mecanismo de escolha de template já usado pela procuração — o mesmo `system_document_templates`); (c) garantir que `sendCaseDocumentToZapsign` **NÃO** aplique o efeito de procuração quando `doc_kind='contrato'` (o efeito operacional do contrato é tratado no webhook/gatilho — S9-04/S9-05); (d) **degradação 424** quando não houver template de contrato selecionado/existente (mensagem clara, sem 5xx).

> **DECISÃO (travada):** procuração (comercial) e contrato-do-caso (operacional) são **2 documentos distintos**. Os modelos **puros** (procuração pura + contrato puro) virão do owner **depois**; hoje os templates são combinados "Contrato e procuração". Enquanto não houver template puro de contrato, `generateContratoFromTemplate`/o botão "Enviar caso" **degrada 424** com mensagem "Modelo de contrato ainda não cadastrado" — igual ao comportamento do termo (S6-04). O código já suporta os 2 `doc_kind` e não quebra.

---

## Acceptance Criteria

1. `generateContratoFromTemplate(caseId, templateId, clientId, triggeredBy?)` gera um doc do caso com `doc_kind='contrato'`, autofill dos dados do cliente/caso (reusa `buildAutoFillFromClient`/`buildAutoFillValues`), e é **idempotente** por caso (`doc_kind='contrato'` já existente → retorna o existente, não duplica). Espelha `generateProcuracaoFromTemplate`.
2. `sendCaseDocumentToZapsign` funciona para `doc_kind='contrato'` (exporta PDF, cria no ZapSign, marca `ENVIADO_ZAPSIGN`, grava evento `doc_sent_zapsign`), **sem** disparar o ramo de procuração (`aguardando_assinatura_at`). O ramo `doc.doc_kind === 'procuracao'` permanece exclusivo da procuração.
3. **Seleção de template de contrato:** o serviço aceita um `templateId` de contrato. Quando `templateId` está ausente **ou** o template não existe/foi apagado, a geração **degrada com 424** (não 5xx) e mensagem clara ("Modelo de contrato ainda não cadastrado"). Nenhum caso é criado/alterado indevidamente por essa falha.
4. **Sem migration** — `doc_kind='contrato'` entra por ser TEXT livre; nenhum CHECK novo; `system_cases` não é tocada (view não recriada nesta story).
5. RPC (se criada) de gerar/enviar contrato passa por `requireAuth` (login-only, sem `requireRole`), alinhada a S1-03/S5-02. Chamada não autenticada → 401.
6. `npm run typecheck` / `npm run lint` verdes (só os 3 erros pré-existentes de `service_type_id`).

---

## Tasks / Subtasks

- [x] **`generateContratoFromTemplate`** (AC: 1, 3) — em `cases-service.ts`, espelhando `generateProcuracaoFromTemplate`: idempotência por `doc_kind='contrato'`; autofill; `generateCaseDocumentFromTemplate({ docKind: 'contrato' })`. Se o `templateId` ausente OU template não existir → lança `CaseServiceError(..., 424)` com mensagem "Modelo de contrato ainda não cadastrado" (degrada gracioso).
- [x] **Guardar o efeito de procuração** (AC: 2) — o ramo `if (doc.doc_kind === "procuracao" ...)` em `sendCaseDocumentToZapsign` (`case-documents-service.ts:459`) já é exclusivo de procuração (verificado); contrato NÃO carimba `aguardando_assinatura_at`. Comentário atualizado documentando que o contrato tem efeito próprio (S9-04/S9-05).
- [x] **Seleção de template** (AC: 3) — o serviço aceita `templateId` (nullable, mesmo `system_document_templates`); a escolha na UI é da S9-09. Degrada 424 se ausente/inexistente.
- [x] **RPC** (AC: 5) — `generateContratoFn` (`createServerFn` POST + zod + `requireAuth` via `handle`) em `src/rpc/cases.ts`. Auth-only (401 sem login). O envio ao ZapSign reusa o `sendCaseDocumentToZapsignFn` genérico já existente.
- [x] **Testes** (AC: 6) — `typecheck` verde (só 3 erros pré-existentes de `service_type_id`); `lint` só CRLF nos arquivos tocados. Testes funcionais de geração/envio ficam para @qa (S9-10; dependem de template real).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases-service.ts` (`generateContratoFromTemplate` — espelho da procuração).
- `sistema-hv/src/lib/case-documents-service.ts` (garantir isolamento do ramo de procuração em `sendCaseDocumentToZapsign`; `generateCaseDocumentFromTemplate` já aceita `docKind`).
- `sistema-hv/src/rpc/case-documents.ts` e/ou `src/rpc/cases.ts` (RPC de gerar contrato, se necessária).

**REGRAS DE OURO (pertinentes):**
- **Esta story é serviço/RPC** — **NÃO** cria migration; **NÃO** toca `system_cases`; **NÃO** recria `system_cases_active` nem `trg_system_cases_bifurcacao`.
- `doc_kind` é **TEXT livre** — `'contrato'` entra sem constraint.
- **Degradação 424** (não 5xx) para dependência externa / modelo ausente — memória `reference_vercel_5xx_gateway`. Espelhar o padrão do termo (S6-04).
- Escrita de lifecycle continua fora desta story (é da S9-04). Aqui **só** se gera/envia o documento; o efeito "contrato assinado → CLIENTE" é do webhook (S9-05) → gatilho (S9-04).

**Riscos de regressão:**
- **Não** deixar o contrato disparar o carimbo `aguardando_assinatura_at` (que é a semântica antiga da procuração) — isso confundiria a lista comercial (`listComercialCases` filtra `aguardando_assinatura_at`).
- Idempotência do contrato precisa ser por `doc_kind='contrato'` (um caso pode ter procuração E contrato simultâneos — não colidir a busca de "já existe doc").

### Testing
- `generateContratoFromTemplate` 2x no mesmo caso → não duplica (retorna o existente).
- `sendCaseDocumentToZapsign` num doc `doc_kind='contrato'` → `ENVIADO_ZAPSIGN`, evento `doc_sent_zapsign`, `aguardando_assinatura_at` **inalterado**.
- Sem template de contrato → 424 com mensagem clara; caso não é alterado.
- Chamada não autenticada da RPC → 401.

---

## Dependências

- **Depende de:** S9-01 (schema — embora esta story não escreva os carimbos, ela pertence ao fluxo do contrato e vem depois do schema por coerência de sprint). Reusa `generateCaseDocumentFromTemplate`/`sendCaseDocumentToZapsign` (JÁ EXISTEM).
- **Habilita:** S9-05 (webhook roteia contrato assinado → operacional), S9-09 (botão "Enviar caso (contrato)" no detalhe).
- **Aguarda input do owner:** **modelo PURO de contrato** (`system_document_templates`). Até lá, degrada 424.

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **geração idempotente do contrato** + **envio sem efeito de procuração** + **degradação 424 sem template**. Complementa a matriz de geração/envio das S6/S7.

---

## File List

- `sistema-hv/src/lib/cases-service.ts` (`generateContratoFromTemplate` — espelho da procuração; degrada 424)
- `sistema-hv/src/lib/case-documents-service.ts` (comentário do ramo de procuração atualizado; já isolado por `doc_kind`)
- `sistema-hv/src/rpc/cases.ts` (`generateContratoFn` + `generateContratoSchema` — auth-only)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft inicial — `doc_kind='contrato'` na geração/envio + seleção de template + degradação 424 (Sprint 9) | @sm |
| 2026-07-03 | 1.0 | Implementada. `generateContratoFromTemplate` (idempotente por `doc_kind='contrato'`, degrada 424 sem template) + `generateContratoFn` (auth-only). Ramo de procuração em `sendCaseDocumentToZapsign` confirmado isolado. Sem migration. typecheck/lint ok. | @dev |
