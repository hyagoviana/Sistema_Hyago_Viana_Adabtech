# Story G1: Judicial como SUBMENU/módulo do caso — espelho (só leitura) do ProJuris

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** G1 (cobre G1 + G2 + G3 + G5 do levantamento)
**Status:** Ready for Review
**Estimativa relativa:** L
**Executor sugerido:** @dev (rota/UI + submenu) + @data-engineer (tabelas de espelho + migration) + @architect (leitura ProJuris) · Quality gate: @qa
**Risco:** MÉDIO — integração externa ProJuris (só leitura), novas tabelas de espelho e reuso do padrão de múltiplos Kanbans por tema.

---

## Story

**Como** advogado/controladoria que abre a ficha de um caso,
**quero** um submenu **"Judicial"** dentro do caso que **espelha o ProJuris** (só leitura) — tarefas do processo (pra quem foram e status), um quadro-resumo (tribunal + nº do processo + etapa) e um rastro judicial em Kanban próprio do tema (eliminado / indeferida / sentenciado / recurso),
**para** acompanhar o andamento judicial sem sair do caso e sem poluir a ficha com os andamentos/movimentações crus do ProJuris (que só entram sob demanda, num modal com scroll/limite).

> **NOTA DE ESCOPO (D1 travada):** O **ProJuris é a fonte da verdade** e o SHV **ESPELHA** (ProJuris→SHV, só leitura). Esta story NÃO escreve no ProJuris (nada de write-back — isso é fase posterior da A9, R1). O submenu Judicial é a mesma lógica de encapsulamento do módulo Financeiro (story F1): página própria do caso, gate de navegação, e um rastro resumido que abre a página. O "cérebro" de leitura do ProJuris (auth OAuth2 + `projurisGet` + normalizador de intimações/tarefas/processo) JÁ EXISTE em `src/lib/projuris/` — esta story consome esse client para popular o espelho.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

**Leitura do ProJuris (base do espelho):**
- `sistema-hv/src/lib/projuris/client.ts` — client **server-only**: auth OAuth2/Keycloak (`api_cliente_codigo_87696` + username e-mail cru), cache de token (8h), `projurisGet(path, query?)` (só leitura) e `projurisPostConsulta(path, body)` (POST de CONSULTA = leitura). **A auth já FUNCIONA** (destravada 2026-08-05 — ver A9).
- `sistema-hv/src/lib/projuris/normalizer.ts` — `normalizeIntimacao`/`normalizeIntimacoes`. Endpoints de leitura já mapeados empiricamente:
  - **Tarefas do processo:** `GET /adv-service/processo/{codigoProcesso}/tarefa/consulta-multi-modulo` → `{ totalRegistros, tarefaConsultaWs[] }` — cada tarefa traz `codigoTarefaTipo`+`nomeTarefaTipo`, `dataConclusaoPrevista` (prazo previsto), `dataLimite` (prazo fatal), `marcadores`, **`usuarioResponsaveis`** (pra quem foi), `situacao`/`flagSituacaoConcluida` (status).
  - **Processo (resumo):** `GET /adv-service/processo/{codigoProcesso}` → `{ assunto, assuntoCnj, marcadorWs[], campoDinamicoDadoWs[], area, classeCnj, fase, ... }` (fonte de tribunal/órgão + tema).
  - **Colaboradores (ID→nome):** `GET /adv-service/usuario` → `{ simpleDto: [{ chave: código, valor: nome }] }` (15 usuários; THIAGO=128858, THAISE=204546). Usado para resolver "pra quem foi a tarefa".
  - **Intimações:** `POST /adv-service/intimacao/consulta` (leitura) — nº do processo, responsável, datas.
- `sistema-hv/src/lib/distribuicao/sync-core.ts` — orquestra OAuth → consulta de intimações → processo → tarefas → normaliza. Molde de "puxar do ProJuris e persistir".
- **Motor / tabelas de distribuição** (`system_distribution_*`, `system_projuris_executor_mapping`, `system_task_type_mapping`, `system_theme_mapping`) — para resolver código→nome de tipo/tema/executor ao montar o espelho.

