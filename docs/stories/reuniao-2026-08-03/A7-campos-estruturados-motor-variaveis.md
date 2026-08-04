# Story A7: Campos estruturados que alimentam variáveis do documento (financeiro: % honorários, % êxito, valor, nº de parcelas)

**Épico:** Reunião 2026-08-03 — 8 Ajustes
**ID:** A7
**Status:** Ready for Review (fatia AC4+AC5a; AC1/AC2 aguardam modelos do dono)
**Estimativa relativa:** M
**Executor sugerido:** @dev · Quality gate: @qa
**Risco:** MÉDIO

---

## Story

**Como** operadora/advogado que gera contratos e procurações a partir dos modelos do sistema,
**quero** que os campos que ALIMENTAM VARIÁVEIS do documento — especialmente os financeiros (**percentual de honorários**, **percentual de êxito**, **valor**, **nº de parcelas**) — sejam **campos estruturados** (com tipo `money`/`number`/`select`, `scope='caso'`) em vez de texto livre,
**para que** o valor entre num formato determinístico (sem acento errado / formato divergente) e a variável do modelo **sempre puxe** o dado — evitando documentos furados.

Reforça a A1 (o campo só existe na pipeline/tema e só é preenchido no caso; o que não for campo padronizado vai para NOTAS). Onde houver uma variável no modelo, **não pode haver digitação livre** para esse dado.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE
- **Defs de campo por tema** — `system_tema_field_defs` (chave `key` estável derivada do rótulo; `type ∈ text/select/multiselect/money/number/date/boolean`; `scope ∈ caso|cliente`; `required`, `hidden_in_list`, `max_occurrences`). Tipo em `sistema-hv/src/hooks/useTemaFieldDefs.ts:25-40`.
- **Editor admin dos campos do tema** — `sistema-hv/src/components/pipeline/TemaFieldDefsEditor.tsx`. Já oferece os tipos `Texto / Múltipla escolha / Sim-Não / Valor (R$) / Número / Data` (`TYPE_OPTIONS` em `:34-41`) e origem `caso × cliente` (`:349-366`). **`select` (escolha única) é legado — não é mais oferecido na criação** (`:43-47`, `usaOpcoes` em `:50-52`).
- **Controle estruturado na ficha** — `sistema-hv/src/components/cases/CaseCanonicalFields.tsx`. Renderiza cada def conforme o tipo: `MoneyField` (guarda **centavos** inteiros via `maskCentavos`/`centavosFromMask`/`centavosToMask`, `:342-352`, `:376-404`), `number` (input numérico, `:354-372`), `select`/`multiselect`/`boolean`. Grava em `system_cases.canonical_fields` (caso) ou `custom_fields` do cliente (`saveDef` em `:92-106`). Campos SEM def caem no modo chave/valor **texto livre** (`freeEntries` em `:75`, render `:173-201`) — é justamente o que a A1/A7 querem eliminar onde há variável.
- **Motor de geração / autofill** — `sistema-hv/src/lib/cases/document-autofill.ts`. `buildAutoFillFromClient` (`:467`) monta o mapa `canonical` a partir de `canonical_fields` BRUTO do caso + dados do cliente; `resolveAutoValue` (`:352`) casa o placeholder do modelo por `auto_field`, heurística de `key`/`label`, aliases e por fim `canonicalLookup` (nome normalizado, `normKey` em `:57-65`). Já existe formatação determinística para o financeiro em `augmentWithHonorarios` (`:214-258`): `percentual_honorarios → "15%"`, `valor_parcela_centavos → "R$ 500,00"`, etc., além de aliases "Porcentagem" / "Porcentagem do Êxito".
- **Fluxo de geração (popup + edição do Word)** — `sistema-hv/src/components/cases/GenerateCaseDocumentFlow.tsx`. `PickDialog` lê os placeholders vivos do modelo (`useTemplatePlaceholders`, `:438`), pré-preenche com `resolveAutoValue` (`:448-456`) e renderiza um `<Input>` **de texto livre por placeholder** (`:656-681`) — só CPF/CNPJ tem máscara (`isCpfCnpjField`). É aqui que hoje um valor financeiro poderia ser digitado à mão fora do padrão.
- **Serviço de modelos** — `sistema-hv/src/lib/document-templates-service.ts` (CRUD de `system_document_templates`; `fields: TemplateField[]` com `key/label/source/auto_field`). RPC: `sistema-hv/src/rpc/document-templates.ts`.
- **Termo/financeiro** — `sistema-hv/src/lib/termo-service.ts` já tem os campos financeiros como colunas estruturadas do termo (`percentual_honorarios`, `valor_parcela_centavos`, `qtd_parcelas`, `honorarios_total_centavos`, `:27-28`, `:57-103`) e formata o documento do termo de forma determinística (`:1080-1091`). `sistema-hv/src/components/cases/TermoPanel.tsx`.
- **FIES/Vínculo** — já são campos ESTRUTURADOS com rótulo amigável exposto ao motor (`FIES_FIELD_DEFS`, `VINCULO_FIELD_DEFS` em `document-autofill.ts:517-539`; valor monetário FIES formatado em R$). Servem de PADRÃO a seguir.

