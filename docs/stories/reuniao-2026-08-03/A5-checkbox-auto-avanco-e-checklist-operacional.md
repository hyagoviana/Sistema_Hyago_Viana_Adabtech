# Story A5: Checklist no operacional (igual ao financeiro), correção do checklist financeiro e CHECKBOX de auto-avanço por caso

**Épico:** Reunião 2026-08-03 — 8 Ajustes
**ID:** A5
**Status:** Ready for Review
**Estimativa relativa:** L
**Executor sugerido:** @dev + @data-engineer · Quality gate: @qa
**Risco:** MÉDIO/ALTO (reativa checklist + gate de avanço)
**Status:** Ready for Review

---

## Story

**Como** administrador/operador do escritório,
**quero** ter o mesmo mecanismo de checklist que existe no financeiro também no funil OPERACIONAL — um checklist vinculado ao Kanban que vale para TODOS os casos daquele funil/etapa, e a possibilidade de criar CHECKBOX/critérios exclusivos de um caso — **além de** um CHECKBOX simples por caso que, ao ser marcado, AVANÇA o caso para uma etapa escolhida,
**para** padronizar a operação, controlar o recebimento (inclusive parcial) de documentos e automatizar a movimentação do card sem depender de arrastar manualmente.

> **DECISÃO DO OWNER (travada nesta story):** "vamos fazer o mesmo método que fizemos no financeiro: ter o CHECKLIST que fica vinculado ao KANBAN e serve para TODOS os casos naquele funil; e também será possível criar CHECKBOX dentro do caso, que serve único e exclusivo para o caso. E lembrando que essa função NÃO está funcionando dentro da pipeline financeira — precisa ativar."

**Distinção conceitual do owner (NÃO confundir as duas coisas):**
- **CHECKLIST** = MÚLTIPLOS itens por etapa; suporta recebimento PARCIAL (ex.: "pedi 10 documentos, o cliente mandou 5") → cada item marcado individualmente; só quando TODOS estão marcados o caso avança sozinho. Vale para TODOS os casos do funil (def por etapa) + itens ad-hoc só do caso.
- **CHECKBOX de auto-avanço** = UM único "OK" por caso (campo boolean nos campos do tema). Ao marcar = "sim", o caso é MOVIDO para a etapa configurada. É único/exclusivo do caso e serve para pular/avançar com um clique.

A story tem TRÊS frentes na mesma entrega: **(5a)** corrigir/ativar o checklist do FINANCEIRO (que hoje não funciona); **(5b)** ligar o checklist no OPERACIONAL reusando o MESMO mecanismo do financeiro; **(5c)** criar o CHECKBOX de auto-avanço por caso.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

**Modelo de dados do checklist:**
- `system_stage_checklist_defs` (service_type_id, stage_slug, key, label, ordem, required, active, expected_doc_pattern, assigned_to, deleted_at) — defs por etapa (valem p/ TODOS os casos do funil). View `system_stage_checklist_defs_active`.
- `system_case_checklist_items` (case_id, def_id, stage_slug, done, source∈`manual`/`drive_suggest`, done_at, done_by, drive_file_id; + inline ad-hoc: label/required/ordem quando `def_id IS NULL`). UNIQUE parcial `(case_id, def_id) WHERE deleted_at IS NULL`. Migration base `20260703000001_stage_checklist.sql`; ad-hoc `20260709000001_checklist_item_adhoc.sql`.
- Multi-responsável: `system_case_checklist_item_assignees` (`20260710000002`) + `system_stage_checklist_def_assignees` (`20260710000003`); def-assignee `20260709000070`.
- Instanciação idempotente: `system_fn_instanciar_checklist(case_id, stage_slug)` — `sistema-hv/supabase/migrations/20260709000080_instanciar_checklist_funil_global.sql`. **Achado-chave:** casa defs cujo `service_type_id IN (service_type_real, GLOBAL_FUNNEL_SERVICE_TYPE_ID='...f0')`, `ON CONFLICT (case_id,def_id) WHERE deleted_at IS NULL DO NOTHING`.
- Gate de avanço "exige TODOS": `system_fn_avancar_se_checklist_ok` (OP) e `system_fn_avancar_fin_se_ok` (FIN) — `sistema-hv/supabase/migrations/20260710000001_checklist_avanca_todos.sql`. `required` é só rótulo; qualquer item `done=FALSE` na etapa esperada bloqueia o avanço automático. Guarda `WHERE macrostatus_* = esperado` (arrasto manual não é bloqueado). Idempotentes (CREATE OR REPLACE).

