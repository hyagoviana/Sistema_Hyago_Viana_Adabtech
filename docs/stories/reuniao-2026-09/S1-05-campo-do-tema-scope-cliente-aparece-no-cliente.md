# Story S1-05: Campo criado no tema como "do cliente" aparece na página do cliente

- **Sprint:** S1 — Correções que travam o uso hoje
- **ID:** S1-05 · **Item do Thiago:** 8 (bug anotado no desenho da página do cliente)
- **Status:** Ready for Review (backfill pendente de 1 decisão do owner)
- **Estimativa relativa:** M
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** administrador que criou um campo personalizado marcando-o como **"do cliente"**,
**quero** que ele apareça na página de campos do cliente e junto aos campos adicionais da ficha,
**para que** o dado fique onde a pessoa vai procurá-lo — no cliente, não escondido dentro de um tema.

---

## Contexto / causa raiz

Anotação do Thiago (desenho da página do cliente): *"Essas são informações que eu tinha adicionado como
campos personalizados de casos (opção campos clientes), e acabaram não ficando junto aos outros ali em
baixo"* e *"mesmo estando no tema como 'do cliente', não aparece na página de campos do cliente e nem
aparece junto aos campos adicionais da página cliente."*

A bifurcação existe **só num sentido**. Em `src/lib/client-fields-service.ts:325+`:

> "VÍNCULO campo-do-cliente → tema(s) + BIFURCAÇÃO. (...) a def-espelho em `system_tema_field_defs`
> (`scope='cliente'`, mesma key/label) é DERIVADA e reconciliada aqui."

Ou seja: campo criado em **`system_client_field_defs`** ganha espelho no tema. Mas campo criado direto em
**`system_tema_field_defs` com `scope='cliente'`** (`tema-field-defs-service.ts:343`) **não** ganha o
registro correspondente em `system_client_field_defs` — e as telas do cliente leem dessa tabela.

O **valor** já é compartilhado (os dois lados usam o mesmo balde de `custom_fields` do cliente,
`tema-field-defs-service.ts:142-170`). O que falta é a **definição** aparecer do lado do cliente.

---

## Acceptance Criteria

1. Criar/editar uma def em `system_tema_field_defs` com `scope='cliente'` **reconcilia** uma def
   correspondente em `system_client_field_defs` com a **mesma key** (idempotente — nunca duplica, nunca
   re-sluga a key).
2. O campo passa a aparecer:
   - na página/gerenciador de campos do cliente (`ClientFieldsManagerDialog`);
   - junto aos campos adicionais da ficha do cliente;
   - continua aparecendo no tema, exatamente como hoje.
3. **Origem visível**: na tela de campos do cliente, campo que nasceu num tema mostra de onde veio
   ("criado no tema X") — evita alguém apagar sem saber o efeito.
4. **Simetria de exclusão/ocultação**: ocultar a def no tema não apaga o campo do cliente (o dado é do
   cliente); excluir o campo do cliente continua desfazendo a bifurcação como já faz hoje.
5. **Backfill**: script que reconcilia as defs `scope='cliente'` já existentes nos temas — é o caso
   concreto do Thiago, os campos dele já estão lá.
6. Sem colisão de key: se já existir campo de cliente com a mesma key e **significado diferente**, o
   comportamento é o mesmo do guard atual (`allowSharedClientKey`, `tema-field-defs-service.ts:399`) —
   recusa e explica.
7. `npx tsc --noEmit`, `npm run lint` e testes verdes.

---

## Tasks / Subtasks

- [x] Função de reconciliação tema→cliente, espelhando `garanteDefEspelho` do sentido oposto (AC 1, 6).
      (`src/lib/tema-field-defs-service.ts` + `client-fields-service.ts`)
- [x] Chamar na criação e na edição de def com `scope='cliente'` (AC 1).
- [ ] UI: exibir os campos e a origem (AC 2, 3).
- [ ] Regras de exclusão/ocultação (AC 4).
- [x] Script de backfill com dry-run (AC 5).
- [ ] Testes de ida e volta: criar no cliente → aparece no tema; criar no tema → aparece no cliente.

---

## Dev Notes

- **Uma key, um balde.** O valor mora em `system_clients.custom_fields[key]` nos dois caminhos — esta
  story não move dado nenhum, só faz a definição existir dos dois lados.
