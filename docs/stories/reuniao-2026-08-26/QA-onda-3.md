# QA — Onda 3 da reunião 2026-08-26 (T2, AU1, C1)

**Revisor:** @qa (Quinn) · **Data:** 2026-08-26 · **Escopo:** código não commitado + migration `20260826000004` aplicada

| Story | Gate (1ª rodada) | Gate (após correção) | Motivo |
|---|---|---|---|
| **T2** | ✅ PASS | ✅ **PASS** | O degrau novo saiu do motor puro e foi para onde a decisão é visível e editável. |
| **AU1** | ⚠️ CONCERNS | ✅ **PASS** | A busca livre filtrava só a página carregada — mitigado. |
| **C1** | ❌ FAIL | ✅ **PASS** | **Duas convenções para a mesma ideia** — corrigido. |

---

## 🔴 P1 — o achado que justificou a revisão

### QA-13 · Multi-ocorrência do cliente usava convenção DIFERENTE da do caso
**Arquivo:** `sistema-hv/src/components/clients/CustomFieldsSection.tsx`

O caso guarda múltiplas ocorrências como **array na mesma chave**
(`canonical_fields.campo = ["a","b","c"]` — ver `occurrencesToSlots` em
`lib/cases/tema-field-value.ts`). A primeira versão do cliente gravava em **chaves
com sufixo** (`custom_fields.campo__2`, `campo__3`).

Por que isso importa mais do que parece: a story C1 existe justamente para os dois
lados falarem a mesma língua, e o espelho **B1** (campo do cliente aparecendo nos
temas) casa **pela key**. Com sufixo, um campo do cliente de 3 linhas espelhado num
tema mostraria só a primeira — e as outras duas ficariam órfãs no balde, sem
ninguém para lê-las. O bug não apareceria no build nem no typecheck: apareceria
semanas depois, como "sumiu o dado".

**Correção:** o cliente passou a usar **array na mesma chave**, com um `Controller`
só e N caixinhas editando posições — mesma forma do caso, incluindo o "+ adicionar
linha". Verificado que nenhuma referência à convenção antiga sobrou.

### QA-14 · O espelho cliente→tema não copiava a FORMA do campo
**Arquivo:** `sistema-hv/src/lib/client-fields-service.ts` (`ensureMirrorDef`)

A def-espelho era criada só com tipo, rótulo e opções. Um campo do cliente com 3
linhas e subtítulos virava, no tema, um campo simples — o mesmo dado apresentado de
dois jeitos, que é exatamente o que o AC-11 proíbe.

**Correção:** o espelho passou a propagar `max_occurrences`, `initial_occurrences`,
`subtitle_mode` e `subtitles` (e o `select` que alimenta o espelho passou a trazer
essas colunas).

---

## 🟡 P2 — mitigado

### QA-15 · A busca da auditoria filtrava só a página carregada
**Arquivo:** `sistema-hv/src/lib/auditoria-service.ts`

A busca livre roda **depois** do de-para (o termo pode ser o nome do cliente ou do
campo, que não estão na tabela de eventos) — mas era aplicada sobre a página de 50.
Resultado: procurar um campo editado há três semanas devolvia "nada encontrado"
mesmo existindo.

**Mitigação:** quando há termo, o serviço lê um lote 20× maior (teto de 1.000) antes
de filtrar, e só então corta na página. Busca por texto **não é exaustiva** sobre
todo o histórico — para isso seria preciso filtro no SQL sobre o JSONB, que fica
registrado como evolução se o volume crescer.

---

## ✅ O que foi verificado e está correto

**T2**
- `system_case_responsaveis_active` tem mesmo a coluna `user_id` que o novo degrau lê.
- A decisão de **não** mexer no `flow-selector` (motor puro, com testes) e sim em
  `staging-core` é acertada e melhora o resultado: o responsável vira o
  `exclusive_executor_id` da linha da tela 2, que fica **visível e editável** antes
  de rodar — coerente com o "processo automatizado, não automático" do Thiago.
- A regra das três precedências estava **duplicada** em dois pontos do arquivo e
  virou função única. Dívida removida de passagem.

**AU1**
- `/auditoria` foi para `ROUTE_MODULE` — sem isso o item apareceria no menu para
  todos (rota sem módulo cai no papel base), mesmo com o RPC negando. Gate nos dois
  lados, como manda o padrão do projeto.
- O `{ from, to }` sai do `current` que a função já tinha em mãos: **não**
  reintroduziu o read-modify-write que causou perda de dados em 24/08.
- Leitura aceita os dois formatos de diff; evento antigo mostra "—" no anterior.
- `canonical_fields_updated` continua **gravado** — só não é exibido na timeline.

**C1** — evidência no banco:
- Migration reaplicada sem efeito; o único campo de cliente existente ("Link
  chatguru") ficou com os defaults corretos e **não mudou de tipo**.
- A **view `_active` foi recriada** — ela lista coluna por coluna e, sem isso, o
  serviço (que lê da view) não enxergaria nada do que foi criado. Passo fácil de
  esquecer e que teria feito toda a story parecer "não funcionar".
- CHECKs criados inclusive contra auto-vínculo e auto-dependência — a barreira
  existe no banco, não só na tela.
- Vínculo simétrico 1↔1 com desfazimento dos pares antigos dos dois lados: não há
  como formar corrente A→B→C.
- `linked_field_def_id` entrou no schema zod do RPC do tema — mesmo cuidado que o
  `groupName` da W1 exigiu (strip silencioso).

**Gates reproduzidos por mim:** `typecheck` limpo · `eslint` limpo nos arquivos da
onda · `vite build` OK.

---

## O que continua dependendo de gente

1. **C1** — criar um campo de cliente de cada tipo novo, um com 3 linhas e
   subtítulos, um dependente e um par vinculado; vincular a um tema e conferir que
   a ficha do caso mostra igual.
2. **C1** — arrastar para reordenar nos dois editores.
3. **AU1** — editar campos de um caso e conferir que saiu da linha do tempo e
   apareceu na auditoria com "de → para".
4. **T2** — distribuir com caso de 1 responsável, 2 responsáveis e nenhum.

— Quinn, guardião da qualidade 🛡️
