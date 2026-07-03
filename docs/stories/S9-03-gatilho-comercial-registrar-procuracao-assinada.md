# Story S9-03: Gatilho comercial — `registrarProcuracaoAssinada` (procuração assinada = SEGUE LEAD, avança comercial)

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-03
- **Status:** Ready for Review
- **Estimativa relativa:** M (reescreve `liberarCasoComercial` → semântica comercial que NÃO muda lifecycle; carimba `procuracao_assinada_at` + `macrostatus_comercial='GANHO'`)
- **Executor sugerido:** @dev (serviço) · Quality gate: @architect

---

## Story

**Como** operador do comercial,
**quero** que a **procuração assinada** registre o avanço comercial do caso (carimba `procuracao_assinada_at`, move a esteira comercial p/ GANHO) **sem** virar CLIENTE,
**para que** o caso continue LEAD e siga para a etapa seguinte do fluxo (envio do contrato), respeitando o modelo "procuração ≠ contrato".

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (função atual):** `cases-service.ts:liberarCasoComercial(caseId, {via, userId?})` (`:599-645`) — hoje: no-op se `aguardando_assinatura_at` é NULL; senão limpa a flag, carimba `assinatura_liberada_at`/`_by`, **seta `lifecycle='CLIENTE'`** e `macrostatus_comercial='GANHO'`; grava evento `liberado_comercial`. **No modelo novo isso está ERRADO** (procuração NÃO deve virar CLIENTE).
- **JÁ EXISTE (esteira comercial):** `macrostatus_comercial='GANHO'` é o carimbo terminal comercial (S5-02). A projeção `system_fn_sync_stage_ids` preenche `stage_comercial_id`.
- **JÁ EXISTE (carimbo novo):** `procuracao_assinada_at` (S9-01).
- **JÁ EXISTE (`system_case_events.action` sem CHECK):** eventos novos entram sem migration.
- **NOVO:** renomear/reescrever `liberarCasoComercial` → **`registrarProcuracaoAssinada(caseId, {via, userId?})`**: carimba `procuracao_assinada_at = now()` (se ainda não), limpa `aguardando_assinatura_at`, seta `macrostatus_comercial='GANHO'`, **NÃO** toca `lifecycle` (segue LEAD), **NÃO** carimba `assinatura_liberada_at` (isso é do contrato — S9-04). Grava evento `procuracao_assinada`. Idempotente.

> **REDEFINIÇÃO (travada 2026-07-03):** procuração assinada = **evento comercial**. Efeitos: `procuracao_assinada_at`, `macrostatus_comercial='GANHO'`, sai de `aguardando_assinatura_at`. **NÃO** muda `lifecycle` (permanece LEAD) nem carimba `assinatura_liberada_at`. Isso permite `1 pessoa → N casos` e a separação procuração/contrato. O nome `liberarCasoComercial` some (ou vira alias fino que chama a nova).

---

## Acceptance Criteria

1. `registrarProcuracaoAssinada(caseId, { via: 'webhook'|'manual', userId? })`: se o caso não estava em fase de assinatura da procuração (`aguardando_assinatura_at` NULL **e** `procuracao_assinada_at` já preenchido) → **no-op idempotente**. Caso contrário: carimba `procuracao_assinada_at = now()` (só se NULL), limpa `aguardando_assinatura_at`, seta `macrostatus_comercial='GANHO'`.
2. **`lifecycle` NÃO é alterado** (o caso segue LEAD). **`assinatura_liberada_at` NÃO é carimbado** (é do contrato). Respeita o CHECK redefinido em S9-01 (procuração assinada + LEAD é válido).
3. Grava `system_case_events(action='procuracao_assinada', diff={via}, triggered_by=userId)`. Idempotente (não duplica evento em reprocessamento).
4. Todas as referências a `liberarCasoComercial` no código passam a chamar `registrarProcuracaoAssinada` (webhook S9-05, RPC `liberarCasoFn` em `src/rpc/cases.ts:186`, e o que mais consumir). A RPC pública mantém contrato/auth (login-only) — só muda o efeito interno.
5. Escrita de `lifecycle`/carimbos continua **server-side, centralizada** em `cases-service` (regra de ouro 7). Chamada não autenticada da RPC → 401.
6. `npm run typecheck` / `npm run lint` verdes (só os 3 erros pré-existentes de `service_type_id`).

---

## Tasks / Subtasks

