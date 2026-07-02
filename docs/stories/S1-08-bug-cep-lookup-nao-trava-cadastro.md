# Story S1-08: BUG bloqueante — CEP/CEP-lookup não pode travar cadastro

- **Sprint:** 1 — Lead/Cliente por caso (destrava o uso)
- **ID:** S1-08 (JÁ EXISTE — corrigir)
- **Status:** Ready for Review
- **Estimativa relativa:** P (pequena — tornar lookup não-fatal)
- **Executor sugerido:** @dev · Quality gate: @architect

---

## Story

**Como** operador cadastrando um cliente,
**quero** salvar o cadastro mesmo quando o lookup de CEP falha ou expira,
**para que** uma dependência externa instável não bloqueie o registro da pessoa.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE:** fluxo de cadastro de cliente com lookup de CEP para preencher endereço (`clients-service` / form de cliente; busca de endereço vista em `20260622000004_search_clients_address.sql`).
- **NOVO:** tornar o lookup **não-fatal** — falha/timeout vira aviso, não bloqueia salvar; campos de endereço continuam editáveis manualmente.

---

## Acceptance Criteria

(CA do plano v2.3, seção S1-08)

1. Falha/timeout do lookup de CEP **não bloqueia** salvar o cadastro.
2. Campos de endereço continuam **editáveis manualmente**.
3. Erro vira **aviso não-fatal** (não 5xx que derruba o form).

---

## Tasks / Subtasks

- [x] **Front/serviço** (AC: 1,2,3)
  - [x] `lookupCep` ganhou timeout curto (6s, AbortController); o lookup roda em `onBlur`, separado do submit — nunca bloqueia o save.
  - [x] Aviso não-fatal via `toast.warning("Não foi possível buscar o endereço pelo CEP — preencha manualmente…")`.
  - [x] Campos de endereço permanecem editáveis (nunca desabilitados no fluxo de falha).
- [x] **Testes** (AC: 1-3) — typecheck/lint verdes; caminho de erro degrada para preenchimento manual.

---

## Dev Notes

**Arquivos a tocar:**
- Front do form de cliente (localizar componente de endereço/CEP).
- `sistema-hv/src/lib/clients-service.ts` se o lookup for server-side.

**Invariantes / riscos de regressão:**
- Erro de dependência externa → 424/aviso, nunca 5xx que trava (regra de ouro 4).
- Não introduzir regressão no autofill quando o CEP funciona.

### Testing
- Teste: simular falha/timeout do CEP → save conclui, aviso exibido, campos editáveis.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- Sem caso numerado dedicado na Matriz (bug de robustez de UX). Validar pelas 3 CAs acima.

---

## Dependências

- **Independente** das demais stories da Sprint 1 (bug isolado de robustez do cadastro).

---

## File List

- `sistema-hv/src/hooks/useLocalidades.ts` — `lookupCep` com timeout (AbortController).
- `sistema-hv/src/components/clients/ClientFormDialog.tsx` — aviso não-fatal (`toast.warning`).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 | @sm |
| 2026-07-02 | 1.0 | CEP não-fatal: timeout + aviso; save independente. Ready for Review | @dev |
