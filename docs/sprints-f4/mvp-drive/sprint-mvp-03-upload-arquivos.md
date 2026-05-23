# Sprint MVP-3 — Upload e Download de Arquivos

| | |
|---|---|
| **Duração** | 4-5 dias úteis |
| **Pré-requisitos** | Sprints MVP-1 ✅ + MVP-2 ✅ |
| **Objetivo** | Anexar arquivos aos clientes, listar, baixar e excluir — tudo via Drive |
| **Bloqueia** | Encerramento do MVP-Drive |

---

## 🎯 Objetivo do Sprint

Habilitar a aba **"Documentos"** na ficha do cliente. Usuário arrasta arquivo → backend sobe pro Drive (pasta do cliente) → grava metadado em `client_documents`. Download via server-proxy.

---

## 📋 Stories

### Story 3.1 — Server route: upload (1.5d)

**Como** sistema
**Quero** receber upload multipart, validar, mandar pro Drive
**Para** evitar que credenciais Drive vazem pro browser

#### Tarefas
- [ ] Criar `sistema-hv/src/routes/api/clients/$id/documents/index.tsx`
- [ ] POST: parse multipart, validações (tamanho, mime), `uploadFile` no Drive, INSERT `client_documents`
- [ ] Validação:
  - Tamanho ≤ 20MB
  - Mime types permitidos: PDF, DOCX, DOC, JPG, PNG, XLSX, TXT, ODT
- [ ] Calcular SHA-256 do conteúdo antes de subir
- [ ] Falha de Drive → rollback (não inserir metadado)
- [ ] Audit log

#### Stub — `api/clients/$id/documents/index.tsx`

```typescript
import { createAPIFileRoute } from '@tanstack/start/api'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { uploadFile, DriveError } from '@/lib/google/drive'
import { createHash } from 'node:crypto'

const MAX_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'image/jpeg',
  'image/png',
  'text/plain',
])

export const APIRoute = createAPIFileRoute('/api/clients/$id/documents')({
  GET: async ({ params }) => {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('client_documents_active')
      .select('*')
      .eq('client_id', params.id)
      .order('created_at', { ascending: false })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data ?? [])
  },

  POST: async ({ request, params }) => {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const description = (form.get('description') as string) || null

    if (!file) return Response.json({ error: 'Arquivo ausente' }, { status: 400 })
    if (file.size > MAX_SIZE) return Response.json({ error: 'Arquivo maior que 20MB' }, { status: 413 })
    if (!ALLOWED_MIMES.has(file.type)) {
      return Response.json({ error: `Tipo não permitido: ${file.type}` }, { status: 415 })
    }

    const sb = getSupabaseAdmin()

    // 1) Buscar cliente e pasta
    const { data: client, error: clientErr } = await sb
      .from('clients')
      .select('id, organization_id, drive_folder_id, drive_sync_failed')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single()
    if (clientErr || !client) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
    if (!client.drive_folder_id) {
      return Response.json({ error: 'Pasta Drive ainda não criada. Tente reconciliar.' }, { status: 409 })
    }

    // 2) Buffer + hash
    const buffer = Buffer.from(await file.arrayBuffer())
    const sha256 = createHash('sha256').update(buffer).digest('hex')

    // 3) Upload Drive
    let driveResult
    try {
      driveResult = await uploadFile({
        parentId: client.drive_folder_id,
        name: file.name,
        mimeType: file.type,
        body: buffer,
      })
    } catch (err) {
      const msg = err instanceof DriveError ? err.message : String(err)
      return Response.json({ error: `Falha no Drive: ${msg}` }, { status: 502 })
    }

    // 4) INSERT metadado
    const { data: doc, error: docErr } = await sb
      .from('client_documents')
      .insert({
        client_id: client.id,
        organization_id: client.organization_id,
        name: file.name,
        description,
        drive_file_id: driveResult.id,
        drive_url: driveResult.url,
        mime_type: driveResult.mimeType,
        size_bytes: driveResult.size,
        sha256,
      })
      .select()
      .single()

    if (docErr) {
      // Rollback parcial: tentar deletar do Drive
      try {
        const { deleteFile } = await import('@/lib/google/drive')
        await deleteFile(driveResult.id)
      } catch {/* log only */}
      return Response.json({ error: docErr.message }, { status: 500 })
    }

    // 5) Audit log
    await sb.from('audit_log').insert({
      organization_id: client.organization_id,
      action: 'document.upload',
      entity_type: 'document',
      entity_id: doc.id,
      diff: { name: file.name, size: file.size, sha256 },
    })

    return Response.json(doc, { status: 201 })
  },
})
```

