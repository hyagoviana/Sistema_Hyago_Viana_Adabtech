# Sprint 5 — Documentos + Geradores + Drive

> **Versão:** 1.0 · **Status:** Pendente
> **Estimativa:** 10 dias úteis · **Épico PRD 1:** 4 — Documentos

---

## Objetivo

Tornar a aba **Documentos** plenamente funcional: upload via drag-drop/click, preview inline (PDF/imagem), OCR automático, hash SHA-256, status canônicos por tipo de caso, geração de **Declaração COVID (Doc 06)** e **DGM (Doc específico ESF)** via merge em templates DOCX, e sincronização **bidirecional com Google Drive** (upload local → Drive, e leitura inicial de pasta Drive existente para popular casos).

---

## Stories cobertas (PRD 1 §6)

| Story PRD | Título | Estimativa |
|---|---|---|
| **4.1** | Upload e gestão de documentos | 3d |
| **4.2** | Documentos canônicos por tipo de caso | 2d |
| **4.3** | Geração de Declaração COVID | 2.5d |
| **4.4** | Geração de DGM | 2.5d |

---

## Telas Lovable tocadas

- `casos.$id.tsx` (aba Documentos)
- `casos.$id.termo.tsx` e `casos.$id.termo.elaborar.tsx` — usam os mesmos componentes de upload
- Componentes shadcn já no projeto: `Card`, `Dialog`, `Progress`, `Badge`

---

## Entregas-chave

### Upload + Storage (Story 4.1)
- Drag-drop ou click; múltiplos arquivos até 20MB cada
- Bucket Supabase Storage `case-documents` com RLS (path: `{org_id}/{case_id}/{doc_id}.{ext}`)
- Preview inline: PDF via `<iframe>` ou `pdf.js`; imagem via `<img>`
- Hash SHA-256 calculado client-side (lib `crypto.subtle`) e validado server-side
- OCR via Edge Function chamando **Tesseract** (Edge runtime) ou **Google Vision API** (decisão no ADR-005 — Vision tem custo, Tesseract demora; padrão: Vision para PDFs grandes, Tesseract para imagens pequenas)
- OCR < 30s p95; texto em `case_documents.ocr_text` (indexado GIN PT)

### Canônicos por tipo (Story 4.2)
- Tabela `canonical_docs_by_type` (org-scoped, seed por tipo): DOC-01 a DOC-14 com `nome`, `obrigatorio`, `condicao_aplicacao`
- UI mostra lista canônica + status: PENDENTE/RECEBIDO/GERADO/DISPENSADO/APROVADO
- Botão "Solicitar via WhatsApp/Portal" quando PENDENTE (integração real vem no Sprint 9; aqui apenas registra task)
- JUR aprova doc recebido → muda status para APROVADO + evento

### Geração Declaração COVID Doc 06 (Story 4.3)
- Edge Function `generate-declaracao-covid`: merge dados Cliente + Caso em template DOCX (`docxtemplater`) → converte para PDF (`libreoffice` em container ou `pdf-lib`)
- PDF salvo em Storage + Drive (path padronizado)
- Após upload de assinada pelo Secretário Municipal, status canônico vira RECEBIDO + QA pendente
- QA checklist 7 itens (PRD 1 §3.2) em modal shadcn

### Geração DGM (Story 4.4)
- Mesma mecânica do COVID
- Botão "Gerar DGM" disponível apenas em `DOCS_PENDENTES` para casos `FIES_ESF_DGM`
- Após geração → transição automática para `DGM_ENVIADA` + alerta de follow-up D+7/D+15/D+30 (régua real entra no Sprint 7)

### Google Drive sync
- Service account Google Workspace + escopo Drive
- Edge Function `sync-drive-folder`: cria pasta `Clientes/{Nome-CPF}/Caso-{code}/{Saldos|Termo|Financeiro}/` ao criar cliente/caso
- Upload local sincroniza para Drive em background (queue via `case_outbox_events`)
- Leitura inicial: comando admin para indexar pasta Drive existente em um caso (útil para casos legados)

---

## Riscos principais

| # | Risco | Mitigação |
|---|---|---|
| **S5-R1** | OCR via Tesseract estoura timeout Edge Function (10s/30s) | Job assíncrono com fila `case_outbox_events`; UI mostra "OCR em andamento" |
| **S5-R2** | docxtemplater + conversão PDF complexa em Edge runtime | Spike no dia 1; fallback: Cloud Run container; documentar em ADR-006 |
| **S5-R3** | Drive API rate limit (1000 req/100s) na importação massiva | Backoff exponencial; processar em lotes de 50 |
| **S5-R4** | Hash SHA-256 client-side falha em arquivos grandes (>100MB) | Limite 20MB já cobre 99% dos casos; >20MB rejeita com mensagem clara |
| **S5-R5** | RLS no Storage diferente de RLS Postgres | Policies separadas no Storage referenciando `auth.org_id()`; teste cross-org no audit-rls |

---

## Definition of Done (além do global)

- [ ] 4 stories com ACs cumpridos
- [ ] Smoke E2E: upload PDF → OCR < 30s → preview inline → hash validado
- [ ] Smoke E2E: gerar Declaração COVID + DGM com merge correto
- [ ] Drive: pasta criada automaticamente, upload sincroniza
- [ ] RLS Storage: usuário de outra org recebe 403 ao tentar baixar
- [ ] ADR-005 (OCR) + ADR-006 (Geração PDF) registrados

---

## Próximo sprint

[**Sprint 6 — Onboarding ZapSign + Portal V1**](./sprint-06-zapsign-portal.md)

---

> _— @pm John, sob coordenação do Orion 🎯_
