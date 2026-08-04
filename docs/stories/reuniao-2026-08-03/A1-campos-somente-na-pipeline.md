# Story A1: Campo é LOCAL DE INFORMAÇÃO do tema — criação só na pipeline (Editar Campos); no caso só se preenche

- **Épico:** Reunião 2026-08-03 — 8 Ajustes
- **ID:** A1
- **Status:** Ready for Review
- **Estimativa relativa:** S (remoção cirúrgica de UI na ficha + guardrails no serviço/RPC; reusa 100% do mecanismo `system_tema_field_defs`/`canonical_fields`)
- **Executor sugerido:** @dev · Quality gate: @qa
- **Risco:** BAIXO (retira caminho de escrita — não adiciona schema; risco concentra-se em não quebrar o PREENCHIMENTO dos campos existentes nem os valores livres já gravados)
- **Origem:** Reunião 2026-08-03 (decisão do owner Dr. Thiago: "esse processo está correto")

---

## Story

**Como** administrador (Dr. Thiago) responsável pela padronização dos temas,
**quero** que a **criação de campo** seja **exclusiva na pipeline** (Editar Campos / `TemaFieldDefsEditor`, nível admin) e que **dentro do caso o usuário só PREENCHA** os campos já definidos,
**para que** o campo seja tratado como um **LOCAL DE INFORMAÇÃO padronizado do tema** (vale para todos os casos do mesmo tema), e não como um filtro solto criado caso a caso — informação não-padronizada vai para **NOTAS**, não vira campo.

> **DECISÃO TRAVADA (reunião 2026-08-03):**
> 1. **Campo não é filtro** — é um **local de informação** do tema. Quem **cria** campos é o **ADMINISTRADOR**, na **pipeline** ("Editar Campos"), e o campo passa a valer **para todos os casos daquele tema**.
> 2. **Dentro do caso o usuário só PREENCHE**, nunca cria. Não pode existir botão "Adicionar campo" na ficha do caso.
> 3. **Informação não-padronizada** do tema (que não vale para todos os casos) vai para **NOTAS** (`system_case_notes`), não vira campo.
> 4. O owner declarou que **o processo de definição por tema está CORRETO** — esta story só **fecha a porta** que ainda deixa criar campo na ficha.

---

## Contexto / o que JÁ EXISTE vs NOVO

**JÁ EXISTE (o mecanismo correto — manter intacto):**
- **Definição de campo por tema** → `system_tema_field_defs` (`tema_id`, `key`, `label`, `type ∈ {text,select,multiselect,money,number,date,boolean}`, `options`, `ordem`, `required`, `active`, `frente_slug`, `scope ∈ {caso,cliente}`, `hidden_in_list`, `max_occurrences`). View `system_tema_field_defs_active`.
- **Editor admin (nível pipeline)** → `src/components/pipeline/TemaFieldDefsEditor.tsx`, montado hoje em `src/components/cases/CaseFiltersPanel.tsx:254` ("Campos personalizados", `frenteSlug={null}`). **É a ÚNICA porta que deve criar campo.**
- **Serviço (server-only)** → `src/lib/tema-field-defs-service.ts`: `createTemaFieldDef`/`updateTemaFieldDef`/`deleteTemaFieldDef` (usa `service_role`). O RPC `src/rpc/tema-field-defs.ts` já gateia **escrita de def** por `requireRole(["admin"])` via `handleAdmin` (`rpc/tema-field-defs.ts:34`, `:101`, `:122`, `:126`).
- **Valor por caso** → `system_cases.canonical_fields` (JSONB), gravado por `updateCaseCanonicalFields` (hook `useUpdateCaseCanonicalFields`). Valor de campo `scope='cliente'` → `system_clients.custom_fields` (hook `useUpdateClientCustomFields`).
- **Ficha do caso** → `src/components/cases/CaseCanonicalFields.tsx` renderiza os campos DEFINIDOS do tema (`TemaFieldInput`, `:240`) e grava o VALOR. Multiselect: `CanonicalMultiSelect`; célula inline na lista: `InlineCanonicalCell`; `scope='cliente'` grava no cliente (`saveDef`, `:92`).

**O PROBLEMA (o que esta story remove):**
- `CaseCanonicalFields.tsx` ainda expõe, **na ficha do caso**, um fluxo de **CRIAR campo solto**:
  - Estado local `newKey`/`newValue` (`:79-80`).
  - Função `addField()` (`:108-123`) — grava uma **chave livre nova** direto em `canonical_fields` (`updateMut.mutateAsync({ patch: { [key]: value } })`), sem passar por `system_tema_field_defs`.
  - Bloco de UI "Nome do campo / Valor / **Adicionar**" (`:204-233`), visível quando `canEdit`.
  - Consequência: usuário cria "campo" que **não** é def do tema (não vale para os outros casos, não vira coluna/def) — exatamente o que o owner proíbe. Essas chaves caem no bloco "Outros campos" (`freeEntries`, `:75`).

