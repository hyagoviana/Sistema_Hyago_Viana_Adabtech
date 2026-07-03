# Story S7-04: Cadastro dos 2 templates do termo (setup, sem código) + validação do resolver

- **Sprint:** 7 — Termo puxando do histórico (preencher o mínimo) `[Frente B]`
- **ID:** S7-04
- **Status:** Ready for Owner `(SETUP — sem código; .docx dos 2 modelos JÁ PRESENTES em docs/modelos-termo/; falta o owner subir ao Drive + sincronizar)`

> **VALIDAÇÃO @dev (2026-07-03):**
> - Os 2 `.docx` estão em `docs/modelos-termo/`: **"TERMO ACERTO PARCIAL.docx"** e **"TERMO ACERTO COMPLEMENTAR.docx"**. Os **nomes já contêm as 3 palavras** (TERMO + ACERTO + PARCIAL/COMPLEMENTAR) exigidas por `templateNameMatches` (`termo-service.ts`) — ao converter em Google Doc, o `.docx` é removido do nome, o que **não** afeta o casamento (NFD + strip acento + uppercase + `includes`). ✅ convenção OK.
> - Placeholders conferidos nos 2 `.docx` e **todos reconciliados** em `buildTermoValues` (S7-02) — o doc **não sai** com `<...>` literais. PARCIAL usa `<saldo_atual>`/`<percentual_abatimento>`/`<valor_ultima_parcela_extenso>`; COMPLEMENTAR usa `<saldo_originario>`/`<saldo_epoca_abatimento>`/`<honorarios_abatimento>`/`<remanescente_anterior>`. Os sem fonte no cálculo são inputs opcionais na tela elaborar (saem vazios se não informados).
> - Verificado no banco: **0 linhas** de modelo de termo em `system_document_templates` hoje → `resolveTermoTemplateId` retorna **424 (esperado)** até o sync. Nenhum código a alterar.
- **Estimativa relativa:** P (procedimento humano: subir 2 Google Docs na pasta de modelos + "Sincronizar modelos" + validar que `resolveTermoTemplateId` acha e `gerarDocumentoTermo` para de dar 424).
- **Executor sugerido:** **owner/@dev (humano — sobe os Docs)** · Validação: @qa · Setup dos `.docx`: Orion (preparando)

---

## Story

**Como** owner/operador,
**quero** cadastrar os **2 modelos Google Docs** do Termo de Acerto ("TERMO ACERTO PARCIAL" e "TERMO ACERTO COMPLEMENTAR") na pasta de modelos e sincronizá-los,
**para que** a geração do documento do termo (S6-04) **pare de dar 424** ("modelo não configurado") e passe a gerar o doc editável de verdade — desbloqueando o teste end-to-end da Frente B.

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (código pronto, aguardando setup):** S6-04 entregou `gerarDocumentoTermo` + `resolveTermoTemplateId(tipo)` (`src/lib/termo-service.ts:563`). O resolver varre `system_document_templates` (active, não deletado) e casa por **convenção de nome**: o nome precisa conter as palavras **TERMO**, **ACERTO** e **PARCIAL|COMPLEMENTAR** (acentos/caixa ignorados via `templateNameMatches`, `termo-service.ts:555`). Se não achar → `TermoServiceError(..., 424)` com instrução de cadastro.
- **JÁ EXISTE (mecânica de sync):** modelos vêm de pasta do Drive (`GOOGLE_DRIVE_TEMPLATES_FOLDER_ID`) e viram linhas em `system_document_templates` (`google_doc_id`, `fields`, `goes_to_zapsign`) via botão "Sincronizar modelos" (mesma mecânica das procurações — memória `project_sync_procuracoes_busca`).
- **JÁ EXISTE (mapa placeholder→campo):** documentado por completo na **S6-04** (seção "SETUP DOS 2 GOOGLE DOCS — mapa placeholder→campo"). Esta story **reusa esse mapa**, não o reinventa.
- **NOVO (procedimento humano, SEM código):**
  1. Obter os 2 `.docx` (Orion está preparando: "TERMO ACERTO PARCIAL" e "TERMO ACERTO COMPLEMENTAR").
  2. Subir/converter como **Google Docs** na pasta de modelos, com os `<placeholders>` do mapa da S6-04 e **nome contendo as 3 palavras** exigidas pelo resolver.
  3. Rodar **"Sincronizar modelos"** → aparecem em `system_document_templates`.
  4. Validar que `resolveTermoTemplateId('PARCIAL')` e `('COMPLEMENTAR')` **acham** o template e que `gerarDocumentoTermo` **para de dar 424**.

