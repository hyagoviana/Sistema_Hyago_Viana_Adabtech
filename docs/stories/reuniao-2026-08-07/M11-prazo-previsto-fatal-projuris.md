# Story M11: Prazo previsto/fatal puxado do ProJuris por tarefa + refletir quando muda no ProJuris + registro interno como fallback (confirmar precedência real>interno)

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-07
- **ID:** M11
- **Status:** Ready for Review (confirmação — sem alteração de código)
- **Estimativa relativa:** M
- **Executor sugerido:** @dev + @architect + @data-engineer · Quality gate: @qa
- **Risco:** MÉDIO — a leitura do prazo real do ProJuris e a precedência real>interno JÁ existem (H6). O trabalho novo é garantir que o prazo **reflita quando muda no ProJuris** (re-sync atualiza o registro persistido) e documentar o que falta. Toca no fluxo de leitura/persistência do motor.
- **Origem:** Reunião 2026-08-07, item **M11** ("o motor puxa do ProJuris — cada tarefa tem lá; quando muda no ProJuris, reflete no sistema; manter também registro interno — decisão do Thiago: fica melhor ter interno"). Refinamento de H6.

> **O MOTOR v1.0 JÁ EXISTE.** `sync-core.ts` já lê `dataConclusaoPrevista` (prazo previsto) e `dataLimite` (prazo fatal) da tarefa do ProJuris a cada rodada, e H6 já implementou a precedência **real (ProJuris) > default interno (`prazo_*_dias`) > sentinela**. M11 é REFINAMENTO: (1) **confirmar** essa precedência por código, (2) garantir que uma mudança de prazo no ProJuris **reflita** no sistema no próximo sync (não fique "colado" no valor antigo), (3) documentar o que ainda falta (ex.: refletir prazo em tarefas já distribuídas/persistidas).

---

## Story

**Como** controladoria/administrador do motor de distribuição,
**quero** que o motor **puxe o prazo previsto e o prazo fatal do ProJuris** (cada tarefa tem os seus lá) e que, quando esses prazos **mudarem no ProJuris**, o sistema **reflita** a mudança; mantendo também um **registro interno** de prazo por tipo (`prazo_previsto_dias`/`prazo_fatal_dias`) como **fallback** quando a tarefa não trouxer o prazo,
**para** que os prazos das tarefas distribuídas fiquem sempre alinhados ao ProJuris (fonte autoritativa da tarefa), sem depender de digitação manual, e com um piso interno determinístico quando o ProJuris não informar.

> **DECISÕES TRAVADAS (reunião 2026-08-07):**
> 1. **Prazo real do ProJuris é a fonte** por tarefa (previsto = `dataConclusaoPrevista`; fatal = `dataLimite`).
> 2. **Reflete quando muda:** se o prazo mudar no ProJuris, o próximo sync atualiza o valor no sistema.
> 3. **Registro interno mantido** (`prazo_*_dias` por tipo, H6) como **fallback** — "fica melhor ter interno" (Thiago).
> 4. **Precedência:** real (ProJuris) > interno (default do tipo) > sentinela. **CONFIRMAR** que o código já faz isso (H6) e documentar o que falta.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Leitura do prazo real por tarefa:** `sistema-hv/src/lib/distribuicao/sync-core.ts:201-217` — por processo, `GET processo/{cod}/tarefa/consulta-multi-modulo`; extrai `prazo_fatal = msToIso(t.dataLimite)` e `prazo_interno = msToIso(t.dataConclusaoPrevista ?? t.dataLimite)`.
- **Precedência real>interno>sentinela (H6):** `sync-core.ts:406-421` — `fatal_date = rt.prazo_fatal ?? (tt.prazo_fatal_dias != null ? addDaysIso(distributionDate, tt.prazo_fatal_dias) : null) ?? "9999-12-31"`; `internal_limit_date` análogo com `prazo_previsto_dias`. **Já implementa** real > interno > sentinela.
- **Registro interno por tipo:** colunas `prazo_previsto_dias`/`prazo_fatal_dias` em `system_task_type_mapping` (H6, `20260805000004`), editáveis no diálogo de `controladoria.distribuicao.tipos-tarefa.tsx`.
- **Persistência dos resultados (onde o prazo "cola"):** `sync-core.ts` grava `system_distribution_results` por `distribution_date`+`organization_id`, apagando/reinserindo a cada rodada (idempotente por data — ver `20260805000003_distribution_results_allow_delete.sql`). Ou seja, **re-rodar o sync já re-lê o prazo do ProJuris** para aquela data.
- **De-para de processo/tarefa e alertas:** já montados no `runSync`.

