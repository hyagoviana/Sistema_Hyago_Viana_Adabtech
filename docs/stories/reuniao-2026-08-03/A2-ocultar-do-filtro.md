# Story A2: Toggle "Ocultar do filtro" nos campos do tema (independente de "ocultar na lista")

**Épico:** Reunião 2026-08-03 — 8 Ajustes
**ID:** A2
**Status:** Ready for Review (migration APLICADA em produção)
**Estimativa relativa:** S
**Executor sugerido:** @data-engineer (migration) + @dev (UI) · Quality gate: @qa
**Risco:** BAIXO (aditivo)

---

## Story

**Como** administrador que configura os campos personalizados de um tema,
**quero** um toggle independente **"Ocultar do filtro"** em cada campo,
**para que** eu possa manter um campo como **informação** (visível na ficha e — se eu quiser — como coluna na Lista) **sem** que ele apareça no painel de filtros/busca da Lista nem no filtro do Kanban.

Hoje já existe o toggle **"Ocultar na lista"** (`hidden_in_list`), que tira o campo da **COLUNA** da Lista mas o mantém no painel de filtros e na ficha. Falta o eixo oposto e independente: um campo que **é informação mas não é filtro**. O owner validou o comportamento atual ("esse processo está correto") e pediu apenas somar este novo eixo, **sem** mexer no `active` (que é "ocultar de tudo") nem no `hidden_in_list`.

Os três eixos passam a ser **ortogonais**:

| Toggle | Coluna na Lista | Painel de filtros (Lista + Kanban) | Ficha do caso |
|---|---|---|---|
| `active = false` | some | some | some |
| `hidden_in_list = true` | **some** | continua | continua |
| `hidden_in_filters = true` (NOVO) | continua¹ | **some** | continua |

¹ desde que `hidden_in_list = false`.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (padrão a espelhar)

- **Tabela / view:** `system_tema_field_defs` + view `system_tema_field_defs_active` (`SELECT * ... WHERE deleted_at IS NULL`). A coluna irmã `hidden_in_list` (BOOLEAN NOT NULL DEFAULT FALSE) foi criada em `sistema-hv/supabase/migrations/20260731000001_tema_field_defs_scope_multi.sql:26`, que também adicionou `scope`/`max_occurrences` e **recriou a view** (linhas `61-64`: `CREATE OR REPLACE VIEW ... SELECT *` + `GRANT SELECT ... TO anon, authenticated, service_role`). Esse arquivo é o **molde exato** desta story (ADD COLUMN IF NOT EXISTS + recria view + grant).
- **Molde de rollback:** `sistema-hv/supabase/rollbacks/20260722000002_tema_field_defs_multiselect.rollback.sql` (padrão de rollback do domínio). Os rollbacks de `ADD COLUMN` seguem `DROP COLUMN IF EXISTS` + recria a view.
- **Service:** `sistema-hv/src/lib/tema-field-defs-service.ts` — `createTemaFieldDef` (grava `hidden_in_list: input.hiddenInList ?? false` em `:238`) e `updateTemaFieldDef` (mapeia `if (patch.hiddenInList !== undefined) clean.hidden_in_list = patch.hiddenInList;` em `:288`). Assinaturas dos `input`/`patch` em `:170` e `:258`.
- **RPC (Zod):** `sistema-hv/src/rpc/tema-field-defs.ts` — `hiddenInList: z.boolean().optional()` no create (`:96`) e no `patch` do update (`:116`).
- **Hook:** `sistema-hv/src/hooks/useTemaFieldDefs.ts` — tipo `TemaFieldDef` (`:25-40`, tem `hidden_in_list: boolean` em `:38`); `useCreateTemaFieldDef`/`useUpdateTemaFieldDef` já passam `hiddenInList` (`:95`, `:116`).
- **Tipos gerados:** `sistema-hv/src/lib/supabase/types.ts` — bloco `system_tema_field_defs` (`Row` em `:1007` tem `hidden_in_list: boolean`; `Insert` em `:1027` tem `hidden_in_list?: boolean`; `Update` é `Partial<Insert>` em `:1034`).
- **Editor (UI admin):** `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` — estado `hiddenInList` (`:80`), reset (`:93`), envio no create/update (`:143-144`, `:155-156`), preenchimento no `startEdit` (`:176`), badge "(fora da lista)" (`:238-240`) e o checkbox "Ocultar na lista" (`:398-406`).
- **Painel de filtros (Lista E Kanban):** `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` — `useTemaFieldDefs(temaId)` (`:98`); `canonicalOptions` deriva as opções (`:143-179`); **`filterableDefs = fieldDefs ?? []`** (`:207`) é a lista que vira os selects de filtro (`.map` em `:400-437`). **Este é o ponto único que serve tanto a Lista quanto o Kanban** — o Kanban usa o MESMO componente.
- **Kanban:** `sistema-hv/src/routes/pipeline.tsx` — renderiza `CaseFiltersPanel` e também usa `useTemaFieldDefs(temaId)` (`:258`) para montar `temaFilterDefs` (`:259-267`) que só orienta o **matching** de `applyCaseFilters` (`:321-327`) — dropdown = igualdade, texto = contém. Como o campo oculto some do painel, nenhum valor será setado para ele, então o matching fica inerte (não precisa alterar `applyCaseFilters`).
- **Lista:** `sistema-hv/src/routes/casos.lista.tsx` consome as defs e `hidden_in_list` para decidir as COLUNAS (via `InlineCanonicalCell.tsx`). **NÃO deve** ser afetada por `hidden_in_filters` (a coluna permanece).
- **Ficha:** `CaseFilterFillDialog.tsx` (`:71-72`) e `CaseCanonicalFields.tsx` leem as defs pela `useTemaFieldDefs` sem olhar `hidden_in_list`/`hidden_in_filters` → a ficha **continua** mostrando o campo (comportamento desejado).
- **Aplicação de migration:** `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` (`sistema-hv/scripts/db-apply-pg.ts`). Banco **dev = prod**.
- **Smoke DB:** `sistema-hv/scripts/smoke-tema-fields.ts` (exercita o service real; cria defs `SMOKE2607` e faz soft-delete no `finally`).
- **Smoke UI:** `sistema-hv/scripts/smoke-ui.ts` (Playwright).

