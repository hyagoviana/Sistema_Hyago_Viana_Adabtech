# Story H1: Mapear ID → nome do ProJuris (executor / tipo de tarefa / processo)

**Épico:** ProJuris / Distribuição — Reunião 2026-08-05
**ID:** H1
**Status:** Ready for Review
**Estimativa:** M
**Executor sugerido:** @data-engineer + @dev · Quality gate: @qa
**Risco:** MÉDIO — só leitura no ProJuris + de-para em banco; risco = casamento incorreto código↔nome (dado errado na tela)

---

> **NOTA DE ESCOPO (comum às stories H1–H4):** O **motor v1.0 JÁ EXISTE e é funcional** (`src/lib/distribuicao/engine/` + `sync-core.ts` + tabelas `system_distribution_*` das migrations `20260728*`/`20260729*`/`20260805*` + 13 rotas `controladoria.distribuicao.*` + cron + RPC). Estas stories **NÃO reconstroem o motor** — fecham a **integração ProJuris** e a **UX de operação** (ID→nome, aprovação, writeback, resolução de tema). Toda a base de scoring/fluxo/datas/fila permanece intacta.

---

## Story

**Como** controladoria/gestor operando o motor de distribuição,
**quero** que os resultados da distribuição mostrem o **NOME** do executor, do tipo de tarefa e do processo (não só os códigos numéricos que a API do ProJuris devolve),
**para** conseguir conferir na tela **quem** recebeu **qual** tarefa em **qual** processo — coisa que na reunião de 05/08 não era possível ("a API só traz número, não dava pra identificar quem era o executor").

> **Chave de casamento (travada):** usar o **IDENTIFICADOR INTERNO do ProJuris** como chave — `codigoUsuario` (executor), `codigoTarefaTipo` (tipo de tarefa) e `codigoProcesso` (processo) — **NÃO** o número do processo judicial (`numeroProcesso` CNJ, que é rótulo humano e não serve de chave estável). O `numeroProcesso` é exibido junto ao nome, mas o de-para é indexado pelo código interno.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Descobertas de API (A9, 2026-08-05):** `GET /usuario` retorna `{ simpleDto: [ { chave: <código>, valor: <nome> } ] }` — **`chave` = código, `valor` = nome**. Rodou real: **15 usuários** (ex.: `128858 THIAGO CORREIA SILVA`, `204546 THAISE`, `130405 HYAGO ALVES VIANA`, `131021 Ana Patricia Cruz`). E-mail NÃO vem nessa rota.
- **Tipos de tarefa:** `GET /tipo?chave-tipo=tarefa-tipo` → envelope `{ consultaTipoRetorno: [ { simpleDto: [ { chave, valor } ] } ] }`; **52 tipos** desempacotados (ex.: `3925771 Despacho`, `3843106 Apelação`, `6476501 Audiência`, `6050441 Sustentação Oral`).
- **Cliente ProJuris:** `sistema-hv/src/lib/projuris/client.ts` — `projurisGet(path, query?)` (só leitura, cache de token 8h, retry Bearer em 401). Usar `GET usuario` e `GET tipo?chave-tipo=tarefa-tipo`.
- **Normalizador:** `sistema-hv/src/lib/projuris/normalizer.ts` — hoje já extrai `tipo_tarefa_codigo` + `tipo_tarefa_nome` da tarefa (`codigoTarefaTipo`/`nomeTarefaTipo`) e `responsavel_cod`/`responsavel_nome` da intimação (`usuariosResponsaveis[0].codigoUsuario` / `nomeResponsavel`). Ou seja, **o nome do tipo e do responsável já vêm no payload da tarefa/intimação** — o gap é nos RESULTADOS gravados/exibidos, que só guardam código.
- **Núcleo do batch:** `sistema-hv/src/lib/distribuicao/sync-core.ts` — grava `system_distribution_results` com `task_id`, `process_id` (= `codigoProcesso` string), `executor_id` (UUID `system_users.id`); **NÃO grava nome de tipo nem número do processo**. Já resolve `executor_id → full_name` via `system_users` para o resumo `byExecutor` (map `nameById`).
- **Tabelas de de-para:** `system_task_type_mapping` (`projuris_tipo_codigo`, `projuris_tipo_descricao`, `motor_task_type_id`), `system_theme_mapping` (`projuris_tema_codigo`, `projuris_tema_descricao`), `system_projuris_executor_mapping` (`executor_id` UUID ↔ `system_users`; ver H5 para `projuris_responsavel_id`). Migration base: `20260728000001_distribution_schema.sql`.
- **UI de resultados:** `sistema-hv/src/routes/controladoria.distribuicao.lista.tsx` — hoje a tabela exibe `r.executor_id` (UUID cru!), `r.process_id` (código cru), sem nome de tipo. O CSV (`exportCSV`) idem. É AQUI que o número aparece em vez de nome.
- **Executor → nome:** `useExecutorMappings()` (`useDistribuicao.ts`) já traz `system_users.full_name` aninhado — a lista só não usa em toda coluna.

