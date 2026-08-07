# Story G4: Campo "sigiloso" no caso + gate de visibilidade do Judicial (usuários autorizados)

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** G4
**Status:** Ready for Review
**Estimativa relativa:** M
**Executor sugerido:** @data-engineer (migration: flag + tabela de autorizados) + @dev (gate server + UI) · Quality gate: @qa
**Risco:** MÉDIO — controle de acesso (segurança); um gate frouxo VAZA dados sigilosos, um gate errado ESCONDE de quem devia ver.

---

## Story

**Como** administrador/responsável por um caso sensível,
**quero** marcar o caso como **"sigiloso"** e indicar quais usuários estão **autorizados**,
**para que** o submenu **Judicial** desse caso só seja visível aos usuários autorizados — enquanto a regra geral continua sendo "todos veem o Judicial, EXCETO quando o caso é sigiloso, aí só os indicados".

> **NOTA DE ESCOPO:** Esta story é **transversal ao G1** (Judicial como submenu). O G1 entrega o submenu Judicial e um **ponto de extensão** `podeVerJudicial(caseId, user)` que hoje retorna sempre `true`. G4 implementa: (1) a **flag `sigiloso`** no caso (coluna nova em `system_cases` — NÃO existe hoje); (2) a **lista de usuários autorizados** por caso (tabela nova); (3) o **gate no SERVIDOR** (não só na UI) que barra os dados judiciais de quem não é autorizado num caso sigiloso; (4) o gate na **navegação/UI** do submenu. O padrão de gate a espelhar já existe (`requireModule`/`permissaoEfetiva`), mas aqui a regra é **por-caso** (não por-módulo), então é uma verificação nova de "autorizado neste caso".

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (padrão a espelhar)

**RBAC / gates:**
- `sistema-hv/src/lib/rbac.ts` — `permissaoEfetiva`, `can`, régua por módulo. É gate **por-módulo**, não por-caso — G4 acrescenta um gate **por-caso** (autorização em caso sigiloso), complementar (admin sempre passa).
- `sistema-hv/src/lib/supabase/auth-guard.ts` — `requireAuth()` (`:90`), `requireRole()` (`:152`), `requireModule()`/`requireAnyModule()` (`:194`/`:228`). Todos retornam `{ id, email, role }`. **Molde do gate server:** cada guard faz `requireAuth` → lê `system_users` (role/status) → decide → `AuthError(403)` se negado. O gate por-caso de G4 acrescenta um passo: "OU admin, OU (não-sigiloso), OU (autorizado neste caso)".
- **Visibilidade por-caso JÁ existe como conceito** (`rbac.ts:96-107`): `seesOnlyOwnCases(role)` — advogados só veem casos vinculados a eles (criador/responsável/checklist). O sigilo é uma segunda camada, específica do submenu Judicial.

**Ponto de extensão (da story G1):**
- G1 deixa o guard do submenu Judicial chamando `podeVerJudicial(caseId, user)` (hoje `true`). G4 **substitui** essa função pela regra de sigilo (server + client). Esse é o contrato de integração entre as duas stories.

**Caso / tabelas:**
- `system_cases` (types.ts `:1268`) — **NÃO tem** coluna de sigilo hoje (colunas atuais: `responsavel`, `tem_pendencia_judicial`, `created_by`, ...). `sigiloso` é NOVO.
- `system_case_checklist_item_assignees` (N:N item↔usuário, memória `project_tarefas_e_multiresponsavel_2026_07_10`) e `system_case_responsaveis` (multi-responsável) são **moldes de tabela N:N caso/item↔usuário** — a tabela de autorizados do sigilo segue o mesmo padrão.
- `system_users` — fonte dos usuários (para o seletor de autorizados).

**UI:**
- `sistema-hv/src/routes/casos.$id.tsx` — ficha do caso (onde entra o toggle "sigiloso" + seletor de autorizados, gate-ado por quem pode gerir o caso / admin).
- Seletor multi-usuário: `AssigneeMultiSelect` (memória `project_tarefas_e_multiresponsavel_2026_07_10`) é o componente-molde para escolher os autorizados.