### NOVO (esta story)
1. **Inventário/mapeamento** das variáveis usadas nos modelos financeiros (contrato/procuração) ↔ `key` de campo do tema.
2. **Garantir defs estruturadas** para os campos financeiros críticos (`% honorários`, `% êxito`, `valor`, `nº de parcelas`) com o `type` correto e `scope='caso'` (seed por tema onde faltar).
3. **Eliminar digitação livre** para esses dados no popup de geração e na ficha — o valor sai de controle estruturado.
4. **Formatação determinística no motor** por tipo de def (percentual `pt-BR`, moeda `R$`, número) na hora de resolver o placeholder — não confiar no que o usuário digitou.
5. **Validação/aviso** quando uma variável do modelo **não casa** com nenhum campo/autofill (placeholder órfão), tanto no popup quanto num relatório de conferência para o admin.

---

## Acceptance Criteria

1. **AC1 — Inventário + mapeamento variável↔campo.** Existe um artefato (doc em `docs/stories/reuniao-2026-08-03/` ou tabela/const no código) listando, para cada modelo financeiro (contrato e termo/procuração relevantes), TODAS as variáveis/placeholders usadas e a `key` do campo do tema (ou fonte de autofill) que as alimenta. Cada variável financeira crítica — **percentual de honorários, percentual de êxito, valor (honorários/parcela), nº de parcelas** — aparece mapeada para uma fonte estruturada.

2. **AC2 — Defs estruturadas dos campos financeiros críticos.** Para os temas que usam esses documentos, os campos `% honorários`, `% êxito`, `valor` e `nº de parcelas` existem como `system_tema_field_defs` com `type` adequado (`number` para percentuais/quantidade, `money` para valor), `scope='caso'`, e chegam à ficha via `CaseCanonicalFields`. Onde a fonte canônica é o **termo** (`termo-service`), o mapeamento documenta que o valor vem do termo (não se duplica o dado) — a story NÃO obriga recadastrar manualmente o que o financeiro já calcula.

3. **AC3 — Ficha sem texto livre para variáveis.** Na ficha do caso (`CaseCanonicalFields`), os campos financeiros críticos são editados por **controle estruturado** (`MoneyField` p/ valor, input `number` p/ percentuais e parcelas, `select` quando aplicável) — nunca pelo par chave/valor livre (`freeEntries`). Um valor financeiro crítico não fica preso no bloco "Outros campos" de texto livre.

4. **AC4 — Motor lê `canonical_fields` por `key` e formata de forma determinística.** Ao resolver o placeholder, o motor (`document-autofill.ts`) formata pelo TIPO da def correspondente: percentual → `NN%` (vírgula decimal pt-BR, ex.: `15%`, `12,5%`), moeda → `R$ N.NNN,NN`, número → inteiro. A formatação NÃO depende da string digitada pelo usuário; dois casos com o mesmo valor numérico produzem a MESMA string no documento.

