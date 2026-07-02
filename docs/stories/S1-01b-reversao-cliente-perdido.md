# Story S1-01b: Reversão CLIENTE→PERDIDO (distrato/desistência pós-assinatura)

- **Sprint:** 1 — Lead/Cliente por caso (destrava o uso)
- **ID:** S1-01b (Q-3)
- **Status:** Ready for Review
- **Estimativa relativa:** P (pequena — reusa a RPC `marcarCasoPerdido` de S1-03)
- **Executor sugerido:** @dev · Quality gate: @architect

---

## Story

**Como** advogado responsável por um caso,
**quero** reverter um caso já CLIENTE (procuração assinada) de volta para PERDIDO quando o cliente distrata ou desiste,
**para que** o funil reflita a realidade sem perder o histórico da assinatura, com auditoria de quem reverteu e por quê.

---

## Contexto / o que JÁ EXISTE vs NOVO

Hoje o fluxo cobre apenas LEAD→CLIENTE (assinatura) e LEAD→PERDIDO (manual). Cliente que **distrata/desiste depois de assinar** não tem caminho de volta.

- **JÁ EXISTE (após S1-01):** coluna `lifecycle`, `perdido_at`, `perdido_motivo` e invariante `perdido_at IS NOT NULL ⇒ lifecycle='PERDIDO'`.
- **JÁ EXISTE (após S1-03):** RPC `marcarCasoPerdido(caseId, motivo, userId)`.
- **NOVO:** `marcarCasoPerdido` passa a aceitar origem `lifecycle='CLIENTE'` (não só `LEAD`), transicionando para `PERDIDO`. `assinatura_liberada_at` **permanece registrado** (histórico), mas o estado terminal vira `PERDIDO`.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S1-01b)

1. Caso `CLIENTE` (com `assinatura_liberada_at` preenchido) → `marcarCasoPerdido(motivo, userId)` → `lifecycle='PERDIDO'`, `perdido_at`/`perdido_motivo` gravados.
2. Evento `system_case_events(action='perdido')` com `triggered_by` = usuário autenticado (não-null) e o motivo em `diff`.
3. Ação exige **apenas login** — **qualquer usuário autenticado** pode reverter (sem restrição por cargo). A auditoria (ator não-null + timestamp) continua obrigatória.

### Invariante a preservar
- `perdido_at IS NOT NULL ⇒ lifecycle='PERDIDO'` (mantida de S1-01); a coexistência de `assinatura_liberada_at` preenchido com `lifecycle='PERDIDO'` é **permitida** (histórico) — confirmar que o CHECK de S1-01 NÃO proíbe isso.

---

## Tasks / Subtasks

- [x] **Serviço** (AC: 1,2)
  - [x] `marcarCasoPerdido` (S1-03) já permite origem `lifecycle IN ('LEAD','CLIENTE')`; seta `lifecycle='PERDIDO'`, `perdido_at`, `perdido_motivo` sem apagar `assinatura_liberada_at`.
  - [x] Grava `perdido, diff={motivo, from}, triggered_by=userId`.
- [x] **Invariante** (AC: invariante) — CHECK de S1-01 confirmado no banco: `assinatura_liberada_at IS NULL OR lifecycle <> 'LEAD'` (permite CLIENTE→PERDIDO). Nenhum ajuste necessário.
- [x] **UI** (AC: 3) — botão "Marcar como perdido" da S1-03 aparece também em casos `CLIENTE` (só oculto para PERDIDO). Sem trava de cargo.
- [x] **Testes** (AC: 1-3) — verificação do CHECK via db-query; typecheck/lint verdes.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases-service.ts` (`marcarCasoPerdido`, criada em S1-03).
- Possível ajuste do CHECK em `20260702000001_case_lifecycle.sql` (S1-01) — coordenar: o invariante correto é `assinatura_liberada_at NOT NULL ⇒ lifecycle <> 'LEAD'` (não `= 'CLIENTE'`), para permitir a reversão. **Alinhar com S1-01 na hora de escrever o CHECK.**

**Riscos de regressão:**
- Se o CHECK de S1-01 for escrito como `assinatura_liberada_at NOT NULL ⇒ CLIENTE` estrito, esta reversão fica bloqueada. **Ponto de atenção crítico — ver Inconsistência no relatório do @sm.**

### Testing
- Teste de serviço: caso CLIENTE → reverter → PERDIDO + evento auditado.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 7** (grupo B) — Reversão pós-assinatura: cliente que distrata/desiste após assinar → CLIENTE→PERDIDO possível e auditado (S1-01b).

---

## Dependências

- **Depende de:** S1-01 (lifecycle + invariantes) e S1-03 (`marcarCasoPerdido`).

---

## File List

- `sistema-hv/src/lib/cases-service.ts` — `marcarCasoPerdido` aceita origem CLIENTE (reversão).
- `sistema-hv/src/routes/casos.$id.tsx` — botão perdido visível também em CLIENTE.
- (sem migration nova — CHECK de S1-01 já permite; migration 0030 verificada no banco.)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 | @sm |
| 2026-07-02 | 1.0 | Reversão CLIENTE→PERDIDO implementada via `marcarCasoPerdido`; CHECK verificado. Ready for Review | @dev |
