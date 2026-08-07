# Story F1: Financeiro como SUBMENU/módulo próprio dentro do caso (página isolada)

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** F1 (cobre F1 + F2 + F3 + F4 do levantamento)
**Status:** Ready for Review
**Estimativa relativa:** L
**Executor sugerido:** @dev (rota/UI + gate) + @data-engineer (migration da tabela de comentários) · Quality gate: @qa
**Risco:** MÉDIO — reorganiza a ficha do caso e move um bloco de $ existente; regressão possível na visibilidade financeira e na timeline.

---

## Story

**Como** advogado/operacional que abre a ficha de um caso — e como usuário do financeiro que precisa detalhar parcelas, faturas e comentários,
**quero** que o financeiro deixe de ser um bloco "espelhado integral" no meio da ficha comum e passe a ser um **submenu/módulo próprio** (página dedicada do caso), enquanto na ficha comum sobra só uma **linha de rastro financeiro** resumida,
**para que** (a) quem NÃO tem acesso financeiro não veja parcelas/valores/comentários; (b) a ficha operacional fique limpa (sem o bloco financeiro inteiro e sem eventos financeiros na timeline); e (c) o time financeiro tenha um espaço próprio com detalhamento de parcelas, geração de faturas, etapas próprias, sync ContaAzul/Asaas e um campo de comentários **exclusivo do financeiro**.

> **NOTA DE ESCOPO:** Muito do BACKEND financeiro já existe (parcelas, honorários, entrada no financeiro, sync ContaAzul/Asaas, relatório por caso). Esta story é sobre **ENCAPSULAR** o que existe como submenu isolado + aplicar o **gate de visibilidade** (`financeiro:view`) na navegação/página + **enxugar** a ficha comum (só rastro resumido) + **isolar** a timeline + criar UMA coisa nova: o **campo de comentários exclusivo do financeiro**. ContaAzul continua o ERP-fonte (juros/atraso calculados lá; o SHV só puxa/envia).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

**Ficha do caso (onde o bloco financeiro mora hoje):**
- `sistema-hv/src/routes/casos.$id.tsx` — a página do caso. O bloco financeiro "espelhado integral" está no card **"Rastro Financeiro"** (`:399-470`): mostra a etapa financeira (`finLabel`), botão "mover", "Fora do operacional" + "Trazer de volta ao operacional", "Enviar para o financeiro", e — quando `finBifurcated && podeVerFinanceiro` — monta `TermoPanel` (honorários/parcelas) + `AsaasCobrancasPanel` (cobranças) inteiros (`:460-467`). O gate de $ atual é `podeVerFinanceiro = podeVerValores(role, perms, values, "financeiro")` (`:127`).
- O botão "Enviar para o financeiro" (topo `:317-321` e dentro do card `:448-452`) + o popup duplicar/somente-financeiro (`:581-640`) usam `useEntrarFinanceiro`/`useVoltarOperacional` (`sistema-hv/src/hooks/usePipeline.ts`). Isso é FLUXO (não $) e é gate-ado por `podeFinanceiro = can(role, "financeiro.manage")` (`:116`).
- `TermoPanel` (`sistema-hv/src/components/cases/TermoPanel.tsx`) e `AsaasCobrancasPanel` (`sistema-hv/src/components/cases/AsaasCobrancasPanel.tsx`) — os dois blocos pesados que hoje aparecem inline na ficha. `NovaCobrancaDialog`, `CaseConferenciaFinPanel`, `CaseCardFin` complementam.