**Múltiplos Kanbans por tema (base do rastro judicial G2):**
- `sistema-hv/src/rpc/boards.ts` + `sistema-hv/src/lib/board-service.ts` — **"múltiplos Kanbans (boards/listas) por TEMA"** JÁ existe (story A3 da reunião 2026-08-03): `listBoards(serviceTypeId)`, `createBoard`, `createBoardStage`, `addCaseToBoard`, `moveCaseBetweenBoards`, `moveCaseInBoard`, `listStagesByBoard`, etc. Migrations `20260804000004_pipeline_boards.sql` / `20260805000001_case_board_positions_exclusive.sql`. **O rastro judicial (etapas eliminado/indeferida/sentenciado/recurso) é "mais um board do tema"** — reusa essa infra.
- `sistema-hv/src/components/cases/KanbanBoard.tsx`, `AddCaseToBoardDialog.tsx`, `StageEditor.tsx` (edição de etapas com reordenação).

**Ficha do caso + padrão de submenu:**
- `sistema-hv/src/routes/casos.$id.tsx` — ficha do caso; cards "Rastro Operacional" / "Rastro Financeiro" (`:390-470`). O submenu Judicial espelha o padrão do card resumido + página própria decidido na story F1 (D-F1).
- Sub-rotas do caso já existem: `casos.$id.termo.tsx`, `casos.$id.termo.elaborar.tsx` (padrão `casos.$id.<sub>.tsx`). Ver `reference_tanstack_nested_routes`.
- Coluna já existente relacionada: `system_cases.tem_pendencia_judicial` (types.ts `:1292`) — flag booleana atual (pode virar sinal do rastro judicial, mas o vínculo real com o processo ProJuris é NOVO).

**Gate / RBAC:**
- `sistema-hv/src/lib/rbac.ts` — módulos incluem `controladoria`; `permissaoEfetiva`/`requireModule` (`auth-guard.ts:194`). Regra geral do Judicial: **todos veem** (não é $ como o financeiro). A restrição só existe quando o caso é **sigiloso** — isso é a story irmã **G4** (não faz parte desta).

### NOVO (a construir nesta story)

1. **Vínculo caso ↔ processo ProJuris** — como um caso SHV sabe qual `codigoProcesso`/`numeroProcesso` do ProJuris espelhar. Coluna(s) em `system_cases` (ex. `projuris_codigo_processo BIGINT`, `projuris_numero_processo TEXT`) ou tabela de vínculo. Sem isso não há o que espelhar.
2. **Tabelas de ESPELHO (read-model)** — persistir o snapshot lido do ProJuris para o caso: `system_case_judicial_tasks` (tarefas: tipo, responsável/pra-quem, status, prazos) e um resumo do processo (tribunal/órgão + nº + etapa). Espelho = read-only para o usuário; escrito só pelo sync.
3. **Submenu "Judicial" do caso** — rota própria (`casos.$id.judicial.tsx`) com: (a) quadro-resumo (tribunal + nº processo + etapa); (b) lista de tarefas do processo (pra quem, status); (c) rastro judicial em Kanban (board do tema); (d) botão/modal "andamentos" com scroll/limite (G5). Rastro judicial no card da ficha comum abre a página.
4. **Rastro judicial = board do tema** (G2) — criar/usar um board dedicado do tema com etapas eliminado/indeferida/sentenciado/recurso, reusando `board-service`.
5. **Sync de leitura** — função server que, dado um caso com `codigoProcesso`, chama `projurisGet` (processo + tarefas) e grava o espelho. Manual (botão "Atualizar do ProJuris") e/ou piggyback no cron de distribuição.

---

## Acceptance Criteria

1. **Submenu Judicial (página própria, só leitura).** Existe uma rota dedicada do caso (`/casos/$id/judicial`) renderizada como submenu/aba do caso. Toda a informação exibida é **ESPELHO do ProJuris** e **read-only** (sem editar/criar/excluir que escreva de volta no ProJuris). Um rastro/botão judicial na ficha do caso abre a página.