### NOVO (a construir nesta story)

1. **Coluna `sigiloso BOOLEAN NOT NULL DEFAULT FALSE`** em `system_cases` (aditivo, regressão zero — todos os casos existentes = não-sigiloso = todos veem).
2. **Tabela `system_case_sigilo_users`** (N:N caso↔usuário autorizado) — `case_id`, `user_id`, `created_at`/`created_by`, RLS org-scoped, UNIQUE `(case_id, user_id)`.
3. **Função de autorização por-caso** `isAutorizadoJudicial(caseId, userId, role)` (server) + `podeVerJudicial` (client) — regra: **admin sempre** OU **caso não-sigiloso** OU **usuário na lista de autorizados** (o responsável/criador do caso também é autorizado por padrão — a confirmar em D-G4).
4. **Gate no SERVIDOR** — os RPCs de dados judiciais (da story G1: `syncCaseJudicialFn`, leituras do espelho) passam a exigir a autorização por-caso antes de devolver dados. Não basta esconder na UI.
5. **UI** — toggle "Sigiloso" + seletor de usuários autorizados na ficha (para admin/quem gere o caso); o submenu Judicial some da navegação para não-autorizados em caso sigiloso.

---

## Acceptance Criteria

1. **Migration aditiva idempotente.** `sistema-hv/supabase/migrations/20260805XXXXXX_case_sigiloso.sql` adiciona `sigiloso BOOLEAN NOT NULL DEFAULT FALSE` a `system_cases` (via `ADD COLUMN IF NOT EXISTS`) e cria `system_case_sigilo_users` (`id`, `case_id` FK, `user_id` FK, `created_at`, `created_by`, UNIQUE `(case_id, user_id)`, RLS org-scoped). Rodar 2× sem erro. Rollback simétrico (`DROP TABLE IF EXISTS system_case_sigilo_users` + `ALTER TABLE system_cases DROP COLUMN IF EXISTS sigiloso`). `db:types` regenerado.

2. **Regra de autorização (server, fonte única).** Existe `isAutorizadoJudicial(caseId, userId, role)` server-side com a regra: **`true` se** (a) role é `admin`; OU (b) o caso **não** é sigiloso; OU (c) o `userId` está em `system_case_sigilo_users` para o `case_id`. (D-G4 decide se criador/responsável do caso entram automaticamente na lista.) É a **fonte única** consumida pelo gate server e refletida no client.

3. **Gate no SERVIDOR (não só UI).** Todos os RPCs que devolvem dados judiciais do caso (os da story G1: sync + leituras do espelho + andamentos) chamam `isAutorizadoJudicial` e retornam `AuthError(403)` quando o usuário não é autorizado num caso sigiloso. Uma chamada direta ao RPC (sem passar pela UI) de um usuário não-autorizado é **barrada** (não devolve tarefas/andamentos/resumo).

4. **Regra geral preservada (não-sigiloso = todos veem).** Para casos **não** sigilosos (o padrão, `sigiloso=false`), o submenu Judicial continua visível a todos os autenticados (regressão zero em relação ao G1). Nenhum caso existente fica escondido após a migration (default `false`).

5. **Caso sigiloso esconde o Judicial dos não-autorizados (UI).** Marcado `sigiloso=true`, o submenu/aba/rastro Judicial **não aparece** na navegação nem na ficha para usuários fora da lista de autorizados (exceto admin). Para os autorizados (e admin), aparece normalmente. A UI usa `podeVerJudicial` (reflexo client da regra do AC-2) — mas a segurança real é o AC-3 (servidor).

