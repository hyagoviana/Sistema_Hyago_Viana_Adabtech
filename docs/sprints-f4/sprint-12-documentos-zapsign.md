# 🖋️ Sprint 12 — Documentos do Caso + Geração (Google Docs) + ZapSign

> **Criado:** 2026-06-08 · **Orquestração:** Orion (aios-master) · **Processo:** SDC (SM → Dev → QA)
> **Contexto:** Fase C + Fase D do `docs/levantamento-entrega-projetos-1-2.md` (virada arquitetural).
> **Decisão de docs:** Google Docs (ver §9 do levantamento). **Decisão ZapSign:** API por token (sandbox first).

---

## Visão

Entregar a jornada **"gerar documento dentro do caso → editar → enviar ao ZapSign → receber assinado na pasta do caso"**, substituindo o fluxo antigo de entrada por e-mail/OCR.

## Dependências e bloqueios

| Item | Depende de | Status |
|---|---|---|
| `system_case_documents` + pasta Drive do caso | `case_id` (já existe) | ✅ desbloqueado |
| Adapter ZapSign (cliente API + webhook) | `ZAPSIGN_API_TOKEN` | ✅ **desbloqueado** (chave no `.env.local`) |
| `system_document_templates` | — (linka a `case_type` atual; migra p/ `service_type_id` na Fase A) | ✅ desbloqueado |
| Geração/edição Google Docs | **OAuth2 da conta-sistema** (refresh token) | 🔴 **BLOQUEADO** — credencial pendente |

> ⚠️ A geração via Google Docs **não roda** até existir o OAuth2 da conta-sistema no `.env` (`GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN`). As stories DOC-4/5 ficam prontas mas em espera.

---

## Backlog de Stories (SDC)

### DOC-1 — Tabela `system_case_documents` + pasta Drive do caso  ✅ desbloqueado
**Como** operacional, **quero** que cada caso tenha sua pasta no Drive e seus documentos registrados, **para** separar docs do caso dos docs pessoais do cliente.
**AC:**
- [ ] Migration: `system_case_documents` (`id, case_id, organization_id, title, document_number, kind, status, drive_file_id, drive_url, mime_type, size_bytes, sha256, zapsign_doc_token, source, created_by, created_at, updated_at, deleted_at`) + view ativa + RLS + trigger de auditoria.
- [ ] `system_cases` ganha `drive_folder_id/url/sync_failed/sync_error`.
- [ ] Sequência de numeração por caso (`document_number`) p/ casar com retorno do ZapSign.
- [ ] Service `case-documents-service.ts` (list/create/softDelete) + rpc + hook.

### DOC-2 — Adapter ZapSign (cliente da API)  ✅ desbloqueado · **ESTA SPRINT**
**Como** sistema, **quero** um cliente tipado da API do ZapSign, **para** criar documentos e obter links de assinatura.
**AC:**
- [ ] `src/lib/zapsign/client.ts` — `getEnv()` (token + baseUrl), `ZapSignError` com sanitização do token, `createDocument()`, `getDocument()`.
- [ ] Suporte a `base64_pdf`, `url_pdf`, `base64_docx`; `signers[]` (name/email/phone/auth_mode/send_automatic_email).
- [ ] Smoke test real contra o **sandbox** validando autenticação.
- [ ] Nunca logar o token (sanitização garantida).

### DOC-3 — `system_document_templates` + CRUD de modelos  ✅ desbloqueado
**Como** admin, **quero** cadastrar modelos por tipo (Google Doc base + placeholders `<campo>` + flag `vai_para_zapsign`), **para** padronizar a geração.
**AC:**
- [ ] Migration `system_document_templates` (`id, organization_id, name, case_type, google_doc_id, fields jsonb, goes_to_zapsign bool, active, ...`).
- [ ] Tela admin de cadastro/listagem de modelos.
- [ ] `fields`: definição auto/manual/obrigatório/em-branco por placeholder.

### DOC-4 — Geração via Google Docs (copy + replaceAllText → PDF)  🔴 bloqueado (OAuth2)
**AC:**
- [ ] OAuth2 da conta-sistema configurado (`google/docs.ts`).
- [ ] `files.copy` do template → pasta do caso; `documents.batchUpdate(replaceAllText)`.
- [ ] Export PDF (+DOCX); grava em `system_case_documents` com numeração.

### DOC-5 — Edição no app (editor Google embutido) + finalizar  🔴 bloqueado (OAuth2)
**AC:**
- [ ] Doc gerado fica "link-editável"; app abre em iframe (fallback nova aba + "Concluí a edição").
- [ ] "Finalizar" → trava o doc (remove edição) + re-export PDF.
- [ ] Aba "Documentos" dentro do caso (`casos.$id.tsx`).

### DOC-6 — "Enviar para ZapSign" + acompanhamento de status  ✅ desbloqueado (após DOC-1/2)
**AC:**
- [ ] Botão (quando `goes_to_zapsign`) → `createDocument()` com o PDF → guarda `zapsign_doc_token` + `sign_url`.
- [ ] Status do documento reflete o ZapSign (pending/signed).

### DOC-7 — Webhook "documento assinado" → baixa PDF original → pasta do caso  ✅ desbloqueado (após DOC-1/2)
**AC:**
- [ ] Rota de webhook (valida origem), idempotente por `zapsign_doc_token`.
- [ ] Ao `signed`: baixa o **PDF original assinado** (não copia) → upload na pasta do caso → atualiza `status`.
- [ ] Evento na timeline do caso.

---

## Ordem de execução (SDC)

1. **DOC-2** (adapter ZapSign + smoke sandbox) ← inicia agora
2. **DOC-1** (case_documents + pasta Drive do caso)
3. **DOC-3** (templates)
4. **DOC-6 / DOC-7** (enviar + webhook) — fecham a metade ZapSign, testável fim-a-fim
5. **DOC-4 / DOC-5** (Google Docs) — quando o OAuth2 da conta-sistema chegar

## Credenciais ainda necessárias

- 🔴 **OAuth2 conta-sistema Google** (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`) — para DOC-4/5.
- 🟡 **Webhook secret do ZapSign** (`ZAPSIGN_WEBHOOK_SECRET`) — para DOC-7 (configurar no painel ZapSign).

---

## Status SDC

| Story | SM (draft) | Dev (impl) | QA (review) |
|---|---|---|---|
| DOC-2 | ✅ | ✅ `src/lib/zapsign/client.ts` | ✅ **CONCLUÍDA** — tsc limpo + sandbox 200 OK + criação de doc fim-a-fim (`scripts/zapsign-create-test.ts`) |
| DOC-1 | ✅ | 📝 migration escrita (`supabase/migrations/20260608000001_case_documents.sql`) — **staged, não aplicada** (opção 1) | ⏳ aplicar + service + UI |
| DOC-3 | ✅ | ⏳ | ⏳ |
| DOC-4 | ✅ | 🔬 **motor provado** (`src/lib/google/docs.ts`: copy/replace/exportPdf/exportDocx) — falta wiring c/ template+caso | ✅ teste fim-a-fim OK (`scripts/google-docs-test.ts`) |
| DOC-5 | ✅ | 🔬 **núcleo provado** (`setLinkEditable`/`lockDocument`/`docUrl` — edição link-editável sem login) — falta aba UI no caso | ✅ doc editável gerado |
| DOC-6 | ✅ | ⏳ | ⏳ |
| DOC-7 | ✅ | 🔬 núcleo provado (`scripts/zapsign-bring-signed.ts`: signed→download→Drive OK) | ⏳ falta rota webhook + idempotência + wiring c/ DOC-1 |
