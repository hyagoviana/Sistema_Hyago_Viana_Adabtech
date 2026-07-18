# Story R2-02: Backfill — mapear service_types→TEMAS e derivar frente_slug

- **Épico:** R2 — Camada TEMA→CASO→TIPO (bloco B2)
- **Fase da Sequência Segura §7:** 5b (backfill)
- **ID:** R2-02
- **Status:** Draft (BLOQUEADA — ver Pré-requisito de negócio)
- **Estimativa relativa:** M (dados/backfill idempotente, sem DDL destrutivo)
- **Executor sugerido:** @data-engineer · Quality gate: @architect + @po (validar mapa com o cliente)
- **Risco:** ALTO (popula colunas usadas dali pra frente; erro de mapa se propaga)

---

## Story

**Como** engenheiro de dados,
**quero** popular `system_temas`, `system_tema_frentes`, `system_service_types.tema_id` e, nos casos existentes, `system_cases.tema_id` + `frente_slug` — **derivando** de `case_type`/`service_type_id` legados — **sem** apagar nada legado,
**para que** a camada TEMA/FRENTE reflita fielmente os dados atuais antes de qualquer unificação de pipeline.

> **DECISÃO TRAVADA (D1, doc-mestre §2, §4.2):** fundir **FIES_ESF + FIES_DGM** no tema **"FIES/1%"**; a distinção ESF/DGM/Censo/Portaria vira **frente**. Os demais service_types (COVID, MAIS_MEDICOS, RESIDENCIA, CFM_CRM, OUTROS) viram temas próprios com (por ora) 1 frente default cada, até a lista definitiva chegar.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (service_types atuais):** seed `s13_espinha.sql:35-45` (FIES_ESF, FIES_DGM, COVID, MAIS_MEDICOS, RESIDENCIA, CFM_CRM) + `OUTROS` e renomeações (`20260709000020_pipelines_rename_abatimento_outros.sql`). **Abatimento Militar tem slug `FIES_DGM`** (nome ≠ slug) — MEMORY `case_code_prefixo_nome`.
- **JÁ EXISTE:** `frente`/tipo hoje mora IMPLÍCITO no `case_type` (slug do service_type) + nas 3 pastas de caso do FIES_ESF (`01- Abatimento ESF DGM`, `02- Censo 05`, `03- Portaria`) — `20260709000030_service_type_folders.sql:56-58`.
- **JÁ EXISTE:** `system_cases.case_type` (slug) + `service_type_id` populado em `s13_espinha.sql:156-161`.
- **JÁ EXISTE:** estrutura vazia de R2-01 (`system_temas`, `system_tema_frentes`, `system_cases.tema_id/frente_slug`, `system_service_types.tema_id`).
- **NOVO:** dados nas tabelas TEMA/FRENTE + backfill dos casos.

> **REGRA DO MAPA:** `service_type → tema` é definido por uma **tabela VALUES** dentro da migration (idempotente, `ON CONFLICT DO NOTHING`/`DO UPDATE`). `case → frente_slug` é derivado, **na ausência do mapa definitivo**, do próprio `case_type` (1 frente default por tema, slug = `DEFAULT` ou = slug legado). Quando o mapa definitivo do cliente chegar, uma migration incremental refina `frente_slug`.

---

## Acceptance Criteria

1. `system_temas` populado (idempotente) com: `FIES_1PCT` ("FIES/1%"), `COVID`, `MAIS_MEDICOS`, `RESIDENCIA`, `CFM_CRM`, `OUTROS` (nomes conforme cliente).
2. `system_service_types.tema_id` preenchido: **FIES_ESF e FIES_DGM → tema FIES_1PCT**; cada um dos demais → seu tema homônimo.
3. `system_tema_frentes` populado com as frentes conhecidas do tema FIES/1% (ESF, DGM, Censo, Portaria) + 1 frente `DEFAULT`/`PADRAO` por tema para os demais.
4. `system_cases` existentes: `tema_id` = tema do seu `service_type_id`; `frente_slug` = frente derivada (FIES_ESF→`ESF` como default provisório; FIES_DGM→`DGM`; demais→`PADRAO`). **Todo caso não-deletado com service_type mapeado fica com `tema_id` NOT NULL.**
5. **Idempotência:** rodar a migration 2x não duplica temas/frentes nem sobrescreve `frente_slug` já refinado manualmente (usar `WHERE frente_slug IS NULL` no backfill de casos, ou `DO UPDATE` explícito só onde seguro).
6. Dual-write intacto: `case_type`, `macrostatus_op`, `service_type_id`, `stage_op_id` **inalterados** em todos os casos.
7. Rollback: zera `tema_id`/`frente_slug` dos casos, `tema_id` dos service_types, e trunca (soft ou hard) as linhas semeadas por esta migration — **sem** dropar as tabelas (isso é R2-01).

---

## Tasks / Subtasks