### NOVO (a construir nesta story)

- **De-para persistido/cacheado** código ProJuris → nome, para os 3 eixos:
  - **executor:** já resolvível por `system_projuris_executor_mapping` → `system_users.full_name` (não depende do ProJuris em runtime).
  - **tipo de tarefa:** `system_task_type_mapping.projuris_tipo_descricao` (nome ProJuris) — já populado pelo de-para do A9 nos 38 tipos; garantir preenchimento e usar como fonte do nome.
  - **processo:** guardar o `numeroProcesso` (CNJ humano) junto ao resultado para exibição — hoje só há `process_id` (= `codigoProcesso`).
- **Script/rotina de sincronização do de-para** (idempotente) que puxa `GET /usuario` e `GET /tipo?chave-tipo=tarefa-tipo` e atualiza as descrições/nomes nas tabelas de mapping (cache local — o motor não busca fora a cada rodada; alinha com H6/I2).
- **Exibir NOME** (executor, tipo, processo) na `lista.tsx` (+ Sheet de detalhe + CSV) e onde os resultados aparecem.

---

## Acceptance Criteria

1. **De-para de executor (código ProJuris → nome):** dado um `system_distribution_results.executor_id` (UUID), a tela resolve o **nome do executor** via `system_projuris_executor_mapping` → `system_users.full_name`, SEM chamar o ProJuris em runtime. Nenhum UUID cru aparece na coluna "Executor" da `lista.tsx`.

2. **De-para de tipo de tarefa (código → nome):** cada resultado exibe o **nome do tipo de tarefa** resolvido a partir do `projuris_tipo_codigo` (código interno ProJuris) via `system_task_type_mapping.projuris_tipo_descricao`. Para isso, o resultado precisa carregar o código/nome do tipo (ver AC-5) — hoje `system_distribution_results` não guarda o tipo.

3. **De-para de processo (código interno → número + nome):** cada resultado exibe o **`numeroProcesso` (CNJ)** legível além do `codigoProcesso` interno. A **chave** de casamento continua sendo o `codigoProcesso` (identificador interno ProJuris), não o `numeroProcesso`.

4. **Sincronização do de-para (cache local, idempotente):** existe uma rotina/script que autentica no ProJuris (client existente), lê `GET /usuario` (15 usuários) e `GET /tipo?chave-tipo=tarefa-tipo` (52 tipos), e **atualiza** `system_projuris_executor_mapping`/`system_task_type_mapping` com os nomes/descrições ProJuris (`projuris_tipo_descricao` e, para executores, o mapeamento código→`system_users`). Re-rodar não duplica (upsert por código + `organization_id`). O motor lê o de-para do **banco**, não do ProJuris, a cada distribuição (H6/I2).

5. **Persistir os dados de exibição no resultado:** o `runSync` (`sync-core.ts`) passa a gravar, por resultado, o suficiente para exibir nome sem novo GET — no mínimo `numeroProcesso` (do payload da intimação) e o `projuris_tipo_codigo`/nome do tipo escolhido pela tarefa. Se `system_distribution_results` não tiver colunas para isso, gravar em `raw_data` (JSONB já existente) — sem DDL nova se `raw_data` bastar; se precisar coluna, migration aditiva + rollback + `db:types`.

6. **Fallback sem quebrar:** código ProJuris sem correspondência no de-para (executor/tipo não sincronizado) exibe o código cru + um marcador visual ("(código N — nome não sincronizado)") e registra um alerta não-fatal; **não** quebra a renderização nem o batch.

7. **CSV coerente:** o `exportCSV` da `lista.tsx` passa a exportar NOME (executor, tipo, `numeroProcesso`) em vez de UUID/código cru.

