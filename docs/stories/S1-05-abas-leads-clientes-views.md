# Story S1-05: Abas Leads/Clientes como filtros (views) sobre a base única

- **Sprint:** 1 — Lead/Cliente por caso (destrava o uso)
- **ID:** S1-05
- **Status:** Ready for Review
- **Estimativa relativa:** M (média — views/consultas derivadas + telas de abas)
- **Executor sugerido:** @dev (+ @data-engineer para as views) · Quality gate: @architect

---

## Story

**Como** usuário do escritório,
**quero** ver "Leads" e "Clientes" como abas que filtram a mesma base de pessoas pelo estado dos seus casos,
**para que** uma pessoa possa aparecer como lead em um caso e cliente em outro sem duplicar cadastro, e para eu enxergar `dias_parado` de cada lead.

---

## Contexto / o que JÁ EXISTE vs NOVO

Princípio travado: **pessoa única por CPF; status DERIVADO por caso.** As "abas" Leads/Clientes são **filtros/views** sobre `system_clients` (não tabelas físicas). O ciclo de vida vive no caso (`system_cases.lifecycle`).

- **JÁ EXISTE (após S1-01):** `system_cases.lifecycle ∈ {LEAD,CLIENTE,PERDIDO}`, `perdido_at`, exposto em `system_cases_active`.
- **JÁ EXISTE:** `system_clients` (pessoa única por CPF).
- **NOVO:** views/consultas derivadas:
  - LEAD = pessoas com ≥1 caso `lifecycle='LEAD'` (não perdidos, ativos).
  - CLIENTE = pessoas com ≥1 caso `lifecycle='CLIENTE'`.
  - PERDIDOS = filtro separado.
- **NOVO (estrutura para IA futura, sem IA agora):** `status_lead` (livre/enum) e `dias_parado` (derivado de `status_changed_at`/último evento). Só a estrutura + o número — **sem IA** nesta rodada.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S1-05)

1. Aba Leads mostra pessoas com ≥1 caso LEAD; Aba Clientes idem para CLIENTE.
2. Pessoa aparece nas DUAS abas se tiver casos em estados diferentes — **sem duplicar linha** dentro da mesma aba.
3. `dias_parado` calculado e exibido (sem IA — só o número).
4. PERDIDO **não** aparece em Leads (view separada/filtro "Perdidos").

---

## Tasks / Subtasks

- [x] **Views/consultas** (AC: 1,2,4)
  - [x] Views `system_clients_leads` / `system_clients_clientes` / `system_clients_perdidos` (migration 0031) — pessoas distintas com >=1 caso no lifecycle; LEAD exclui `perdido_at`.
  - [x] Agrupamento por pessoa (JOIN agregado) — 1 linha por pessoa por aba.
  - [x] NÃO redefine `system_cases_active` (views novas só de leitura); grants anon/authenticated/service_role.
  - [x] Serviço `listClientsByLifecycle` consome `system_cases_active` (base tipada) + agrega em JS (evita dependência de view não-tipada no client).
- [x] **`dias_parado` / `status_lead`** (AC: 3)
  - [x] `dias_parado` derivado do último `status_changed_at` (LEAD/CLIENTE) ou `perdido_at` (PERDIDO), calculado na consulta (sem valor stale). Sem IA.
  - [x] `status_lead`: estrutura futura documentada (não persistida agora — fora do MVP, IA depois).
- [x] **UI abas** (AC: 1,2,4)
  - [x] Barra de abas Todos / Leads / Clientes / Perdidos em `clientes.index.tsx`; `dias_parado`/nº casos no card.
- [x] **Testes** (AC: 1-4) — views aplicadas + verificadas (11 leads distintos de 46 casos LEAD); typecheck/lint verdes.

---

## Dev Notes

**Arquivos a tocar:**
- Possível migration `20260702000003_views_leads_clientes.sql` (views derivadas) OU consultas no serviço.
- Serviço `clients-service` / `cases-service` (consultas por lifecycle).
- Front: telas/abas de listagem.

**Invariantes / riscos de regressão:**
- Uma pessoa LEAD no caso A + CLIENTE no caso B deve aparecer nas 2 abas, 1 linha por aba (Caso 1 da Matriz).
- Se tocar `system_cases_active`, recriar com grants (regra de ouro 2). Preferir views novas que apenas leem, sem redefinir a `system_cases_active`.
- `dias_parado` é derivado — não persistir valor stale; calcular na consulta.

### Testing
- Teste: pessoa com casos em estados diferentes aparece nas 2 abas sem duplicar.
- Teste: PERDIDO não aparece em Leads.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 1** (grupo A) — LEAD ⇄ CLIENTE simultâneos: pessoa LEAD no caso A e CLIENTE no caso B → aparece nas 2 abas, sem duplicar cadastro (S1-01 CA-7, S1-05).

---

## Dependências

- **Depende de:** S1-01 (lifecycle). Consome resultado de S1-04 (pessoa única).

---

## File List

- `sistema-hv/supabase/migrations/20260702000002_views_leads_clientes.sql` (+ rollback) — APLICADA.
- `sistema-hv/src/lib/clients-service.ts` — `listClientsByLifecycle` + `ClientWithLifecycleMeta`.
- `sistema-hv/src/rpc/clients.ts` — `listClientsByLifecycleFn`.
- `sistema-hv/src/hooks/useClients.ts` — `useClientsByLifecycle` + tipo `LifecycleTab`.
- `sistema-hv/src/routes/clientes.index.tsx` — abas + `dias_parado`.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 | @sm |
| 2026-07-02 | 1.0 | Views 0031 aplicadas + abas Leads/Clientes/Perdidos + dias_parado. Ready for Review | @dev |
