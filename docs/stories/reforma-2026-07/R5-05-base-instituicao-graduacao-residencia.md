# Story R5-05: A1 — base de dados de instituição de graduação e residência/hospital (investigação + ajuste do form)

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-05
- **Status:** Ready for Review
- **Estimativa relativa:** S (investigação + fiação do datalist a uma fonte)
- **Executor sugerido:** @analyst (definição) + @dev (form) · Quality gate: @architect
- **Item do documento-mestre:** §8 **A1** — "base grad/residência · `professional_data` JSONB"; §9 pendência 5 (confirmar base de graduação/residência)

---

## Story

**Como** operador cadastrando os dados profissionais do médico,
**quero** escolher a instituição de graduação e o hospital/residência a partir de uma base padronizada (não uma lista curta fixa),
**para que** os dados fiquem consistentes, buscáveis e reutilizáveis nos documentos.

---

## Contexto / o que JÁ EXISTE vs NOVO (arquivo:linha)

- **JÁ EXISTE (armazenamento):** os dados vão em `system_clients.professional_data` (JSONB) — campos `instituicao_graduacao`, `residencia_hospital`, `residencia_inicio`, `residencia_termino`, `residencia_especialidade` (`sistema-hv/src/components/clients/ClientFormDialog.tsx:179-213`).
- **JÁ EXISTE (UI):** o form usa `<datalist>` com listas **FIXAS hardcoded**: `INSTITUICOES` (`ClientFormDialog.tsx:97-113+`, ~20 universidades) para graduação (`datalist id="instituicoes-graduacao"` `:822`, campo `:836-842`) e `hospitais-residencia` (`:827`, campo `:935-942`). São só sugestões digitáveis, **não uma base**.
- **PENDÊNCIA DO CLIENTE (doc-mestre §9.5):** "confirmar a base de dados de graduação/residência" — ainda **não definido** se é: (a) manter datalist fixo ampliado; (b) tabela própria (`system_instituicoes` / `system_hospitais`) alimentada por CSV/e-MEC/CNES; (c) texto livre.
- **NOVO:** esta story é **investigação/definição** + ajuste do form conforme a decisão. Se a decisão for tabela, criar tabela `system_*` + fonte de alimentação; se for datalist ampliado, trocar o array fixo por uma fonte de dados única.

> **DECISÃO A ELICITAR do owner (bloqueia a parte de implementação):**
> 1. A base de **graduação** deve vir de e-MEC/lista oficial de IES, ou basta uma lista curada editável?
> 2. A base de **hospitais/residência** deve vir do CNES, ou lista curada?
> 3. É aceitável **texto livre** com autocomplete (datalist) ampliado no MVP, deixando a base "oficial" para depois?

---

## Acceptance Criteria

1. **Definição registrada** (neste doc/ADR) de qual base usar para graduação e para residência/hospital, com a fonte e o mecanismo de atualização.
   - **DECISÃO DO OWNER (2026-07-18): "Lista curada editável (ampliada)".** No MVP as listas hardcoded ficam **centralizadas numa fonte única** (`sistema-hv/src/lib/br/instituicoes.ts`) e são **ampliadas** significativamente, mantendo **digitação livre** (o `<datalist>` é apenas sugestão). A **edição via UI pelo admin** (tabela `system_instituicoes` / `system_hospitais`) é **evolução futura aprovada** pelo owner — NÃO implementada nesta story (sem migration/tabela agora). Respostas às 3 perguntas de elicitação (§9.5): (1/2) lista curada editável, não e-MEC/CNES no MVP; (3) sim, texto livre com autocomplete ampliado no MVP, base "oficial" para depois.
2. Se a decisão for **datalist ampliado/texto livre**: o form deixa de usar array hardcoded curto e passa a consumir uma fonte única (constante ampliada OU tabela), preservando entrada livre.
3. Se a decisão for **tabela `system_*`**: migration idempotente + rollback (`npx tsx scripts/db-apply-pg.ts`), seed/importação da base, e o form consome via hook/RPC.
4. Os valores continuam persistidos em `professional_data` (JSONB) — sem quebrar autofill de documentos que lê esses campos.

---

## Tasks / Subtasks

- [x] **Investigação** — levantar opções (e-MEC/IES, CNES para hospitais), custo de importação e volume; propor recomendação; **elicitar decisão do owner** (perguntas acima). → Owner decidiu "Lista curada editável (ampliada)"; tabela editável fica como evolução futura.
- [x] **Ajuste do form (conforme decisão)**:
  - [x] Datalist ampliado: extrair a lista para fonte única e ampliar; manter digitação livre. → `src/lib/br/instituicoes.ts` (`INSTITUICOES_GRADUACAO` = 92 entradas, `HOSPITAIS_RESIDENCIA` = 64 entradas), consumidas nos `<datalist>` do form.
  - [ ] ~~Tabela: migration `system_instituicoes`/`system_hospitais` (prefixo `system_`) + seed + hook/RPC + autocomplete no form.~~ → **Evolução futura aprovada pelo owner** — NÃO implementada nesta story.
