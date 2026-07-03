# Story S9-05: Webhook ZapSign roteia por `doc_kind` (procuracao → comercial, contrato → operacional)

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-05
- **Status:** Ready for Review
- **Estimativa relativa:** P/M (troca o efeito único do webhook por roteamento por `doc_kind`; reusa dedupe/armazenamento)
- **Executor sugerido:** @dev (serviço) · Quality gate: @architect

---

## Story

**Como** sistema,
**quero** que o webhook "documento assinado" do ZapSign **roteie por `doc_kind`** — procuração assinada → gatilho comercial; contrato assinado → gatilho operacional —,
**para que** cada tipo de documento dispare o efeito certo (procuração avança comercial e SEGUE LEAD; contrato vira CLIENTE), sem tocar o armazenamento/dedupe que já funciona.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (webhook):** `zapsign/webhook.ts:processZapsignWebhook` (`:60`) — dedupe por token (`system_webhook_dedupe`, `:87`), baixa o PDF assinado, acha o `system_case_documents` pelo token (`:111`, seleciona `doc_kind`), sobe na pasta do caso, marca `ASSINADO`. **Efeito de negócio atual (`:140`):** se `doc_kind==='procuracao'` chama `liberarCasoComercial` (que hoje promove a CLIENTE — errado no modelo novo). Fallback: caixa "ZapSign - Recebidos".
- **JÁ EXISTE (gatilhos novos):** `registrarProcuracaoAssinada` (S9-03, comercial) e `promoverCasoOperacional` (S9-04, operacional).
- **NOVO:** substituir o `if (doc_kind==='procuracao') liberarCasoComercial(...)` por **roteamento**: `doc_kind==='procuracao'` → `registrarProcuracaoAssinada(case_id, {via:'webhook'})`; `doc_kind==='contrato'` → `promoverCasoOperacional(case_id, {via:'webhook', userId: actor})`. `doc_kind` NULL/outro → só armazena (sem efeito de negócio). Best-effort (não bloqueia o armazenamento do PDF).

> **ROTEAMENTO (travado):** o webhook é o ponto único onde "assinado" vira efeito. `procuracao → comercial (segue LEAD)`; `contrato → operacional (vira CLIENTE)`. O armazenamento/dedupe/ASSINADO permanece igual para ambos.

---

## Acceptance Criteria

1. Ao receber "assinado" de um doc `doc_kind='procuracao'` vinculado a um caso: o PDF é armazenado (como hoje), o doc vira `ASSINADO`, e é chamado **`registrarProcuracaoAssinada(case_id, {via:'webhook'})`** (S9-03). O caso **segue LEAD** (`procuracao_assinada_at` carimbado, `GANHO`).
2. Ao receber "assinado" de um doc `doc_kind='contrato'` vinculado a um caso: armazena + `ASSINADO` + chama **`promoverCasoOperacional(case_id, {via:'webhook', userId})`** (S9-04). O caso vira **CLIENTE** (`assinatura_liberada_at` carimbado, entra op/fin).
3. `doc_kind` NULL/desconhecido ou doc sem `case_id` → **só armazena** (pasta do caso ou inbox), **sem** efeito de negócio (nenhuma mudança de lifecycle).
4. O efeito de negócio é **best-effort** (try/catch com log) — falha no gatilho NÃO impede o armazenamento do PDF nem o `ASSINADO`. Dedupe (`system_webhook_dedupe`) inalterado (cada token processado uma vez).
5. O `userId`/ator para `promoverCasoOperacional` é resolvido de forma auditável (ex.: ator-sistema/admin da org, padrão do n8n `resolveSystemActorId`) — sem usuário → promoção pulada com log (não perde o PDF).
6. `npm run typecheck` / `npm run lint` verdes (só os 3 erros pré-existentes de `service_type_id`).

---

## Tasks / Subtasks

- [x] **Roteamento por doc_kind** (AC: 1, 2, 3) — bloco `:140` substituído por `if/else if` sobre `caseDoc.doc_kind`: `'procuracao'` → `registrarProcuracaoAssinada`; `'contrato'` → `promoverCasoOperacional`; else → só armazena.
- [x] **Ator para operacional** (AC: 5) — `resolveSystemActorId` local no webhook (admin da org, mesmo critério do n8n-webhook-service); se ausente, promoção do contrato pulada com log (não perde o PDF).
- [x] **Best-effort** (AC: 4) — try/catch por ramo; dedupe (`system_webhook_dedupe`) intacto.
- [x] **Imports** — `import { promoverCasoOperacional, registrarProcuracaoAssinada }` (removido `liberarCasoComercial`).
- [x] **Testes** (AC: 6) — typecheck/lint verdes. Testes de payload (procuração→LEAD, contrato→CLIENTE, doc_kind NULL, falha best-effort, dedupe) ficam para @qa (S9-10).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/zapsign/webhook.ts` (roteamento por `doc_kind`; imports; ator para operacional).

**REGRAS DE OURO (pertinentes):**
- **Serviço** — **NÃO** cria migration; **NÃO** toca `system_cases`; **NÃO** recria view/trigger.
- Efeito de negócio **best-effort** (não bloqueia armazenamento) — já é o padrão atual (`:141-145`).
- Escrita de lifecycle acontece dentro dos gatilhos (S9-03/S9-04), server-side (regra de ouro 7).

**Riscos de regressão:**
- O `select` do `caseDoc` já traz `doc_kind` (`:113`) — reusar; não fazer query extra.
- Se um doc combinado antigo ("Contrato e procuração") ainda tiver `doc_kind='procuracao'`, ele roteia como procuração (segue LEAD) — coerente com a fase de transição (modelos puros virão depois). Documentar isso para o owner.
- Não remover o fallback da inbox (docs sem case_id).

### Testing
- Simular payload assinado com token de doc `procuracao` → `registrarProcuracaoAssinada` chamado; caso LEAD.
- Idem com doc `contrato` → `promoverCasoOperacional`; caso CLIENTE.
- doc_kind NULL → armazenado, sem efeito.
- Forçar erro no gatilho → PDF ainda armazenado, doc `ASSINADO`, evento de erro logado.

---

## Dependências

- **Depende de:** S9-03 (`registrarProcuracaoAssinada`), S9-04 (`promoverCasoOperacional`), S9-02 (existência de docs `doc_kind='contrato'`).
- **Habilita:** fluxo ponta-a-ponta do contrato (S9-09 → assinatura → CLIENTE). S9-10 testa os dois ramos.

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **roteamento por doc_kind** (procuracao→comercial/LEAD; contrato→operacional/CLIENTE) + **best-effort/dedupe**. Ponto de junção dos gatilhos S9-03/S9-04.

---

## File List

- `sistema-hv/src/lib/zapsign/webhook.ts` (roteamento por `doc_kind`)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft inicial — webhook ZapSign roteia por doc_kind (procuracao→comercial, contrato→operacional) (Sprint 9) | @sm |
| 2026-07-03 | 1.0 | Implementada. Roteamento por `doc_kind` em `processZapsignWebhook`: procuração→`registrarProcuracaoAssinada`, contrato→`promoverCasoOperacional` (ator = admin da org via `resolveSystemActorId`); best-effort por ramo; dedupe intacto. typecheck/lint ok. | @dev |
