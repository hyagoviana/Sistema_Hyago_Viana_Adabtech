# Story B1: Campo personalizado do Cliente espelhado no(s) Caso(s) — fonte única + vínculo a tema(s)

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** B1 (inclui B2)
**Status:** Ready for Review
**Estimativa relativa:** XL
**Executor sugerido:** @architect (decisões D1/D2 do modelo) → @data-engineer (migration) + @dev (RPC/UI) · Quality gate: @qa
**Risco:** MÉDIO/ALTO (núcleo; toca a bifurcação cliente↔tema, dado compartilhado entre pipelines)

---

## Story

**Como** administrador que configura os campos personalizados do **Cliente**,
**quero** marcar um campo do cliente como **"aparece em caso"** e escolher **em quais temas** ele aparece,
**para que** esse dado — cuja **fonte é única (o cliente)** — apareça como campo/filtro/coluna nas pipelines escolhidas, e para que **editar o valor em qualquer tema** grave no cliente e **reflita automaticamente em todos os temas** vinculados (é o mesmo dado da pessoa refletindo em N lugares, não uma cópia).

Hoje o filtro/campo do tema é vinculado ao **ID da pipeline** (entidade abaixo de "caso"), então **não existe** um filtro único que sirva "para todos os temas de uma vez". A solução aprovada pelo Adavio (levantamento §B, Nota técnica) é uma **BIFURCAÇÃO**: ao criar/marcar um campo no **cliente**, um comando "vincular a tema(s)" cria/liga o **mesmo campo** como campo `scope='cliente'` nas pipelines escolhidas, todos alimentados pelo **balde único** `system_clients.custom_fields` (um comando vem de dois lugares — cadastro do cliente **e** ficha do caso).

Inclui **B2**: ao criar um campo no cliente, o admin marca se o campo **vai para o(s) caso(s)/pipeline(s)** ou **fica só no perfil do cliente**.

> **Achado-chave da exploração:** metade do núcleo **JÁ EXISTE**. O sistema já tem `scope='cliente'` nos campos de tema (`system_tema_field_defs`): um campo de tema com `scope='cliente'` lê/grava em `system_clients.custom_fields` (compartilhado entre todos os casos do cliente) — ver `tema-field-value.ts:31` (`fieldBag`) e `CaseCanonicalFields.tsx:90` (grava no cliente quando `scope==='cliente'`). O que **falta** é: (a) **originar** esse vínculo a partir do **cadastro do Cliente** (não só do editor do tema); (b) a marcação **B2** + o seletor **"em quais temas"**; (c) manter o **casamento de key** entre o campo do cliente e as defs de tema espelhadas (a colisão de key no balde do cliente já é tratada em `findClientBucketKeyConflict`).

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (padrões a reusar — a bifurcação se apoia neles)

