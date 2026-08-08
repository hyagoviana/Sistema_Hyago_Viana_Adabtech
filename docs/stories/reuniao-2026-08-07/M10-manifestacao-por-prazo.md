# Story M10: "Manifestação" com 3 tipos separados por prazo (5 / 10 / 15 dias) — um tipo/lógica para cada, não juntar

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-07
- **ID:** M10
- **Status:** Draft
- **Estimativa relativa:** S/M
- **Executor sugerido:** @dev + @data-engineer · Quality gate: @qa
- **Risco:** BAIXO — são 3 entradas de configuração em `system_task_type_mapping` (dados + de-para por prazo) reusando o CRUD/colunas já entregues em H6; sem novo schema. O único ponto sensível é o de-para com o ProJuris (3 códigos distintos para "Manifestação (5/10/15 dias)").
- **Origem:** Reunião 2026-08-07, item **M10** ("Manifestação (5/10/15 dias): criar uma lógica/tipo para cada — não juntar"). Refinamento do menu "Tipos de tarefa" (H6) e do de-para A9 (near-miss "Manifestação (5/10/15 dias)").

> **O MOTOR v1.0 JÁ EXISTE.** As colunas `prazo_previsto_dias`/`prazo_fatal_dias`, o CRUD de tipos-tarefa e o de-para por nome foram entregues em H6 (2026-08-05, migration `20260805000004`). M10 é REFINAMENTO/DADOS: garantir **3 tipos distintos** de "Manifestação" (um por prazo), cada um com seu `projuris_tipo_codigo` e seu prazo — em vez de um tipo genérico "Manifestação".

---

## Story

**Como** controladoria/administrador do motor de distribuição,
**quero** que "Manifestação" exista como **três tipos de tarefa separados** — Manifestação (5 dias), Manifestação (10 dias), Manifestação (15 dias) —, cada um com sua própria configuração (código ProJuris, prazo previsto/fatal, pontos, complexidade), **sem juntar** os três num só,
**para** que o motor calcule o prazo e a pontuação corretos por caso (uma manifestação de 5 dias é mais urgente que uma de 15) e o de-para com o ProJuris case cada uma ao seu código real.

> **DECISÕES TRAVADAS (reunião 2026-08-07):**
> 1. **Três tipos, não um.** Cada prazo (5/10/15) é uma **entrada própria** em `system_task_type_mapping`. Não usar um único tipo "Manifestação" com prazo variável.
> 2. **Prazo por tipo:** os `prazo_previsto_dias`/`prazo_fatal_dias` (colunas de H6) recebem 5/10/15 respectivamente (ou o par previsto/fatal que o Thiago confirmar por tipo).
> 3. **De-para ProJuris:** cada um casa ao seu `projuris_tipo_codigo` real (near-miss do A9 — "Manifestação (5/10/15 dias)" ficou pendente de decisão do owner; o Thiago vai confirmar os 3 códigos).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Tabela:** `system_task_type_mapping` — `projuris_tipo_codigo`, `motor_task_type_id`, `points`, `complexity_level`, `temporal_level`, `active`, UNIQUE `(projuris_tipo_codigo, organization_id)`; `+ projuris_tipo_descricao`; `+ exclusive_executor_id`; `+ prazo_previsto_dias`/`prazo_fatal_dias` (H6, `20260805000004`).
- **CRUD de tipos-tarefa:** `sistema-hv/src/routes/controladoria.distribuicao.tipos-tarefa.tsx` — diálogo com todos esses campos, incl. "Prazo previsto (dias)" / "Prazo fatal (dias)"; filtro + export CSV. Hooks `useTaskTypeMappings`/`useUpsertTaskTypeMapping` em `sistema-hv/src/hooks/useDistribuicao.ts`.
- **De-para por nome (sync):** `sistema-hv/src/lib/distribuicao/sync-task-types.ts` (`syncTaskTypesCore`, só leitura no ProJuris, casa por nome normalizado) + botão "Sincronizar tipos" (`sincronizarTiposTarefaFn` em `sistema-hv/src/rpc/distribuicao.ts`); espelha `scripts/reconcile-projuris-tipos.ts`. **Near-miss conhecido:** "Manifestação (5/10/15 dias)" — 3 candidatos que o de-para lista para decisão manual, não sobrescreve.
- **Como o motor usa o prazo:** `sync-core.ts:406-421` — prazo = REAL da tarefa ProJuris > default interno (`prazo_*_dias` sobre a data-base via `addDaysIso`) > sentinela. Ou seja, o prazo por tipo já é respeitado.

