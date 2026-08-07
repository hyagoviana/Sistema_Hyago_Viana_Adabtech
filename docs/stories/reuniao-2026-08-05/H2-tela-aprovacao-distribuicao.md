# Story H2: Tela de aprovação da distribuição (aprovar / rejeitar / editar executor)

**Épico:** ProJuris / Distribuição — Reunião 2026-08-05
**ID:** H2
**Status:** Ready for Review
**Estimativa:** L
**Executor sugerido:** @dev + @architect · Quality gate: @qa + @architect
**Risco:** MÉDIO/ALTO — é o **portão humano** antes da efetivação/writeback (H3); um bug aqui deixa passar atribuição errada para produção

---

> **NOTA DE ESCOPO:** O **motor v1.0 JÁ EXISTE** (engine + `sync-core.ts` + tabelas + rotas `controladoria.distribuicao.*`). Esta story **NÃO reconstrói o motor** — adiciona a **etapa de operação humana** (aprovar-antes-de-escrever) sobre os resultados que o motor já produz. **O motor decide a regra internamente; a tela apenas confirma** e indica qual regra foi usada (cobre também **H10** do levantamento: "após rodar, a tela deve indicar a regra utilizada").

---

## Story

**Como** controladoria/gestor,
**quero** uma tela de **confirmação/aprovação** que, depois de o motor rodar, me mostre **por tarefa** o executor sugerido, a **regra aplicada** e os prazos, e me deixe **aprovar / rejeitar / editar o executor** antes de qualquer efetivação,
**para** que a lista de distribuição funcione como a **etapa final de entrega** — nada é escrito no ProJuris (H3) nem materializado sem meu aval — resolvendo o que a reunião pediu ("a lista de distribuição é a etapa final; a tela só confirma, o motor já decidiu a regra").

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Resultados do motor:** `system_distribution_results` (migration `20260728000001`) já guarda por tarefa: `task_id`, `process_id`, `executor_id`, `flow` (`ABSOLUTE`/`COMPLEX`/`GENERAL`), `final_points`, `base_date`, `applicable_limit`, `preferred_date`, `final_date`, `preference_applied`, `alerts[]`, `writeback_pending`, `blocked`. **Imutável** (trigger append-only; só `writeback_pending` muda por UPDATE).
- **Fluxo/regra já computados:** `sistema-hv/src/lib/distribuicao/engine/flow-selector.ts` deriva a precedência (executor dirigido → tema exclusivo → tipo-tarefa exclusivo → nível de complexidade) e o `flow`; `preference_applied` marca exceção/preferência aplicada. Ou seja, **a "regra utilizada" já está implícita** em `flow` + `preference_applied` + `alerts[]` — falta **rotulá-la** e exibi-la.
- **Sincronização sob demanda:** `sistema-hv/src/rpc/distribuicao.ts` (`sincronizarDistribuicaoFn`, gate `requireModule("controladoria","edit")`) + `sync-core.ts` (`runSync`) rodam o motor e gravam `results` como **simulação** (`batch_logs.is_simulation=true`, `writeback_pending=true`). Nada é escrito no ProJuris hoje.
- **Tela de lista:** `sistema-hv/src/routes/controladoria.distribuicao.lista.tsx` — já lista os resultados por data, com filtro por executor/flow/alertas, Sheet de detalhe e export CSV. **Falta o fluxo aprovar/rejeitar/editar-executor** (hoje é read-only).
- **Simulador:** `controladoria.distribuicao.simulador.tsx` + `system_distribution_simulations` — dry-run/what-if já existente.
- **Hooks:** `useDistributionResults` (`useDistribuicaoDashboard.ts`), `useExecutorMappings` (`useDistribuicao.ts`).
- **H1 (esta rodada):** de-para ID→nome — a tela de aprovação **depende de H1** para mostrar nome de executor/tipo/processo em vez de código.

### NOVO (a construir nesta story)

