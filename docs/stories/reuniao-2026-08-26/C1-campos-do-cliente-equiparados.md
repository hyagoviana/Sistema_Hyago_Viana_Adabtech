# Story C1: Campos do CLIENTE no mesmo nível dos campos do CASO + campo "vinculado" + reordenar arrastando

**Épico:** Reunião 2026-08-26 · **ID:** C1 (item 1 + item 10 das respostas do owner) · **Onda:** 3 · **Status:** Draft
**Executor:** @data-engineer (colunas) + @dev (editor, formulário, render) · Quality gate: @qa
**Risco:** ALTO — é a maior da leva. Mexe no cadastro do cliente (tela que todo mundo usa), no espelhamento cliente→tema (B1) e na importação. **Não** dá para fazer no susto.

---

## Story

**Como** administrador que já configurou campos ricos nos casos,
**quero** as **mesmas** capacidades nos campos do **cliente** — link, múltiplas ocorrências, subtítulos, campo dependente, esconder da lista/filtros —
**e** duas novidades que valem para os dois lados: **campo vinculado** (dois campos que sempre aparecem juntos) e **reordenar arrastando**.

Thiago: "aqui a gente já tem, por exemplo, a opção de ter um campo personalizado caso que é link, um que tem linhas adicionais, que podem ter subtítulos, que podem ser dependentes… e aí quando a gente abre os campos personalizados do cliente, a gente não tem essas mesmas melhorias."
E: "além do dependente, um vinculado. Não é que ele depende daquele outro, é que eles são juntos… na hora que eu marco que esse aqui é vinculado no outro, eles aparecem juntinhos."
E: "se a gente pode alterar a ordem de visualização dos campos… arrastar um quadradinho em cima do outro."

---

## Contexto / o que JÁ EXISTE vs NOVO

### O gap, coluna a coluna (medido no schema)

| Recurso | `system_tema_field_defs` (CASO) | `system_client_field_defs` (CLIENTE) |
|---|---|---|
| tipos | text, select, multiselect, money, number, date, boolean, **link** | text, **textarea**, number, date, select, multiselect, boolean |
| múltiplas ocorrências | `max_occurrences`, `initial_occurrences` | — |
| subtítulos | `subtitle_mode`, `subtitles` | — |
| campo dependente | `parent_field_def_id` | — |
| esconder na lista / nos filtros | `hidden_in_list`, `hidden_in_filters` | — |
| ordem | `ordem` | `ordem` (existe, mas sem drag na UI) |
| ajuda | — | `help_text` |
| aparece nos casos | `scope` | `appears_in_cases` |

### JÁ EXISTE (reusar — e é muito)

- **Editor completo do CASO:** `src/components/pipeline/TemaFieldDefsEditor.tsx` (com o comentário do campo dependente na linha ~607). **É o modelo visual** a ser espelhado no cliente.
- **Render completo do CASO:** `src/components/cases/CaseCanonicalFields.tsx` — trata `multiselect` (:303), `boolean` (:319), `select` (:343), `money` (:367), **`link` (:380)**, number/date (:410). É a referência de como cada tipo se comporta.
- **Serviço do CASO:** `src/lib/tema-field-defs-service.ts` (657 linhas) — `TEMA_FIELD_TYPES`, `normalizeOptions`, `normalizeMoveToStage`, CRUD.
- **Cliente — serviço:** `src/lib/client-fields-service.ts` (383 linhas) — CRUD, `uniqueKey`, `setFieldActive`, `deleteFieldDef` (purga o valor em todos os clientes via `system_fn_purge_client_field`), **`reorderFieldDefs` já existe** (linha ~200) e o bloco **B1** de vínculo campo-do-cliente → tema (`reconcileClientFieldTemaLinks`, `ensureMirrorDef`, `mirrorTemaType`).
- **Cliente — validação:** `src/lib/validators/clientFields.ts` — `FIELD_TYPES`, `FIELD_TYPE_LABELS`, `FIELD_TYPES_WITH_OPTIONS`, schemas de create/update.
- **Cliente — UI:** `src/components/clients/ClientFieldsManagerDialog.tsx` (painel admin) e `src/components/clients/CustomFieldsSection.tsx` (o formulário — `switch (def.field_type)` na linha ~57).
- **Tela que junta os dois:** `src/routes/configuracoes.campos-personalizados.tsx` — `TemaFieldDefsEditor` (linha 245) e `ClientFieldsManagerPanel` (linha 165) na **mesma página**. É lá que a diferença salta aos olhos.
- **Consumidores dos campos do cliente:** `src/components/import/ColumnMapper.tsx`, `DownloadTemplate.tsx`, `ImportStepper.tsx` (importação por planilha).

### NOVO

