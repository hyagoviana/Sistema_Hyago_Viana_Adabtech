# Story R1-05: Vínculo pessoa↔caso (papel/vínculo: município, vínculo empregatício) — N2

- **Sprint/Epic:** Reforma 2026-07 · **R1 — Modelo Pessoa/Lead/Cliente por caso** (bloco B1)
- **ID:** R1-05
- **Status:** Ready for Review
- **Estimativa relativa:** M (campos de vínculo no caso — JSONB reaproveitando padrão de S2-07; UI na ficha do caso)
- **Executor sugerido:** @data-engineer (migration se necessária) + @dev (serviço/UI) · Quality gate: @architect

---

## Story

**Como** operador que cadastra o caso de uma pessoa,
**quero** registrar o **vínculo/papel da pessoa NAQUELE caso** (ex.: município de atuação, vínculo empregatício/institucional),
**para que** esses dados fiquem no CASO (não como atributo fixo da pessoa) e alimentem documentos/pipeline por caso.

---

## Contexto / o que JÁ EXISTE vs NOVO

> **Pedido (doc-mestre B1 / item N2):** *"vínculo pessoa↔caso (papel/vínculo da pessoa no caso: município/vínculo empregatício)."*
> Complementa a decisão de S2-07 (campos canônicos DO CASO em JSONB) e o cadastro da pessoa (custom_fields de CLIENTE). O **vínculo por caso** é distinto de ambos.

- **JÁ EXISTE (município no caso):** `system_cases.municipio` (texto livre) — preenchido no `CaseFormDialog` (`src/components/cases/CaseFormDialog.tsx:319-329`) e usado no autofill de documentos (`document-autofill.ts`). É o embrião do "vínculo por caso".
- **JÁ EXISTE (campos canônicos do CASO — reusar padrão):** `system_cases.canonical_fields JSONB` + GIN + `updateCaseCanonicalFields` (`cases-service.ts:1076-1117`; migration `20260703000004_case_canonical_fields.sql`). **Padrão a reaproveitar** para o vínculo, se a decisão for JSONB.
- **JÁ EXISTE (dados PROFISSIONAIS da PESSOA — NÃO confundir):** `system_clients.professional_data JSONB` (vínculo institucional, CRM, etc.) exibido em `clientes.$id.tsx:315-364`. Esse é atributo **da pessoa**, fixo entre casos — o vínculo de N2 é **por caso** e pode diferir (a mesma pessoa pode ter município/vínculo distinto em cada caso).
- **NOVO:** representar o **vínculo da pessoa NO caso** — mínimo: `municipio` (já existe) + `vinculo_empregaticio`/`vinculo_institucional` **por caso** + (opcional) `papel` da pessoa no caso. Decisão de armazenamento: **reaproveitar `canonical_fields`** do caso (chaves `municipio`/`vinculo_empregaticio`/`papel`) OU colunas dedicadas — ver decisão travada abaixo.

> **DECISÃO TRAVADA:** o vínculo é **do CASO**, nunca da pessoa. Armazenamento preferencial = **`system_cases.canonical_fields`** (JSONB já existente, padrão S2-07) para evitar nova migration/recriação de view; `municipio` permanece na coluna dedicada existente (não migrar). Só criar coluna nova se o owner exigir busca/relatório estruturado sobre o vínculo — nesse caso, seguir a regra de ouro de recriar `system_cases_active`.

---

## Acceptance Criteria