**NOVO (escopo desta story):**
1. **Remover** da ficha (`CaseCanonicalFields.tsx`) todo o fluxo "adicionar campo" (estado `newKey`/`newValue`, `addField`, bloco de UI `:204-233`, imports `Plus`/`Button`/`Label` que ficarem órfãos).
2. **Preservar** o preenchimento dos campos definidos (grava em `canonical_fields`/`custom_fields`) e a exibição **read-only** dos valores livres remanescentes (compat — nunca apagar valor já gravado).
3. **Guardrail no serviço/RPC:** garantir que **não existe** caminho de criação/edição de **def** a partir do contexto do caso — só o `TemaFieldDefsEditor` (admin, pipeline) cria def; a partir do caso só se escreve VALOR em `canonical_fields`/`custom_fields`.

---

## Decisões técnicas (travadas para execução)

- **Não** criar migration nem tocar schema. Reuso total do mecanismo `system_tema_field_defs` (def) + `canonical_fields`/`custom_fields` (valor).
- **Remover, não esconder:** o fluxo "adicionar campo" sai do JSX (não basta `canEdit=false`), para não deixar caminho reativável. A criação de def fica **só** no `TemaFieldDefsEditor` (gate admin server-side já existente).
- **`removeField` da ficha:** o botão lixeira dos "Outros campos" (`removeField`, `:125-133`) apaga só o VALOR de uma chave livre remanescente (grava `null`) — **não** é criação e **não** mexe em def. Manter (limpa lixo herdado), mas os "Outros campos" passam a ser **read-only** para leitura padronizada — decisão do owner é que dentro do caso não se edita estrutura; discutir com @qa se mantém a lixeira (recomendação: **manter só a lixeira**, remover o `Input` editável do valor livre é opcional e fora do núcleo). Núcleo obrigatório = remover o "Adicionar".
- **Serviço já correto:** `tema-field-defs-service.ts` só escreve em `system_tema_field_defs` (def) e o RPC exige `admin` para toda escrita (`handleAdmin`). Não há endpoint que crie def com "contexto de caso". A AC-4 é uma **verificação/asserção** (grep + teste), não um refactor — a ficha nunca chamou `createTemaFieldDefFn`; ela chamava `updateCaseCanonicalFields`. Confirmar e registrar.
- **Reforça A7:** com a criação de campo restrita à def do tema (tipada), o motor de variáveis passa a receber **sempre** chaves conhecidas/estruturadas — some a fonte de "campo solto" que quebrava o autofill.

---

## Acceptance Criteria

1. **Sem "adicionar campo" na ficha:** na ficha do caso (`CaseCanonicalFields.tsx`) **não existe** mais nenhum botão/campo/fluxo para **criar** campo (nome + valor + "Adicionar"). Removidos o bloco de UI (`:204-233`), a função `addField` (`:108-123`) e o estado `newKey`/`newValue` (`:79-80`). Nenhum caminho de UI cria def ou chave nova a partir do caso.
2. **Preenchimento continua funcionando:** os campos DEFINIDOS do tema continuam sendo renderizados e **preenchíveis** na ficha; salvar grava o VALOR em `system_cases.canonical_fields` (campo `scope='caso'`) via `updateCaseCanonicalFields`, exatamente como hoje (`saveDef`, `:92`). Nenhuma regressão em edição/salvamento de valor.
3. **Criação de campo só na pipeline:** a **única** porta de criação/edição/exclusão de def é o `TemaFieldDefsEditor` (nível admin/pipeline, montado em `CaseFiltersPanel.tsx:254`). O texto/UX deixa claro que campo é definido no tema e vale para todos os casos.
4. **Serviço/RPC sem criação por contexto de caso:** confirmado (grep + asserção) que **nenhum** endpoint permite criar/alterar **def** a partir do fluxo do caso. `createTemaFieldDefFn`/`updateTemaFieldDefFn`/`deleteTemaFieldDefFn` continuam gateados por `requireRole(["admin"])` (`handleAdmin`, `rpc/tema-field-defs.ts`). Do contexto do caso só se chama `updateCaseCanonicalFields` (valor). Documentar o resultado da verificação na story.
5. **Nota operacional (temas com campos "soltos"):** a story registra que o **admin deve revisar** os temas que hoje têm chaves livres em `canonical_fields` sem def correspondente (bloco "Outros campos"): promover a def no tema (se padronizável) ou mover para **NOTAS**. É item de **operação/dado**, não de código — não bloqueia a entrega. Fornecer, no Dev Notes, a query de diagnóstico (chaves livres por caso/tema).
6. **Sem regressão nos tipos e escopos:** `multiselect` (`CanonicalMultiSelect`), célula inline (`InlineCanonicalCell`), `scope='cliente'` (grava em `system_clients.custom_fields` via `useUpdateClientCustomFields`), `boolean` tri-state, `money` (centavos) e múltiplas ocorrências (`MultiOccurrenceField`) continuam funcionando idênticos. Valores livres já gravados continuam **visíveis** (nunca apagar chave sem def). `npm run typecheck` / `npm run lint` verdes.

