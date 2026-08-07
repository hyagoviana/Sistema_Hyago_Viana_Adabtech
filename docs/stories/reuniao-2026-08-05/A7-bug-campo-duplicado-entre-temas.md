# Story A7: BUG — criar campo com key/rótulo já usado em OUTRO tema é bloqueado como "duplicado"

**Épico:** Reunião 2026-08-05 — Melhorias + Motor ProJuris
**ID:** A7
**Status:** Ready for Review
**Estimativa relativa:** M
**Executor sugerido:** @dev (service) + @data-engineer (auditar índice/estado do banco) · Quality gate: @qa
**Risco:** MÉDIO (mexe na validação de unicidade — precisa cuidar de regressão: NÃO reabrir duplicata DENTRO do mesmo tema)
**Prioridade:** 🔴 ALTA

---

## Story

**Como** admin que cria campos personalizados em vários temas,
**quero** poder criar um campo com o **mesmo key/rótulo** que já existe em **OUTRO tema** (ex.: "Município" no tema A e no tema B),
**para que** a unicidade seja **por tema** (não global) — mantendo o bloqueio **dentro do mesmo tema** e com opção de liberar manualmente quando for o mesmo dado do cliente.

**BUG** relatado na reunião 05/08: criar um campo cujo `key`/rótulo já existe em outro tema estava sendo **barrado como "duplicado"**. A unicidade **estrutural** já é por tema (índice `(tema_id, COALESCE(frente_slug,''), key)`), mas há uma **segunda** validação (`scope='cliente'`) que compara a `key` **globalmente** entre temas — é ela que barra campos legítimos.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE — as DUAS validações de unicidade

1. **Índice único POR TEMA (correto):** `system_tema_field_defs_uq ON (tema_id, COALESCE(frente_slug,''), key) WHERE deleted_at IS NULL` — `sistema-hv/supabase/migrations/20260719000006_tema_field_defs.sql:58-64`. Isso **já** permite a mesma `key` em temas diferentes. A mesma regra é pré-checada no service com **409** legível: `createTemaFieldDef` faz `.eq("tema_id", input.temaId).eq("key", key)` (+ frente) → "Já existe um campo com essa chave neste tema/frente." (`sistema-hv/src/lib/tema-field-defs-service.ts:209-221`). **Esse ramo está CORRETO** (é escopo por tema).

2. **Validação de balde do CLIENTE (a causa provável do bug):** `findClientBucketKeyConflict(sb, key, label, excludeTemaFieldId)` — `tema-field-defs-service.ts:138-167`. Roda **só quando `scope === 'cliente'`** (create `:225-234`; update `:340-360`). Ela compara a `key` **GLOBALMENTE**:
   - **(a)** contra `system_client_field_defs_active` (campos do cliente, org-wide) com a mesma `key` (`:148-154`);
   - **(b)** contra `scope='cliente'` de **QUALQUER outro tema** com a mesma `key` (`:157-165`: `.eq("scope","cliente").eq("key", key)` — sem filtrar `tema_id`).
   - Retorna o rótulo conflitante quando o **rótulo normalizado difere** (significado diferente) → o service lança **409**: *"A chave "X" já é usada pelo campo "Y" nos dados do cliente. Renomeie..."* (`:227-233` / `:351-357`).
   - **Intenção original:** o balde `system_clients.custom_fields` é COMPARTILHADO entre casos/temas para campos `scope='cliente'`, então a mesma `key` com **significado diferente** sobrescreveria dados. Por isso a checagem é global **de propósito** para scope cliente.
   - **O bug:** para o owner isso aparece como "não deixa criar 'Município' em outro tema porque já existe em outro" — mesmo quando é `scope='caso'` (não deveria nem entrar aqui) OU quando é o MESMO dado do cliente mas com rótulo levemente diferente. Se o campo relatado é `scope='caso'`, a validação (2) **não roda** e o bloqueio vem de outro lugar — **investigar** qual das duas realmente disparou no caso reportado.

