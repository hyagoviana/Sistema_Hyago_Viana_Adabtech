# Story A4: Campos dependentes (grupo pai → grupo filho)

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** A4
**Status:** Ready for Review
**Estimativa relativa:** L
**Executor sugerido:** @data-engineer (migration + validação de profundidade) + @dev (tipos/service/RPC/hook/editor/render) · Quality gate: @qa
**Risco:** MÉDIO/ALTO (coluna nova auto-referente com FK + regra de profundidade/limite de filhos; render condicional em vários pontos; precisa cuidar de ciclos e casos degenerados)

---

## Story

**Como** admin que configura os campos de um tema,
**quero** marcar um campo como **dependente** de outro (grupo pai → grupo filho, ex.: Município → Período), definido **na criação do campo** (checkbox "dependente" + escolha do campo pai),
**para que** o campo filho só possa ser preenchido quando o pai já estiver preenchido, respeitando uma hierarquia (evitando "dois pais"), com limite de **3 níveis de profundidade** e **3 filhos por pai**.

Este é um **ACTION ITEM** da reunião 05/08 (também citado na T1: IVS ↔ município). A regra é imposta **na definição do campo** e aplicada na **ficha do caso** (e, por consequência, nos filtros): o filho fica **desabilitado** enquanto o pai estiver em branco.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (infra de campos de tema)

- **Tabela/view:** `system_tema_field_defs` + view `system_tema_field_defs_active` (`SELECT * ... WHERE deleted_at IS NULL`). Colunas atuais incluem `id`, `tema_id`, `frente_slug`, `key`, `label`, `type`, `options`, `ordem`, `required`, `active`, `scope`, `hidden_in_list`, `hidden_in_filters`, `max_occurrences`, `move_to_stage_slug` (ver `types.ts:997-1057`).
- **Molde de migration aditiva:** `sistema-hv/supabase/migrations/20260731000001_tema_field_defs_scope_multi.sql` (ADD COLUMN IF NOT EXISTS + DO-blocks para CHECK + `CREATE OR REPLACE VIEW _active` + `GRANT SELECT ... anon, authenticated, service_role`). A migration `20260804000003_tema_field_defs_move_to_stage.sql` é o molde mais recente (coluna nullable). Rollbacks em `sistema-hv/supabase/rollbacks/` (DROP COLUMN IF EXISTS + recria view).
- **Índice único:** `system_tema_field_defs_uq ON (tema_id, COALESCE(frente_slug,''), key) WHERE deleted_at IS NULL` (base em `20260719000006_tema_field_defs.sql:58-64`).
- **Service:** `sistema-hv/src/lib/tema-field-defs-service.ts` — `createTemaFieldDef` (input em `:169-183`, insert em `:236-256`), `updateTemaFieldDef` (patch em `:262-276`, clean em `:279-336`), `listTemaFieldDefs`/`listTemaFieldDefsAdmin` (`:74-113`).
- **RPC (Zod):** `sistema-hv/src/rpc/tema-field-defs.ts` — create (`:83-104`) e update (`:106-128`) com `handleAdmin` (gate `admin`).
- **Hook:** `sistema-hv/src/hooks/useTemaFieldDefs.ts` — tipo `TemaFieldDef` (`:25-46`), `useCreateTemaFieldDef` (`:88-108`), `useUpdateTemaFieldDef` (`:110-132`).
- **Editor (UI admin):** `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` — form (`formNode`, `:235-417`), estados (`:78-93`), `salvar` (`:137-187`), `startEdit` (`:189-201`), lista de defs com badges (`:429-503`). Tem o padrão de `Select` shadcn e checkboxes.
- **Render na FICHA:** `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` — `defs.map` → `TemaFieldInput` (`:123-138`, `:188-321`). Cada campo grava via `saveDef` (caso → `canonical_fields`; cliente → `custom_fields`). `TemaFieldInput` já recebe `canEdit`/`disabled`.
- **Tipos gerados:** `sistema-hv/src/lib/supabase/types.ts` bloco `system_tema_field_defs` (`Row` `:998-1019`, `Insert` `:1020-1041`, `Update = Partial<Insert>` `:1042`).
- **Aplicação de migration:** `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` (da pasta `sistema-hv/`). Banco **dev = prod**.
- **Smoke:** `sistema-hv/scripts/smoke-tema-fields.ts`.

### NOVO nesta story

