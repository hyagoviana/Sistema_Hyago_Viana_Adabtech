# Story H6: Menu de configuração de "Tipos de tarefa" como fonte da verdade interna (prazo previsto/fatal do ProJuris + pontos/complexidade só nossos) + sincronização dos dois sistemas

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-05
- **ID:** H6
- **Status:** Ready for Review
- **Estimativa relativa:** M/L
- **Executor sugerido:** @dev + @data-engineer + @architect · Quality gate: @qa + @architect
- **Risco:** MÉDIO — estende `system_task_type_mapping` (migration aditiva) e mexe no fluxo de leitura do motor; a parte de **criar tipo no ProJuris** (H7) depende de existir endpoint de escrita na API (a investigar) e é o único ponto que pode gravar do lado ProJuris.
- **Origem:** Levantamento 2026-08-05, Bloco **H** (itens **H6** e **H7**) + Bloco **I** (item **I2**). Cobre os três: o menu de tipos-tarefa vira a fonte da verdade interna que o motor consome sem buscar tudo fora a cada rodada.

---

## Story

**Como** controladoria/administrador do motor de distribuição,
**quero** que o menu **"Tipos de tarefa"** guarde **internamente** os campos que hoje só existem no ProJuris (**prazo previsto** e **prazo fatal**) junto dos campos que são **só nossos** (**pontos** e **complexidade/temporalidade**), com a opção de **regras extras** (ex.: "tarefa X do tema Y é exclusiva do executor Z"), e que **criar/editar** um tipo aqui **sincronize** com o ProJuris (criar/vincular o ID lá, senão não há como casar),
**para** que o motor **não precise buscar todos os metadados do ProJuris a cada rodada** (I2 — config como fonte da verdade), rode mais rápido e determinístico, e para que cada tipo tenha um **ID ProJuris real** casável (H1/R3 da A9).

> **DECISÕES TRAVADAS (reunião 2026-08-05):**
> 1. **Fonte da verdade interna.** O menu de tipos-tarefa é onde o admin configura uma vez; o motor lê do banco, não do ProJuris a cada rodada (H6/I2).
> 2. **Campos do ProJuris espelhados internamente:** **prazo previsto** e **prazo fatal** (hoje o motor os lê da tarefa no ProJuris a cada rodada — ver `sync-core.ts`). Guardar um **default por tipo** no nosso banco, usável quando a tarefa não trouxer o prazo (fallback determinístico), sem deixar de respeitar o prazo real da tarefa quando ele vier.
> 3. **Campos só nossos:** `points`, `complexity_level`, `temporal_level` — já existem em `system_task_type_mapping`.
> 4. **Regra extra "exclusiva":** poder marcar que um tipo (opcionalmente combinado com um tema) é **exclusivo de um executor**. Já há base: `exclusive_executor_id` no task_type (usado por `sync-core.ts`) e a tabela `system_distribution_exceptions` (responsável exclusivo por tipo/tema). Expor isso na UI de tipos-tarefa (ou linkar para exceções) — não recriar o conceito.
> 5. **Sincronizar nos dois sistemas (H7):** criar um tipo no nosso sistema deve **criar/vincular** no ProJuris para existir um ID casável. **Investigar** se a API ProJuris tem endpoint de criação de tipo de tarefa; **se não tiver, o fluxo é: criar lá primeiro (manual) e vincular o ID aqui** (o de-para por nome já casou 39/44 em A9 — reusar).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Tela de tipos-tarefa:** `sistema-hv/src/routes/controladoria.distribuicao.tipos-tarefa.tsx` — CRUD via diálogo com campos `projuris_tipo_codigo`, `projuris_tipo_descricao`, `motor_task_type_id`, `points`, `complexity_level` (0/1/2), `temporal_level` (0/1/2), `active`; filtro + export CSV. Hooks `useTaskTypeMappings`/`useUpsertTaskTypeMapping` em `sistema-hv/src/hooks/useDistribuicao.ts`.
- **Tabela:** `system_task_type_mapping` — `sistema-hv/supabase/migrations/20260728000001_distribution_schema.sql:136` (`projuris_tipo_codigo TEXT`, `motor_task_type_id TEXT`, `points NUMERIC(10,4) DEFAULT 1.0`, `complexity_level`/`temporal_level` INT 0-2, `active`, UNIQUE `(projuris_tipo_codigo, organization_id)`); `+ projuris_tipo_descricao` em `20260728000003_distribution_config.sql:36`; `+ exclusive_executor_id` na migration `20260805000002_distribution_exclusive_executors.sql`.
- **Exceções (responsável exclusivo):** `system_distribution_exceptions` — `sistema-hv/supabase/migrations/20260728000004_distribution_exceptions.sql`; tela `sistema-hv/src/routes/controladoria.distribuicao.excecoes.tsx`.
- **Como o motor usa hoje (a mudar):** `sistema-hv/src/lib/distribuicao/sync-core.ts:130-172` faz, **por processo e a cada rodada**, `GET /processo/{cod}/tarefa/consulta-multi-modulo` para pegar `codigoTarefaTipo` + `dataConclusaoPrevista` (prazo previsto) + `dataLimite` (prazo fatal). E `:174-213` lê `system_task_type_mapping` (`points, complexity_level, temporal_level, exclusive_executor_id`). O prazo hoje **sempre** vem do ProJuris; H6 adiciona o default interno como fonte/fallback.
- **De-para de tipos já resolvido (A9 v0.5):** `scripts/reconcile-projuris-tipos.ts` casou 38-39/44 tipos por nome → `projuris_tipo_codigo` numérico real. 5-6 near-miss/colisão pendentes de decisão do owner (Diligências/Emenda/Manifestação/Réplica + colisão AUDIENCIA/audiencia_trabalhista no código 6476501).
- **Cliente ProJuris (leitura):** `sistema-hv/src/lib/projuris/client.ts` (`projurisGet`, `projurisPostConsulta`, auth OAuth2). Endpoint de listagem de tipos: `GET /tipo?chave-tipo=tarefa-tipo` (52 tipos, envelope `consultaTipoRetorno[0].simpleDto`).