- **Gancho de "liberar manualmente":** a mensagem já sugere "use exatamente o mesmo rótulo, se for o mesmo dado da pessoa" (reuso legítimo = mesma `key` + mesmo rótulo normalizado → NÃO bloqueia). Falta um caminho explícito de **override**.
- **RPC/Editor:** create/update em `rpc/tema-field-defs.ts` (`:83-128`), erro exibido via `toast.error(err.message)` no `TemaFieldDefsEditor.salvar` (`:184-186`).

### NOVO nesta story

1. **Diagnóstico primeiro:** reproduzir o caso do owner e identificar **qual** validação disparou (índice por-tema já é correto; suspeita recai em `findClientBucketKeyConflict` para `scope='cliente'`, ou em algum uso indevido dela para `scope='caso'`).
2. **Garantir unicidade POR TEMA para `scope='caso'`:** confirmar que campos `scope='caso'` **nunca** são barrados por existirem em outro tema (só dentro do mesmo tema/frente). Se algo os estiver barrando globalmente, corrigir.
3. **Refinar a checagem de balde do cliente (`scope='cliente'`):** manter a proteção contra **sobrescrita de significado diferente** no balde compartilhado, mas **não** bloquear quando é claramente o mesmo dado (mesmo rótulo) — e adicionar um **override explícito** (flag `allowSharedClientKey`/`forceCreate`) para o admin liberar manualmente ("é o mesmo dado da pessoa").
4. **Mensagens de erro** deixam claro que é **por tema** e como liberar.

---

## Acceptance Criteria

1. **Diagnóstico registrado.** Reproduzir o cenário do owner (criar campo com key/rótulo já existente em outro tema) e documentar no Dev Notes **qual** validação disparou (`system_tema_field_defs_uq`/pré-check por-tema **ou** `findClientBucketKeyConflict`) e para qual `scope`. Um teste que reproduz o bug antes da correção.
2. **`scope='caso'` é único só POR TEMA.** Criar um campo `scope='caso'` com a MESMA `key`/rótulo em **temas diferentes** funciona (sem 409). Criar a MESMA `key` no MESMO tema/frente continua barrado com 409 "…neste tema/frente." (comportamento do índice + pré-check `:209-221` preservado).
3. **`scope='cliente'`: mesmo dado é permitido, significado diferente é avisado.** Para `scope='cliente'` com a mesma `key` e **mesmo rótulo normalizado** (mesmo dado da pessoa) em temas diferentes → **permitido** (comportamento atual de reuso legítimo). Com **rótulo diferente** (significado diferente) → continua avisando (409), **mas** com opção de override.
4. **Override manual.** Novo parâmetro (ex.: `allowSharedClientKey: boolean`, default false) no create/update (service + RPC + hook) e um controle no editor ("Usar mesmo campo do cliente / liberar chave compartilhada") que, quando ativo, **pula** o bloqueio de `findClientBucketKeyConflict` (assumindo intencional o compartilhamento do balde). Sem override, o comportamento seguro atual é mantido.
4. **Bloqueio dentro do mesmo tema mantido.** Independente de scope, criar a MESMA `key` (mesmo `tema_id` + mesma frente/painel) continua barrado com 409 legível (regressão zero do caso legítimo de duplicata real).
5. **Mensagens claras.** As mensagens de 409 deixam explícito que a unicidade é **por tema** ("…neste tema/frente") e, no caso do cliente, explicam o override ("marque 'liberar chave compartilhada' se for o mesmo dado da pessoa").
6. **Gates + testes.** `npm run typecheck`, `npm run lint`, smoke DB (`scripts/smoke-tema-fields.ts` estendido) cobrindo: mesma key em temas diferentes (scope caso → ok; scope cliente mesmo rótulo → ok; scope cliente rótulo diferente → 409 sem override, ok com override); mesma key no mesmo tema → 409.

---

## Tasks / Subtasks

