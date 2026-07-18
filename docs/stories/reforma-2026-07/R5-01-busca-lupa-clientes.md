# Story R5-01: Bug B1 — campo de busca (lupa) do roster de clientes não funciona

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-01
- **Status:** Draft
- **Estimativa relativa:** S (bug de front — fiação da busca; opcionalmente ligar busca server-side)
- **Executor sugerido:** @dev · Quality gate: @qa
- **Item do documento-mestre:** §8 **B1** — "busca/lupa não funciona · investigar `system_search_clients()` + input"

---

## Story

**Como** operador que procura um cliente pela lupa no roster,
**quero** que digitar um termo filtre a lista imediatamente (nome, CPF, e-mail, município, dados profissionais e campos adicionais),
**para que** eu ache a pessoa sem precisar rolar a lista inteira nem selecionar um "chip" de campo antes.

---

## Contexto / o que JÁ EXISTE vs NOVO (arquivo:linha)

- **JÁ EXISTE (função SQL de busca ampla):** `system_search_clients(p_term)` cobre nome, CPF, RG, e-mail, telefone, endereço/município (JSONB), `custom_fields` e `professional_data` — `sistema-hv/supabase/migrations/20260622000004_search_clients_address.sql:9-37`. **Funciona**, mas hoje só é chamada por `listClients(search)` (`sistema-hv/src/lib/clients-service.ts:498-508`) via `useClientsList(search)` (`sistema-hv/src/hooks/useClients.ts:22-29`).
- **ROOT CAUSE (bug):** o roster (`sistema-hv/src/components/clients/ClientRoster.tsx`) NÃO usa `useClientsList`. Ele lê por lifecycle com `useClientsByLifecycle(tab)` (`ClientRoster.tsx:138`), hook que **não recebe termo de busca** (`useClients.ts:32-38`). O filtro por termo só é aplicado no `useMemo` `filtered` **quando há campos-chip marcados** (`ClientRoster.tsx:154-165`, condição `if (term && searchFields.length > 0)`). Sem chip marcado → o termo é ignorado e a lista não filtra. É exatamente o "a lupa não funciona" do Hyago.
- **NOVO:** aplicar o termo na busca ampla mesmo **sem** chip selecionado (broad match client-side sobre os campos padrão OU delegar ao `system_search_clients` server-side interseccionando com o lifecycle da aba).

> **DECISÃO A CONFIRMAR (mínima):** a correção mais barata e sem regressão é **broad match client-side** — quando `search` tem termo e `searchFields.length === 0`, filtrar sobre o conjunto padrão (nome, CPF, e-mail, município, profissional, custom_fields), reaproveitando `matchField`/`SEARCH_FIELDS` já existentes. Ligar o server-side `system_search_clients` fica como opção se precisar cobrir bases grandes (paginação), mas exige interseccionar com o filtro de lifecycle da aba (a função retorna `SETOF system_clients` cru, sem recorte por lifecycle).

---

## Acceptance Criteria

1. Digitar um termo na lupa **sem** marcar nenhum chip de campo filtra a lista de clientes por match amplo (ao menos nome, CPF, e-mail, município e campos adicionais), respeitando a aba/lifecycle vigente.
2. Marcar um ou mais chips de campo continua restringindo a busca a esses campos (comportamento atual preservado).
3. Termo vazio volta a mostrar a lista completa da aba; o "vazio" mostra o estado "nenhum resultado" só quando de fato não há match.
4. Sem regressão nas abas Todos/Leads/Clientes/Perdidos (`inteligencia.leads`) nem na aba "Clientes" da Operação (`clientes.index`, `fixedLifecycle`).

---

## Tasks / Subtasks

- [ ] **Front** — em `ClientRoster.tsx`, ajustar o `useMemo` `filtered` (linhas 154-165): quando `term` existe e `searchFields.length === 0`, aplicar match amplo usando **todos** os `SEARCH_FIELDS` (ou o subconjunto padrão) via `matchField`, em vez de não filtrar.
- [ ] **Opcional (server-side)** — se o owner quiser busca server-side por base grande: parametrizar `useClientsByLifecycle` para aceitar `search` e, no serviço, interseccionar `system_search_clients(term)` com o filtro de lifecycle da aba (não usar a função crua sem recorte). Manter fallback client-side.
- [ ] **Testes** (AC 1-4) — busca por nome/CPF/município sem chip retorna o cliente; chip marcado restringe; termo vazio mostra tudo; abas preservadas. `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/components/clients/ClientRoster.tsx` (fiação do `filtered`).
- (opcional) `sistema-hv/src/hooks/useClients.ts` + `sistema-hv/src/lib/clients-service.ts` se ligar server-side.

**Regras de ouro pertinentes:**
- Bug de **front** — não precisa de migration. Se optar por server-side, `system_search_clients` já existe (não recriar); interseccionar com lifecycle **na aplicação** para não vazar leads na aba de clientes.
- `system_search_clients` retorna `SETOF system_clients` (cru, sem lifecycle nem `deleted_at IS NULL` além do próprio filtro interno) — validar recorte antes de trocar a fonte do roster.

### Testing
- Digitar "londrina" (município no JSONB `address`) sem chip → lista filtra pelos clientes de Londrina.
- Digitar CPF parcial sem chip → filtra por CPF (dígitos).
- Marcar chip "Nome" → restringe só a nome.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** nada (quick win independente).
- **Cruzamentos:** nenhum com R2/R4. Isolado no front do roster.
- **Habilita:** UX de busca correta para o restante do bloco B5.

---

## File List

- `sistema-hv/src/components/clients/ClientRoster.tsx`
- (opcional) `sistema-hv/src/hooks/useClients.ts`, `sistema-hv/src/lib/clients-service.ts`

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — bug B1 busca/lupa | @sm |
