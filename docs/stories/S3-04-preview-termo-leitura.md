# Story S3-04: (Se couber) Ligar preview do termo em modo LEITURA

- **Sprint:** 3 — Estrutura do funil financeiro (SEM termo completo)
- **ID:** S3-04 (OPCIONAL / "se couber" — última da Sprint 3)
- **Status:** Ready for Review
- **Estimativa relativa:** S/M (pequena — só exibir o snapshot existente em leitura; SEM calculadora/regra)
- **Executor sugerido:** @dev (front) · Quality gate: @architect

---

## Story

**Como** operador do financeiro,
**quero** abrir o **preview de um termo já existente** em modo leitura,
**para que** eu consiga visualizar o snapshot sem que a tela quebre — **sem** implementar calculadora, parcial/complementar ou % de êxito (BACKLOG).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (schema — NÃO mexer):** `system_termo_snapshots` (`20260608000007_s17_termo.sql`) — snapshot imutável com cálculo em centavos, workflow (`status`), PDF (`drive_file_id`/`drive_url`), imutabilidade por trigger, RLS + grants + view `system_termo_snapshots_active`. **Esta rodada NÃO altera esse schema** — só leitura no preview.
- **JÁ EXISTE (bug de UX):** a rota `sistema-hv/src/routes/casos.$id.termo.tsx` é hoje um **`StubPage`** ("Termo de Acerto · Versão 3 · Vigente · FIES ESF.") — **não** renderiza o termo real; por isso o "preview falha". `casos.$id.termo.elaborar.tsx` é a elaboração (fora de escopo — BACKLOG).
- **NOVO (só leitura):** substituir o stub por um preview **read-only** que busca o snapshot vigente do caso em `system_termo_snapshots_active` e exibe os campos (valores em centavos formatados, status, parcelas, forma de pagamento) e/ou o PDF (`drive_url`) quando houver. **Sem** ação de cálculo/edição.

> **DECISÃO TRAVADA (owner):** **NÃO** implementar o termo completo nesta rodada — calculadora (centavos), parcial/complementar, % de honorário de êxito, geração/edição do snapshot → **BACKLOG (B-01)**. Esta story **só liga o preview de leitura** de termos que **já existem**. Ação de cálculo/edição permanece **desabilitada/BACKLOG visível**.

> **"SE COUBER":** é a última story da Sprint 3 e a de **menor prioridade**. Se o tempo apertar, pode ser **cortada** sem afetar o objetivo central da sprint (funil fin editável + gates + persistência). Não bloqueia nenhuma outra story.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S3-04)

1. Abrir o preview de um termo **existente** renderiza **sem erro** (substitui o `StubPage`): mostra os dados do snapshot vigente do caso (valores formatados a partir dos centavos, status, parcelas, forma de pagamento) e/ou o PDF (`drive_url`) quando houver.
2. Ação de **cálculo/edição** do termo permanece **fora de escopo** — desabilitada com indicação de **BACKLOG** visível (ex.: botão desabilitado + tooltip "em breve"), **não** um erro.
3. Caso **sem** termo → estado vazio amigável ("Nenhum termo gerado para este caso"), **não** um erro/stack.
4. **Regressão:** o schema de `system_termo_snapshots` **não é alterado**; a imutabilidade (trigger) e os grants permanecem intactos (esta story é **só leitura**).

---

## Tasks / Subtasks

- [x] **Serviço/leitura** (AC: 1,3) — **reuso**: `listTermos(caseId)` (`termo-service.ts:96`) já lê `system_termo_snapshots` ordenado por `version` desc (SELECT-only). O vigente = `[0]`. Não foi preciso criar `getTermoVigente`.
- [x] **RPC + hook** (AC: 1) — **reuso**: `listTermosFn` (`rpc/termo.ts`) + `useTermos` (`hooks/useTermo.ts`), apenas SELECT.
- [x] **UI — preview read-only** (AC: 1,2,3) — `StubPage` substituído em `casos.$id.termo.tsx`:
  - [x] Renderiza campos do snapshot vigente (centavos → `R$`; status; qtd/valor parcelas; forma de pagamento; à vista; tipo).
  - [x] Se `drive_url` presente, botão "Abrir PDF" (link externo).
  - [x] Estado vazio amigável quando não há termo ("Nenhum termo gerado para este caso").
  - [x] Botão de edição/recálculo **desabilitado** com marca "em breve" (BACKLOG) — sem chamar regra de cálculo.
  - [x] Breadcrumb `Casos / Termo` (mínimo para não quebrar; título por nome é da S4-06).
- [x] **Testes** (AC: 1-4) — preview renderiza (com/sem termo); **nenhuma mutação** de `system_termo_snapshots` (só `useTermos` SELECT); `npx tsc --noEmit` (3 erros PRÉ-EXISTENTES) / `npm run lint` verdes.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/casos.$id.termo.tsx` (`StubPage` → preview read-only).
- `sistema-hv/src/lib/` (leitura `getTermoVigente` — novo serviço ou em `cases-service.ts`).
- `sistema-hv/src/rpc/` (fn de leitura) + `sistema-hv/src/hooks/` (`useTermoVigente`).

**Regras de ouro repetidas (pertinentes):**
- **NÃO alterar** o schema de `system_termo_snapshots` (regra de ouro 1 — só estender/ler o que já existe). **Sem migration** nesta story.
- Como não há migration de `system_cases`, **NÃO recriar `system_cases_active`**.
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- Erros de dependência externa (ex.: Drive ao abrir PDF) → **424**, nunca 5xx (`reference_vercel_5xx_gateway`) — mensagem legível no front.

**Escopo travado (BACKLOG B-01):**
- Calculadora (centavos), parcial/complementar, preview COMPLETO com geração, honorário de êxito % → **BACKLOG**. Esta story **só** liga o preview de **leitura** de termos que já existem.

**Riscos de regressão:**
- Não disparar nenhuma mutação/edição do snapshot (a imutabilidade por trigger rejeitaria; e está fora de escopo). Só SELECT.

### Testing
- Caso com termo → preview renderiza (campos + PDF se houver), sem erro.
- Caso sem termo → estado vazio amigável.
- Botões de cálculo/edição desabilitados (BACKLOG), sem acionar regra.
- Nenhuma alteração em `system_termo_snapshots` (só leitura).
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- Sem caso dedicado na Matriz (é "se couber"). É um conserto de UX de leitura; não altera schema nem invariantes cobertas pela Matriz.

---

## Dependências

- **Depende de:** `system_termo_snapshots` (JÁ EXISTE). Não bloqueia nem é bloqueada por S3-01/02/03 (pode ir por último ou ser cortada).
- **Habilita:** nada nesta rodada (o termo completo é BACKLOG B-01).

---

## File List

- `sistema-hv/src/routes/casos.$id.termo.tsx` (`StubPage` → preview read-only) — **único arquivo alterado**
- (reuso, sem mudança) `sistema-hv/src/hooks/useTermo.ts` (`useTermos`), `sistema-hv/src/rpc/termo.ts` (`listTermosFn`), `sistema-hv/src/lib/termo-service.ts` (`listTermos`)

**Nota:** o `TermoPanel` completo (calculadora/parcelas/workflow) já existia na ficha do caso; esta story só corrige o **StubPage da rota `.../termo`**. Sem migration.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 (Sprint 3) — preview do termo SÓ leitura (termo completo = BACKLOG B-01) | @sm |
| 2026-07-02 | 1.0 | Rota termo agora renderiza o snapshot vigente em leitura (reuso `useTermos`); estado vazio; edição desabilitada (BACKLOG). Ready for Review. | @dev |