### NOVO (a construir nesta story)

- **Colunas de prazo interno** em `system_task_type_mapping`: `prazo_previsto_dias INT NULL` (default de prazo previsto por tipo, em dias) e `prazo_fatal_dias INT NULL` (default de prazo fatal por tipo). Aditivo, nullable. (H6, decisão 2)
- **UI:** campos "Prazo previsto (dias)" e "Prazo fatal (dias)" no diálogo de tipos-tarefa; e um controle para a **regra exclusiva** (executor + tema opcional) — gravando em `exclusive_executor_id`/`system_distribution_exceptions` (reuso). (H6, decisão 4)
- **Motor lê o interno:** `sync-core.ts` passa a usar `prazo_*_dias` do tipo como **fallback** quando a tarefa do ProJuris não trouxer `dataConclusaoPrevista`/`dataLimite`, mantendo a data real quando ela existir. (H6, decisão 2)
- **Sincronização de tipos (H7):** botão **"Sincronizar tipos do ProJuris"** que lista `GET /tipo?chave-tipo=tarefa-tipo` e faz o de-para/vínculo (reusa `reconcile-projuris-tipos.ts`), preenchendo `projuris_tipo_codigo`/`projuris_tipo_descricao`. **Spike de escrita:** verificar se existe endpoint ProJuris para **criar** tipo de tarefa; se sim, "criar tipo aqui" cria lá e vincula o ID; se não, a UI orienta "criar no ProJuris primeiro e depois vincular o ID por este botão".

---

## Acceptance Criteria

