# Story M12: 14 tipos ProJuris sem pontuação — refletir no sistema E na lista com a MENOR pontuação como placeholder (alguns saem)

- **Épico:** ProJuris / Distribuição — Reunião 2026-08-07
- **ID:** M12 (numeração da reunião: M12)
- **Status:** **Blocked — aguardando insumo do Thiago** (quais dos 14 ficam/saem + a pontuação de cada um que fica)
- **Estimativa relativa:** M
- **Executor sugerido:** @data-engineer + @dev · Quality gate: @qa
- **Risco:** BAIXO — seed aditivo/idempotente + edição por tela já existente; o único ponto sensível é a pontuação placeholder (mitigado: usa a MENOR existente, não zera, e o Thiago ajusta depois).
- **Origem:** `docs/reunioes/reuniao-2026-08-07-melhorias-ate-segunda.md` (M12) + transcrição "Matheus Torquato [0601]" (linhas 149–159: "reflete eles no meu sistema e reflete eles na lista do sistema. E coloca, só coloca a menor pontuação que tiver … depois eu vou poder mudar essas pontuações. E se for o caso, a gente apaga").

---

> **NOTA DE ESCOPO:** Esta story **NÃO cria a tela nem o schema** — a tela `controladoria.distribuicao.tipos-tarefa.tsx`, os hooks (`useUpsertTaskTypeMapping`), a tabela `system_task_type_mapping` e o botão "Sincronizar tipos" (`syncTaskTypesCore`) **já existem** (H6, 2026-08-05). Esta story descreve a **MECÂNICA** de trazer os 14 tipos hoje sem pontuação para dentro do sistema com um placeholder seguro, e o ajuste manual quando o Thiago mandar os dados. É a "última milha" de dados, não de código.

---

## Story

**Como** controladoria do motor de distribuição,
**quero** que os **14 tipos de tarefa que existem no ProJuris mas não estão na planilha de pontos do Thiago** sejam refletidos no sistema (na `system_task_type_mapping` e, por consequência, na lista de "Tipos de tarefa"), recebendo como **placeholder a MENOR pontuação (`points`) hoje existente** entre os tipos já cadastrados,
**para** que nenhuma tarefa desses tipos caia fora do motor por "tipo não mapeado" (hoje `sync-core.ts` faz `continue` quando o tipo não está no `ttMap`), enquanto o Thiago decide **quais ficam / quais saem** (ex.: "Lembrete" sai) e **manda a pontuação real** de cada um — que então é ajustada na tela sem novo deploy.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Tabela:** `system_task_type_mapping` — `projuris_tipo_codigo`, `projuris_tipo_descricao`, `motor_task_type_id`, `points NUMERIC(10,4) DEFAULT 1.0`, `complexity_level`/`temporal_level` (0-2), `prazo_previsto_dias`/`prazo_fatal_dias`, `exclusive_executor_id`, `active`; UNIQUE `(projuris_tipo_codigo, organization_id)`. Migrations `20260728000001` / `...000003` / `20260805000002` / `20260805000004`.
- **Tela + hooks:** `sistema-hv/src/routes/controladoria.distribuicao.tipos-tarefa.tsx` (CRUD por diálogo: código/descrição/motor_id/pontos/complexidade/temporalidade/prazos/ativo + filtro + export CSV) e `sistema-hv/src/hooks/useDistribuicao.ts` (`useTaskTypeMappings`, `useUpsertTaskTypeMapping`, `useSyncTaskTypes`). **É por AQUI que o Thiago ajusta a pontuação depois.**
- **Sincronização de tipos (H6):** `sistema-hv/src/lib/distribuicao/sync-task-types.ts` (`syncTaskTypesCore`, de-para por nome, SÓ LEITURA no ProJuris) + `sincronizarTiposTarefaFn` em `sistema-hv/src/rpc/distribuicao.ts` + `scripts/reconcile-projuris-tipos.ts` (de-para por nome normalizado, casou 38-39/44). Estes já sabem LISTAR os tipos do ProJuris (`GET /tipo?chave-tipo=tarefa-tipo`) e casar por nome — os 14 "não mapeados" são exatamente os que o sync deixa como near-miss/sem linha.
- **Consumo no motor:** `sistema-hv/src/lib/distribuicao/sync-core.ts` — `ttMap = system_task_type_mapping (active)`; `const tt = ttMap.get(rt.tipo_codigo); if (!tt) continue;` (tipo não mapeado é descartado). Ou seja: **enquanto os 14 não estiverem na tabela, tarefas desses tipos somem do batch sem virar alerta.**
- **Migrations via pg direto:** `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` da pasta `sistema-hv/` (CLI Supabase quebrado no Windows/OneDrive; ver `reference_aplicar_migrations_pg_direto`). dev=prod; rollback simétrico obrigatório.