8. **Regressão:** `npm run typecheck` + `npm run lint` verdes; nenhum segredo do ProJuris em log/front; só LEITURA no ProJuris (nenhum POST/PUT/DELETE de escrita); RLS org-scoped e imutabilidade dos `results` preservadas.

---

## Tasks / Subtasks

### T0 — Levantamento (@data-engineer + @dev)
- [x] `projuris_tipo_descricao` é preenchido pelo `reconcile-projuris-tipos.ts` (A9) + refrescado pelo novo `sync-projuris-de-para.ts`; os que faltam caem no fallback (AC-6). (AC-2, AC-4)
- [x] `system_distribution_results` perdia `numeroProcesso` e o tipo (só `process_id`/`executor_id`). **Decisão: `raw_data` (JSONB já existente)** — sem coluna nova / DDL zero. (AC-3, AC-5)

### T1 — Sincronização do de-para (cache local) (@data-engineer)
- [x] Criado `scripts/sync-projuris-de-para.ts` (idempotente): lê `GET /usuario` + `GET /tipo?chave-tipo=tarefa-tipo`, atualiza `projuris_tipo_descricao` pelos códigos numéricos e refresca `full_name` dos executores SINTÉTICOS (@projuris.local) — não sobrescreve nome de usuário real (respeita D-merge da H5). Só LEITURA no ProJuris; única escrita = UPDATE de cache. (AC-4)
- [ ] Validação de execução real (auth ProJuris + 2× sem duplicar) — PENDENTE @qa (o refresh token OAuth do app pode ter expirado — ver `reference_google_oauth_refresh_token`/A9). Lógica é idempotente por código. (AC-4)

### T2 — Persistir dados de exibição no resultado (@dev)
- [x] `sync-core.ts`: capturo `numeroProcesso` por `codigoProcesso` (da intimação) + `nomeTarefaTipo`/`codigoTarefaTipo` (da tarefa) e gravo em `raw_data` (`{ numero_processo, tipo_codigo, tipo_nome }`) NO INSERT dos resultados (tabela é append-only). Edições cirúrgicas — não reescrevi o arquivo (H11 em curso). (AC-5)
- [x] Sem coluna nova → sem migration (usei `raw_data`). (AC-5)

### T3 — Exibir NOME na UI (@dev)
- [x] `lista.tsx`: coluna "Executor" resolve via `useExecutorMappings()` → `full_name`; nova coluna "Tipo" via `raw_data.tipo_nome` (fallback `useTaskTypeMappings().projuris_tipo_descricao` por código); coluna "Processo" via `raw_data.numero_processo` (fallback `process_id`). Sheet de detalhe idem. (AC-1, AC-2, AC-3)
- [x] `exportCSV` exporta NOME (executor/tipo/numeroProcesso), com escaping de aspas. (AC-7)
- [x] Fallback visual "(cód. N — não sincronizado)" para código sem de-para; não quebra render. (AC-6)

### T4 — QA / regressão (@qa)
- [x] `npm run typecheck` verde (só erro pré-existente em `contaazul/service.ts`); `eslint` 0 erros nos arquivos tocados. Sem DDL → `db:types` não mexido. (AC-8)
- [ ] Smoke com distribuição real (dia de teste) → conferir NOME em executor/tipo/processo, CSV coerente, fallback sem quebra — PENDENTE @qa (depende de auth ProJuris no ar). (AC-1..7)

---

## Dev Notes

- **O nome já chega no payload — o gap é de persistência/exibição.** `normalizer.ts` já extrai `tipo_tarefa_nome`/`responsavel_nome`; `sync-core.ts` já resolve `executor_id→full_name` no resumo `byExecutor`. O que falta é (a) o **de-para de tipo em cache** e (b) **carregar nome/numeroProcesso no resultado gravado** para a lista não mostrar código cru.
- **Chave = identificador interno, não CNJ.** Decisão da reunião: casar por `codigoProcesso`/`codigoUsuario`/`codigoTarefaTipo` (estáveis) e exibir `numeroProcesso`/nome (humanos). Não usar `numeroProcesso` como chave (muda de formato, não indexa mapping).
- **Cache local ≠ busca externa a cada rodada** (H6/I2): a rotina de sync roda sob demanda/periódica e grava nomes no banco; o motor/telas leem do banco. Evita estourar o limite de 480 req/min do ProJuris e não depende de o ProJuris estar no ar para renderizar a lista.
- **Imutabilidade:** `system_distribution_results` tem trigger append-only (`system_prevent_distribution_modification`) — só `writeback_pending` muda por UPDATE. Portanto os dados de exibição têm que ser gravados **no INSERT** do `runSync` (via `raw_data`), não por UPDATE posterior.
- **Migrations via pg direto** (`reference_aplicar_migrations_pg_direto`): CLI Supabase quebrado no Windows/OneDrive → `npx tsx scripts/db-apply-pg.ts <arquivo.sql>`. dev=prod. Rollbacks em `sistema-hv/supabase/rollbacks/`.