1. Colunas novas em `system_client_field_defs`: `max_occurrences`, `initial_occurrences`, `subtitle_mode`, `subtitles`, `parent_field_def_id`, `hidden_in_list`, `hidden_in_filters`; e os tipos **link** e **money** no CHECK.
2. Coluna **`linked_field_def_id`** nas **duas** tabelas (o campo "vinculado").
3. **Drag-and-drop** de ordem nos dois editores.
4. Render do cliente atualizado para os tipos e recursos novos.
5. Espelhamento B1 revisto para os tipos novos.

---

## Acceptance Criteria

### Equiparação (item 1)
1. **Tipos.** O campo do cliente aceita **link** e **money**, além dos atuais. `textarea` continua existindo (é do cliente e não some).
2. **Link funciona igual ao do caso.** No formulário do cliente, um campo `link` renderiza como o do caso (`CaseCanonicalFields:380`): valida URL e vira link clicável na visualização.
3. **Múltiplas ocorrências.** Campo do cliente pode ter `max_occurrences > 1` e `initial_occurrences`, com o botão de adicionar/remover linha igual ao do caso.
4. **Subtítulos.** Campo multi-ocorrência do cliente aceita subtítulo por linha (mesmo comportamento de `subtitle_mode`/`subtitles`).
5. **Dependente.** Campo do cliente pode declarar `parent_field_def_id` e só fica editável quando o pai está preenchido — mesma regra do caso.
6. **Esconder.** Campo do cliente pode ser marcado como oculto na lista e/ou nos filtros.

### Vinculado (novidade, vale para os dois)
7. **Marcar vínculo.** No editor (cliente **e** tema) é possível marcar que um campo é **vinculado** a outro. É diferente de dependente: não há bloqueio, não há condição.
8. **Aparecem juntos.** Campos vinculados são renderizados **lado a lado / imediatamente em sequência**, em qualquer lugar que os exiba (formulário do cliente, ficha do caso, painel de campos), independentemente da ordem individual.
9. **Vínculo é 1↔1 e simétrico.** Marcar A vinculado a B implica que B aparece junto de A. Não é permitido criar cadeia (A→B→C) nem vincular um campo a si mesmo — a UI impede e o servidor valida.

### Ordenar (novidade, vale para os dois)
10. **Arrastar.** Nos dois editores é possível reordenar arrastando; a ordem persiste (`ordem`) e é a ordem usada na exibição. O cliente reusa `reorderFieldDefs` (que já existe); o tema ganha equivalente se ainda não tiver.

### Integridade
11. **Espelhamento cliente→tema (B1) continua correto.** Ao vincular a um tema um campo do cliente do tipo `link`/`money`, a def-espelho é criada com o **mesmo tipo** (o `mirrorTemaType` só rebaixa `textarea` → `text`; nenhum outro tipo é rebaixado). Multi-ocorrência e subtítulo também refletem.
12. **Importação não quebra.** `ColumnMapper` / `DownloadTemplate` / `ImportStepper` continuam funcionando: campos multi-ocorrência e link aparecem de forma previsível (ou são explicitamente ignorados no template, com aviso — decisão do @dev, mas **documentada**).
13. **Sem regressão nos dados.** Nenhum campo existente muda de tipo, de ordem, de valor ou some do formulário. Campos antigos passam a ter `max_occurrences = 1`, `initial_occurrences = 1`, hidden = false, parent/linked = NULL.
14. **Gates.** `typecheck` + `lint` limpos; migration 2× idempotente + rollback; `db:types` regenerado.

---

## Tasks / Subtasks

### T1 — Migration (@data-engineer)
- [ ] `20260826XXXX_client_field_defs_paridade.sql`: colunas novas em `system_client_field_defs` com defaults seguros; recriar o CHECK de `field_type` incluindo `link` e `money` (dropar por nome dinâmico — molde `20260817000003_tema_field_defs_link.sql`). (AC-1, AC-3..AC-6, AC-13)
- [ ] `ADD COLUMN IF NOT EXISTS linked_field_def_id UUID` nas **duas** tabelas, com FK para a própria tabela + índice. (AC-7)
- [ ] Rollback simétrico; aplicar 2×; regenerar `db:types`. (AC-14)

### T2 — Validação e serviço do cliente (@dev)
- [ ] `validators/clientFields.ts`: `FIELD_TYPES` ganha `link` e `money`; rótulos; schemas aceitam os campos novos. (AC-1)
- [ ] `client-fields-service.ts`: create/update tratam os campos novos; validar vínculo (sem auto-vínculo, sem cadeia, 1↔1 simétrico). (AC-7, AC-9)
- [ ] Revisar `mirrorTemaType` e `ensureMirrorDef` para propagar tipo, ocorrências e subtítulos. (AC-11)

### T3 — Serviço do tema (@dev)
- [ ] `tema-field-defs-service.ts`: aceitar e validar `linked_field_def_id` com as mesmas regras. (AC-7, AC-9)

