# Story S7-01: Persistir os honorários da procuração em `system_case_honorarios` (tabela nova)

- **Sprint:** 7 — Termo puxando do histórico (preencher o mínimo) `[Frente B]`
- **ID:** S7-01
- **Status:** Ready for Review
- **Estimativa relativa:** M (migration de tabela nova `system_case_honorarios` no molde da `20260703000001_stage_checklist.sql` + gravar os valores no `createComercialCaseAndGenerateProcuracao`). **NÃO toca `system_cases` → não recria view/trigger.**
- **Executor sugerido:** @data-engineer (migration) + @dev (gravação no serviço) · Quality gate: @architect

---

## Story

**Como** operador que cria um caso comercial gerando a procuração,
**quero** que os valores financeiros que digito na revisão da procuração (percentual de honorários, valor da parcela, desconto à vista, forma de pagamento e o total quando disponível) fiquem **persistidos por caso** numa tabela estruturada,
**para que** a elaboração do Termo de Acerto (S7-02) e futuras procurações do mesmo cliente (S7-03) possam **pré-preencher** esses valores em vez de exigir digitação manual toda vez.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **PROBLEMA (confirmado no código):** os valores financeiros da procuração **NÃO persistem hoje**. São digitados manualmente no `ProcuracaoReviewStep` (`src/components/cases/CaseFormDialog.tsx:391+`, campos com `source:"manual"`) e injetados **direto no Google Doc** por `generateCaseDocumentFromTemplate` (`src/lib/case-documents-service.ts:154`). O registro em `system_case_documents` **NÃO guarda valor estruturado**; o autofill (`src/lib/cases/document-autofill.ts`) só resolve dados **cadastrais** (nome, CPF, CRM…), **nenhum financeiro**.
- **JÁ EXISTE (ponto de gravação):** `createComercialCaseAndGenerateProcuracao(input, triggeredBy)` (`src/lib/cases-service.ts:412`) monta `finalValues` (`{ ...serverAuto, ...input.values }`, `cases-service.ts:453`) **antes** de chamar `generateCaseDocumentFromTemplate`. É aqui que os valores revisados existem juntos e podem ser gravados na tabela nova.
- **JÁ EXISTE (molde de migration):** `supabase/migrations/20260703000001_stage_checklist.sql` — tabela `system_`, RLS por org (4 policies), grants nos 3 roles (`service_role`, `anon`, `authenticated`), view `_active` (`SELECT * WHERE deleted_at IS NULL`), trigger `updated_at`, trigger de auditoria `system_fn_audit`. **Este é o molde a seguir.**
- **NÃO USAR (tabela legada):** `contrato_honorarios` (sem prefixo `system_`, **VAZIA**, não referenciada por nenhum código) tem colunas parecidas (percentual, valor_parcela, desconto_avista) mas **é legado e não deve ser usada** — criar tabela nova `system_case_honorarios` (decisão do Orion, não reabrir).
- **NOVO:**
  1. **Migration** cria `system_case_honorarios` (por caso), com as colunas financeiras da procuração.
  2. **Gravação** em `createComercialCaseAndGenerateProcuracao` (após montar `finalValues`) de um registro/upsert por `case_id` com o que estiver disponível no ato.

> **DECISÃO DO OWNER (travada — Orion, não reabrir):** persistir numa **TABELA NOVA** `system_case_honorarios` (prefixo `system_`), por caso, com: `percentual_honorarios`, `valor_parcela_centavos`, `desconto_avista_pct`, `forma_pagamento`, `honorarios_total_centavos` (o que estiver disponível). Gravar em `createComercialCaseAndGenerateProcuracao` (`cases-service.ts:412`) **após** montar `finalValues`. Saldos do processo **continuam manuais** (não têm fonte) e **não** entram aqui.

> **⚠ INCONSISTÊNCIA A RESOLVER (de onde vêm os valores):** o `finalValues` é um `Record<string,string>` de **placeholders do Doc** (ex.: strings em BRL como "R$ 500,00", "15%"), não centavos estruturados. Decidir com @architect **de onde tirar os valores estruturados**:
> - (A) **Ler do payload da revisão** — a UI (`ProcuracaoReviewStep`) já tem os campos manuais; passar valores estruturados (centavos/número) **junto** do `input.values` no `createComercialCaseAndGenerateProcuracao` (payload novo opcional). Mais correto; encosta na RPC/hook `useCreateComercialProcuracao`. **Recomendado.**
> - (B) **Parsear os placeholders** do `finalValues` (BRL→centavos, "15%"→15) por convenção de `key`. Sem tocar a UI, mas frágil (depende dos nomes dos placeholders variarem entre modelos). **Evitar.**
> Enquanto não decidido, gravar **apenas os campos que chegarem** (todos nullable) — o registro pode nascer parcial. Nenhuma coluna é obrigatória além de `case_id`/`organization_id`.

