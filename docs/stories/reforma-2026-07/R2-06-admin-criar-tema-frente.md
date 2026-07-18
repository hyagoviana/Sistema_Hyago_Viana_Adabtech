# Story R2-06: Admin cria TEMA e vincula FRENTES (Drive + modelos + campos) — E2

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **Relaciona-se com fases:** 5a–5d (consome a estrutura; é a UI de administração do modelo)
- **ID:** R2-06
- **Status:** Draft
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

1. Admin (`config.manage`) cria um TEMA (nome/slug/ordem) — grava em `system_temas`; não-admin não vê os controles nem consegue via RPC (gate server-side).
2. Dentro do tema, admin cria/edita/remove FRENTES (`system_tema_frentes`): nome/label/slug/ordem/active.
3. Por frente, admin vincula pasta(s) do Drive (kind caso/procuração) — grava `system_service_type_folders` com `frente_slug` (R2-04); modelos daquela pasta são sincronizados e passam a aparecer só para casos daquela frente.
4. A criação de TEMA semeia a pipeline op inicial (conjunto consolidado) — reaproveitar o seeding de etapas de `createServiceType` adaptado ao modelo por tema.
5. Gate RBAC restrito em **todos** os RPCs novos (`requireRole`/`requireAuth`+`config.manage`), não só na UI.
6. Nenhuma tabela `system_cases` tocada aqui (sem migration de coluna nova; sem recriar view). Dual-write intacto.
7. Compatibilidade: durante a migração, a tela "categoria" legada e a tela "tema" coexistem (ou a de tema envolve a de categoria) sem quebrar a criação de casos.

---

## Tasks / Subtasks

- [ ] **Serviço** — `tema-service.ts` (novo) ou estender `pipeline-service.ts`: `createTema`/`updateTema`/`deleteTema`, `createFrente`/`updateFrente`/`deleteFrente` (idempotência, guardas de exclusão: frente com casos não some).
- [ ] **RPC** — endpoints com gate `config.manage` (server-side).
- [ ] **UI Admin de Tema** — nova rota/aba (ou evoluir `ServiceTypeSelection`): listar temas, criar tema, editar tema (frentes + pastas por frente). Reusar `CategoryFoldersEditor` com prop `frenteSlug`.
- [ ] **Seeding de pipeline** — ao criar tema, semear etapas op consolidadas (adaptar `createServiceType:60-109`).
- [ ] **RBAC** — `canManage = can(role,'config.manage')` na UI + `requireRole` nos RPCs.
- [ ] **Testes** (AC: 1-5) — não-admin bloqueado (UI + RPC); frente com caso não pode ser excluída.

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

- `sistema-hv/src/lib/tema-service.ts` (novo)
- `sistema-hv/src/rpc/temas.ts` (novo)
- `sistema-hv/src/hooks/useTemas.ts` (novo)
- `sistema-hv/src/routes/pipeline.tsx` (ou nova rota de admin de temas)
- `sistema-hv/src/components/pipeline/CategoryFoldersEditor.tsx`

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — E2 (admin cria tema→frente) do épico R2 | @sm |
