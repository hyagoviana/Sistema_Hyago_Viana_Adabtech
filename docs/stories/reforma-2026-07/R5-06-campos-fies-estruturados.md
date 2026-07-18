# Story R5-06: A2 — dados do contrato FIES como campos estruturados no cadastro/caso

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-06
- **Status:** Ready for Review
- **Estimativa relativa:** M (campos estruturados no caso + UI + busca) — **cruza com R2**
- **Executor sugerido:** @dev (UI/serviço) + @data-engineer (se novos campos def) · Quality gate: @architect
- **Item do documento-mestre:** §8 **A2** — "campos FIES estruturados · `client_custom_fields` / `case_canonical_fields`" (alimenta B2/R2)

---

## Story

**Como** operador que atua num caso FIES,
**quero** registrar os dados do contrato FIES como **campos estruturados** (Instituição Financeira, Valor/saldo devedor, Situação, Ano),
**para que** eles alimentem automações/triagem e documentos, em vez de ficarem soltos em texto livre.

---

## Contexto / o que JÁ EXISTE vs NOVO (arquivo:linha)

- **JÁ EXISTE (mecanismo de campos do CASO):** `system_cases.canonical_fields` (JSONB) + índice GIN + `updateCaseCanonicalFields` + busca por texto + UI `CaseCanonicalFields` — entregue em **S2-07** (`docs/stories/S2-07-campos-canonicos-caso.md`; componente `sistema-hv/src/components/cases/CaseCanonicalFields.tsx`; migration `20260703000004_case_canonical_fields.sql`). Hoje é **chave/valor livre**.
- **JÁ EXISTE (autofill):** `AutoFillData.canonical` (`sistema-hv/src/lib/cases/document-autofill.ts:49-50`) já injeta `canonical_fields` nos placeholders do documento.
- **NOVO:** os 4 campos FIES **concretos**, com domínio fechado (não texto livre):
  - **Instituição Financeira** — enum {Caixa, BB}
  - **Valor** — saldo devedor (monetário)
  - **Situação** — enum {Ativo, Inativo, Liquidado}
  - **Ano** — faixa {até 2017 / 2018+}
  Usados em **automações/triagem**.

> **DECISÃO TRAVADA:** esta story trata dos **campos FIES concretos** no cadastro/caso. A **ESTRUTURA genérica de campos por tema/frente** é do épico **R2** (doc-mestre §4.1 "campos personalizados do tema/frente"). **Não duplicar** o mecanismo: usar o que R2 definir **se já existir**; enquanto R2 não existe, usar **`canonical_fields` do caso** (S2-07) com um conjunto FIES pré-definido (defs por tipo/tema).

---

## ⚠️ Cruzamento com R2 — obrigatório documentar

- R2 introduz "campos personalizados do TEMA/FRENTE" (doc-mestre §4.1, §5.1 "campos personalizados"). Os campos FIES desta story são um **caso concreto** desse mecanismo.
- **Regra de não-duplicação:** implementar sobre **`canonical_fields`** (já existente) com um **conjunto FIES fixo** por tipo/tema. Quando R2 entregar as defs de campo por tema/frente, **migrar as defs FIES para lá** (o armazenamento `canonical_fields` permanece; só a origem das defs muda). Não criar um segundo mecanismo paralelo.
- **A2 ↔ R2** e **A2 alimenta B2** (busca/triagem por esses campos).

---

## Acceptance Criteria

1. No caso FIES, os 4 campos aparecem como **campos estruturados** com domínio fechado (Instituição {Caixa/BB}, Situação {Ativo/Inativo/Liquidado}, Ano {até 2017 / 2018+}) + Valor monetário.
2. Os valores persistem em `system_cases.canonical_fields` (JSONB) — **não** em `custom_fields` do cliente.
3. Os campos são **buscáveis** (herda a busca por texto de S2-07) e ficam disponíveis para automações/triagem.
4. Os valores fluem para o autofill de documento via `AutoFillData.canonical` (sem quebrar D1-D4).
5. Implementação **reusa** o mecanismo de `canonical_fields`; documentada a migração futura das defs para R2 (sem duplicar mecanismo).

---

## Tasks / Subtasks

