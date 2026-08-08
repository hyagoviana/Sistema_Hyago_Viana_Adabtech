# Story M14: Responsável exclusivo (exceções) — confirmar/completar os 4 (Audiência→Thiago, Sustentação Oral→Thiago, INDENIZAÇÃO PMMB→Thaíse, TEMFC→Ana Patrícia Cruz)

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-07
- **ID:** M14
- **Status:** Ready for Development (recorte pequeno — seed + validação; 1 dos 4 ainda não está semeado)
- **Estimativa relativa:** S
- **Executor sugerido:** @data-engineer · Quality gate: @qa
- **Risco:** BAIXO — mecanismo já existe e é honrado pelo engine; falta 1 seed (Sustentação Oral→Thiago) + validação dos 3 já semeados.
- **Origem:** `docs/reunioes/reuniao-2026-08-07-melhorias-ate-segunda.md` (M14) + transcrição "Matheus Torquato [0601]" (linhas 97–104): "o Thiago é sempre de audiência … o Thiago … também a sustentação oral … a indenização PMMB, a Thaíse, e o TEMFC, a Patrícia … Toda vez que tiver uma tarefa dessa, independentemente do tempo … tem que estar lá na configuração de tarefas … tipo pessoa obrigatória".

---

> **NOTA DE ESCOPO:** O mecanismo de **responsável exclusivo JÁ EXISTE e JÁ É HONRADO** pelo motor (`engine/flow-selector.ts` → `detectAbsoluteResponsible` → fluxo `ABSOLUTE`). **3 dos 4** já foram semeados na migration `20260805000002_distribution_exclusive_executors.sql` (Audiência→Thiago, PMMB→Thaíse, TEMFC→Ana Patrícia). O que **falta** é **Sustentação Oral→Thiago** (não está no seed). Esta story = **1 seed novo + validação dos 4** (e documentar a precedência). NÃO é UI nova nem tabela nova.

---

## Story

**Como** controladoria do motor,
**quero** que as 4 regras de **responsável exclusivo** estejam corretamente semeadas e honradas — **Audiência→Thiago**, **Sustentação Oral→Thiago**, **INDENIZAÇÃO PMMB→Thaíse**, **TEMFC→Ana Patrícia Cruz** —,
**para** que **toda** tarefa desses tipos/temas vá **direto** ao executor obrigatório (fluxo `ABSOLUTE`, "independentemente do tempo"), sem entrar no rodízio/preferência.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Colunas de exclusividade:** `system_task_type_mapping.exclusive_executor_id` (nível TIPO) e `system_theme_mapping.exclusive_executor_id` (nível TEMA), FK `system_users(id)` — migration `20260805000002_distribution_exclusive_executors.sql`.
- **Precedência honrada pelo engine:** `sistema-hv/src/lib/distribuicao/engine/flow-selector.ts` → `detectAbsoluteResponsible`:
  1. `process.directed_executor_id`
  2. `task.theme_exclusive_executor_id` (nível TEMA)
  3. `task.task_type_exclusive_executor_id` (nível TIPO)
  ⇒ fluxo `ABSOLUTE` (vai direto, ignora fila/preferência).
- **`sync-core.ts` já propaga:** monta `theme_exclusive_executor_id` (de `system_theme_mapping`) e `task_type_exclusive_executor_id` (de `system_task_type_mapping`) na `Task`.
- **3 exceções JÁ semeadas** (`20260805000002`, via `system_projuris_executor_mapping.projuris_responsavel_id`):
  - **Audiência (TIPO, `projuris_tipo_codigo='6476501'`) → THIAGO (128858)** — usa o código numérico real para evitar a colisão `AUDIENCIA`/`audiencia_trabalhista`.
  - **INDENIZAÇÃO PMMB (TEMA, `projuris_tema_codigo='INDENIZAÇÃO PMMB'`) → THAÍSE (204546)**.
  - **TEMFC (TEMA, `projuris_tema_codigo='TEMFC'`) → Ana Patricia (131021)** — semeado no nível TEMA porque TEMFC existe como assunto/tema, não como tipo. **Confirma o ponto do M14:** Patrícia = **Ana Patrícia Cruz** (mesma pessoa; transcrição linha 93–95).