1. É possível registrar, **por caso**, o vínculo da pessoa: **município** (coluna existente) + **vínculo empregatício/institucional** + (opcional) **papel** — persistidos no CASO (`municipio` e/ou `canonical_fields`), **nunca** em `system_clients`.
2. A mesma pessoa pode ter vínculos **diferentes** em casos diferentes (ex.: município A no caso 1, município B no caso 2) sem sobrescrever um ao outro.
3. Os campos de vínculo aparecem e são editáveis na **ficha do caso** (e/ou no `CaseFormDialog` na criação).
4. O vínculo do caso alimenta o **autofill de documentos** (município já alimenta; incluir os novos campos quando houver placeholder correspondente).
5. Se `canonical_fields` for usado, **nenhuma** gravação vaza para `system_clients.custom_fields`/`professional_data`.
6. Se (e somente se) uma coluna dedicada for criada, `system_cases_active` é **recriada (DROP+CREATE)** preservando TODAS as colunas + grants.

---

## Tasks / Subtasks

- [x] **Decisão de armazenamento** (AC:1) — **TRAVADA: `canonical_fields` (JSONB, sem migration)**. `municipio` fica na coluna dedicada existente; `vinculo_empregaticio`/`vinculo_papel` vão para `canonical_fields` com namespace `vinculo_*`. Sem colunas dedicadas ⇒ sem recriar view/trigger.
- [x] **Serviço** (AC:1,2,5) — reuso de `updateCaseCanonicalFields` (`cases-service.ts:1076`) para gravar `vinculo_empregaticio`/`vinculo_papel` (merge por caso); `municipio` via `updateCase` (coluna). Nenhuma gravação em `system_clients`.
- [x] **UI ficha do caso** (AC:3) — bloco **"Vínculo no caso"** (`VinculoFields.tsx`) na ficha (`casos.$id.tsx`), padrão visual de `FiesFields`: município (coluna) + vínculo empregatício + papel (canonical `vinculo_*`).
- [x] **CaseFormDialog** (AC:3) — não alterado (opcional; município já existe na criação). Vínculo/papel editáveis na ficha do caso.
- [x] **Autofill** (AC:4) — `document-autofill.ts` expõe `vinculo_empregaticio`/`vinculo_papel` sob rótulo amigável (padrão dos aliases FIES); município segue via coluna, sem quebrar placeholders atuais.
- [x] **Filtro `VINCULO_FIELD_KEYS`** — `CaseCanonicalFields` filtra as chaves de vínculo (junto com `FIES_FIELD_KEYS`) para não duplicar no bloco de campos livres.
- [x] **(Condicional) Migration** — **N/A**: decisão = `canonical_fields`; nenhuma coluna nova, view/trigger intocados.
- [x] **Testes** (AC:1-6) — `npm run typecheck` (0 erros novos: 22 antes = 22 depois), `npx eslint` limpo, `npm run test:rbac` verde.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases-service.ts` (`updateCaseCanonicalFields` — reuso; sem função nova se JSONB).
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` (referência de padrão) + novo bloco "Vínculo no caso" na ficha (`src/routes/casos.$id.tsx`).
- `sistema-hv/src/components/cases/CaseFormDialog.tsx` (opcional — campos na criação).
- `sistema-hv/src/lib/cases/document-autofill.ts` (mapear chaves de vínculo).
- (Condicional) `sistema-hv/supabase/migrations/2026071x000002_case_vinculo.sql` + rollback — **só** se colunas dedicadas.

**Regras de ouro (pertinentes):**
- Vínculo é do **CASO** — nunca gravar em `system_clients` (regra idêntica a S2-07: `canonical_fields` é do caso).
- **Se** criar coluna: **RECRIAR `system_cases_active` (DROP+CREATE)** com todas as colunas + grants `anon/authenticated/service_role`; **NÃO** recriar `trg_system_cases_bifurcacao`; migration via `npx tsx scripts/db-apply-pg.ts` + rollback.
- **NÃO** deletar `case_type`/`macrostatus_*`.
- Preferir JSONB (`canonical_fields`) para evitar tocar a view (menor risco).

**Riscos de regressão:**
- Confundir `professional_data` (pessoa) com vínculo (caso) ⇒ perder o "por caso" de N2. Manter separação.
- Se usar `canonical_fields`, colidir chaves com S2-07 (nº FIES) ⇒ usar prefixo/namespace claro (ex.: `vinculo_*`).
- Recriar a view perdendo colunas quebra o front — copiar o SELECT vigente antes.

