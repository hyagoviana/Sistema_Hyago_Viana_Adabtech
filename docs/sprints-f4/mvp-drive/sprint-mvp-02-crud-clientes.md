# Sprint MVP-2 — CRUD Clientes funcional

| | |
|---|---|
| **Duração** | 3-4 dias úteis |
| **Pré-requisitos** | Sprint MVP-1 ✅ completo |
| **Objetivo** | Lista de clientes lendo Supabase real + add/edit/delete + pasta Drive automática |
| **Bloqueia** | Sprint MVP-3 |

---

## 🎯 Objetivo do Sprint

Substituir o mock atual em `clientes.index.tsx` e `clientes.$id.tsx` por dados reais do Supabase. Toda criação de cliente dispara criação de pasta no Drive (via helper criado no MVP-1).

**Layout Lovable preservado 100%** — só conecta lógica por trás.

---

## 📋 Stories

### Story 2.1 — Schema de validação Zod (0.5d)

**Como** developer
**Quero** schemas Zod compartilhados entre browser e server
**Para** ter validação consistente client + server

#### Tarefas
- [ ] Criar `sistema-hv/src/lib/validators/client.ts`
- [ ] Validar CPF (algoritmo) e CNPJ (algoritmo)
- [ ] Validar e-mail, telefone BR
- [ ] Exportar `clientCreateSchema`, `clientUpdateSchema`, tipos derivados

#### Stub — `client.ts`

```typescript
import { z } from 'zod'

const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/
const cnpjRegex = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let check = 11 - (sum % 11)
  if (check >= 10) check = 0
  if (check !== parseInt(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  check = 11 - (sum % 11)
  if (check >= 10) check = 0
  return check === parseInt(digits[10])
}

function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i]
  let check1 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (check1 !== parseInt(digits[12])) return false
  sum = 0
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i]
  const check2 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  return check2 === parseInt(digits[13])
}

export const cpfCnpjSchema = z.string()
  .min(11)
  .refine((v) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length === 11) return isValidCpf(v)
    if (clean.length === 14) return isValidCnpj(v)
    return false
  }, 'CPF ou CNPJ inválido')

export const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).optional(),
  zipcode: z.string().regex(/^\d{5}-?\d{3}$/).optional(),
}).optional()

export const clientCreateSchema = z.object({
  full_name: z.string().min(3, 'Nome muito curto').max(200),
  cpf_cnpj: cpfCnpjSchema,
  email: z.string().email().optional().nullable(),
  phone: z.string().regex(/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/, 'Telefone inválido').optional().nullable(),
  address: addressSchema,
})

export const clientUpdateSchema = clientCreateSchema.partial()

export type ClientCreateInput = z.infer<typeof clientCreateSchema>
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>
```

#### Critérios de Aceite
- [ ] CPF/CNPJ válidos passam, inválidos rejeitam
- [ ] CPFs "sequência igual" (111.111.111-11) são rejeitados
- [ ] Testes unitários cobrindo 10+ casos cada

---

### Story 2.2 — Hook `useClients` com TanStack Query (0.5d)

**Como** developer
**Quero** hooks reutilizáveis para clientes
**Para** rotas/components não duplicarem lógica de fetch

#### Tarefas
- [ ] Criar `sistema-hv/src/hooks/useClients.ts`
- [ ] Exportar `useClientsList`, `useClient`, `useCreateClient`, `useUpdateClient`, `useDeleteClient`
- [ ] Centralizar `queryKeys` em `src/lib/queryKeys.ts`

#### Stub — `useClients.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import type { ClientCreateInput, ClientUpdateInput } from '@/lib/validators/client'
import { queryKeys } from '@/lib/queryKeys'

const sb = createSupabaseBrowserClient()

