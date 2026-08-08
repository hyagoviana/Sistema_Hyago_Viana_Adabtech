# Story M5: Campo do identificador do processo no ProJuris (aba Judicial)

**Épico:** Reunião 2026-08-07 — Melhorias até segunda
**ID:** M5
**Status:** Ready for Review
**Estimativa relativa:** S/M
**Executor sugerido:** @dev (UI de edição + persistência) · Quality gate: @qa
**Risco:** BAIXO — a coluna de vínculo JÁ EXISTE (G1). Esta story é só a UI de preencher/editar manualmente + um RPC de escrita gate-ado. Nenhuma DDL nova.

---

## Story

**Como** controladoria/advogado que abre a aba **Judicial** de um caso,
**quero** um campo onde eu **preencho manualmente** o identificador do processo no ProJuris (ex.: `PRO.0007713`),
**para** casar o caso do sistema ↔ ProJuris (os ~400 casos importados podem ter judicial) e destravar o espelho de leitura da G1 (resumo do processo + tarefas + andamentos).

Hoje a aba Judicial (`casos.$id.judicial.tsx`, G1) já mostra o espelho **quando há vínculo**, mas o vínculo (`system_cases.projuris_codigo_processo` / `projuris_numero_processo`) só é preenchido "pela controladoria/importação" — **não existe UI para digitá-lo**. Quando o caso não tem vínculo, a página mostra o estado vazio "Nenhum processo ProJuris vinculado a este caso" e não há como sair desse estado pela tela. M5 fecha esse buraco.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE (reusar — NÃO reconstruir)

- **Vínculo já modelado (G1).** Migration `sistema-hv/supabase/migrations/20260806000006_case_judicial_espelho.sql` já criou em `system_cases`:
  - `projuris_codigo_processo BIGINT` (o **código interno** do processo no ProJuris, usado pelo `syncCaseJudicial` para os `projurisGet`);
  - `projuris_numero_processo TEXT` (o **nº judicial** ex.: `0733583-07.2026.8.07.0016`);
  - índice parcial `idx_system_cases_projuris_cod_proc`.
  - **CONFIRMADO no código:** as duas colunas existem e já são LIDAS no RPC `getCaseJudicialFn` (`sistema-hv/src/rpc/judicial.ts:49`) e no service de sync. **Nenhuma DDL nova é necessária.**
- **Aba Judicial (UI).** `sistema-hv/src/routes/casos.$id.judicial.tsx` — quadro-resumo (tribunal/nº/fase), lista de tarefas, botão "Atualizar do ProJuris", modal de andamentos. Tem o bloco de **estado vazio** (`!judicial?.vinculado`, `:129-138`) onde entra o campo de preencher.
- **Leitura do espelho + status.** RPC `getCaseJudicialFn` retorna `{ vinculado, codigoProcesso, numeroProcesso, processo, tarefas }`. Hook `useCaseJudicial` (`sistema-hv/src/hooks/useJudicial.ts:13`).
- **Sync (leitura ProJuris → espelho).** `syncCaseJudicial(caseId)` em `sistema-hv/src/lib/projuris/judicial-sync.ts` já lê `projuris_codigo_processo` do caso e popula o espelho. Depois de gravar o vínculo, o mesmo botão "Atualizar do ProJuris" da G1 puxa tudo.
- **Gate por-caso (G4).** `requireJudicial(caseId)` (`sistema-hv/src/lib/judicial-authz.ts`) — todos os RPCs de judicial passam por ele (admin sempre; caso não-sigiloso → todos; sigiloso → só autorizados). Hook de UI `usePodeVerJudicial` (`sistema-hv/src/hooks/usePodeVerJudicial.ts`) já gate-ia a aba.
- **Padrão de RPC de escrita gate-ado + `handle()`** já no arquivo `rpc/judicial.ts` (o `handle` mapeia `AuthError`/`JudicialSyncError` → status HTTP).

### NOVO nesta story