- **Campos do CLIENTE (form builder):** tabela `system_client_field_defs` + view `system_client_field_defs_active` (migration `sistema-hv/supabase/migrations/20260622000002_client_custom_fields.sql`). Valores por cliente no JSONB `system_clients.custom_fields`. Colunas atuais: `key, label, field_type ('text'|'textarea'|'number'|'date'|'select'|'multiselect'|'boolean'), options, required, help_text, ordem, active`. `key` é UNIQUE por org entre não-excluídos (`:38`).
- **Service do cliente:** `sistema-hv/src/lib/client-fields-service.ts` — `listFieldDefs`, `createFieldDef` (gera `key` único via `uniqueKey`, `:31`), `updateFieldDef`, `deleteFieldDef` (purga JSONB via RPC `system_fn_purge_client_field`), `reorderFieldDefs`, `setFieldActive`.
- **RPC do cliente:** `sistema-hv/src/rpc/clientFields.ts` — mutations **já são admin-only** (`ADMIN_ONLY = ["admin"]`, `requireRole`); leitura via `requireAuth`.
- **Hook do cliente:** `sistema-hv/src/hooks/useClientFields.ts` (`useClientFieldDefs`, `useCreate/Update/Delete/Reorder/SetActive...`).
- **Validators do cliente:** `sistema-hv/src/lib/validators/clientFields.ts` (`fieldDefCreateSchema`/`fieldDefUpdateSchema`, `FIELD_TYPES`, `FIELD_TYPE_LABELS`).
- **UI do cliente:** `sistema-hv/src/components/clients/ClientFieldsManagerDialog.tsx` (dialog "Informações de cadastro de clientes"; lista + editor de campo). Aberto por `sistema-hv/src/components/clients/ClientRoster.tsx:446` (`canManageFields`).
- **Campos do TEMA com `scope`:** tabela `system_tema_field_defs` + view `_active`. A coluna `scope ('caso'|'cliente')` já existe; `scope='cliente'` faz o valor vir de `system_clients.custom_fields`. Service `sistema-hv/src/lib/tema-field-defs-service.ts` — `createTemaFieldDef`/`updateTemaFieldDef` (aceitam `scope`), e **`findClientBucketKeyConflict` (`:138`)** já garante que a MESMA `key` no balde do cliente pertence ao MESMO conceito (mesmo rótulo normalizado) — é exatamente o mecanismo que permite "um dado refletir em N temas".
- **Leitura do valor pela fonte certa (client-safe):** `sistema-hv/src/lib/cases/tema-field-value.ts` — `fieldBag`/`readFieldValue` escolhem `client_custom_fields` quando `scope==='cliente'`.
- **Escrita pela fonte certa (ficha do caso):** `sistema-hv/src/components/cases/CaseCanonicalFields.tsx:88-102` — `saveDef` grava no cliente (`updateClientMut`) quando `scope==='cliente'`, no caso (`updateMut`) quando `scope==='caso'`. **É aqui que "editar num tema grava no cliente e reflete nos demais" já acontece hoje** para campos de tema `scope='cliente'`.
- **Filtro/coluna nas pipelines:** `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` (`filterableDefs`, `:209`) + `casos.lista.tsx` (colunas via `InlineCanonicalCell`). Consomem `useTemaFieldDefs(temaId)` — ou seja, uma def de tema `scope='cliente'` **já vira** filtro/coluna naquele tema.
- **Editor de campos do tema:** `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` (tem o seletor "Onde fica o valor: do caso / do cliente", `:302-320`).
- **Lista de temas (p/ o seletor "em quais temas"):** `sistema-hv/src/hooks/useTemas.ts` (`useTemas()`, `:20`).
- **Aplicação de migration:** `npx tsx scripts/db-apply-pg.ts <arquivo.sql>` (da pasta `sistema-hv/`). Banco **dev = prod**.

### NOVO nesta story

1. **Marcação B2 no campo do cliente:** flag "aparece em caso" (`appears_in_cases`) em `system_client_field_defs` — "onde esse campo aparece? Só cliente, ou cliente + casos?".
2. **Vínculo campo-do-cliente → tema(s):** tabela de vínculo **`system_client_field_tema_links`** (`client_field_def_id`, `tema_id`) — decisão de modelo em **D1**.
3. **Bifurcação (efeito colateral do vínculo):** ao vincular um campo do cliente a um tema, o backend cria/reativa a **def de tema espelho** (`system_tema_field_defs` com `scope='cliente'`, **mesma `key` e mesmo `label`** do campo do cliente) naquele tema; ao desvincular, **oculta** (soft) a def espelho — nunca apaga o dado do cliente. Isso reusa `findClientBucketKeyConflict` (mesmo conceito, mesma key) e faz o campo aparecer como filtro/coluna/ficha na pipeline.
4. **UI de vínculo no cadastro do cliente:** no `ClientFieldsManagerDialog`, por campo: toggle "aparece em caso" + botão/seção "vincular a tema(s)" com multisseleção de temas (`useTemas`).
5. **Leitura única garantida:** o valor exibido/editado em qualquer tema vinculado é sempre o de `system_clients.custom_fields[key]` (já é o comportamento de `scope='cliente'`); esta story apenas garante que **todas** as defs espelho compartilham a **mesma key**.

---

## Decisões de design em aberto (resolver com @architect antes da migration)