1. **Prazo interno por tipo (schema):** `system_task_type_mapping` ganha `prazo_previsto_dias INT NULL` e `prazo_fatal_dias INT NULL` (migration aditiva + rollback + `db:types`). Nullable — tipo sem default continua válido.
2. **UI de prazo:** o diálogo de `controladoria.distribuicao.tipos-tarefa.tsx` permite ver/editar "Prazo previsto (dias)" e "Prazo fatal (dias)" por tipo; salvar persiste nas novas colunas via `useUpsertTaskTypeMapping` (estendido).
3. **Motor usa o interno como fonte/fallback:** em `sync-core.ts`, ao montar a Task, o prazo passa a ser: **prazo real da tarefa ProJuris quando presente**, senão **o default interno** (`prazo_previsto_dias`/`prazo_fatal_dias` aplicado sobre a data-base), senão o sentinela atual. Comportamento com tarefa que traz prazo permanece idêntico ao de hoje (sem regressão).
4. **Campos só nossos preservados:** `points`, `complexity_level`, `temporal_level` continuam editáveis e usados pelo scoring exatamente como hoje (a story não muda a fórmula de pontuação).
5. **Regra extra "exclusiva":** o admin consegue marcar, a partir da UI de tipos-tarefa, que um tipo é exclusivo de um executor (opcionalmente por tema), gravando em `exclusive_executor_id` (tipo) e/ou `system_distribution_exceptions` (tipo/tema) — **sem** criar uma 3ª fonte de verdade; o motor (`flow-selector`/`sync-core`) respeita a exclusividade como já respeita hoje.
6. **Sincronizar tipos (leitura/vínculo):** um botão "Sincronizar tipos do ProJuris" lista os tipos de `GET /tipo?chave-tipo=tarefa-tipo`, casa por nome normalizado (reusa `reconcile-projuris-tipos.ts`) e preenche `projuris_tipo_codigo` (numérico real) + `projuris_tipo_descricao`. Idempotente (rodar 2× não duplica). Os near-miss/colisão são listados para decisão manual, não sobrescritos silenciosamente.
7. **Spike de criação no ProJuris (H7):** a story documenta (Dev Notes/Change Log) se a API ProJuris **tem** endpoint de criação de tipo de tarefa. Se **tem**: "Novo Tipo" na tela cria no ProJuris e vincula o ID retornado. Se **não tem**: a UI de "Novo Tipo" orienta a criar primeiro no ProJuris e depois vincular via "Sincronizar", e **não** grava um tipo sem ID casável de forma silenciosa (aviso claro).
8. **Config como fonte da verdade (I2):** após configurar os tipos uma vez, uma rodada de `runSync` **não** depende de buscar metadados de tipo do ProJuris além do necessário (o motor lê pontos/complexidade/prazo-default do banco); a única leitura obrigatória do ProJuris por rodada continua sendo as intimações/tarefas/processos (entrada). Documentar que os metadados de tipo não são re-buscados por rodada.
9. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; `db:types` regenerado; RLS org-scoped preservada; nenhuma escrita no ProJuris exceto (se H7 tiver endpoint) a criação de tipo explicitamente disparada pelo admin; nenhum segredo em log.

---

## Tasks / Subtasks

### T0 — Spike API ProJuris: criar tipo de tarefa? (@architect + @data-engineer) — antes de codar H7
- [ ] **PENDÊNCIA (não implementado nesta rodada):** investigar na doc REST se há endpoint de **criação** de tipo de tarefa (ex.: `POST /tipo`/`/tarefa-tipo`). H7 (escrita no ProJuris) fica ATRÁS deste spike — ver Dev Notes (H7 documentado como pendência; escrita NÃO implementada). (AC-7)

### T1 — Schema (@data-engineer)
- [x] Migration aditiva `20260805000004_task_type_prazos.sql`: `ADD COLUMN IF NOT EXISTS prazo_previsto_dias INT`, `prazo_fatal_dias INT` em `system_task_type_mapping` + rollback simétrico. Aplicada via `npx tsx scripts/db-apply-pg.ts` (rodada 2× → idempotente). `src/lib/supabase/types.ts` (Row/Insert) atualizado. (AC-1)

### T2 — UI tipos-tarefa (@dev)
- [x] Campos "Prazo previsto (dias)" / "Prazo fatal (dias)" no diálogo + colunas na tabela + CSV; `useUpsertTaskTypeMapping` recebe `prazo_previsto_dias`/`prazo_fatal_dias` (vazio→null). (AC-2)
- [x] Regra exclusiva exposta via link + hint para `/controladoria/distribuicao/excecoes` (reuso de `exclusive_executor_id`/`system_distribution_exceptions`, sem 3ª fonte). (AC-5)
- [x] Botão "Sincronizar tipos" → `sincronizarTiposTarefaFn` → `syncTaskTypesCore()` (de-para por nome, espelha `reconcile-projuris-tipos.ts`); toast mostra casados + near-miss/colisões. Idempotente. (AC-6)