### NOVO (a construir nesta story)

- **Seed idempotente dos 14 tipos** (`system_task_type_mapping`), com `points` = **MENOR `points` existente** entre os tipos ativos da org (placeholder), `motor_task_type_id` derivado do código/nome, `complexity_level=0`/`temporal_level=0`, `active=true`. Idempotente por `(projuris_tipo_codigo, organization_id)` (ON CONFLICT DO NOTHING para NÃO sobrescrever ajustes manuais posteriores do Thiago).
- **Lista dos 14 códigos/nomes** (input do Thiago) e **decisão ficam/saem** — o que SAI **não** entra na tabela (ou entra `active=false`); o que FICA entra com placeholder.
- **Ajuste da pontuação real** pela tela existente quando o Thiago mandar os números (sem código novo).

---

## ⏳ O QUE FALTA O THIAGO MANDAR (desbloqueia esta story)

1. **Os 14 tipos** — a lista exata (código ProJuris + nome) que o Matheus levantou; o Thiago disse "me passa os nomes que aí eu vou te passar quais deles ficam e quais vão ser mantidos".
2. **Quais FICAM e quais SAEM** (ex.: "Lembrete" → SAI). Só os que ficam recebem o placeholder.
3. **A pontuação real** de cada um que fica (o Thiago disse que manda "só amanhã", junto com a lista de colaboradores). Até chegar, vale a MENOR pontuação existente.

> Sem (1)+(2) o seed não pode ser escrito com a lista definitiva. Enquanto isso, a story fica **Blocked**; o time pode adiantar a T1 (helper que calcula a MENOR pontuação) e a T2 (formato do seed), mas **não** aplica no banco até a lista chegar.

---

## Acceptance Criteria

1. **Menor pontuação como placeholder:** o valor de `points` semeado nos 14 (que ficarem) é **exatamente** o menor `points` entre os tipos ativos já cadastrados na org (`SELECT MIN(points) FROM system_task_type_mapping WHERE organization_id = :org AND active = true`), calculado no momento do seed. Não usar 0 nem o default 1.0 arbitrário.
2. **Refletido nos dois lados:** cada tipo que FICA passa a existir em `system_task_type_mapping` (⇒ aparece automaticamente na lista da tela `tipos-tarefa` e passa a ser reconhecido pelo `ttMap` do `sync-core.ts`, deixando de ser descartado por "tipo não mapeado"). "reflete eles no meu sistema e reflete eles na lista do sistema" (Thiago).
3. **Os que SAEM não entram:** os tipos marcados para sair (ex.: "Lembrete") **não** são semeados como ativos — ou não entram, ou entram `active=false` com comentário. Documentar a lista dos que saíram.
4. **Idempotente / não destrutivo:** rodar o seed 2× não duplica nem sobrescreve `points`/`complexity`/`temporal`/prazos ajustados manualmente depois (ON CONFLICT `(projuris_tipo_codigo, organization_id)` DO NOTHING). Rollback simétrico remove só as linhas semeadas por esta story.
5. **Ajuste posterior sem deploy:** quando o Thiago mandar as pontuações reais, o admin as edita pela tela `tipos-tarefa` (`useUpsertTaskTypeMapping`) — a story valida que a edição persiste e o motor passa a pontuar com o valor novo.
6. **Regressão/segurança:** `npm run typecheck` + `npm run lint` verdes; `db:types` regenerado se o seed vier como migration; RLS org-scoped preservada; SÓ LEITURA no ProJuris (a story não escreve nada lá); nenhum segredo em log.

---

## Tasks / Subtasks

### T0 — Receber os insumos do Thiago (@sm / owner) — DESBLOQUEIO
- [ ] **BLOCKER:** obter a lista dos 14 tipos (código + nome), a marcação ficam/saem, e as pontuações reais (quando vierem). Registrar no anexo desta story.

### T1 — Helper "menor pontuação" (@data-engineer)
- [ ] Query/const que resolve `MIN(points)` entre os tipos ativos da org no momento do seed (não hardcodar). Cobrir o caso de a tabela estar vazia (fallback documentado = 1.0, o default da coluna).

### T2 — Seed idempotente (@data-engineer)
- [ ] Migration `sistema-hv/supabase/migrations/2026080700000X_task_types_placeholder_seed.sql` (+ rollback simétrico) que insere APENAS os que FICAM, com `points = <menor existente>`, `complexity_level=0`, `temporal_level=0`, `active=true`, `motor_task_type_id` determinístico, `projuris_tipo_codigo`/`projuris_tipo_descricao` da lista. `ON CONFLICT (projuris_tipo_codigo, organization_id) DO NOTHING`. Aplicar via `npx tsx scripts/db-apply-pg.ts` (rodar 2× → idempotente). Atualizar `src/lib/supabase/types.ts` se necessário (só dados, provável no-op de schema).
- [ ] Alternativa operacional (se o Thiago preferir cadastrar pela UI): os 14 podem ser adicionados manualmente pela tela `tipos-tarefa` — documentar as duas vias; a migration é a preferida (auditável/reproduzível).