6. **Gestão do sigilo (toggle + autorizados).** Na ficha do caso, quem pode gerir o caso (admin / `casos.manage`) vê um toggle **"Sigiloso"** e, quando ligado, um seletor multi-usuário (`AssigneeMultiSelect`-like) para indicar os autorizados. Alterações persistem (RPC gate-ado: só admin/gestor do caso muda o sigilo). Ligar/desligar e adicionar/remover autorizados reflete imediatamente na visibilidade.

7. **`podeVerJudicial` da G1 substituída.** O ponto de extensão deixado pela story G1 (`podeVerJudicial` retornando `true`) passa a delegar para a regra de sigilo (client) e o gate server para `isAutorizadoJudicial`. Sem G1 mergeada, esta story entrega a função + migration + gestão, prontas para plugar.

8. **Regressão / segurança.** `npm run typecheck` + `npm run lint` limpos; `db:types` regenerado; RLS org-scoped na tabela nova. Nenhum dado judicial de caso sigiloso vaza para não-autorizado em NENHUMA superfície (nav, ficha, RPC direto, sync). Admin nunca é bloqueado. Migration 2× + rollback.

---

## Tasks / Subtasks

### T0 — Design (SPIKE — @architect/@dev)
- [x] **D-G4: quem é autorizado "por padrão".** Decidir se o **criador** (`created_by`) e/ou o **responsável** (`responsavel`/`system_case_responsaveis`) do caso entram automaticamente como autorizados (recomendação SM: sim — senão quem marcou o sigilo pode se auto-trancar). Registrar. (AC-2)
- [x] Confirmar que o gate por-caso é **complementar** ao gate por-módulo/`seesOnlyOwnCases` (não substitui): admin sempre passa; sigilo só afeta o Judicial. (AC-2, AC-4)

### T1 — Migration (@data-engineer)
- [x] `20260805XXXXXX_case_sigiloso.sql`: `ADD COLUMN IF NOT EXISTS sigiloso BOOLEAN NOT NULL DEFAULT FALSE` em `system_cases`; `CREATE TABLE IF NOT EXISTS system_case_sigilo_users (...)` com FKs, UNIQUE `(case_id, user_id)`, `created_by`, `created_at`, RLS org-scoped (espelhar o padrão de `system_case_responsaveis`/assignees). (AC-1)
- [x] Rollback simétrico. Aplicar via `npx tsx scripts/db-apply-pg.ts` (2×, idempotente). `db:types`. (AC-1, AC-8)

### T2 — Regra de autorização + gate server (@dev)
- [x] `isAutorizadoJudicial(caseId, userId, role)` (server) conforme AC-2 + D-G4. Lê `system_cases.sigiloso` + `system_case_sigilo_users` (+ criador/responsável se D-G4). (AC-2)
- [x] Novo guard/helper (ex. `requireJudicial(caseId)` em `auth-guard.ts` ou no `rpc/judicial.ts`) que faz `requireAuth` → resolve role → `isAutorizadoJudicial` → `AuthError(403)` se negado. Aplicar em TODOS os RPCs judiciais da G1. (AC-3)

### T3 — Reflexo no client + `podeVerJudicial` (@dev)
- [x] Hook `usePodeVerJudicial(caseId)` (client) que espelha a regra (lê `sigiloso` + autorizados do caso + role/id do usuário) e substitui o `podeVerJudicial` stub da G1. (AC-5, AC-7)
- [x] Nav/aba/rastro Judicial em `casos.$id.tsx` respeita `usePodeVerJudicial`. (AC-5)

### T4 — Gestão do sigilo (UI) (@dev)
- [x] Toggle "Sigiloso" na ficha do caso (só admin/`casos.manage`) + seletor multi-usuário de autorizados (`AssigneeMultiSelect`-like sobre `system_users`). RPC `setCaseSigilo(caseId, sigiloso, userIds[])` gate-ado (só admin/gestor do caso). (AC-6)
- [x] Persistência N:N em `system_case_sigilo_users` (add/remove). (AC-6)