**Serviço/RPC do checklist:**
- `sistema-hv/src/lib/checklist-service.ts`:
  - `listCaseChecklistItems` (`:257`) — reconciliação on-read idempotente que JÁ trata op+fin: linhas `:271-283` chamam `system_fn_instanciar_checklist` para `macrostatus_op` E `macrostatus_fin` da etapa atual (ref `reference_checklist_reconciliacao`).
  - `marcarItemChecklist` (`:624`) — grava done/done_at/done_by; roteia o gate por `kind` da etapa (`:661-671`): `avancarSeChecklistOk` p/ op, `avancarFinSeOk` p/ fin. `stageKindsForSlug` (`:603`) descobre op|fin.
  - **BLOQUEIO A RELAXAR (5b):** `createAdhocChecklistItem` (`:424`) tem trava `:438-446` que retorna 422 "Checklist existe apenas nas etapas financeiras" quando `kinds.has("op") && !kinds.has("fin")`.
- RPC: `sistema-hv/src/rpc/checklist.ts`.

**UI do checklist:**
- `sistema-hv/src/components/pipeline/StageChecklistEditor.tsx` — edita as defs por etapa (criar/reordenar/excluir/required/multi-responsável).
- `sistema-hv/src/components/cases/StageEditor.tsx` — **GATE DE UI A RELAXAR (5b):** `:85` `const showChecklist = kind === "fin";` esconde o expander de checklist em etapas op. `:217-225` só renderiza `StageChecklistEditor` quando `showChecklist`.
- `sistema-hv/src/components/cases/CaseChecklistPanel.tsx` — painel do caso: marca itens + cria/edita/exclui ad-hoc na(s) etapa(s) atual(is). Já é agnóstico a op/fin (usa `currentStageSlugs`).
- `sistema-hv/src/components/cases/ChecklistItemsList.tsx` + `AssigneeMultiSelect`.

**Regra que BLOQUEIA o operacional hoje (a RELAXAR):**
- `sistema-hv/supabase/migrations/20260709000040_checklist_only_fin.sql` — soft-deletou (`active=FALSE, deleted_at=NOW()`) as DEFs op-only e soft-deletou (`deleted_at=NOW()`) as INSTÂNCIAS op-only. **Isso é dado legado que precisa de decisão sobre reativação (ver Riscos).**

**Campos do tema (base do 5c):**
- `system_tema_field_defs` (tema_id, frente_slug, key, label, type, options, ordem, required, active, scope∈`caso`/`cliente`, hidden_in_list, max_occurrences). `type` JÁ inclui `boolean` (`20260722000001_tema_field_defs_boolean.sql`). Migration base `20260719000006_tema_field_defs.sql`; scope/multi `20260731000001_tema_field_defs_scope_multi.sql`.
- Serviço: `sistema-hv/src/lib/tema-field-defs-service.ts` (`TEMA_FIELD_TYPES` `:23`, `createTemaFieldDef` `:160`, `updateTemaFieldDef` `:248`).
- Editor admin: `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` (`TYPE_OPTIONS` `:34` já inclui `boolean` = "Sim / Não").
- Bloco na ficha: `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` — `TemaFieldInput` (`:240`) já renderiza `boolean` como select tri-estado (`:294-316`); grava via `saveDef` (`:92`) → `updateCaseCanonicalFields`.

**Pipeline/casos (hook do auto-avanço 5c):**
- `sistema-hv/src/lib/cases-service.ts`:
  - `updateCaseCanonicalFields` (`:1152`) — grava o JSONB `canonical_fields` do caso; é AQUI que o valor do checkbox boolean chega ao servidor.
  - `moveCaseStatus` (`:1382`) → `updateCase(..., {macrostatus_op})`; `moveCaseStatusFin` (`:1393`).
  - Etapas: `system_pipeline_stages` (kind op|fin) + trigger `system_fn_sync_stage_ids` reaponta `stage_op_id`. `macrostatus_op` é TEXTO LIVRE (etapas por categoria, desde a migration 0017).