**Backend financeiro (fonte da verdade a reusar):**
- `sistema-hv/src/lib/financeiro-service.ts` — `getDashboardFinanceiro`, `listAllParcelas({clientId?, status?})`, `getRelatorioFinanceiroPorCaso`, `getClientPaymentStatus` (selo binário Em dia/Devendo — NÃO-SENSÍVEL, `requireAuth`).
- `sistema-hv/src/rpc/financeiro.ts` — todos os RPCs de $ passam por `handle(action, fn)` que exige `requireModule("financeiro", action)` (`:22-35`); leitura → `view`, escrita/sync → `edit`. `getClientPaymentStatusFn` é a exceção intencional (`requireAuth`, só boolean).
- **Parcelas / termo / honorários:** tabelas `system_parcelas`, `system_case_honorarios`, `system_case_financeiro`, `system_entrada_financeiro` (via `useTermo`/`useParcelas`; `useCaseHonorarios` em `casos.$id.tsx:131`).
- **Sync ERP:** `sistema-hv/src/lib/contaazul/service.ts` (`syncContaAzulPagamentos`, `criarContaAReceber`) e `sistema-hv/src/lib/asaas/service.ts` (`syncAsaasPagamentos`); RPC agregador `syncAllPagamentosFn` (`rpc/financeiro.ts:83`, gate `edit`); RPCs dedicados em `sistema-hv/src/rpc/contaazul.ts` e `sistema-hv/src/rpc/asaas.ts`. Cron das 08:30 (`api.cron.sync-contaazul.tsx`) chama o SERVICE direto (não os RPCs).

**Gate / RBAC (padrão a espelhar):**
- `sistema-hv/src/lib/rbac.ts` — módulo `financeiro` com régua base restrita (só `admin`/`financeiro` = `edit`; demais = `none`, `:300-302`); `permissaoEfetiva(role, overrides, "financeiro", action)` é a fonte única; overrides por usuário liberam quem precisar. `podeVerValores` (`:365`) e `MODULE_HAS_VALUES.financeiro=true` (`:347`).
- Hooks de UI: `useMyModulePerms`/`useMyModuleValues` (`sistema-hv/src/hooks/usePermissions.ts`) → `podeVerValores(...)` (já usado em `casos.$id.tsx:127`). `usePodeEditar("financeiro")` para gate de escrita.
- Server-side: `requireModule("financeiro", "view"|"edit")` (`sistema-hv/src/lib/supabase/auth-guard.ts:194`).

**Rotas aninhadas do caso (padrão de submenu):**
- Já EXISTEM sub-rotas do caso: `sistema-hv/src/routes/casos.$id.termo.tsx` e `casos.$id.termo.elaborar.tsx`. O padrão TanStack para submenu do caso é `casos.$id.<sub>.tsx` (ver memória `reference_tanstack_nested_routes`: rota com filhas precisa de layout `casos.$id.tsx` com `<Outlet/>` + `casos.$id.index.tsx`). **ATENÇÃO:** hoje `casos.$id.tsx` é a página cheia (não um layout com Outlet). Migrar para o padrão layout+index é a decisão de arquitetura desta story (ver Dev Notes / D-F1).

**Timeline (isolar eventos financeiros):**
- `sistema-hv/src/components/cases/CaseTimeline.tsx` — `renderEventLabel` (`:47-148`) mapeia TODOS os `system_case_events`, incluindo os financeiros: `fin_status_changed`, `fin_stage_auto_advanced`, `fin_enviado_conferencia`, `fin_conferencia_aprovada` (`:57-63`). A timeline lê `useCaseEvents(caseId)` sem filtro por natureza.

**Notas (molde para o campo de comentários do financeiro):**
- `sistema-hv/src/components/notes/NotesBlock.tsx` + `sistema-hv/src/hooks/useNotes.ts` + `sistema-hv/src/rpc/notes.ts` + tabela `system_case_notes` (types.ts `:1430`) + view `system_case_notes_active`. Hoje é `requireAuth` (qualquer autenticado). O comentário do financeiro é o MESMO padrão, porém **gate-ado por `financeiro`** e com um `scope='financeiro'` para separar dos comentários gerais.

### NOVO (a construir nesta story)

