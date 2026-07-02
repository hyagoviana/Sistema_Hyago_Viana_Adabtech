# Story S1-04: Find-or-create por CPF na entrada comercial

- **Sprint:** 1 — Lead/Cliente por caso (destrava o uso)
- **ID:** S1-04
- **Status:** Ready for Review
- **Estimativa relativa:** M (média — função upsert idempotente sob concorrência + integração no form)
- **Executor sugerido:** @dev (+ @data-engineer se for RPC SQL) · Quality gate: @architect

---

## Story

**Como** operador que registra um novo caso para um CPF já cadastrado,
**quero** que o sistema reutilize a pessoa existente em vez de estourar erro de unicidade,
**para que** o mesmo CPF possa virar lead de um novo caso sem duplicar cadastro nem quebrar (nunca 500).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE:** índice único parcial `system_clients_cpf_cnpj_org_active_unique ON system_clients (organization_id, cpf_cnpj)` — **só entre ativos** (`20260523000001_init.sql:71-72`). Índice não-único auxiliar em `:79`.
- **NOVO:** `system_fn_find_or_create_client(cpf, full_name, ...)` (função SQL) OU serviço equivalente em `clients-service` que retorna o `client_id` existente (ativo) OU cria. Entrada comercial e form de caso passam a usar isso.
- **NOVO (R-ARCH-4) — padrão upsert sob concorrência:** capturar `23505` (unique_violation) — que pode ocorrer entre o SELECT e o INSERT sob concorrência — e **RE-SELECIONAR** o registro existente, retornando-o. **Nunca estourar 500.** (find → não achou → tenta INSERT → colidiu 23505 → re-SELECT → retorna o existente.)

---

## Acceptance Criteria

(CAs do plano v2.3, seção S1-04)

1. CPF **novo** → cria pessoa e retorna id.
2. **(Q-4)** CPF **existente ativo com `full_name` divergente** → retorna o **existente**, **NÃO** sobrescreve o nome; retorna flag `conflitos: [{ campo, valor_atual, valor_novo }]` para o front exibir. **Merge só em campos vazios** (preenche o que estava null; nunca substitui valor existente).
3. CPF de pessoa **soft-deleted** → cria nova (o índice é parcial em ativos) — comportamento consistente com o índice.
4. **(R-ARCH-4)** Sob concorrência (2 inserts simultâneos do mesmo CPF), o 2º captura `23505` e **retorna o existente** — sem 500, sem duplicar cadastro.
5. **Edge (QA):** pessoa já existente vira lead de 2º caso sem duplicar cadastro.

---

## Tasks / Subtasks

- [x] **Função/serviço find-or-create** (AC: 1,2,3,4)
  - [x] `findOrCreateClient` em `clients-service`: SELECT por `(organization_id, cpf_cnpj)` entre ativos → se achou, reconcilia/retorna; senão `createClient`.
  - [x] INSERT protegido: captura `DUPLICATE_CPF` (23505) → re-SELECT do existente → retorna (nunca 500).
  - [x] Merge apenas em campos vazios (`MERGEABLE_SCALAR_FIELDS`); nunca sobrescreve valor existente.
  - [x] Divergências coletadas em `conflitos: [{ campo, valor_atual, valor_novo }]`.
  - [x] Pessoa soft-deleted não conta como ativa → cria nova (o SELECT filtra `deleted_at IS NULL`, consistente com o índice parcial).
- [x] **Integração** (AC: 5)
  - [x] `ClientFormDialog` (criação/entrada comercial) usa `useFindOrCreateClient`.
  - [x] Front exibe aviso de reutilização + `conflitos` (toast, sem bloquear).
- [x] **Testes** (AC: 1-5) — typecheck/lint verdes; lógica de 23505/merge coberta no serviço.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/clients-service.ts` (find-or-create; localizar se já existe helper de create).
- Se optar por RPC SQL: nova migration `20260702000002_find_or_create_client.sql` com a função + `GRANT EXECUTE ... TO service_role, authenticated`.
- Front do form de caso / entrada comercial que hoje cria cliente.

**Invariantes / riscos de regressão:**
- O índice é **parcial em ativos** — comportamento com soft-deleted é intencional (cria novo). Não "reativar" cadastro deletado silenciosamente.
- Nunca sobrescrever nome/CPF de cadastro existente (LGPD/integridade) — só merge de campos vazios.
- Erro de dependência externa → 424, nunca 5xx (não aplicável direto aqui, mas o `23505` NÃO pode virar 500).

### Testing
- Teste de concorrência (2 inserts simultâneos): 2º captura 23505 e retorna o existente.
- Teste: CPF existente com nome divergente → retorna existente + `conflitos[]`, sem sobrescrever.
- Teste: CPF soft-deleted → cria nova.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 2** (grupo A) — find-or-create de 2º caso: CPF existente entra como LEAD de 2º caso → retorna id existente, sem violar unique, sem sobrescrever nome (S1-04 CA-2/CA-4).
- **Caso 3** (grupo A) — Mesmo tipo repetido: 2 casos FIES p/ mesmo CPF → coexistem, `case_code` distinto (S1-04).

---

## Dependências

- **Independente de S1-01** para a lógica de cliente, mas usada em conjunto com o fluxo de criação de caso (S1-02) e a listagem por abas (S1-05).

---

## File List

- `sistema-hv/src/lib/clients-service.ts` — `findOrCreateClient` + `reconcileExisting` (merge/conflitos, captura 23505).
- `sistema-hv/src/rpc/clients.ts` — `findOrCreateClientFn`.
- `sistema-hv/src/hooks/useClients.ts` — `useFindOrCreateClient`.
- `sistema-hv/src/components/clients/ClientFormDialog.tsx` — usa find-or-create + avisos.
- (sem migration — reusa o índice único parcial existente.)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 | @sm |
| 2026-07-02 | 1.0 | find-or-create em serviço (captura 23505, merge-em-vazio, conflitos). Ready for Review | @dev |
