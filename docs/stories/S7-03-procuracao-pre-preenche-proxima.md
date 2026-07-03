# Story S7-03 (opcional/incremental): Procuração também pré-preenche os financeiros da próxima vez

- **Sprint:** 7 — Termo puxando do histórico (preencher o mínimo) `[Frente B]`
- **ID:** S7-03
- **Status:** Deferred / Backlog `(OPCIONAL — NÃO implementada na Sprint 7; aguarda decisão A/B do owner)`

> **NOTA @dev (2026-07-03):** Por instrução, esta story NÃO foi implementada nesta rodada. Fica registrada como **futuro**. Bloqueio de decisão pendente: **fonte dos honorários** — (A) último caso do mesmo cliente com registro em `system_case_honorarios` (query por `client_id` → caso mais recente com linha) vs (B) só o mesmo caso. O texto do owner sugere **(A)**. Base já pronta: `system_case_honorarios` (S7-01) persiste `percentual_honorarios`/`valor_parcela_centavos`/`desconto_avista_pct` por caso; `getCaseHonorarios(caseId)` já existe e pode ser generalizado para busca por cliente. Nenhuma migration necessária (só leitura + extensão de `resolveAutoValue`/`AutoFillData`).
- **Estimativa relativa:** S/M (estender `resolveAutoValue`/autofill p/ reconhecer campos financeiros e resolvê-los de `system_case_honorarios` quando existir). **Provável SEM migration.**
- **Executor sugerido:** @dev · Quality gate: @architect

---

## Story

**Como** operador que cria um **novo** caso comercial para um cliente que já tem honorários registrados,
**quero** que a revisão da procuração já venha com os campos financeiros (percentual, valor da parcela, desconto à vista) **pré-preenchidos** a partir de `system_case_honorarios`,
**para que** eu não redigite os mesmos valores toda vez — fechando o ciclo "persistir → reaproveitar" iniciado na S7-01.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (autofill):** `src/lib/cases/document-autofill.ts` — `resolveAutoValue(field, data)` resolve placeholders por `auto_field` e por heurística de `key`/`label`, mas **só dados cadastrais** (nome, CPF, município, CRM, OAB…). **Nenhum campo financeiro** hoje: percentual/parcela/desconto caem em `source:"manual"` e são digitados no `ProcuracaoReviewStep`.
- **JÁ EXISTE (montagem dos values):** `buildAutoFillFromClient` + `buildAutoFillValues` (`document-autofill.ts:104/144`) e o preview de procuração (`cases-service.ts:386`) montam `values` a partir do `AutoFillData`. O `AutoFillData` (`document-autofill.ts:16`) **não tem** campos financeiros.
- **NOVO (fonte da S7-01):** `system_case_honorarios` guarda `percentual_honorarios`, `valor_parcela_centavos`, `desconto_avista_pct` por caso.
- **NOVO nesta story:**
  1. Estender `AutoFillData` com campos financeiros opcionais (ex.: `percentualHonorarios`, `valorParcelaCentavos`, `descontoAvistaPct`).
  2. Estender `resolveAutoValue` (via `auto_field` e/ou heurística de `key`) para reconhecer placeholders financeiros (ex.: `<percentual_honorarios>`, `<valor_parcela>`, `<desconto_avista>`) e resolvê-los desses dados, formatando (centavos→BRL, número→"X%").
  3. Alimentar o `AutoFillData` com os valores de `system_case_honorarios` **quando existir** para o cliente/caso — na trilha do preview/servidor da procuração.

> **⚠ DECISÃO/INCONSISTÊNCIA — de qual caso puxar:** `system_case_honorarios` é **por caso**. Num **novo** caso do mesmo cliente ainda não há registro. Decidir com @architect a fonte:
> - (A) Puxar do **último caso do mesmo cliente** que tenha honorários (query por `client_id` → caso mais recente com linha em `system_case_honorarios`). Reaproveita entre casos. **Provável intenção do owner** ("procuração de um novo caso do mesmo cliente já vem preenchida").
> - (B) Só reaproveitar **dentro do mesmo caso** (edição/re-geração). Mais restrito.
> Marcar como **incremental** e confirmar (A vs B) antes de codar. O texto do owner sugere **(A)**.

> **DECISÃO DO OWNER (contexto):** este é o passo que fecha o ciclo — "assim a própria procuração de um novo caso do mesmo cliente já vem preenchida". Marcado como **incremental**: entrega valor mas não bloqueia S7-01/S7-02.

---

## Acceptance Criteria

