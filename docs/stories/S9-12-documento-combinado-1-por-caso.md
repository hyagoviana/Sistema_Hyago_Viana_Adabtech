# Story S9-12: Documento COMBINADO — 1 documento por caso (contrato + procuração numa assinatura só)

- **Sprint:** 9 — Modelo definitivo Lead→Comercial→Operacional
- **ID:** S9-12
- **Status:** Ready for Review
- **Estimativa relativa:** M (reconciliação de UI + wiring; sem migration — reuso)
- **Executor sugerido:** @dev (UI + wiring) · Quality gate: @qa / @architect

---

## Story

**Como** operador,
**quero** enviar **um único documento COMBINADO** ("Contrato e procuração - [serviço]") por caso — que traz procuração + contrato numa assinatura só —,
**para que** o fluxo seja simples: cadastro (LEAD) → envio do combinado → Comercial (aguardando assinatura, ainda LEAD) → **assinou → CLIENTE (operacional)**.

---

## Contexto / decisão do owner (2026-07-06)

Os modelos de documento são **COMBINADOS**: cada "Contrato e procuração - [serviço]" (há 29 no Drive / `system_document_templates`, `case_type` geral) traz procuração + contrato numa **assinatura só**. **NÃO existe** procuração pura nem contrato puro separados. O owner escolheu: **1 documento por caso — usar o combinado**.

A Sprint 9 (S9-09) montou 2 caminhos separados (procuração→comercial/segue LEAD; contrato→operacional/CLIENTE) e 2 botões ("Enviar procuração" / "Enviar caso (contrato)") em `CaseSignActions.tsx`, com `generateContratoFromTemplate` exigindo um template "contrato" (424 se não achar) e sem aceitar valores revisados. Esta story reconcilia tudo para o documento combinado.

---

## Acceptance Criteria

1. **Um único envio = o combinado como o CASO.** Em `CaseSignActions.tsx` há **UM botão principal** "Enviar contrato e procuração" que:
   - Deixa o usuário **ESCOLHER o modelo** na lista (os "Contrato e procuração - [serviço]" + demais), reusando o diálogo de revisão de campos existente. **Sem** convenção de nome "contrato" e **sem** degradação 424 por nome — o usuário escolhe.
   - Envia ao ZapSign como **`doc_kind='contrato'`** (o gatilho operacional) via `generateContratoFromTemplate`, que agora aceita **qualquer** template escolhido e os **valores revisados** (`overrideValues`). 424 só quando NÃO há template selecionado.
   - **Carimba `aguardando_assinatura_at`** ao enviar (caso entra no Comercial como LEAD enquanto aguarda assinatura). Feito **server-side** em `sendCaseDocumentToZapsign`.
2. **Assinatura → CLIENTE**: o webhook (`doc_kind='contrato'` → `promoverCasoOperacional`, S9-05) já existe. O envio acima resulta nesse `doc_kind`. Idempotência por caso é por `doc_kind` (contrato e procuração coexistem sem colisão).
3. **Botão "Enviar procuração" escondido** atrás do flag `SEPARATE_PROCURACAO=false` (default). O backend do caminho procuração (`registrarProcuracaoAssinada`, `generateProcuracaoFromTemplate`, `generateProcuracaoFn`, `useGenerateProcuracao`) permanece **INTACTO** (reuso futuro se o owner criar procuração pura).
4. **Rótulos/textos coerentes**: o Comercial em "aguardando assinatura" reflete o **combinado**; nada diz "procuração assinada = cliente". A virada é na assinatura do combinado.
5. `npx tsc --noEmit` (só os 3 erros PRÉ-EXISTENTES de `service_type_id`) e `npm run lint` nos arquivos tocados (CRLF ignorado). `npm run build` verde.

---

## Tasks / Subtasks

- [x] **`generateContratoFromTemplate` aceita valores revisados** (AC: 1) — 5º parâmetro `overrideValues?: Record<string,string>`, mesclado sobre o autofill (mesma semântica de `generateProcuracaoFromTemplate`). Sem gate por nome; 424 só quando `templateId` ausente. (`cases-service.ts`)
- [x] **RPC `generateContratoFn` recebe `values`** (AC: 1) — schema + repasse ao serviço. (`rpc/cases.ts`)
- [x] **Hook `useGenerateContrato` recebe `values`** (AC: 1). (`hooks/useCases.ts`)
- [x] **Carimbo `aguardando_assinatura_at` no envio do contrato** (AC: 1) — condição em `sendCaseDocumentToZapsign` estendida para `doc_kind IN ('procuracao','contrato')`. Idempotente (não sobrescreve; respeita `assinatura_liberada_at`). (`case-documents-service.ts`)
- [x] **UI: botão único + esconder procuração** (AC: 1, 3) — botão "Enviar contrato e procuração" (envia `doc_kind='contrato'` com os `values` revisados); botão "Enviar procuração" atrás de `SEPARATE_PROCURACAO=false`. Diálogo de revisão reusado (sem duplicar). (`CaseSignActions.tsx`)
- [x] **Rótulos/textos** (AC: 4) — diálogo (título/descrição/label/toast); Comercial "Aguardando assinatura" (`comercial.assinaturas.tsx`) reflete o combinado e o "Confirmar assinatura" manual promove a CLIENTE (`usePromoverCasoManual`, espelha o webhook do contrato); rótulo terminal do funil e empty-state em `comercial.leads.tsx`.
- [x] **Testes** (AC: 5) — typecheck (3 erros pré-existentes de `service_type_id`); lint dos arquivos tocados sem erro novo (CRLF ignorado); `npm run build` verde.

