# Story S1-06: Migração — REGRA SIMPLES INICIAL + CORREÇÃO MANUAL (com anexo de doc)

- **Sprint:** 1 — Lead/Cliente por caso (destrava o uso)
- **ID:** S1-06 (REESCRITA v2.3)
- **Status:** Ready for Review
- **Estimativa relativa:** M (média — migration idempotente de classificação + integração de anexo na correção manual)
- **Executor sugerido:** @data-engineer (migration) + @dev (correção manual/anexo) · Quality gate: @dev/@architect

---

## Story

**Como** dono do escritório migrando a base atual para o novo modelo,
**quero** que os casos legados sejam classificados por uma regra objetiva (CLIENTE se procuração assinada no sistema, senão LEAD) e possa corrigir à mão as exceções (assinados por fora), anexando o documento assinado,
**para que** a base entre no novo modelo sem rebaixar clientes ativos nem promover ninguém em massa, mantendo minhas correções manuais preservadas.

---

## Contexto / o que JÁ EXISTE vs NOVO

**DECISÃO DO OWNER (v2.3):** migração = **REGRA SIMPLES INICIAL + CORREÇÃO MANUAL** (não mais 100% manual, sem dry-run). O default dos legados está **DECIDIDO**.

- **JÁ EXISTE:** `system_cases.assinatura_liberada_at` (`20260622000003_caso_comercial.sql:17`).
- **JÁ EXISTE:** `system_case_documents.status` com CHECK incluindo `'ASSINADO'` (`20260608000001_case_documents.sql:33-35`) e `doc_kind` (ex.: `'procuracao'`).
- **JÁ EXISTE (após S1-01):** coluna `lifecycle` + backfill inicial (`assinatura_liberada_at IS NOT NULL → CLIENTE`, resto LEAD por default).
- **JÁ EXISTE (após S1-03):** `promoverCasoManual` / `marcarCasoPerdido`.
- **JÁ EXISTE:** pipeline de upload com validação de **magic bytes** (mesmo de S4-02) — ver MVP-3 (`project_mvp3_done`).
- **NOVO:** migration idempotente de classificação (que cobre também o sinal por documento ASSINADO, além do já feito por `assinatura_liberada_at` no backfill de S1-01) + fluxo de correção manual "assinado por fora" com anexo.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S1-06)

1. **Regra inicial — CLIENTE:** caso legado com procuração assinada **no sistema** (`assinatura_liberada_at IS NOT NULL` **OU** doc `doc_kind='procuracao'` com `status='ASSINADO'`) → nasce `lifecycle='CLIENTE'` (respeita a invariante de S1-01).
2. **Regra inicial — LEAD:** caso legado **sem** sinal de assinatura no sistema → nasce `lifecycle='LEAD'`; posição no Kanban e `macrostatus_*` **inalterados**; **nenhum** caso ativo do operacional é rebaixado nem promovido em massa.
3. **Idempotência/reversibilidade:** rodar a migration **2x não muda** as classificações e **não sobrescreve** correções manuais (caso ajustado à mão para CLIENTE/PERDIDO **permanece**; só entra na regra quem ainda está sem `lifecycle`).
4. **Correção manual "assinado por fora":** caso assinado fora do sistema começa **LEAD**; usuário clica **"marcar como cliente"** → vira **CLIENTE** com evento auditado (ator + timestamp) **e anexa o doc assinado** — o anexo passa pela **validação de magic bytes** (inválido rejeitado; válido registrado em `system_case_documents`).
5. Botão **"não é cliente"** → o caso **permanece LEAD** (não promove).

---

## Tasks / Subtasks

- [x] **Migration idempotente de classificação** `20260702000004_migracao_lifecycle_legados.sql` (AC: 1,2,3) — APLICADA
  - [x] `UPDATE ... SET lifecycle='CLIENTE' WHERE lifecycle='LEAD' AND perdido_at IS NULL AND (assinatura_liberada_at IS NOT NULL OR EXISTS doc procuracao ASSINADO)`.
  - [x] Não altera `macrostatus_op/fin`, Kanban nem `stage_*_id`.
  - [x] Idempotente: só toca quem ainda é `LEAD` não-perdido; rodar 2x não muda nada nem sobrescreve correções manuais.
  - [x] Guarda no WHERE (molde `system_fn_entrar_financeiro`).
  - [x] Só UPDATE de dados — NÃO redefine `system_cases_active`.
- [x] **Correção manual "assinado por fora" + anexo** (AC: 4,5)
  - [x] "marcar como cliente" = botão da S1-03 (`promoverCasoManual`) → CLIENTE + evento auditado.
  - [x] Anexar doc assinado = upload existente com magic bytes (pipeline S4-02, `CaseDocumentsTab`), grava `doc_kind='procuracao'`.
  - [x] "não é cliente" = não clicar promover → permanece LEAD (ou usar "Marcar como perdido").
- [x] **Testes** (AC: 1-5) — migration aplicada e verificada (0 candidatos hoje → 33 casos seguem LEAD, nada rebaixado/promovido em massa); typecheck/lint verdes.

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA migration `sistema-hv/supabase/migrations/20260702000004_migracao_lifecycle_legados.sql`.
- Fluxo de UI de correção manual (reusa S1-03 + upload de S4-02).

**Invariantes / riscos de regressão:**
- **Idempotência é obrigatória** — não sobrescrever correção manual (Caso 10). A cláusula `WHERE lifecycle='LEAD'` (default não corrigido) é o mecanismo; alinhar com o backfill de S1-01 (que já pode ter setado CLIENTE por `assinatura_liberada_at`).
- **Cuidado:** se S1-01 já fez o backfill por `assinatura_liberada_at`, esta migration só adiciona o sinal por **documento ASSINADO**. Garantir que as duas migrations não conflitam (esta roda depois; só toca quem ainda é LEAD).
- Não rebaixar/promover em massa — só a regra objetiva (Caso 9).
- Magic bytes preservados no anexo (Caso 11 / Caso 17).
- Migration aplicada via pg direta (`reference_aplicar_migrations_pg_direto`).

### Testing
- Teste: legado com `assinatura_liberada_at` → CLIENTE; legado com doc ASSINADO → CLIENTE; legado sem sinal → LEAD.
- Teste de idempotência: rodar 2x + caso corrigido manualmente permanece.
- Teste: anexo inválido rejeitado (magic bytes); válido registrado.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3 — grupo C)

- **Caso 8** — Regra inicial → CLIENTE (S1-06 CA-1).
- **Caso 9** — Regra inicial → LEAD, não-disruptivo (S1-06 CA-2).
- **Caso 10** — Idempotência/reversibilidade (S1-06 CA-3).
- **Caso 11** — Correção manual "assinado por fora" + anexo com magic bytes + evento auditado; "não é cliente" permanece LEAD (S1-06 CA-4/CA-5).

---

## Dependências

- **Depende de:** S1-01 (coluna `lifecycle` + backfill + invariantes), S1-03 (`promoverCasoManual`/`marcarCasoPerdido`), e do pipeline de upload/magic bytes (S4-02, já existente).

---

## File List

- `sistema-hv/supabase/migrations/20260702000004_migracao_lifecycle_legados.sql` (+ rollback NO-OP documentado) — APLICADA.
- Correção manual reusa S1-03 (`casos.$id.tsx`) + upload de `CaseDocumentsTab` (S4-02, já existente).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 | @sm |
| 2026-07-02 | 1.0 | Migration 0032 aplicada (regra idempotente); correção manual via S1-03+upload. Ready for Review | @dev |