### T3 — Motor lê o interno (@dev + @architect)
- [x] `sync-core.ts`: `ttMap` traz `prazo_previsto_dias`/`prazo_fatal_dias`; prazo = REAL da tarefa > default interno (`addDaysIso(distributionDate, N)`) > sentinela. Sem regressão quando há prazo real. (AC-3, AC-8)

### T4 — H7 conforme spike (@dev)
- [ ] **PENDÊNCIA:** escrita no ProJuris NÃO implementada (depende de T0). `syncTaskTypesCore` só LÊ do ProJuris e escreve códigos no nosso banco. "Novo Tipo" continua criando só o registro interno; orientação de criar-no-ProJuris-e-vincular fica para quando T0 confirmar o endpoint. (AC-7)

### T5 — QA (@qa + @architect)
- [ ] Setar prazo-default num tipo; simular tarefa sem prazo → default; com prazo → real — pendente @qa (runtime). (AC-3)
- [ ] Sincronizar tipos 2× → sem duplicata; near-miss listados — pendente @qa (runtime com ProJuris). (AC-6)
- [ ] Regra exclusiva num tipo → executor exclusivo na simulação — pendente @qa. (AC-5)
- [x] `typecheck` verde (só pré-existente contaazul); `eslint` verde nos arquivos tocados; RLS org-scoped preservada; nenhum segredo em log/front. (AC-9)

---

## Dev Notes

**Não recriar exclusividade nem pontuação.** `exclusive_executor_id` (task_type/theme) e `system_distribution_exceptions` já existem e são consumidos por `sync-core.ts`/`flow-selector`. H6 só **expõe** a configuração no menu de tipos-tarefa; a fórmula de scoring (`points × multiplier` + complexidade/temporal) NÃO muda nesta story (é escopo da A9/seed).

**Prazo: fallback, não substituição.** O objetivo (decisão 2/I2) é o motor não depender de buscar tudo fora, mas o prazo **real** da tarefa (quando o ProJuris o traz) é mais autoritativo que um default por tipo. Então a regra é: real > default interno > sentinela. Hoje `sync-core.ts:166` já faz `dataConclusaoPrevista ?? dataLimite`; H6 acrescenta o default interno como próximo fallback antes do `"9999-12-31"`.

**H7 é o ponto delicado.** Criar tipo no ProJuris é **escrita** na API externa (fora da regra "só leitura" da A9/D1). Só implementar a criação-lá **se** o spike T0 confirmar o endpoint e o owner autorizar; caso contrário, o caminho seguro é "criar manual no ProJuris → vincular ID aqui" (reusa o de-para por nome já validado, 39/44). Registrar a decisão no Change Log.

**Near-miss e colisão do de-para (A9 v0.5).** Diligências/Balcão (3 candidatos), Emenda→Emenda à Inicial, Manifestação (5/10/15 dias), Réplica→Réplica à Contestação, e a colisão AUDIENCIA/audiencia_trabalhista no código 6476501 (o UNIQUE só deixa 1 levar o código). O botão de sync deve **listar** esses casos para o admin resolver, nunca sobrescrever.

**Migrations via pg direto.** Aplicar DDL via `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/` (CLI Supabase quebrado no Windows/OneDrive; ver `reference_aplicar_migrations_pg_direto`). dev=prod; rollback simétrico obrigatório.

**Riscos:**
- **R1 — escrita externa (H7).** Criar tipo no ProJuris é irreversível pela API; só com spike + autorização.
- **R2 — regressão de prazo.** Se o fallback interno for aplicado quando havia prazo real, a distribuição muda de data. Mitigar com testes de "tarefa com prazo" vs "sem prazo".
- **R3 — 3 fontes de exclusividade.** task_type.exclusive_executor_id, theme.exclusive_executor_id e exceptions podem divergir. Documentar a precedência (já em `flow-selector`) e não introduzir uma 4ª.

