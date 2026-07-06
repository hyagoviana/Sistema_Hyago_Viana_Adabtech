# S9-11 — Critérios ad-hoc por caso (financeiro e op)

## Contexto

Hoje os critérios (checklist) de cada etapa vêm SÓ do **modelo por tipo de serviço**
(`system_stage_checklist_defs`, editáveis no editor de funil — `StageChecklistEditor`),
que valem para **todos** os casos do tipo. Eles são materializados por caso em
`system_case_checklist_items` (uma linha por `def_id`, com `done`/`done_by`).

Os gates de avanço automático de etapa contam esses required:
- OP: `system_fn_avancar_se_checklist_ok` (migration `20260703000003`)
- FIN: `system_fn_avancar_fin_se_ok` (migration `20260704000001`)

Ambos avançam a etapa quando **todos** os itens `required` da etapa atual estão `done=true`.

## Pedido do owner

Poder, **adicionalmente**, acrescentar/editar/excluir critérios **dentro de um caso
específico** — valendo **só** para aquele caso. O caso **herda** os critérios do tipo
**+ pode ter itens EXTRAS próprios** (ad-hoc). O gate de avanço deve considerar os **dois**
(obrigatórios do modelo + obrigatórios ad-hoc do caso).

## Decisões de design

- **Sem tabela nova.** O item ad-hoc reusa `system_case_checklist_items` com `def_id = NULL`
  e carrega a própria definição na linha (`label`, `required`, `ordem`). Herdados continuam
  com `def_id NOT NULL` apontando para o def do modelo.
- `def_id` passou a ser **NULLABLE**; CHECK garante `def_id IS NOT NULL OR (stage_slug IS NOT NULL AND label IS NOT NULL)`.
- O índice UNIQUE parcial `(case_id, def_id)` **não muda**: em Postgres, `NULL` é distinto em
  índices únicos, então vários ad-hoc por caso não colidem e a idempotência da instanciação
  por def (que só insere `def_id` não-nulos) é preservada — o instanciador **não** apaga nem
  ignora os ad-hoc.
- **Herdados do modelo NÃO são editáveis por caso** (só marcáveis). Só ad-hoc (`def_id IS NULL`)
  pode ser criado/editado/excluído no caso. O service bloqueia mutação de herdados (409).
- Exclusão de ad-hoc = **soft-delete** (`deleted_at`), auditado pela trigger existente da tabela.
- Após editar/excluir um ad-hoc `required` pendente, o(s) gate(s) da etapa são **disparados**
  (remover/desobrigar um required pode liberar o avanço). Criar um ad-hoc nasce `done=false`,
  então nunca avança sozinho.

## Critérios de aceite

- [x] `def_id` NULLABLE; colunas `label`/`required`/`ordem` presentes; CHECK def-ou-adhoc.
- [x] Gate OP e FIN passam a considerar required do modelo **e** ad-hoc (`def_id IS NULL AND required=TRUE`)
      não-`done` como pendência; mantêm idempotência e guarda `WHERE macrostatus_* = esperado`.
- [x] Service server-side, auth-only, auditado: criar / editar / excluir (soft) ad-hoc por caso.
- [x] UI dentro do caso (`CaseChecklistPanel`): acrescentar/editar/excluir ad-hoc na(s) etapa(s)
      atual(is) (op sempre; fin quando bifurcado), com badge "Deste caso" diferenciando dos herdados.
- [x] Marcar/atingir todos os required (modelo + ad-hoc) → gate avança; queries do Kanban invalidadas.
- [x] Instanciador não duplica nem apaga ad-hoc.
- [x] Migration aplicada + verificação por query; typecheck (só 3 erros pré-existentes de `service_type_id`);
      lint dos arquivos tocados (só CRLF).

## Implementação