### NOVO / A CONFIRMAR nesta story

- **Confirmação da precedência (doc):** validar por leitura que real>interno>sentinela está correto e cobre previsto **e** fatal (H6). Registrar.
- **Reflexo de mudança de prazo (o ponto de M11):** documentar/garantir que, quando o prazo muda no ProJuris, **um novo sync** reflete o novo valor. Como o `runSync` re-lê tudo e reinsere os results da data, o reflexo já ocorre **ao re-rodar**. O gap a investigar: (a) tarefas já **distribuídas em datas passadas** e persistidas — o novo prazo do ProJuris reflete nelas? (b) existe algum campo persistido "grudado" (ex.: prazo salvo num caso/ficha) que não re-sincroniza? Mapear e decidir o recorte (mínimo: refletir na rodada corrente; ideal: atualizar tarefas abertas persistidas).
- **(Se necessário) refresh de prazo em tarefas abertas persistidas:** se o owner quiser que o prazo mude também fora de um re-sync da mesma data (ex.: um job que varre tarefas abertas e atualiza `system_distribution_results`/campo do caso), definir o mecanismo. Provável FUTURO se sair do escopo "reflete no próximo sync".

---

## Acceptance Criteria

1. **Puxa o prazo do ProJuris (confirmado):** validado por código que o motor lê `dataConclusaoPrevista` (previsto) e `dataLimite` (fatal) da tarefa e os usa como fonte primária. Documentado em Dev Notes/Change Log.
2. **Precedência real>interno>sentinela (confirmada):** validado que `fatal_date`/`internal_limit_date` seguem real (ProJuris) > default interno (`prazo_*_dias`) > sentinela `9999-12-31`, para previsto **e** fatal (H6). Sem regressão.
3. **Registro interno como fallback:** com a tarefa **sem** prazo no ProJuris, o motor aplica `prazo_previsto_dias`/`prazo_fatal_dias` do tipo (base+N). Com prazo no ProJuris, ignora o interno e usa o real. Coberto por teste.
4. **Reflete mudança no ProJuris (rodada corrente):** alterar o prazo de uma tarefa no ProJuris e **re-rodar o sync** para a mesma data faz o resultado refletir o **novo** prazo (o `runSync` re-lê e reinsere; não "cola" no valor antigo).
5. **Gap de tarefas persistidas documentado:** a story mapeia e documenta se/como o prazo reflete em (a) tarefas de **datas passadas** já persistidas e (b) qualquer campo de prazo "espelhado" fora de `system_distribution_results`. Define o recorte (mínimo: rodada corrente) e registra o que fica para FUTURO (ex.: job de refresh de tarefas abertas).
6. **Fallback interno editável:** o admin continua podendo ajustar `prazo_*_dias` por tipo na UI de tipos-tarefa (reuso H6), servindo de piso quando o ProJuris não informar.
7. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; se houver DDL, `db:types` + rollback; RLS org-scoped preservada; nenhuma **escrita** no ProJuris (só leitura); nenhum segredo em log.

---

## Tasks / Subtasks