- **Estado de aprovação por tarefa/batch:** um resultado passa por `pending_approval → approved | rejected`; só `approved` é elegível para efetivar (H3) ou materializar. Como `system_distribution_results` é imutável (só `writeback_pending` muda), o estado de aprovação vai em **tabela nova** (ex.: `system_distribution_approvals`) referenciando o `result.id`, OU numa migration aditiva que estenda a exceção do trigger. Decisão de design = @architect.
- **Rótulo humano da regra aplicada** (H10): derivar de `flow` + `preference_applied` + qual exceção bateu (tema exclusivo / tipo exclusivo / executor dirigido / balanceamento por carga) um texto legível por tarefa ("Exceção: tema INDENIZAÇÃO PMMB → Thaise", "Balanceamento GENERAL por carga", "Complexo — rodízio", etc.).
- **Edição de executor** na aprovação: trocar o executor sugerido por outro elegível (registrando que foi override manual — alinha com `system_distribution_manual_assignments` já citado na infra e com o alerta `ALT-RESP-005` de H3).
- **Gate de efetivação:** só após "aprovar" o batch fica elegível para writeback (H3) / materialização.

---

## Acceptance Criteria

1. **Lista de aprovação por tarefa:** para uma `distribution_date`, a tela mostra cada tarefa distribuída com: **executor sugerido** (nome — H1), **regra aplicada** (rótulo legível — AC-2), **fluxo** (`ABSOLUTE`/`COMPLEX`/`GENERAL`), **prazos** (`preferred_date` previsto + `final_date`/`applicable_limit`), `final_points`, e `alerts[]`. Tarefas `blocked` aparecem destacadas e **não** são aprováveis.

2. **Regra aplicada explícita (H10):** cada linha exibe um **rótulo legível da regra** derivado de `flow` + `preference_applied` + exceção que bateu, cobrindo ao menos: *executor dirigido do processo*, *tema exclusivo*, *tipo-tarefa exclusivo*, *complexo (rodízio)*, *balanceamento GENERAL por carga*. O rótulo é derivado dos dados já gravados no resultado (não recomputa o motor).

3. **Ação Aprovar:** o operador aprova uma tarefa (ou o batch inteiro em massa). Aprovar registra `approved` + quem aprovou + timestamp, sem alterar os campos imutáveis do resultado.

4. **Ação Rejeitar:** o operador rejeita uma tarefa (com motivo opcional). Rejeitada NÃO é efetivada/materializada e NÃO entra no writeback (H3).

5. **Ação Editar executor:** o operador troca o executor sugerido por outro **elegível** (respeitando `authorized_task_types`/`authorized_themes`/`eligible_complex` de `system_projuris_executor_mapping`); a troca é registrada como **override manual** (rastreável — quem/quando/de→para) e a tarefa fica `approved` com o executor editado. O executor original permanece auditável.

6. **Portão de efetivação:** **somente** tarefas `approved` ficam elegíveis para o writeback ao ProJuris (H3) e/ou materialização. Enquanto o batch não é aprovado, `writeback_pending` permanece e nada é escrito fora.

7. **Aprovação em massa + segurança:** aprovar/rejeitar o batch todo de uma vez é possível, mas requer confirmação explícita; a ação é gateada por `requireModule("controladoria","edit")` (mesma régua do `sincronizarDistribuicaoFn`).

8. **Idempotência/re-sync:** se a data for re-sincronizada (o `runSync` apaga e reinsere os `results` da data — migration `20260805000003`), o estado de aprovação da data é invalidado/limpo de forma coerente (não fica aprovação "órfã" apontando para result deletado).

9. **Regressão:** `npm run typecheck` + `npm run lint` verdes; RLS org-scoped na tabela nova; imutabilidade de `results`/`batch_logs` preservada; nenhum segredo em log/front; `db:types` regenerado se houve DDL.

---

## Tasks / Subtasks

### T0 — Design do estado de aprovação (SPIKE — @architect, antes de codar)
- [x] Decidir **onde** vive o estado de aprovação: tabela nova `system_distribution_approvals(distribution_result_id, status, decided_by, decided_at, override_executor_id, original_executor_id, reason)` vs estender a exceção do trigger de imutabilidade. **Decisão: tabela nova** (mantém `results` append-only). (AC-3..6)
- [x] Definir o **mapa flow+preference_applied+exceção → rótulo de regra** (H10) — implementado em `src/lib/distribuicao/rule-label.ts`. (AC-2)
- [x] Definir coerência com re-sync (deletar aprovações da data quando `runSync` reinsere) — FK ON DELETE CASCADE. (AC-8)