- `sistema-hv/src/lib/pipeline-service.ts` — CRUD de etapas/stages (funil sentinela global).
- Kanban: `sistema-hv/src/components/cases/KanbanBoard.tsx`.

### NOVO (a construir nesta story)

- **(5a) Diagnóstico + fix** do checklist financeiro (investigar causa; corrigir para voltar a funcionar).
- **(5b)** Migration ADITIVA/idempotente (+ rollback) que REABILITA o checklist op (relaxa o `checklist_only_fin`); relaxar `showChecklist` na UI (`StageEditor.tsx:85`); relaxar a trava 422 de ad-hoc op (`checklist-service.ts:438-446`).
- **(5c)** Coluna aditiva `move_to_stage_slug` (+ opcional `move_to_stage_kind`) em `system_tema_field_defs`; UI no `TemaFieldDefsEditor` p/ campos boolean; auto-avanço ao marcar "sim" na ficha (gatilho no serviço `updateCaseCanonicalFields`/pipeline); registro na timeline (evento — ver A6).

---

## Acceptance Criteria

### 5a — Bug/ativação do CHECKLIST FINANCEIRO

1. **Diagnóstico documentado:** o dev registra na story (seção Dev Notes / File List) a CAUSA-RAIZ pela qual o checklist do funil financeiro "não está funcionando hoje" — reproduzido em ambiente dev com passo-a-passo (criar def numa etapa fin no editor → abrir um caso → conferir se o item aparece/marca/avança). Hipóteses a validar explicitamente: (a) defs financeiras salvas sob `GLOBAL_FUNNEL_SERVICE_TYPE_ID` mas não instanciadas; (b) `showChecklist`/UI não expondo o editor; (c) gate fin não disparando; (d) reconciliação on-read não cobrindo `macrostatus_fin`; (e) dados soft-deletados por engano.
2. Após o fix, no FINANCEIRO: criar um item de checklist numa etapa fin no editor de funil faz o item **aparecer** no painel do caso naquela etapa (para casos novos E existentes já parados na etapa, via reconciliação on-read).
3. Marcar TODOS os itens da etapa fin atual **avança** o caso para a próxima etapa fin automaticamente (gate `system_fn_avancar_fin_se_ok`); com item pendente, NÃO avança. Arrasto manual no Kanban fin continua livre (sem gate).
4. Multi-responsável, ad-hoc por caso e badge "Obrigatório" continuam funcionando no financeiro (regressão zero).

### 5b — CHECKLIST no OPERACIONAL (igual ao financeiro)

5. Migration **aditiva + idempotente + com rollback simétrico** que REABILITA o checklist em etapas `kind='op'` (relaxa o efeito de `20260709000040_checklist_only_fin.sql`). A decisão sobre reativar dados legados soft-deletados está travada em Dev Notes/Riscos e implementada conforme (default: NÃO ressuscitar em massa; recriar do zero via editor — ver Riscos R1).
6. No editor de funil (`StageEditor`), etapas OPERACIONAIS passam a exibir o expander de checklist e o `StageChecklistEditor` (relaxa `showChecklist` em `StageEditor.tsx:85`), permitindo criar/editar/reordenar/excluir itens + multi-responsável. As defs valem para TODOS os casos daquele tema/etapa op.
7. Ao entrar (ou já estar) numa etapa op com defs, o caso **instancia** os itens (idempotente) e os exibe no `CaseChecklistPanel`; a **reconciliação on-read** (`listCaseChecklistItems`) — que já trata `macrostatus_op` — passa a materializar as defs op sem duplicar (ON CONFLICT).
8. **Gate de avanço op reusado:** com TODOS os itens da etapa op atual marcados, o caso avança automaticamente para a próxima etapa op (`system_fn_avancar_se_checklist_ok`); com item pendente, não avança; arrasto manual no Kanban op continua livre.
9. Itens **ad-hoc por caso** passam a ser permitidos em etapas op: a trava 422 "Checklist existe apenas nas etapas financeiras" (`checklist-service.ts:438-446`) é relaxada para aceitar `kind='op'`.
10. Multi-responsável (def e item) preservado no op; visibilidade RBAC por responsável (getVisibleCaseIds) continua honrando itens de checklist op.

### 5c — CHECKBOX exclusivo do caso com AUTO-AVANÇO