1. `AutoFillData` passa a suportar campos financeiros opcionais (percentual, valor parcela em centavos, desconto à vista); `resolveAutoValue` resolve placeholders financeiros por `auto_field` (ex.: `percentual_honorarios`, `valor_parcela`, `desconto_avista`) e/ou heurística de `key`, formatando corretamente (BRL / "%").
2. No fluxo de **preview/geração da procuração**, quando existe honorário registrado (fonte conforme decisão A/B), os campos financeiros do modelo vêm **pré-preenchidos** na revisão (`ProcuracaoReviewStep`), continuando **editáveis** (o usuário pode sobrescrever).
3. Quando **não há** honorário registrado para a fonte escolhida, os campos financeiros ficam **vazios/manuais** exatamente como hoje (nenhuma regressão para clientes novos).
4. Modelos de procuração **sem** placeholders financeiros continuam funcionando idênticos (a extensão é aditiva; não força campos novos).
5. **SEM migration** (só leitura de `system_case_honorarios` + lógica de autofill). **NÃO** toca `system_cases` → não recria view/trigger.
6. **Ciclo fechado:** um caso criado com honorários (S7-01) → novo caso do mesmo cliente → procuração já sugere os mesmos financeiros (se decisão A).

---

## Tasks / Subtasks

- [ ] **Decidir a fonte (A vs B)** (AC: 2,6) — com @architect: último caso do cliente com honorários (A) vs só o mesmo caso (B). Owner sugere (A).
- [ ] **Estender autofill** (AC: 1) — `AutoFillData` + `resolveAutoValue` (`document-autofill.ts`) reconhecem placeholders financeiros; formatação centavos→BRL e número→"%".
- [ ] **Alimentar os values** (AC: 2,3) — na trilha de preview/servidor da procuração (`cases-service.ts` ~`:386`/`buildAutoFillFromClient`), buscar `system_case_honorarios` (fonte A/B) e injetar no `AutoFillData` quando existir; senão, nada muda.
- [ ] **Testes** (AC: 1–6) — `npm run typecheck` / `npm run lint` verdes; cliente com honorário → procuração pré-preenche financeiros; cliente novo → vazio como hoje; modelo sem placeholders financeiros → intacto.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases/document-autofill.ts` (`AutoFillData` + `resolveAutoValue` para campos financeiros; formatação).
- `sistema-hv/src/lib/cases-service.ts` (preview/servidor da procuração ~`:386` — buscar `system_case_honorarios` e alimentar `AutoFillData`).
- (reuso) `src/components/cases/CaseFormDialog.tsx` (`ProcuracaoReviewStep`) — só se herda os valores automaticamente via preview (idealmente nenhuma mudança de UI).

**REGRAS DE OURO (pertinentes):**
- **NÃO toca `system_cases`** → **NÃO recriar `system_cases_active`** (regra de ouro 2). Só leitura de `system_case_honorarios`.
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- **SEM migration**.
- Erro de dependência externa → **424**, nunca 5xx (`reference_vercel_5xx_gateway`).

**Riscos de regressão:**
- A extensão do autofill deve ser **aditiva**: nunca preencher um placeholder que não existe no modelo; nunca sobrescrever valor manual já digitado (prioridade do usuário, como em `finalValues = { ...serverAuto, ...input.values }`).
- Formatação: percentual como "15%" e valor de parcela em BRL — casar com o que o placeholder espera no Doc.
- Cliente novo (sem honorário) não pode quebrar nem forçar campo.

### Testing
- Cliente com honorário registrado → novo caso → procuração pré-preenche % / parcela / desconto (editáveis).
- Cliente sem registro → campos vazios/manuais (como hoje).
- Modelo sem placeholders financeiros → sem efeito. `typecheck`/`lint` verdes.

---

## Dependências

- **Depende de:** **S7-01** (dados em `system_case_honorarios`). Independe de S7-02 (mas costuma vir depois).
- **Habilita:** ciclo "persistir → reaproveitar" completo na própria procuração.

---

## BACKLOG explícito (fase futura — NÃO fazer nesta story)

- Escolher **qual** caso-fonte via UI (aqui é regra fixa A/B).
- Versão/curadoria dos honorários entre casos (aqui pega o mais recente).

## File List

- `sistema-hv/src/lib/cases/document-autofill.ts` (autofill financeiro)
- `sistema-hv/src/lib/cases-service.ts` (alimentar AutoFillData de `system_case_honorarios`)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft (OPCIONAL/incremental) — estender autofill p/ campos financeiros resolvidos de `system_case_honorarios`, pré-preenchendo a procuração de novos casos. Registra a decisão A/B da fonte (último caso do cliente vs mesmo caso). Sem migration. Sprint 7 / Frente B. | @sm |