---

## Tasks / Subtasks

- [x] **Remover o fluxo "adicionar campo" da ficha** (AC: 1) — removidos estado `newKey`/`newValue`, função `addField`, bloco JSX "Adicionar" e imports órfãos `Plus` e `Button` em `CaseCanonicalFields.tsx`. `useState` mantido (usado em `MoneyField`/`MultiOccurrenceField`); `Input`/`Label` mantidos (uso legítimo).
- [x] **Preservar preenchimento e leitura** (AC: 2,6) — `saveDef`/`saveKey`, `defs.map(TemaFieldInput)` e o bloco "Outros campos" (`freeEntries`, valor editável + lixeira de valor) mantidos intactos. Nenhuma chave nova pode ser criada.
- [x] **Confirmar porta única na pipeline** (AC: 3) — `useCreateTemaFieldDef` só é chamado em `TemaFieldDefsEditor.tsx:68` (montado em `CaseFiltersPanel.tsx:254`, `frenteSlug={null}`). Porta única confirmada.
- [x] **Auditar serviço/RPC** (AC: 4) — `createTemaFieldDefFn`/`updateTemaFieldDefFn`/`deleteTemaFieldDefFn` gateados por `handleAdmin → requireRole(["admin"])` (`rpc/tema-field-defs.ts:34,:101,:103…`). Único call site de criação = `TemaFieldDefsEditor`. Do contexto do caso só `updateCaseCanonicalFields`/`updateClientCustomFields` (valor). Confirmado.
- [x] **Nota de revisão de temas** (AC: 5) — query de diagnóstico das chaves livres consta no Dev Notes; orientação: promover a def no tema OU mover p/ NOTAS. Sem migração de dados nesta story.
- [x] **Reforço A7** (AC: 6) — dependência anotada: sem "campo solto", o autofill recebe só chaves de def conhecidas.
- [x] **Testes** (AC: 1,2,6) — `npx eslint src/components/cases/CaseCanonicalFields.tsx` exit 0; `tsc --noEmit` sem erro novo (único erro TS é pré-existente em `contaazul/service.ts`, item em espera). Smoke UI manual pendente para o @qa.

---

## Dev Notes

**Arquivos a tocar (mapa de impacto):**
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` — **único arquivo de mudança obrigatória**. Remover `newKey`/`newValue` (`:79-80`), `addField` (`:108-123`), bloco "Adicionar" (`:204-233`), import `Plus`. Manter `TemaFieldInput`, `saveDef`, `saveKey`, "Outros campos".
- `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` — só verificação/micro-cópia (porta admin do `TemaFieldDefsEditor`, `:254`).
- `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` — porta ÚNICA de criação de def (não muda; confirmar).
- `sistema-hv/src/rpc/tema-field-defs.ts` — só auditoria (gate `handleAdmin` já presente).
- `sistema-hv/src/lib/tema-field-defs-service.ts` — só auditoria (só escreve em `system_tema_field_defs`).
- **Nenhuma migration** (schema intocado; sem `db-apply-pg.ts`).

**Regras de ouro (pertinentes):**
- **Campo = def do tema.** Criação de def **só** no `TemaFieldDefsEditor` (gate `admin`/`config.manage` server-side já existente). No caso, **só** VALOR.
- Valor de campo `scope='caso'` → `system_cases.canonical_fields` (`updateCaseCanonicalFields`); `scope='cliente'` → `system_clients.custom_fields` (`updateClientCustomFields`). Não trocar as fontes.
- **Nunca apagar** chave livre já gravada sem def — o bloco "Outros campos" existe para compat; remover só a **criação**, não a exibição.
- **Não** tocar `system_cases`/view/trigger; **não** criar tabela; **não** reviver camada frente (`frente_slug=NULL`).

**Query de diagnóstico (AC-5) — chaves livres sem def, por tema/caso (rodar como leitura/admin):**
```sql
-- Casos com chaves em canonical_fields que NÃO têm def no tema (candidatas a virar
-- def OU migrar p/ notas). Ajustar o join de tema conforme o schema de system_cases.
select c.id as case_id, c.case_code, c.tema_id, kv.key as chave_solta, kv.value
from system_cases c
cross join lateral jsonb_each_text(coalesce(c.canonical_fields, '{}'::jsonb)) as kv(key, value)
left join system_tema_field_defs_active d
       on d.tema_id = c.tema_id and d.key = kv.key