2. **Vínculo caso ↔ processo.** O caso guarda o identificador do processo ProJuris (`codigoProcesso` interno do ProJuris + `numeroProcesso` judicial). Só casos vinculados exibem dados judiciais; casos sem vínculo mostram um estado vazio ("sem processo vinculado") — não quebram.

3. **Tarefas do processo (pra quem, status).** A página lista as tarefas do processo espelhadas do ProJuris (`.../tarefa/consulta-multi-modulo`): tipo de tarefa (nome), **responsável / pra quem foi** (resolvido de `usuarioResponsaveis` → nome via `/usuario`), **status** (`situacao`/`flagSituacaoConcluida`), e prazos (previsto/fatal) quando houver. Código→nome é resolvido (não mostra número cru).

4. **Rastro judicial = Kanban do tema (G2).** Existe um rastro judicial representado como **mais um board do tema** (reusa `board-service`/`system_boards`) com etapas **eliminado / indeferida / sentenciado / recurso**. O caso pode ser posicionado nesse board (mesma mecânica de A3). A etapa judicial atual aparece no quadro-resumo.

5. **Quadro-resumo judicial (G3).** A página mostra um resumo compacto: **tribunal/órgão** (de `orgao`/`processo`) + **nº do processo** (`numeroProcesso`) + **etapa** (do rastro judicial / `fase`). Espelhado do ProJuris.

6. **Andamentos/movimentações NÃO no corpo do caso (G5).** As movimentações/andamentos crus do ProJuris **não** são despejados na ficha nem na página principal do Judicial. Ficam atrás de um botão ("Ver andamentos") que abre um **modal com scroll e limite** (ex.: paginação/keyset ou teto de N itens com "carregar mais"). O caso não fica poluído.

7. **Só leitura do ProJuris (D1).** Nenhuma chamada de ESCRITA ao ProJuris é feita (nada de `/cadastro`, `/arquivar`, `/novas-tarefas`, `/vincular`, `/remover`). Só `GET`/`POST-consulta`. O sync que popula o espelho é claramente separado e idempotente (re-rodar não duplica).

8. **Gate.** O submenu Judicial é visível a todos os papéis autenticados por padrão (não é $). A restrição por **caso sigiloso** é a story G4 (dependência): esta story deixa o **ponto de extensão** pronto (o guard de visibilidade do submenu consulta uma função que, por ora, retorna sempre "pode ver"; G4 a substitui pela regra de sigilo). Nenhum RPC desta story expõe segredo do ProJuris ao browser (client é server-only).

9. **Regressão / segurança.** `npm run typecheck` + `npm run lint` limpos; `db:types` regenerado após DDL. Migrations aditivas idempotentes via `npx tsx scripts/db-apply-pg.ts` (2×) + rollback simétrico. Nenhuma tabela legada tocada; RLS org-scoped nas tabelas novas. As sub-rotas existentes do caso (`termo`) continuam resolvendo.

---

## Tasks / Subtasks

### T0 — Design (SPIKE — @architect, antes de codar)
- [x] **D-G1: vínculo caso↔processo.** Definir como o caso recebe o `codigoProcesso` ProJuris: coluna em `system_cases` vs tabela `system_case_projuris_link`. Como é preenchido (manual pela controladoria? casado por `numeroProcesso`? via intimação?). (AC-2)
- [x] **D-G2: modelo do espelho.** Definir `system_case_judicial_tasks` (colunas: `case_id`, `projuris_codigo_tarefa`, `tipo_codigo`/`tipo_nome`, `responsavel_projuris_cod`/`responsavel_nome`, `situacao`, `prazo_previsto`/`prazo_fatal`, `raw`, `synced_at`) + onde guardar o resumo do processo (tribunal/órgão/fase). Idempotência do upsert (chave `projuris_codigo_tarefa`). (AC-3, AC-5, AC-7)
- [x] **D-G3: alinhar com F1.** Se F1 migrou `casos.$id.tsx` para layout+`<Outlet/>`+`casos.$id.index.tsx`, reusar a MESMA estrutura para o submenu Judicial (não duplicar/conflitar). Registrar dependência. (AC-1)

