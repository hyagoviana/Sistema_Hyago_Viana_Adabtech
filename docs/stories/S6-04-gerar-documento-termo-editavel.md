# Story S6-04: Geração do documento editável único do termo (2 opções) via `generateCaseDocumentFromTemplate`

- **Sprint:** 6 — Termo de Acerto (documento editável com 2 opções) `[Frente B]`
- **ID:** S6-04
- **Status:** Draft
- **Estimativa relativa:** M/G (front + serviço — chamar o motor de docs com o template certo por `tipo_termo`, gravar `drive_file_id`/`drive_url` no snapshot, abrir o doc editável no preview) · **DEPENDÊNCIA DE SETUP: 2 Google Docs modelo com `<placeholders>`**
- **Executor sugerido:** @dev (front/serviço) · Quality gate: @architect · **Setup dos Google Docs: owner/@dev**
- **Status:** Ready for Review (código pronto; **BLOQUEADO em runtime** até os 2 Google Docs modelo serem cadastrados — ver Setup)

---

## Story

**Como** operador do financeiro,
**quero** gerar, a partir do rascunho do termo (S6-03), **um documento editável único** que já contém as **duas formas de pagamento** (parcelado + à vista) para o cliente escolher, usando o modelo correto por `tipo_termo` (PARCIAL ou COMPLEMENTAR),
**para que** o termo saia pronto para revisão/edição no Google Docs e fique registrado no snapshot (`drive_file_id`/`drive_url`), abrindo direto pelo preview do termo.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (motor de docs):** `generateCaseDocumentFromTemplate({ caseId, templateId, title?, values, docKind?, triggeredBy? })` (`src/lib/case-documents-service.ts:154`) — busca o `system_document_templates`, garante a pasta do caso, **copia o Google Doc modelo** (`copyTemplate`), **substitui placeholders** (`replacePlaceholders`, sintaxe `<campo>`), torna **link-editável** (`setLinkEditable`), grava em **`system_case_documents`** (status `EM_EDICAO`, `google_doc_id`), audita e cria evento `doc_generated`. Retorna `{ doc, editUrl }`.
- **JÁ EXISTE (modelos sincronizados do Drive):** os templates vêm de pasta do Drive (`GOOGLE_DRIVE_TEMPLATES_FOLDER_ID`, mecânica de "Sincronizar modelos") e viram linhas em `system_document_templates` (`google_doc_id`, `fields`, `goes_to_zapsign`).
- **JÁ EXISTE (snapshot):** `system_termo_snapshots` tem `drive_file_id` e `drive_url` (colunas já existem, `20260608000007`). Hoje elas são preenchidas só na aprovação (`gerarPdfTermo`/`finalizarAprovacao`). Esta story passa a gravá-las com o **doc editável gerado** — **sem** alterar schema.
- **JÁ EXISTE (preview de leitura — S3-04):** `casos.$id.termo.tsx` exibe o snapshot vigente e um botão "Abrir PDF" quando há `drive_url`. Passa a abrir o **doc editável** (Google Doc) gerado aqui.
- **NOVO:**
  1. **2 modelos Google Doc** (um por `tipo_termo`) com `<placeholders>` — **SETUP PENDENTE** (o owner/@dev prepara os Google Docs a partir dos `.docx`; ver Dependências).
  2. Ação **"Gerar documento do termo"** (na tela de elaborar / no preview) que: resolve o `templateId` pelo `tipo_termo` do snapshot; monta os `values` (placeholders); chama `generateCaseDocumentFromTemplate` com `docKind='termo_acerto'`; **grava `drive_file_id`/`drive_url` no `system_termo_snapshots`** do snapshot vigente.
  3. Preview (S3-04) passa a **abrir o doc editável** (link do Google Doc) — não só um PDF.

> **DECISÃO DO OWNER (travada):** documento **editável único** por `tipo_termo`, contendo as **duas** formas de pagamento (parcelado + à vista) para o cliente escolher. São **2 templates** (PARCIAL, COMPLEMENTAR); cada um já traz as duas opções de pagamento no corpo.