### T3 — Validação do reflexo no motor (@dev)
- [ ] Confirmar que, após o seed, `ttMap.get(codigo)` casa os 14 e o `sync-core.ts` deixa de descartá-los (uma rodada de `runSync` mostra `tarefas_mapeadas` maior e nenhum desses tipos como "não mapeado").

### T4 — Ajuste da pontuação real (@dev + owner) — pós-insumo
- [ ] Com as pontuações reais do Thiago, editar cada tipo pela tela `tipos-tarefa`; confirmar persistência e o novo `points` refletido no scoring.

### T5 — QA (@qa)
- [ ] Seed 2× sem duplicar/sobrescrever; os que saíram ausentes/inativos; `typecheck`/`lint` verdes; SÓ LEITURA no ProJuris.

---

## Dev Notes

- **Por que MENOR pontuação e não 0/1:** decisão explícita do Thiago (transcrição) — coloca o piso existente como placeholder "para não bagunçar o ranking" e ajusta depois. Zerar tiraria a tarefa do peso; usar 1.0 (default) poderia ficar acima/abaixo do piso real. Calcular `MIN(points)` no ato é o mais fiel.
- **Não sobrescrever ajuste manual:** `ON CONFLICT DO NOTHING` é obrigatório — se o seed rodar depois que o Thiago já ajustou a pontuação pela tela, ele NÃO pode reverter para o placeholder.
- **"Lembrete" sai:** exemplo confirmado do que não vira tarefa de distribuição. A lista final dos que saem vem do Thiago; documentar aqui quando chegar.
- **Casamento com H4/H6:** os 14 são justamente os que o `syncTaskTypesCore` (H6) lista como sem linha/near-miss. Uma alternativa é estender o toast do sync para oferecer "criar os faltantes com placeholder" — fora do escopo mínimo desta story, mas anotado como evolução.
- **Prazo previsto/fatal (M11):** o motor puxa do ProJuris (`sync-core.ts` real > default interno `prazo_*_dias` > sentinela). Para os 14, deixar `prazo_*_dias` NULL (sem default) — o real do ProJuris manda; só cria default se o Thiago pedir.

**Riscos:**
- **R1 — placeholder vira definitivo:** se o Thiago esquecer de ajustar, os 14 ficam no piso. Mitigação: listar no relatório/indicadores os tipos ainda no placeholder (follow-up).
- **R2 — código ProJuris errado no seed:** se a lista vier por NOME e não por CÓDIGO, casar via `syncTaskTypesCore`/`reconcile-projuris-tipos.ts` antes de semear (o UNIQUE é por código).

### Testing
- Seed aplicado: os N tipos-que-ficam existem com `points = MIN` existente; os que saem ausentes/inativos.
- Seed 2× → idempotente; ajuste manual anterior preservado.
- `runSync` deixa de descartar esses tipos.
- Edição de pontuação pela tela persiste e reflete no scoring.

---

## Dependências

- **Depende de (entregues):** `system_task_type_mapping` + colunas de prazo/exclusivo; tela/hooks de `tipos-tarefa`; `syncTaskTypesCore`/`reconcile-projuris-tipos.ts` (H6); `sync-core.ts` (`ttMap`).
- **Bloqueado por (insumo do Thiago):** lista dos 14 + ficam/saem + pontuações reais.
- **Relaciona com:** M13 (complexidade/urgente — os mesmos tipos podem receber marcador depois), M14 (exceções — algum dos 14 pode ser exclusivo).

## File List (previsto — nada implementado até desbloqueio)

- `sistema-hv/supabase/migrations/2026080700000X_task_types_placeholder_seed.sql` (NOVO — seed idempotente dos que ficam, `points = MIN` existente).
- `sistema-hv/supabase/rollbacks/2026080700000X_task_types_placeholder_seed.rollback.sql` (NOVO — remove só as linhas semeadas).
- (sem mudança de código de app; a tela/hook/sync já existem.)

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-07 | v0.1 | Draft. **Blocked** aguardando os 14 tipos + ficam/saem + pontuações do Thiago. Mecânica: seed idempotente (`ON CONFLICT DO NOTHING`) com `points = MIN(points)` existente como placeholder; reflete na tabela ⇒ lista + `ttMap` do `sync-core` (deixa de descartar); ajuste real depois pela tela `tipos-tarefa` sem deploy. Reusa H6 (`syncTaskTypesCore`/`reconcile-projuris-tipos.ts`) para casar código. | @sm (Bob) |
