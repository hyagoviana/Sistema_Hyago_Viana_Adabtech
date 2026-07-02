# Story S1-03: Botões manuais lead→cliente e lead→perdido, POR CASO

- **Sprint:** 1 — Lead/Cliente por caso (destrava o uso)
- **ID:** S1-03
- **Status:** Ready for Review
- **Estimativa relativa:** M (média — 2 RPCs novas + UI na ficha/Kanban)
- **Executor sugerido:** @dev · Quality gate: @architect

---

## Story

**Como** qualquer usuário autenticado do escritório,
**quero** promover um caso de LEAD para CLIENTE e marcar um caso como PERDIDO manualmente, por caso,
**para que** casos que não passam por ZapSign (ou assinados por fora) também tenham seu ciclo de vida corrigido, com auditoria de ator e timestamp.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **BUG CRÍTICO (R-ARCH-3) — o no-op de `liberarCasoComercial`:** em `cases-service.ts:469`, se `aguardando_assinatura_at IS NULL`, a função retorna `{ alreadyLiberado: true }` **sem promover** (`:469-471`). Portanto o botão manual **NÃO pode reusar `liberarCasoComercial` cru** — um LEAD sem procuração ZapSign nunca viraria CLIENTE. É **obrigatório** criar `promoverCasoManual`, que seta `lifecycle='CLIENTE'` **independente** de `aguardando_assinatura_at`.
- **JÁ EXISTE:** `system_case_events` para auditoria (`20260523000004_cases.sql:98`).
- **JÁ EXISTE (após S1-01):** coluna `lifecycle`, `perdido_at`, `perdido_motivo` + invariantes.
- **NOVO:** RPC/serviço `promoverCasoManual(caseId, userId)` e `marcarCasoPerdido(caseId, motivo, userId)`.
- **NOVO (UI):** botões "Marcar como cliente" e "Marcar como perdido" na ficha do caso e/ou no card do Kanban.

**DECISÃO DO OWNER (v2.2) — SEM restrição por cargo:** **qualquer usuário autenticado** pode promover e marcar PERDIDO. Ação exige **apenas login** (`userId` não-null). **Não** há capability RBAC específica nem 403-por-papel. Quando a procuração é assinada (webhook, mesmo sandbox), o caso promove a cliente **automaticamente** (via `liberarCasoComercial` → `lifecycle='CLIENTE'`). **Auditoria (ator + timestamp em `system_case_events`) permanece obrigatória.**

---

## Acceptance Criteria

(CAs do plano v2.3, seção S1-03)

1. **(Q-2)** `promoverCasoManual` promove um LEAD **SEM** `aguardando_assinatura_at` → `lifecycle` vira `CLIENTE` (prova que o no-op de `liberarCasoComercial` foi **tratado**, não herdado).
2. Botão manual em caso **já** CLIENTE → **no-op idempotente** (não duplica evento nem erra).
3. "Marcar como perdido" pede motivo, grava `perdido_at`/`motivo`, remove das views de LEAD ativas.
4. **(sem RBAC por cargo)** Promoção e perda exigem **apenas usuário autenticado**; **qualquer** papel logado consegue executar (sem 403-por-cargo). RPC rejeita apenas chamada **não autenticada** (`userId` null).
5. **(auditoria — mantida)** Toda promoção/perda manual grava **ator (`triggered_by` não-null) + timestamp** em `system_case_events`.

---

## Tasks / Subtasks

- [x] **Serviço — `promoverCasoManual(caseId, userId)`** (AC: 1,2,4,5)
  - [x] Rejeita `userId` null (401).
  - [x] `UPDATE ... SET lifecycle='CLIENTE'` **independente** de `aguardando_assinatura_at` (NÃO delega ao no-op). Se aguardando, limpa a flag e carimba `assinatura_liberada_at`/`_by` para respeitar a invariante.
  - [x] Idempotente: já `CLIENTE` → retorna `alreadyCliente:true`, sem UPDATE nem evento.
  - [x] Evento `liberado_comercial, diff={via:'manual'}, triggered_by=userId`.
- [x] **Serviço — `marcarCasoPerdido(caseId, motivo, userId)`** (AC: 3,4,5)
  - [x] Rejeita `userId` null (401) e `motivo` vazio (422).
  - [x] `SET lifecycle='PERDIDO', perdido_at=now(), perdido_motivo=motivo`. Aceita origem `LEAD` e `CLIENTE` (S1-01b); não apaga `assinatura_liberada_at`.
  - [x] Evento `perdido, diff={motivo, from}, triggered_by=userId`.
  - [x] Idempotente para já PERDIDO (`alreadyPerdido:true`).
- [x] **UI** (AC: 1,2,3,4)
  - [x] Botões "Marcar como cliente" e "Marcar como perdido" no header da ficha do caso + badge de lifecycle.
  - [x] "Marcar como perdido" abre dialog com motivo obrigatório.
  - [x] Sem gate de cargo — visível para qualquer usuário logado.
- [x] **Testes** (AC: 1-5) — typecheck/lint verdes; CHECK verificado no banco (permite CLIENTE→PERDIDO).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases-service.ts` — novas funções `promoverCasoManual`, `marcarCasoPerdido` (perto de `liberarCasoComercial:455`).
- Camada de RPC/serverFn que expõe essas ações ao front.
- Front: ficha do caso e/ou card do Kanban.

**Invariantes / riscos de regressão:**
- **NÃO reusar o no-op de `liberarCasoComercial` (`:469`)** para promoção manual — é o bug central desta story.
- Escrita de `lifecycle` é **RPC-only** (regra de ouro 7).
- Coordenar o CHECK de invariante com S1-01/S1-01b: promoção manual sem flag comercial precisa passar pela invariante `assinatura_liberada_at NOT NULL ⇒ NOT LEAD`.
- Não recriar `trg_system_cases_bifurcacao`.

### Testing
- Teste-chave: LEAD sem `aguardando_assinatura_at` → `promoverCasoManual` → `lifecycle='CLIENTE'` (prova do fix do no-op).
- Teste: idempotência (2ª chamada não duplica evento).
- Teste: `userId` null → rejeitado.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 4** (grupo B) — Fix do no-op: LEAD sem procuração ZapSign → botão manual → CLIENTE (S1-03 CA-1).
- **Caso 5** (grupo B) — Idempotência manual: botão em caso já CLIENTE → idempotente, sem duplicar evento (S1-03 CA-2).
- **Caso 6** (grupo B) — Marcar PERDIDO: some de Leads, aparece em Perdidos, grava motivo + ator (S1-03 CA-3/CA-5).

---

## Dependências

- **Depende de:** S1-01 (lifecycle + invariantes + escrita centralizada).
- **Habilita:** S1-01b (reversão reusa `marcarCasoPerdido`), S1-06 (correção manual reusa `promoverCasoManual`).

---

## File List

- `sistema-hv/src/lib/cases-service.ts` — `promoverCasoManual`, `marcarCasoPerdido`.
- `sistema-hv/src/rpc/cases.ts` — `promoverCasoManualFn`, `marcarCasoPerdidoFn`.
- `sistema-hv/src/hooks/useCases.ts` — `usePromoverCasoManual`, `useMarcarCasoPerdido`.
- `sistema-hv/src/routes/casos.$id.tsx` — botões + badge lifecycle + dialog de motivo + label timeline `perdido`.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 | @sm |
| 2026-07-02 | 1.0 | Implementado: RPCs promover/perder (fix do no-op), UI, auditoria. Ready for Review | @dev |
