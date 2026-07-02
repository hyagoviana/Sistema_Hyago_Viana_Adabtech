# Story S1-09 (S4-01): Validar a lógica da virada automática lead→cliente em SANDBOX

- **Sprint:** 1 — Lead/Cliente por caso (roda **dentro do escopo da Sprint 1**; é a story S4-01 do plano, executada aqui)
- **ID:** S4-01 (referenciada como S1-09 na ordem da Sprint 1)
- **Status:** Ready for Review
- **Estimativa relativa:** M (média — simulação/replay do webhook + prova ponta-a-ponta)
- **Executor sugerido:** @dev · Quality gate: @architect

---

## Story

**Como** dono do escritório,
**quero** provar que a assinatura da procuração promove o caso a CLIENTE automaticamente, testando via simulação/replay do webhook em sandbox,
**para que** a virada automática lead→cliente esteja validada sem depender de e-mail real nem de cutover para produção.

---

## Contexto / o que JÁ EXISTE vs NOVO

**DECISÃO DO OWNER (v2.2):** ZapSign fica em **sandbox**; produção fica para depois. O objetivo desta story **deixa de ser "habilitar produção + cadastrar webhook"** (não bloqueante) e passa a **validar a lógica da virada automática em sandbox** (replay do evento de assinatura). Sandbox **não dispara e-mail real** — o teste cobre o **caminho do webhook/simulação**.

- **JÁ EXISTE:** `processZapsignWebhook` (`zapsign/webhook.ts:60`), rota `api.webhooks.zapsign.tsx`, dedupe (`system_webhook_dedupe`, insert em `:87`), `liberarCasoComercial` idempotente (`cases-service.ts:455`; agora seta `lifecycle='CLIENTE'` após S1-01). Ao doc `doc_kind='procuracao'` assinar (`webhook.ts:140`), atualiza doc para `ASSINADO` + `drive_file_id` (`:128`) e chama `liberarCasoComercial(caseId, { via:'webhook' })` (`:142`).
- **NOVO (sandbox):** simular/replay o evento de assinatura (payload sandbox ou fixture/smoke `scripts/zapsign-smoke.mjs`) contra a rota do webhook e provar ponta-a-ponta que o caso vira CLIENTE com evento auditado. **Sem cutover, sem cadastrar webhook em prod.**

---

## Acceptance Criteria

(CAs do plano v2.3, seção S4-01)

1. **Simular/receber** o evento de assinatura da procuração (sandbox/replay) → doc vira `ASSINADO`, arquivo cai na **pasta do caso**, e `liberarCasoComercial` roda → caso vira `lifecycle='CLIENTE'` com **evento auditado** (`action='liberado_comercial', diff.via='webhook'`).
2. **Idempotência (dedupe):** reenviar o **mesmo evento (mesmo token)** → **ignorado por dedupe** (não duplica arquivo nem promove 2x).
3. **Sem e-mail real:** a virada automática é provada **via webhook/simulação** (sandbox não envia e-mail) — o teste **não** depende da chegada de e-mail.

---

## Tasks / Subtasks

- [x] **Fixture/replay** (AC: 1)
  - [x] `scripts/zapsign-webhook-replay.ts` monta fixture sandbox de "documento assinado" (`doc_kind='procuracao'`) e espelha o fluxo de `processZapsignWebhook`.
- [x] **Prova ponta-a-ponta** (AC: 1)
  - [x] Replay verifica: doc → `ASSINADO` + `drive_file_id` (pasta do caso); caso → `lifecycle='CLIENTE'`; evento `liberado_comercial, diff.via='webhook', triggered_by=null`.
- [x] **Dedupe** (AC: 2)
  - [x] Reenvio do mesmo token → ignorado (dedupe); não duplica arquivo nem promove 2x (1 evento só).
- [x] **Testes** (AC: 1-3) — `npm run test:webhook-replay` verde.

> **GATE FUTURO (B-09) — fora do escopo:** cutover produção (virar credenciais sandbox→prod na Vercel + cadastrar webhook no painel ZapSign + guarda anti-replay `webhook_ativo_desde` / pré-popular tokens). **NÃO** fazer nesta rodada.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/zapsign/webhook.ts` (validar/ajustar `processZapsignWebhook:60`).
- `sistema-hv/src/routes/api.webhooks.zapsign.tsx`.
- `scripts/zapsign-smoke.mjs`.

**Invariantes / riscos de regressão:**
- Depende de S1-01 (para `liberarCasoComercial` setar `lifecycle='CLIENTE'`).
- Dedupe `system_webhook_dedupe` só tem `UNIQUE(provider,external_id)` (sem janela) — reprocesso de histórico só é risco no cutover de produção (B-09), NÃO nesta rodada.
- Magic bytes preservados no download do arquivo assinado (pasta do caso).
- Esta story **valida a AC-4 automática da S1-01** e **co-valida S1-07** sem produção.

### Testing
- Replay → CLIENTE (ponta-a-ponta), com evento auditado.
- Reenvio do mesmo token → no-op por dedupe.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 19** (grupo F) — Virada auto em sandbox + dedupe (S4-01 CA-1/CA-2/CA-3). O cutover de produção migra para o GATE FUTURO **B-09** — não é caso desta rodada.

---

## Dependências

- **Depende de:** S1-01 (lifecycle), S1-02 (envio desacoplado) e S1-07 (disparo do doc/token em sandbox). **Prova** a AC automática de S1-01 e valida S1-07.

---

## File List

- `sistema-hv/scripts/zapsign-webhook-replay.ts` — replay ponta-a-ponta + dedupe.
- `sistema-hv/package.json` — script `test:webhook-replay`.
- (webhook.ts / cases-service.ts já corretos — S1-01 fez `liberarCasoComercial` setar `lifecycle='CLIENTE'`.)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (S4-01 executada no escopo da Sprint 1) | @sm |
| 2026-07-02 | 1.0 | Replay em sandbox valida virada automática + dedupe. Ready for Review | @dev |