> **DEPENDÊNCIA DE SETUP (bloqueante):** os `.docx` dos 2 modelos. Enquanto não subirem, a S6-04 **degrada com 424 e mensagem clara** (não quebra) — o app segue funcional, só a geração do termo fica indisponível.

---

## Acceptance Criteria

1. Os **2 Google Docs** ("TERMO ACERTO PARCIAL" e "TERMO ACERTO COMPLEMENTAR") estão na pasta de modelos (`GOOGLE_DRIVE_TEMPLATES_FOLDER_ID`), com os `<placeholders>` do **mapa da S6-04** e **nome contendo TERMO + ACERTO + PARCIAL/COMPLEMENTAR** (para o `templateNameMatches` casar).
2. Após **"Sincronizar modelos"**, os 2 modelos aparecem como linhas em `system_document_templates` (active, não deletado) com `fields` extraídos e `google_doc_id`.
3. `resolveTermoTemplateId('PARCIAL')` retorna o id do modelo PARCIAL e `resolveTermoTemplateId('COMPLEMENTAR')` o do COMPLEMENTAR — **sem 424**.
4. `gerarDocumentoTermo` sobre um snapshot RASCUNHO **gera o doc editável** (grava `drive_url` no snapshot, S6-04) para **ambos** os tipos — não retorna mais 424 por "modelo não configurado".
5. No PARCIAL, `<remanescente_anterior>` **não** é `required` (fica vazio nesse tipo); no COMPLEMENTAR ele é preenchido pelo input manual. Campo obrigatório vazio → **422** (validação do motor); Google Docs fora → **424** — ambos com mensagem legível.
6. O **passo-a-passo** de cadastro/sincronização/validação fica **documentado** (nesta story), para o owner repetir se trocar os modelos.

---

## Tasks / Subtasks

- [x] **[SETUP] Obter os 2 `.docx`** (AC: 1) — **feito**: presentes em `docs/modelos-termo/` (PARCIAL + COMPLEMENTAR).
- [ ] **[OWNER] Subir como Google Docs na pasta de modelos** (AC: 1) — subir os 2 `.docx` na pasta `GOOGLE_DRIVE_TEMPLATES_FOLDER_ID` **convertendo para Google Doc** (upload como Doc, não como arquivo `.docx` bruto). O nome já satisfaz a convenção (não renomear removendo TERMO/ACERTO/PARCIAL/COMPLEMENTAR).
- [ ] **[OWNER] Sincronizar modelos** (AC: 2) — botão "Sincronizar modelos" no app → conferir 2 linhas novas em `system_document_templates` (`google_doc_id`, `fields`).
- [ ] **[QA] Validar resolver + geração** (AC: 3,4,5) — gerar um termo PARCIAL e um COMPLEMENTAR de um snapshot RASCUNHO; confirmar doc editável (2 formas de pagamento), `drive_url` no snapshot, 424 sumiu; conferir que **nenhum** `<placeholder>` literal sobrou; testar 422 (obrigatório vazio) e 424 (Docs fora).
- [x] **Documentar o passo-a-passo** (AC: 6) — abaixo (procedimento + convenção + validação do resolver + reconciliação de placeholders da S7-02).

### Passo-a-passo (owner)