- [x] **Reescrever a função** (AC: 1, 2, 3) — `liberarCasoComercial` → `registrarProcuracaoAssinada`. Patch: `{ procuracao_assinada_at: now (se NULL), aguardando_assinatura_at: null, macrostatus_comercial: 'GANHO' }`. **Removidos** `lifecycle:'CLIENTE'`, `assinatura_liberada_at`, `assinatura_liberada_by`. Evento `procuracao_assinada`.
- [x] **Idempotência** (AC: 1, 3) — no-op quando já registrada (`aguardando_assinatura_at` NULL **e** `procuracao_assinada_at` preenchido); não duplica evento.
- [x] **Atualizar chamadores** (AC: 4) — `src/rpc/cases.ts:liberarCasoFn` (via alias, contrato/path inalterado); `src/lib/zapsign/webhook.ts` (S9-05); `src/lib/n8n-webhook-service.ts` (S9-06). Grep por `liberarCasoComercial` limpo (só o alias + script de replay).
- [x] **Alias/compat** — `export const liberarCasoComercial = registrarProcuracaoAssinada` mantido (o `liberarCasoFn` da RPC e o script de replay ainda referenciam o nome; semântica agora é comercial = registrar procuração).
- [x] **Testes** (AC: 6) — typecheck/lint verdes. Verificado no banco: os 2 casos legados rebaixados (S9-06) têm `procuracao_assinada_at` + `GANHO` + `lifecycle='LEAD'` + `assinatura_liberada_at=NULL`. Testes automatizados do gatilho ficam para @qa (S9-10).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases-service.ts` (`liberarCasoComercial` → `registrarProcuracaoAssinada`).
- `sistema-hv/src/rpc/cases.ts` (`liberarCasoFn` chama a nova; renomear função pública é opcional — manter o mesmo path/nome de RPC reduz churn no front).
- `sistema-hv/src/lib/zapsign/webhook.ts` (import — o roteamento por doc_kind é da S9-05; aqui só ajustar o nome importado se S9-05 ainda não rodou).

**REGRAS DE OURO (pertinentes):**
- **Serviço/RPC** — **NÃO** cria migration; **NÃO** toca `system_cases`; **NÃO** recria view/trigger.
- `system_case_events.action` **sem CHECK** → `procuracao_assinada` entra livre.
- Escrita de lifecycle/carimbos **RPC-only, centralizada** (regra de ouro 7) — esta story mantém isso; só muda QUAIS carimbos a função escreve.
- **Depende de S9-01 estar aplicada** — sem o CHECK redefinido, setar `procuracao_assinada_at` num LEAD é ok, mas se por engano o código ainda carimbasse `assinatura_liberada_at` num LEAD, o CHECK novo barraria (rede de segurança). Bom sinal de que a S9-01 vem antes.

**Riscos de regressão:**
- **NÃO** deixar resíduo de `lifecycle:'CLIENTE'` no patch — seria o bug que o modelo novo corrige.
- `promoverCasoManual` (S9-04) é uma função DIFERENTE — não confundir: aqui é só o evento comercial; a promoção a CLIENTE é da S9-04.
- Se manter alias `liberarCasoComercial`, garantir que o n8n (S9-06) aponte para a semântica comercial (registrar procuração), NÃO promover.

### Testing
- Caso LEAD com `aguardando_assinatura_at` setado → `registrarProcuracaoAssinada` → `procuracao_assinada_at` preenchido, `aguardando_assinatura_at` NULL, `macrostatus_comercial='GANHO'`, `lifecycle='LEAD'` (inalterado), `assinatura_liberada_at` NULL. Evento `procuracao_assinada` gravado.
- Segunda chamada → no-op (sem novo evento).
- Verificar no banco que o CHECK de S9-01 não barra (LEAD + `procuracao_assinada_at`).

---

## Dependências

- **Depende de:** S9-01 (`procuracao_assinada_at` + CHECK redefinido). Reusa `macrostatus_comercial` (S5-02).
- **Habilita:** S9-05 (webhook chama esta na procuração), S9-06 (n8n chama esta em vez de promover), S9-10 (testes dos gatilhos).

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **procuração assinada = SEGUE LEAD** (carimbo comercial sem mudança de lifecycle) + **idempotência**. É o coração do modelo novo — testar isoladamente antes do webhook.

---

## File List

- `sistema-hv/src/lib/cases-service.ts` (`registrarProcuracaoAssinada`)
- `sistema-hv/src/rpc/cases.ts` (`liberarCasoFn` → chama a nova)
- `sistema-hv/src/lib/zapsign/webhook.ts` (import — coordenado com S9-05)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft inicial — gatilho comercial `registrarProcuracaoAssinada` (procuração assinada segue LEAD) (Sprint 9) | @sm |
| 2026-07-03 | 1.0 | Implementada. `registrarProcuracaoAssinada` carimba `procuracao_assinada_at`+`GANHO`, limpa `aguardando_assinatura_at`, NÃO toca lifecycle nem `assinatura_liberada_at`; evento `procuracao_assinada`; idempotente. Alias `liberarCasoComercial` mantido. typecheck/lint ok. | @dev |