1. **Rota/submenu financeiro do caso** — página dedicada (ex. `sistema-hv/src/routes/casos.$id.financeiro.tsx`) que agrega detalhamento de parcelas + gerar faturas + etapas financeiras próprias + sync ContaAzul/Asaas + comentários do financeiro. **Toda a página** gate-ada por `financeiro:view` (server + client).
2. **Rastro financeiro RESUMIDO** na ficha comum: só **etapa + a pagar / vencido / pago** (uma linha/mini-card), visível só a quem tem `financeiro:view`. Remover o bloco `TermoPanel`+`AsaasCobrancasPanel` (espelhado integral) de dentro de `casos.$id.tsx`.
3. **Timeline sem eventos financeiros** no operacional: `CaseTimeline` filtra as `action` financeiras (as `fin_*`) da ficha comum; esses eventos (se exibidos) só aparecem dentro do submenu financeiro.
4. **Campo de comentários EXCLUSIVO do financeiro** — tabela `system_case_notes` ganha coluna `scope` (default `'geral'`) OU nova tabela `system_case_fin_comments`; RPC/service/hook/`NotesBlock` variante gate-ados por `financeiro`. Quem não tem `financeiro:view` não vê nem os comentários nem a aba.
5. **Sync ContaAzul/Asaas movido para dentro do módulo** — os botões/sync (`syncAllPagamentosFn`, `criarContaAReceber`, criar cliente no ERP) ficam na página do submenu financeiro, não espalhados na ficha comum.

---

## Acceptance Criteria

1. **Submenu financeiro (página própria).** Existe uma rota dedicada do caso (`/casos/$id/financeiro`) renderizada como submenu/aba do caso, contendo: (a) detalhamento de parcelas (reusa `listAllParcelas`/`useParcelas` + `TermoPanel`); (b) gerar faturas/cobranças (reusa `NovaCobrancaDialog`/`AsaasCobrancasPanel`/`criarContaAReceber`); (c) etapas financeiras próprias (o "mover" da pipeline financeira — reusa `MoveCaseFinDialog`); (d) sync ContaAzul/Asaas (reusa `syncAllPagamentosFn`); (e) o campo de comentários do financeiro (AC-6). A navegação para o submenu aparece na ficha do caso.

2. **Gate de visibilidade da página inteira.** A rota `/casos/$id/financeiro` só é acessível/visível a quem tem `financeiro:view` (via `permissaoEfetiva`). No servidor, todo RPC de dados da página exige `requireModule("financeiro", "view"|"edit")` (já é o caso em `rpc/financeiro.ts`; qualquer RPC novo desta story segue o mesmo `handle`). Usuário sem `financeiro:view` que acesse a URL direta recebe bloqueio (redireciona/estado "sem permissão"), nunca os valores.

3. **Ficha comum sem o bloco espelhado integral.** `TermoPanel` + `AsaasCobrancasPanel` deixam de ser montados inline em `casos.$id.tsx`. O card "Rastro Financeiro" passa a mostrar SÓ o resumo (AC-4), com um link/botão "Abrir financeiro" que leva ao submenu. Nenhum componente de $ pesado (parcelas/honorários/cobranças) é montado na ficha comum.

4. **Rastro financeiro RESUMIDO (etapa + a pagar/vencido/pago).** Na ficha comum, para quem tem `financeiro:view` e o caso está bifurcado (`macrostatus_fin != 'NAO_APLICAVEL'`), o card "Rastro Financeiro" mostra: a **etapa** financeira atual (`finLabel`) + os três totais **a pagar (pendente) / vencido / pago** do caso (derivados das parcelas do caso — mesma lógica de `getRelatorioFinanceiroPorCaso`, mas por caso). Quem NÃO tem `financeiro:view` não vê etapa nem valores (nem o card, ou vê só um placeholder neutro sem $).