**Riscos:**
- **R1 — de-para incompleto** (5 near-miss + colisão AUDIENCIA do A9): tipos sem `projuris_tipo_descricao` cairão no fallback (AC-6). Aceitável; owner resolve os near-miss depois.
- **R2 — Patrícia ausente:** a exceção TEMFC→Patrícia pode mapear para "Ana Patricia Cruz (131021)" — confirmar com owner (afeta H1 só na exibição do nome; não bloqueia).

---

## Testing

- **De-para (DB):** rodar a rotina de sync 2× → `projuris_tipo_descricao` preenchido, sem duplicatas; amostrar Despacho→3925771 / Audiência→6476501 / THIAGO→128858.
- **UI:** distribuir dia de teste → `lista.tsx` mostra nome de executor, nome de tipo e `numeroProcesso`; nenhum UUID/código cru; Sheet de detalhe idem; CSV com nomes.
- **Fallback:** injetar um código de tipo/executor sem de-para → UI mostra marcador "(não sincronizado)" + alerta não-fatal; batch/render não quebram.
- **Regressão:** só LEITURA no ProJuris; RLS/imutabilidade preservadas; `typecheck`/`lint` verdes.

---

## Dependências

- **Motor + tabelas** (`20260728*`/`20260805*`) e **client/normalizer** — JÁ existem; base desta story.
- **H5 (ID ProJuris + flag no usuário)** — o mapeamento executor↔`projuris_responsavel_id` vive lá; H1 consome. Se H5 ainda não estiver pronto, H1 resolve executor por `system_projuris_executor_mapping.executor_id` (UUID) → `full_name`, que já basta para exibir nome.
- **Auth ProJuris destravada** (client_id = `api_cliente_codigo_87696`) — JÁ resolvida no A9.
- **H4 (resolveTema)** — independente; podem ser feitas em paralelo.

---

## File List

**A definir na implementação. Previsto:**

**Scripts (novos/estendidos):**
- `sistema-hv/scripts/sync-projuris-de-para.ts` (ou estender `scripts/reconcile-projuris-tipos.ts`) — puxa `/usuario` + `/tipo?chave-tipo=tarefa-tipo`, atualiza descrições/mapeamentos.

**Código (estender):**
- `sistema-hv/src/lib/distribuicao/sync-core.ts` — gravar `numeroProcesso` + tipo (código/nome) em `raw_data` no INSERT dos resultados.
- `sistema-hv/src/routes/controladoria.distribuicao.lista.tsx` — colunas por NOME + fallback + CSV.
- `sistema-hv/src/hooks/useDistribuicao.ts` / `useDistribuicaoDashboard.ts` — join/derivação de nomes se necessário.

**Migrations (só se coluna nova for necessária):**
- `sistema-hv/supabase/migrations/2026080X_distribution_result_display_fields.sql` + rollback + `db:types`.

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). De-para código→nome resolvido do BANCO (sem GET em runtime): executor via `system_projuris_executor_mapping`→`full_name`, tipo via `raw_data.tipo_nome`/`system_task_type_mapping.projuris_tipo_descricao`, processo via `raw_data.numero_processo` (`codigoProcesso` continua a chave). Arquivos: `scripts/sync-projuris-de-para.ts` (NOVO — cache local idempotente, só leitura), `src/lib/distribuicao/sync-core.ts` (grava numeroProcesso + tipo no `raw_data` no INSERT; edições cirúrgicas), `src/routes/controladoria.distribuicao.lista.tsx` (colunas por NOME + coluna Tipo + fallback "não sincronizado" + CSV com nomes/escaping; tipos locais no lugar de `any`). Migrations: NENHUMA (usei `raw_data` JSONB existente — DDL zero). Gates: typecheck verde (só `contaazul` pré-existente); eslint 0 erros nos arquivos tocados. PENDENTE @qa: smoke com distribuição real + validar `sync-projuris-de-para.ts` contra ProJuris (auth pode precisar de refresh). | @dev |
