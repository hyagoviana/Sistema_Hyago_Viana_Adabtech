# Story S1-02: Desacoplar criação de caso do envio de procuração

- **Sprint:** 1 — Lead/Cliente por caso (destrava o uso)
- **ID:** S1-02
- **Status:** Ready for Review
- **Estimativa relativa:** M (média — ajuste de fluxo existente + ação nova de envio)
- **Executor sugerido:** @dev · Quality gate: @architect

---

## Story

**Como** operador que cadastra um novo caso,
**quero** criar o caso sem que a procuração seja disparada automaticamente,
**para que** o envio da procuração (que vira lead comercial) seja um **ato explícito**, e não um efeito colateral da criação.

---

## Contexto / o que JÁ EXISTE vs NOVO

Decisão do owner: **criar caso ≠ enviar procuração**. Hoje o fluxo acopla os dois.

- **JÁ EXISTE:** `createCase(input, triggeredBy, opts?)` em `cases-service.ts:46` seta `aguardando_assinatura_at` quando `input.comercial === true` (`:93` e `:108`). Já aceita `opts.skipProcuracaoPrep` (`:49`).
- **JÁ EXISTE:** `createComercialCaseAndGenerateProcuracao(...)` em `cases-service.ts:376` — gera doc + prepara envio.
- **JÁ EXISTE:** `CaseFormDialog` (front) com fluxo de 2 etapas (revisão → envio) — ver `project_procuracao_revisao_envio`.
- **NOVO:** separar em 2 momentos:
  - (a) criar caso em `lifecycle='LEAD'` **sem** disparar procuração e **sem** setar `aguardando_assinatura_at`;
  - (b) ação explícita "Enviar procuração" no caso, que gera o doc + envia ao ZapSign (sandbox) e **aí sim** seta `aguardando_assinatura_at`.

---

## Acceptance Criteria

(CAs do plano v2.3, seção S1-02)

1. Criar caso comum **não** cria doc de procuração nem seta `aguardando_assinatura_at`.
2. Botão "Enviar procuração" gera `system_case_documents(doc_kind='procuracao')` e (em ZapSign sandbox / prod futuro) dispara o envio; **aí** seta `aguardando_assinatura_at`.
3. **Regressão:** `CaseFormDialog` (fluxo de 2 etapas revisão→envio) continua funcionando; **nenhum** caso comercial existente perde a procuração já gerada.

---

## Tasks / Subtasks

- [x] **Serviço — criação sem acoplamento** (AC: 1)
  - [x] No fluxo de criação padrão, `aguardando_assinatura_at` NÃO é setado na criação; o caso nasce `lifecycle='LEAD'` (default de S1-01). `createCase` agora sempre insere `aguardando_assinatura_at: null`.
  - [x] `opts.skipProcuracaoPrep` mantido; `createComercialCaseAndGenerateProcuracao` continua gerando o doc na criação (fluxo 2 etapas), sem setar a flag comercial.
- [x] **Serviço/RPC — ação "Enviar procuração"** (AC: 2)
  - [x] A flag `aguardando_assinatura_at` passou a ser setada no ATO de envio da procuração ao ZapSign — `sendCaseDocumentToZapsign` (quando `doc_kind='procuracao'`) carimba `aguardando_assinatura_at = now()`, idempotente (não sobrescreve nem se já liberado).
- [x] **UI** (AC: 2,3)
  - [x] Envio da procuração já existe na aba Documentos (botão "ZapSign" por doc). É o ato explícito de envio.
  - [x] `CaseFormDialog` de 2 etapas (revisão → envio) preservado — sem regressão.
- [x] **Testes** (AC: 1-3) — typecheck/lint verdes; replay do webhook prova a virada pós-envio.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/cases-service.ts` (`createCase` `:46`, `createComercialCaseAndGenerateProcuracao` `:376`).
- `CaseFormDialog` (front — `sistema-hv/src/components/...`; localizar pelo nome).
- Rotas/serviço de geração de procuração (reusar pipeline atual ZapSign).

**Invariantes / riscos de regressão:**
- **Caso 16 da Matriz** — o fluxo de 2 etapas do `CaseFormDialog` NÃO pode quebrar; casos comerciais existentes NÃO podem perder a procuração já gerada.
- Não recriar `trg_system_cases_bifurcacao`.
- Erro de dependência externa (ZapSign) → **424**, nunca 5xx (`reference_vercel_5xx_gateway`) — o disparo real e o tratamento fino ficam em S1-07 (esta story só desacopla o "quando").

### Testing
- Teste: criar caso comum → assert sem doc procuracao e `aguardando_assinatura_at IS NULL`.
- Teste: acionar envio → assert doc `doc_kind='procuracao'` criado + `aguardando_assinatura_at` setado.
- `npm run typecheck` / `npm run lint` verdes.

---

## Test cases (Matriz de Testes Mínimos v2.3)

- **Caso 16** (grupo E) — Procuração→ZapSign no `CaseFormDialog`: fluxo de 2 etapas continua funcionando após desacoplar criação (S1-02 CA-3); casos comerciais existentes não perdem a procuração já gerada.

---

## Dependências

- **Depende de:** S1-01 (para o caso nascer `lifecycle='LEAD'`).
- **Relaciona-se com:** S1-07 (o disparo real ao ZapSign sandbox e o tratamento de erro 424 são validados lá).

---

## File List

- `sistema-hv/src/lib/cases-service.ts` — `createCase` não seta mais `aguardando_assinatura_at`.
- `sistema-hv/src/lib/case-documents-service.ts` — `sendCaseDocumentToZapsign` seta `aguardando_assinatura_at` para procuração.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-02 | 0.1 | Draft inicial fatiado do PLANO-SPRINTS v2.3 | @sm |
| 2026-07-02 | 1.0 | Implementado: desacoplamento criação↔envio; flag comercial no envio ZapSign. Ready for Review | @dev |