5. **Timeline operacional não mistura eventos financeiros.** `CaseTimeline` na ficha comum NÃO exibe as `action` de natureza financeira (`fin_status_changed`, `fin_stage_auto_advanced`, `fin_enviado_conferencia`, `fin_conferencia_aprovada` — a lista completa de prefixos `fin_*`). Esses eventos, se exibidos em algum lugar, aparecem apenas dentro do submenu financeiro (para quem tem acesso). Nenhum outro evento (op/doc/tarefa/prazo) é afetado.

6. **Campo de comentários EXCLUSIVO do financeiro.** Existe um bloco de comentários dentro do submenu financeiro, separado das Notas gerais do caso. Ele é gate-ado por `financeiro` (leitura=`view`, escrita=`edit`) tanto na UI quanto no servidor. Comentários do financeiro NÃO aparecem no bloco de Notas gerais da ficha comum, e vice-versa. Quem não tem `financeiro:view` não lê os comentários do financeiro.

7. **Sync ContaAzul/Asaas dentro do módulo.** As ações de sync/criação no ERP (`syncAllPagamentosFn`, `criarContaAReceber`, criar cliente no ContaAzul/Asaas) ficam acessíveis a partir do submenu financeiro (não da ficha comum). ContaAzul permanece o ERP-fonte: o SHV só puxa (status/valor pago) e envia (conta a receber); juros/atraso continuam calculados no ContaAzul (nada de recálculo local de juros nesta story).

8. **Regressão / segurança.** `npm run typecheck` e `npm run lint` limpos. Nenhum valor $ vaza para papéis sem `financeiro:view` em nenhuma superfície (ficha comum, timeline, submenu). O selo binário "Em dia/Devendo" (`getClientPaymentStatusFn`, não-sensível) continua funcionando para o operacional. As rotas antigas do caso (`termo`, `termo.elaborar`) continuam resolvendo. Aplicar migration (se houver) via `npx tsx scripts/db-apply-pg.ts` 2× sem erro; rollback simétrico.

---

## Tasks / Subtasks

### T0 — Decisão de arquitetura (SPIKE — @architect/@dev, antes de codar)
- [x] **D-F1: layout+Outlet vs painel togglado.** Decidir se `casos.$id.tsx` vira um LAYOUT com `<Outlet/>` + `casos.$id.index.tsx` (ficha) + `casos.$id.financeiro.tsx` (submenu) — padrão TanStack aninhado (ver `reference_tanstack_nested_routes`), OU se o submenu é um painel/aba togglada dentro da mesma rota (sem nova rota). Recomendação SM: **rota aninhada** (URL própria, deep-link, gate na rota). Registrar a escolha e o impacto no routeTree.gen.ts (OneDrive trava — rebuild). (AC-1, AC-2)
- [x] **D-F2: comentários = coluna `scope` em `system_case_notes` vs tabela nova.** Recomendação SM: coluna `scope TEXT NOT NULL DEFAULT 'geral'` (aditivo, regressão zero — as notas existentes viram `'geral'`), com um `scope='financeiro'` para os comentários do financeiro. Menos superfície que uma tabela nova e reusa `notes-service`. (AC-6)

### T1 — Rota/submenu financeiro (@dev)
- [x] Criar `sistema-hv/src/routes/casos.$id.financeiro.tsx` (conforme D-F1) com `beforeLoad`/guard client que exige `financeiro:view` (usa `useMyModulePerms`/`permissaoEfetiva`). (AC-1, AC-2)
- [x] Mover para essa página: detalhamento de parcelas (`TermoPanel`), cobranças/faturas (`AsaasCobrancasPanel`, `NovaCobrancaDialog`), conferência (`CaseConferenciaFinPanel`), o "mover" financeiro (`MoveCaseFinDialog`), entrar/voltar financeiro. (AC-1, AC-3, AC-7)
- [x] Adicionar a navegação do submenu na ficha do caso (link/aba "Financeiro", só quando `financeiro:view`). (AC-1, AC-2)