11. Coluna **aditiva** em `system_tema_field_defs` (ex.: `move_to_stage_slug TEXT NULL`; opcionalmente `move_to_stage_kind TEXT` default `'op'`), com migration idempotente + rollback. Default `NULL` = campo boolean NÃO move nada (comportamento atual preservado; regressão zero).
12. No `TemaFieldDefsEditor`, quando `type='boolean'`, aparece a opção "Ao marcar 'Sim', mover o caso para a etapa: [select de etapas op do tema]" (opcional; vazio = não move). O select lista as etapas op do tema/funil.
13. Na ficha do caso (`CaseCanonicalFields`/`TemaFieldInput`), marcar o checkbox boolean como **"Sim"** dispara o auto-avanço: o caso é movido para a etapa `move_to_stage_slug` configurada (via serviço pipeline/cases). Marcar "Não" / "não definido" **NÃO move** (só move na transição para "sim").
14. O auto-avanço só ocorre quando o valor MUDA para "sim" (idempotente: re-salvar "sim" já estando na etapa destino não gera novo movimento nem loop). Default do campo no caso = desmarcado.
15. O movimento gera um **evento na timeline** do caso (ex.: `stage_moved_by_checkbox` / reutiliza `stage_auto_advanced` com `via='checkbox'`) — alinhado à story A6 (timeline). Registra origem = nome do campo/def.

### Transversais

16. **Regressão zero:** casos sem checklist op, sem defs boolean com move, e o financeiro existente seguem idênticos. `npm run typecheck`, `npm run lint` e testes (`smoke-tema-fields.ts` + smokes de checklist) passam. `db:types` regenerado após a migration 5c.

---

## Tasks / Subtasks

### T0 — Diagnóstico 5a (SPIKE curto, antes de mexer)
- [x] Reproduzir em dev o fluxo do checklist financeiro fim-a-fim (editor → caso → marcar → avançar). (AC-1)
- [x] Instrumentar/inspecionar: `system_stage_checklist_defs` (service_type_id usado ao salvar def fin), `system_case_checklist_items` instanciados, retorno de `listCaseChecklistItems`, disparo de `system_fn_avancar_fin_se_ok`. (AC-1)
- [x] Escrever a causa-raiz nas Dev Notes com evidência (query/log). (AC-1) — ver Dev Notes / DIAGNÓSTICO 5a.

### T1 — Fix 5a (financeiro volta a funcionar)
- [x] Aplicar a correção conforme causa-raiz: montar o `CaseChecklistPanel` na FICHA do caso (antes nunca era renderizado — só existia o popover do card fin). (AC-2, AC-3)
- [x] Validar aparecer/marcar/avançar em caso novo e existente; ad-hoc + multi-responsável ok. (AC-2..4) — gate fin validado por smoke DB (ELABORANDO→APROVAÇÃO).

### T2 — Migration 5b (reabilitar checklist op)
- [x] Criar `supabase/migrations/20260804000002_checklist_reabilita_op.sql` (aditiva/idempotente). Política de dados legados (R1): NÃO ressuscitar em massa — migration é marcador/NO-OP que reafirma GRANTs; o bloqueio do op vivia só no APP. (AC-5)
- [x] Criar `supabase/rollbacks/20260804000002_checklist_reabilita_op.rollback.sql` (no-op simétrico). (AC-5)
- [x] Aplicar via `npx tsx scripts/db-apply-pg.ts` (dev=prod). (AC-5)

### T3 — UI/serviço 5b (op igual fin)
- [x] Relaxar `StageEditor.tsx:85` → `showChecklist = kind === "fin" || kind === "op"`. (AC-6)
- [x] Relaxar a trava de ad-hoc op em `checklist-service.ts` (aceita `kind='op'`; só valida que o slug é etapa real). (AC-9)
- [x] `CaseChecklistPanel` montado na ficha exibe etapa(s) op+fin atual(is); reconciliação on-read materializa as defs op. (AC-7)
- [x] Roteamento do gate op em `marcarItemChecklist` (já roteia por kind) — validado por smoke DB (NOVO→EM_ANDAMENTO). (AC-8)
- [x] Visibilidade RBAC por responsável em etapas op — inalterada (getVisibleCaseIds já considera itens de checklist por assignee, agnóstico a kind). (AC-10)