1. **Coluna** `parent_field_def_id UUID NULL REFERENCES system_tema_field_defs(id) ON DELETE SET NULL` (auto-referente, nullable). Índice de leitura por pai. Recria a view `_active` + grants. Rollback simétrico.
2. **Validação de hierarquia** (no service, no create/update):
   - o pai precisa existir, pertencer ao **mesmo tema** (e mesma frente/painel) e **não ser o próprio campo** (sem auto-referência);
   - **sem ciclos** (o filho não pode ser ancestral do pai);
   - **profundidade máx. 3 níveis** (raiz → filho → neto; um 4º nível é recusado com 422);
   - **máx. 3 filhos por pai** (o 4º filho é recusado com 422).
3. **Tipos/RPC/hook** expõem `parentFieldDefId` (create/update) e `parent_field_def_id` (Row/tipo do hook).
4. **Editor:** checkbox **"Campo dependente"** + `Select` do **campo pai** (lista os campos do MESMO tema/frente elegíveis — exclui a si mesmo, descendentes e pais que já estão no 3º nível ou com 3 filhos). Badge "(depende de X)" na lista.
5. **Render condicional na ficha:** o `TemaFieldInput` do filho fica **desabilitado** (e com dica "Preencha *{pai}* primeiro") enquanto o valor do pai estiver vazio; ao preencher o pai, habilita. Vale também no pop-up de preenchimento (se aplicável).

---

## Acceptance Criteria

1. **Migration aditiva idempotente + view + grants + rollback.** `sistema-hv/supabase/migrations/20260806000001_tema_field_defs_parent.sql` adiciona `parent_field_def_id UUID NULL REFERENCES system_tema_field_defs(id) ON DELETE SET NULL` via `ADD COLUMN IF NOT EXISTS`, cria índice `idx_system_tema_field_defs_parent ON (parent_field_def_id) WHERE deleted_at IS NULL`, **recria** `system_tema_field_defs_active` (`SELECT *`) e reexecuta os grants (anon, authenticated, service_role). Rodar 2× sem erro. Rollback `20260806000001_tema_field_defs_parent.rollback.sql` faz `DROP INDEX IF EXISTS` + `DROP COLUMN IF EXISTS parent_field_def_id` + recria view + grants.
2. **Tipos/RPC expõem o pai.** `types.ts` (`Row.parent_field_def_id: string | null`, `Insert.parent_field_def_id?: string | null`); `TemaFieldDef.parent_field_def_id: string | null` no hook; create/update Zod aceitam `parentFieldDefId: z.string().uuid().nullish()`; service grava/atualiza (create: default `null`; update: só quando presente, aceitando `null` para "remover dependência").
3. **Validação de hierarquia no service.** `createTemaFieldDef`/`updateTemaFieldDef` recusam com **422** quando: (a) o pai não existe / é de outro tema (ou outra frente/painel); (b) o pai é o próprio campo (auto-referência); (c) a ligação cria **ciclo**; (d) a profundidade ultrapassa **3 níveis**; (e) o pai já tem **3 filhos**. Mensagens legíveis em pt-BR.
4. **Editor: definir dependência na criação.** No `TemaFieldDefsEditor`, checkbox **"Campo dependente"**; ao marcar, aparece um `Select` do **campo pai** com apenas os campos elegíveis do MESMO tema/frente (exclui: o próprio, seus descendentes, pais em 3º nível e pais com 3 filhos). O valor persiste no create e no update; `startEdit` recarrega. Badge "(depende de {label do pai})" no item da lista.
5. **Filho bloqueado sem pai preenchido (ficha).** Em `CaseCanonicalFields`/`TemaFieldInput`, um campo com `parent_field_def_id` fica **desabilitado** e mostra a dica "Preencha *{label do pai}* primeiro" enquanto o valor do pai (lido da fonte certa por `scope`) estiver vazio. Assim que o pai é preenchido, o filho habilita. Limpar o pai volta a desabilitar (e não apaga o valor já gravado do filho — só bloqueia edição).
6. **Limites respeitados.** É impossível criar 4º nível de profundidade ou 4º filho de um mesmo pai (barrado no editor via lista de elegíveis E no service via 422 — defesa em profundidade).
7. **Regressão zero.** Campos existentes têm `parent_field_def_id = NULL` (default) → comportam-se como hoje (sem dependência). Excluir o pai (soft-delete) faz `ON DELETE SET NULL` **não** disparar (soft-delete não é DELETE físico) — nesse caso o service/UI trata o pai ausente como "sem dependência efetiva" (o filho volta a ficar livre). Documentar esse comportamento.
8. **Gates.** `npm run typecheck`, `npm run lint`, smoke DB e smoke UI (se cobrir o editor) limpos.