### NOVO (a construir nesta story)

- **Três registros distintos** em `system_task_type_mapping` para Manifestação 5/10/15 — via a própria UI (seed opcional) — cada um com `motor_task_type_id` próprio (ex.: `manifestacao_5`, `manifestacao_10`, `manifestacao_15`), `prazo_previsto_dias`/`prazo_fatal_dias` = 5/10/15 (ou o par confirmado), `points`/`complexity`/`temporal` por tipo, e `projuris_tipo_codigo` real de cada.
- **Resolução do near-miss no de-para:** o "Sincronizar tipos" (ou o `reconcile`) deve **casar cada uma das 3** ao seu código ProJuris correto, sem colidir no UNIQUE (cada código é único). Onde o nome ProJuris não distinguir automaticamente os 3 prazos, a UI/relatório de sync lista para o admin vincular manualmente (reuso do comportamento H6 de "near-miss listado, não sobrescrito").
- **(Opcional) Migration/seed** apenas se o owner quiser as 3 entradas pré-criadas; o mínimo é criar pela UI. Se seed, migration aditiva idempotente + rollback.

---

## Acceptance Criteria

1. **Três tipos separados:** existem, em `system_task_type_mapping`, três entradas ativas "Manifestação (5 dias)", "Manifestação (10 dias)", "Manifestação (15 dias)", cada uma com `motor_task_type_id` distinto e `prazo_previsto_dias`/`prazo_fatal_dias` correspondentes ao seu prazo (5/10/15 ou o par confirmado pelo Thiago). Nenhum tipo genérico "Manifestação" agregando os três permanece ativo.
2. **Criação pela UI:** o admin consegue criar/editar as 3 entradas em `controladoria.distribuicao.tipos-tarefa.tsx` (reuso do diálogo H6), setando prazo/pontos/complexidade por tipo. Salvar persiste via `useUpsertTaskTypeMapping` sem colidir no UNIQUE.
3. **De-para ProJuris por prazo:** cada uma das 3 é vinculada ao seu `projuris_tipo_codigo` real. O "Sincronizar tipos" casa os 3 quando o nome ProJuris distinguir; quando não distinguir, **lista** os candidatos para vínculo manual (não sobrescreve silenciosamente) — comportamento herdado de H6/A9.
4. **Motor calcula o prazo certo:** ao distribuir uma tarefa de cada tipo sem prazo real na tarefa ProJuris, o motor aplica o default interno do tipo (5/10/15 dias sobre a data-base) — via a precedência já existente (`sync-core.ts`: real > interno > sentinela). Com prazo real, usa o real (sem regressão).
5. **Pontuação por tipo preservada:** `points`/`complexity_level`/`temporal_level` de cada uma das 3 são independentes e usados pelo scoring como qualquer outro tipo (a story não muda a fórmula).
6. **Idempotência:** se houver seed/migration, rodar 2× não duplica. O de-para roda 2× sem duplicar (UNIQUE por código).
7. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; se houver DDL/seed, `db:types` + rollback; RLS org-scoped preservada; nenhuma escrita no ProJuris (só leitura no sync); nenhum segredo em log.

---

## Tasks / Subtasks

### T0 — Confirmar códigos ProJuris + pares de prazo (@architect + @data-engineer) — bloqueio de dados
- [ ] Obter do Thiago os **3 códigos ProJuris** de Manifestação 5/10/15 e o par previsto/fatal de cada (a reunião marca isso como pendência do Thiago — ver `reuniao-2026-08-07` "O que falta o Thiago mandar"). Sem os códigos, o de-para automático não distingue os 3; registrar como bloqueio de dados (a UI/seed pode ser preparada antes). (AC-3)

### T1 — Dados/UI (@dev + @data-engineer)
- [ ] Criar as 3 entradas em `system_task_type_mapping` (pela UI `tipos-tarefa.tsx` ou seed idempotente): `motor_task_type_id` = `manifestacao_5`/`_10`/`_15`, `prazo_previsto_dias`/`prazo_fatal_dias` = 5/10/15 (ou par confirmado), `points`/`complexity`/`temporal` por tipo, `active=true`. (AC-1,2)
- [ ] Se houver um tipo genérico "Manifestação" ativo, desativá-lo/migrar (`active=false`) para não competir com os 3. (AC-1)

### T2 — De-para (@dev)
- [ ] Rodar "Sincronizar tipos" e conferir que os 3 casam ao código certo; os que não casarem automaticamente aparecem no relatório de near-miss para vínculo manual (reuso de `sync-task-types.ts`). Preencher os 3 `projuris_tipo_codigo`. (AC-3,6)