### T4 — Migration 5c (coluna move_to_stage)
- [x] Criar `supabase/migrations/20260804000003_tema_field_defs_move_to_stage.sql`: `ADD COLUMN IF NOT EXISTS move_to_stage_slug TEXT`; recria view `system_tema_field_defs_active`; rollback simétrico. (AC-11)
- [x] `types.ts` editado à mão (padrão do projeto — mesmo do hidden_in_filters). (AC-16)

### T5 — Serviço/UI 5c (checkbox auto-avanço)
- [x] `tema-field-defs-service.ts`: persiste `moveToStageSlug` em create/update (só quando `type='boolean'`; força NULL nos demais). (AC-11, AC-12)
- [x] `TemaFieldDefsEditor.tsx`: quando `type='boolean'`, select "Ao marcar 'Sim', mover o caso para a etapa" (etapas op do tema) — opcional. (AC-12)
- [x] Auto-avanço server-side: em `updateCaseCanonicalFields`, `maybeAutoAdvanceByCheckbox` move via `moveCaseStatus` na transição não-sim→sim, com guarda anti-loop (destino ≠ etapa atual + slug op válido). (AC-13, AC-14)
- [x] Evento de timeline `stage_moved_by_checkbox` (via='checkbox') + rótulo em `CaseTimeline.renderEventLabel`. (AC-15)

### T6 — QA / regressão
- [x] `npx tsc --noEmit` (só o erro pré-existente de contaazul) + `npx eslint` exit 0 nos arquivos tocados. (AC-16)
- [x] Smokes: `scripts/smoke-tema-fields.ts` (13/0) + smokes DB de checklist op (gate NOVO→EM_ANDAMENTO) e fin (gate ELABORANDO→APROVAÇÃO) + smoke do auto-avanço 5c (4/4, self-cleaning). (AC-16)
- [x] Regressão: financeiro intacto (gate fin ok); caso sem checklist/checkbox intacto (default NULL não move). (AC-16)

---

## Dev Notes

### DIAGNÓSTICO 5a — CAUSA-RAIZ (@dev, 2026-08-04)

**Conclusão: o mecanismo de checklist financeiro (banco + serviço + reconciliação + gate) ESTÁ íntegro. O que "não funciona" é UI: o painel de checklist NUNCA era renderizado na ficha do caso.**

Evidências (todas em dev = prod, via `scripts/db-query.ts` e harnesses pg com ROLLBACK):

1. **Hipótese (a) — defs fin sob GLOBAL_FUNNEL não instanciadas: DESCARTADA.** A fn em produção JÁ é a versão global (`system_fn_instanciar_checklist` casa `service_type_id IN (tipo_real, ...f0)`). Rodando a fn nos 2 casos parados em `ELABORANDO`, ambos os itens (`receber valor` e `Conversa no 5099`) materializam. `ON CONFLICT DO NOTHING` → sem duplicata.
2. **Hipótese (d) — reconciliação não cobre `macrostatus_fin`: DESCARTADA.** `listCaseChecklistItems:271-283` reconcilia op E fin; comprovado: a def `Conversa no 5099` (criada 2026-08-03, DEPOIS dos casos entrarem na etapa) aparece após a reconciliação on-read.
3. **Hipótese (c) — gate fin não dispara: DESCARTADA.** Smoke fim-a-fim (marcar TODOS os itens de `ELABORANDO` → `system_fn_avancar_fin_se_ok`) avançou `ELABORANDO → APROVACAO` e gravou o evento `fin_stage_auto_advanced (via=checklist)`.
4. **Hipótese (e) — dados varridos pela `only_fin`: DESCARTADA.** Defs fin têm `frente_slug=null` e `active=true`; a `only_fin` só tocou etapas op-only.
5. **CAUSA-RAIZ REAL (UI):** `CaseChecklistPanel` é definido e exportado mas **`<CaseChecklistPanel …>` não é renderizado em lugar nenhum** (grep confirma 0 usos em JSX). Na ficha (`casos.$id.tsx`) só se importava o `ChecklistInconsistencyAlert`. O único acesso ao checklist era um popover hover-only (ícone ListChecks) no card do Kanban financeiro (`CaseCardFin`). Ao abrir a FICHA de um caso para trabalhar o checklist, não havia nada — daí "não funciona".