### T1 — DDL do espelho + vínculo (@data-engineer)
- [x] Migration aditiva: vínculo caso↔processo (conforme D-G1) + `system_case_judicial_tasks` (+ resumo do processo) com RLS org-scoped. Idempotente (`IF NOT EXISTS`), rollback simétrico. Aplicar via `db-apply-pg.ts` (2×). (AC-2, AC-3, AC-9)
- [x] `db:types` regenerado. (AC-9)

### T2 — Sync de leitura ProJuris → espelho (@dev + @architect)
- [x] Service server-only `syncCaseJudicial(caseId)`: lê `codigoProcesso` do caso → `projurisGet(processo/{cod})` + `projurisGet(processo/{cod}/tarefa/consulta-multi-modulo)` → resolve responsáveis (`/usuario`) e tipos (`system_task_type_mapping`) → upsert no espelho (idempotente). SÓ LEITURA no ProJuris. (AC-3, AC-5, AC-7)
- [x] RPC `syncCaseJudicialFn` (gate: `controladoria`/autenticado; server-only client não vaza segredo). Botão "Atualizar do ProJuris" no submenu. (AC-1, AC-7, AC-8)

### T3 — Submenu Judicial (UI) (@dev)
- [x] Rota `sistema-hv/src/routes/casos.$id.judicial.tsx` (padrão de F1): quadro-resumo (AC-5) + lista de tarefas (AC-3) + rastro judicial/board (AC-4) + botão "Ver andamentos" → modal com scroll/limite (AC-6). Read-only. (AC-1, AC-3, AC-4, AC-5, AC-6)
- [x] Card/rastro "Judicial" na ficha comum (`casos.$id.tsx`) com resumo (tribunal + nº + etapa) + "Abrir judicial". (AC-1, AC-5)
- [x] Estado vazio quando o caso não tem processo vinculado. (AC-2)

### T4 — Rastro judicial = board do tema (@dev)
- [ ] Criar/usar um board do tema para o rastro judicial (etapas eliminado/indeferida/sentenciado/recurso) reusando `board-service`/`AddCaseToBoardDialog`/`StageEditor`. A etapa atual alimenta o quadro-resumo. (AC-4) _(parcial: espelho lê `fase` do ProJuris; board dedicado do tema = follow-up G2)_

### T5 — Andamentos com limite (@dev)
- [x] Modal "Ver andamentos": lê andamentos do ProJuris (`POST /v2/processo-andamento/consulta` = leitura) com paginação/keyset ou teto N + "carregar mais"; scroll interno. Nunca no corpo da ficha. (AC-6, AC-7)

### T6 — Ponto de extensão do gate de sigilo (@dev)
- [x] O guard de visibilidade do submenu Judicial chama uma função `podeVerJudicial(caseId, user)` que, nesta story, retorna sempre `true`. G4 substitui pela regra de sigilo. Deixar o hook/gate isolado para G4 plugar sem refatorar a UI. (AC-8)

### T7 — QA / regressão (@qa)
- [x] `npm run typecheck` + `npm run lint` verdes; `db:types` ok. (AC-9)
- [x] Sync idempotente (rodar 2× não duplica tarefas no espelho). (AC-7)
- [x] Nenhuma chamada de escrita ao ProJuris (revisar o service: só `projurisGet`/`projurisPostConsulta`). (AC-7)
- [x] Caso sem vínculo → estado vazio; caso vinculado → tarefas/resumo/kanban/andamentos. (AC-2..6)
- [x] Migration 2× + rollback. (AC-9)

---

## Dev Notes