### NOVO nesta story

1. Coluna `hidden_in_filters BOOLEAN NOT NULL DEFAULT FALSE` em `system_tema_field_defs` (migration aditiva idempotente espelhando a `20260731000001`) + **recria** a view `_active` + **grants** nos 3 roles. Rollback correspondente.
2. Tipos (`types.ts`: `Row` + `Insert`) e camada de dados (`TemaFieldDef` no hook) expõem o campo.
3. RPC/service passam `hiddenInFilters` no create e no update.
4. Toggle **"Ocultar do filtro"** no `TemaFieldDefsEditor.tsx` (estado + reset + create/update + startEdit + badge).
5. `CaseFiltersPanel.tsx` passa a **OMITIR** do painel (Lista e Kanban) as defs com `hidden_in_filters = true` — filtrando `filterableDefs`.

---

## Acceptance Criteria

1. **Migration aditiva idempotente + view + grants.** Nova migration `sistema-hv/supabase/migrations/20260803000001_tema_field_defs_hidden_in_filters.sql` adiciona `hidden_in_filters BOOLEAN NOT NULL DEFAULT FALSE` via `ADD COLUMN IF NOT EXISTS`, **recria** `CREATE OR REPLACE VIEW system_tema_field_defs_active AS SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;` e reexecuta `GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;`. Rodar a migration **duas vezes** não gera erro. Rollback `sistema-hv/supabase/rollbacks/20260803000001_tema_field_defs_hidden_in_filters.rollback.sql` faz `DROP COLUMN IF EXISTS hidden_in_filters` e recria a view.
2. **Tipos/RPC expõem `hiddenInFilters`.** `types.ts` (`Row` com `hidden_in_filters: boolean`, `Insert` com `hidden_in_filters?: boolean`); `TemaFieldDef` (hook) com `hidden_in_filters: boolean`; `createTemaFieldDefFn`/`updateTemaFieldDefFn` (Zod) aceitam `hiddenInFilters: z.boolean().optional()`; service grava/atualiza a coluna (`create` default `false`; `update` só quando presente). `npm run typecheck` limpo.
3. **Toggle no editor.** `TemaFieldDefsEditor.tsx` mostra o checkbox **"Ocultar do filtro (some do painel de busca; continua na lista e na ficha)"**, independente do "Ocultar na lista". O valor persiste ao criar e ao editar; o `startEdit` recarrega o estado do campo; há um badge "(fora do filtro)" no item quando `hidden_in_filters = true`.
4. **Some do painel de filtros da LISTA.** Com `hidden_in_filters = true`, o campo **não** aparece como filtro/dropdown no painel de `CaseFiltersPanel` na tela `casos.lista`.
5. **Some do filtro do KANBAN.** O mesmo campo **não** aparece no painel de filtros do Kanban (`pipeline.tsx`, que reusa `CaseFiltersPanel`).
6. **Permanece na FICHA.** O campo continua editável/visível na ficha do caso (`CaseFilterFillDialog` / `CaseCanonicalFields`) — `hidden_in_filters` não afeta a ficha.
7. **Permanece como COLUNA na Lista** quando `hidden_in_list = false`. `hidden_in_filters` **não** afeta a decisão de coluna (governada por `hidden_in_list`): um campo com `hidden_in_filters = true` e `hidden_in_list = false` continua sendo coluna na Lista.
8. **Regressão zero.** Linhas existentes assumem `hidden_in_filters = false` (default) → todos os filtros hoje visíveis continuam visíveis; nenhum campo some por acidente. Os três eixos (`active`, `hidden_in_list`, `hidden_in_filters`) são ortogonais e não interferem entre si.

