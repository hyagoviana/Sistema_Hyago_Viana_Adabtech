# Sprint MVP-1 — Fundação Supabase + Google Drive

| | |
|---|---|
| **Duração** | 3-4 dias úteis |
| **Pré-requisitos** | Credenciais já no `.env.local` + Hyago compartilhar pasta-raiz Drive |
| **Objetivo** | Ter banco operável, RLS validada e Drive acessível via helper |
| **Bloqueia** | Sprints MVP-2 e MVP-3 |

---

## 🎯 Objetivo do Sprint

Costurar a base técnica: migrar schema mínimo no Supabase, montar clientes Supabase server/browser, criar helper de Drive autenticado via Service Account, e validar tudo com smoke tests.

**Ao final desta sprint, conseguimos:**
- Conectar ao Supabase do navegador e do server
- Criar/listar/deletar arquivos no Drive via script
- Validar que cliente A não acessa dado do cliente B (RLS)

---

## 📋 Stories

### Story 1.1 — Migração inicial do schema Supabase (1d)

**Como** developer
**Quero** schema base versionado em migrations
**Para** subir o ambiente de forma reprodutível

#### Tarefas
- [ ] Criar `sistema-hv/supabase/migrations/0001_init.sql`
- [ ] Definir 3 tabelas (`clients`, `client_documents`, `audit_log`)
- [ ] Definir RLS policies (organization-scoped)
- [ ] Definir trigger `update_updated_at_column`
- [ ] Seed: 1 organização default + 1 usuário admin (Hyago)
- [ ] Rodar `npx supabase db push` contra projeto staging
- [ ] Documentar `sistema-hv/supabase/README.md`

#### Schema SQL (completo)

```sql
-- ============================================================================
-- Sistema HV — Migração 0001 — Schema inicial (MVP-Drive)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helper trigger: updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Tabela: organizations (preparada pra multi-tenancy)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  cnpj          TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed org default
INSERT INTO organizations (id, name, cnpj)
VALUES ('00000000-0000-0000-0000-000000000001', 'Hyago Viana Advocacia', NULL)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Tabela: clients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  -- Dados cadastrais
  full_name           TEXT NOT NULL,
  cpf_cnpj            TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  address             JSONB,

  -- Integração Google Drive
  drive_folder_id     TEXT,
  drive_folder_url    TEXT,
  drive_sync_failed   BOOLEAN NOT NULL DEFAULT FALSE,
  drive_sync_error    TEXT,

  -- Auditoria + soft-delete
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT clients_cpf_cnpj_org_unique
    UNIQUE (organization_id, cpf_cnpj)
);

CREATE INDEX idx_clients_org_active ON clients(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_full_name_trgm ON clients USING GIN (full_name gin_trgm_ops);
CREATE INDEX idx_clients_cpf_cnpj ON clients(cpf_cnpj);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View conveniente
CREATE OR REPLACE VIEW clients_active AS
  SELECT * FROM clients WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Tabela: client_documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  name            TEXT NOT NULL,
  description     TEXT,

  -- Google Drive
  drive_file_id   TEXT NOT NULL,
  drive_url       TEXT NOT NULL,

  -- Metadado de arquivo
  mime_type       TEXT,
  size_bytes      BIGINT,
  sha256          TEXT,

  -- Auditoria + soft-delete
  uploaded_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_client_documents_client ON client_documents(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_client_documents_org ON client_documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_client_documents_drive_file ON client_documents(drive_file_id);

CREATE TRIGGER trg_client_documents_updated_at
  BEFORE UPDATE ON client_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View conveniente
CREATE OR REPLACE VIEW client_documents_active AS
  SELECT * FROM client_documents WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Tabela: audit_log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_id        UUID,
  action          TEXT NOT NULL,        -- 'client.create', 'document.upload', etc.
  entity_type     TEXT NOT NULL,        -- 'client', 'document'
  entity_id       UUID NOT NULL,
  diff            JSONB,                -- payload do que mudou
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org_created ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- Helper: extrair organization_id do JWT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() ->> 'organization_id')::UUID,
    -- Fallback MVP: org default
    '00000000-0000-0000-0000-000000000001'::UUID
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- RLS — clients
-- ----------------------------------------------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select_own_org ON clients
  FOR SELECT
  USING (organization_id = current_organization_id());

CREATE POLICY clients_insert_own_org ON clients
  FOR INSERT
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY clients_update_own_org ON clients
  FOR UPDATE
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY clients_delete_own_org ON clients
  FOR DELETE
  USING (organization_id = current_organization_id());

-- ----------------------------------------------------------------------------
-- RLS — client_documents
-- ----------------------------------------------------------------------------
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_documents_select_own_org ON client_documents
  FOR SELECT
  USING (organization_id = current_organization_id());

CREATE POLICY client_documents_insert_own_org ON client_documents
  FOR INSERT
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY client_documents_update_own_org ON client_documents
  FOR UPDATE
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY client_documents_delete_own_org ON client_documents
  FOR DELETE
  USING (organization_id = current_organization_id());

-- ----------------------------------------------------------------------------
-- RLS — audit_log (read-only para usuários do mesmo org)
-- ----------------------------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_own_org ON audit_log
  FOR SELECT
  USING (organization_id = current_organization_id());

-- Insert só via service_role (backend)
```