export function useClientsList(search?: string) {
  return useQuery({
    queryKey: queryKeys.clients.list(search),
    queryFn: async () => {
      let q = sb.from('clients_active').select('*').order('full_name')
      if (search) q = q.ilike('full_name', `%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id),
    queryFn: async () => {
      const { data, error } = await sb.from('clients').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClientCreateInput) => {
      // Chamamos rota server pra criar (cria também pasta no Drive)
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clients.lists() }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ClientUpdateInput }) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.lists() })
      qc.invalidateQueries({ queryKey: queryKeys.clients.detail(vars.id) })
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.clients.lists() }),
  })
}
```

#### Stub — `queryKeys.ts`

```typescript
export const queryKeys = {
  clients: {
    all: ['clients'] as const,
    lists: () => [...queryKeys.clients.all, 'list'] as const,
    list: (search?: string) => [...queryKeys.clients.lists(), { search }] as const,
    details: () => [...queryKeys.clients.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.clients.details(), id] as const,
  },
  documents: {
    all: ['documents'] as const,
    byClient: (clientId: string) => [...queryKeys.documents.all, 'client', clientId] as const,
  },
} as const
```

#### Critérios de Aceite
- [ ] Hooks tipados (sem `any`)
- [ ] Cache invalida corretamente após mutations
- [ ] Loading/error states funcionais

---

### Story 2.3 — Server route: criar cliente + pasta Drive (1d)

**Como** sistema
**Quero** criar cliente no Supabase + criar pasta no Drive atomicamente (best effort)
**Para** o usuário não ter que pensar nisso

#### Tarefas
- [ ] Criar `sistema-hv/src/routes/api/clients/index.tsx` (TanStack Start API route)
- [ ] POST: valida payload, INSERT cliente, cria pasta Drive, UPDATE cliente com `drive_folder_id`
- [ ] Falha de Drive não bloqueia criação (compensação otimista — ADR-MVP-06)
- [ ] Log em `audit_log` (action='client.create')

#### Stub — `api/clients/index.tsx`

```typescript
import { createAPIFileRoute } from '@tanstack/start/api'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createFolder, DriveError } from '@/lib/google/drive'
import { clientCreateSchema } from '@/lib/validators/client'
import slugify from 'slugify'

export const APIRoute = createAPIFileRoute('/api/clients')({
  POST: async ({ request }) => {
    const body = await request.json()
    const parse = clientCreateSchema.safeParse(body)
    if (!parse.success) {
      return new Response(JSON.stringify({ errors: parse.error.flatten() }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const sb = getSupabaseAdmin()
    const orgId = '00000000-0000-0000-0000-000000000001' // MVP: 1 org

    // 1) INSERT cliente
    const { data: client, error } = await sb
      .from('clients')
      .insert({ ...parse.data, organization_id: orgId })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return new Response(JSON.stringify({ error: 'CPF/CNPJ já cadastrado' }), { status: 409 })
      }
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    // 2) Criar pasta no Drive (best effort)
    const folderName = `${slugify(client.full_name, { lower: true })}-${client.cpf_cnpj.replace(/\D/g, '')}`
    try {
      const folder = await createFolder(folderName)
      await sb
        .from('clients')
        .update({
          drive_folder_id: folder.id,
          drive_folder_url: folder.url,
          drive_sync_failed: false,
          drive_sync_error: null,
        })
        .eq('id', client.id)
      client.drive_folder_id = folder.id
      client.drive_folder_url = folder.url
    } catch (err) {
      const msg = err instanceof DriveError ? err.message : String(err)
      await sb
        .from('clients')
        .update({ drive_sync_failed: true, drive_sync_error: msg })
        .eq('id', client.id)
      client.drive_sync_failed = true
      client.drive_sync_error = msg
    }

    // 3) Audit log
    await sb.from('audit_log').insert({
      organization_id: orgId,
      action: 'client.create',
      entity_type: 'client',
      entity_id: client.id,
      diff: parse.data,
    })

    return Response.json(client, { status: 201 })
  },
})
```

#### Critérios de Aceite
- [ ] POST com payload válido cria cliente + pasta Drive
- [ ] POST com CPF duplicado retorna 409
- [ ] POST com payload inválido retorna 400 com `errors`
- [ ] Drive offline: cliente é criado, `drive_sync_failed=true`
- [ ] `audit_log` recebe entry

---

### Story 2.4 — Server routes: editar e soft-delete (0.5d)

**Como** sistema
**Quero** PATCH e DELETE para clientes
**Para** completar o CRUD

#### Tarefas
- [ ] Criar `sistema-hv/src/routes/api/clients/$id.tsx`
- [ ] PATCH: valida `clientUpdateSchema`, UPDATE, log audit
- [ ] DELETE: soft-delete (`deleted_at = now()`), log audit
- [ ] **Não tocar no Drive** no DELETE (arquivos ficam, limpeza futura)

#### Stub — `api/clients/$id.tsx`

```typescript
import { createAPIFileRoute } from '@tanstack/start/api'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { clientUpdateSchema } from '@/lib/validators/client'

export const APIRoute = createAPIFileRoute('/api/clients/$id')({
  PATCH: async ({ request, params }) => {
    const body = await request.json()
    const parse = clientUpdateSchema.safeParse(body)
    if (!parse.success) {
      return Response.json({ errors: parse.error.flatten() }, { status: 400 })
    }
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('clients')
      .update({ ...parse.data, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .is('deleted_at', null)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })

    await sb.from('audit_log').insert({
      organization_id: data.organization_id,
      action: 'client.update',
      entity_type: 'client',
      entity_id: data.id,
      diff: parse.data,
    })

    return Response.json(data)
  },

  DELETE: async ({ params }) => {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id)
      .is('deleted_at', null)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Soft-delete cascata em documentos
    await sb
      .from('client_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('client_id', params.id)
      .is('deleted_at', null)

    await sb.from('audit_log').insert({
      organization_id: data.organization_id,
      action: 'client.delete',
      entity_type: 'client',
      entity_id: data.id,
    })

    return Response.json({ ok: true })
  },
})
```

#### Critérios de Aceite
- [ ] PATCH atualiza cliente
- [ ] DELETE marca `deleted_at` (sem remover linha)
- [ ] DELETE em cascata marca `deleted_at` em documentos
- [ ] `clients_active` view não retorna deletados
- [ ] Audit log capturado nas duas ações

---

### Story 2.5 — UI: conectar `clientes.index.tsx` e modal (1d)

**Como** usuário do sistema
**Quero** ver lista real de clientes e adicionar/editar/excluir
**Para** começar a usar o sistema

#### Tarefas
- [ ] Em `clientes.index.tsx`: remover `import { ... } from '@/mocks/fixtures'` → usar `useClientsList()`
- [ ] Loading state com Skeleton (já tem no shadcn)
- [ ] Error state com Alert
- [ ] Dialog "Novo cliente" usa `useCreateClient()` + react-hook-form + `zodResolver`
- [ ] Dialog "Editar cliente" reusa o mesmo form em modo update
- [ ] Botão excluir → AlertDialog confirmação → `useDeleteClient()`
- [ ] Toast (sonner) para sucesso/erro
- [ ] Banner amarelo se `drive_sync_failed=true` na ficha

#### Critérios de Aceite
- [ ] Lista carrega do Supabase real
- [ ] Add/Edit/Delete funcionam end-to-end
- [ ] Cliente novo aparece na lista imediatamente (cache invalidation)
- [ ] Tela responsiva mantida
- [ ] **Nenhuma mudança visual no layout Lovable** (regra inviolável)

---

### Story 2.6 — UI: ficha do cliente (`clientes.$id.tsx`) lendo dados reais (0.5d)

**Como** usuário
**Quero** ver os detalhes do cliente que vieram do Supabase
**Para** confirmar que o cadastro foi feito

#### Tarefas
- [ ] Substituir mock por `useClient(id)`
- [ ] Mostrar link da pasta Drive (`drive_folder_url`) — botão "Abrir no Drive"
- [ ] Aba "Documentos" — placeholder (será preenchida no MVP-3)
- [ ] Banner se `drive_sync_failed` + botão "Tentar criar pasta novamente"

#### Critérios de Aceite
- [ ] Ficha carrega dados reais
- [ ] Link pra pasta Drive funcional
- [ ] Estados de erro/loading tratados

---

## ✅ Definition of Done — Sprint MVP-2

- [ ] CRUD completo funcionando (lista, criar, editar, excluir)
- [ ] Pasta Drive criada automaticamente a cada novo cliente
- [ ] Validação Zod CPF/CNPJ em todas as entradas
- [ ] Soft-delete preserva auditoria
- [ ] Audit log preenchido nas 3 ações
- [ ] Testes unitários ≥ 70% nos arquivos novos
- [ ] Cenário RLS validado: usuário de outra org não vê clientes
- [ ] Layout Lovable preservado pixel-a-pixel
- [ ] PR aprovado por `@architect` + `@qa`

---

## ⚠️ Riscos identificados

| Risco | Mitigação |
|---|---|
| Slug colidir (clientes com nome igual) | Concatenar com CPF/CNPJ no nome da pasta |
| react-hook-form não jogar bem com shadcn Dialog | Usar o pattern oficial shadcn (Form + FormField) |
| Banco indo de mock pra real quebrar testes existentes | Rodar testes incrementais a cada story |
| Cache TanStack Query stale em listagem | `invalidateQueries` em todas as mutations |

---

## 🔁 Handoffs

| De | Para | Quando | O quê |
|---|---|---|---|
| @dev | @qa | Final story 2.3 | Validar Drive sync + falha controlada |
| @dev | @ux | Pré story 2.5 | Confirmar que não tem mudança visual |
| @dev | @architect | Story 2.5 conclusa | Code review do hook pattern |

— Fim do Sprint MVP-2 —