- [x] **Testes** (AC 1-4) — valor selecionado grava em `professional_data`; entrada livre ainda aceita. `npm run typecheck` (sem erro novo — 22 pré-existentes, 0 novos), `npm run test:rbac` (verde), `npx eslint` nos arquivos alterados (limpo).

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/components/clients/ClientFormDialog.tsx` (datalists de graduação/residência).
- (condicional) nova migration `system_instituicoes`/`system_hospitais` + rollback + hook/RPC.

**Regras de ouro pertinentes:**
- Prefixo `system_` em qualquer tabela/view nova.
- Migrations via `npx tsx scripts/db-apply-pg.ts` + rollback. (Este bug **não** toca `system_cases` — sem recriar view.)
- Dual-write não é atingido.

### Testing
- Selecionar instituição da base grava em `professional_data.instituicao_graduacao`.
- Digitar hospital fora da base ainda é aceito (texto livre) se assim decidido.

---

## Dependências

- **Depende de:** **decisão do owner** (pendência doc-mestre §9.5) — bloqueia a implementação, não a investigação.
- **Cruzamentos:** nenhum com R2/R4. Relaciona-se a D1-D4 (esses campos alimentam documentos).
- **Habilita:** autofill de documentos com instituição/hospital padronizados.

---

## File List

- `sistema-hv/src/lib/br/instituicoes.ts` **(NOVO)** — fonte única curada e ampliada: `INSTITUICOES_GRADUACAO` (92) + `HOSPITAIS_RESIDENCIA` (64).
- `sistema-hv/src/components/clients/ClientFormDialog.tsx` — removidos os arrays hardcoded `INSTITUICOES`/`HOSPITAIS`; datalists de graduação/residência agora consomem as constantes centralizadas.
- ~~(condicional) migration + rollback + hook/RPC de instituições/hospitais~~ — **evolução futura** (não implementada; ver AC-1).

## Dev Agent Record

### Agent Model Used
- Opus 4.8 (1M context) — @dev (James)

### Decisão do owner aplicada
- **2026-07-18 — "Lista curada editável (ampliada)".** Centralizei as duas listas hardcoded (antes ~30 universidades e ~10 hospitais espalhadas no `ClientFormDialog.tsx`) numa fonte única `src/lib/br/instituicoes.ts`, ampliando para **92** instituições de graduação (públicas + privadas de Medicina) e **64** hospitais/instituições de residência médica do Brasil. Ordenadas alfabeticamente (locale pt-BR), sem duplicatas (verificado por script).
- **Digitação livre mantida:** os `<datalist>` são apenas sugestão; o `<Input list=...>` continua aceitando qualquer valor digitado, que persiste em `system_clients.professional_data` (JSONB) — schema e autofill de documentos **inalterados**.

### Evolução futura registrada (aprovada pelo owner, não implementada)
- Migrar as listas para tabela `system_*` (ex.: `system_instituicoes` / `system_hospitais`) **editável pela UI do admin**, mantendo a constante como seed/fallback. Sem migration/tabela agora, conforme instrução do owner.

### Validação
- `npm run typecheck`: **0 erros novos** (22 erros pré-existentes no repo, nenhum nos arquivos tocados — baseline medido em HEAD via `git stash`: 22 antes, 22 depois).
- `npm run test:rbac`: **verde** (🎉 todos os testes passaram).
- `npx eslint src/lib/br/instituicoes.ts src/components/clients/ClientFormDialog.tsx`: **limpo** (exit 0).

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — A1 base grad/residência (spike) | @sm |
| 2026-07-18 | 0.2 | C8 (QA): status anotado como "requer decisão do owner" — implementação bloqueada pelas 3 perguntas de elicitação (§9.5); investigação pode iniciar. | @sm |
| 2026-07-18 | 0.3 | **Decisão do owner: "Lista curada editável (ampliada)".** Listas centralizadas em `src/lib/br/instituicoes.ts` (92 graduação + 64 hospitais) e consumidas nos datalists; digitação livre mantida (persiste em `professional_data`). Tabela `system_*` editável pelo admin registrada como **evolução futura aprovada** (não implementada). Status → Ready for Review. typecheck (0 novos) / test:rbac (verde) / eslint (limpo). | @dev |