#### Critérios de Aceite
- [ ] Migration roda sem erros em `staging`
- [ ] `SELECT * FROM clients` com role `anon` retorna vazio (RLS bloqueia)
- [ ] `SELECT * FROM clients` com role `authenticated` + org correto retorna registros
- [ ] CPF/CNPJ duplicado na mesma org rejeitado (constraint UNIQUE)
- [ ] CPF/CNPJ idêntico em orgs diferentes permitido

---

### Story 1.2 — Cliente Supabase (server + browser) (0.5d)

**Como** developer
**Quero** clientes Supabase tipados prontos pra usar
**Para** não duplicar código de autenticação em cada rota

#### Tarefas
- [ ] `npm install @supabase/supabase-js @supabase/ssr`
- [ ] Criar `sistema-hv/src/lib/supabase/types.ts` (gerado via `npx supabase gen types typescript`)
- [ ] Criar `sistema-hv/src/lib/supabase/browser.ts` — cliente browser (anon key)
- [ ] Criar `sistema-hv/src/lib/supabase/server.ts` — cliente server (service role)
- [ ] Adicionar script `npm run db:types` no `package.json`

#### Stub — `browser.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!
  )
}
```

#### Stub — `server.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

let _admin: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseAdmin() {
  if (_admin) return _admin
  _admin = createClient<Database>(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  return _admin
}
```

#### Critérios de Aceite
- [ ] Tipos gerados em `src/lib/supabase/types.ts` (≥ 3 tabelas mapeadas)
- [ ] Browser client conecta com sucesso (test em rota)
- [ ] Server client lê com service_role (bypassa RLS — confirmar com SELECT)

---

### Story 1.3 — Drive helper (autenticação + operações básicas) (1.5d)

**Como** developer
**Quero** um helper que abstrai Google Drive API
**Para** as rotas não terem que lidar com OAuth / JWT da SA

#### Tarefas
- [ ] `npm install googleapis`
- [ ] Criar `sistema-hv/src/lib/google/drive.ts` com funções: `getDriveClient`, `createFolder`, `uploadFile`, `getFileMeta`, `downloadFile`, `deleteFile`, `listFilesInFolder`
- [ ] Suporte a Shared Drive (`supportsAllDrives` + `driveId`)
- [ ] Tratar erros com classe custom `DriveError`

#### Stub — `drive.ts`

```typescript
import { google, drive_v3 } from 'googleapis'
import { JWT } from 'google-auth-library'
import { Readable } from 'node:stream'

const SCOPES = (process.env.GOOGLE_DRIVE_SCOPES?.split(',') ?? [
  'https://www.googleapis.com/auth/drive.file'
])

let _drive: drive_v3.Drive | null = null

function getJWT(): JWT {
  return new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  })
}

export function getDriveClient(): drive_v3.Drive {
  if (_drive) return _drive
  _drive = google.drive({ version: 'v3', auth: getJWT() })
  return _drive
}

const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || undefined
const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!

function commonParams() {
  return sharedDriveId
    ? { supportsAllDrives: true, driveId: sharedDriveId, includeItemsFromAllDrives: true, corpora: 'drive' as const }
    : {}
}

export class DriveError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'DriveError'
  }
}

export async function createFolder(name: string, parentId = rootFolderId) {
  try {
    const drive = getDriveClient()
    const res = await drive.files.create({
      ...commonParams(),
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id, webViewLink',
    })
    return { id: res.data.id!, url: res.data.webViewLink! }
  } catch (err) {
    throw new DriveError(`Falha ao criar pasta "${name}"`, err)
  }
}

export async function uploadFile(opts: {
  parentId: string
  name: string
  mimeType: string
  body: Buffer | Readable
}) {
  try {
    const drive = getDriveClient()
    const res = await drive.files.create({
      ...commonParams(),
      requestBody: {
        name: opts.name,
        parents: [opts.parentId],
        mimeType: opts.mimeType,
      },
      media: {
        mimeType: opts.mimeType,
        body: opts.body instanceof Buffer ? Readable.from(opts.body) : opts.body,
      },
      fields: 'id, webViewLink, size, mimeType',
    })
    return {
      id: res.data.id!,
      url: res.data.webViewLink!,
      size: Number(res.data.size ?? 0),
      mimeType: res.data.mimeType!,
    }
  } catch (err) {
    throw new DriveError(`Falha ao subir arquivo "${opts.name}"`, err)
  }
}

export async function downloadFile(fileId: string): Promise<Readable> {
  try {
    const drive = getDriveClient()
    const res = await drive.files.get(
      { fileId, alt: 'media', ...commonParams() },
      { responseType: 'stream' }
    )
    return res.data as unknown as Readable
  } catch (err) {
    throw new DriveError(`Falha ao baixar arquivo ${fileId}`, err)
  }
}