1. **RPC de escrita** `setCaseProjurisLinkFn` (POST) em `sistema-hv/src/rpc/judicial.ts`: recebe `{ caseId, codigoProcesso, numeroProcesso }`, passa por `requireJudicial(caseId)` **e** por um gate de **edição** (só quem pode editar o judicial — ver Dev Notes sobre qual módulo), e grava as duas colunas em `system_cases` via `getSupabaseAdmin()`. Aceita limpar o vínculo (valores vazios → `NULL`).
2. **Hook** `useSetCaseProjurisLink(caseId)` em `useJudicial.ts` (mutation) que invalida `["case-judicial", caseId]` no sucesso.
3. **UI de edição na aba Judicial** (`casos.$id.judicial.tsx`):
   - No **estado vazio** (sem vínculo): um bloco "Vincular ao ProJuris" com os dois inputs (código + nº do processo) e botão **Salvar vínculo**. Ao salvar, a página passa a mostrar o espelho (e o usuário clica "Atualizar do ProJuris").
   - No **estado vinculado**: um botão/entrada discreta "Editar vínculo ProJuris" (ex.: lápis ao lado do "Nº do processo" no quadro-resumo, ou no header) que abre o mesmo mini-form pré-preenchido, permitindo corrigir/limpar.
   - Máscara/hint: o `codigoProcesso` é numérico (BIGINT); o identificador amigável (`PRO.0007713`) e o nº judicial vão no campo TEXT `numeroProcesso`. Ver Dev Notes (D-M5) sobre qual campo recebe o `PRO.xxxx`.

---

## Decisão de design (D-M5) — o que é "PRO.0007713"?

**Travar antes de codar (SPIKE curto @architect/@dev):** o pedido do owner fala em preencher "o identificador do processo no ProJuris (ex.: `PRO.0007713`)". Precisamos mapear esse identificador amigável às DUAS colunas existentes:

- `projuris_codigo_processo` (BIGINT) = o **código interno** que o `syncCaseJudicial` usa nas chamadas `GET /adv-service/processo/{codigoProcesso}/...`. É um número puro.
- `projuris_numero_processo` (TEXT) = o **nº judicial CNJ** (ex.: `0733583-07.2026.8.07.0016`), livre.

`PRO.0007713` parece um **identificador de exibição** do ProJuris (não o código numérico da API nem o CNJ). Opções:
- **(A) recomendada p/ o MVP:** dois campos no form — "Código do processo (ProJuris)" → `projuris_codigo_processo` (aceita só dígitos; de `PRO.0007713`, extrai `7713`) e "Nº do processo (CNJ)" → `projuris_numero_processo`. Guardar o `PRO.xxxx` cru também é útil: pode ir no `numero_processo`/`raw` ou num campo de exibição. Confirmar com o Thiago se o número após o `PRO.` corresponde ao `codigoProcesso` da API (o caso-teste da reunião: `0733583-07.2026.8.07.0016` = identificador `PRO.0007713`).
- **(B)** só um campo "Identificador ProJuris" (`PRO.0007713`) + resolver o `codigoProcesso` numérico via consulta ProJuris — **fora do escopo** desta story (depende de endpoint de busca por identificador; deixar p/ o motor).

**Escopo M5 = opção A**: campos manuais que gravam as colunas existentes. Se o Thiago confirmar que `PRO.0007713` → `codigoProcesso=7713`, o input pode aceitar tanto `PRO.0007713` quanto `7713` e normalizar (strip do prefixo `PRO.` + zeros à esquerda → BIGINT).

---

## Acceptance Criteria

1. **Campo manual de vínculo na aba Judicial.** Na aba Judicial do caso existe uma UI para **digitar e salvar** o identificador do processo no ProJuris. No estado sem vínculo, aparece um bloco "Vincular ao ProJuris" com os campos; no estado vinculado, há como **editar** o vínculo já salvo.
2. **Persiste nas colunas existentes.** Salvar grava `system_cases.projuris_codigo_processo` (numérico) e/ou `projuris_numero_processo` (texto/CNJ). Nenhuma coluna nova é criada (a G1 já as tem).
3. **Aceita `PRO.xxxx` e número puro.** O input do código aceita o identificador amigável (`PRO.0007713`) OU o número puro (`7713`) e normaliza para BIGINT (strip `PRO.` + zeros à esquerda). O nº CNJ é texto livre. (D-M5 opção A.)
4. **Destrava o espelho.** Após salvar um `codigoProcesso` válido, a página deixa de mostrar o estado vazio e o botão "Atualizar do ProJuris" (G1) passa a popular o resumo/tarefas/andamentos. Limpar o vínculo (campos vazios) volta ao estado vazio.
5. **Gate de escrita no SERVIDOR.** O RPC de gravação passa por `requireJudicial(caseId)` **e** por um gate de edição (quem não pode editar recebe 403 mesmo chamando o RPC direto). A UI de edição só aparece para quem pode editar; a de leitura respeita o sigilo (G4) como já é hoje.
6. **Regressão / gates.** `npm run typecheck` + `npm run lint` limpos. Nenhuma migration (dev=prod sem DDL). O estado vazio e o espelho da G1 continuam funcionando; as sub-rotas do caso continuam resolvendo. `types.ts` NÃO precisa mudar (colunas já existem/geradas na G1).