### Testing
- Migration aplicada: `system_task_type_mapping` tem `prazo_previsto_dias`/`prazo_fatal_dias`.
- Tipo com `prazo_previsto_dias=10`, tarefa ProJuris sem prazo → Task com `internal_limit_date` = base+10; com prazo real → data real.
- Sync de tipos preenche `projuris_tipo_codigo` numérico; 2ª execução idempotente.
- Regra exclusiva refletida na simulação.
- `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Depende de (entregues):** `system_task_type_mapping` + `projuris_tipo_descricao` + `exclusive_executor_id` (`20260728000001`/`...000003`/`20260805000002`); `system_distribution_exceptions` (`20260728000004`); tela/hooks de tipos-tarefa; `ProjurisClient` (auth destravada, A9); `scripts/reconcile-projuris-tipos.ts` (de-para por nome).
- **Relaciona com A9** (seed de pontuação/códigos): H6 é a UI/persistência interna que a A9 consome; alinhar que o seed de pontos não é sobrescrito.
- **Relaciona com H5** (`authorized_task_types[]` no executor) e **H1** (ID→nome).
- **H7** depende do spike T0 (endpoint de escrita no ProJuris).

## File List

**Implementado (2026-08-05):**
- `sistema-hv/supabase/migrations/20260805000004_task_type_prazos.sql` + `sistema-hv/supabase/rollbacks/20260805000004_task_type_prazos.rollback.sql` (ADD/DROP COLUMN IF EXISTS, aditivo, idempotente — aplicado 2×).
- `sistema-hv/src/lib/supabase/types.ts` (Row/Insert de `system_task_type_mapping` + `prazo_previsto_dias`/`prazo_fatal_dias`).
- `sistema-hv/src/routes/controladoria.distribuicao.tipos-tarefa.tsx` (campos/colunas/CSV de prazo + link "Executor exclusivo" + botão "Sincronizar tipos").
- `sistema-hv/src/hooks/useDistribuicao.ts` (`useUpsertTaskTypeMapping` recebe prazos; novo `useSyncTaskTypes`).
- `sistema-hv/src/lib/distribuicao/sync-core.ts` (prazo interno como fallback; `buildProjurisClientFromConfig` extraído/exportado).
- `sistema-hv/src/lib/distribuicao/sync-task-types.ts` (NOVO — `syncTaskTypesCore`, de-para por nome, só leitura no ProJuris).
- `sistema-hv/src/rpc/distribuicao.ts` (novo `sincronizarTiposTarefaFn`, gate `requireModule("controladoria","edit")`).

**Não feito (pendência H7 / T0):**
- `sistema-hv/src/lib/projuris/client.ts` — POST de criação de tipo no ProJuris (fica atrás do spike de endpoint de escrita; não implementado).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-05 | v0.1 | Draft inicial. Menu "Tipos de tarefa" como fonte da verdade interna: novas colunas `prazo_previsto_dias`/`prazo_fatal_dias` (aditivo) espelhando o ProJuris; `points`/`complexity`/`temporal` (já nossos) mantidos; regra extra "exclusiva" via `exclusive_executor_id`/`system_distribution_exceptions` (reuso); motor (`sync-core.ts`) passa a usar o prazo interno como fallback (real > default > sentinela); botão "Sincronizar tipos do ProJuris" reusa `reconcile-projuris-tipos.ts`. H7 (criar tipo nos dois sistemas) atrás de spike T0 (endpoint de escrita na API). Cobre H6+H7+I2. | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Migration `20260805000004_task_type_prazos.sql` (+rollback) aplicada via `db-apply-pg.ts` (idempotente, 2×) — colunas `prazo_previsto_dias`/`prazo_fatal_dias` INT NULL; `types.ts` atualizado. UI `tipos-tarefa.tsx`: campos+colunas+CSV de prazo, link "Executor exclusivo" (reuso de exceções, sem 3ª fonte), botão "Sincronizar tipos". `useDistribuicao.ts`: prazos no upsert + `useSyncTaskTypes`. `sync-core.ts`: prazo REAL > default interno (`addDaysIso`) > sentinela (sem regressão com prazo real); extraído `buildProjurisClientFromConfig`. NOVO `sync-task-types.ts` (`syncTaskTypesCore`, de-para por nome, SÓ LEITURA no ProJuris) + `sincronizarTiposTarefaFn` em `distribuicao.ts` (gate edit). Gates: typecheck verde (só pré-existente contaazul), eslint verde nos arquivos tocados. **H7/T0 = PENDÊNCIA:** escrita no ProJuris NÃO implementada (aguarda spike de endpoint). QA de runtime (prazo fallback, sync 2×, regra exclusiva) pendente @qa. | @dev |