- **Executores semeados:** `20260805000001_distribution_executors_seed.sql` — Thiago(128858), Thaíse(204546), Ana Patricia Cruz(131021) existem em `system_users` + `system_projuris_executor_mapping`.
- **Tela de exceções pendentes** `controladoria.distribuicao.excecoes.tsx` — **ATENÇÃO: NÃO é a tela de "responsável exclusivo".** Ela é a triagem de tarefas **bloqueadas** (`system_distribution_exceptions`, alert_code/atribuir/ignorar). A exclusividade "pessoa obrigatória" mora nas colunas `exclusive_executor_id` (tipo/tema), configuráveis a partir da tela **`tipos-tarefa`** (link "Executor exclusivo" adicionado no H6). O Thiago disse que "tem que estar lá na configuração de tarefas" — bate com `tipos-tarefa`, não com `excecoes`.
- **Migrations via pg direto:** `npx tsx scripts/db-apply-pg.ts` da pasta `sistema-hv/`; dev=prod; rollback simétrico.

### NOVO (a construir nesta story)

- **Semear a 4ª regra: Sustentação Oral → Thiago (128858).** Precisa existir um tipo de tarefa "Sustentação Oral" em `system_task_type_mapping` com `projuris_tipo_codigo` real (código ProJuris). Se ainda não existir a linha, criar/vincular via `syncTaskTypesCore`/`reconcile-projuris-tipos.ts` (H6) e então setar `exclusive_executor_id = Thiago`.
- **Validação dos 4** (smoke): tarefa de cada tipo/tema resolve fluxo `ABSOLUTE` para o executor certo.

---

## Acceptance Criteria

1. **Sustentação Oral → Thiago semeado:** existe a linha de "Sustentação Oral" em `system_task_type_mapping` (com `projuris_tipo_codigo` real) e seu `exclusive_executor_id` = uuid do Thiago (resolvido via `system_projuris_executor_mapping.projuris_responsavel_id='128858'`, mesmo padrão do `20260805000002`). Seed idempotente + rollback.
2. **Os 3 já semeados confirmados:** Audiência(6476501)→Thiago, INDENIZAÇÃO PMMB(TEMA)→Thaíse, TEMFC(TEMA)→Ana Patricia continuam corretos (a story valida, não re-semeia se já OK).
3. **Precedência honrada (ABSOLUTE):** uma tarefa de cada um dos 4 resolve fluxo `ABSOLUTE` para o executor obrigatório no motor (via `detectAbsoluteResponsible`), "independentemente do tempo" (não entra no rodízio nem sofre preferência).
4. **Patrícia = Ana Patrícia Cruz:** documentado e refletido (o mapping já usa 131021 = Ana Patricia Cruz).
5. **Sem 3ª fonte de verdade:** a exclusividade permanece nas colunas `exclusive_executor_id` (tipo/tema) — **não** criar tabela nova nem usar `system_distribution_exceptions` (que é triagem de bloqueio) para isso.
6. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; RLS org-scoped preservada; seed idempotente (2×); rollback simétrico; SÓ LEITURA no ProJuris; nenhum segredo em log.

---

## Tasks / Subtasks

### T0 — Garantir a linha "Sustentação Oral" (@data-engineer)
- [ ] Verificar se "Sustentação Oral" já está em `system_task_type_mapping` com `projuris_tipo_codigo` real. Se não, casar via `syncTaskTypesCore` (H6) / `scripts/reconcile-projuris-tipos.ts` e obter o código ProJuris correto (evitar near-miss).

### T1 — Seed da 4ª exceção (@data-engineer)
- [ ] Migration `sistema-hv/supabase/migrations/2026080700000X_sustentacao_oral_exclusivo.sql` (+ rollback): resolve o uuid do Thiago via `system_projuris_executor_mapping` (128858) e faz `UPDATE system_task_type_mapping SET exclusive_executor_id = :thiago WHERE projuris_tipo_codigo = '<codigo_sustentacao_oral>' AND organization_id = :org`, com `GET DIAGNOSTICS` exigindo 1 linha (padrão do `20260805000002`). Aplicar via `db-apply-pg.ts` (idempotente, 2×).

### T2 — Validação dos 4 (@qa)
- [ ] Smoke/simulação: uma tarefa por regra → fluxo `ABSOLUTE` + executor correto (Audiência/Sustentação Oral→Thiago; PMMB→Thaíse; TEMFC→Ana Patricia). Conferir que não entram no rodízio.

### T3 — Documentar precedência e a tela certa (@sm/@dev)
- [ ] Registrar no story/Change Log: exclusividade = colunas `exclusive_executor_id` (tipo/tema), configuráveis pela tela `tipos-tarefa` (link "Executor exclusivo"); `excecoes.tsx` é triagem de bloqueio (não confundir).