5. **AC5 — Validação/aviso de placeholder órfão.** Quando uma variável do modelo não casa com nenhum campo do tema nem fonte de autofill: (a) no popup de geração (`GenerateCaseDocumentFlow`) o placeholder é sinalizado (ex.: aviso "sem campo correspondente — preencha manualmente ou cadastre o campo"); (b) existe uma forma de o admin conferir os órfãos de um modelo (relatório/aviso reutilizando `useTemplatePlaceholders` + defs do tema). Nenhum token literal (`<...>`) vaza para o documento por causa de campo faltante.

6. **AC6 — Sem regressão nos modelos existentes.** Modelos e casos já existentes continuam gerando documentos como antes: autofill de cliente/município/FIES/vínculo/honorários inalterado; campos livres já gravados permanecem visíveis/editáveis (não são apagados); a dedup e o filtro por pasta/categoria da lista de modelos seguem funcionando. `npm run typecheck`, `npm run lint` e a suíte de testes passam.

---

## Tasks / Subtasks

- [ ] **T1 — Inventário das variáveis financeiras (AC1).**
  - [ ] Levantar os placeholders dos modelos financeiros (contrato + termo/procuração) via `useTemplatePlaceholders` / leitura dos Google Docs; consolidar a lista.
  - [ ] Mapear cada variável → `key` de def do tema OU fonte de autofill (`augmentWithHonorarios`, termo). Registrar o mapa (doc + const de referência para os aliases do motor).
  - [ ] Marcar as variáveis financeiras críticas: `% honorários`, `% êxito`, `valor`, `nº de parcelas`.
- [ ] **T2 — Defs estruturadas dos campos críticos (AC2, AC3).**
  - [ ] Conferir/definir, por tema que usa esses modelos, as defs `system_tema_field_defs` dos campos críticos com `type` correto (`number` p/ %, `money` p/ valor, `number` p/ parcelas) e `scope='caso'`. Seed idempotente onde faltar (migration/script reutilizando o padrão de `FIES_FIELD_DEFS`/`VINCULO_FIELD_DEFS`).
  - [ ] Garantir que `CaseCanonicalFields` renderiza esses campos por controle estruturado (já suportado; validar que as keys caem em `defKeys`, não em `freeEntries`).
  - [ ] Onde o valor vier do **termo** (financeiro calculado), documentar a fonte e NÃO duplicar entrada manual (apenas expor rótulo amigável ao motor).
- [ ] **T3 — Formatação determinística no motor (AC4).**
  - [ ] Em `document-autofill.ts`, ao casar um placeholder com um campo cujo def é `money`/`number`(percentual), formatar pelo TIPO (não pela string): reutilizar/estender `augmentWithHonorarios` e o formatador de centavos; adicionar formatação de percentual pt-BR determinística.
  - [ ] Cobrir os aliases de "percentual de êxito"/"porcentagem" já existentes e adicionar os que faltarem conforme o inventário (T1).
- [ ] **T4 — Eliminar texto livre onde há variável (AC3).**
  - [ ] No `PickDialog` de `GenerateCaseDocumentFlow`, para placeholders que casam com def `money`/`number`, usar máscara/entrada estruturada (análogo ao tratamento de CPF/CNPJ) em vez do `<Input>` de texto livre — ou pré-preencher travado a partir do canonical estruturado.
- [ ] **T5 — Validação/aviso de placeholder órfão (AC5).**
  - [ ] Calcular no popup os placeholders sem correspondência (comparando `useTemplatePlaceholders` × `resolveAutoValue`/defs do tema) e exibir aviso não bloqueante por campo.
  - [ ] Adicionar um ponto de conferência para o admin (aviso/relatório no editor de modelo ou no editor de campos do tema) listando variáveis do modelo sem campo correspondente.