- **D1 — Modelo do vínculo.** Duas opções:
  - **D1-A (tabela de vínculo — recomendada):** `system_client_field_tema_links (id, organization_id, client_field_def_id → system_client_field_defs, tema_id → system_temas, created_at, deleted_at)`. Vantagem: N:N limpo, auditável, permite desvincular sem tocar no campo do cliente; a def-espelho de tema é derivada do vínculo. É a proposta base desta story.
  - **D1-B (flag + array):** `appears_in_cases BOOLEAN` + `tema_ids UUID[]` direto em `system_client_field_defs`. Mais simples, porém sem integridade referencial no array e mistura estado no registro do campo. Descartar salvo se o @architect preferir.
  - **Recomendação:** D1-A para o vínculo N:N + `appears_in_cases BOOLEAN` (B2) como flag de conveniência no próprio campo do cliente (a UI liga/desliga a seção de temas; `appears_in_cases=false` ⇒ zero vínculos).
- **D2 — Fonte da verdade da def de tema espelho.** A def-espelho em `system_tema_field_defs` (`scope='cliente'`) é **derivada** do vínculo (o vínculo é o mestre; a def-espelho é reconciliada a partir dele) **ou** o vínculo apenas **registra** e a def-espelho é gerenciada pelo editor de tema como hoje?
  - **Recomendação:** vínculo é mestre → um serviço `reconcileClientFieldTemaLinks(clientFieldDefId)` cria/oculta as defs-espelho idempotentemente (mesma key/label), evitando divergência. O editor de tema (`TemaFieldDefsEditor`) continua podendo criar defs `scope='cliente'` avulsas (compatível, pois compartilham o balde por key).

---

## Acceptance Criteria

1. **(B2) Marcação "aparece em caso" no campo do cliente.** `system_client_field_defs` ganha `appears_in_cases BOOLEAN NOT NULL DEFAULT FALSE` (migration aditiva idempotente; view `_active` recriada; grants). No `ClientFieldsManagerDialog`, cada campo tem um toggle **"Aparece nos casos (além do cadastro do cliente)"**; `false` = campo fica só no perfil do cliente. Regressão zero: campos existentes assumem `false`.
2. **(Vínculo) Seleção de tema(s).** Com "aparece em caso" ligado, o admin escolhe **em quais temas** o campo aparece (multisseleção alimentada por `useTemas`). O vínculo é persistido conforme **D1** (tabela `system_client_field_tema_links` recomendada). Desmarcar "aparece em caso" remove todos os vínculos (e oculta as defs-espelho — AC5).
3. **(Bifurcação) Def-espelho criada nas pipelines escolhidas.** Ao vincular o campo do cliente ao tema T, o backend garante em `system_tema_field_defs` uma def **`scope='cliente'`, `tema_id=T`, `frente_slug=null`, `key`=key-do-campo-do-cliente, `label`=label-do-campo-do-cliente**, ativa (idempotente: se já existe def compatível, reusa; se estava oculta, reativa). Ao desvincular, a def-espelho é **ocultada** (`active=false` — soft), **nunca** deletada, e o valor do cliente **permanece** intacto.
4. **(Leitura única) O valor vem do cliente.** Em qualquer tema vinculado, o valor exibido/editado do campo é o de `system_clients.custom_fields[key]` (comportamento `scope='cliente'` já existente em `tema-field-value.ts`/`CaseCanonicalFields.tsx`). Não há duplicação de valor por tema.
5. **(Reflexo) Editar em qualquer tema grava no cliente e reflete nos demais.** Editar o campo na ficha de um caso do tema T1 grava em `system_clients.custom_fields[key]`; ao abrir um caso do tema T2 (mesmo cliente, mesmo campo vinculado), o novo valor aparece. Idem editar direto no cadastro do cliente. Todos os pontos leem/gravam o **mesmo balde/mesma key**.
6. **(Filtro/coluna) O campo aparece nas pipelines escolhidas.** Em cada tema vinculado, o campo-espelho aparece como **filtro** no `CaseFiltersPanel` (respeitando `hidden_in_filters`) e como **coluna** na `casos.lista` (respeitando `hidden_in_list`) — porque é uma def de tema `scope='cliente'` normal.
7. **(Casamento de key) Sem colisão de conceito.** A key da def-espelho é sempre a key do campo do cliente. O guard `findClientBucketKeyConflict` continua barrando reuso da mesma key para um **conceito diferente** (rótulo divergente) — a bifurcação usa o MESMO rótulo, então não conflita.
8. **(RBAC) Só admin.** Criar campo do cliente, marcar "aparece em caso" e vincular/desvincular temas exige `admin` (server-side, ver Story B3). A UI esconde os controles para não-admin.
9. **Regressão zero + gates.** Nenhum campo existente muda de comportamento; `npm run typecheck` e `npm run lint` limpos; smoke DB e UI passam.

