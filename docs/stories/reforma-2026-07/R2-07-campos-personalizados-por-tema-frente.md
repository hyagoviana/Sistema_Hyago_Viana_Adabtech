# Story R2-07: Estrutura de campos personalizados por TEMA/FRENTE (N6/A2 estrutural)

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **ID:** R2-07
- **Status:** Draft
- **Estimativa relativa:** M (tabela de defs de campo por tema/frente + editor admin; painel padrão do tema no caso)
- **Executor sugerido:** @data-engineer (migration) + @dev (editor/UI) · Quality gate: @architect
- **Risco:** MÉDIO (config de campos; o VALOR por caso reusa `system_cases.canonical_fields` — já existe)

---

## Story

**Como** administrador,
**quero** definir **quais campos personalizados** existem por **TEMA** (painel padrão do tema) e por **FRENTE** (o campo TIPO muda o conteúdo), como **estrutura** (defs),
**para que** a ficha do caso mostre um painel de campos coerente com o tema/frente e os valores sejam preenchidos por caso — reaproveitando o mecanismo de valor já existente (`canonical_fields`).

> **DECISÃO TRAVADA (N6/A2, doc-mestre §4.1, §5.1):** o painel do caso é **padrão do TEMA**; o campo TIPO/FRENTE **muda o conteúdo** (defs adicionais/condicionais). **ATENÇÃO — CRUZAMENTO:** a parte de "campos FIES **estruturados no cadastro**" (A2, preenchimento/estrutura de dados FIES) fica no épico **R5**. Aqui é a **ESTRUTURA de campos por tema/frente** (defs + onde aparecem). O valor por caso continua em `system_cases.canonical_fields` (S2-07).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (valor por caso):** `system_cases.canonical_fields JSONB` + índice GIN + `updateCaseCanonicalFields` (merge, remove vazios) + busca — `20260703000004_case_canonical_fields.sql:16-20`, `cases-service.ts:1076-1117`, `listCases` busca em JSONB `cases-service.ts:1351-1370`. UI: `CaseCanonicalFields` na ficha do caso.
- **JÁ EXISTE (defs de campo de CLIENTE — molde, NÃO confundir):** `system_client_field_defs` + `system_clients.custom_fields` — `20260622000002_client_custom_fields.sql`. São da **pessoa**; aqui é do **CASO por tema/frente**.
- **JÁ EXISTE (S2-07 nota):** defs por tipo **não** foram criadas no MVP (conjunto livre chave/valor) — `S2-07:44-46`. R2-07 é justamente introduzir as **defs por tema/frente**.
- **NOVO:** `system_tema_field_defs` (`tema_id`, `frente_slug NULL`, `key`, `label`, `type`, `ordem`, `required`, `active`) — define quais campos aparecem. UI: editor admin (dentro do tema/frente) + `CaseCanonicalFields` passa a renderizar as defs do tema/frente do caso (em vez de chave/valor livre).

---

## Acceptance Criteria

1. Migration cria `system_tema_field_defs` (idempotente; view `_active`; RLS; grants; auditoria; molde `system_stage_checklist_defs`/`system_client_field_defs`). Chave: `UNIQUE(tema_id, COALESCE(frente_slug,''), key) WHERE deleted_at IS NULL`.
2. `frente_slug NULL` = campo do painel padrão do TEMA (aparece em todas as frentes); `frente_slug` setado = campo condicional da frente.
3. UI admin (dentro de R2-06, editor de tema/frente): CRUD das defs de campo — só admin (`config.manage`), gate server-side.
4. Ficha do caso: `CaseCanonicalFields` renderiza as defs do **tema+frente** do caso (labels/ordem/required), gravando o valor em `system_cases.canonical_fields` (mecanismo S2-07 **inalterado**). Campos sem def continuam exibíveis (compat com valores livres já gravados).
5. Nenhuma coluna de `system_cases` tocada (o valor segue em `canonical_fields`) → **não** recriar `system_cases_active`. Dual-write intacto; trigger de bifurcação não recriado.
6. Rollback: DROP `system_tema_field_defs` + view; a UI volta ao modo chave/valor livre; valores já gravados em `canonical_fields` **preservados**.