---

## Dev Notes

**Fluxo do envio combinado (resultante):**
1. Detalhe do caso (LEAD) → botão **"Enviar contrato e procuração"** → diálogo: escolhe modelo (qualquer "Contrato e procuração - [serviço]") → revisa campos.
2. Gera `doc_kind='contrato'` (idempotente por caso) → finaliza PDF na pasta → envia ao ZapSign.
3. O envio **carimba `aguardando_assinatura_at`** (server-side) → caso aparece em **Comercial · Aguardando assinatura** (segue LEAD).
4. Cliente assina → webhook ZapSign (`doc_kind='contrato'`) → `promoverCasoOperacional` → **CLIENTE** (limpa `aguardando_assinatura_at`, sai do Comercial). Fallback manual: "Confirmar assinatura" na página de assinaturas.

**Arquivos tocados:**
- `sistema-hv/src/components/cases/CaseSignActions.tsx` — botão único "Enviar contrato e procuração"; flag `SEPARATE_PROCURACAO=false` esconde procuração pura; passa `values` revisados ao gerar contrato; título/descrição/label/toast; removido o aviso "procuração ainda não assinada" (não faz mais sentido); prop `procuracaoAssinada` mantida por compat (aceita e ignora).
- `sistema-hv/src/lib/cases-service.ts` — `generateContratoFromTemplate(..., overrideValues?)`.
- `sistema-hv/src/rpc/cases.ts` — `generateContratoFn` aceita `values`.
- `sistema-hv/src/hooks/useCases.ts` — `useGenerateContrato` aceita `values`.
- `sistema-hv/src/lib/case-documents-service.ts` — `sendCaseDocumentToZapsign` carimba `aguardando_assinatura_at` também para `doc_kind='contrato'`.
- `sistema-hv/src/routes/comercial.assinaturas.tsx` — "Confirmar assinatura" promove a CLIENTE (`usePromoverCasoManual`); textos do combinado.
- `sistema-hv/src/routes/comercial.leads.tsx` — rótulo terminal "Contrato e procuração assinado" + empty-state.

**REGRAS DE OURO (pertinentes):**
- **Sem migration** — reuso; NÃO toca `system_cases`, não recria view/trigger.
- **Escrita de estado server-side** — o carimbo de `aguardando_assinatura_at` é no serviço de envio (não no front). O efeito "assinado → CLIENTE" vem do webhook (S9-05).
- **Degradação 424** (não 5xx) — mantida só para "sem template selecionado".
- **Reuso máximo** — o diálogo de revisão/envio NÃO foi duplicado.

**Riscos de regressão:**
- O ramo procuração (backend) segue intacto (só a UI esconde o botão). `generateProcuracaoFromTemplate` / `registrarProcuracaoAssinada` inalterados.
- `sendCaseDocumentToZapsign` agora carimba `aguardando_assinatura_at` para contrato — idempotente e respeita `assinatura_liberada_at` (não reabre caso já CLIENTE). `promoverCasoOperacional` limpa a flag ao virar CLIENTE.

### Testing
- Caso LEAD → "Enviar contrato e procuração" → escolhe modelo → revisa → envia. Caso aparece em Comercial · Aguardando assinatura (segue LEAD).
- Assina (webhook) → caso vira CLIENTE e sai do Comercial. Sem webhook: "Confirmar assinatura" faz a virada.
- Botão "Enviar procuração" NÃO aparece (flag off). Backend da procuração intacto.

---

## Dependências

- **Depende de:** S9-02 (`doc_kind='contrato'` + `generateContratoFromTemplate`), S9-04/S9-05 (efeito do contrato assinado → CLIENTE), S9-09 (diálogo `CaseSignActions`).
- **Habilita:** jornada ponta-a-ponta com **1 documento combinado por caso**.
- **Aguarda de @qa:** teste de envio real → assinatura → vira CLIENTE; confirmar que o caso entra no Comercial ao enviar; validar que os 29 modelos "Contrato e procuração - [serviço]" aparecem na lista de escolha.

---

## File List

- `sistema-hv/src/components/cases/CaseSignActions.tsx` (botão único + flag `SEPARATE_PROCURACAO`; passa `values` ao contrato; textos)
- `sistema-hv/src/lib/cases-service.ts` (`generateContratoFromTemplate` aceita `overrideValues`)
- `sistema-hv/src/rpc/cases.ts` (`generateContratoFn` aceita `values`)
- `sistema-hv/src/hooks/useCases.ts` (`useGenerateContrato` aceita `values`)
- `sistema-hv/src/lib/case-documents-service.ts` (carimba `aguardando_assinatura_at` p/ contrato)
- `sistema-hv/src/routes/comercial.assinaturas.tsx` (confirmar assinatura → CLIENTE; textos)
- `sistema-hv/src/routes/comercial.leads.tsx` (rótulo terminal + empty-state)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-06 | 1.0 | Reconciliação para o documento COMBINADO (1 por caso). Botão único "Enviar contrato e procuração" (envia `doc_kind='contrato'` com valores revisados; sem gate 424 por nome). Envio carimba `aguardando_assinatura_at` (entra no Comercial). Botão procuração escondido atrás de `SEPARATE_PROCURACAO=false` (backend intacto). Textos do Comercial coerentes; "Confirmar assinatura" manual promove a CLIENTE. Sem migration. typecheck (3 pré-existentes) / lint / build ok. | @dev |