- [ ] **T6 — Regressão + testes (AC6).**
  - [ ] Testes unitários de `resolveAutoValue`/formatadores (percentual pt-BR, moeda, número) e do detector de órfãos.
  - [ ] Smoke do fluxo: gerar contrato de um caso com % e valor preenchidos e conferir a string no documento; conferir que campos livres antigos permanecem.
  - [ ] `npm run typecheck`, `npm run lint`, testes.

---

## Dev Notes

**Motor de variáveis / geração**
- Entrada única de valores do caso: `system_cases.canonical_fields` (JSONB). `buildAutoFillFromClient` (`document-autofill.ts:467`) transforma esse JSONB + dados do cliente no mapa `canonical` (chave = rótulo em PT); `resolveAutoValue` (`:352`) casa o placeholder por `auto_field` → heurística `key`/`label` → aliases → `canonicalLookup` (nome normalizado por `normKey`, `:57-65`).
- Financeiro determinístico já existe em `augmentWithHonorarios` (`:214-258`): produz `"15%"`, `"R$ 500,00"` e os aliases `"Porcentagem"`/`"Porcentagem do Êxito"`. **Reutilizar/estender** aqui a formatação — é o lugar certo para a formatação por tipo (não formatar no controle de UI).
- Padrão de campo estruturado exposto ao motor com rótulo amigável: `FIES_FIELD_DEFS` e `VINCULO_FIELD_DEFS` (`:517-539`) — o valor monetário FIES já é formatado `R$` a partir de centavos. Seguir o mesmo padrão para os campos financeiros do tema.
- Popup de geração: `GenerateCaseDocumentFlow.tsx` — placeholders vivos em `:438` (`useTemplatePlaceholders`), pré-preenchimento em `:448-456`, render dos inputs em `:656-681`. Hoje só CPF/CNPJ tem máscara (`isCpfCnpjField`, `formatCpfCnpj` de `@/lib/format`); replicar esse tratamento para `money`/percentual.

**Campos do tema (defs)**
- `system_tema_field_defs`: tipo em `useTemaFieldDefs.ts:25-40`. Editor em `TemaFieldDefsEditor.tsx`; tipos oferecidos em `:34-41` (`money` = "Valor (R$)", `number`, `select` é legado). `scope` `caso|cliente` em `:349-366`.
- Ficha: `CaseCanonicalFields.tsx`. `MoneyField` guarda **centavos inteiros** (`:376-404`, helpers `maskCentavos`/`centavosFromMask`/`centavosToMask` de `format.ts:70-90`). Campos com def caem em `defKeys` e usam `TemaFieldInput` (`:238-373`); os SEM def caem em `freeEntries` (texto livre, `:75`) — o alvo da A7 é tirar as variáveis financeiras desse balde livre.

**Financeiro / termo**
- `termo-service.ts` já tem os valores financeiros como estrutura (`percentual_honorarios`, `valor_parcela_centavos`, `qtd_parcelas`, `honorarios_total_centavos`, `:27-28`, `:57-103`) e formata o documento do termo (`:1080-1091`). Quando o dado já vem do termo, o mapeamento deve apontar para essa fonte — evitar re-digitação e divergência.

**Riscos (registrar no PR)**
- **Modelos Word antigos com variáveis divergentes:** placeholders redigidos fora do padrão ("porcentagem do êxito", "% de honorários", "honorários (%)") podem não casar por normalização; o inventário (T1) precisa da REVISÃO DO DONO para confirmar quais modelos usar e ajustar redações. Ver memória `project_templates_sem_placeholders` (modelos sem `<...>`).
- **Formatação de número/percentual/locale pt-BR:** decidir e travar a representação (vírgula decimal, `%`, `R$`, milhar). Centavos são a fonte da verdade para moeda; percentual como `number` (ex.: `15` = `15%`, `12.5` → `12,5%`). Não formatar duas vezes.
- **Colisão de `key`/rótulo entre temas** e defs `scope='cliente'` vs `caso` — garantir que o campo financeiro seja `scope='caso'` (varia por caso).
- Refs de memória: `project_motor_preenche1x_2026_07_21`, `project_filtros_por_tema_r209`, `project_motor_2026_07_21`, `project_reforma_tema_caso_2026_07_18` (TEMA→CASO→TIPO).