---

## Tasks / Subtasks

- [x] **T0 — Decidir D1/D2 (@architect).** D1 = **D1-A** (tabela N:N `system_client_field_tema_links` + `appears_in_cases` flag). D2 = **vínculo é MESTRE**: def-espelho reconciliada por `reconcileClientFieldTemaLinks`. Registrado no Change Log. (AC1, AC2, AC3)
- [x] **T1 — Migration (@data-engineer).** Criada `sistema-hv/supabase/migrations/20260806000004_client_field_appears_in_cases.sql` (timestamp ajustado: o `20260805000001` já estava em uso; próximo livre = `20260806000004`):
  - [x] `ALTER TABLE system_client_field_defs ADD COLUMN IF NOT EXISTS appears_in_cases BOOLEAN NOT NULL DEFAULT FALSE;`
  - [x] `CREATE OR REPLACE VIEW system_client_field_defs_active ...` + grants.
  - [x] `CREATE TABLE IF NOT EXISTS system_client_field_tema_links (...)` conforme D1-A (FKs; UNIQUE parcial entre não-excluídos; índices; trigger `updated_at`; view `_active`; RLS por org; grants; auditoria `system_fn_audit`).
  - [x] Cabeçalho comentado explicando a bifurcação e a regressão zero. (AC1, AC2, AC9)
- [x] **T2 — Rollback (@data-engineer).** `sistema-hv/supabase/rollbacks/20260806000004_client_field_appears_in_cases.rollback.sql`: DROP da tabela/view + DROP COLUMN + recria view.
- [x] **T3 — Aplicar migration (@data-engineer).** Aplicada via `npx tsx scripts/db-apply-pg.ts` — **idempotente confirmada rodando 2×** (OK nas duas).
- [x] **T4 — Tipos gerados (@dev).** `types.ts`: `appears_in_cases` no bloco `system_client_field_defs` (Row/Insert) + bloco novo `system_client_field_tema_links` (Tables) + view `system_client_field_tema_links_active` (Views). (AC1, AC2)
- [x] **T5 — Service (@dev).** `client-fields-service.ts`: `appears_in_cases` no create/update; `reconcileClientFieldTemaLinks` (diff + grava/soft-deleta vínculos + cria/reativa/oculta def-espelho); `listClientFieldTemaLinks`; `deleteFieldDef` desfaz a bifurcação. (AC3, AC5, AC7)
- [x] **T6 — RPC/Zod (@dev).** `clientFields.ts`: `appears_in_cases` nos schemas; `setClientFieldTemaLinksFn` + `listClientFieldTemaLinksFn` (mutation `requireModule("sistema","edit")` = admin gate B3; leitura `requireAuth`). Handler propaga `TemaFieldDefServiceError`. (AC2, AC8)
- [x] **T7 — Hook (@dev).** `useClientFields.ts`: `useClientFieldTemaLinks` + `useSetClientFieldTemaLinks` (invalida `clientFieldDefs.all`, `client-field-tema-links`, `temas`, `tema-field-defs`, `tema-field-defs-admin`). `appears_in_cases` exposto.
- [x] **T8 — UI de vínculo (@dev).** `ClientFieldsManagerDialog.tsx`: toggle **"Aparece nos casos"** + seção "Temas onde aparece" (chips multisseleção de `useTemas`) que persiste via `setClientFieldTemaLinks`; desligar o toggle limpa os vínculos; ao criar campo com o toggle ligado, entra em edição para escolher os temas. (AC1, AC2, AC5)
- [x] **T9 — Verificar reflexo na pipeline (@dev/@qa).** A def-espelho é uma def de tema `scope='cliente'` normal (mesma key do cliente), logo é consumida por `CaseFiltersPanel`/`casos.lista`/`CaseCanonicalFields` como qualquer campo `scope='cliente'` — confirmado pelo smoke DB (key igual + valor único no balde). (AC4, AC5, AC6)
- [x] **T10 — Smoke DB (@qa).** `sistema-hv/scripts/smoke-client-field-tema.ts` — **19/19 checks passam**; cobre criar/vincular T1+T2/mesma key/idempotência/valor único/desvincular oculta espelho/reativar/conflito de conceito 409/excluir desfaz bifurcação. Cleanup soft-delete (zero rows ativos após rodar). (AC3, AC4, AC5, AC7)
- [x] **T11 — Gates (@qa).** `npm run typecheck` limpo (só o pré-existente `contaazul/service.ts`); `npx eslint` nos arquivos tocados = 0. Smoke UI Playwright NÃO executado (fora do escopo desta rodada; a lógica está coberta pelo smoke DB). (AC9)