### T1 — Confirmação da precedência (@dev + @architect)
- [ ] Ler `sync-core.ts` (extração `prazo_fatal`/`prazo_interno` + construção de `fatal_date`/`internal_limit_date`) e **confirmar** real>interno>sentinela para previsto e fatal (H6). Documentar. (AC-1,2)

### T2 — Reflexo de mudança (@dev + @architect)
- [ ] Confirmar que re-rodar `runSync(mesma data)` re-lê o prazo do ProJuris e reinsere os results (idempotência por data via `20260805000003`), refletindo o novo prazo. (AC-4)
- [ ] Mapear o **gap** de tarefas persistidas em datas passadas / campos de prazo espelhados fora de `system_distribution_results`; documentar o recorte (mínimo: rodada corrente) e o que vira FUTURO (job de refresh). (AC-5)

### T3 — (Condicional) refresh de tarefas abertas (@dev) — só se dentro do escopo decidido em T2
- [ ] Se o owner incluir "refletir em tarefas abertas persistidas fora do re-sync", definir/implementar o mecanismo (varredura de tarefas abertas → atualiza prazo persistido). Caso contrário, marcar como FUTURO. (AC-5)

### T4 — UI (verificação) (@dev)
- [ ] Confirmar que `prazo_previsto_dias`/`prazo_fatal_dias` continuam editáveis em `tipos-tarefa.tsx` (fallback). (AC-6)

### T5 — QA (@qa)
- [ ] Tarefa com prazo no ProJuris → motor usa o real. (AC-1,2)
- [ ] Tarefa sem prazo → usa o interno (base+N). (AC-3)
- [ ] Mudar o prazo no ProJuris + re-sync mesma data → reflete o novo valor. (AC-4)
- [ ] `typecheck` + `lint` verdes. (AC-7)

---

## Dev Notes

**H6 já entregou o núcleo.** A precedência real>interno>sentinela está em `sync-core.ts:406-421` (previsto e fatal). M11 é sobretudo **confirmação + o eixo "reflete quando muda"**. Não reescrever a precedência; validar e documentar.

**"Reflete quando muda" = re-sync re-lê.** O `runSync` apaga e reinsere `system_distribution_results` por `distribution_date` (idempotente, `20260805000003`), lendo o ProJuris de novo. Então, para a **rodada corrente**, um prazo alterado no ProJuris já reflete ao re-rodar. O ponto delicado é o histórico: tarefas de datas passadas já persistidas **não** re-sincronizam sozinhas, e se algum fluxo espelhar o prazo num campo do caso/ficha, esse espelho pode ficar defasado. T2 mapeia isso; provável que o refresh contínuo de tarefas abertas seja FUTURO (fora deste recorte de "melhorias até segunda").

**Só leitura no ProJuris.** M11 **não** escreve no ProJuris (o write-back é outra frente — H3/A9-fase-2). Puxar prazo é leitura; refletir é escrever no **nosso** banco.

**Fallback interno é decisão do Thiago.** "Fica melhor ter interno" — manter `prazo_*_dias` por tipo como piso quando o ProJuris não informar. Não remover; é a rede de segurança determinística.

**Migrations via pg direto (se houver).** `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/`. dev=prod; rollback simétrico.

**Riscos:**
- **R1 — expectativa de reflexo automático fora do re-sync.** O owner pode esperar que mudar o prazo no ProJuris atualize o sistema **sem** re-rodar. Documentar que o reflexo é por sync (e propor job de refresh como FUTURO se necessário).
- **R2 — prazo espelhado defasado.** Se houver campo de prazo copiado para o caso/ficha, ele não re-sincroniza com o re-sync dos results. Mapear em T2.
- **R3 — regressão de precedência.** Mexer no fallback pode inverter real vs interno. Testes de "com prazo" vs "sem prazo" (R2 do H6) cobrem.

