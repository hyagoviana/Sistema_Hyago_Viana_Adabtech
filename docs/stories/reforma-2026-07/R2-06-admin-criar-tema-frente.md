# Story R2-06: Admin cria TEMA e vincula FRENTES (Drive + modelos + campos) — E2

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **Relaciona-se com fases:** 5a–5d (consome a estrutura; é a UI de administração do modelo)
- **ID:** R2-06
- **Status:** Ready for Review
- **Estimativa relativa:** M (CRUD admin de tema/frente + vínculo de pasta/modelo por frente; RBAC restrito)
- **Executor sugerido:** @dev · Quality gate: @architect
- **Risco:** MÉDIO (UI de configuração; escreve em tabelas de config, não em casos)

---

## Story

**Como** administrador,
**quero** criar um **TEMA** manualmente e, dentro dele, criar/vincular **FRENTES** (cada uma com pasta no Drive + modelos + campos), de forma **restrita** (só admin),
**para que** ao cadastrar um CASO o operador escolha tema+frente e o sistema já puxe as pastas/modelos/campos corretos.

> **DECISÃO TRAVADA (E2, doc-mestre §4.1, §4.2):** admin cria TEMA (universo próprio: pipeline op única, campos do tema, frentes); dentro do tema cria/vincula FRENTES (pasta Drive + modelos + campos opcionais). Criação de tema/frente é **restrita ao admin** (`config.manage`).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (UI de categoria hoje):** `pipeline.tsx` — "Nova categoria" cria `system_service_type` + semeia etapas (`ServiceTypeSelection`, `criarCategoria` `:120-139`); "Editar categoria" abre `CategoryFoldersEditor` para vincular pastas de caso/procuração (`:256-304`); gate `can(role, "config.manage")` (`:95`).
- **JÁ EXISTE (serviços):** `createServiceType`/`updateServiceType`/`deleteServiceType` (`pipeline-service.ts:38-225`); vínculo de pastas em `system_service_type_folders` (R2-04 adiciona `frente_slug`); sync de modelos por pasta (`useSetTypeTemplatesFolder`, `pipeline.tsx:432-480`).
- **JÁ EXISTE (RBAC):** `can(role,'config.manage')` — `src/lib/rbac.ts`.
- **NOVO:** telas/serviços de **TEMA** e **FRENTE** (CRUD sobre `system_temas`/`system_tema_frentes`); no editor de tema, subseção por frente para vincular pasta Drive + modelos + (estrutura de) campos (R2-07). Reaproveitar `CategoryFoldersEditor` passando `frente_slug`.

---

## Acceptance Criteria

1. ✅ Admin (`config.manage`) cria um TEMA (nome/slug/ordem) — grava em `system_temas`; não-admin não vê os controles (gate na UI) nem consegue via RPC (`requireRole(['admin'])` server-side).
2. ✅ Dentro do tema, admin cria/edita/remove FRENTES (`system_tema_frentes`): label/slug/ordem/active.
3. ⏭️ **Próxima fase R2-04.** Por frente, admin vincula pasta(s) do Drive com `frente_slug` — depende da coluna `frente_slug` em `system_service_type_folders` (ainda não criada). Gancho `// TODO(R2-04)` deixado em `tema-service.ts` (`createFrente`) e em `TemasManagerDialog.tsx` (`FrentesEditor`).
4. ⏭️ **Próxima fase R2-03.** Semear a pipeline op inicial do tema — depende do modelo de etapas por tema (R2-03). Gancho `// TODO(R2-03)` em `tema-service.ts` (`createTema`).
5. ✅ Gate RBAC restrito em **todos** os RPCs de escrita novos (`requireRole(['admin'])`), não só na UI. Leituras (`listTemas`/`listFrentes`) usam `requireAuth`.
6. ✅ Nenhuma tabela `system_cases` tocada (sem migration; sem recriar view). Dual-write intacto.
7. ✅ Compatibilidade: a UI de "categoria" legada segue intacta; a gestão de temas é uma seção admin nova ao lado dela, na mesma rota `/pipeline`.