- [ ] **Obter o mapa definitivo** (AC: 1-4) — @po confirma com o cliente TEMAS/frentes (doc-mestre §9 item 1). **Enquanto não chegar**, usar o mapa provisório documentado acima e marcar `frente_slug` provisório com flag/observação.
- [ ] **Migration** `20260719000002_backfill_temas_frentes.sql` (AC: 1-6)
  - [ ] `INSERT ... SELECT` de `system_temas` a partir de VALUES (org fixa) `ON CONFLICT (organization_id, slug) DO NOTHING`.
  - [ ] `UPDATE system_service_types SET tema_id = t.id FROM system_temas t JOIN VALUES(service_slug→tema_slug)` — FIES_ESF/FIES_DGM ambos → FIES_1PCT.
  - [ ] `INSERT` frentes em `system_tema_frentes` (ESF/DGM/Censo/Portaria no FIES_1PCT; PADRAO nos demais) `ON CONFLICT (tema_id, slug) DO NOTHING`.
  - [ ] `UPDATE system_cases SET tema_id = st.tema_id, frente_slug = <derivado> FROM system_service_types st WHERE st.id = system_cases.service_type_id AND system_cases.deleted_at IS NULL AND system_cases.tema_id IS NULL`.
  - [ ] **NÃO** tocar `system_cases_active` (esta migration não adiciona coluna nova — as colunas vieram de R2-01). Confirmar que nenhuma coluna nova é criada aqui.
- [ ] **Rollback** `20260719000002_backfill_temas_frentes.rollback.sql` (AC: 7).
- [ ] **Validação** (AC: 4-6) — contagens; verificação `tema_id NOT NULL` em 100% dos casos com service_type; dual-write inalterado.

---

## Dev Notes

**Arquivos/migrations a tocar:**
- NOVA `sistema-hv/supabase/migrations/20260719000002_backfill_temas_frentes.sql` + rollback.
- Nenhum código de app (puro dado). `types.ts` já cobriu as colunas em R2-01.

**Regras de ouro:**
- Backfill NUNCA sobrescreve `case_type`/`macrostatus_*`. Só grava as colunas NOVAS.
- Idempotente: `ON CONFLICT` nos seeds; `WHERE tema_id IS NULL` no backfill de casos.
- Migration NÃO adiciona coluna → **NÃO** recria a view (confirmar).
- `npx tsx scripts/db-apply-pg.ts`.

**Riscos de regressão (CRÍTICOS deste épico):**
- **Mapa errado de frente** propaga para pastas/modelos (R2-04) e Kanban (R2-05). Mitigação: validar o mapa com @po/cliente ANTES; `frente_slug` provisório é reversível (rollback zera).
- **FIES_ESF que na verdade é Censo/Portaria:** hoje a distinção não está estruturada no caso (só na pasta). O `frente_slug='ESF'` provisório pode estar errado para parte dos casos → marcar explicitamente como "a refinar" e não travar decisões irreversíveis nele.
- Casos com `service_type_id` NULL (legado sem tipo) ficam com `tema_id` NULL — aceitável; listar quantos e reportar.

## Testing

- `SELECT slug, count(*) FROM system_service_types st JOIN system_temas t ON t.id=st.tema_id GROUP BY 1` — FIES_ESF e FIES_DGM apontam para FIES_1PCT.
- `SELECT count(*) FROM system_cases WHERE service_type_id IS NOT NULL AND tema_id IS NULL AND deleted_at IS NULL` = 0.
- Distribuição `frente_slug` bate com distribuição `case_type`.
- Rodar 2x → sem duplicatas.
- Rollback zera tudo e casos voltam a `tema_id`/`frente_slug` NULL.
- `npm run typecheck` / `npm run lint` verdes.

## Dependências

- **Depende de:** R2-01 (estrutura criada).
- **Habilita:** R2-03 (pipeline unificada), R2-04 (pastas por frente), R2-05 (case_code/Kanban).
- **BLOQUEADA por PENDÊNCIA DO CLIENTE (doc-mestre §9 item 1):** lista definitiva de temas/frentes/campos. Sem ela, roda com mapa provisório documentado, mas o refino de `frente_slug` fica pendente.
- **Cruzamento com R5:** os "campos FIES estruturados no cadastro" (A2) dependem de `frente_slug` correto — R5 consome o resultado deste backfill.

## File List

- `sistema-hv/supabase/migrations/20260719000002_backfill_temas_frentes.sql` (novo)
- `sistema-hv/supabase/rollbacks/20260719000002_backfill_temas_frentes.rollback.sql` (novo)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial — fase 5b do épico R2 | @sm |
| 2026-07-18 | 0.2 | C1 (QA/Architect): renumeração do bloco R2 para evitar colisão com R3-01 (`20260718000001`). Migration/rollback/File List/Dev Notes de `20260718000002_backfill_temas_frentes` → `20260719000002_backfill_temas_frentes`. | @sm |