### T2 — Enxugar a ficha comum + rastro resumido (@dev)
- [x] Em `casos.$id.tsx`, remover a montagem inline de `TermoPanel` + `AsaasCobrancasPanel` (`:460-467`). (AC-3)
- [x] Substituir o corpo do card "Rastro Financeiro" por: etapa (`finLabel`) + totais **a pagar/vencido/pago** do caso + botão "Abrir financeiro" → submenu. Só para `financeiro:view` + `finBifurcated`. (AC-3, AC-4)
- [x] Adicionar um resolvedor de totais por caso (reusar a lógica de `getRelatorioFinanceiroPorCaso` filtrando por `case_id`, ou um RPC leve `getRastroFinanceiroCaso(caseId)` com `handle("view", ...)`). (AC-4)

### T3 — Isolar a timeline (@dev)
- [x] Em `CaseTimeline.tsx` (ou no hook `useCaseEvents`), filtrar os eventos cuja `action` começa com `fin_` (ou lista explícita: `fin_status_changed`, `fin_stage_auto_advanced`, `fin_enviado_conferencia`, `fin_conferencia_aprovada`) na ficha comum. (AC-5)
- [x] (Opcional) Expor esses eventos numa mini-timeline dentro do submenu financeiro. (AC-5)

### T4 — Comentários do financeiro (@data-engineer + @dev)
- [x] Migration aditiva conforme D-F2: `ALTER TABLE system_case_notes ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'geral';` + recriar a view `system_case_notes_active` (`SELECT *`) + grants. Rollback simétrico (`DROP COLUMN IF EXISTS scope` + recria view). Aplicar via `npx tsx scripts/db-apply-pg.ts` (2×, idempotente). (AC-6)
- [x] `notes-service` + `rpc/notes.ts` + `useNotes` aceitam `scope`; listagem `case`+`scope='financeiro'` gate-ada por `requireModule("financeiro", "view")` e criação/edição/exclusão por `financeiro:edit`. A listagem geral filtra `scope='geral'` (regressão zero: notas antigas = `'geral'`). (AC-6)
- [x] Renderizar um `NotesBlock` (variante financeira, `scope='financeiro'`) dentro do submenu financeiro; garantir que as Notas gerais da ficha comum continuam só `'geral'`. (AC-6)
- [x] Regenerar `db:types` (bloco `system_case_notes` ganha `scope`). (AC-6)

### T5 — Sync ERP dentro do módulo (@dev)
- [x] Posicionar os controles de sync/criação no ERP (`syncAllPagamentosFn`, `criarContaAReceber`) no submenu financeiro. Confirmar que o cron das 08:30 (`api.cron.sync-contaazul.tsx`) NÃO é afetado (continua chamando o service direto). (AC-7)

### T6 — QA / regressão (@qa)
- [x] `npm run typecheck` + `npm run lint` verdes. (AC-8)
- [x] Matriz de visibilidade: admin/financeiro (com view) veem submenu + resumo + comentários; operacional/advogado (sem override) NÃO veem valores/comentários e não acessam a URL direta do submenu (403/redirect). Override `financeiro:view` num operacional → passa a ver. (AC-2, AC-4, AC-6)
- [x] Timeline da ficha comum sem eventos `fin_*`; demais eventos intactos. (AC-5)
- [x] Selo "Em dia/Devendo" ainda aparece para o operacional na ficha do cliente. (AC-8)
- [x] Migration 2× + rollback. (AC-8)

---

## Dev Notes