### T3 — Motor (verificação) (@dev + @architect)
- [ ] Confirmar (sem alterar o engine) que a precedência de prazo do `sync-core.ts` aplica 5/10/15 quando a tarefa não traz prazo real. (AC-4)

### T4 — QA (@qa)
- [ ] Conferir 3 registros ativos, prazos 5/10/15, códigos distintos. (AC-1,3)
- [ ] Simular 1 tarefa de cada sem prazo real → `internal_limit_date` = base+5/+10/+15. (AC-4)
- [ ] Sync 2× → sem duplicar; near-miss listado. (AC-6)
- [ ] `typecheck` + `lint` verdes. (AC-7)

---

## Dev Notes

**Nada de schema novo.** As colunas de prazo já existem (H6, `20260805000004`). M10 é **configuração de dados** (3 registros) + resolução do de-para. Se o owner quiser as 3 pré-semeadas, um seed aditivo idempotente resolve; o mínimo aceitável é criar pela UI.

**Near-miss "Manifestação" é conhecido.** O A9/H6 já registram que "Manifestação (5/10/15 dias)" ficou pendente de decisão do owner no de-para por nome. O nome no ProJuris pode ou não trazer o prazo no rótulo — por isso T0 pede os **códigos** ao Thiago. O sync **lista** os candidatos; o admin vincula. Não forçar casamento automático que jogue os 3 no mesmo código (violaria o UNIQUE e misturaria os prazos).

**Prazo real ainda manda.** Se a tarefa do ProJuris trouxer `dataConclusaoPrevista`/`dataLimite`, o motor usa o real (o default 5/10/15 é só fallback). Isso é intencional (H6) e M10 não muda.

**Migrations via pg direto (se seed).** `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/`. dev=prod; rollback simétrico.

**Riscos:**
- **R1 — colisão de código.** Vincular 2 das 3 ao mesmo `projuris_tipo_codigo` viola o UNIQUE. Cada prazo = 1 código.
- **R2 — dados do Thiago pendentes.** Sem os 3 códigos + pares de prazo, o de-para não distingue automaticamente. Preparar UI/seed; concluir vínculo quando os dados chegarem.
- **R3 — tipo genérico residual.** Deixar um "Manifestação" genérico ativo faz o motor casar tarefas nele em vez dos 3. Desativá-lo.

### Testing
- 3 registros ativos com prazos 5/10/15 e códigos distintos.
- Simulação sem prazo real → base+5/+10/+15; com prazo real → data real.
- Sync idempotente; near-miss listado.
- `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Depende de (entregues):** H6 (colunas de prazo `20260805000004`, CRUD de tipos-tarefa, `sync-task-types.ts`, precedência de prazo no `sync-core.ts`); A9 (de-para por nome `reconcile-projuris-tipos.ts`).
- **Bloqueio de dados:** 3 códigos ProJuris + pares previsto/fatal (pendência do Thiago — `reuniao-2026-08-07`).
- **Relaciona com M11** (prazo previsto/fatal do ProJuris): M11 garante o "real do ProJuris"; M10 garante o "default interno por prazo". Complementares.

## File List

**A definir na implementação. Previsto:**
- Dados: 3 registros em `system_task_type_mapping` (via UI ou seed `sistema-hv/supabase/migrations/20260807xxxxxx_manifestacao_prazos_seed.sql` + rollback).
- `sistema-hv/src/routes/controladoria.distribuicao.tipos-tarefa.tsx` (só uso; ajuste apenas se precisar melhorar a UX do near-miss).
- `sistema-hv/src/lib/distribuicao/sync-task-types.ts` (só uso; ajuste se o relatório de near-miss precisar destacar os 3 prazos).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial. Refinamento de H6/A9: "Manifestação" vira **3 tipos separados** (5/10/15 dias), um registro por prazo em `system_task_type_mapping`, cada um com seu `projuris_tipo_codigo`, `prazo_previsto_dias`/`prazo_fatal_dias` e pontuação. Reusa colunas de prazo (`20260805000004`), CRUD de tipos-tarefa e de-para por nome (`sync-task-types.ts`); resolve o near-miss conhecido "Manifestação (5/10/15 dias)" com vínculo manual quando o nome ProJuris não distinguir. Sem schema novo (seed opcional). Bloqueio de dados: 3 códigos + pares de prazo do Thiago. Motor v1.0 já aplica o prazo por tipo — story é dados + de-para. | @sm (Bob) |