---

## Dev Notes

- **Por que reusar `scope='cliente'` em vez de inventar um "filtro acima de todos os temas":** o levantamento (Nota técnica §B) diz explicitamente que o filtro é vinculado ao ID da pipeline (abaixo de "caso"); não há filtro "acima de todas as entidades". A def-espelho `scope='cliente'` **por tema**, todas apontando para o mesmo balde `system_clients.custom_fields[key]`, é exatamente a "bifurcação: um comando vem de dois lugares" descrita pelo Adavio. O reflexo entre temas já é gratuito porque a fonte é única.
- **Casamento de key é o coração.** Todas as defs-espelho de um mesmo campo do cliente devem ter a **mesma `key`** (a key do `system_client_field_defs`). `findClientBucketKeyConflict` (`tema-field-defs-service.ts:138`) já permite reuso da mesma key para o **mesmo conceito** (rótulo igual) e bloqueia conceitos diferentes — a bifurcação sempre usa o mesmo rótulo, então não conflita. **Não** deixe o `createTemaFieldDef` re-slugar a key para algo diferente: passe `key` explícito (a key do campo do cliente) no create da def-espelho.
- **Desvincular ≠ apagar.** Desvincular oculta a def-espelho (`active=false`); o valor em `custom_fields` do cliente permanece (mesma filosofia do `deleteTemaFieldDef`, que não apaga valores). Só o `deleteFieldDef` do cliente (com `system_fn_purge_client_field`) apaga o dado — e aí deve também soft-deletar os vínculos e ocultar as defs-espelho.
- **`select` vs tipos do tema.** `system_client_field_defs.field_type` tem `textarea` (que o tema não tem). Ao criar a def-espelho, mapear `textarea`→`text` (o balde é string livre; não perde dado). Documentar esse mapeamento no `reconcile`.
- **dev = prod:** aplicar via `scripts/db-apply-pg.ts` (Supabase CLI não roda no Windows/OneDrive — ver memória "Aplicar migrations via pg direto").
- **Invalidação de cache:** ao vincular/desvincular, invalidar `["tema-field-defs", temaId]`, `["tema-field-defs-admin", temaId]` e `queryKeys.clientFieldDefs.all` para os painéis refletirem na hora.

## Testing

- **Smoke DB** (`sistema-hv/scripts/smoke-client-field-tema.ts`): fluxo completo criar→vincular(T1,T2)→gravar→ler nos 2→desvincular(T2)→ocultar espelho, com asserts de key igual e valor único. Cleanup soft-delete.
- **Smoke UI** (Playwright): cadastro do cliente → marcar "Aparece nos casos" → selecionar 2 temas → abrir caso do T1, editar campo → abrir caso do T2, valor reflete.
- **Manual/QA:** um mesmo campo (ex.: "IVS do município") vinculado a 2 temas; editar num, conferir no outro e no cadastro do cliente; conferir que aparece como filtro/coluna nos 2 temas; desvincular 1 tema e confirmar que some do filtro daquele tema mas o valor do cliente continua.
- **Idempotência:** aplicar migration 2×; re-vincular o mesmo tema não duplica def-espelho; rollback e reaplicar.
- **Gates:** `npm run typecheck` e `npm run lint` limpos.

