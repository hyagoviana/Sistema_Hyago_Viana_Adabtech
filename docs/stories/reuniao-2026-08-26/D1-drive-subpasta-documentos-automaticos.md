# Story D1: Subpasta "Documentos automáticos" no Drive — criada com o caso, e o que já existe é movido

**Épico:** Reunião 2026-08-26 · **ID:** D1 (item 9 do owner) · **Onda:** 2 · **Status:** Draft
**Executor:** @dev (serviço + Drive) + @data-engineer (coluna + script de backfill) · Quality gate: @qa
**Risco:** MÉDIO — mexe em **arquivo de cliente no Drive**. Mover é operação visível e o backfill roda em cima de dados reais. Exige dry-run.

---

## Story

**Como** quem procura um documento na pasta do cliente,
**quero** que **tudo que o SHV gera** caia numa subpasta fixa **"Documentos automáticos"** dentro da pasta do caso,
**para que** eu possa dizer "está naquela pasta ali" sem caçar entre 40 arquivos soltos.

Thiago: "o sistema criou a pasta do caso da pessoa… quando a gente gera o documento, ele joga aqui no todo. E aí você tem uma situação de que você tem um cliente que tem 40 documentos aqui… na hora que ele cria essa pasta desse caso, ele já cria uma pasta documento automático de uma vez só."

**Decisões do owner (26/08):**
- **Pode mover** o que já existe (não é só daqui para frente).
- A subpasta é para **tudo que é criado por dentro do sistema**.
- **Anexo manual NÃO vai** para essa subpasta — continua na pasta do caso.

---

## Contexto / o que JÁ EXISTE vs NOVO

### JÁ EXISTE

- **Pasta do caso é criada junto com o caso:** `src/lib/cases-service.ts:280-320` — best-effort, dentro da pasta do cliente, com nome humanizado `{Tema} — {Cliente}`; grava `drive_folder_id` / `drive_folder_url` e, em caso de falha, `drive_sync_failed` + `drive_sync_error`.
- **`ensureCaseFolder(caseId)`** — `src/lib/case-documents-service.ts:98` — idempotente; cria a pasta do caso se faltar (e re-sincroniza a pasta do cliente se necessário).
- **Quem escreve no Drive hoje:**
  - `uploadCaseDocument` (linha ~257) → **anexo manual**, `source: "UPLOAD"` (linha 283) — **fica na pasta do caso** (regra do owner).
  - geração por modelo (linha ~373) → `copyTemplate(tpl.google_doc_id, title, caseFolderId)`, `source: "GERADO"` (linha 396) — **é o que muda de destino**.
  - o caminho do ZapSign (`source: "ZAPSIGN"`) — documento assinado que volta.
- **Marcação no banco:** `system_case_documents.source` com CHECK `('GERADO','UPLOAD','ZAPSIGN')` (`20260608000001_case_documents.sql:36`). **É esse campo que separa gerado de anexado** — não precisa heurística por nome.
- **API do Drive:** `src/lib/google/drive.ts` — tem `createFolder`, `renameFolder`, `uploadFile`, `downloadFile`, `deleteFile`, `getFileMeta`, `listFilesInFolder`, `listFoldersInFolder`. **Não tem mover** (é `files.update` com `addParents`/`removeParents`).
- **Script de manutenção com dry-run:** molde em `sistema-hv/scripts/` (o ETL Mais Médicos usa `--dry-run` → `--commit`).

### NOVO

1. Coluna **`drive_auto_folder_id TEXT`** (e opcionalmente `drive_auto_folder_url`) em `system_cases`.
2. **`moveFile(fileId, novoParentId)`** em `src/lib/google/drive.ts`.
3. **`ensureCaseAutoFolder(caseId)`** — idempotente, cria/recupera a subpasta.
4. Criação da subpasta **junto com a pasta do caso** (mesmo bloco best-effort de `createCase`).
5. Geração de documento passa a usar a subpasta como destino.
6. **Script de backfill** (dry-run + commit): cria a subpasta nos casos que já existem e **move** os documentos `GERADO` e `ZAPSIGN` para dentro dela.

---

## Acceptance Criteria

1. **Nome fixo.** A subpasta se chama **"Documentos automáticos"** e fica **dentro da pasta do caso** (não dentro da pasta do cliente).
2. **Nasce com o caso.** Ao criar um caso, a subpasta é criada no mesmo fluxo da pasta do caso, e `drive_auto_folder_id` é gravado. Falha do Drive **não** impede a criação do caso (best-effort, igual hoje: marca `drive_sync_failed`).
3. **Idempotente.** `ensureCaseAutoFolder` nunca cria duas subpastas: se `drive_auto_folder_id` existe, retorna; se não existe mas já há uma pasta com esse nome dentro da pasta do caso (`listFoldersInFolder`), **adota** essa e grava o id.
4. **Documento gerado vai para lá.** Toda geração por modelo (procuração, contrato, documento do caso) cria o arquivo **dentro** da subpasta. O `drive_url` gravado aponta para o arquivo no novo lugar.
5. **Anexo manual NÃO vai.** `uploadCaseDocument` continua gravando na **raiz da pasta do caso** — comportamento inalterado.
6. **Documento assinado (ZapSign).** O arquivo que volta assinado também é guardado na subpasta (é criado pelo sistema).
7. **Backfill com dry-run.** Existe script que: (a) lista casos com `drive_folder_id`; (b) em `--dry-run` imprime quantas subpastas criaria e quantos arquivos moveria, sem tocar em nada; (c) em `--commit` cria a subpasta e **move** os documentos com `source` em (`GERADO`,`ZAPSIGN`) que ainda estão na raiz. Arquivos com `source = UPLOAD` **não são movidos**.
8. **Mover não quebra link.** No Google Drive, mover mantém o mesmo `fileId` — portanto `drive_file_id` e `drive_url` continuam válidos e **não** precisam ser reescritos. O QA confirma abrindo um link antigo depois do move.
9. **Reentrante.** Rodar o backfill duas vezes não duplica pasta nem move nada na segunda passada.
10. **Regressão.** `typecheck` + `lint` limpos; migration 2× + rollback; gerar um documento novo e anexar um manual, conferindo os dois destinos.

