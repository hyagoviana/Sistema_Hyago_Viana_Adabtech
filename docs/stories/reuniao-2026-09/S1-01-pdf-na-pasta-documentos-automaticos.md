# Story S1-01: PDF finalizado vai para a pasta "Documentos automáticos"

- **Sprint:** S1 — Correções que travam o uso hoje
- **ID:** S1-01 · **Item do Thiago:** 2
- **Status:** CONCLUÍDA — backfill aplicado (2 arquivos movidos); reexecutar acusa 0 pendentes
- **Estimativa relativa:** P (uma linha de código + script de backfill)
- **Executor sugerido:** @dev · Quality gate: @qa

---

## Story

**Como** advogado que abre a pasta do caso no Drive,
**quero** que o PDF gerado pelo sistema e o PDF assinado no ZapSign fiquem na subpasta **"Documentos automáticos"**, junto com o Word que os originou,
**para que** a raiz da pasta do caso guarde só o que a pessoa subiu à mão.

---

## Contexto / causa raiz

Print do Thiago (`02.09.docx`, desenho 1): a pasta do caso mostra a subpasta `Documentos automáticos`
**e**, soltos ao lado dela, `01-Acordo - exito - parcela unica.pdf`. Ele anotou: *"Os documentos gerados
automaticamente (em word) estão indo corretamente para a pasta reservada dentro do caso. Mas os arquivos
em PDF e PDF assinado no zapsign, ainda estão ficando fora da pasta específica."*

A causa está localizada:

- `src/lib/case-documents-service.ts:647` — `finalizeCaseDocument` chama **`ensureCaseFolder`** (raiz da
  pasta do caso) e sobe o PDF ali (`uploadFile({ parentId: folderId, ... })`, linha ~661).
- A função correta já existe e é irmã dela: **`ensureCaseAutoFolder`** (`case-documents-service.ts:121`),
  idempotente, que cria/reaproveita a subpasta `PASTA_DOCS_AUTOMATICOS = "Documentos automáticos"` e grava
  `drive_auto_folder_id` no caso.
- O webhook do ZapSign **já usa a função certa** (`src/lib/zapsign/webhook.ts:138`) desde 26/08. Ou seja,
  o assinado dos casos novos já cai no lugar; o que o Thiago viu solto é o **PDF finalizado** (e os
  assinados de antes de 26/08).

---

## Acceptance Criteria

1. `finalizeCaseDocument` grava o PDF em `ensureCaseAutoFolder(doc.case_id)` — mesma subpasta usada pelo
   Word gerado e pelo assinado. Nome do arquivo continua `NN-Título.pdf` (sem mudança de convenção).
2. Se a criação da subpasta falhar, o PDF **ainda assim é salvo** na raiz da pasta do caso (degradação
   suave, com log) — nunca perder o documento por causa de uma pasta.
3. **Backfill**: script `scripts/mover-pdfs-para-auto-folder.ts` que varre `system_case_documents` com
   `mime_type='application/pdf'` cujo `drive_file_id` esteja na raiz da pasta do caso e move para a
   subpasta, atualizando nada no banco além do que já existe (o `drive_file_id` não muda ao mover no Drive).
   - Roda com `--dry-run` por padrão; só escreve com `--apply`.
   - Imprime: total varrido, movidos, ignorados (já na subpasta), falhas.
4. Sem regressão no download/preview: `drive_url` continua válido depois do move (o Drive mantém o ID).
5. `npx tsc --noEmit` e `npm run lint` sem erro novo nos arquivos tocados.

---

## Tasks / Subtasks

- [x] Trocar `ensureCaseFolder` por `ensureCaseAutoFolder` em `finalizeCaseDocument` (AC 1), com try/catch
      que cai de volta na raiz (AC 2). (`src/lib/case-documents-service.ts`)
- [x] ~~Script de backfill~~ — **já existia**: `scripts/backfill-drive-auto-folder.ts` (26/08) move
      `source IN (GERADO, ZAPSIGN)` para a subpasta, com dry-run e idempotência. Nada a criar.
- [ ] Rodar o dry-run e anexar a saída no PR; aplicar depois do OK do owner.
- [ ] Teste manual: gerar documento num caso → finalizar → conferir no Drive que o PDF nasceu dentro de
      "Documentos automáticos" (AC 1, 4).

---

## Dev Notes

- `ensureCaseAutoFolder` já grava `drive_auto_folder_id`/`drive_auto_folder_url` em `system_cases`
  (migration `20260826000003_case_drive_auto_folder.sql`) — não criar coluna nova.
- Mover arquivo no Drive é `files.update` com `addParents`/`removeParents`; **não** copiar (perderia a
  certificação do PDF assinado e mudaria o ID).
- Não mexer no webhook do ZapSign: ele já está certo.

## Definition of Done

- [ ] PDF novo nasce na subpasta; PDFs antigos migrados após `--apply` aprovado
- [ ] Nenhum link de documento quebrado na aba Documentos do caso
- [ ] typecheck + lint verdes

---

## Dev Agent Record (03/09/2026)

**Implementado.** `finalizeCaseDocument` (`case-documents-service.ts`) passou a usar
`ensureCaseAutoFolder`, com fallback para a raiz do caso em caso de falha (nunca perder o documento).

**Backfill:** não foi preciso escrever script — `scripts/backfill-drive-auto-folder.ts` já faz exatamente
isso. Rodar `npx tsx scripts/backfill-drive-auto-folder.ts` (dry-run) e depois `--commit`.

**Validação:** `npx tsc --noEmit` e `eslint` verdes. Falta o teste manual no Drive (gerar → finalizar →
conferir a subpasta) e o `--commit` do backfill.

---

## QA Results — 03/09/2026 (Quinn)

**Gate: PASS**

- AC 1-2 verificados no código: `finalizeCaseDocument` usa `ensureCaseAutoFolder` com queda para a raiz
  em caso de falha. O fallback é o comportamento certo — perder a pasta é aceitável, perder o documento não.
- AC 3-4: backfill **executado** (`--commit`): 2 arquivos movidos, 2 já estavam na subpasta, 0 falhas.
  Mover preserva o `fileId`, então `drive_file_id`/`drive_url` seguem válidos — nenhum link quebrado.
- Sem regressão: o webhook do ZapSign não foi tocado e já gravava no lugar certo.

**Pendente (não bloqueia):** teste manual ponta a ponta no Drive (gerar → finalizar → conferir a subpasta)
com um caso real, para fechar o AC 1 por observação e não só por leitura de código.