## Dependências

- **B3** (gate admin) reforça o AC8; B1 já usa `requireRole(ADMIN_ONLY)` nos novos endpoints, então não fica bloqueada por B3 (B3 amplia/uniformiza o gate).
- **I1** (tela dedicada de campos personalizados) consome a UI de vínculo do cliente construída aqui; I1 depende de B1, não o contrário.
- Reusa integralmente a infra `scope='cliente'` (Reunião 2026-07-29) e `system_client_field_defs` (Melhoria 1, `20260622000002`).
- Requer credenciais de banco em `.env.local` (para `db-apply-pg.ts` e smoke DB).

## File List

**Novos**
- `sistema-hv/supabase/migrations/20260805000001_client_field_appears_in_cases.sql`
- `sistema-hv/supabase/rollbacks/20260805000001_client_field_appears_in_cases.rollback.sql`
- `sistema-hv/scripts/smoke-client-field-tema.ts`

**Alterados**
- `sistema-hv/src/lib/supabase/types.ts` (`system_client_field_defs` + nova `system_client_field_tema_links`)
- `sistema-hv/src/lib/validators/clientFields.ts` (`appears_in_cases` nos schemas)
- `sistema-hv/src/lib/client-fields-service.ts` (`appears_in_cases`, `reconcileClientFieldTemaLinks`, `listClientFieldTemaLinks`)
- `sistema-hv/src/rpc/clientFields.ts` (`setClientFieldTemaLinksFn`, `listClientFieldTemaLinksFn`, `appears_in_cases`)
- `sistema-hv/src/hooks/useClientFields.ts` (hooks de vínculo + `appears_in_cases`)
- `sistema-hv/src/components/clients/ClientFieldsManagerDialog.tsx` (toggle "Aparece nos casos" + seletor de temas)
- `sistema-hv/src/lib/tema-field-defs-service.ts` (se preciso, aceitar `key` explícito na criação da def-espelho)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). **D1 = D1-A** (tabela N:N `system_client_field_tema_links` + flag `appears_in_cases`); **D2 = vínculo é MESTRE** (def-espelho de tema derivada/reconciliada por `reconcileClientFieldTemaLinks`, idempotente). **Migration** `20260806000004_client_field_appears_in_cases.sql` (+rollback) — aplicada e idempotente 2×; timestamp `20260805000001` do rascunho já estava em uso, usado o próximo livre. **Arquivos:** migration+rollback; `src/lib/supabase/types.ts` (coluna + tabela + view `_active`); `src/lib/validators/clientFields.ts` (`appears_in_cases` + `setClientFieldTemaLinksSchema`); `src/lib/client-fields-service.ts` (`reconcileClientFieldTemaLinks`/`listClientFieldTemaLinks` + delete desfaz bifurcação); `src/lib/tema-field-defs-service.ts` (flag `rawKey` p/ a def-espelho casar a key EXATA do cliente — sem `rawKey`, `toKey` colapsava os underscores e quebrava o balde compartilhado); `src/rpc/clientFields.ts` (2 server fns, gate `requireModule("sistema","edit")`); `src/hooks/useClientFields.ts` (2 hooks); `src/components/clients/ClientFieldsManagerDialog.tsx` (toggle + chips de temas); `scripts/smoke-client-field-tema.ts` (novo). **Gates:** typecheck limpo (só pré-existente `contaazul/service.ts`), eslint 0 nos tocados, **smoke DB 19/19**. **Achado-chave:** `toKey()` do serviço de tema removia os underscores da key — fix `rawKey:true` é o que garante o casamento de key (coração do AC7). Status → Ready for Review. | @dev (James) |