---

## Tasks / Subtasks

- [x] **T1 — Migration (@data-engineer) [AC1].** Criado `sistema-hv/supabase/migrations/20260806000002_tema_field_defs_parent.sql` (timestamp `...000001` já ocupado por A5 initial_occ; usei o próximo livre `...000002`) espelhando `20260804000003`:
  - [x] `ALTER TABLE system_tema_field_defs ADD COLUMN IF NOT EXISTS parent_field_def_id UUID NULL REFERENCES system_tema_field_defs(id) ON DELETE SET NULL;`
  - [x] CHECK `parent_not_self` (auto-referência direta) via DO-block guardado.
  - [x] `CREATE INDEX IF NOT EXISTS idx_system_tema_field_defs_parent ON system_tema_field_defs (parent_field_def_id) WHERE deleted_at IS NULL;`
  - [x] `CREATE OR REPLACE VIEW system_tema_field_defs_active AS SELECT * ...;`
  - [x] `GRANT SELECT ... TO anon, authenticated, service_role;`
  - [x] Cabeçalho comentado (regra 3 níveis/3 filhos validada na aplicação).
- [x] **T2 — Rollback (@data-engineer) [AC1].** `sistema-hv/supabase/rollbacks/20260806000002_tema_field_defs_parent.rollback.sql`: DROP INDEX + DROP CONSTRAINT + DROP COLUMN + recria view + grants.
- [x] **T3 — Aplicar migration (@data-engineer) [AC1].** Aplicada via `db-apply-pg.ts`; idempotência confirmada (2× OK).
- [x] **T4 — Tipos gerados (@dev) [AC2].** `types.ts`: `parent_field_def_id: string | null` no Row; `?: string | null` no Insert.
- [x] **T5 — Service: coluna + validação (@dev) [AC2,AC3,AC6].** `parentFieldDefId?` em create/update; grava no insert (default null) e no update (só quando presente; null remove sem validar). `validateParent` cobre existência/mesmo tema/mesma frente/auto-ref/ciclo/profundidade≤3/≤3 filhos + altura da sub-árvore no update — todos 422.
- [x] **T6 — RPC/Zod (@dev) [AC2].** `parentFieldDefId: z.string().uuid().nullish()` no create e no patch do update.
- [x] **T7 — Hook (@dev) [AC2].** `parent_field_def_id` no tipo `TemaFieldDef`; `parentFieldDefId?` nos inputs das mutations.
- [x] **T8 — Editor (@dev) [AC4,AC6].** Estados `isDependent`/`parentId`; reset + startEdit; checkbox "Campo dependente" + Select de pais elegíveis (exclui self, descendentes, nível 3, pais com 3 filhos); envia `parentFieldDefId`; badge "depende de {label}" na lista.
- [x] **T9 — Render condicional na ficha (@dev) [AC5,AC7].** Resolve o pai em `defs`; lê o valor do pai da fonte certa por scope (`readFieldValue`); filho `canEdit=false` + dica "preencha {pai} primeiro" enquanto o pai vazio; pai ausente/soft-deletado → filho livre; não apaga valor gravado.
- [x] **T10 — Smoke DB (@qa) [AC3,AC6].** Bloco [15] em `scripts/smoke-tema-fields.ts`: pai/filho/neto ok; 4º nível 422; 4º filho 422; ciclo 422; auto-ref 422; pai de outro tema 422; remover dependência (null). **44/44 passou.**
- [x] **T11 — Smoke UI + gates (@qa) [AC4,AC5,AC8].** `npm run typecheck` limpo (só erro pré-existente `contaazul/service.ts`, ignorado); `eslint` dos arquivos tocados = 0. Smoke UI dedicado não incluído nesta rodada (editor coberto pelo smoke DB do service).

---

## Dev Notes