- [x] **T1 — Reproduzir + diagnosticar (@dev/@qa) [AC1].** Escrever um teste no smoke (`scripts/smoke-tema-fields.ts`) que cria um campo em `temaA` e tenta o mesmo em `temaB`, para `scope='caso'` e `scope='cliente'` (rótulo igual e diferente). Rodar e capturar qual validação dispara. Registrar no Dev Notes/Change Log. **DIAGNÓSTICO:** o bug vem de `findClientBucketKeyConflict` ramo **(b)** (`:157-165`) — compara a `key` GLOBALMENTE em `scope='cliente'` de QUALQUER tema, sem filtrar `tema_id`. Dispara só para `scope='cliente'` com rótulo normalizado diferente. `scope='caso'` NUNCA chega nessa checagem (já guardado em `:225`/`:340`); é barrado só pelo índice por-tema (correto). Reproduzido no smoke [4]/[9].
- [x] **T2 — Confirmar unicidade por-tema p/ `scope='caso'` (@dev/@data-engineer) [AC2].** Índice `system_tema_field_defs_uq` já é por-tema (correto); pré-check `:209-221` idem. Confirmado por smoke [8]: mesma key `scope='caso'` em temaA e temaB → ambos criam; mesma key no mesmo tema → 409. `findClientBucketKeyConflict` só roda em `scope==='cliente'`. Sem migration.
- [x] **T3 — Override no service (@dev) [AC3,AC4].** Em `tema-field-defs-service.ts`:
  - [x] adicionar `allowSharedClientKey?: boolean` ao input do create e ao patch do update;
  - [x] no create, envolver a chamada `findClientBucketKeyConflict` em `if (scope === "cliente" && !input.allowSharedClientKey)`;
  - [x] no update, idem (`(clean.scope === "cliente" || patch.label !== undefined) && !patch.allowSharedClientKey`);
  - [x] manter o retorno "reuso legítimo" (mesmo rótulo → null) inalterado. `allowSharedClientKey` NÃO é persistido (insert/update montam colunas explicitamente).
- [x] **T4 — RPC/Hook (@dev) [AC4].** `rpc/tema-field-defs.ts`: `allowSharedClientKey: z.boolean().optional()` no create e no `patch` do update. `useTemaFieldDefs.ts`: propagado no input de `useCreateTemaFieldDef`/`useUpdateTemaFieldDef`.
- [x] **T5 — Editor (@dev) [AC4,AC5].** Em `TemaFieldDefsEditor.tsx`: quando `scope === "cliente"`, checkbox "Usar o mesmo campo do cliente (liberar chave compartilhada)"; envia `allowSharedClientKey` (forçado a false quando scope='caso'); ao receber 409 de chave de cliente, `toast` com `description` orientando a marcar o override.
- [x] **T6 — Mensagens (@dev) [AC5,AC6].** Textos de 409 reforçam "por tema/frente" (pré-check) e "dados COMPARTILHADOS do cliente" + como liberar (override).
- [x] **T7 — Smoke DB (@qa) [AC7].** `scripts/smoke-tema-fields.ts` estendido [8]/[9]/[10]: (a) mesma key `scope='caso'` em temaA e temaB → ambos criam; (b) mesma key no mesmo tema → 409; (c) `scope='cliente'` mesmo rótulo em 2 temas → ok (bloco [5]); (d) `scope='cliente'` rótulo diferente → 409; (e) mesmo caso (d) com `allowSharedClientKey: true` → cria; (f) flip→cliente colidindo via update: 409 sem override, passa com. Cleanup por soft-delete no `finally`.
- [x] **T8 — Gates (@qa) [AC7].** `npm run typecheck` (só erros pré-existentes em `contaazul/service.ts` + `distribuicao-config`/`controladoria.distribuicao.configuracao.tsx`, não desta story); `eslint` limpo nos arquivos alterados; smoke 22/22.

---

## Dev Notes

- **Duas fontes de "duplicado" — não confundir:**
  1. `system_tema_field_defs_uq` (+ pré-check `:209-221`) = **por tema/frente**, CORRETO. Mantém.
  2. `findClientBucketKeyConflict` (`:138-167`) = **global**, roda só p/ `scope='cliente'`, protege o balde compartilhado `system_clients.custom_fields`. É a suspeita nº 1 do bug quando o campo é do cliente.