### T1 — Migration do estado de aprovação (@data-engineer)
- [x] Migration aditiva `system_distribution_approvals` + RLS org-scoped + FK para `system_distribution_results(id)` (ON DELETE CASCADE, cobre AC-8) + rollback simétrico. Aplicada 2× (idempotente) via `npx tsx scripts/db-apply-pg.ts`. `types.ts` atualizado. (AC-3..6, AC-8, AC-9)

### T2 — RPC de aprovação/rejeição/edição (@dev)
- [x] Server functions em `src/rpc/distribuicao-aprovacao.ts`: `aprovarTarefaFn`/`rejeitarTarefaFn`/`editarExecutorFn`/`aprovarBatchFn`, gate `requireModule("controladoria","edit")`, validação de executor elegível na edição (servidor). (AC-3..7)
- [x] Registrar override manual (de→para + quem/quando) em `original_executor_id`/`override_executor_id`/`decided_by`/`decided_at`. (AC-5)

### T3 — UI de aprovação (@dev)
- [x] Estendida `controladoria.distribuicao.lista.tsx` com: coluna "Regra aplicada" (rótulo + tooltip), badge de aprovação (pending/approved/rejected/blocked), botões aprovar/rejeitar/editar-executor por linha + ação em massa (Aprovar/Rejeitar todas) com confirmação (AlertDialog). (AC-1..5, AC-7)
- [x] Selector de executor elegível na edição (reusa `useExecutorMappings`). (AC-5)
- [x] Nomes via H1 (executor/tipo/processo). (AC-1)

### T4 — Portão de efetivação (@dev + @architect)
- [x] Estado "tarefas aprovadas da data" exposto via `useDistributionApprovals(date)` (mapa result_id→status) + tabela satélite que H3 consulta como pré-condição do writeback (só `status='approved'` elegível). (AC-6)

### T5 — QA / regressão (@qa + @architect)
- [x] `typecheck` verde (só erro pré-existente `contaazul/service.ts`, fora de escopo) + `eslint` 0 erros nos arquivos tocados; `types.ts` atualizado; RLS + FK CASCADE verificados no banco; imutabilidade de `results`/`batch_logs` preservada (nada gravado neles). (AC-9)
- [ ] Smoke funcional end-to-end (sync → aprovar/rejeitar/editar → re-sync limpa) — pendente de execução manual pelo QA. (AC-1..8)

---

## Dev Notes

- **A regra JÁ foi decidida pelo motor** — a tela não recomputa nada; deriva o rótulo (H10) de `flow`/`preference_applied`/`alerts` já gravados. Isso mantém a tela barata e evita divergência com o cálculo.
- **`results` é imutável.** Não tentar guardar `approved` numa coluna de `system_distribution_results` (o trigger `system_prevent_distribution_modification` só libera `writeback_pending`). Estado de aprovação vai em tabela satélite (T1).
- **Editar executor = override manual auditável.** Alinha com `system_distribution_manual_assignments` (citado na infra do A9) e com o alerta `ALT-RESP-005` que H3 registra quando o responsável efetivado ≠ o sugerido pelo motor.
- **Re-sync destrói e recria os `results` da data** (`sync-core.ts` faz DELETE+INSERT, migration `20260805000003`). A FK ON DELETE CASCADE na tabela de aprovação resolve órfãos (AC-8) — mas então **aprovar depois de re-sincronizar** é obrigatório (o operador aprova sempre a última rodada).
- **Este é o portão de segurança do H3.** Sem H2 aprovado, o writeback (escrita irreversível no ProJuris) não deve disparar. Tratar H2 como pré-requisito duro de H3.
- **Migrations via pg direto** (`reference_aplicar_migrations_pg_direto`): `npx tsx scripts/db-apply-pg.ts <arquivo.sql>`; dev=prod; rollbacks em `sistema-hv/supabase/rollbacks/`.

