# Story R5-08: D1-D4 — preenchimento automático de documentos com inconsistências (modelos sem placeholders + autofill)

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-08
- **Status:** Draft
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

- [ ] **Auditoria dos modelos (Drive)** — inventariar os modelos ativos, identificar trechos fixos que deveriam ser placeholders e tokens faltantes (foco em D1/D2/D3 e varredura de D4).
- [ ] **Definição de fontes** — para cada novo placeholder (unidade de saúde, CBO, CNES, gênero…), definir a origem (`canonical_fields` do caso — cruza com R5-06 —, `professional_data`, município). **Elicitar do owner** quando ambíguo.
- [ ] **Correção dos modelos** — inserir os placeholders `<...>` corretos nos Google Docs/Word modelo.
- [ ] **Autofill** — em `document-autofill.ts`, garantir que as chaves existam em `AutoFillData` e sejam resolvidas em `resolveAutoValue`/`buildAutoFillValues`; confirmar `normKey` casando os novos nomes; placeholder sem fonte → string vazia.
- [ ] **Testes** (AC 1-4) — gerar cada documento revisado com um caso real e conferir que os campos entram e nenhum token literal sobra. `npx tsc --noEmit` / `npm run lint` verdes.

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

## File List

- `sistema-hv/src/lib/cases/document-autofill.ts`
- Modelos no Google Drive (lista a produzir na auditoria)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — D1-D4 variáveis de documentos | @sm |