export async function deleteFile(fileId: string) {
  try {
    const drive = getDriveClient()
    await drive.files.delete({ fileId, ...commonParams() })
  } catch (err) {
    throw new DriveError(`Falha ao deletar arquivo ${fileId}`, err)
  }
}

export async function getFileMeta(fileId: string) {
  const drive = getDriveClient()
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, webViewLink, createdTime, modifiedTime',
    ...commonParams(),
  })
  return res.data
}
```

#### Critérios de Aceite
- [ ] `createFolder` cria pasta visível no Drive
- [ ] `uploadFile` aceita Buffer e Stream
- [ ] `downloadFile` retorna stream consumível
- [ ] `deleteFile` remove arquivo do Drive
- [ ] Erros encapsulados em `DriveError`
- [ ] Suporte a Shared Drive testado com `GOOGLE_DRIVE_SHARED_DRIVE_ID` preenchido

---

### Story 1.4 — Smoke test end-to-end (0.5d)

**Como** developer
**Quero** um script de smoke test
**Para** confirmar que Supabase + Drive funcionam antes de codar UI

#### Tarefas
- [ ] Criar `sistema-hv/scripts/smoke-test.ts`
- [ ] Adicionar `npm run smoke` no `package.json`

#### Stub — `smoke-test.ts`

```typescript
import 'dotenv/config'
import { getSupabaseAdmin } from '../src/lib/supabase/server'
import { createFolder, uploadFile, downloadFile, deleteFile } from '../src/lib/google/drive'

async function main() {
  console.log('🧪 Smoke test — Sistema HV MVP-Drive\n')

  // 1) Supabase
  console.log('1) Supabase: lendo organizations...')
  const sb = getSupabaseAdmin()
  const { data: orgs, error } = await sb.from('organizations').select('*')
  if (error) throw new Error(`Supabase: ${error.message}`)
  console.log(`   ✓ ${orgs?.length} organização(ões) encontrada(s)\n`)

  // 2) Drive: criar pasta
  console.log('2) Drive: criando pasta de teste...')
  const folder = await createFolder(`SMOKE_TEST_${Date.now()}`)
  console.log(`   ✓ Pasta criada: ${folder.url}\n`)

  // 3) Drive: upload
  console.log('3) Drive: upload de arquivo de teste...')
  const file = await uploadFile({
    parentId: folder.id,
    name: 'hello.txt',
    mimeType: 'text/plain',
    body: Buffer.from('Hello from Sistema HV!', 'utf-8'),
  })
  console.log(`   ✓ Arquivo subido: ${file.url} (${file.size} bytes)\n`)

  // 4) Drive: download
  console.log('4) Drive: download...')
  const stream = await downloadFile(file.id)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const content = Buffer.concat(chunks).toString('utf-8')
  console.log(`   ✓ Conteúdo: "${content}"\n`)

  // 5) Cleanup
  console.log('5) Cleanup...')
  await deleteFile(file.id)
  await deleteFile(folder.id)
  console.log('   ✓ Limpeza concluída\n')

  console.log('🎉 Todos os smoke tests passaram!')
}

main().catch((err) => {
  console.error('❌ Smoke test falhou:', err)
  process.exit(1)
})
```

#### Critérios de Aceite
- [ ] `npm run smoke` roda sem erros
- [ ] Pasta + arquivo criados aparecem no Drive (verificação visual do Hyago)
- [ ] Cleanup remove tudo após o teste

---

## ✅ Definition of Done — Sprint MVP-1

- [ ] Migration `0001_init.sql` aplicada em staging
- [ ] Tipos TypeScript gerados (`db:types` script)
- [ ] Drive helper exporta 5 funções core
- [ ] Smoke test passa 5/5
- [ ] RLS validada com cenário "cliente A não vê cliente B"
- [ ] `npm run lint` e `tsc --noEmit` passam
- [ ] PR aprovado por `@architect`
- [ ] README de `supabase/` e `google/` atualizados
- [ ] Memória do projeto atualizada (Orion) — schema migrado, Drive operável

---

## ⚠️ Riscos identificados

| Risco | Mitigação |
|---|---|
| Hyago atrasar em compartilhar pasta com SA | Mockar `GOOGLE_DRIVE_ROOT_FOLDER_ID` em pasta de teste temporária |
| Decisão Shared Drive vs My Drive não tomada | Default = My Drive; refatorar é trivial |
| Private key expirando / mal-formatada | Smoke test detecta no item 2 |
| Limite de cota Drive API (1000 reqs / 100s / user) | OK no MVP; aumentar quota se necessário |
| RLS policy errada deixando vazar dados | Test plan QA cobre 6+ cenários |

---

## 🔁 Handoffs

| De | Para | Quando | O quê |
|---|---|---|---|
| @architect | @dev | Antes de começar | Validar schema + ADR-04 (Shared Drive ou não) |
| @dev | @qa | Final de cada story | Validação RLS + smoke |
| @qa | @dev | Continuação | Gates aprovados, libera MVP-2 |

— Fim do Sprint MVP-1 —