### Testing
- Com prazo ProJuris → `fatal_date`/`internal_limit_date` = data real.
- Sem prazo → base+`prazo_fatal_dias`/`prazo_previsto_dias`.
- Alterar no ProJuris + re-sync → novo prazo refletido nos results da data.
- `npm run typecheck` + `npm run lint` verdes.

---

## Dependências

- **Depende de (entregues):** H6 (colunas de prazo `20260805000004`, precedência real>interno no `sync-core.ts`, UI de tipos-tarefa); idempotência dos results por data (`20260805000003`); leitura de tarefas/prazos do ProJuris no `runSync`.
- **Relaciona com M10** (Manifestação por prazo): M10 define o **default interno** por prazo; M11 garante o **real do ProJuris** e o reflexo. Complementares.
- **Não** depende do write-back no ProJuris (H3/A9-fase-2) — M11 é leitura + persistência interna.

## File List

**A definir na implementação. Previsto (majoritariamente confirmação/doc):**
- `sistema-hv/src/lib/distribuicao/sync-core.ts` (confirmar precedência; ajuste só se T2 exigir refresh de persistidas).
- `sistema-hv/src/routes/controladoria.distribuicao.tipos-tarefa.tsx` (verificação do fallback editável — provável zero alteração).
- (condicional / FUTURO) job/rotina de refresh de tarefas abertas persistidas, se T2 incluir no escopo.

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft inicial. Refinamento de H6: **confirmar** e documentar que o motor puxa prazo previsto (`dataConclusaoPrevista`) e fatal (`dataLimite`) do ProJuris e aplica precedência real>interno>sentinela (já em `sync-core.ts`); garantir que uma mudança de prazo no ProJuris **reflete** ao re-rodar o sync (results idempotentes por data, `20260805000003`); manter `prazo_*_dias` por tipo como **fallback** (decisão do Thiago). Mapear e documentar o gap de tarefas persistidas em datas passadas / prazos espelhados (recorte mínimo = rodada corrente; refresh contínuo = FUTURO). Só leitura no ProJuris. Motor v1.0 já lê o prazo — story é confirmação + eixo "reflete quando muda". | @sm (Bob) |
| 2026-08-08 | v1.0 | **CONFIRMADO por código (@aios-master/Orion) — sem alteração de código.** T1: extração em `sync-core.ts:214-215` — `prazo_fatal = msToIso(t.dataLimite)`, `prazo_interno = msToIso(t.dataConclusaoPrevista ?? t.dataLimite)`. T1/AC-2/AC-3: precedência em `sync-core.ts:432-443` — `fatal_date = rt.prazo_fatal ?? (base+prazo_fatal_dias) ?? '9999-12-31'`; `internal_limit_date = rt.prazo_interno ?? rt.prazo_fatal ?? (base+prazo_previsto_dias) ?? (base+prazo_fatal_dias) ?? '9999-12-31'` = **real (ProJuris) > interno (default do tipo) > sentinela**, para previsto E fatal. AC-4 (reflete): `runSync` faz DELETE dos `system_distribution_results` de `(org, distribution_date)` (`:477-481`, exige `20260805000003`) e reinsere (`:533-535`) — re-rodar a MESMA data re-lê o ProJuris e reflete o novo prazo (não "cola"). AC-5 (gap): o prazo vive só em `system_distribution_results` por data; **datas passadas já persistidas NÃO re-sincronizam sozinhas** (só re-rodando aquela data) e **não há campo de prazo espelhado** fora dos results (o espelho na aba Judicial é a story FUTURA de campos judiciais). Recorte = rodada corrente; job de refresh contínuo de tarefas abertas = **FUTURO**. AC-6: `prazo_*_dias` seguem editáveis em `controladoria.distribuicao.tipos-tarefa.tsx` (H6). Retorno Thiago 08-08 reforça: "prazo previsto e fatal já constam nos dados do ProJuris" — bate com a leitura. Só leitura no ProJuris (nenhuma escrita). | @aios-master (Orion) |