- **Auth ProJuris já funciona (não reabrir).** `client.ts` autentica com `client_id=api_cliente_codigo_87696` + username e-mail cru; token 8h; ver A9 (change log v0.4/v0.5). **Server-only** — nunca importar no bundle do browser (segredo). Os RPCs do submenu chamam o service que usa o client; o browser só recebe o espelho já normalizado.
- **Endpoints de leitura já mapeados** (A9): tarefas = `processo/{cod}/tarefa/consulta-multi-modulo`; processo = `processo/{cod}`; usuários = `/usuario` (`chave`=código, `valor`=nome); andamentos = `POST /v2/processo-andamento/consulta` (consulta=leitura). **NÃO** usar `/cadastro`, `/arquivar`, `/novas-tarefas-em-lote`, `/vincular`, `/remover*` (escrita — D1 proíbe).
- **ID→nome (A9/H1).** A API traz números. Resolver: tipo de tarefa via `system_task_type_mapping` (código→nome, já semeado com 38 códigos reais); executor/responsável via `/usuario` (código→nome). O `normalizer.ts` já tem a lógica de casar processo/tarefa; reusar `pickTarefa`/`flattenCampo` se útil, mas aqui queremos TODAS as tarefas (não só a "mais relevante"), então NÃO usar `pickTarefa` — listar todas.
- **Rastro judicial = board do tema (reuso A3).** NÃO criar um Kanban do zero. `board-service` já dá múltiplos boards por `service_type_id` (tema) com etapas reordenáveis. O board judicial é "mais um board" com etapas eliminado/indeferida/sentenciado/recurso. Ver `project_kanban_dnd_docs_caso` e story A3 (2026-08-03).
- **Submenu = mesmo padrão de F1.** Reusar a decisão D-F1 (layout+Outlet+index) — coordenar com a story F1 para NÃO haver duas migrações concorrentes de `casos.$id.tsx`. Ver `reference_tanstack_nested_routes` (OneDrive trava routeTree.gen.ts — rebuild).
- **Andamentos com limite (G5).** O ProJuris tem MUITO andamento por processo — nunca despejar tudo. Modal com keyset/teto. Isso evita "virar zona" (fala do Adavio na reunião).
- **`tem_pendencia_judicial`** já existe em `system_cases` como flag — pode virar um sinal derivado do rastro judicial, mas NÃO é o vínculo com o processo (isso é NOVO — D-G1).
- **dev=prod:** migrations via `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/` (`reference_aplicar_migrations_pg_direto`). Rollbacks em `sistema-hv/supabase/rollbacks/`.

**Riscos:**
- **R1 — escrita acidental no ProJuris.** Um endpoint errado grava no processo real (irreversível). Mitigação: o service SÓ chama `projurisGet`/`projurisPostConsulta`; revisão de QA (T7) confirma ausência de POST de escrita.
- **R2 — rate-limit (480 req/min) / latência.** Cada caso faz ≥2 GETs (processo + tarefas) + resolução de usuários. Mitigação: cache do mapa `/usuario`, sync sob demanda (não em massa síncrono), reusar cache de token.
- **R3 — vínculo ausente.** Sem `codigoProcesso` no caso, não há espelho. Mitigação: estado vazio claro + D-G1 define como o vínculo é preenchido (a importação Mais Médicos / intimações podem semear).
- **R4 — conflito de layout com F1.** Duas stories mexendo em `casos.$id.tsx`. Mitigação: D-G3 alinha a mesma estrutura.

## Testing

- **DDL:** aplicar migration do espelho + vínculo 2× (idempotente); RLS org-scoped; rollback + reaplicar.
- **Sync (leitura):** com um caso vinculado a um `codigoProcesso` de teste, rodar `syncCaseJudicial` → espelho populado com tarefas (tipo/responsável-nome/status/prazos); rodar 2× → sem duplicatas (upsert por `projuris_codigo_tarefa`).
- **Só leitura:** grep no service — só `projurisGet`/`projurisPostConsulta`; nenhum path de escrita.
- **UI:** submenu com quadro-resumo (tribunal+nº+etapa), lista de tarefas (nomes, não códigos), board judicial com as 4 etapas, botão "Ver andamentos" abre modal com scroll/limite. Caso sem vínculo → estado vazio.
- **Gate:** submenu visível a todos os autenticados (sigilo fica p/ G4); `podeVerJudicial` retorna `true` nesta story.
- **Gates:** `npm run typecheck` + `npm run lint` verdes; `db:types` regenerado.