**Placeholders a suportar no(s) modelo(s)** (sintaxe `<campo>`, alimentados por `values`):
- Cadastro: `<nome_cliente>`, `<cpf_cliente>` (do `system_clients`).
- `<tipo_servico>` (do caso), `<saldo_antes>`, `<saldo_depois>`, `<parcelas_pagas>`, `<valor_abatimento>` (= valor efetivo).
- `<percentual_honorarios>` (default 15%), `<honorarios_abatimento>` (honorário sobre o abatimento).
- `<remanescente_anterior>` (**SÓ complementar**, input manual da S6-03), `<honorarios_total>`.
- Parcelado: `<qtd_parcelas>`, `<valor_parcela>` (default R$500) + `<valor_ultima_parcela>`.
- À vista: `<desconto_avista>` (default 10%) + `<valor_avista>`.
- Por-extenso dos **principais** valores (`<honorarios_total_extenso>`, `<valor_avista_extenso>` — só os principais; por-extenso completo é BACKLOG).

> **⚠ INCONSISTÊNCIA A RESOLVER — onde grava o resultado:** o motor `generateCaseDocumentFromTemplate` grava em **`system_case_documents`** (não no `system_termo_snapshots`) e **não** retorna/grava `drive_file_id`/`drive_url` (o `google_doc_id`/`editUrl` sim; o `drive_file_id`/PDF só saem no `finalizeCaseDocument`). Para atender "grava `drive_file_id`/`drive_url` no snapshot", esta story precisa de um passo explícito: após gerar, **atualizar o snapshot** com o `google_doc_id`→URL editável (em `drive_url`) e, se finalizado, o `drive_file_id` do PDF. Decidir com @architect: gravar o **link editável** (`editUrl`/`docUrl(google_doc_id)`) em `drive_url` do snapshot é suficiente para o preview "abrir o doc editável"; o `drive_file_id` do PDF só existe após `finalizeCaseDocument` (opcional nesta rodada).

> **⚠ INCONSISTÊNCIA — `remanescente_anterior`:** vem da S6-03 como input de tela (opção A: não persiste no snapshot). Nesta story ele é passado **direto em `values`** como placeholder do documento. Se a S6-03 adotar a opção (B) (persistir), ler do snapshot; caso contrário, a tela repassa o valor ao gerar.

---

## Acceptance Criteria

1. Existe ação **"Gerar documento do termo"** que resolve o **template por `tipo_termo`** (PARCIAL → template PARCIAL; COMPLEMENTAR → template COMPLEMENTAR) e chama `generateCaseDocumentFromTemplate` com `docKind='termo_acerto'` e os `values` (placeholders acima).
2. O documento gerado é **editável** (link-editável do Google Docs, via `setLinkEditable` do motor) e contém **as duas formas de pagamento** (parcelado + à vista) — porque o modelo já traz ambas e os placeholders das duas são preenchidos.
3. Após gerar, o **snapshot vigente** (`system_termo_snapshots`) recebe o link do doc editável em **`drive_url`** (e `drive_file_id` do PDF **se** o fluxo finalizar o doc — opcional). **Sem alterar o schema do snapshot.**
4. O **preview do termo** (`casos.$id.termo.tsx`, S3-04) passa a **abrir o doc editável** (botão que abre o Google Doc/`drive_url`), além dos dados de leitura já exibidos.
5. **Placeholders faltando** → o motor já valida campos obrigatórios do template (`system_document_templates.fields`, erro 422) e falha de Google Docs retorna **424** (não 5xx) com mensagem legível.
6. **Setup dos 2 Google Docs** (PARCIAL e COMPLEMENTAR) com os `<placeholders>` é **pré-requisito** e está marcado como **setup pendente** (owner/@dev prepara a partir dos `.docx` e sincroniza na pasta de modelos) — a story documenta o mapeamento placeholder→campo, mas **não** cria os Docs.

---

## Tasks / Subtasks