### Migration
- `supabase/migrations/20260709000001_checklist_item_adhoc.sql`
  1. `ALTER COLUMN def_id DROP NOT NULL`.
  2. `ADD COLUMN IF NOT EXISTS label TEXT, required BOOLEAN NOT NULL DEFAULT TRUE, ordem INTEGER NOT NULL DEFAULT 0`.
  3. CHECK `system_case_checklist_items_def_or_adhoc_chk`.
  4. Recria a view `_active`.
  5/6. `CREATE OR REPLACE` dos 2 gates — pendência via `LEFT JOIN` com defs +
     `(def_id NOT NULL AND d.required) OR (def_id NULL AND ci.required)`.
  - Não toca `system_cases`; não recria `system_cases_active` nem `trg_system_cases_bifurcacao`.
- Rollback: `supabase/rollbacks/20260709000001_checklist_item_adhoc.rollback.sql`
  (restaura os 2 gates para a versão S2-04/S3-02, remove colunas/constraint, `def_id SET NOT NULL`;
  nota de que ad-hoc existentes precisam ser removidos antes).

### Backend
- `src/lib/checklist-service.ts`:
  - `listCaseChecklistItems` normaliza ad-hoc (`def` sintético + `is_adhoc`).
  - `createAdhocChecklistItem`, `updateAdhocChecklistItem`, `deleteAdhocChecklistItem`.
  - `marcarItemChecklist` estendido: inconsistência (S2-05) considera `required`/`label` da própria
    linha quando `def_id IS NULL`.
  - Helper `dispararGatesDaEtapa` roteia op/fin conforme o `kind` da etapa.
- `src/rpc/checklist.ts`: `createAdhocChecklistItemFn` / `updateAdhocChecklistItemFn` /
  `deleteAdhocChecklistItemFn` (auth; auditado). Criar exige apenas `requireAuth`.
- `src/lib/supabase/types.ts`: colunas novas + `def_id` nullable (edição manual).

### Frontend
- `src/hooks/useChecklist.ts`: `useCreateAdhocChecklistItem` / `useUpdateAdhocChecklistItem` /
  `useDeleteAdhocChecklistItem`; invalidação compartilhada (itens + caso + timeline + Kanban).
- `src/components/cases/ChecklistItemsList.tsx`: badge "Deste caso" + ações editar/excluir para ad-hoc.
- `src/components/cases/CaseChecklistPanel.tsx`: form de adicionar por etapa atual + dialog de edição.
- `src/routes/casos.$id.tsx`: passa `canEdit={podeGerirCaso}` e `currentStageSlugs`.

## Verificação (dev=prod)

- `def_id` = nullable; `label`/`required`/`ordem` presentes; CHECK confirmado (`pg_get_constraintdef`).
- Ambos os gates contêm a cláusula ad-hoc (`pg_get_functiondef`).
- Teste transacional (rollback via RAISE): ad-hoc `required` não-`done` **bloqueia** o avanço op
  (`before=after=ONBOARDING`, `blocked=t`); ad-hoc `done=true` → 0 pendências restantes.

## Pendências para @qa

- Testar na UI: criar/editar/excluir critério ad-hoc na ficha do caso (op e fin bifurcado);
  ao concluir todos os required (modelo + ad-hoc) o card pula de coluna no Kanban op/fin.
- Confirmar que herdados do modelo não expõem editar/excluir (só marcar).
- Sem migração de `db:types` automática — types.ts foi editado à mão.

## File List
- `supabase/migrations/20260709000001_checklist_item_adhoc.sql` (novo)
- `supabase/rollbacks/20260709000001_checklist_item_adhoc.rollback.sql` (novo)
- `src/lib/checklist-service.ts`
- `src/rpc/checklist.ts`
- `src/hooks/useChecklist.ts`
- `src/lib/supabase/types.ts`
- `src/components/cases/ChecklistItemsList.tsx`
- `src/components/cases/CaseChecklistPanel.tsx`
- `src/routes/casos.$id.tsx`