---

## Tasks / Subtasks

- [ ] **Migration** `20260719000006_tema_field_defs.sql` (AC: 1,2,6) — tabela + view `_active` + índices + RLS + grants + auditoria + trigger `updated_at`. **Não** tocar `system_cases`.
- [ ] **Rollback** correspondente (preserva `canonical_fields`).
- [ ] **Serviço/RPC** — CRUD de defs (`config.manage`, gate server-side); leitura `listTemaFieldDefs(tema_id, frente_slug)`.
- [ ] **UI admin** — editor de campos dentro do tema/frente (R2-06).
- [ ] **UI ficha do caso** — `CaseCanonicalFields` consome as defs do tema+frente do caso (fallback: chave/valor livre se não houver defs). Mantém `updateCaseCanonicalFields`.
- [ ] **Types** — `system_tema_field_defs`.
- [ ] **Testes** (AC: 3,4).

---

## Dev Notes

**Arquivos a tocar:**
- NOVA `sistema-hv/supabase/migrations/20260719000006_tema_field_defs.sql` + rollback.
- NOVO serviço/RPC de defs de campo por tema/frente.
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` (renderiza defs).
- `sistema-hv/src/lib/cases-service.ts` (leitura das defs; `updateCaseCanonicalFields` inalterado).
- `sistema-hv/src/lib/supabase/types.ts`.

**Regras de ouro:**
- O **valor** por caso continua em `system_cases.canonical_fields` (S2-07) — **não** criar coluna nova por campo; **não** recriar a view.
- `canonical_fields` é do **CASO** — nunca gravar em `system_clients.custom_fields`.
- Defs restritas a `config.manage` (gate server-side).
- `npx tsx scripts/db-apply-pg.ts` + rollback.

**Riscos de regressão:**
- **Perder valores livres:** ao introduzir defs, esconder chaves que não têm def apagaria dados. Mitigação: renderizar defs + chaves livres remanescentes; nunca deletar chaves não-def.
- **UNIQUE com NULL frente:** usar `COALESCE(frente_slug,'')` no índice único (NULLs distintos no Postgres).
- **Cruzamento A2/R5:** não implementar aqui os campos FIES estruturados do cadastro — só a estrutura genérica por tema/frente. Marcar a fronteira.

## Testing

- Admin cria def de campo no tema FIES/1% (frente NULL) → aparece em todas as frentes; def com `frente_slug='ESF'` só na frente ESF.
- Ficha do caso renderiza as defs corretas; salvar grava em `canonical_fields`; `system_clients.custom_fields` inalterado.
- Valor livre gravado antes das defs continua visível.
- Rollback preserva `canonical_fields`.
- `npm run typecheck` / `npm run lint` verdes.

## Dependências

- **Depende de:** R2-01 (tema/frente), R2-06 (editor admin onde as defs são gerenciadas), S2-07 (mecanismo `canonical_fields` — já entregue).
- **Cruzamento com R5 (A2 — campos FIES estruturados no cadastro):** R5 consome esta estrutura para os campos FIES específicos; a fronteira é "estrutura genérica aqui, conteúdo FIES no R5". **Marcar em ambas as stories.**
- **BLOQUEADA parcialmente por PENDÊNCIA DO CLIENTE:** lista de campos personalizados por frente (§9 item 1).

## File List

- `sistema-hv/supabase/migrations/20260719000006_tema_field_defs.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260719000006_tema_field_defs.rollback.sql` (novo)
- serviço/RPC/hook de defs de campo por tema/frente (novos)
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx`
- `sistema-hv/src/lib/cases-service.ts`
- `sistema-hv/src/lib/supabase/types.ts`

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — N6/A2 estrutural (campos por tema/frente) do épico R2 | @sm |
| 2026-07-18 | 0.2 | C1 (QA/Architect): renumeração do bloco R2 para evitar colisão com R3-01 (`20260718000001`) — migration/rollback/File List `20260718000006_tema_field_defs` → `20260719000006_tema_field_defs`. (C4 já atendido nesta story: UNIQUE com `COALESCE(frente_slug,'')` — serve de padrão para R2-04.) | @sm |