### T4 — QA (@qa)
- [ ] `typecheck`/`lint` verdes; seed idempotente; rollback simétrico; RLS preservada.

---

## Dev Notes

- **Só falta 1 dos 4.** O grosso já foi entregue em `20260805000002`. Esta story é deliberadamente pequena: 1 seed + validação. Não recriar UI/tabela.
- **Sustentação Oral pode não ter código ainda.** Se o de-para (H6) não tiver casado esse tipo, resolver o `projuris_tipo_codigo` primeiro (via sync/reconcile) — senão o `UPDATE` afeta 0 linhas e o `GET DIAGNOSTICS` levanta exceção (bom: falha barulhenta em vez de silenciosa).
- **Colisão de nome (Audiência):** o seed existente usa o código numérico `6476501` justamente para fugir da colisão `AUDIENCIA`/`audiencia_trabalhista`. Aplicar o mesmo cuidado para Sustentação Oral (usar código, não nome).
- **"Configuração de tarefas" = `tipos-tarefa`.** O Thiago espera achar a "pessoa obrigatória" na configuração da tarefa; o H6 já expôs o link "Executor exclusivo" ali. Se o owner quiser, a story pode (opcional) tornar o campo `exclusive_executor_id` **editável inline** na própria tela `tipos-tarefa` em vez de só linkar para exceções — anotado como evolução, fora do mínimo.
- **Migrations via pg direto** (`reference_aplicar_migrations_pg_direto`): `npx tsx scripts/db-apply-pg.ts`; dev=prod; rollback simétrico.

**Riscos:**
- **R1 — código de Sustentação Oral inexistente/errado** → UPDATE 0 linhas. Mitigação: `GET DIAGNOSTICS` exigindo 1 (falha explícita) + resolver o código via H6 antes.
- **R2 — precedência tipo vs tema:** se um mesmo caso for TEMFC (tema→Ana) E tiver tarefa Audiência (tipo→Thiago), a precedência é **tema antes de tipo** (`detectAbsoluteResponsible`). Documentar; provavelmente aceitável, mas confirmar com owner se há conflito real.

### Testing
- Migration aplicada: os 4 `exclusive_executor_id` corretos.
- Simulação: tarefa de cada regra → `ABSOLUTE` + executor certo; não entra no rodízio.
- Seed 2× idempotente; rollback remove só a 4ª regra.
- `typecheck`/`lint` verdes.

---

## Dependências

- **Depende de (entregues):** `20260805000002_distribution_exclusive_executors.sql` (colunas + 3 seeds); `20260805000001` (executores Thiago/Thaíse/Ana); `engine/flow-selector.ts` (`detectAbsoluteResponsible`); `sync-core.ts` (propaga exclusivos); H6 (`syncTaskTypesCore`/`reconcile-projuris-tipos.ts`, tela `tipos-tarefa`).
- **Insumo:** código ProJuris de "Sustentação Oral" (resolver via H6 se ausente).
- **Relaciona com:** M12 (tipos/pontuação — Sustentação Oral pode ser um dos que ganham pontuação), M13, H4 (tema→exclusivo).

## File List (previsto)

- `sistema-hv/supabase/migrations/2026080700000X_sustentacao_oral_exclusivo.sql` (NOVO — seed idempotente da 4ª exceção, padrão do `20260805000002`).
- `sistema-hv/supabase/rollbacks/2026080700000X_sustentacao_oral_exclusivo.rollback.sql` (NOVO — zera só o `exclusive_executor_id` de Sustentação Oral).
- (opcional/evolução) `sistema-hv/src/routes/controladoria.distribuicao.tipos-tarefa.tsx` — tornar `exclusive_executor_id` editável inline (hoje é link para exceções).

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft. Mecanismo de responsável exclusivo já existe e é honrado (`flow-selector.detectAbsoluteResponsible` → ABSOLUTE); 3/4 já semeados em `20260805000002` (Audiência→Thiago, PMMB→Thaíse, TEMFC→Ana Patricia=Patrícia). Esta story = seed da 4ª (**Sustentação Oral→Thiago**, resolvendo o código via H6) + validação dos 4 + documentar que a "config de tarefa" é `tipos-tarefa` (não `excecoes.tsx`, que é triagem de bloqueio). Sem tabela/UI nova; sem 3ª fonte de verdade. | @sm (Bob) |