---

## Tasks / Subtasks

### T0 — SPIKE D-M5 (@architect/@dev, curto)
- [x] Decisão do owner aplicada: `PRO.0007713` = identificador INTERNO do ProJuris → grava em `projuris_codigo_processo` (BIGINT). Normalização no servidor: `String(raw).replace(/\D/g,"").replace(/^0+/,"")` (strip `PRO.`/não-dígitos/zeros à esquerda) → `7713`. Aceita `PRO.0007713` OU número puro. (Confirmação numérica final com o Thiago segue recomendada, mas o mapeamento de coluna está travado pelo owner.) (AC-3)

### T1 — RPC de escrita gate-ado (@dev)
- [x] `setCaseProjurisLinkFn` (POST) em `sistema-hv/src/rpc/judicial.ts`: `{ caseId, codigoProcesso, numeroProcesso }`; `requireJudicial(caseId)` (sigilo/G4) + `requireModule("controladoria","edit")` (edição); `UPDATE system_cases` via `getSupabaseAdmin()`. Reusa o `handle()`. `normalizeCodigoProcesso` (aceita `PRO.xxxx`/número, valida BIGINT seguro → 422 se inválido). Valores vazios → `NULL` (limpa). Schema Zod defensivo. (AC-1, AC-2, AC-3, AC-5)

### T2 — Hook (@dev)
- [x] `useSetCaseProjurisLink(caseId)` em `sistema-hv/src/hooks/useJudicial.ts` — mutation que invalida `["case-judicial", caseId]`. (AC-4)

### T3 — UI na aba Judicial (@dev)
- [x] `sistema-hv/src/routes/casos.$id.judicial.tsx`:
  - botão "Vincular ao ProJuris" no estado vazio (`!judicial?.vinculado`) abrindo o `ProjurisLinkDialog` (2 inputs + Salvar); (AC-1, AC-4)
  - ação "Editar vínculo" (lápis) no cabeçalho do quadro-resumo no estado vinculado (pré-preenchida; botão "Limpar campos" + salvar vazio limpa); campo "Código ProJuris" exibido no resumo (`PRO.<n>`); (AC-1, AC-4)
  - a UI de edição só aparece se `usePodeEditar("controladoria")`; (AC-5)
  - toasts de sucesso/erro (`sonner`). (AC-1)

### T4 — QA / regressão (@qa)
- [x] `npm run typecheck` verde; `npx eslint` nos 3 arquivos tocados = 0 erros (após `--fix` de prettier). (AC-6)
- [ ] Salvar em caso sem vínculo → espelho aparece; "Atualizar do ProJuris" popula. Limpar → volta ao vazio. (validação manual pendente @qa) (AC-4)
- [ ] Chamar `setCaseProjurisLinkFn` como usuário sem permissão/sem acesso a caso sigiloso → 403 (gate no servidor). (validação manual pendente @qa) (AC-5)
- [x] Nenhuma DDL; `types.ts` inalterado (colunas já geradas na G1). (AC-6)

---

## Dev Notes

