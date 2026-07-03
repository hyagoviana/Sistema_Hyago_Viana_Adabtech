# Story S9-09: Botões "Enviar procuração" / "Enviar caso (contrato)" no detalhe (lead E cliente) — fluxo contrato análogo ao da procuração

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-09
- **Status:** Draft
- **Estimativa relativa:** M/G (2 ações no detalhe; o fluxo do contrato — revisão → envio — espelha o da procuração; degrada 424 sem template)
- **Executor sugerido:** @dev (UI + wiring) · Quality gate: @architect / @ux-design-expert

---

## Story

**Como** operador,
**quero** botões **"Enviar procuração"** (comercial) e **"Enviar caso (contrato)"** (operacional) no detalhe do caso/pessoa — disponíveis tanto para lead quanto para cliente —,
**para que** eu dispare cada documento no momento certo do fluxo: procuração para avançar o comercial (segue LEAD) e contrato para promover a CLIENTE.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (fluxo procuração revisão→envio):** `cases-service.ts:createComercialCaseAndGenerateProcuracao` (`:502-579`) gera a procuração com valores revisados e finaliza na pasta do caso; o **envio ao ZapSign é ação separada** (aba Documentos), via `sendCaseDocumentToZapsign`. RPCs em `src/rpc/cases.ts` (`previewProcuracaoFn`, `createComercialProcuracaoFn`, `liberarCasoFn`, `promoverCasoManualFn`) e `src/rpc/case-documents.ts` (`sendCaseDocumentToZapsignFn`). CaseFormDialog já faz o fluxo de 2 etapas (revisão → envio) da procuração (memória `project_procuracao_revisao_envio`).
- **JÁ EXISTE (geração/envio contrato):** `generateContratoFromTemplate` + `sendCaseDocumentToZapsign` com `doc_kind='contrato'` (S9-02).
- **JÁ EXISTE (detalhe do caso/pessoa):** `casos.$id.tsx` (detalhe do caso, aba Documentos), `clientes.$id`/detalhe da pessoa, `ClientCasesSection.tsx`.
- **NOVO:** dois botões/ações no detalhe: **"Enviar procuração"** (gera/reaproveita a procuração do caso → revisão → envia ao ZapSign; efeito na assinatura = comercial via S9-05); **"Enviar caso (contrato)"** (gera/reaproveita o contrato `doc_kind='contrato'` → revisão → envia; efeito na assinatura = operacional via S9-05). Ambos visíveis para lead e cliente (o modelo permite N casos por pessoa). **Degrada 424** se o template (procuração ou contrato) não existir.

> **DECISÃO (recomendada):** reusar o **mesmo padrão de 2 etapas** (revisão → envio) que a procuração já tem. O "Enviar caso (contrato)" é o análogo: preview/edição dos campos do contrato → finaliza PDF na pasta do caso → `sendCaseDocumentToZapsign` (`doc_kind='contrato'`). Onde não houver template puro de contrato, o botão fica visível mas a ação **degrada 424** com mensagem "Modelo de contrato ainda não cadastrado" (não quebra a tela). Disponibilidade dos botões por caso (não bloquear por lifecycle): procuração faz sentido enquanto LEAD/comercial; contrato faz sentido para fechar. **Confirmar com o owner se "Enviar caso" deve ficar desabilitado antes da procuração assinada** (sugestão: habilitado sempre, com aviso se procuração ainda não assinada).

---

## Acceptance Criteria

1. No detalhe do caso (e, onde fizer sentido, no detalhe da pessoa por caso), há a ação **"Enviar procuração"**: gera/reaproveita a procuração do caso, permite revisão, e envia ao ZapSign (`sendCaseDocumentToZapsign`, `doc_kind='procuracao'`). O envio carimba `aguardando_assinatura_at` (comportamento existente) e, ao assinar (S9-05), o caso **segue LEAD** (procuração assinada).
2. Há a ação **"Enviar caso (contrato)"**: gera/reaproveita o contrato (`generateContratoFromTemplate`, S9-02), permite revisão (análogo à procuração), e envia ao ZapSign (`doc_kind='contrato'`). Ao assinar (S9-05), o caso vira **CLIENTE** (contrato assinado).
3. **Degradação 424:** se o template de procuração ou de contrato não existir/estiver ausente, a ação mostra erro claro ("Modelo … ainda não cadastrado") sem 5xx e sem alterar o caso indevidamente.
4. As ações aparecem para **lead E cliente** (não bloqueadas por lifecycle) — coerente com 1 pessoa → N casos. (Regra fina de habilitação/aviso a confirmar com o owner.)
5. RPCs usadas passam por `requireAuth` (login-only). Estados de loading/erro/sucesso (toasts) coerentes com o resto do app.
6. `npm run typecheck` / `npm run lint` verdes (só os 3 erros pré-existentes de `service_type_id`). Sem regressão no fluxo atual da procuração.

