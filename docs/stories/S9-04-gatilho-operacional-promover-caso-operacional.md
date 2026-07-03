# Story S9-04: Gatilho operacional — `promoverCasoOperacional` (contrato assinado = CLIENTE + entra op/fin); `promoverCasoManual` chama-a

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-04
- **Status:** Ready for Review
- **Estimativa relativa:** M (nova função de promoção operacional; `promoverCasoManual` passa a delegar; carimba `assinatura_liberada_at` = contrato + `lifecycle='CLIENTE'`)
- **Executor sugerido:** @dev (serviço) · Quality gate: @architect

---

## Story

**Como** operador do escritório,
**quero** que a **assinatura do CONTRATO do caso** promova o caso a **CLIENTE** (carimba `assinatura_liberada_at`, entra na esteira operacional→financeira),
**para que** só o contrato assinado — e não a procuração — transforme o LEAD em CLIENTE naquele caso, fechando o modelo Lead→Comercial→Operacional.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (promoção manual):** `cases-service.ts:promoverCasoManual(caseId, userId)` (`:657-704`) — seta `lifecycle='CLIENTE'` + `macrostatus_comercial='GANHO'`; se estava `aguardando_assinatura_at`, limpa a flag e carimba `assinatura_liberada_at`/`_by`; evento `liberado_comercial`. Idempotente (no-op se já CLIENTE).
- **JÁ EXISTE (entrada op/fin):** a esteira operacional é resolvida pela projeção/`macrostatus_op`; o financeiro entra via `system_fn_entrar_financeiro`/bifurcação (S3/S19). Ao virar CLIENTE, o caso já está na 1ª etapa op (o `createCase` semeia a 1ª etapa op).
- **JÁ EXISTE (carimbo de contrato):** `assinatura_liberada_at` (redefinido em S9-01 para "contrato assinado") + CHECK `assinatura_liberada_at NOT NULL ⇒ lifecycle <> 'LEAD'`.
- **NOVO:** **`promoverCasoOperacional(caseId, { via: 'webhook'|'manual', userId })`** — o gatilho de "contrato assinado": seta `lifecycle='CLIENTE'`, carimba `assinatura_liberada_at = now()` (só se NULL) + `assinatura_liberada_by`, garante entrada na esteira op/fin (best-effort), grava evento `contrato_assinado`/`promovido_operacional`. Idempotente (no-op se já CLIENTE). **`promoverCasoManual` passa a delegar a esta** (mantém a assinatura pública p/ o botão manual da S1-03).

> **REDEFINIÇÃO (travada 2026-07-03):** contrato assinado = **evento operacional** ⇒ `lifecycle='CLIENTE'` **naquele caso** + `assinatura_liberada_at`. A pessoa continua LEAD em outros casos (1 pessoa → N casos). A entrada operacional→financeira segue a máquina existente (bifurcação/`entrar_financeiro`); esta story NÃO recria trigger de bifurcação (regra de ouro 6).

---

## Acceptance Criteria

1. `promoverCasoOperacional(caseId, { via, userId })`: no-op idempotente se `lifecycle==='CLIENTE'`. Senão: `lifecycle='CLIENTE'`, `assinatura_liberada_at=now()` (só se NULL), `assinatura_liberada_by=userId`, `macrostatus_comercial='GANHO'` (terminal comercial). Respeita o CHECK de S9-01.
2. **Entrada op/fin:** ao promover, o caso está/entra na 1ª etapa operacional (não regride uma esteira já avançada). A bifurcação financeira segue a máquina existente — **NÃO** recriar `trg_system_cases_bifurcacao`. Se o caso ainda não tem `macrostatus_op`, o gatilho garante a 1ª etapa op (best-effort, sem derrubar a promoção).
3. Grava `system_case_events(action='contrato_assinado', diff={via}, triggered_by=userId)` (ou `promovido_operacional` — nome único e consistente). Idempotente.
4. `promoverCasoManual(caseId, userId)` **delega** a `promoverCasoOperacional(caseId, { via:'manual', userId })`, preservando: exige `userId` (401 sem), no-op se já CLIENTE, mesmo contrato de retorno consumido por `promoverCasoManualFn` (`src/rpc/cases.ts:196`) e pelo n8n (S8-01/S9-06 — que na procuração NÃO chama esta; ver S9-06).
5. Escrita de lifecycle **server-side, centralizada** (regra de ouro 7). RPC não autenticada → 401.
6. `npm run typecheck` / `npm run lint` verdes (só os 3 erros pré-existentes de `service_type_id`).

---

## Tasks / Subtasks