- **A coluna JÁ EXISTE (G1).** `20260806000006_case_judicial_espelho.sql` criou `system_cases.projuris_codigo_processo` (BIGINT) + `projuris_numero_processo` (TEXT). **NÃO** criar migration. Esta story é 100% UI de edição + 1 RPC de escrita. Confirmado: as colunas são lidas em `rpc/judicial.ts:49` e no `judicial-sync.ts`.
- **Qual gate de EDIÇÃO usar.** A leitura do judicial usa `requireJudicial` (sigilo, G4) e o RPC de leitura NÃO exige módulo `$`. Para a ESCRITA do vínculo, além de `requireJudicial(caseId)`, aplicar o gate de edição do padrão do projeto — checar `sistema-hv/src/lib/rbac.ts`/`auth-guard.ts` (`requireModule`/`requireAnyModule('edit')`, ver `reference_rbac_edit_gate`). O módulo natural é **controladoria** (o judicial é da controladoria; ver G1 Dev Notes) — confirmar o slug real do módulo em `rbac.ts` antes de codar. Na UI, esconder a edição com o hook equivalente (`usePodeEditar(...)`/`usePodeVerJudicial` para leitura).
- **Normalização `PRO.0007713`.** `projuris_codigo_processo` é BIGINT — de `PRO.0007713`, remover `PRO.` e zeros à esquerda → `7713`. Aceitar também o usuário digitar só o número. Guardar o identificador amigável cru, se útil, no `numero_processo` (texto) ou deixar só o CNJ ali. (D-M5)
- **Não confundir os dois campos:** `codigoProcesso` (número da API, usado no sync) ≠ `numeroProcesso` (CNJ, exibição). O quadro-resumo da G1 mostra `numeroProcesso`; o sync usa `codigoProcesso`.
- **dev = prod, sem migration** (`reference_aplicar_migrations_pg_direto` não se aplica aqui — não há DDL).

**Riscos:**
- **R1 — usuário digita CNJ no campo do código (ou vice-versa)** → sync falha (código inválido). Mitigação: rótulos claros + validação (código = só dígitos; CNJ = máscara/livre) + toast de erro do sync já existe.
- **R2 — gate de edição errado** deixaria um não-autorizado gravar o vínculo. Mitigação: gate no SERVIDOR (não só UI), confirmado por QA (T4).

## Testing

- **UI:** caso sem vínculo → bloco de vincular; salvar `codigoProcesso` → espelho aparece; "Atualizar do ProJuris" popula tarefas/resumo. Editar vínculo já salvo; limpar → estado vazio.
- **Servidor:** `setCaseProjurisLinkFn` grava as 2 colunas; 403 para sem-permissão / caso sigiloso não-autorizado.
- **Gates:** `npm run typecheck` + `npm run lint` limpos; sem DDL.

## Dependências

- **Story G1 (2026-08-05)** — colunas de vínculo + aba Judicial + espelho + `requireJudicial`/G4. Base direta.
- **`sistema-hv/src/lib/rbac.ts` / `auth-guard.ts`** — gate de edição (confirmar módulo/slug).
- **Thiago/ProJuris** — confirmar o mapeamento `PRO.xxxx` ↔ `codigoProcesso` (D-M5); caso-teste `0733583-07.2026.8.07.0016` = `PRO.0007713`.

## File List

**Alterados**
- `sistema-hv/src/rpc/judicial.ts` (novo RPC `setCaseProjurisLinkFn`, gate-ado)
- `sistema-hv/src/hooks/useJudicial.ts` (novo hook `useSetCaseProjurisLink`)
- `sistema-hv/src/routes/casos.$id.judicial.tsx` (UI de vincular/editar)

**Novos**
- (nenhum obrigatório; opcional um mini-componente `JudicialLinkEditor.tsx` se preferir isolar o form)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-07 | v0.1 | Draft inicial | @sm (Bob) |
| 2026-08-08 | v0.2 | Implementado (@dev via Orion). RPC `setCaseProjurisLinkFn` (POST, gate `requireJudicial`+`requireModule("controladoria","edit")`, normaliza `PRO.xxxx`→BIGINT em `projuris_codigo_processo`, CNJ livre em `projuris_numero_processo`, vazio→NULL) em `src/rpc/judicial.ts`; hook `useSetCaseProjurisLink` em `src/hooks/useJudicial.ts`; UI (`ProjurisLinkDialog` + botão "Vincular" no vazio + "Editar vínculo" no resumo + campo "Código ProJuris", gate `usePodeEditar("controladoria")`) em `src/routes/casos.$id.judicial.tsx`. Sem migration; `types.ts` inalterado. Gates: typecheck OK, eslint 0 nos 3 arquivos tocados. | @dev |