---

## Tasks / Subtasks

- [x] **Serviço** — `tema-service.ts` (novo): `listTemas`/`createTema`/`updateTema`/`deleteTema`, `listFrentes`/`createFrente`/`updateFrente`/`deleteFrente` (idempotência de slug via check de UNIQUE + slug auto do nome; guardas de exclusão: tema com `system_cases.tema_id` e frente com `system_cases.frente_slug` → 409; tombstone de slug no delete do tema).
- [x] **RPC** — `rpc/temas.ts` (novo): leituras `requireAuth`; **escritas `requireRole(['admin'])`** (config.manage é admin-only no rbac). `// TODO(R3): requireModule("sistema","edit")`.
- [x] **UI Admin de Tema** — evoluída em `ServiceTypeSelection` (`pipeline.tsx`): botão "Temas" (admin-only) → `TemasManagerDialog` (novo): listar/criar/editar/excluir tema e, dentro do tema, listar/criar/editar/excluir frentes.
- [ ] **Seeding de pipeline** — ⏭️ próxima fase R2-03 (gancho `// TODO(R2-03)` em `createTema`).
- [x] **RBAC** — `canManage = can(role,'config.manage')` na UI (esconde o botão e não monta o dialog) + `requireRole(['admin'])` em todos os RPCs de escrita.
- [x] **Testes** — `npm run test:rbac` verde (regra base intacta). Guardas de exclusão cobertas por código (tema/frente com casos → 409); UI e RPC de escrita gateados.

---

## Dev Notes

**Arquivos a tocar:**
- NOVO `sistema-hv/src/lib/tema-service.ts` (ou extensão de `pipeline-service.ts`).
- NOVO `sistema-hv/src/rpc/temas.ts` (RPCs com gate).
- `sistema-hv/src/routes/pipeline.tsx` (ou nova rota de administração de temas).
- `sistema-hv/src/components/pipeline/CategoryFoldersEditor.tsx` (aceitar `frenteSlug`).
- hooks `usePipeline`/novo `useTemas`.

**Regras de ouro:**
- Criação de tema/frente **restrita** (`config.manage`) — gate na UI **e** no servidor (padrão `requireRole`, MEMORY `requirerole_status_bug`).
- Guarda de exclusão: frente/tema com casos vinculados não é apagável (molde `deleteServiceType:156-167`).
- Sem tocar `system_cases`/`system_cases_active`; trigger de bifurcação intocado.
- Reaproveitar componentes/serviços existentes (não duplicar `CategoryFoldersEditor`).

**Riscos de regressão:**
- **Vazamento de admin:** RPC sem gate deixa não-admin criar tema. Mitigação: `requireRole` server-side em todos os endpoints.
- **Coexistência categoria×tema:** durante a migração, criar tema E service_type pode duplicar seeds de etapa. Mitigação: definir claramente que, pós-R2, "categoria" = "tema" na UI; um único caminho de criação.
- **Frente órfã:** criar frente sem pasta e depois cadastrar caso nela → sem modelos. Mitigação: fallback por `case_type`/tema (R2-04) + aviso na UI.

## Testing

- Admin cria tema → aparece na seleção do Kanban/CaseFormDialog; não-admin não vê o botão e recebe 403 no RPC direto.
- Admin cria frente + vincula pasta → caso da frente lista os modelos daquela pasta.
- Excluir frente com caso vinculado → 409.
- `npm run typecheck` / `npm run lint` verdes.

## Dependências

- **Depende de:** R2-01 (estrutura), R2-04 (`frente_slug` em folders/checklist).
- **Habilita:** R2-05 (criação de caso escolhe tema+frente com dados reais), R2-07 (campos por frente configurados aqui).
- **Cruzamento com R3 (permissões):** o gate `config.manage` deve migrar para `permissaoEfetiva(...,'config'/'sistema','edit')` quando R3 entrar — deixar o ponto marcado.
- **BLOQUEADA parcialmente por PENDÊNCIA DO CLIENTE:** modelo final de temas/frentes (§9 item 1/2). A UI funciona vazia; o conteúdo depende do cliente.

