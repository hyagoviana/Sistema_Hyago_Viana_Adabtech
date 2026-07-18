# Story R5-03: Bug B4 — erro ao anexar documento ao caso

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-03
- **Status:** Draft — **[C8] requer ambiente** (precisa reproduzir o erro com arquivo/cliente reais do Hyago para cravar se é 409 pasta / 4xx MIME / 5xx Drive antes de implementar a robustez).
- **Estimativa relativa:** S (diagnóstico + robustez do upload/rota)
- **Executor sugerido:** @dev · Quality gate: @qa
- **Item do documento-mestre:** §8 **B4** — "erro ao anexar doc · `uploadCaseDocument` / rota upload"

---

## Story

**Como** operador que anexa um documento na aba Documentos do caso,
**quero** que o upload conclua (ou me diga claramente o motivo quando falhar),
**para que** o arquivo fique no Drive do caso e registrado em `system_case_documents`.

---

## Contexto / o que JÁ EXISTE vs NOVO (arquivo:linha)

- **JÁ EXISTE (rota):** `sistema-hv/src/routes/api.cases.$id.documents.upload.tsx` — POST multipart → `uploadCaseDocument` (`case-documents-service.ts`). Já trata body inválido (400), campo `file` ausente (400), `CaseDocumentServiceError` (status próprio) e erro interno (500).
- **JÁ EXISTE (serviço):** `sistema-hv/src/lib/case-documents-service.ts` — `uploadCaseDocument` valida MIME + magic-bytes → `ensureCaseFolder(caseId)` → `uploadFile` no Drive → registra o doc.
- **CANDIDATOS A ROOT CAUSE (a confirmar em runtime):**
  1. **Cliente sem pasta no Drive** → `ensureCaseFolder` lança `CaseDocumentServiceError(..., 409)` "Cliente sem pasta no Drive…" (`case-documents-service.ts:119-123`). Comum quando o cliente foi criado com `drive_sync_failed`.
  2. **MIME/magic-bytes rejeitado** — arquivo com extensão/typo que não bate os magic bytes (o `.type` do browser pode vir vazio → `application/octet-stream`).
  3. **Falha do Google Drive** (Service Account / OAuth / cota) borbulha como 500.
  4. **Caso sem `drive_folder_id`** e cliente sem pasta → 409.
- **NOVO:** cravar a causa real no ambiente do Hyago (ler mensagem/HTTP status que o front recebe) e endurecer: mensagens de erro acionáveis no front + fallback para criar a pasta do cliente/caso quando faltar, em vez de 409 seco.

> **DECISÃO A CONFIRMAR:** reproduzir com o arquivo/cliente reais do Hyago para saber se é 409 (pasta faltando), 4xx (MIME) ou 5xx (Drive). A story cobre **diagnóstico + robustez**, não uma reescrita.

---

## Acceptance Criteria

1. Anexar um PDF/DOC/DOCX válido em um caso cujo cliente tem pasta no Drive conclui com 201 e o doc aparece na lista da aba Documentos.
2. Quando o cliente **não** tem pasta no Drive, o front mostra mensagem acionável ("crie/ressincronize a pasta do cliente") em vez de erro genérico — ou o sistema tenta criar a pasta automaticamente.
3. Arquivo com MIME não suportado retorna erro claro (tipo/extensão aceitos listados).
4. Falha do Drive (Service Account) é logada no servidor e devolve mensagem legível ao usuário (não um 5xx opaco).

---

## Tasks / Subtasks

- [ ] **Diagnóstico** — reproduzir o anexo que falha (capturar status + `error` que o front recebe da rota) e identificar qual dos candidatos (409 pasta / 4xx MIME / 5xx Drive) ocorre.
- [ ] **Robustez** — conforme a causa:
  - 409 pasta: mensagem acionável no front + botão/rotina de ressincronizar pasta do cliente (reusar `resyncDrive` já existente em clients) antes/junto do upload.
  - MIME: garantir lista de tipos aceitos na mensagem; tratar `.type` vazio caindo no sniff por magic-bytes (já existe) e mensagem clara quando não casar.
  - Drive: log servidor + mensagem legível.
- [ ] **Front (aba Documentos do caso)** — exibir a mensagem de erro da rota (não "erro interno") e o estado de sucesso.
- [ ] **Testes** (AC 1-4) — upload válido 201; cliente sem pasta → mensagem acionável; MIME inválido → erro claro. `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**Arquivos a tocar:**
- `sistema-hv/src/routes/api.cases.$id.documents.upload.tsx` (mensagens/log).
- `sistema-hv/src/lib/case-documents-service.ts` (`uploadCaseDocument`, `ensureCaseFolder` — fallback de criação de pasta).
- Componente da aba Documentos do caso (exibição do erro) — provável `sistema-hv/src/components/cases/*` / `CaseDocumentsTab`.

**Regras de ouro pertinentes:**
- Provável **sem migration** (é fluxo Drive/serviço). Se tocar `system_cases` por algum motivo, **recriar `system_cases_active`**.
- Manter dual-write intacto (não é atingido aqui).
- Não retornar 5xx opaco em falha de dependência externa (Drive) — preferir 4xx com mensagem (padrão Vercel 424, ver memória `reference_vercel_5xx_gateway`).

### Testing
- Anexar PDF em caso com cliente que tem pasta → 201 + doc na lista.
- Anexar em caso cujo cliente tem `drive_sync_failed` → mensagem acionável.
- Anexar arquivo com MIME não suportado → erro claro.

---

## Dependências

- **Depende de:** nada (quick win). Pode precisar de `resyncDrive` de clientes (já existe).
- **Cruzamentos:** nenhum com R2/R4 diretamente. Relacionado a R2 apenas se a pasta do caso migrar para (tema,frente) — mas o upload não depende disso.
- **Habilita:** anexos confiáveis para o restante do fluxo do caso.

---

## File List

- `sistema-hv/src/routes/api.cases.$id.documents.upload.tsx`
- `sistema-hv/src/lib/case-documents-service.ts`
- componente da aba Documentos do caso

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — bug B4 anexar documento | @sm |
| 2026-07-18 | 0.2 | C8 (QA): status anotado como "requer ambiente" — depende de reproduzir o erro com arquivo/cliente reais do Hyago para cravar a causa (409/4xx/5xx) antes da robustez. | @sm |