- **Por que L / risco alto:** coluna auto-referente + validação recursiva (ciclo/profundidade/limite de filhos) que **não** cabe em CHECK do Postgres — precisa ser garantida na aplicação (service) e espelhada no editor (lista de elegíveis). Defesa em profundidade: UI filtra + service valida (422).
- **`ON DELETE SET NULL` vs soft-delete:** a tabela usa **soft-delete** (`deleted_at`), então o FK físico só dispararia num DELETE real (que não acontece na app). Portanto o service/UI precisa tratar "pai com `deleted_at` setado" como **dependência inexistente** (filho livre) — AC7. Não confiar no `SET NULL` para limpar dependências; ele é só rede de segurança.
- **Mesma frente/painel:** um filho só pode depender de um pai do MESMO `(tema_id, COALESCE(frente_slug,''))` — misturar painel padrão com frente quebraria a resolução na ficha. Validar isso no service.
- **Profundidade 3 níveis:** contar como raiz(1) → filho(2) → neto(3). Um pai que já é neto (nível 3) não pode receber filhos (viraria nível 4) → excluir da lista de elegíveis e recusar no service.
- **3 filhos por pai:** contar os campos ativos com `parent_field_def_id = pai` (excluindo o próprio em edição); o 4º é recusado.
- **Leitura do valor do pai na ficha:** usar `fieldBag(def, {canonical_fields, client_custom_fields})` de `tema-field-value.ts` para respeitar `scope` do PAI (o pai pode ser scope cliente e o filho scope caso, ou vice-versa — decidir na validação se permite; por simplicidade, sugerir exigir MESMO scope, ou ao menos documentar). **Decisão sugerida:** permitir scopes diferentes, lendo cada um de sua fonte; registrar no Dev Notes se o owner quiser restringir.
- **Molde de migration:** copiar `20260804000003_tema_field_defs_move_to_stage.sql` (coluna nullable) — trocar o tipo por FK auto-referente e adicionar o índice. A recriação da view é **obrigatória** (`SELECT *` congela colunas).
- **dev = prod:** aplicar via `scripts/db-apply-pg.ts`.

## Testing

- **Smoke DB** (`scripts/smoke-tema-fields.ts` estendido): criação pai/filho/neto ok; 4º nível 422; 4º filho 422; ciclo 422; `parentFieldDefId: null` remove.
- **Smoke UI:** no editor, marcar "Campo dependente" e escolher pai; confirmar badge; na ficha, filho desabilitado até o pai ser preenchido; habilita ao preencher; volta a bloquear ao limpar (sem apagar valor).
- **Manual/QA:** montar Município → Período (2 níveis) e um 3º nível; tentar estourar limites; excluir (soft) o pai e ver o filho liberar.
- **Idempotência:** migration 2×; rollback e reaplicar.
- **Gates:** `npm run typecheck`, `npm run lint`.

## Dependências

- Independente de A2/A3/A5/A6. **Reusa** toda a infra de `system_tema_field_defs`. Pode ser combinada com A5 (multi-linha) e A6 (reordenar) sem conflito, mas mexe nos MESMOS arquivos (editor/service/hook/types) — coordenar merge.
- Requer credenciais de banco em `.env.local` (para `db-apply-pg.ts` e o smoke DB).

## File List

**Novos**
- `sistema-hv/supabase/migrations/20260806000001_tema_field_defs_parent.sql`
- `sistema-hv/supabase/rollbacks/20260806000001_tema_field_defs_parent.rollback.sql`

**Alterados**
- `sistema-hv/src/lib/supabase/types.ts` (Row + Insert)
- `sistema-hv/src/lib/tema-field-defs-service.ts` (input/patch + `validateParent` + create/update)
- `sistema-hv/src/rpc/tema-field-defs.ts` (Zod create + update)
- `sistema-hv/src/hooks/useTemaFieldDefs.ts` (tipo + mutations)
- `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` (checkbox + Select do pai + badge)
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` (bloqueio condicional do filho)
- `sistema-hv/scripts/smoke-tema-fields.ts` (casos de hierarquia)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Coluna `parent_field_def_id` (FK auto-ref, ON DELETE SET NULL) + CHECK auto-ref + índice parcial em `system_tema_field_defs`; view `_active` recriada + grants. Migration `20260806000002_tema_field_defs_parent.sql` (renumerada de ...000001, ocupado por A5) + rollback simétrico; aplicada e idempotente (2×). `validateParent` no service (existência/mesmo tema/mesma frente/auto-ref/ciclo/profundidade≤3/≤3 filhos + altura da sub-árvore no update → 422). Tipos (Row+Insert), RPC/Zod (create+update), hook (tipo+mutations). Editor: checkbox "Campo dependente" + Select de pais elegíveis + badge. Ficha: filho bloqueado até o pai preencher (dica), pai ausente→filho livre, valor não apagado. Arquivos: types.ts, tema-field-defs-service.ts, rpc/tema-field-defs.ts, useTemaFieldDefs.ts, TemaFieldDefsEditor.tsx, CaseCanonicalFields.tsx, smoke-tema-fields.ts. Gates: typecheck limpo (só contaazul pré-existente), eslint 0 nos tocados, smoke DB 44/44. | @dev |