### T5 — QA / regressão (@qa)
- [x] `npm run typecheck` + `npm run lint` verdes; `db:types` ok. (AC-8)
- [x] Matriz: caso NÃO-sigiloso → todos veem Judicial (AC-4). Caso sigiloso → só admin + autorizados veem; não-autorizado não vê na UI **e** recebe 403 no RPC direto (AC-3, AC-5). Criador/responsável conforme D-G4.
- [x] RLS: outra org não lê `system_case_sigilo_users`. (AC-8)
- [x] Migration 2× + rollback; casos existentes seguem visíveis (default false). (AC-1, AC-4)

---

## Dev Notes

- **Gate por-CASO, não por-módulo.** `requireModule` é por-módulo — insuficiente aqui. A regra do sigilo é "este usuário está autorizado NESTE caso?". Modele como um helper novo que combina `requireAuth` (molde `auth-guard.ts:90`) + consulta ao caso + tabela de autorizados. **Admin sempre passa** (nunca trancar o admin — igual às demais regras do RBAC).
- **Segurança é no SERVIDOR (AC-3).** Esconder o menu na UI não basta — um usuário pode chamar o RPC direto. Todo RPC judicial (G1) tem que passar por `isAutorizadoJudicial`. A UI é conforto; o 403 é a garantia.
- **Molde de tabela N:N + RLS:** `system_case_responsaveis` / `system_case_checklist_item_assignees` (memórias `project_rbac_visibilidade_checklist_2026_07_09` e `project_tarefas_e_multiresponsavel_2026_07_10`). Copiar o padrão de FK + UNIQUE + RLS org-scoped + `created_by`.
- **Molde de migration aditiva idempotente:** `20260804000001_tema_field_defs_hidden_in_filters.sql` (ADD COLUMN IF NOT EXISTS + view/grants) e as migrations `system_case_*` recentes. Para a TABELA nova, `CREATE TABLE IF NOT EXISTS` + policies.
- **D-G4 (auto-autorizados):** recomendação forte de incluir `created_by` e responsáveis — evita o "auto-trancamento" (quem marca o sigilo perde o próprio acesso). Se não incluir, a UI deve pré-selecionar o próprio usuário ao ligar o toggle.
- **Integração com G1:** G1 entrega `podeVerJudicial` = `true` e os RPCs judiciais. G4 troca a implementação e injeta o gate nos RPCs. Se G4 for antes de G1 mergeada, entregar a migration + `isAutorizadoJudicial` + gestão; o plug nos RPCs fecha quando G1 existir. Coordenar a ordem (ver Dependências).
- **`seesOnlyOwnCases` é ortogonal.** Um advogado que só vê os próprios casos já nem chega num caso alheio; o sigilo é uma segunda trava, específica do Judicial, que vale inclusive entre pessoas que veem o caso.
- **dev=prod:** migrations via `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/` (`reference_aplicar_migrations_pg_direto`).

**Riscos:**
- **R1 — vazamento (gate só na UI).** Mitigação: AC-3 exige gate server em todo RPC judicial; QA testa RPC direto de não-autorizado.
- **R2 — auto-trancamento.** Quem liga o sigilo sem se incluir perde acesso. Mitigação: D-G4 (auto-incluir criador/responsável) + pré-seleção na UI.
- **R3 — admin bloqueado.** Um bug na regra pode trancar o admin. Mitigação: `admin` é o primeiro `return true` da regra; teste explícito.
- **R4 — ordem com G1.** G4 depende do submenu/RPCs judiciais existirem para injetar o gate. Mitigação: entregar a base (migration + regra + gestão) independente; plug final coordenado com G1.

## Testing