- **A régua financeira JÁ é restritiva.** `rbac.ts:300-302` força `financeiro` = `edit` só p/ `admin`/`financeiro`, `none` p/ os demais — então o gate correto para TUDO nesta página é `permissaoEfetiva(role, overrides, "financeiro", action)` (client) / `requireModule("financeiro", action)` (server). Não invente um gate novo. O operacional que HOJE vê `/casos/financeiro` no NAV NÃO vê valores por causa dessa régua (só o NAV, não os $). Overrides por usuário (`system_user_module_perms`) liberam quem precisar — precedência total.
- **Rota aninhada (D-F1):** ver memória `reference_tanstack_nested_routes` — rota com filhas exige `casos.$id.tsx` (layout com `<Outlet/>`) + `casos.$id.index.tsx` (a ficha atual). Migrar a página cheia de `casos.$id.tsx` para `casos.$id.index.tsx` e transformar `casos.$id.tsx` num layout fino que renderiza header + nav de submenus + `<Outlet/>`. As sub-rotas `casos.$id.termo.tsx`/`termo.elaborar.tsx` já existem e devem continuar resolvendo. **OneDrive trava o `routeTree.gen.ts`** — rebuild pode ser necessário.
- **Timeline (AC-5):** o filtro por prefixo `fin_` é o mais robusto (pega variações futuras). Se preferir lista explícita, os labels financeiros estão em `CaseTimeline.tsx:57-63`. Filtrar na CAMADA DE APRESENTAÇÃO (não apagar eventos do banco) — os `system_case_events` continuam gravados; só não são MOSTRADOS na ficha comum.
- **Comentários (D-F2):** reusar `system_case_notes` + coluna `scope` é o caminho de menor superfície e regressão zero (notas antigas = `'geral'`, aparecem no bloco geral como hoje). O gate muda por `scope`: listar `financeiro` exige `requireModule("financeiro","view")`. Molde de migration aditiva idempotente + view + grants: `20260804000001_tema_field_defs_hidden_in_filters.sql`.
- **Rastro resumido (AC-4):** os três totais (a pagar/vencido/pago) já são computados por caso em `getRelatorioFinanceiroPorCaso` (`financeiro-service.ts:189`) — extrair um helper por `case_id` ou um RPC leve `getRastroFinanceiroCaso(caseId)` com `handle("view", ...)`. NÃO expor o número para quem não tem `financeiro:view`.
- **ContaAzul = ERP-fonte (AC-7):** nada de calcular juros/multa localmente. O SHV puxa `status`/`valor_pago_centavos` (webhook/sync) e envia conta a receber (`criarContaAReceber`). Ver `project_plano_billing_contaazul_2026_07_10` na memória.
- **dev=prod:** migrations via `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/` (CLI Supabase quebrado no Windows/OneDrive — `reference_aplicar_migrations_pg_direto`).

**Riscos:**
- **R1 — vazamento de $ na migração de layout.** Ao mover blocos, é fácil deixar um total/parcela renderizando na ficha comum sem gate. Mitigação: matriz de visibilidade no QA (T6) e centralizar todo $ dentro do submenu gate-ado.
- **R2 — quebra de rota aninhada (routeTree).** Migrar para layout+index pode quebrar as rotas `termo`. Mitigação: rebuild do routeTree + smoke de navegação nas 3 sub-rotas.
- **R3 — comentários órfãos.** Se a migration de `scope` não recriar a view `_active`, o `scope` novo não aparece na view. Mitigação: recriar view (molde `hidden_in_filters`).

## Testing

- **Migration (DB):** aplicar a migration de `scope` 2× (idempotente); conferir coluna + view `_active` expõe `scope`; rollback + reaplicar. Notas antigas viram `scope='geral'`.
- **Gate (server):** chamar os RPCs do submenu como usuário sem `financeiro:view` → 403; como admin/financeiro → 200. Comentários `scope='financeiro'`: listar sem acesso → 403.
- **Gate (UI):** matriz papel×override — quem vê submenu/resumo/comentários e quem não vê (ver T6).
- **Ficha comum:** sem `TermoPanel`/`AsaasCobrancasPanel` inline; card "Rastro Financeiro" só resumo + "Abrir financeiro". Timeline sem `fin_*`.
- **Selo binário:** operacional ainda vê "Em dia/Devendo" na ficha do cliente (não regrediu).
- **Gates:** `npm run typecheck` + `npm run lint` limpos.