**Riscos:**
- **R1 — aprovação órfã / re-sync:** se o estado de aprovação não for invalidado no re-sync, aprova-se um resultado que foi substituído. Mitigação: FK CASCADE + UI sempre mostra a última rodada da data.
- **R2 — edição para executor inelegível:** validar autorização/eligibilidade no servidor (não só na UI), senão o override quebra a justiça da carga.
- **R3 — rótulo de regra enganoso (H10):** se o mapa flow→rótulo estiver incompleto, o operador confia numa explicação errada. Mitigação: cobrir todos os caminhos do `flow-selector.ts` no T0 e exibir os `alerts[]` crus como escape.

---

## Testing

- **Estado (DB):** aprovar/rejeitar/editar → linhas em `system_distribution_approvals` com status/quem/quando/override; re-sync da data → CASCADE limpa aprovações; sem órfãs.
- **Regra (H10):** para tarefas com `preference_applied=true` (exceção) e sem (carga), o rótulo bate com o caminho do `flow-selector` (tema exclusivo / tipo exclusivo / dirigido / GENERAL-carga / COMPLEX-rodízio).
- **Portão:** tarefa não-aprovada → H3 não a efetiva; aprovada → elegível; rejeitada → nunca efetivada.
- **Edição:** trocar para executor elegível OK; para inelegível → bloqueado no servidor.
- **Segurança:** ação sem `controladoria:edit` → 403; nenhum segredo em log/front; `typecheck`/`lint` verdes.

---

## Dependências

- **Motor + `system_distribution_results` + `sync-core`/`sincronizarDistribuicaoFn`** — JÁ existem; base desta story.
- **H1 (ID→nome)** — a tela mostra nome de executor/tipo/processo; H2 consome H1.
- **H3 (writeback)** — DEPENDE de H2: só tarefas aprovadas aqui são efetivadas lá.
- **`system_projuris_executor_mapping`** (elegibilidade) e **`system_users`** (nomes/quem-aprovou).
- **Decisão de design do estado de aprovação** (@architect, T0) — bloqueia a migration T1.

---

## File List

**A definir na implementação. Previsto:**

**Migrations (novas):**
- `sistema-hv/supabase/migrations/2026080X_distribution_approvals.sql` + rollback + `db:types`.

**Código (novo/estendido):**
- `sistema-hv/src/rpc/distribuicao.ts` (ou novo `distribuicao-aprovacao.ts`) — RPCs aprovar/rejeitar/editar/aprovar-batch.
- `sistema-hv/src/routes/controladoria.distribuicao.lista.tsx` (estender) ou nova `controladoria.distribuicao.aprovacao.tsx`.
- `sistema-hv/src/hooks/useDistribuicao.ts` — mutations de aprovação/edição + query do estado.

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Tabela satélite `system_distribution_approvals` (migration `20260805000004` + rollback, RLS org-scoped, FK `distribution_result_id` ON DELETE CASCADE p/ AC-8, aplicada 2× idempotente e verificada no banco — colunas/RLS/policies/FK). RPCs em `src/rpc/distribuicao-aprovacao.ts` (aprovar/rejeitar/editar-executor/aprovar-batch, gate `requireModule("controladoria","edit")`, elegibilidade do executor validada no servidor). Rótulo da regra (H10) derivado de `flow`+`preference_applied`+`alerts` em `src/lib/distribuicao/rule-label.ts` (sem recomputar motor). UI estendida em `controladoria.distribuicao.lista.tsx` (coluna Regra+tooltip, badge de aprovação, ações por linha + em massa com AlertDialog, dialog editar-executor, tudo escondido sem `usePodeEditar("controladoria")`). Hooks em `useDistribuicao.ts` + `types.ts` atualizado. Gates: typecheck verde (só `contaazul` pré-existente), eslint 0 erros nos arquivos tocados. Portão que a H3 consome: só `status='approved'` elegível a writeback; results/batch_logs intactos. Pendente: smoke funcional manual. | @dev |
