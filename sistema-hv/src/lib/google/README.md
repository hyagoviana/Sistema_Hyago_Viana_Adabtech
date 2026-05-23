# Google Drive helper

Wrapper sobre `googleapis` autenticado via Service Account.
Use APENAS em código server-side (server functions, scripts) — depende de `process.env` e do scope `drive` (não funciona em Edge/browser).

## API

| Função | Uso |
|---|---|
| `createFolder(name, parentId?)` | Cria pasta. `parentId` default = `GOOGLE_DRIVE_ROOT_FOLDER_ID`. |
| `uploadFile({ parentId, name, mimeType, body })` | Sobe arquivo. `body` aceita `Buffer` ou `Readable`. |
| `downloadFile(fileId)` | Retorna `Readable` stream do conteúdo. |
| `deleteFile(fileId)` | Remove arquivo definitivamente (não vai pra lixeira da SA). |
| `getFileMeta(fileId)` | Retorna metadado (nome, tamanho, link, parents). |
| `listFilesInFolder(parentId)` | Lista filhos de uma pasta (até 100). |

## DriveError

Todas as funções acima encapsulam erro em `DriveError`. A classe **sanitiza** mensagens:
- Remove blocos PEM (private key) que vazem em logs.
- Remove strings base64 longas (~80+ chars).
- Trunca em 1000 caracteres.

`error.toJSON()` retorna `{ name, message, status, code, cause }` seguro pra log/response.

## Env esperada

| Var | Obrigatória? | Descrição |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | sim | E-mail da SA (`*.iam.gserviceaccount.com`). |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | sim | Chave PEM. `\n` literais OK — fazemos `.replace(/\\n/g, '\n')`. |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | sim | ID da pasta-raiz compartilhada com a SA. |
| `GOOGLE_DRIVE_SHARED_DRIVE_ID` | não | Só se a raiz estiver dentro de um Shared Drive. |
| `GOOGLE_DRIVE_SCOPES` | não | CSV de scopes; default = `https://www.googleapis.com/auth/drive`. |