- **DDL:** migration 2× (idempotente); `system_case_sigilo_users` com RLS; rollback + reaplicar. Casos existentes → `sigiloso=false` (todos veem).
- **Regra (unit):** `isAutorizadoJudicial` — admin→true; não-sigiloso→true; sigiloso + na lista→true; sigiloso + fora da lista→false; criador/responsável conforme D-G4.
- **Gate server:** RPC judicial chamado por não-autorizado em caso sigiloso → 403; por autorizado/admin → 200. (chamada direta, sem UI.)
- **UI:** toggle "Sigiloso" + autorizados só p/ admin/gestor; submenu Judicial some p/ não-autorizados em caso sigiloso; aparece p/ autorizados+admin; caso não-sigiloso inalterado.
- **RLS:** outra org não lê a tabela de autorizados.
- **Gates:** `npm run typecheck` + `npm run lint` verdes; `db:types` regenerado.

## Dependências

- **Story G1 (Judicial como submenu)** — G4 é transversal: injeta o gate nos RPCs judiciais e substitui `podeVerJudicial`. G1 deve deixar o ponto de extensão pronto. **Ordem recomendada:** G1 primeiro (ou em paralelo com o contrato `podeVerJudicial` acordado).
- **RBAC/`auth-guard`** (`requireAuth`, padrão dos guards) — molde do gate server.
- **`system_users`** — fonte dos autorizados (seletor).
- **Moldes N:N** (`system_case_responsaveis`, `system_case_checklist_item_assignees`) — padrão da tabela + RLS.
- **`AssigneeMultiSelect`** — componente do seletor multi-usuário.
- Requer credenciais de banco em `.env.local` para `db-apply-pg.ts`.

## File List

**Novos**
- `sistema-hv/supabase/migrations/20260805XXXXXX_case_sigiloso.sql` (coluna `sigiloso` + `system_case_sigilo_users` + RLS)
- `sistema-hv/supabase/rollbacks/20260805XXXXXX_case_sigiloso.rollback.sql`
- `sistema-hv/src/lib/judicial-authz.ts` (ou em `auth-guard.ts`) — `isAutorizadoJudicial` + guard `requireJudicial(caseId)`
- `sistema-hv/src/hooks/usePodeVerJudicial.ts`
- `sistema-hv/src/components/cases/CaseSigiloSection.tsx` (toggle + seletor de autorizados)

**Alterados**
- `sistema-hv/src/lib/supabase/types.ts` (`system_cases.sigiloso` + `system_case_sigilo_users`)
- `sistema-hv/src/rpc/judicial.ts` (injeta `requireJudicial` nos RPCs — da G1)
- `sistema-hv/src/rpc/cases.ts` (RPC `setCaseSigilo` — gate admin/gestor do caso)
- `sistema-hv/src/routes/casos.$id.tsx` (seção de sigilo + nav Judicial via `usePodeVerJudicial`)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Migration `20260806000007_case_sigiloso.sql` (+rollback; APLICADA 2× idempotente): `system_cases.sigiloso BOOLEAN NOT NULL DEFAULT FALSE` + `system_case_sigilo_users` (N:N, UNIQUE case_id+user_id, FK system_users, RLS org-scoped). Fonte única `isAutorizadoJudicial(caseId,userId,role)` server (`src/lib/judicial-authz.ts`): admin sempre OU não-sigiloso OU criador/responsável/system_case_responsaveis OU em system_case_sigilo_users (D-G4=criador+responsável auto-autorizados). Guard `requireJudicial(caseId)` aplicado em TODOS os RPCs judiciais da G1 (`rpc/judicial.ts`) → 403 no servidor a não-autorizado em caso sigiloso (não só UI). Reflexo client `usePodeVerJudicial` (`src/hooks/usePodeVerJudicial.ts`) substitui o stub `podeVerJudicial` da G1 — nav do submenu (layout `casos.$id.tsx`) + card Judicial na ficha respeitam. Gestão: `CaseSigiloSection` (toggle + seletor multi-usuário de system_users, pré-seleciona o próprio ao ligar) na ficha só p/ gestor (operacional:edit); RPC `setCaseSigiloFn` (gate `handleManage`=operacional:edit/admin) + service `setCaseSigilo` reconcilia a N:N. types.ts atualizado. Gates: `tsc`=0 nos tocados (só erro pré-existente contaazul); `eslint`=0. | @dev |