#### Critérios de Aceite
- [ ] Upload de arquivo válido cria entry em `client_documents` + arquivo no Drive
- [ ] Arquivo > 20MB → 413
- [ ] Mime não permitido → 415
- [ ] Cliente sem `drive_folder_id` → 409 com mensagem clara
- [ ] Falha Drive → 502, nenhum metadado órfão
- [ ] SHA-256 calculado e gravado
- [ ] Audit log preenchido

---

### Story 3.2 — Server route: download via server-proxy (1d)

**Como** sistema
**Quero** servir o arquivo pro browser sem expor a URL do Drive
**Para** manter autorização e auditoria

#### Tarefas
- [ ] Criar `sistema-hv/src/routes/api/clients/$id/documents/$docId/download.tsx`
- [ ] GET: busca metadado, faz `downloadFile` (stream), devolve com `Content-Disposition`
- [ ] Audit log da ação `document.download`

#### Stub — `api/clients/$id/documents/$docId/download.tsx`

```typescript
import { createAPIFileRoute } from '@tanstack/start/api'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { downloadFile, DriveError } from '@/lib/google/drive'

export const APIRoute = createAPIFileRoute('/api/clients/$id/documents/$docId/download')({
  GET: async ({ params }) => {
    const sb = getSupabaseAdmin()
    const { data: doc, error } = await sb
      .from('client_documents')
      .select('*')
      .eq('id', params.docId)
      .eq('client_id', params.id)
      .is('deleted_at', null)
      .single()

    if (error || !doc) return new Response('Documento não encontrado', { status: 404 })

    let stream
    try {
      stream = await downloadFile(doc.drive_file_id)
    } catch (err) {
      const msg = err instanceof DriveError ? err.message : 'erro Drive'
      return new Response(`Falha ao buscar arquivo: ${msg}`, { status: 502 })
    }

    // Audit
    await sb.from('audit_log').insert({
      organization_id: doc.organization_id,
      action: 'document.download',
      entity_type: 'document',
      entity_id: doc.id,
    })

    // Stream → Response
    const webStream = streamToWeb(stream)
    return new Response(webStream, {
      headers: {
        'Content-Type': doc.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.name)}"`,
        'Content-Length': String(doc.size_bytes ?? ''),
        'X-Content-Type-Options': 'nosniff',
      },
    })
  },
})

function streamToWeb(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      stream.on('end', () => controller.close())
      stream.on('error', (err) => controller.error(err))
    },
  })
}
```

#### Critérios de Aceite
- [ ] Download retorna arquivo com mesmo conteúdo do upload (hash bate)
- [ ] Documento excluído → 404
- [ ] `Content-Disposition` força attachment (browser baixa, não abre)
- [ ] Audit log preenchido

---

### Story 3.3 — Server route: excluir documento (0.5d)

**Como** sistema
**Quero** excluir arquivos
**Para** atender ao "direito ao esquecimento"

#### Tarefas
- [ ] DELETE em `api/clients/$id/documents/$docId/index.tsx`
- [ ] Soft-delete no banco
- [ ] Hard-delete no Drive (best effort — se falhar, marca `drive_delete_failed=true`)
- [ ] Audit log

#### Stub — adicionar ao mesmo arquivo de documents

```typescript
DELETE: async ({ params }) => {
  const sb = getSupabaseAdmin()
  const { data: doc } = await sb
    .from('client_documents')
    .select('*')
    .eq('id', params.docId)
    .single()
  if (!doc) return Response.json({ error: 'Não encontrado' }, { status: 404 })

  // Soft delete primeiro
  await sb
    .from('client_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', doc.id)

  // Tentar hard delete no Drive
  try {
    const { deleteFile } = await import('@/lib/google/drive')
    await deleteFile(doc.drive_file_id)
  } catch {/* log, mas não falha o request */}

  await sb.from('audit_log').insert({
    organization_id: doc.organization_id,
    action: 'document.delete',
    entity_type: 'document',
    entity_id: doc.id,
  })

  return Response.json({ ok: true })
}
```

#### Critérios de Aceite
- [ ] DELETE marca `deleted_at` no banco
- [ ] Arquivo removido do Drive (verificação visual)
- [ ] Falha de Drive não bloqueia DELETE no banco
- [ ] Audit log preenchido

---

### Story 3.4 — Hook + UI: aba "Documentos" na ficha do cliente (2d)

**Como** usuário
**Quero** anexar, listar e baixar documentos do cliente
**Para** ter os arquivos do processo organizados

#### Tarefas
- [ ] Hook `useDocuments(clientId)` em `src/hooks/useDocuments.ts`
- [ ] Mutations `useUploadDocument`, `useDeleteDocument`
- [ ] Component `<ClientDocumentsTab>` em `src/components/hv/`
- [ ] Drag-drop usando `<input type="file">` + react-dropzone OU implementação custom (UI Lovable já tem visual)
- [ ] Progress bar durante upload (XHR + onProgress)
- [ ] Lista: nome, tamanho, data, ações (baixar, excluir)
- [ ] Confirmação antes de excluir (AlertDialog)
- [ ] Toast feedback

#### Stub — `useDocuments.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'

