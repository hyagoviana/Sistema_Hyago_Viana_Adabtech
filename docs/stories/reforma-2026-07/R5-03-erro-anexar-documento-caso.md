# Story R5-03: Bug B4 — erro ao anexar documento ao caso

- **Épico:** R5 — Bugs e ajustes do Hyago (bloco B5)
- **ID:** R5-03
- **Status:** Ready for Review — robustez defensiva implementada para os 3 cenários (fallback de pasta + sniff de MIME + 424 legível). Confirmação em runtime com arquivo/cliente reais do Hyago fica como validação final (ver "Requer confirmação do Hyago").
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

- [x] **Diagnóstico** — mapeados os 3 candidatos no código (sem ambiente do Hyago). **Candidato #1 (409 pasta faltando) é o mais provável** — `ensureCaseFolder` lançava `409` seco em `case-documents-service.ts:119-123` quando `client.drive_folder_id` é null (cliente criado com `drive_sync_failed`). **Candidato #2 (MIME)** confirmado como armadilha real: a rota manda `file.type || "application/octet-stream"` e `.doc/.docx` frequentemente chegam com `.type` vazio → `UPLOAD_ALLOWED_MIMES.has` reprovava um arquivo válido.
- [x] **Robustez** — implementada para os 3:
  - 409 pasta: `ensureCaseFolder` agora, antes de falhar, **tenta criar a pasta do cliente automaticamente** reusando `resyncClientDriveFolder` (clients-service). Só se AINDA faltar retorna mensagem **acionável** ("Abra a ficha do cliente e use 'Sincronizar pasta do Drive'…"), não um 409 seco.
  - MIME: novo `resolveUploadMime()` — quando `.type` vem vazio/`octet-stream`, infere o tipo por magic-bytes (%PDF / OLE / PK+extensão) e extensão do nome; só rejeita quando de fato não é PDF/DOC/DOCX, com mensagem listando os tipos aceitos.
  - Drive: falhas do Drive continuam em **424** (não 5xx opaco) com mensagem legível; a rota agora **loga no servidor** as respostas 424/≥500 para diagnóstico.
- [x] **Front (aba Documentos do caso)** — o toast já exibia `err.message` da rota; estendida a duração para 8s (mensagem 409/415 traz instrução) e mantido o estado de sucesso ("… anexado ao caso").
- [x] **Testes** — `resolveUploadMime` exportado + `case-documents-mime.test.ts` (11 asserts, verde via `npm run test:case-documents`). `tsc --noEmit` sem erro novo nos arquivos tocados; `eslint` limpo; `test:rbac` verde. AC1 (201 caminho feliz) não é reproduzível sem Drive/env — coberto por inspeção.

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

## Requer confirmação do Hyago (validação final em runtime)

O que foi implementado é **seguro** (não depende do ambiente): o fallback de pasta é idempotente e reusa a rotina já testada de clientes; o sniff de MIME só amplia o que era aceito e o `validateUpload` (magic-bytes) continua barrando spoofing. Fica pendente de confirmar com um caso/arquivo reais do Hyago:

- **Qual candidato realmente ocorria** (o mais provável pelo código é #1, pasta faltando; #2 MIME é forte candidato secundário). O fallback + sniff cobrem ambos independentemente da causa.
- **AC1 (caminho feliz, 201)** e a criação de pasta via Service Account só rodam com Drive/env reais — não reproduzíveis localmente sem credenciais.

## File List

- `sistema-hv/src/lib/case-documents-service.ts` — `ensureCaseFolder` (fallback auto-resync da pasta do cliente + mensagem acionável) e `uploadCaseDocument`/`resolveUploadMime` (sniff de MIME quando `.type` vazio/octet-stream).
- `sistema-hv/src/routes/api.cases.$id.documents.upload.tsx` — log servidor das falhas 424/≥500.
- `sistema-hv/src/components/cases/CaseDocumentsTab.tsx` — toast de erro com duração maior (mensagem acionável).
- `sistema-hv/src/lib/case-documents-mime.test.ts` — **novo**, testes do `resolveUploadMime`.
- `sistema-hv/package.json` — script `test:case-documents`.

## Dev Agent Record

- **Agent:** @dev (James)
- **Root cause mais provável (no código):** `case-documents-service.ts:119-123` — `ensureCaseFolder` lançava `CaseDocumentServiceError(409)` seco quando o cliente estava sem `drive_folder_id` (cenário `drive_sync_failed`). Secundário: rota mandava `application/octet-stream` para `.doc/.docx` com `.type` vazio, reprovando arquivo válido em `UPLOAD_ALLOWED_MIMES`.
- **Robustez entregue:** (1) auto-resync da pasta do cliente reusando `resyncClientDriveFolder` antes de falhar; mensagem acionável no lugar do 409 seco. (2) `resolveUploadMime` — inferência por magic-bytes/extensão quando o tipo vem vazio/octet-stream, com `validateUpload` confirmando; mensagem lista PDF/DOC/DOCX. (3) Drive continua 424 legível + log servidor. (4) Front exibe a mensagem da rota (toast 8s).
- **Sem migration** (fluxo Drive/serviço); `system_cases` não teve schema alterado — `system_cases_active` intacta. Dual-write não atingido.
- **Validação:** `npm run typecheck` (sem erro novo nos 4 arquivos tocados; erros pré-existentes em dossie/termo/visibility/casos por types de `system_case_checklist_item_assignees` não regenerados — fora do escopo); `npm run test:case-documents` verde (11/11); `npm run test:rbac` verde; `eslint --fix` limpo nos arquivos tocados.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft do épico R5 (bloco B5) — bug B4 anexar documento | @sm |
| 2026-07-18 | 0.2 | C8 (QA): status anotado como "requer ambiente" — depende de reproduzir o erro com arquivo/cliente reais do Hyago para cravar a causa (409/4xx/5xx) antes da robustez. | @sm |
| 2026-07-18 | 0.3 | Robustez defensiva implementada (sem ambiente do Hyago): fallback auto-resync da pasta do cliente em `ensureCaseFolder` (evita 409 seco), sniff de MIME (`resolveUploadMime`) para `.type` vazio/octet-stream, log servidor de falhas 424/5xx, toast de erro 8s no front. Novo teste `case-documents-mime.test.ts` (+ script). Typecheck/lint/rbac verdes. Status → Ready for Review. | @dev |