---

## Tasks / Subtasks

- [ ] **T1 — Migration (@data-engineer).** Criar `sistema-hv/supabase/migrations/20260803000001_tema_field_defs_hidden_in_filters.sql` espelhando `20260731000001`:
  - [ ] `ALTER TABLE system_tema_field_defs ADD COLUMN IF NOT EXISTS hidden_in_filters BOOLEAN NOT NULL DEFAULT FALSE;`
  - [ ] `CREATE OR REPLACE VIEW system_tema_field_defs_active AS SELECT * FROM system_tema_field_defs WHERE deleted_at IS NULL;`
  - [ ] `GRANT SELECT ON system_tema_field_defs_active TO anon, authenticated, service_role;`
  - [ ] Cabeçalho comentado explicando o eixo novo e a regressão zero (default FALSE).
- [ ] **T2 — Rollback (@data-engineer).** Criar `sistema-hv/supabase/rollbacks/20260803000001_tema_field_defs_hidden_in_filters.rollback.sql`: `ALTER TABLE system_tema_field_defs DROP COLUMN IF EXISTS hidden_in_filters;` + `CREATE OR REPLACE VIEW ... SELECT * ...` + `GRANT SELECT ...`.
- [ ] **T3 — Aplicar migration (@data-engineer).** `npx tsx scripts/db-apply-pg.ts supabase/migrations/20260803000001_tema_field_defs_hidden_in_filters.sql` (rodar da pasta `sistema-hv/`). Confirmar idempotência rodando 2×.
- [ ] **T4 — Tipos gerados (@dev).** Em `sistema-hv/src/lib/supabase/types.ts`, bloco `system_tema_field_defs`: adicionar `hidden_in_filters: boolean;` no `Row` (após `hidden_in_list`) e `hidden_in_filters?: boolean;` no `Insert`.
- [ ] **T5 — Service (@dev).** Em `sistema-hv/src/lib/tema-field-defs-service.ts`:
  - [ ] adicionar `hiddenInFilters?: boolean;` na assinatura do `input` de `createTemaFieldDef` e gravar `hidden_in_filters: input.hiddenInFilters ?? false` no `.insert(...)`;
  - [ ] adicionar `hiddenInFilters: boolean;` no `patch` de `updateTemaFieldDef` e mapear `if (patch.hiddenInFilters !== undefined) clean.hidden_in_filters = patch.hiddenInFilters;`.