**Fix 5a (e, de quebra, entrega o 5b):** montar `CaseChecklistPanel` na ficha, passando as etapas op+fin atuais (`[macrostatus_op, macrostatus_fin]` sem `NAO_APLICAVEL`). Isso torna o checklist visível/usável no financeiro E no operacional com o MESMO componente.

### Decisões travadas
- **R1 (dados legados op):** NÃO ressuscitados. A migration 5b é marcador/NO-OP (só reafirma GRANTs); o bloqueio do op era 100% no APP (StageEditor + trava ad-hoc). Defs op antigas seguem soft-deletadas; owner recria no editor.
- **`move_to_stage_kind`:** NÃO criado. A story pede a coluna `move_to_stage_slug` (o "opcional" kind ficou fora); o auto-avanço é sempre na esteira OP (o select lista só etapas op). Mantém a superfície mínima.
- **Evento duplo na timeline:** `moveCaseStatus`→`updateCase` já grava `status_changed`; o auto-avanço adiciona `stage_moved_by_checkbox` (via='checkbox') para carimbar a ORIGEM. Ambos aparecem (esperado; o segundo é o rótulo pedido no AC-15).

**Arquitetura do checklist (reuso, não recriação).** O mecanismo op e fin é o MESMO: defs por etapa (`system_stage_checklist_defs`) → instância por caso (`system_case_checklist_items` via `system_fn_instanciar_checklist`) → marcação (`marcarItemChecklist`) → gate idempotente (`system_fn_avancar_se_checklist_ok` op / `system_fn_avancar_fin_se_ok` fin). A diferença hoje é PURAMENTE de gating: a migration `checklist_only_fin` desligou dados op e a UI (`StageEditor.tsx:85`) + a trava de ad-hoc (`checklist-service.ts:438`) escondem/impedem o op. Reabilitar = relaxar esses 3 pontos + migration aditiva.

**Achado-chave do 5a (hipótese forte).** As defs do funil financeiro são salvas sob `GLOBAL_FUNNEL_SERVICE_TYPE_ID='00000000-0000-0000-0000-0000000000f0'` (funil único, ver `casos.financeiro.index.tsx:236/321` e `StageEditor` recebendo esse id). A migration `20260709000080_instanciar_checklist_funil_global.sql` JÁ corrigiu a instanciação para casar `service_type_id IN (real, ...f0)`. **Se o financeiro ainda "não funciona", validar:** (i) se `system_fn_instanciar_checklist` em produção é de fato a versão do `...000080` (não a base); (ii) se `listCaseChecklistItems` reconcilia `macrostatus_fin` (sim, `:271-283`); (iii) se as defs fin foram varridas por engano pela `only_fin` (não deveriam — op e fin usam slugs distintos). O diagnóstico (T0) deve cravar qual dos itens é a causa antes de qualquer código.

**Reconciliação on-read já cobre op+fin.** `listCaseChecklistItems` (`checklist-service.ts:271-283`) chama `system_fn_instanciar_checklist` para `macrostatus_op` E `macrostatus_fin`. Ao reabilitar as defs op, os itens op passam a materializar automaticamente ao abrir o caso, sem migração de dados. `ON CONFLICT (case_id, def_id) WHERE deleted_at IS NULL DO NOTHING` garante idempotência.

**Gate "exige TODOS" (não só required).** Desde `20260710000001_checklist_avanca_todos.sql`, qualquer item `done=FALSE` na etapa esperada bloqueia o avanço automático; `required` é só badge. Mantém-se assim no op. `marcarItemChecklist` (`:661-671`) já roteia o gate por `kind` da etapa do item — então marcar um item op dispara `avancarSeChecklistOk`. Nada novo no roteamento.

**5c — onde plugar o auto-avanço.** O valor do checkbox chega ao servidor por `updateCaseCanonicalFields` (`cases-service.ts:1152`). Estratégia: após persistir o merge, carregar as defs boolean do tema do caso que tenham `move_to_stage_slug`; para cada chave presente no `patch` cujo valor virou `true` (transição não-sim→sim), e o caso NÃO esteja já na etapa destino, chamar `moveCaseStatus(caseId, move_to_stage_slug)`. Guardas obrigatórias: (a) só `type='boolean'`; (b) só quando a chave está no `patch` atual (evita remover-e-avaliar em cada save); (c) só transição para `true` (comparar com `before.canonical_fields[key]`); (d) no-op se `macrostatus_op` já é o destino (anti-loop, AC-14). `macrostatus_op` é texto livre — o `move_to_stage_slug` deve ser um slug op válido do tema (validar contra `system_pipeline_stages`).