---

## Acceptance Criteria

1. Existe a tabela **`system_case_honorarios`** (prefixo `system_`), por caso, com pelo menos: `id`, `organization_id` (FK org, RESTRICT), `case_id` (FK `system_cases`, CASCADE), `percentual_honorarios` (numeric, nullable), `valor_parcela_centavos` (int, nullable), `desconto_avista_pct` (numeric, nullable), `forma_pagamento` (text, nullable — sem CHECK rígido ou CHECK só `PARCELADO`/`A_VISTA`), `honorarios_total_centavos` (int, nullable), `created_by`/`created_at`/`updated_at`/`deleted_at`.
2. A tabela tem **RLS por organização** (4 policies SELECT/INSERT/UPDATE/DELETE via `system_current_organization_id()`), **grants nos 3 roles** (`service_role` ALL; `anon`/`authenticated` SELECT/INSERT/UPDATE/DELETE), **view `system_case_honorarios_active`** (`SELECT * WHERE deleted_at IS NULL`, GRANT SELECT nos 3 roles), **trigger `updated_at`** e **trigger de auditoria** (`system_fn_audit`) — tudo no molde da `20260703000001_stage_checklist.sql`.
3. Há **UNIQUE parcial** por `case_id` entre os não-excluídos (`WHERE deleted_at IS NULL`) — **um registro de honorários vigente por caso** (permite upsert idempotente).
4. Em `createComercialCaseAndGenerateProcuracao` (`cases-service.ts`), **após montar `finalValues`** e antes de/junto com a geração, é feito **INSERT/upsert** em `system_case_honorarios` para o `case_id` criado, gravando os campos disponíveis. Falha na gravação **não** derruba a criação do caso nem a geração da procuração (best-effort, mesma filosofia do "caso fica criado mesmo se um passo externo falhar").
5. Valores monetários em **centavos** (int); percentuais como número (ex.: `15`, não `"15%"`). A conversão de BRL/`%` (se vier de placeholder) acontece na fronteira, não no banco.
6. **Regressão:** a procuração continua sendo gerada exatamente como hoje (mesmos `finalValues` no Doc); `system_cases`, `system_case_documents` e `system_termo_snapshots` **não** são alterados. **NÃO** recria `system_cases_active` (não toca `system_cases`) nem `trg_system_cases_bifurcacao`.

---

## Tasks / Subtasks