---

## Testing

- **Unitário (`document-autofill`):** dado um caso com `% honorários = 15`, `% êxito = 20`, `valor = 50000` (centavos) e `nº parcelas = 12`, `resolveAutoValue`/formatadores produzem `"15%"`, `"20%"`, `"R$ 500,00"`, `"12"` — independentemente de como o valor foi armazenado; e a MESMA entrada em dois casos gera a MESMA string.
- **Unitário (órfãos):** um modelo com placeholder sem campo/autofill correspondente é detectado e listado; um modelo 100% mapeado não gera aviso.
- **UI (smoke Playwright, opcional):** abrir a ficha de um caso do tema financeiro, preencher os campos estruturados, gerar o contrato pelo `GenerateCaseDocumentFlow` e conferir que (a) não há input de texto livre para os campos financeiros, (b) o documento sai com os valores formatados, (c) nenhum token `<...>` vaza.
- **Regressão:** casos com campos livres antigos continuam mostrando/editando esses campos; autofill de cliente/município/FIES/vínculo inalterado; `npm run typecheck` + `npm run lint` + testes passam.

---

## Dependências

- **A1** (campo só na pipeline/tema, só preenche no caso; o que não é padronizado vai para NOTAS) — A7 é a materialização de A1 para os campos que alimentam variáveis.
- Revisão do DONO dos modelos financeiros (Word/Google Docs) para confirmar quais modelos usar e alinhar as redações das variáveis (bloqueia AC1/AC5 de fechar 100%).
- Financeiro/termo (`termo-service`) como fonte canônica de parte dos valores — não duplicar entrada manual.

---

## File List

**Fatia AC4 + AC5(a) — implementada 2026-08-04 (@dev):**

- `sistema-hv/src/lib/cases/document-autofill.ts` — **AC4**: formatadores determinísticos `formatPercentBR`/`formatMoneyBR`/`formatIntBR` (exportados) + helper `toNumber`; `augmentWithHonorarios` reescrito para formatar pelo TIPO (não pela string); novos aliases de "percentual/porcentagem de/do êxito" e "% (de) êxito".
- `sistema-hv/src/lib/cases/document-autofill.test.ts` — testes unitários dos formatadores (percentual pt-BR, moeda em centavos, inteiro) + determinismo (mesmo valor → mesma string) + novos aliases de êxito.
- `sistema-hv/src/components/cases/GenerateCaseDocumentFlow.tsx` — **AC5(a)**: memo `orphanKeys` (placeholders que `resolveAutoValue` não resolve) + aviso NÃO bloqueante por campo ("sem campo correspondente — preencha manualmente"). Fluxo de geração inalterado.

**Pendente (aguarda revisão dos modelos Word pelo dono / outra story):**

- AC1 (inventário variável↔campo) e AC2 (seed das defs financeiras) — não implementados nesta fatia.
- AC3 (`CaseCanonicalFields.tsx`) e AC5(b) (relatório de órfãos para o admin em `TemaFieldDefsEditor.tsx`) — fora do escopo desta fatia (trabalho paralelo mexe nesses arquivos).

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-08-03 | v0.1 | Draft inicial da story A7 (campos estruturados que alimentam variáveis do documento — financeiro) | @sm (Bob) |
| 2026-08-04 | v0.2 | Fatia autônoma AC4 (formatação determinística por tipo no motor: `formatPercentBR`/`formatMoneyBR`/`formatIntBR` + aliases de % êxito) + AC5(a) (aviso de placeholder órfão no popup de geração) + testes unitários. Lint exit 0; typecheck sem erro novo (só o pré-existente em `contaazul/service.ts`). AC1/AC2/AC3/AC5(b) aguardam revisão dos modelos do dono / trabalho paralelo. | @dev |