## Dependências

- **RBAC financeiro** (`rbac.ts` módulo `financeiro` + `requireModule` + `system_user_module_perms`) — JÁ existe; base do gate (épico R4). Ver `reference_rbac_edit_gate`.
- **Backend financeiro** (`financeiro-service.ts`, `rpc/financeiro.ts`, `TermoPanel`, `AsaasCobrancasPanel`, ContaAzul/Asaas) — JÁ existe; reuso.
- **Padrão de rota aninhada** (`reference_tanstack_nested_routes`) — para D-F1.
- **G1 (Judicial como submenu)** — story irmã: se ambas migram a ficha para layout+Outlet, coordenar a mesma decisão de arquitetura (D-F1) para não conflitar no `casos.$id.tsx`.
- Requer credenciais de banco em `.env.local` para `db-apply-pg.ts`.

## File List

**Novos**
- `sistema-hv/src/routes/casos.$id.financeiro.tsx` (submenu financeiro do caso)
- `sistema-hv/src/routes/casos.$id.index.tsx` (a ficha atual, se D-F1 = layout+Outlet)
- `sistema-hv/supabase/migrations/20260805XXXXXX_case_notes_scope.sql` (coluna `scope` + recria view + grants)
- `sistema-hv/supabase/rollbacks/20260805XXXXXX_case_notes_scope.rollback.sql`

**Alterados**
- `sistema-hv/src/routes/casos.$id.tsx` (vira layout fino com nav de submenus + `<Outlet/>`; remove bloco financeiro integral; rastro resumido)
- `sistema-hv/src/components/cases/CaseTimeline.tsx` (filtra eventos `fin_*` na ficha comum)
- `sistema-hv/src/lib/notes-service.ts` + `sistema-hv/src/rpc/notes.ts` + `sistema-hv/src/hooks/useNotes.ts` (`scope` + gate financeiro)
- `sistema-hv/src/lib/financeiro-service.ts` (helper/rastro por caso, se necessário)
- `sistema-hv/src/rpc/financeiro.ts` (RPC `getRastroFinanceiroCaso`, se necessário)
- `sistema-hv/src/lib/supabase/types.ts` (`system_case_notes` ganha `scope`)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). D-F1=layout+Outlet: `casos.$id.tsx` virou LAYOUT fino (breadcrumb + nav de submenus Ficha/Financeiro/Judicial/Termo + `<Outlet/>`); ficha movida p/ `casos.$id.index.tsx` (J2 CaseNameEditDialog + C3 useCaseOperationalTrail PRESERVADOS). Novo submenu `casos.$id.financeiro.tsx` (TermoPanel + AsaasCobrancasPanel + CaseConferenciaFinPanel + MoveCaseFinDialog + sync ContaAzul/Asaas + FinNotesBlock), gate `financeiro:view`. Rastro fin RESUMIDO na ficha (etapa + a pagar/vencido/pago via novo `getRastroFinanceiroCaso`/`getRastroFinanceiroCasoFn`, gate view). `TermoPanel`+`AsaasCobrancasPanel` REMOVIDOS inline da ficha. `CaseTimeline` filtra eventos `fin_*` (apresentação). D-F2=coluna `scope` em `system_case_notes` (migration `20260806000005_case_notes_scope.sql` + rollback; CHECK geral/financeiro; view `_active` recriada; APLICADA 2× idempotente); notes-service/rpc/hook aceitam scope; RPCs financeiros `listCaseFinNotesFn`/`createCaseFinNoteFn`/`updateCaseFinNoteFn`/`softDeleteCaseFinNoteFn` gate `financeiro`; comentário fin NÃO gera evento na timeline. types.ts atualizado. Gates: `tsc --noEmit`=0 nos arquivos tocados (só erro pré-existente `contaazul/service.ts`); `eslint` dos arquivos tocados=0. | @dev |