---

## Tasks / Subtasks

### T1 — Banco (@data-engineer)
- [ ] `20260826XXXX_case_drive_auto_folder.sql`: `ADD COLUMN IF NOT EXISTS drive_auto_folder_id TEXT`, `drive_auto_folder_url TEXT` em `system_cases` (+ rollback). Aplicar 2×; regenerar `db:types`. (AC-2, AC-10)

### T2 — Drive (@dev)
- [ ] `src/lib/google/drive.ts`: `moveFile(fileId, addParentId, removeParentId?)` usando `files.update` com `addParents`/`removeParents` e `supportsAllDrives`, no mesmo padrão de erro (`DriveError`) das funções vizinhas. (AC-7, AC-8)

### T3 — Serviço (@dev)
- [ ] `case-documents-service.ts`: `ensureCaseAutoFolder(caseId)` — usa `ensureCaseFolder` primeiro; se `drive_auto_folder_id` vazio, procura por nome com `listFoldersInFolder` antes de criar; grava o id. (AC-1, AC-3)
- [ ] Trocar o destino da **geração** (linha ~373) de `caseFolderId` para o id da subpasta. (AC-4)
- [ ] Caminho do ZapSign: mesmo destino. (AC-6)
- [ ] **Não tocar** em `uploadCaseDocument`. (AC-5)
- [ ] `cases-service.ts:280-320`: após criar a pasta do caso, criar a subpasta no mesmo `try` best-effort. (AC-2)

### T4 — Backfill (@dev)
- [ ] `sistema-hv/scripts/backfill-drive-auto-folder.ts` com `--dry-run` (padrão) e `--commit`; relatório por caso (criada/adotada/pulada, N arquivos movidos); tolerante a falha individual (loga e segue). (AC-7, AC-9)

### T5 — QA (@qa)
- [ ] Criar caso novo: pasta do caso + subpasta criadas; gerar documento: cai na subpasta; anexar manual: cai na raiz. (AC-2, AC-4, AC-5)
- [ ] Rodar dry-run e conferir os números contra o Drive antes de commitar. (AC-7)
- [ ] Rodar `--commit` em **um caso de teste primeiro**, abrir um `drive_url` antigo e confirmar que ainda abre. (AC-8)
- [ ] Rodar o backfill 2× — a segunda não faz nada. (AC-9)
- [ ] Caso sem pasta no Drive (`drive_sync_failed`): script pula sem quebrar. (AC-7)

---

## Dev Notes

- **`source` é a fonte da verdade** para decidir o que move. Nada de adivinhar por nome de arquivo ou por extensão.
- **Mover no Drive preserva o fileId** — por isso o AC-8 não pede reescrita de URL. Se o QA encontrar link quebrado, **pare**: significa que a implementação copiou em vez de mover.
- **Best-effort de novo:** a criação da subpasta não pode derrubar a criação do caso. Se falhar, `ensureCaseAutoFolder` conserta na próxima geração de documento.
- **Nome exato importa** para o AC-3 (adoção). Usar a constante em um lugar só, sem repetir string.
- **Rodar o backfill fora do horário do time** — são chamadas ao Drive em cima de pasta que gente usa.

## Testing

- **Dry-run** com relatório conferido a olho no Drive.
- **1 caso piloto** com `--commit`, incluindo caso com procuração assinada (ZapSign) e com anexo manual junto.
- **DB:** migration 2× + rollback.

## Dependências

- Independente das outras stories desta onda (arquivos exclusivos).
- Reduz retrabalho para **TR1** (Trello) e **FN1**: quanto antes as pastas ficarem padronizadas, melhor.

## File List

**Novos**
- `sistema-hv/supabase/migrations/20260826XXXX_case_drive_auto_folder.sql` (+ rollback)
- `sistema-hv/scripts/backfill-drive-auto-folder.ts`

**Alterados**
- `sistema-hv/src/lib/google/drive.ts` (`moveFile`)
- `sistema-hv/src/lib/case-documents-service.ts` (`ensureCaseAutoFolder` + destino da geração/ZapSign)
- `sistema-hv/src/lib/cases-service.ts` (criação junto com a pasta do caso)
- `sistema-hv/src/lib/supabase/types.ts`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-08-26 | v0.1 | Draft inicial; owner autorizou mover o que já existe e confirmou que anexo manual fica fora | @sm (River) |