- [ ] **T6 — RPC/Zod (@dev).** Em `sistema-hv/src/rpc/tema-field-defs.ts`, adicionar `hiddenInFilters: z.boolean().optional()` no schema do `createTemaFieldDefFn` e no `patch` do `updateTemaFieldDefFn`.
- [ ] **T7 — Hook (@dev).** Em `sistema-hv/src/hooks/useTemaFieldDefs.ts`: adicionar `hidden_in_filters: boolean;` ao tipo `TemaFieldDef`; adicionar `hiddenInFilters?: boolean;` ao `mutationFn` do `useCreateTemaFieldDef` e ao `patch` do `useUpdateTemaFieldDef`.
- [ ] **T8 — Editor (@dev).** Em `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx`:
  - [ ] estado `const [hiddenInFilters, setHiddenInFilters] = useState(false);`
  - [ ] resetar em `resetForm()`;
  - [ ] enviar `hiddenInFilters` no `updateDef.mutateAsync`/`createDef.mutateAsync`;
  - [ ] carregar em `startEdit`: `setHiddenInFilters(!!d.hidden_in_filters);`
  - [ ] badge condicional `{d.hidden_in_filters && <span ...>(fora do filtro)</span>}` junto ao "(fora da lista)";
  - [ ] checkbox novo abaixo do "Ocultar na lista": **"Ocultar do filtro (some do painel de busca; continua na lista e na ficha)"**.
- [ ] **T9 — Painel de filtros (@dev).** Em `sistema-hv/src/components/cases/CaseFiltersPanel.tsx`, alterar `filterableDefs` (`:207`) para **filtrar** as defs ocultas: `useMemo(() => (fieldDefs ?? []).filter((d) => !d.hidden_in_filters), [fieldDefs])`. (Opcional/defensivo: também pular o cálculo em `canonicalOptions` para essas keys — mas basta remover da lista renderizada.) Isso cobre Lista e Kanban por serem o mesmo componente.
- [ ] **T10 — Verificar não-impacto (@dev).** Conferir que `casos.lista.tsx`/`InlineCanonicalCell.tsx` (coluna) e `CaseFilterFillDialog.tsx`/`CaseCanonicalFields.tsx` (ficha) **não** passam a considerar `hidden_in_filters` (permanecem regidos só por `hidden_in_list`/`active`).
- [ ] **T11 — Smoke DB (@qa).** Estender `sistema-hv/scripts/smoke-tema-fields.ts` com casos: (a) create com `hiddenInFilters: true` persiste; (b) default do create é `false`; (c) `updateTemaFieldDef({ hiddenInFilters: true })` reflete; (d) leitura admin traz `hidden_in_filters`. Rodar `npx tsx scripts/smoke-tema-fields.ts`.
- [ ] **T12 — Smoke UI + gates (@qa).** Rodar `scripts/smoke-ui.ts` (Playwright) se cobrir os campos do tema; `npm run typecheck`; `npm run lint`.

---

## Dev Notes

- **Por que só um ponto de UI resolve Lista + Kanban:** o Kanban (`pipeline.tsx`) e a Lista (`casos.lista.tsx`) renderizam o **mesmo** `CaseFiltersPanel`. O painel monta os selects a partir de `filterableDefs` (`CaseFiltersPanel.tsx:207`). Filtrar `hidden_in_filters` ali remove o filtro dos dois lugares de uma vez (AC4 + AC5). Não é preciso tocar `applyCaseFilters` nem `temaFilterDefs` do `pipeline.tsx:259` — sem select renderizado, `filters.canonical[key]` nunca é setado, então o matching é inerte para o campo oculto.
- **Ortogonalidade (AC8):** `hidden_in_filters` é lido **exclusivamente** no `filterableDefs`. Não entra na decisão de coluna (`InlineCanonicalCell`/`casos.lista`, que olham `hidden_in_list`) nem na ficha (`CaseFilterFillDialog`/`CaseCanonicalFields`, que ignoram ambos). Assim os três eixos não colidem.
- **Molde da migration:** copie `20260731000001_tema_field_defs_scope_multi.sql` — só a parte `ADD COLUMN IF NOT EXISTS` + `CREATE OR REPLACE VIEW SELECT *` + `GRANT`. **NÃO** há `CHECK` a criar (é BOOLEAN), então o arquivo fica mais curto que o molde (sem os `DO $$ ... $$` de constraint). A recriação da view é **obrigatória**: `SELECT *` é congelado na criação, então a coluna nova só aparece na view depois do `CREATE OR REPLACE`.
- **Grants:** manter os 3 roles `anon, authenticated, service_role` idênticos ao molde (`20260731000001:64`).
- **dev = prod:** aplicar via `scripts/db-apply-pg.ts` (o Supabase CLI não roda no Windows/OneDrive — ver memória "Aplicar migrations via pg direto"). Banco único.
- **`Update` dos types:** é `Partial<Insert>` (`types.ts:1034`) — logo, ao adicionar `hidden_in_filters?` no `Insert`, o `Update` herda automaticamente; o `FieldDefUpdate` do service (`tema-field-defs-service.ts:19`) já aceitará `hidden_in_filters`.
- **Texto do checkbox:** simetria com o existente ("Ocultar na lista (some da coluna; continua no filtro e na ficha)") → o novo é "Ocultar do filtro (some do painel de busca; continua na lista e na ficha)".
- **Colisão de key / scope:** esta story **não** toca `scope`, `key`, `findClientBucketKeyConflict` nem o guard de colisão — é ortogonal.