**Distinção checkbox × checklist (não misturar tabelas).** O CHECKBOX de auto-avanço (5c) vive em `system_tema_field_defs` + `canonical_fields` (um valor por caso). O CHECKLIST (5a/5b) vive em `system_stage_checklist_defs`/`system_case_checklist_items` (N itens por etapa). São mecanismos SEPARADOS por decisão do owner: checkbox = 1 OK que auto-avança; checklist = N itens com recebimento parcial.

**Migrations.** Aplicar via `npx tsx scripts/db-apply-pg.ts` (CLI do Supabase quebrado no Windows/OneDrive — ver `reference_aplicar_migrations_pg_direto`). dev=prod. Rollbacks em `sistema-hv/supabase/rollbacks/` (padrão já existente). Regenerar `db:types` após 5c.

**Riscos (travar decisões):**
- **R1 — reativar dados legados soft-deletados pela `only_fin`.** A `checklist_only_fin` marcou `deleted_at=NOW()` em defs/instâncias op. Ressuscitar em massa (`deleted_at=NULL`) pode reintroduzir itens obsoletos e "travar" casos que já avançaram. **Decisão default:** NÃO ressuscitar em massa; a migration 5b apenas remove o BLOQUEIO conceitual (permite criar novas defs op); as defs op antigas ficam soft-deletadas e o owner recria as que quiser no editor. Se o owner exigir ressuscitar, fazer de forma seletiva/reversível e documentar.
- **R2 — loop de auto-avanço (5c).** Sem a guarda anti-loop (AC-14), re-salvar o mesmo caso podia mover repetidamente / disparar em cadeia. Guarda: só mover em transição não-sim→sim E se `macrostatus_op != destino`.
- **R3 — gate travando fluxo.** Ao ligar checklist op, casos passam a exigir TODOS os itens da etapa op para avançar SOZINHOS. O arrasto manual continua livre (gate tem guarda `WHERE macrostatus_op=esperado`), mas comunicar ao owner que criar item obrigatório numa etapa op segura o auto-avanço até marcar. Desmarcar item de etapa já ultrapassada NÃO regride (só gera `checklist_inconsistente`).
- **R4 — colisão slug op/fin.** Um mesmo slug pode existir em op e fin (ex.: `CANCELADO`). `stageKindsForSlug` já devolve os dois kinds; o roteamento do gate cobre ambos. Validar que ativar op não dispara o gate fin indevidamente.

---

## Testing

- **DB smoke (checklist op):** criar def op numa etapa de um tema → abrir caso na etapa → confirmar item instanciado (reconciliação) → marcar todos → confirmar `macrostatus_op` avançou + evento `stage_auto_advanced (via=checklist)`; com 1 pendente, confirmar que NÃO avança.
- **DB smoke (checklist fin — regressão 5a):** mesmo roteiro na esteira fin (`system_fn_avancar_fin_se_ok`, evento `fin_stage_auto_advanced`).
- **DB smoke (idempotência):** rodar `system_fn_instanciar_checklist` 2× p/ a mesma etapa → sem duplicatas (ON CONFLICT).
- **5c auto-avanço:** def boolean com `move_to_stage_slug` → marcar "Sim" na ficha → caso move p/ etapa destino + evento na timeline; marcar "Não" → não move; re-salvar "Sim" estando no destino → no-op (sem loop); def boolean SEM move → comportamento atual (regressão).
- **Ad-hoc op:** criar/editar/excluir critério ad-hoc numa etapa op (sem mais 422).
- **UI (Playwright, opcional):** expander de checklist aparece em etapa op no `StageEditor`; select "mover para etapa" aparece só p/ boolean no `TemaFieldDefsEditor`.
- **Gates de qualidade:** `npm run typecheck`, `npm run lint`, `scripts/smoke-tema-fields.ts`.
- **Regressão:** caso sem checklist/checkbox intacto; financeiro intacto; casos já avançados não "voltam".

---

## Dependências