- [x] **Defs FIES** — definir o conjunto de campos FIES (chaves, rótulos, tipo/opções) por tipo/tema FIES; documentar que virão de R2 quando existir. → `src/lib/cases/fies-fields.ts` (chaves `fies_instituicao`, `fies_valor_centavos`, `fies_situacao`, `fies_ano`; helper `isCasoFies`; comentário de migração p/ R2).
- [x] **UI** — componente `FiesFields` (`src/components/cases/FiesFields.tsx`) renderiza os 4 campos com selects (Instituição/Situação/Ano) + input monetário (Valor), gravando via `updateCaseCanonicalFields`. Montado na ficha do caso (`casos.$id.tsx`) **só quando `isCasoFies(case_type)`**, ao lado do bloco de pares livres (S2-07, intacto).
- [x] **Busca/triagem** — confirmado: a busca por texto de S2-07 faz `JSON.stringify(canonical_fields).includes(needle)` (cases-service.ts ~1355-1370), então os valores FIES (labels legíveis "Caixa Econômica Federal", "Ativo"…) são buscáveis sem código novo; automações/n8n leem `canonical_fields` direto.
- [x] **Autofill** — `buildAutoFillFromClient` (`document-autofill.ts`) agora expõe cada campo FIES também sob o RÓTULO amigável no mapa `canonical` (o `canonicalLookup` casa por nome; as chaves técnicas `fies_*` sozinhas não bateriam). Valor monetário (centavos) formatado em `R$`. D1-D4 intactos.
- [x] **(Defs no banco)** NÃO necessário — reusa `canonical_fields` existente; **sem migration**, sem tocar `system_cases`/`system_cases_active`.
- [x] **Testes** (AC 1-5) — `npx tsc --noEmit` sem erro NOVO (22 erros pré-existentes idênticos com/sem a mudança); `npm run test:rbac` verde; `npx eslint` nos 4 arquivos limpo.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` (ou wrapper FIES).
- `sistema-hv/src/lib/cases-service.ts` (`updateCaseCanonicalFields` — já existe).
- `sistema-hv/src/lib/cases/document-autofill.ts` (mapeamento FIES → placeholders).
- (condicional) migration de defs + rollback.

**Regras de ouro pertinentes:**
- **Reusar** `canonical_fields` (não novo mecanismo). Nunca gravar em `system_clients.custom_fields`.
- Se migration tocar `system_cases` → **recriar `system_cases_active`** preservando colunas.
- Migrations via `npx tsx scripts/db-apply-pg.ts` + rollback.

### Testing
- Preencher Instituição=Caixa, Situação=Ativo, Ano=2018+, Valor → grava em `canonical_fields`.
- Busca por "Caixa" retorna o caso.
- Autofill do documento traz os valores.

---

## Dependências

- **Depende de:** S2-07 (`canonical_fields` — já concluída).
- **Cruzamentos:** **A2 ↔ R2** (mecanismo de campos por tema/frente — não duplicar; migrar defs para R2 quando existir). **A2 alimenta B2** (busca/triagem).
- **Habilita:** triagem/automação FIES por dados estruturados.

---

## File List

- `sistema-hv/src/lib/cases/fies-fields.ts` **(novo)** — defs FIES (chaves canônicas, rótulos, tipos, opções) + `isCasoFies`.
- `sistema-hv/src/components/cases/FiesFields.tsx` **(novo)** — UI dos 4 campos estruturados; grava em `canonical_fields`.
- `sistema-hv/src/routes/casos.$id.tsx` **(editado)** — monta `<FiesFields>` só p/ casos FIES (`isCasoFies`).
- `sistema-hv/src/lib/cases/document-autofill.ts` **(editado)** — expõe campos FIES sob rótulo amigável no autofill.
- `sistema-hv/src/lib/cases-service.ts` (reuso — `updateCaseCanonicalFields`, sem alteração).
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` (inalterado — bloco de pares livres S2-07 convive ao lado).
- Migration: **não necessária** (reusa `canonical_fields` de S2-07).

## Dev Agent Record

### Agent Model Used
Claude Opus 4.8 (dev / James)

### Decisões
- **Reuso total de `canonical_fields`** (S2-07) — nenhum mecanismo novo, nenhuma migration, nada em `custom_fields` do cliente. As 4 chaves FIES são apenas um subconjunto pré-definido do mesmo JSONB.
- **Chaves canônicas centralizadas** em `src/lib/cases/fies-fields.ts` (fonte única): `fies_instituicao`, `fies_valor_centavos`, `fies_situacao`, `fies_ano`. Selects gravam o **rótulo legível** como valor (bom p/ busca e autofill sem mapa extra); valor monetário em **centavos** (inteiro em string), como o resto do financeiro.
- **Gate por tipo** via `isCasoFies(case_type)` (detecta `FIES_*`) — isolado de propósito para R2 trocar por "tema" depois (comentado no arquivo).
- **Autofill**: como o `canonicalLookup` casa por NOME normalizado, adicionei os campos FIES ao mapa `canonical` também sob o rótulo amigável ("Instituição Financeira", "Situação", "Ano do contrato", "Valor"); o monetário sai formatado em `R$`. Placeholders humanos passam a preencher sem quebrar D1-D4.
- **Cruzamento R2 documentado** no cabeçalho de `fies-fields.ts` e no `isCasoFies`: quando R2 entregar defs de campo por tema/frente, migrar as defs FIES para lá — o armazenamento em `canonical_fields` permanece.

### Validação
- `npx tsc --noEmit`: 22 erros, **idênticos** ao tree limpo (stash) — zero erro novo introduzido pelos arquivos tocados; os 4 arquivos compilam limpos.
- `npm run test:rbac`: verde (todos passaram).
- `npx eslint` nos 4 arquivos: limpo (exit 0) após `--fix` de 2 questões de prettier.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — A2 campos FIES estruturados (cruza R2) | @sm |
| 2026-07-18 | 0.2 | Implementado: `fies-fields.ts` (defs+`isCasoFies`), `FiesFields.tsx`, gate na ficha, autofill por rótulo. Reuso de `canonical_fields`, sem migration. typecheck/rbac/eslint verdes. Ready for Review. | @dev (James) |