1. **Drive:** abrir a pasta de modelos (`GOOGLE_DRIVE_TEMPLATES_FOLDER_ID`).
2. **Upload como Google Doc:** subir `TERMO ACERTO PARCIAL.docx` e `TERMO ACERTO COMPLEMENTAR.docx` (`docs/modelos-termo/`) **convertendo para Google Docs** (Drive → Novo → Upload; ou "Abrir com Google Docs" e salvar). Manter os nomes com as 3 palavras.
3. **Sincronizar:** no app, "Sincronizar modelos" → confirmar as 2 linhas em `system_document_templates` (leitura: `npx tsx scripts/db-query.ts "select name from system_document_templates where upper(name) like '%TERMO%'"`).
4. **Validar:** elaborar um termo (rascunho) e clicar "Gerar documento (editável)" para PARCIAL e para COMPLEMENTAR → abre o Google Doc sem `<...>` literais; `drive_url` gravado no snapshot.
5. **Auth (se der 424 por auth, não por modelo):** rodar `diag-google-docs.ts` (refresh token da conta `juridico@` expira em 7 dias no app OAuth "Testing").

---

## Dev Notes

**Arquivos/artefatos envolvidos (SEM alteração de código):**
- Google Drive: pasta de modelos `GOOGLE_DRIVE_TEMPLATES_FOLDER_ID` (subir os 2 Docs).
- `sistema-hv/src/lib/termo-service.ts` (`resolveTermoTemplateId` `:563` / `templateNameMatches` `:555` — **só validar**, não alterar).
- `system_document_templates` (linhas geradas pelo sync — **dados**, não schema).
- **Referência do mapa placeholder→campo:** `docs/stories/S6-04-gerar-documento-termo-editavel.md` (seção "SETUP DOS 2 GOOGLE DOCS").

**Convenção de nome (obrigatória p/ o resolver casar):** o NOME do Google Doc deve conter **TERMO ACERTO PARCIAL** ou **TERMO ACERTO COMPLEMENTAR** (acentos/caixa ignorados). Basta as 3 palavras aparecerem.

**REGRAS DE OURO (pertinentes):**
- **Story de SETUP — não escreve código nem migration.** Nenhuma tabela do sistema é tocada.
- Google Docs/Drive fora → **424** (o motor já faz), nunca 5xx (`reference_vercel_5xx_gateway`).
- Google OAuth: conta `juridico@`; app OAuth em "Testing" **expira o refresh token em 7 dias** — se a geração falhar por auth, rodar `diag-google-docs.ts` (memória `reference_google_oauth_refresh_token`) antes de suspeitar dos modelos.

**Riscos:**
- Nome do Doc sem as 3 palavras → resolver não casa → 424 mesmo com o Doc na pasta.
- Placeholder com sintaxe errada (sem `<>`) → não substitui.
- `<remanescente_anterior>` marcado `required` no PARCIAL → 422 indevido.

### Testing (validação @qa após o owner subir os Docs)
- Sincronizar → 2 linhas em `system_document_templates`.
- `resolveTermoTemplateId('PARCIAL')`/`('COMPLEMENTAR')` → ids, sem 424.
- Gerar termo PARCIAL e COMPLEMENTAR → doc editável (2 formas), `drive_url` no snapshot.
- Campo obrigatório vazio → 422; Docs fora → 424 (mensagem legível).

---

## Dependências

- **Depende de (bloqueante):** os **2 `.docx`** dos modelos (Orion preparando) + `GOOGLE_DRIVE_TEMPLATES_FOLDER_ID` configurado + Google OAuth válido.
- **Depende de (código, JÁ PRONTO):** S6-04 (`gerarDocumentoTermo`, `resolveTermoTemplateId`), mecânica de "Sincronizar modelos".
- **Habilita:** teste end-to-end da geração do termo (fecha a Frente B em runtime).

---

## BACKLOG explícito (fase futura — NÃO fazer nesta story)

- Persistir `template_id` do termo no snapshot (hoje resolvido por convenção de nome).
- UI de gestão dos modelos de termo (aqui é sync + convenção de nome).

## File List

- (nenhum arquivo de código) — artefatos: 2 Google Docs modelo na pasta `GOOGLE_DRIVE_TEMPLATES_FOLDER_ID`; linhas em `system_document_templates` via sync.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-03 | 0.1 | Draft (SETUP — sem código) — cadastrar os 2 Google Docs do termo (PARCIAL/COMPLEMENTAR) na pasta de modelos + sincronizar + validar `resolveTermoTemplateId`/`gerarDocumentoTermo` (fim do 424). Reusa o mapa placeholder→campo da S6-04. Bloqueado até os .docx (Orion). Sprint 7 / Frente B. | @sm |