- **A6 (timeline):** o evento do auto-avanço (AC-15) alinha com a story de timeline; se A6 padronizar a ação/rótulo, usar o mesmo nome de evento.
- **Motor de campos do tema (R2-07/2026-07-29):** reusa `system_tema_field_defs` + `TemaFieldDefsEditor` + `CaseCanonicalFields` já existentes.
- **`GLOBAL_FUNNEL_SERVICE_TYPE_ID`** (`sistema-hv/src/lib/cases/constants.ts`) — funil financeiro/comercial único; relevante ao diagnóstico 5a.
- **Aplicação de migrations via pg direto** (`reference_aplicar_migrations_pg_direto`) — CLI Supabase indisponível no ambiente.
- Nenhuma credencial externa nova.

---

## File List

**Migrations (novas, APLICADAS via db-apply-pg):**
- `sistema-hv/supabase/migrations/20260804000002_checklist_reabilita_op.sql` + `sistema-hv/supabase/rollbacks/20260804000002_checklist_reabilita_op.rollback.sql`
- `sistema-hv/supabase/migrations/20260804000003_tema_field_defs_move_to_stage.sql` + `sistema-hv/supabase/rollbacks/20260804000003_tema_field_defs_move_to_stage.rollback.sql`

**Código (editado):**
- `sistema-hv/src/routes/casos.$id.tsx` — monta `CaseChecklistPanel` na ficha (fix 5a + UI 5b), passando etapas op+fin atuais.
- `sistema-hv/src/components/cases/StageEditor.tsx` — `showChecklist = kind === "fin" || kind === "op"`.
- `sistema-hv/src/lib/checklist-service.ts` — relaxa a trava 422 de ad-hoc op (aceita `kind='op'`; só valida slug real).
- `sistema-hv/src/lib/cases-service.ts` — `updateCaseCanonicalFields` + `maybeAutoAdvanceByCheckbox`/`isBoolTrue` (auto-avanço 5c).
- `sistema-hv/src/lib/tema-field-defs-service.ts` — `normalizeMoveToStage` + persistência de `moveToStageSlug` em create/update.
- `sistema-hv/src/rpc/tema-field-defs.ts` — `moveToStageSlug` nos schemas zod (create/update).
- `sistema-hv/src/hooks/useTemaFieldDefs.ts` — `move_to_stage_slug` no tipo + `moveToStageSlug` nas mutations.
- `sistema-hv/src/hooks/useCases.ts` — invalida Kanban + checklist do caso após salvar campos (auto-avanço pode mover a etapa).
- `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` — select "Ao marcar 'Sim', mover para a etapa" (só boolean) + badge na lista.
- `sistema-hv/src/components/cases/CaseTimeline.tsx` — rótulo `stage_moved_by_checkbox`.
- `sistema-hv/src/lib/supabase/types.ts` — `move_to_stage_slug` em Row/Insert de `system_tema_field_defs`.

**Validação (temporários, removidos ao final):** harnesses pg com ROLLBACK p/ gates op/fin + smoke tsx self-cleaning do auto-avanço 5c.

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-03 | v0.1 | Draft inicial da story A5 (3 frentes: fix checklist fin / checklist op / checkbox auto-avanço) | @sm |
| 2026-08-04 | v1.0 | Implementação completa. **Causa-raiz 5a:** o checklist fin (banco/serviço/reconciliação/gate) estava íntegro — o `CaseChecklistPanel` NUNCA era renderizado na ficha (só havia um popover hover no card do Kanban fin). Fix: montar o painel na ficha (op+fin), o que também entrega o 5b. **5b:** migration aditiva `20260804000002` (marcador/NO-OP; dados legados não ressuscitados por R1) + relaxa `showChecklist` e a trava 422 de ad-hoc op; gate op validado por smoke (NOVO→EM_ANDAMENTO). **5c:** migration aditiva `20260804000003` add `move_to_stage_slug TEXT NULL` (+view+grants+rollback); fiação service/rpc/hook/types/editor; auto-avanço server-side em `updateCaseCanonicalFields` com anti-loop; evento `stage_moved_by_checkbox`. Migrations APLICADAS (dev=prod). typecheck (só erro pré-existente contaazul) + eslint exit 0 + smokes (tema-fields 13/0, auto-avanço 4/4, gates op/fin). Status → Ready for Review. | @dev |