### Testing
- Gravar vínculo no caso A e outro no caso B (mesma pessoa) → cada caso guarda o seu; `system_clients` inalterado.
- `municipio` do caso continua alimentando o autofill; novos campos alimentam quando há placeholder.
- (Se coluna) view recriada expõe a nova coluna + todas as antigas com grants nos 3 roles.
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** S2-07 (padrão `canonical_fields` + `updateCaseCanonicalFields`, já em produção). Independe de R1-01..04 (pode ir em paralelo).
- **Cruzamento com R2 (TEMA/FRENTE):** **parcial.** O vínculo pode variar por **frente/tipo** dentro de um tema (ex.: campo "município" faz sentido em ESF/DGM). Se R2 introduzir **campos personalizados por frente**, o vínculo por caso deve conviver com eles (mesma tabela `canonical_fields` ou defs por frente). Deixar o namespace `vinculo_*` estável para não colidir com os campos de frente de R2.
- **Cruzamento com R5 (permissões, se existir):** vínculo não é dado financeiro ($) — sem gate financeiro necessário.

## Dev Agent Record

**Agent:** @dev (James) · **Data:** 2026-07-18

**Decisão de armazenamento (registrada):** `system_cases.canonical_fields` (JSONB, S2-07) — **sem migration**.
- `municipio` → coluna dedicada `system_cases.municipio` (não migrada; via `updateCase`).
- `vinculo_empregaticio` / `vinculo_papel` → `canonical_fields`, namespace **`vinculo_*`** (via `updateCaseCanonicalFields`, merge por caso).
- Nenhuma coluna nova ⇒ `system_cases_active` e `trg_system_cases_bifurcacao` **intocados** (AC-6 N/A).

**Por-caso / nunca-pessoa (AC-1/2/5):** grava só em `system_cases`. Duas gravações independentes por caso (merge JSONB por `case_id`). Zero escrita em `system_clients.custom_fields` / `professional_data`.

**Namespace anti-colisão:** `vinculo_*` não colide com `fies_*` (R5-06) nem com defs de tema/frente (R2-07). `CaseCanonicalFields` filtra `VINCULO_FIELD_KEYS` (junto de `FIES_FIELD_KEYS`) para o vínculo não duplicar no bloco de campos livres.

**Validação:**
- `npm run typecheck` — 22 erros pré-existentes = 22 depois (0 novo; nenhum nos arquivos tocados; verificado via `git stash`).
- `npx eslint` (arquivos tocados) — limpo; `prettier --write` (LF) aplicado.
- `npm run test:rbac` — todos verdes.

## File List

- `sistema-hv/src/lib/cases/vinculo-fields.ts` (**novo** — defs + `VINCULO_FIELD_KEYS`, namespace `vinculo_*`)
- `sistema-hv/src/components/cases/VinculoFields.tsx` (**novo** — bloco "Vínculo no caso")
- `sistema-hv/src/routes/casos.$id.tsx` (plug do bloco `VinculoFields` após FIES)
- `sistema-hv/src/components/cases/CaseCanonicalFields.tsx` (filtra `VINCULO_FIELD_KEYS`)
- `sistema-hv/src/lib/cases/document-autofill.ts` (rótulo amigável p/ `vinculo_*` no autofill)
- `sistema-hv/src/lib/cases-service.ts` (reuso de `updateCaseCanonicalFields` — sem alteração de código)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial (N2 / B1) | @sm |
| 2026-07-18 | 0.2 | Implementado: defs `vinculo-fields.ts`, bloco `VinculoFields` (município coluna + `vinculo_*` canonical), filtro em `CaseCanonicalFields`, autofill. Armazenamento = `canonical_fields` (sem migration). Status → Ready for Review. | @dev (James) |