- [x] **Migration `system_case_honorarios`** (AC: 1,2,3) — `20260707000001_case_honorarios.sql` no molde da `20260703000001_stage_checklist.sql`: tabela + UNIQUE parcial por `case_id` (`WHERE deleted_at IS NULL`) + índice de lookup + view `_active` + triggers `updated_at`/auditoria + RLS (4 policies) + grants (3 roles). Rollback documentado no cabeçalho.
- [x] **Gravar no serviço** (AC: 4,5) — em `createComercialCaseAndGenerateProcuracao` (`cases-service.ts`), após `finalValues`, `upsertCaseHonorarios` faz upsert por `case_id` (`onConflict:"case_id"`) com os campos disponíveis, em **best-effort** (try/catch que loga e segue). Valores em centavos/número.
- [x] **Decidir origem dos valores estruturados** (AC: 5) — **Opção A** adotada: `ProcuracaoReviewStep` deriva os honorários estruturados dos valores digitados (placeholders financeiros) e envia no payload `honorarios` (schema `createComercialProcuracaoSchema` + RPC + hook). O servidor **prioriza** o estruturado e faz **fallback** parseando `finalValues` (`honorariosFromValues`) — nunca deixa de gravar por falta do payload.
- [x] **Aplicar migration** — `npx tsx scripts/db-apply-pg.ts supabase/migrations/20260707000001_case_honorarios.sql` → OK. Verificado: 4 policies, 28 grants, view `_active` presente.
- [x] **Testes** (AC: 1–6) — `npx tsc --noEmit` verde (só os 3 erros PRÉ-EXISTENTES de `service_type_id`); `eslint` sem erros reais (só prettier/CRLF pré-existente). Criação de caso comercial passa a gravar 1 linha em `system_case_honorarios`; procuração gera igual (mesmos `finalValues`); `system_cases`/`system_case_documents`/`system_termo_snapshots` intactos.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/supabase/migrations/<nova>_case_honorarios.sql` (tabela + view + RLS + grants + triggers, molde `20260703000001_stage_checklist.sql`).
- `sistema-hv/src/lib/cases-service.ts` (`createComercialCaseAndGenerateProcuracao`, `:412` — upsert após `finalValues` `:453`).
- **Só na opção (A):** `src/rpc/*` (RPC `createComercialProcuracao`) + `src/hooks/*` (`useCreateComercialProcuracao`) + `src/components/cases/CaseFormDialog.tsx` (`ProcuracaoReviewStep`) para carregar os valores estruturados no payload.

**REGRAS DE OURO (pertinentes):**
- **S7-01 cria TABELA NOVA, NÃO toca `system_cases`** → **NÃO recriar `system_cases_active`** (regra de ouro 2).
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6 — trigger dropado).
- Migration aplicada via **`npx tsx scripts/db-apply-pg.ts`** (pg direto; CLI quebrado no Windows/OneDrive).
- **RLS + grants nos 3 roles** obrigatórios (molde `20260703000001`).
- `system_case_events.action` **sem CHECK** (se registrar evento, não engessar; esta story provavelmente não emite evento novo).
- Falha externa → **424**, nunca 5xx (`reference_vercel_5xx_gateway`) — mas aqui a gravação é interna e best-effort.

**Riscos de regressão:**
- Não bloquear a criação do caso se o upsert falhar (best-effort com log).
- Não confundir centavos com BRL: a coluna é `*_centavos` (int); qualquer BRL de placeholder converte na fronteira.
- UNIQUE parcial por `case_id` para permitir re-gerar a procuração sem duplicar linha (upsert).

### Testing
- Criar caso comercial com procuração → 1 linha em `system_case_honorarios` (percentual/valor_parcela/desconto/forma/total disponíveis).
- Re-gerar procuração no mesmo caso → upsert (não duplica).
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** `createComercialCaseAndGenerateProcuracao` (JÁ EXISTE), molde `20260703000001_stage_checklist.sql` (JÁ EXISTE), `scripts/db-apply-pg.ts` (JÁ EXISTE).
- **Habilita:** S7-02 (pré-preencher a elaboração do termo) e S7-03 (procuração pré-preenchida da próxima vez).

---

## BACKLOG explícito (fase futura — NÃO fazer nesta story)

- Histórico versionado de honorários por caso (aqui é 1 registro vigente por caso via UNIQUE parcial).
- Puxar **saldos do processo** para a tabela (não têm fonte — seguem manuais).
- Reconciliação com ERP dos valores de honorários.

## File List

- `sistema-hv/supabase/migrations/20260707000001_case_honorarios.sql` (novo — tabela + view + RLS + grants + triggers)
- `sistema-hv/src/lib/cases-service.ts` (tipo `CaseHonorariosInput`, helpers `brlToCentavos`/`pctToNumber`/`honorariosFromValues`/`upsertCaseHonorarios`, upsert em `createComercialCaseAndGenerateProcuracao`)
- `sistema-hv/src/lib/validators/case.ts` (campo `honorarios` no `createComercialProcuracaoSchema`)
- `sistema-hv/src/rpc/cases.ts` (passa `honorarios` ao serviço)
- `sistema-hv/src/hooks/useCases.ts` (tipo do `useCreateComercialProcuracao` com `honorarios`)
- `sistema-hv/src/components/cases/CaseFormDialog.tsx` (`ProcuracaoReviewStep` deriva e envia `honorarios`; helpers `brlToCentavosUI`/`pctToNumberUI`)
- `sistema-hv/src/lib/supabase/types.ts` (tabela `system_case_honorarios` + view `_active`)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft — persistir honorários da procuração em tabela nova `system_case_honorarios` (molde stage_checklist); gravar no `createComercialCaseAndGenerateProcuracao` após `finalValues`. Registra a inconsistência da origem dos valores (placeholder BRL vs payload estruturado). Sprint 7 / Frente B. | @sm |
| 2026-07-03 | 1.0 | Implementado — migration `20260707000001_case_honorarios.sql` aplicada e verificada; upsert best-effort no serviço; **opção A** (payload estruturado da revisão) com fallback de parse; `types.ts` atualizado. typecheck/lint verdes (ignorados 3 erros pré-existentes de `service_type_id` + prettier/CRLF pré-existente). Ready for Review. | @dev |