- **Por que a proteção do cliente existe:** para `scope='cliente'`, o valor mora em `system_clients.custom_fields[key]` — compartilhado entre TODOS os casos/temas do cliente. Duas defs com a mesma `key` e significados diferentes se sobrescreveriam. Por isso a checagem é global de propósito. O fix **não remove** a proteção — adiciona um **override consciente** e garante que `scope='caso'` nunca é afetado.
- **Reuso legítimo já funciona:** mesma `key` + mesmo rótulo normalizado → `findClientBucketKeyConflict` retorna `null` (não bloqueia). O override cobre o caso de rótulos diferentes que o admin sabe ser o mesmo dado.
- **Cuidado de regressão (AC5):** NÃO afrouxar o bloqueio DENTRO do mesmo tema — o índice e o pré-check `:209-221` continuam intactos.
- **Se o diagnóstico (T1) mostrar que o campo reportado era `scope='caso'`:** então o bloqueio veio do índice/pré-check e algo está passando `tema_id` errado ou a key colidiu no mesmo tema — investigar o fluxo do editor (`frenteSlug`, `key` derivada do label). Ajustar conforme o achado, mantendo os ACs.
- **Sem migration esperada:** o índice já é correto. Só há migration se o T2 revelar um índice global equivocado no banco (improvável). Priorizar correção no **service**.

## Testing

- **Smoke DB** (`scripts/smoke-tema-fields.ts`): matriz do AC7 (temas diferentes × scope × rótulo × override). Cleanup por soft-delete.
- **Manual/QA:** reproduzir o cenário do owner (criar "Município" em 2 temas); confirmar que passa para `scope='caso'`; para `scope='cliente'` com rótulos diferentes, ver o aviso e liberar com o checkbox.
- **Regressão:** mesma key no mesmo tema → 409.
- **Gates:** `npm run typecheck`, `npm run lint`.

## Dependências

- Independente de A2/A3/A4/A5/A6. Mexe em `tema-field-defs-service.ts`/`rpc`/`hook`/`editor` (compartilhados com A4/A5) — coordenar merge.
- Requer credenciais de banco em `.env.local` (smoke DB).

## File List

**Novos**
- (nenhum esperado; migration só se T2 revelar índice global equivocado)

**Alterados**
- `sistema-hv/src/lib/tema-field-defs-service.ts` (`allowSharedClientKey` + guarda da checagem global + mensagens)
- `sistema-hv/src/rpc/tema-field-defs.ts` (Zod create + update)
- `sistema-hv/src/hooks/useTemaFieldDefs.ts` (inputs de create/update)
- `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` (checkbox de override + orientação no erro)
- `sistema-hv/scripts/smoke-tema-fields.ts` (matriz de unicidade por tema)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-05 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-05 | v0.2 | Implementado (@dev via Orion). Diagnóstico: bug em `findClientBucketKeyConflict` ramo (b) — comparava a `key` GLOBALMENTE entre temas p/ `scope='cliente'` (sem filtrar `tema_id`), barrando campos legítimos com rótulo normalizado diferente; `scope='caso'` nunca chega nessa checagem (só índice por-tema, correto). Fix: adicionado override `allowSharedClientKey` (default false) no create+update do service, envolvendo a checagem global em `scope==='cliente' && !allowSharedClientKey`; propagado no RPC (Zod) + hook; checkbox "liberar chave compartilhada" no editor (só scope=cliente) + orientação no 409; mensagens de 409 reforçam "por tema/frente" e o override. Arquivos: `tema-field-defs-service.ts`, `rpc/tema-field-defs.ts`, `hooks/useTemaFieldDefs.ts`, `components/pipeline/TemaFieldDefsEditor.tsx`, `scripts/smoke-tema-fields.ts`. Gates: typecheck só com erros pré-existentes alheios (contaazul/service.ts + distribuicao-config/controladoria.distribuicao.configuracao.tsx); eslint limpo nos arquivos alterados; smoke DB 22/22 (matriz AC7 completa). Sem migration. | @dev |