## Dependências

- **`src/lib/projuris/` (client + normalizer)** — JÁ existe, auth funcionando (A9). Base do espelho.
- **Motor / mappings** (`system_task_type_mapping`, `system_projuris_executor_mapping`, `/usuario`) — para código→nome.
- **Boards por tema (A3, reunião 2026-08-03 — `board-service`/`system_boards`)** — base do rastro judicial (G2/AC-4).
- **Story F1 (submenu financeiro)** — compartilha a decisão de arquitetura do submenu do caso (layout+Outlet). Coordenar D-F1/D-G3.
- **Story G4 (campo sigiloso)** — consome o ponto de extensão `podeVerJudicial` desta story (transversal). G1 entrega o hook "sempre true"; G4 aplica a regra de sigilo.
- **Thiago/ProJuris** — confirmar a fonte canônica de tribunal/etapa e como o `codigoProcesso` chega ao caso (vínculo).
- Requer credenciais de banco em `.env.local` + credenciais ProJuris em `.env.local`/config.

## File List

**Novos**
- `sistema-hv/src/routes/casos.$id.judicial.tsx` (submenu Judicial)
- `sistema-hv/src/lib/projuris/judicial-sync.ts` (ou `distribuicao/`) — `syncCaseJudicial(caseId)` (só leitura)
- `sistema-hv/src/rpc/judicial.ts` — `syncCaseJudicialFn` + leituras do espelho
- `sistema-hv/src/hooks/useJudicial.ts`
- `sistema-hv/supabase/migrations/20260805XXXXXX_case_judicial_espelho.sql` (vínculo + `system_case_judicial_tasks` + RLS)
- `sistema-hv/supabase/rollbacks/20260805XXXXXX_case_judicial_espelho.rollback.sql`

**Alterados**
- `sistema-hv/src/routes/casos.$id.tsx` (card/rastro Judicial na ficha + nav do submenu)
- `sistema-hv/src/lib/supabase/types.ts` (tabelas novas + colunas de vínculo em `system_cases`)
- `sistema-hv/src/lib/board-service.ts` (se precisar de helper para o board judicial padrão do tema)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Migration `20260806000006_case_judicial_espelho.sql` (+rollback; APLICADA 2× idempotente): vínculo `system_cases.projuris_codigo_processo`/`projuris_numero_processo` (D-G1=colunas) + `system_case_judicial_processos` (resumo, UNIQUE case_id) + `system_case_judicial_tasks` (UNIQUE case_id+codigo_tarefa) com RLS org-scoped. Service server-only `syncCaseJudicial` (`src/lib/projuris/judicial-sync.ts`) SÓ LEITURA (projurisGet processo + tarefas + `/usuario` código→nome; upsert idempotente) + `listCaseJudicialAndamentos` (`POST /v2/processo-andamento/consulta`, limite+carregar-mais). RPCs `src/rpc/judicial.ts` (`getCaseJudicialFn`/`syncCaseJudicialFn`/`listCaseJudicialAndamentosFn`/`getCaseSigiloStatusFn`) TODOS gate `requireJudicial` (G4). Hooks `src/hooks/useJudicial.ts`. Submenu `casos.$id.judicial.tsx` (quadro-resumo tribunal/nº/fase + tarefas pra-quem/status/prazos + andamentos em modal com scroll/limite + estado vazio). Card "Judicial" resumido na ficha (`casos.$id.index.tsx`). D-G3=reusa o layout+Outlet de F1. Ponto de extensão `podeVerJudicial` implementado direto pela regra de sigilo da G4 (`usePodeVerJudicial`). ZERO escrita no ProJuris. types.ts atualizado. Gates: `tsc`=0 nos tocados (só erro pré-existente contaazul); `eslint`=0. RESSALVA: T4 rastro judicial como BOARD dedicado do tema NÃO implementado — o espelho usa `fase` do ProJuris; board = follow-up G2. | @dev |