- Ver `20260826000004_client_field_defs_paridade.sql` — a paridade de colunas (subtítulo, obrigatório,
  opções) já foi feita; reusar, não recriar.
- Cuidado com laço de reconciliação: cliente→tema e tema→cliente podem se chamar mutuamente. Guardar por
  "já existe com essa key" antes de escrever (ambos os lados são idempotentes por key).

## Definition of Done

- [ ] Os campos que o Thiago criou aparecem na ficha do cliente após o backfill
- [ ] Criar campo pelos dois caminhos produz o mesmo resultado
- [ ] typecheck + lint + testes verdes

---

## Dev Agent Record (03/09/2026)

**Implementado.**
- `ensureClientDefFromTemaDef` em `client-fields-service.ts` — cria a def do cliente com a **mesma key**,
  idempotente. É a idempotência que impede o laço com `ensureMirrorDef` (sentido cliente→tema).
- Chamada em `createTemaFieldDef` e `updateTemaFieldDef` quando `scope='cliente'`, via import dinâmico
  (o ciclo estático já existe: client-fields-service importa tema-field-defs-service). Best-effort: falhar
  o espelho não desfaz a criação do campo no tema.
- `scripts/backfill-campos-cliente-do-tema.ts` com dry-run.

**Achado NÃO previsto na story — levado ao owner (pergunta A3).** Duas das defs que o Thiago criou no
tema já existem como **campo padrão** do cadastro do cliente:

| Key no tema | Campo padrão equivalente |
|---|---|
| `fies` | `professional_data.fies` ("FIES") |
| `no_contrato_fies` | `professional_data.fies_contrato_numero` ("Nº do contrato FIES") |

Criá-las produziria **campo duplicado na ficha**, com dois valores que podem divergir — pior que o bug
original. Por isso:
- criei `CLIENT_RESERVED_FIELD_KEYS` (`validators/client.ts`) com as keys padrão do cadastro;
- `ensureClientDefFromTemaDef` recusa criar def com key reservada;
- o backfill separa essas linhas num bloco **ATENÇÃO** em vez de criá-las.

`no_contrato_fies` **não** colide por key (só por significado) — por isso o `--commit` está **retido** até
o Thiago responder. Dry-run atual: 5 a criar, 1 bloqueada por colisão de key.

**Validação:** `npx tsc --noEmit` e `eslint` verdes. Faltam: AC 3 (mostrar a origem "criado no tema X" na
tela de campos do cliente) e o `--commit` do backfill.

---

## QA Results — 03/09/2026 (Quinn)

**Gate: CONCERNS** — código correto, mas a story só fecha depois do backfill e do AC 3.

### MEDIUM — campo do cliente podia ressuscitar (CORRIGIDO)

`updateTemaFieldDef` chamava o espelho em **qualquer** update de def com `scope='cliente'`, inclusive
quando a def estava sendo **ocultada** (`active:false` — exatamente o que `hideMirrorDef` faz ao
desvincular). Se o campo do cliente já tivesse sido excluído, ocultar a def no tema **recriaria** o campo
no cadastro do cliente.

Corrigido com uma guarda: só espelha quando a def resultante continua ativa.

### Verificado

- **Sem laço infinito** entre as duas reconciliações: `ensureClientDefFromTemaDef` é idempotente por key,
  então a chamada disparada por `ensureMirrorDef` (sentido cliente→tema) é no-op. Confirmado lendo os
  dois caminhos.
- **`deleteFieldDef` está a salvo**: ele desfaz os vínculos (passo 1) **antes** do soft-delete (passo 3);
  no momento do espelho o campo do cliente ainda existe → no-op. A ordem é o que protege — se alguém
  inverter esses passos no futuro, o bug volta. Vale um comentário no `deleteFieldDef`.
- **Colisão com campo padrão** tratada com `CLIENT_RESERVED_FIELD_KEYS`: `fies` é recusado, e o backfill
  reporta em vez de criar. Decisão acertada — criar produziria dois campos "FIES" na ficha.
- Espelho é best-effort (não desfaz a criação da def do tema em caso de falha) — correto.

### Pendências para fechar a story

1. **AC 3 não implementado**: a tela de campos do cliente ainda não mostra a origem ("criado no tema X").
2. **Backfill não aplicado** (5 campos), retido de propósito até o Thiago responder sobre `no_contrato_fies`,
   que duplica semanticamente o padrão "Nº do contrato FIES". Retenção correta.