---

## Tasks / Subtasks

- [ ] **Ação "Enviar procuração"** (AC: 1) — botão no detalhe; reusa/gera a procuração + revisão + `sendCaseDocumentToZapsignFn`. (Grande parte já existe na aba Documentos/CaseFormDialog — expor/consolidar no detalhe.)
- [ ] **Ação "Enviar caso (contrato)"** (AC: 2, 3) — botão análogo; wiring com `generateContratoFromTemplate` (S9-02) + revisão + `sendCaseDocumentToZapsign` (`doc_kind='contrato'`); degrada 424 sem template.
- [ ] **Seleção de template de contrato** (AC: 2, 3) — UI para escolher o template de contrato (reusa o mecanismo da procuração); se nenhum, degrada 424 com mensagem.
- [ ] **Disponibilidade lead/cliente** (AC: 4) — mostrar ambos para lead e cliente; aviso opcional se procuração ainda não assinada (confirmar regra com owner).
- [ ] **Estados/UX** (AC: 5) — loading/erro/sucesso; toasts; reuso dos componentes de diálogo.
- [ ] **Testes** (AC: 6) — enviar procuração (fluxo existente intacto); enviar contrato (gera+envia); sem template → 424; botões visíveis p/ lead e cliente; typecheck/lint.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/casos.$id.tsx` (detalhe do caso — botões/ações).
- `sistema-hv/src/components/cases/ClientCasesSection.tsx` e/ou detalhe da pessoa (ações por caso).
- `sistema-hv/src/components/cases/CaseFormDialog.tsx` (reuso do fluxo de revisão da procuração como molde para o contrato).
- `sistema-hv/src/rpc/cases.ts` / `src/rpc/case-documents.ts` (RPCs de gerar contrato + enviar — reuso de `sendCaseDocumentToZapsignFn`).
- Novo componente de diálogo de revisão do contrato (espelho do da procuração), se necessário.

**REGRAS DE OURO (pertinentes):**
- **UI + wiring** — **NÃO** cria migration; **NÃO** toca `system_cases`; **NÃO** recria view/trigger.
- **Degradação 424** (não 5xx) — memória `reference_vercel_5xx_gateway`; espelhar o termo/S6-04 e a S9-02.
- Escrita de lifecycle/carimbos é **server-side** (regra de ouro 7) — a UI só chama RPCs; o efeito "assinado → LEAD/CLIENTE" vem do webhook (S9-05), não do envio.
- **Gotcha TanStack** (memória) se criar rota/aba nova.

**Riscos de regressão:**
- **Não** duplicar/quebrar o fluxo atual da procuração (revisão→envio) que já está em produção — reusar, não reescrever.
- O envio da procuração carimba `aguardando_assinatura_at`; o envio do contrato **não** deve carimbar isso (S9-02 garante o isolamento do ramo de procuração em `sendCaseDocumentToZapsign`).
- Não condicionar "Enviar caso" a lifecycle de forma que impeça o fluxo (o owner quer flexibilidade N casos/pessoa) — preferir aviso a bloqueio.

### Testing
- Detalhe de um caso LEAD → "Enviar procuração" → doc enviado; (após assinar via S9-05) segue LEAD.
- Mesmo caso → "Enviar caso (contrato)" → contrato gerado+enviado; (após assinar) vira CLIENTE.
- Sem template de contrato → 424 com mensagem; caso intacto.
- Botões visíveis tanto no detalhe de lead quanto de cliente.

---

## Dependências

- **Depende de:** S9-02 (`doc_kind='contrato'` + `generateContratoFromTemplate` + degradação 424), S9-05 (efeito da assinatura por doc_kind). Reusa o fluxo de revisão/envio da procuração (JÁ EXISTE).
- **Habilita:** jornada ponta-a-ponta pela UI (procuração → comercial; contrato → CLIENTE).
- **Aguarda input do owner:** **modelo PURO de contrato** (senão "Enviar caso" degrada 424). Regra fina de habilitação dos botões.

---

## Test cases (Matriz de Testes Mínimos)

- Caso próprio: **duas ações no detalhe** (procuração/comercial e contrato/operacional) + **degradação 424** + **visível p/ lead e cliente**. Fecha a jornada de UI do modelo novo.

---

## File List

- `sistema-hv/src/routes/casos.$id.tsx` (ações no detalhe)
- `sistema-hv/src/components/cases/ClientCasesSection.tsx` (ações por caso)
- `sistema-hv/src/components/cases/CaseFormDialog.tsx` (molde do fluxo de revisão)
- `sistema-hv/src/rpc/cases.ts` / `src/rpc/case-documents.ts` (RPCs)
- Componente de diálogo de revisão do contrato (novo, se necessário)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft inicial — botões "Enviar procuração"/"Enviar caso (contrato)" no detalhe (Sprint 9) | @sm |
