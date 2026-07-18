# Story R5-08: D1-D4 — preenchimento automático de documentos com inconsistências (modelos sem placeholders + autofill)

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-08
- **Status:** Ready for Review (parte de código) · Pendente operação/owner (revisão dos modelos no Drive)
- **Estimativa relativa:** M (revisão dos modelos no Drive + ajustes no autofill)
- **Executor sugerido:** @dev (autofill) + owner/operação (revisão dos modelos Word no Drive) · Quality gate: @qa
- **Item do documento-mestre:** §8 **D1-D4** — "variáveis de documentos · `document-autofill.ts` + modelos Drive (root cause: modelos sem `<...>`)"; §5.2

---

## Story

**Como** operador que gera documentos a partir de modelos,
**quero** que os documentos sejam preenchidos corretamente com os dados do cliente/caso/município,
**para que** eu não precise corrigir manualmente trechos como "POSTO DE SAÚDE DO MANGUE SECO… CBO 225142… CNES 3481220" que hoje saem sem vínculo/errados.

---

## Contexto / o que JÁ EXISTE vs NOVO (arquivo:linha)

- **JÁ EXISTE (autofill puro):** `sistema-hv/src/lib/cases/document-autofill.ts` — `AutoFillData` cobre cliente, caso, município (`augmentWithMunicipio`), perfil (`augmentWithPerfil`) e `canonical` (campos do caso). `resolveAutoValue`/`buildAutoFillValues` montam os placeholders `<campo>` do modelo. `normKey` casa placeholder ↔ campo canônico normalizando acento/pontuação/caixa.
- **JÁ EXISTE (geração):** copia o Google Doc do modelo → `replacePlaceholders` → link editável (fluxo `generateCaseDocumentFromTemplate`, doc-mestre §3.5).
- **ROOT CAUSE conhecido (doc-mestre §5.2 + memória `project_templates_sem_placeholders`):** "variáveis não preenchem" porque **vários modelos no Drive são docs antigos já preenchidos (sem os tokens `<...>`)** — o autofill não tem o que substituir. Além disso há trechos **hardcoded** no modelo (ex.: "POSTO DE SAÚDE DO MANGUE SECO", "CBO 225142", "CNES 3481220") que deveriam ser placeholders ou dados do caso, e por isso saem sempre iguais/sem vínculo.
- **CASOS RELATADOS:**
  - **D1** — Declaração ESF Ativo Masculino: trecho sem vinculação ("POSTO DE SAÚDE DO MANGUE SECO… CBO 225142… CNES 3481220").
  - **D2** — Declaração ESF Ativo Feminino: idem.
  - **D3** — Termo de acerto: pequenos ajustes.
  - **D4** — "praticamente todos os documentos" têm pequenos ajustes.
- **NOVO (2 frentes):**
  1. **Revisão dos modelos no Drive** — trocar os trechos fixos/dados por placeholders `<...>` reais (posto/unidade de saúde, CBO, CNES, sexo/gênero, etc.) e garantir que os modelos tenham TODOS os tokens esperados.
  2. **Autofill** — garantir que as chaves correspondentes existam em `AutoFillData`/`buildAutoFillValues` (posto de saúde, CBO, CNES podem precisar vir de `canonical_fields`/`professional_data`/município), com normalização (`normKey`) casando os novos placeholders.

> **DECISÃO A ELICITAR:** de onde vêm posto de saúde / CBO / CNES? Provavelmente **`canonical_fields` do caso** (campos do serviço, ver R5-06) ou `professional_data`. Definir a origem por campo antes de criar o placeholder no modelo.

---

## Acceptance Criteria

1. Os modelos citados (Declaração ESF Ativo Masculino/Feminino, Termo de acerto) usam placeholders `<...>` para os trechos hoje fixos (unidade de saúde, CBO, CNES, gênero/sexo) — auditados e corrigidos.
2. O autofill preenche esses placeholders a partir da fonte definida (`canonical_fields` / `professional_data` / município), sem deixar token literal nem trecho sem vínculo.
3. Uma auditoria dos demais modelos ("praticamente todos", D4) lista os placeholders faltantes/errados e corrige os pequenos ajustes.
4. Placeholder sem fonte de dado sai **vazio** (nunca o token literal `<...>`), conforme o padrão já usado no autofill.