## Testing

- **Smoke DB** (`sistema-hv/scripts/smoke-tema-fields.ts`, estendido): create com `hiddenInFilters:true` persiste; default `false`; update reflete; leitura admin expõe `hidden_in_filters`. Cleanup por soft-delete já existente no `finally`. Rodar: `npx tsx scripts/smoke-tema-fields.ts` (da pasta `sistema-hv/`).
- **Smoke UI** (`sistema-hv/scripts/smoke-ui.ts`, Playwright): se cobrir o editor de campos do tema, validar que marcar "Ocultar do filtro" some o campo do painel de filtros mas mantém a coluna/ficha.
- **Manual/QA:** num tema com ≥1 campo, marcar "Ocultar do filtro" e confirmar: (a) some do painel na Lista; (b) some do painel no Kanban; (c) continua como coluna na Lista (se `hidden_in_list=false`); (d) continua na ficha. Desmarcar reverte.
- **Idempotência:** aplicar a migration 2× sem erro; aplicar rollback e reaplicar.
- **Gates:** `npm run typecheck` e `npm run lint` limpos.

## Dependências

- Nenhuma dependência de outras stories do épico. **Reusa** integralmente a infra de `system_tema_field_defs` (R2-07 / melhorias 2026-07-29). Não bloqueia nem é bloqueada por A1/A3+.
- Requer credenciais de banco em `.env.local` (para `db-apply-pg.ts` e o smoke DB).

## File List

**Novos**
- `sistema-hv/supabase/migrations/20260803000001_tema_field_defs_hidden_in_filters.sql`
- `sistema-hv/supabase/rollbacks/20260803000001_tema_field_defs_hidden_in_filters.rollback.sql`

**Alterados**
- `sistema-hv/src/lib/supabase/types.ts` (Row + Insert de `system_tema_field_defs`)
- `sistema-hv/src/lib/tema-field-defs-service.ts` (create + update)
- `sistema-hv/src/rpc/tema-field-defs.ts` (Zod create + update)
- `sistema-hv/src/hooks/useTemaFieldDefs.ts` (tipo + mutations)
- `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` (estado + toggle + badge)
- `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` (`filterableDefs` filtra `hidden_in_filters`)
- `sistema-hv/scripts/smoke-tema-fields.ts` (casos do `hidden_in_filters`)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-03 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-04 | v0.2 | Implementado (@dev via Orion). Migration `20260804000001_tema_field_defs_hidden_in_filters.sql` (+ rollback) APLICADA em produção via `db-apply-pg` (coluna `hidden_in_filters boolean default false` confirmada no banco; view `_active` recriada). Código: `types.ts` (Row/Insert), `useTemaFieldDefs.ts` (tipo + inputs create/update), `tema-field-defs-service.ts` (create/update), `rpc/tema-field-defs.ts` (zod create/update), `TemaFieldDefsEditor.tsx` (estado + reset + salvar + startEdit + badge "(fora do filtro)" + toggle "Ocultar do filtro"), `CaseFiltersPanel.tsx` (`filterableDefs` filtra `hidden_in_filters`). lint 0 erros (1 warning pré-existente react-refresh), typecheck sem erro novo (1 erro pré-existente contaazul). Status → Ready for Review; smoke UI p/ @qa. | @dev |
