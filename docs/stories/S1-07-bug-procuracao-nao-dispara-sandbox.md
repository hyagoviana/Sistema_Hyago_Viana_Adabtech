# Story S1-07: BUG bloqueante — procuração não dispara (validável em SANDBOX)

- **Sprint:** 1 — Lead/Cliente por caso (destrava o uso)
- **ID:** S1-07 (JÁ EXISTE — corrigir; VALIDÁVEL EM SANDBOX v2.2)
- **Status:** Ready for Review
- **Estimativa relativa:** M (média — corrigir disparo + validar caminho do webhook em sandbox)
- **Executor sugerido:** @dev · Quality gate: @architect

---

## Story

**Como** operador que envia a procuração de um caso,
**quero** que o ato "Enviar procuração" realmente crie o documento no ZapSign (sandbox) e registre o token, e que a assinatura (via webhook/replay) promova o caso a CLIENTE,
**para que** a virada automática lead→cliente seja provada sem depender de e-mail real.

---

## Contexto / o que JÁ EXISTE vs NOVO

**v2.2:** ZapSign fica em **sandbox**; produção fica para depois (GATE FUTURO B-09). Esta story **NÃO** fica mais bloqueada por produção — é validável em sandbox: (a) criação do doc + `zapsign_doc_token`, e (b) o caminho do webhook/simulação que dispara a virada. Como o sandbox **não envia e-mail real**, a virada é provada via **replay/simulação** do evento de assinatura.

Sintoma herdado: e-mail ZapSign não chegava (envio era manual + sandbox não dispara e-mail; ver `project_procuracao_revisao_envio`).

- **JÁ EXISTE:** `processZapsignWebhook(payload)` em `zapsign/webhook.ts:60`; dedupe em `system_webhook_dedupe` (`:87`); ao doc `doc_kind='procuracao'` assinar, chama `liberarCasoComercial(caseDoc.case_id, { via: 'webhook' })` (`:140-142`); atualiza doc para `status='ASSINADO'` + `drive_file_id` (`:128`).
- **JÁ EXISTE:** rota `api.webhooks.zapsign.tsx`.
- **NOVO:** garantir o disparo do doc no ZapSign sandbox no ato "Enviar procuração" (S1-02) + registrar `zapsign_doc_token`; tratar erro de dependência externa como **424**; validar ponta-a-ponta a virada por simulação/replay do webhook.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S1-07)

1. O ato "Enviar procuração" cria o doc no ZapSign (sandbox) e registra `zapsign_doc_token` em `system_case_documents`; erro de dependência externa retorna **424** (não 5xx — `reference_vercel_5xx_gateway`) com mensagem legível no front.
2. **(v2.2)** Simular/replay do evento de assinatura da procuração (webhook sandbox) → `liberarCasoComercial` roda → caso vira `lifecycle='CLIENTE'` com evento auditado — provando a lógica da virada automática **sem depender de e-mail real** (cobre o caminho do webhook/simulação, ver S4-01).

---

## Tasks / Subtasks

- [x] **Disparo no ato de envio** (AC: 1)
  - [x] `sendCaseDocumentToZapsign` já chama a API ZapSign (sandbox) e persiste `zapsign_doc_token`; agora também carimba `aguardando_assinatura_at` para procuração (S1-02), habilitando a liberação pelo webhook.
  - [x] Erro de dependência externa (ZapSign) → **424** (`EXTERNAL_DEP_FAILED`), nunca 5xx.
- [x] **Validação em sandbox (webhook/replay)** (AC: 2)
  - [x] `scripts/zapsign-webhook-replay.ts` faz replay do evento de assinatura (fixture sandbox) espelhando `processZapsignWebhook` + `liberarCasoComercial`.
  - [x] Prova ponta-a-ponta: doc → `ASSINADO`, `liberarCasoComercial` roda, caso → `lifecycle='CLIENTE'`, evento `liberado_comercial, diff.via='webhook', triggered_by=null`.
- [x] **Testes** (AC: 1,2) — `npm run test:webhook-replay` verde (compartilhado com S1-09/S4-01).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/zapsign/webhook.ts` (`processZapsignWebhook:60`) — não recriar, apenas validar/ajustar.
- `sistema-hv/src/routes/api.webhooks.zapsign.tsx`.
- Ação "Enviar procuração" (S1-02) / pipeline de geração ZapSign.
- `scripts/zapsign-smoke.mjs` (smoke/replay).

**Invariantes / riscos de regressão:**
- Depende de S1-01 para `liberarCasoComercial` setar `lifecycle='CLIENTE'`.
- Erros externos → 424 (regra de ouro 4).
- Dedupe `system_webhook_dedupe` só tem `UNIQUE(provider,external_id)`, sem janela temporal — reprocesso de histórico é risco **apenas na virada de produção** (GATE FUTURO B-09), **não** nesta rodada.
- Esta validação em sandbox é a mesma provada por S4-01 (compartilham os casos de teste do webhook).

### Testing
- Replay de payload sandbox → caso vira CLIENTE (ponta-a-ponta).
- Erro simulado de ZapSign → resposta 424 no front.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 19** (grupo F) — Virada auto em sandbox + dedupe: simular/replay do evento de assinatura → doc ASSINADO, arquivo na pasta do caso, `liberarCasoComercial` roda → `lifecycle='CLIENTE'` com evento auditado (`diff.via='webhook'`), sem depender de e-mail real; reenvio do mesmo token → ignorado por dedupe (compartilhado com S4-01).

---

## Dependências

- **Depende de:** S1-01 (lifecycle) e S1-02 (ação de envio desacoplada).
- **Co-validada com:** S4-01 (a prova da virada automática em sandbox roda dentro do escopo da S1).

---

## File List

- `sistema-hv/src/lib/case-documents-service.ts` — `sendCaseDocumentToZapsign` carimba `aguardando_assinatura_at` (procuração); erro externo 424 (já existente).
- `sistema-hv/scripts/zapsign-webhook-replay.ts` — replay/validação da virada em sandbox.
- `sistema-hv/package.json` — script `test:webhook-replay`.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 | @sm |
| 2026-07-02 | 1.0 | Envio seta flag comercial; replay em sandbox prova a virada + 424. Ready for Review | @dev |