---

## Tasks / Subtasks

- [ ] **Auditoria dos modelos (Drive)** — inventariar os modelos ativos, identificar trechos fixos que deveriam ser placeholders e tokens faltantes (foco em D1/D2/D3 e varredura de D4). **→ REQUER OPERAÇÃO/OWNER (fora do repo).** Guia entregue abaixo ("Guia de revisão dos modelos").
- [x] **Definição de fontes** — para cada novo placeholder (unidade de saúde, CBO, CNES, gênero…), a origem definida é **`canonical_fields` do caso** (campos do serviço, resolvidos no autofill via R5-06 sob rótulo amigável). Município e dados do cliente já vinham de tabela/cadastro. Documentado no guia.
- [ ] **Correção dos modelos** — inserir os placeholders `<...>` corretos nos Google Docs/Word modelo. **→ REQUER OPERAÇÃO/OWNER (edição manual dos Google Docs, fora do repo).**
- [x] **Autofill** — em `document-autofill.ts`: (a) CONFIRMADO que placeholder sem fonte sai **vazio** e nunca o token literal — `resolveAutoValue` devolve `undefined` e `buildAutoFillValues` só grava valores definidos (`if (v) out[f.key]=v`), nunca reinjeta `<...>`; (b) ADICIONADOS aliases de saúde (`CANONICAL_ALIASES` + `canonicalAliasLookup`) para "Unidade/Posto de Saúde/UBS", "CBO", "CNES" apontando para `canonical_fields` mesmo quando a redação do placeholder difere do rótulo do campo. `normKey` casa acento/pontuação/caixa/sufixo obrigatório.
- [x] **Testes** (AC 4 + resolução canônica) — criado `document-autofill.test.ts` (11 asserts): placeholder sem fonte → `undefined`/ausente do mapa/nunca `<`; canonical casa por rótulo; aliases de saúde resolvem; alias sem dado → `undefined`. `tsc --noEmit` sem erro novo em document-autofill; `eslint` limpo nos 2 arquivos; `test:rbac` verde. **Geração ponta-a-ponta com caso real (AC 1-3) → REQUER modelos revisados no Drive (operação/owner).**

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases/document-autofill.ts` (chaves/resolução).
- Modelos no Google Drive (revisão manual — fora do repo; documentar quais).
- Possível ligação com `canonical_fields` (R5-06) para posto/CBO/CNES.

**Regras de ouro pertinentes:**
- **Sem migration** provável (é modelo + autofill). Se algum campo exigir persistência nova, usar `canonical_fields` (S2-07) — não novo mecanismo.
- Placeholder sem fonte → vazio, nunca token literal (padrão já existente no autofill).
- Dual-write não é atingido.

### Testing
- Declaração ESF Masculino/Feminino gerada com caso real → unidade/CBO/CNES vêm do dado (não fixos).
- Termo de acerto → campos corretos.
- Varredura: nenhum `<...>` literal sobra nos documentos gerados.

---

## Dependências

- **Depende de:** possivelmente **R5-06** (campos FIES/serviço em `canonical_fields`) se posto/CBO/CNES vierem de lá. R5-05 (A1) para instituição/hospital se aplicável.
- **Cruzamentos:** relaciona-se a R5-06 (canonical_fields como fonte). Sem cruzamento direto com R2/R4.
- **Habilita:** documentos gerados prontos sem correção manual.

---

---

## Guia de revisão dos modelos no Drive (entregável para a operação/owner)

> **Objetivo:** eliminar os trechos FIXOS/sem vínculo dos Google Docs modelo (ex.: "POSTO DE SAÚDE DO MANGUE SECO… CBO 225142… CNES 3481220") trocando-os por **placeholders `<...>`**. Depois de revisados, o autofill do sistema preenche automaticamente.

### Regras gerais
- Placeholder é qualquer texto entre `< >` — ex.: `<Nome>`, `<CPF>`, `<Unidade de Saúde>`. Os delimitadores aceitos também incluem `« »`, `{{ }}`, `‹ ›`, `[ ]`, mas **use `< >`** (padrão do projeto).
- Espaços internos são tolerados (`< Nome >` funciona). O nome NÃO diferencia acento/maiúscula/pontuação (o sistema normaliza).
- Sufixo `- obrigatório` no placeholder marca o campo como obrigatório na tela de geração (ex.: `<CPF - obrigatório>`).
- **Todo trecho que hoje é fixo e varia por caso/pessoa deve virar placeholder.** Se um placeholder ficar sem dado, ele sai **VAZIO** no documento (nunca aparece o `<...>` literal) — então é seguro adicionar.

### De onde vem cada dado (fonte)
| Placeholder (sugestão) | Fonte no sistema | Observação |
|---|---|---|
| `<Nome>` / `<Nome do cliente>` | Cadastro do cliente (`full_name`) | automático |
| `<CPF>` | Cadastro do cliente (`cpf_cnpj`) | formatado automaticamente |
| `<Município>` | Caso (`municipio`) | automático |
| `<RG>`, `<Estado civil>`, `<Endereço>`, `<CEP>` | Cadastro do cliente | automático (ou bloco `<dados pessoais do médico/da médica>`) |
| `<CRM>`, `<CRM UF>`, `<OAB>`, `<Especialidade>` | `professional_data` do cliente | automático |
| **`<Unidade de Saúde>`** / `<Posto de Saúde>` / `<UBS>` | **Campo do caso (`canonical_fields`)** | **criar campo do serviço** (varia por caso/vínculo) |
| **`<CBO>`** | **Campo do caso (`canonical_fields`)** | **criar campo do serviço** |
| **`<CNES>`** | **Campo do caso (`canonical_fields`)** | **criar campo do serviço** |
| `<Início período>`, `<Fim período>`, `<Carga horária>` | Campo do caso (`canonical_fields`) | criar campo do serviço se usado |
| FIES: `<Instituição Financeira>`, `<Situação>`, `<Ano do contrato>`, `<Valor (saldo devedor)>` | `canonical_fields` (defs FIES, R5-06) | já resolvidos |

> **Como criar um campo do caso:** os campos do serviço são gravados em `system_cases.canonical_fields` (ficha do caso). O nome do campo deve casar com o placeholder — ex.: campo "Unidade de Saúde" ↔ `<Unidade de Saúde>`. O autofill também aceita variações de redação para saúde (ver aliases abaixo), então `<Posto de Saúde>` no modelo já encontra o campo "Unidade de Saúde" do caso.

### Placeholders recomendados por documento

**Declaração ESF — Ativo Masculino** e **Ativo Feminino** (D1/D2):
```
<Nome>, portador do CPF <CPF>, exerce atividade na <Unidade de Saúde>,
sob o CBO <CBO>, no estabelecimento CNES <CNES>, no município de <Município>,
no período de <Início período> a <Fim período>.
```
- Remover os literais "POSTO DE SAÚDE DO MANGUE SECO", "CBO 225142", "CNES 3481220" → substituir por `<Unidade de Saúde>`, `<CBO>`, `<CNES>`.
- O gênero (masculino/feminino) pode continuar em dois modelos separados OU usar o bloco `<dados pessoais do médico>` / `<dados pessoais da médica>` que já flexiona automaticamente ("portador/portadora", "inscrito/inscrita" etc.).

**Termo de acerto** (D3) e demais documentos (D4):
- Varrer cada modelo e trocar dados fixos (nome, CPF, valores, município, unidade) por placeholders da tabela acima. Qualquer placeholder sem fonte sai vazio — não quebra o documento.

### Aliases de saúde já suportados pelo autofill (redação livre no modelo)
O sistema mapeia estas variações de placeholder para o **mesmo campo do caso**, então a operação pode escrever no modelo a redação que preferir:
- **Unidade de Saúde** ← `<Unidade de Saúde>`, `<Posto de Saúde>`, `<UBS>`, `<Unidade Básica>`, `<Estabelecimento de Saúde>`, `<Nome da unidade>`, `<Unidade de lotação>`, `<Lotação>`.
- **CBO** ← `<CBO>`, `<Código CBO>`, `<Classificação Brasileira de Ocupações>`.
- **CNES** ← `<CNES>`, `<Código CNES>`, `<Cadastro Nacional de Estabelecimentos de Saúde>`.
> O campo gravado no caso deve ter um dos nomes canônicos aceitos (ex.: "Unidade de Saúde", "CBO", "CNES"). Definidos em `CANONICAL_ALIASES` (`document-autofill.ts`).

---

## Pendências (requer operação/owner — fora do código/repo)

1. **Revisão manual dos Google Docs modelo** — trocar trechos fixos por placeholders `<...>` conforme o guia acima. NÃO é possível fazer no repo/código.
2. **Inventário exato dos modelos ativos e trechos fixos de cada um** — depende de acesso ao Drive/owner; o guia lista os padrões, mas a lista definitiva por documento é da operação.
3. **Criar os campos do caso** (Unidade de Saúde, CBO, CNES etc.) na ficha do caso / defs do serviço, para o autofill ter a fonte.
4. **Validação ponta-a-ponta (AC 1-3)** — gerar cada documento revisado com um caso real e conferir. Só é possível após 1-3.

---

## Dev Agent Record

**Agent:** @dev (James) · 2026-07-18

**Root cause confirmado (arquivo:linha):**
- Cadeia de geração: `GenerateCaseDocumentFlow.tsx:253-260` monta `values` só com placeholders resolvidos (`if (val) pre[f.key]=val`); `case-documents-service.ts:378` chama `replacePlaceholders(docId, opts.values)`; `google/docs.ts:108-117` itera **apenas** `Object.entries(values)`. Logo, um token presente no doc mas SEM valor não é tocado → o literal `<...>` permanece **quando o operador deixa em branco**. Isso confirma que o problema-raiz está nos **modelos sem os tokens certos** (nada a substituir) e/ou campos sem dado, não em o autofill "inventar" um literal.
- **Autofill nunca emite literal:** `resolveAutoValue` (document-autofill.ts) retorna `undefined` quando não há fonte; `buildAutoFillValues:319-326` faz `if (v) out[f.key]=v` — nunca grava `<...>`. Comportamento "sem fonte → vazio" **confirmado, não precisou correção** nesta camada.

**Mudança de código (this story):**
- `document-autofill.ts`: adicionados `CANONICAL_ALIASES` + `canonicalAliasLookup()`, chamados em `resolveAutoValue` antes do fallback genérico. Resolvem Unidade/Posto/UBS, CBO, CNES via `canonical_fields` mesmo com redação divergente. Sem migration (usa `canonical_fields`).
- `document-autofill.test.ts`: novo teste standalone (tsx), 11 asserts, todos verdes.

**Validação:**
- `npx tsx src/lib/cases/document-autofill.test.ts` → 11/11 ✓.
- `npx tsc --noEmit` → 22 erros PRÉ-EXISTENTES (checklist/dossie/termo/visibility — drift de tipos gerados do Supabase), **0 novos** e **nenhum** em document-autofill (confirmado via git stash: 22 com e sem a mudança).
- `npx eslint src/lib/cases/document-autofill.ts document-autofill.test.ts` → limpo.
- `npm run test:rbac` → verde.
- `prettier --write` aplicado nos 2 arquivos (evita CRLF).

---

## File List

- `sistema-hv/src/lib/cases/document-autofill.ts` (modificado — aliases de saúde + confirmação sem-fonte→vazio)
- `sistema-hv/src/lib/cases/document-autofill.test.ts` (novo — teste do autofill)
- Modelos no Google Drive (revisão manual — REQUER operação/owner, fora do repo; guia acima)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — D1-D4 variáveis de documentos | @sm |
| 2026-07-18 | 0.2 | Parte de código concluída: confirmado "sem fonte → vazio" (nunca literal); aliases de saúde (Unidade/Posto/UBS, CBO, CNES) → `canonical_fields`; teste do autofill; guia de revisão dos modelos p/ operação; pendências de Drive/owner mapeadas. Status → Ready for Review (código). | @dev (James) |