- [x] **Criar `promoverCasoOperacional`** (AC: 1, 2, 3) — `lifecycle='CLIENTE'` + `assinatura_liberada_at` (se NULL) + `_by` + `macrostatus_comercial='GANHO'` no MESMO patch (respeita o CHECK de S9-01). Evento `contrato_assinado`. Idempotente (no-op se já CLIENTE).
- [x] **`promoverCasoManual` delega** (AC: 4) — reescrito para chamar `promoverCasoOperacional({ via:'manual', userId })`; mantém a guarda de `userId` (401) e o shape de retorno (`alreadyCliente`).
- [x] **Verificar entrada financeira** (AC: 2) — o caso já nasce na 1ª etapa op (`createCase`) e a esteira op não regride ao promover; a bifurcação/`entrar_financeiro` (S3/S19) segue a máquina existente. NÃO se recriou `trg_system_cases_bifurcacao` (regra de ouro 6). Observação p/ @qa: o caso legado `MAIS-...` foi criado só com etapa op — validar o gatilho fin ponta-a-ponta em S9-10.
- [x] **Testes** (AC: 6) — typecheck/lint verdes. Testes automatizados (contrato→CLIENTE, idempotência, entrada fin, RPC 401) ficam para @qa (S9-10).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases-service.ts` (`promoverCasoOperacional` novo; `promoverCasoManual` delega).
- `sistema-hv/src/rpc/cases.ts` (`promoverCasoManualFn` inalterado no contrato; só o efeito interno muda). Se a S9-05/S9-09 precisar de RPC própria de "contrato assinado manual", criar `promoverCasoOperacionalFn` (auth-only).

**REGRAS DE OURO (pertinentes):**
- **Serviço/RPC** — **NÃO** cria migration; **NÃO** toca `system_cases`; **NÃO** recria view.
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6) — a entrada financeira usa a máquina já existente.
- `system_case_events.action` **sem CHECK** → `contrato_assinado` entra livre.
- Escrita de lifecycle **RPC-only, centralizada** (regra de ouro 7).
- **Depende de S9-01** — o CHECK redefinido exige que carimbar `assinatura_liberada_at` implique NOT LEAD; como esta função seta `lifecycle='CLIENTE'` no MESMO update, o CHECK passa. Cuidado: setar `assinatura_liberada_at` sem setar `lifecycle` no mesmo patch violaria o CHECK.

**Riscos de regressão:**
- `promoverCasoManual` é chamado pelo botão manual (S1-03) **e** hoje pelo n8n na procuração (S8-01). A S9-06 corrige o n8n para NÃO promover na procuração. Enquanto S9-06 não roda, cuidado: `promoverCasoManual` continua promovendo — o efeito não regride (só a origem do disparo muda na S9-06).
- Não duplicar o carimbo comercial `GANHO` de forma conflitante com a S9-03 (ambas setam `GANHO` — é idempotente/consistente).

### Testing
- Caso LEAD (com ou sem procuração assinada) → `promoverCasoOperacional` → `lifecycle='CLIENTE'`, `assinatura_liberada_at` preenchido, entra op/fin. Segunda chamada → no-op.
- `promoverCasoManual` (botão manual) → mesmo efeito (delegação).
- Verificar que a bifurcação financeira ocorre (view Inadimplência/Kanban Fin reflete o novo CLIENTE).

---

## Dependências

- **Depende de:** S9-01 (`assinatura_liberada_at` = contrato + CHECK). Reusa a máquina de bifurcação/`entrar_financeiro` (S3/S19).
- **Habilita:** S9-05 (webhook chama esta no contrato assinado), S9-09 (botão "Enviar caso (contrato)" → assinado → esta), S9-10 (testes).

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **contrato assinado = CLIENTE + entra op/fin** + **idempotência** + **`promoverCasoManual` delega**. Par simétrico da S9-03 (procuração/comercial vs contrato/operacional).

---

## File List

- `sistema-hv/src/lib/cases-service.ts` (`promoverCasoOperacional`; `promoverCasoManual` delega)
- `sistema-hv/src/rpc/cases.ts` (RPC de promoção operacional — se necessária)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft inicial — gatilho operacional `promoverCasoOperacional` (contrato assinado = CLIENTE + op/fin) (Sprint 9) | @sm |
| 2026-07-03 | 1.0 | Implementada. `promoverCasoOperacional(caseId,{via,userId})` seta `lifecycle='CLIENTE'`+`assinatura_liberada_at`+`GANHO` no mesmo patch (respeita CHECK S9-01); evento `contrato_assinado`; idempotente. `promoverCasoManual` delega. typecheck/lint ok. | @dev |