- [ ] **[SETUP — bloqueante] Preparar 2 Google Docs modelo** (AC: 6) — **PENDENTE (owner/@dev)**. Criar os modelos PARCIAL e COMPLEMENTAR a partir dos `.docx`, com os `<placeholders>` do mapa abaixo, na pasta de modelos (`GOOGLE_DRIVE_TEMPLATES_FOLDER_ID`); nomear cada um contendo **"TERMO ACERTO PARCIAL"** / **"TERMO ACERTO COMPLEMENTAR"** (convenção de resolução — ver abaixo); rodar "Sincronizar modelos" para virarem linhas em `system_document_templates`. **Sem isso, o botão degrada com 424 e mensagem clara — não quebra.**
- [x] **Resolver template por `tipo_termo`** (AC: 1) — `resolveTermoTemplateId(tipo)` em `termo-service.ts`: varre `system_document_templates` (active, não deletado) e casa por **convenção de nome** (normaliza acentos/caixa e exige as palavras `TERMO` + `ACERTO` + `PARCIAL|COMPLEMENTAR`). Se não achar → `TermoServiceError(…, 424)` com instrução de cadastro.
- [x] **Montar `values` (placeholders)** (AC: 1,2) — `buildTermoValues(termo, cliente, tipoServico, remanescente?)`: centavos→BRL (`brlDoc`), % e por-extenso dos principais (`reaisPorExtenso`). `remanescente_anterior` preenchido só quando COMPLEMENTAR (senão string vazia).
- [x] **Gerar + gravar no snapshot** (AC: 1,3) — novo `gerarDocumentoTermo({termoId, remanescenteAnteriorCentavos?, triggeredBy})`: valida `status==='RASCUNHO'` (imutabilidade), resolve template, monta values, chama `generateCaseDocumentFromTemplate({docKind:'TERMO_ACERTO'})`, e faz **UPDATE `system_termo_snapshots`** (`drive_url = docUrl(google_doc_id)`) com guarda `.eq("status","RASCUNHO")`.
- [x] **Preview abre o doc editável** (AC: 4) — `casos.$id.termo.tsx`: botão "Abrir documento" usa `drive_url`; o botão desabilitado "Editar/recalcular (em breve)" virou `Link` para a tela Elaborar.
- [x] **RPC + hook** — `gerarDocumentoTermoFn` (`rpc/termo.ts`, valida `termoId`+`remanescenteAnteriorCentavos?`, injeta `triggeredBy=userId`) + `useGerarDocumentoTermo(caseId)` (`hooks/useTermo.ts`, invalida `["termos", caseId]`). Botão em `GerarDocumentoTermoButton.tsx`, plugado na tela Elaborar (S6-03).
- [x] **Testes** (AC: 1–6) — `npx tsc --noEmit`: só 3 erros PRÉ-EXISTENTES (nenhum novo). Lint: só ruído CRLF. **Teste end-to-end (gerar PARCIAL/COMPLEMENTAR, doc com 2 formas, snapshot recebe drive_url, 422 campo faltando, 424 Docs fora) BLOQUEADO até o setup dos 2 Google Docs** → @qa após o owner cadastrar os modelos.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/lib/termo-service.ts` (novo `gerarDocumentoTermo(termoId)` — orquestra `generateCaseDocumentFromTemplate` + UPDATE do snapshot com `drive_url`).
- `sistema-hv/src/rpc/termo.ts` (`gerarDocumentoTermoFn`) + `sistema-hv/src/hooks/useTermo.ts` (`useGerarDocumentoTermo`).
- `sistema-hv/src/routes/casos.$id.termo.elaborar.tsx` (botão "Gerar documento") e/ou `casos.$id.termo.tsx` (abrir doc editável).
- (reuso, sem mudança) `src/lib/case-documents-service.ts` (`generateCaseDocumentFromTemplate`, `docUrl`), `src/lib/google/docs.ts` (`copyTemplate`/`replacePlaceholders`/`setLinkEditable`).

**REGRAS DE OURO (pertinentes):**
- **NÃO toca `system_cases`** → **NÃO recriar `system_cases_active`** (regra de ouro 2). Esta story escreve em `system_termo_snapshots` e `system_case_documents`, não em `system_cases`.
- **NÃO recriar `trg_system_cases_bifurcacao`** (regra de ouro 6).
- Falha Google Docs/Drive → **424** (o motor já faz isso via `EXTERNAL_DEP_FAILED`); nunca 5xx (`reference_vercel_5xx_gateway`).
- **NÃO alterar o schema** de `system_termo_snapshots` — `drive_file_id`/`drive_url` já existem. **SEM migration** (o UPDATE do snapshot RASCUNHO é mutável; a imutabilidade só trava APROVADO/APRESENTADO/ACEITO).

**Riscos de regressão:**
- O motor grava um registro em `system_case_documents` — o termo passa a existir em **duas** tabelas (doc no `system_case_documents`, snapshot no `system_termo_snapshots`). Deixar claro que o **snapshot** é a fonte de valores e o **doc** é o arquivo editável; ligar os dois por `case_id` + `drive_url`/`google_doc_id`.
- Não disparar a imutabilidade: só gravar `drive_url` em snapshot **RASCUNHO** (ou o UPDATE precisa evitar campos travados). Conferir o `trg_system_termo_immutable`.
- Distinguir os 2 templates de termo dos demais modelos do escritório (procuração etc.) — precisa de uma convenção clara (nome/flag), senão o resolver erra o template.

### Testing
- Gerar termo PARCIAL → doc editável com parcelado+à vista; snapshot recebe `drive_url`.
- Gerar termo COMPLEMENTAR → placeholder `<remanescente_anterior>` preenchido.
- Preview (S3-04) → abre o doc editável.
- Template com campo obrigatório vazio → 422; Google Docs fora → 424 (mensagem legível).
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** S6-03 (snapshot RASCUNHO + inputs, incl. remanescente), `generateCaseDocumentFromTemplate` (JÁ EXISTE), `system_termo_snapshots`/`system_case_documents` (JÁ EXISTEM), preview S3-04.
- **DEPENDÊNCIA DE SETUP (bloqueante):** os **2 Google Docs modelo** (PARCIAL e COMPLEMENTAR) com `<placeholders>` na pasta `GOOGLE_DRIVE_TEMPLATES_FOLDER_ID`, sincronizados para `system_document_templates`. Preparados pelo **owner/@dev** a partir dos `.docx`. Sem eles, a story não é executável (só o mapeamento placeholder→campo pode ser adiantado).
- **Habilita:** fecha a Frente B (termo editável com 2 opções).

---

## BACKLOG explícito (fase futura — NÃO fazer nesta story)

- **Por-extenso completo** de todos os valores (aqui só os principais).
- **Calculadora encadeada parcial→complementar automática** (remanescente segue manual).
- **Conciliação ERP** (Conta Azul/Asaas) dos valores do termo.
- **Captura digital da escolha** (parcelado vs à vista) via portal do cliente — aqui a escolha é no documento.
- Persistir `remanescente_anterior` / `template_id` no snapshot (schema) — só se o owner exigir.

## SETUP DOS 2 GOOGLE DOCS — mapa placeholder→campo (para o owner criar os modelos)

**Convenção de nome do modelo (obrigatória p/ o resolver casar):** o NOME do Google Doc
deve conter as palavras **TERMO ACERTO PARCIAL** ou **TERMO ACERTO COMPLEMENTAR**
(acentos e caixa são ignorados na comparação). Ex.: `Termo de Acerto PARCIAL — modelo`,
`Termo de Acerto COMPLEMENTAR (modelo)`. Basta as 3 palavras aparecerem no nome.

**Sintaxe do placeholder no corpo do Doc:** `<campo>` (com os sinais de menor/maior),
exatamente como nos modelos de procuração. O motor troca `<campo>` pelo valor.

**Lista completa de `<placeholders>` que os 2 modelos devem conter** (o COMPLEMENTAR usa
todos; o PARCIAL usa todos exceto `<remanescente_anterior>`, que virá vazio):

| Placeholder | Origem / conteúdo |
|---|---|
| `<nome_cliente>` | `system_clients.full_name` |
| `<cpf_cliente>` | `system_clients.cpf_cnpj` |
| `<tipo_servico>` | nome do tipo de serviço do caso (fallback: `case_type`) |
| `<saldo_antes>` | snapshot `saldo_antes_centavos` → BRL |
| `<saldo_depois>` | snapshot `saldo_depois_centavos` → BRL |
| `<parcelas_pagas>` | snapshot `parcelas_pagas_centavos` → BRL |
| `<valor_abatimento>` | snapshot `valor_efetivo_centavos` → BRL (valor efetivo do abatimento) |
| `<percentual_honorarios>` | snapshot `percentual_honorarios` (ex.: `15%`) |
| `<honorarios_abatimento>` | honorário sobre o abatimento = `valor_total_centavos` → BRL |
| `<honorarios_total>` | `valor_total_centavos` → BRL (mesmo valor; nome alternativo p/ o texto) |
| `<honorarios_total_extenso>` | honorários total por extenso (reais inteiros) |
| `<remanescente_anterior>` | **SÓ COMPLEMENTAR** — input manual da tela Elaborar → BRL (PARCIAL = vazio) |
| `<qtd_parcelas>` | snapshot `qtd_parcelas` (número) |
| `<valor_parcela>` | snapshot `valor_parcela_centavos` → BRL (default R$500) |
| `<valor_ultima_parcela>` | snapshot `valor_ultima_parcela_centavos` → BRL |
| `<desconto_avista>` | snapshot `desconto_avista_pct` (ex.: `10%`) |
| `<valor_avista>` | snapshot `valor_avista_centavos` → BRL |
| `<valor_avista_extenso>` | valor à vista por extenso (reais inteiros) |

> Cada modelo já traz **as duas formas de pagamento** no corpo (bloco "Parcelado" com
> `<qtd_parcelas>`/`<valor_parcela>`/`<valor_ultima_parcela>` **e** bloco "À vista" com
> `<desconto_avista>`/`<valor_avista>`), para o cliente escolher no próprio documento.

> **Campos `required` do template:** ao sincronizar, o motor extrai os `fields` do Doc. Se
> algum for marcado `required` e vier vazio nos `values`, o motor devolve **422** com a lista
> dos que faltam (AC-5). Para o PARCIAL, **não** marcar `<remanescente_anterior>` como
> required (ele fica vazio nesse tipo).

## File List

- `sistema-hv/src/lib/termo-service.ts` (novo `gerarDocumentoTermo` + `resolveTermoTemplateId` + `buildTermoValues` + `reaisPorExtenso`/por-extenso; import de `generateCaseDocumentFromTemplate`/`docUrl`)
- `sistema-hv/src/rpc/termo.ts` (`gerarDocumentoTermoFn`)
- `sistema-hv/src/hooks/useTermo.ts` (`useGerarDocumentoTermo`)
- `sistema-hv/src/components/cases/GerarDocumentoTermoButton.tsx` (novo — botão "Gerar documento (editável)")
- `sistema-hv/src/routes/casos.$id.termo.elaborar.tsx` (plugado o botão sobre o rascunho vigente)
- `sistema-hv/src/routes/casos.$id.termo.tsx` (preview abre o doc editável via `drive_url`; link p/ Elaborar)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft — geração do documento editável único do termo (2 templates por tipo) via generateCaseDocumentFromTemplate; grava drive_url no snapshot; preview abre o doc. Setup dos 2 Google Docs marcado como pré-requisito. Registra inconsistências (motor grava em system_case_documents, não retorna drive_file_id; remanescente). Frente B / Sprint 6. | @sm |
| 2026-07-03 | 1.0 | Ready for Review (código) — `gerarDocumentoTermo` orquestra motor + UPDATE do snapshot RASCUNHO (`drive_url`); template resolvido por convenção de nome (424 se ausente, degrada); values com por-extenso dos principais; RPC+hook+botão; preview abre doc editável. Sem migration. Typecheck: só 3 erros pré-existentes. **Runtime bloqueado até setup dos 2 Google Docs.** Mapa placeholder→campo documentado acima. | @dev |