## File List

- `sistema-hv/src/lib/tema-service.ts` (novo) — CRUD tema/frente + guardas de exclusão.
- `sistema-hv/src/rpc/temas.ts` (novo) — RPCs; escrita com `requireRole(['admin'])`, leitura `requireAuth`.
- `sistema-hv/src/hooks/useTemas.ts` (novo) — react-query queries/mutations.
- `sistema-hv/src/components/pipeline/TemasManagerDialog.tsx` (novo) — UI admin de tema→frente.
- `sistema-hv/src/routes/pipeline.tsx` (tocado) — botão "Temas" (admin) + render do dialog em `ServiceTypeSelection`.

## Dev Agent Record

**Agent:** @dev (James) · **Data:** 2026-07-18

**Onde plugou a UI:** rota `/pipeline`, dentro de `ServiceTypeSelection` (o mesmo lugar de "Nova categoria"). Botão "Temas" no header, visível só quando `can(role,"config.manage")`; o `TemasManagerDialog` também só é montado sob esse gate. Fluxo: abrir "Temas" → criar tema (ou clicar num tema existente) → editor do tema abre com renome + subseção "Frentes" (criar/renomear/excluir frente).

**Gate admin (UI + servidor):**
- UI: `pipeline.tsx` — `canManage = can(role,"config.manage")` (linha ~95); botão e `<TemasManagerDialog>` renderizados só se `canManage`.
- Servidor: `rpc/temas.ts` — `handleAdmin` chama `requireRole(["admin"])` antes de toda escrita (`createTemaFn`/`updateTemaFn`/`deleteTemaFn`/`createFrenteFn`/`updateFrenteFn`/`deleteFrenteFn`). Leituras (`listTemasFn`/`listFrentesFn`) usam `handle` → `requireAuth`.

**Guarda de exclusão:** `tema-service.ts` — `deleteTema` conta `system_cases` por `tema_id` (>0 → 409, molde `deleteServiceType:156-167`) e faz soft-delete das frentes + tombstone do slug; `deleteFrente` conta `system_cases` por (`tema_id`, `frente_slug`) (>0 → 409) e soft-deleta.

**TODOs de próxima fase:**
- `// TODO(R2-04)` (vínculo de pasta/modelos por frente via `frente_slug` em `system_service_type_folders`) — em `tema-service.ts` (`createFrente`) e `TemasManagerDialog.tsx` (`FrentesEditor`). Reusar `CategoryFoldersEditor` com prop `frenteSlug` quando a coluna existir.
- `// TODO(R2-03)` (seeding de pipeline op por tema) — em `tema-service.ts` (`createTema`).
- `// TODO(R3)` (migrar gate para `requireModule("sistema","edit")`) — em `rpc/temas.ts`.

**Validação:**
- `npm run typecheck`: sem erro novo nos arquivos criados/tocados (erros restantes são pré-existentes em `checklist-service.ts`/`dossie-service.ts`/`termo-service.ts`/`visibility.ts`/`casos.$id.tsx`/`casos.financeiro.index.tsx` — tabelas ausentes nos types gerados, não relacionados a esta story).
- `npx eslint` nos 5 arquivos: 0 problemas; `prettier --write` aplicado (LF).
- `npm run test:rbac`: verde.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — E2 (admin cria tema→frente) do épico R2 | @sm |
| 2026-07-18 | 0.2 | MVP da construção manual: tema-service + rpc/temas (gate admin) + useTemas + TemasManagerDialog plugado em pipeline.tsx. AC-1/2/5/6/7 done; AC-3→R2-04, AC-4→R2-03 (TODOs deixados). Status Ready for Review. | @dev |