where d.id is null
order by c.tema_id, c.case_code;
```
Orientação ao admin: para cada `chave_solta` recorrente no tema → criar a **def** correspondente no `TemaFieldDefsEditor` (padroniza p/ todos os casos); para info pontual → mover para **NOTAS** (`system_case_notes`).

**Riscos de regressão e mitigação:**
- **Remover import/estado usado noutro ponto:** `Input` ainda é usado no render dos "Outros campos" e nos `TemaFieldInput`; remover **apenas** `Plus` com certeza; conferir `Button`/`Label` antes (Label é usado por `TemaFieldInput`). Rodar `typecheck`/`lint` para pegar import órfão.
- **Perder valores livres:** o bloco "Outros campos" (`freeEntries`) deve continuar exibindo chaves sem def — não removê-lo junto com o "Adicionar".
- **Quebrar `scope='cliente'`:** `saveDef` bifurca caso×cliente (`:92-106`); intocado.
- **Multiselect/inline:** `CanonicalMultiSelect`/`InlineCanonicalCell` não são tocados; smoke garante.
- **Falsa sensação de "já resolvido":** confirmar que o RPC nunca foi chamado pela ficha (grep) — a asserção é o entregável da AC-4.

### Testing
- Ficha do caso: **não** existe mais botão/campo "Adicionar" campo.
- Preencher cada tipo de campo definido (texto/select/multiselect/boolean/money/número/data + múltiplas ocorrências) → salva em `canonical_fields`; recarregar mantém o valor.
- Campo `scope='cliente'` salva em `system_clients.custom_fields` e reflete em outros casos do mesmo cliente.
- Edição inline na lista (`InlineCanonicalCell`) grava no caso certo.
- Valor livre pré-existente (chave sem def) continua **visível** na ficha ("Outros campos").
- Admin cria campo novo **na pipeline** (`TemaFieldDefsEditor`) → aparece na ficha de todos os casos do tema; usuário só preenche.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** R2-07 (`system_tema_field_defs` + `CaseCanonicalFields`), S2-07 (`canonical_fields`), R2-09 (editor re-plugado no nível do tema em `CaseFiltersPanel`), Filtros 2026-07-29 (origem TEMA×CLIENTE, `scope`) — todos entregues.
- **Reforça:** **A7** (campo estruturado para o motor de variáveis não quebrar) — ao fechar a criação de campo solto, o autofill recebe só chaves de def conhecidas. Alinhar sequência: A1 pode ir antes ou junto de A7.
- **Não** depende de migration nem de outro ajuste da reunião 2026-08-03.

---

## File List

- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` (remove `newKey`/`newValue`, `addField`, bloco "Adicionar", import `Plus`)
- `sistema-hv/src/components/cases/CaseFiltersPanel.tsx` (verificação/micro-cópia da porta admin — se necessário)
- `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx` (verificação — porta única de criação de def)
- `sistema-hv/src/rpc/tema-field-defs.ts` (auditoria do gate `handleAdmin` — sem mudança esperada)
- `sistema-hv/src/lib/tema-field-defs-service.ts` (auditoria — só escreve def; sem mudança esperada)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-08-03 | 0.1 | Draft inicial — campo = local de informação do tema; remover "adicionar campo" da ficha (`CaseCanonicalFields.tsx`); criação de def exclusiva no `TemaFieldDefsEditor` (pipeline/admin); auditar serviço/RPC (sem criação por contexto de caso); nota de revisão de temas c/ campos soltos; reforça A7. Sem migration; reuso de `system_tema_field_defs`/`canonical_fields`. | @sm (Bob) |
| 2026-08-04 | 0.2 | Implementado (@dev via Orion): removidos `newKey`/`newValue`, `addField`, bloco JSX "Adicionar" e imports `Plus`/`Button`. Preenchimento/`freeEntries`/`scope=cliente`/multi-ocorrência intactos. AC-3/AC-4 auditados (porta única = `TemaFieldDefsEditor`; def gateada por `requireRole(["admin"])`). lint exit 0; typecheck sem erro novo (1 erro pré-existente em `contaazul/service.ts`). Status → Ready for Review; smoke UI para @qa. | @dev |