export function useDocuments(clientId: string) {
  return useQuery({
    queryKey: queryKeys.documents.byClient(clientId),
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/documents`)
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<Document[]>
    },
    enabled: !!clientId,
  })
}

export function useUploadDocument(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, description }: { file: File; description?: string }) => {
      const form = new FormData()
      form.append('file', file)
      if (description) form.append('description', description)
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documents.byClient(clientId) }),
  })
}

export function useDeleteDocument(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/clients/${clientId}/documents/${docId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documents.byClient(clientId) }),
  })
}

export function downloadDocumentUrl(clientId: string, docId: string) {
  return `/api/clients/${clientId}/documents/${docId}/download`
}
```

#### Critérios de Aceite
- [ ] Drag-drop funciona
- [ ] Lista atualiza após upload sem reload
- [ ] Botão "Baixar" abre download via URL `/api/.../download`
- [ ] Excluir → confirma → remove da lista
- [ ] Mensagem clara se arquivo > 20MB ou tipo inválido
- [ ] **Layout Lovable preservado**

---

## ✅ Definition of Done — Sprint MVP-3

- [ ] Upload funcional com validações
- [ ] Download server-proxy funcional
- [ ] Excluir documento (soft + hard Drive)
- [ ] SHA-256 calculado e gravado
- [ ] Audit log nas 3 ações (upload, download, delete)
- [ ] Testes unitários nos validators e hooks ≥ 70%
- [ ] Smoke test E2E manual: criar cliente → anexar PDF → baixar → conferir hash → excluir
- [ ] Tela responsiva
- [ ] PR aprovado por `@architect` + `@qa`

---

## ⚠️ Riscos identificados

| Risco | Mitigação |
|---|---|
| Cota Drive API (1000 reqs / 100s / user) | Aceitável no MVP; monitorar |
| Stream do Drive falhar no meio do download | Logar bytes baixados; usuário pode tentar de novo |
| Arquivos com nome igual no Drive | Drive permite duplicatas; UI mostra `created_at` |
| Upload grande estourando timeout (Vercel limit ~30s) | Limite de 20MB; arquivos maiores → fase 2 (resumable upload) |
| Mime type spoofado | Validar pelo magic bytes além do header (fase 2) |
| Vazamento de arquivo via URL Drive | server-proxy elimina isso (ADR-MVP-03) |

---

## 🔁 Handoffs

| De | Para | Quando | O quê |
|---|---|---|---|
| @dev | @qa | Story 3.1 concluída | Validar tamanhos e mimes |
| @dev | @architect | Story 3.2 concluída | Revisar segurança do server-proxy |
| @dev | @ux | Story 3.4 | Confirmar adesão ao layout Lovable |
| @qa | @po (Hyago) | Final do sprint | Aceite final do MVP-Drive |

---

## 🎉 Encerramento do MVP-Drive

Ao final desta sprint, o sistema costura **a primeira jornada completa** do usuário:
1. ✅ Cadastra cliente → pasta no Drive criada automaticamente
2. ✅ Edita cliente
3. ✅ Anexa documentos ao cliente → arquivos no Drive
4. ✅ Baixa documentos quando precisar
5. ✅ Soft-delete preservando auditoria

**Próximos passos pós-MVP** (sprints F4 completos):
- Retomar F4-S01 resíduo (LGPD completa, observabilidade, spikes)
- F4-S03 (Casos)
- F4-S05 resíduo (OCR, geração DOCX)
- ... até F4-S11 (Go-live)

— Fim do Sprint MVP-3 e do bloco MVP-Drive —