### T4 — Editor do cliente (@dev)
- [ ] `ClientFieldsManagerDialog.tsx`: trazer para o cliente os controles que o `TemaFieldDefsEditor` já tem (tipo link/money, ocorrências, subtítulos, dependente, ocultar), **reaproveitando componentes** em vez de duplicar. (AC-1..AC-6)
- [ ] Controle de "vinculado a" + drag-and-drop de ordem. (AC-7, AC-10)

### T5 — Editor do tema (@dev)
- [ ] `TemaFieldDefsEditor.tsx`: controle de "vinculado a" + drag-and-drop. (AC-7, AC-10)

### T6 — Render do cliente (@dev)
- [ ] `CustomFieldsSection.tsx`: novos `case` no switch para `link` e `money`; multi-ocorrência com adicionar/remover; subtítulo por linha; dependente desabilitado até o pai; agrupamento de vinculados. (AC-2..AC-5, AC-8)
- [ ] Ficha do caso (`CaseCanonicalFields.tsx`): agrupamento de vinculados. (AC-8)

### T7 — Importação (@dev)
- [ ] Revisar `ColumnMapper` / `DownloadTemplate` / `ImportStepper` para os tipos novos; documentar o que é ignorado. (AC-12)

### T8 — QA (@qa)
- [ ] Criar um campo de cada tipo novo no cliente e preencher em um cliente real. (AC-1, AC-2)
- [ ] Campo com 3 ocorrências + subtítulos; campo dependente; campo oculto na lista. (AC-3..AC-6)
- [ ] Dois links vinculados: aparecem juntos no cadastro e no caso (via espelho). (AC-7, AC-8, AC-11)
- [ ] Tentar auto-vínculo e cadeia: bloqueado na UI e no servidor. (AC-9)
- [ ] Arrastar 5 campos, recarregar: ordem mantida nos dois editores. (AC-10)
- [ ] Abrir 3 clientes antigos: nada mudou de lugar nem sumiu. (AC-13)
- [ ] Importar uma planilha depois da mudança. (AC-12)

---

## Dev Notes

- **Reaproveitar, não copiar.** O editor do tema já resolveu todos esses controles. Duplicar o código no cliente cria duas verdades e é exatamente a dívida que gerou esta story. Extrair os controles compartilhados é parte do trabalho.
- **`textarea` é só do cliente e continua sendo.** Não tentar unificar as duas listas de tipos numa só — elas servem entidades diferentes; o que se equipara são as **capacidades**.
- **Vinculado ≠ dependente.** Dependente já existe e **não muda** ("já tá bom dependente", palavras dele). Vinculado é só apresentação conjunta.
- **B1 é o ponto perigoso.** O campo do cliente pode estar espelhado em N temas. Mudar tipo/ocorrência precisa refletir nos espelhos; e o **valor continua no balde único do cliente** (`system_clients.custom_fields[key]`) — nada de duplicar valor por tema.
- **`deleteFieldDef` purga valores** em todos os clientes. Nada nesta story pode mexer nesse caminho sem teste explícito.
- **Fatiamento sugerido se o prazo apertar** (o owner pediu junto, mas a ordem interna é do @dev): T1+T2+T4+T6 (paridade) → T5+T3 (vinculado) → T7 (importação).

## Testing

- **DB:** migration 2× + rollback; conferir defaults nos registros antigos.
- **UI:** cadastro de cliente com todos os tipos; ficha do caso com campos espelhados.
- **Integração:** B1 (vincular campo do cliente a um tema) com tipo novo.

## Dependências

- **Independente** das demais, mas é a que mais consome tempo — não colocar na mesma janela de MO1/TK1 (rotina do time).
- Toca `configuracoes.campos-personalizados.tsx`, que **nenhuma outra story** desta leva altera.

## File List

**Novos**
- `sistema-hv/supabase/migrations/20260826XXXX_client_field_defs_paridade.sql` (+ rollback)
- `sistema-hv/src/components/hv/FieldDefControls.tsx` (controles compartilhados dos dois editores)

**Alterados**
- `sistema-hv/src/lib/validators/clientFields.ts`
- `sistema-hv/src/lib/client-fields-service.ts`
- `sistema-hv/src/lib/tema-field-defs-service.ts`
- `sistema-hv/src/rpc/clientFields.ts` · `src/rpc/tema-field-defs.ts`
- `sistema-hv/src/components/clients/ClientFieldsManagerDialog.tsx`
- `sistema-hv/src/components/clients/CustomFieldsSection.tsx`
- `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx`
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx`
- `sistema-hv/src/components/import/ColumnMapper.tsx` · `DownloadTemplate.tsx` · `ImportStepper.tsx`
- `sistema-hv/src/lib/supabase/types.ts`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial; owner pediu vinculado + reordenar na mesma entrega | @sm (River) |
