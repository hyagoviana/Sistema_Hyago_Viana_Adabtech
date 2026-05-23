#!/usr/bin/env node
// ============================================================================
// Sistema HV — Setup inicial da estrutura de pastas no Google Drive
// ----------------------------------------------------------------------------
// Script one-shot: cria a árvore de pastas dentro da pasta-raiz compartilhada
// com a Service Account.
//
// Uso:
//   node scripts/setup-drive-folders.mjs            (cria tudo)
//   node scripts/setup-drive-folders.mjs --dry-run  (só lista o que faria)
//
// Pré-requisito:
//   - .env.local preenchido com credenciais da SA
//   - GOOGLE_DRIVE_ROOT_FOLDER_ID apontando pra pasta-raiz
//   - SA tem permissão Editor na pasta-raiz
// ============================================================================

import { readFileSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DRY_RUN = process.argv.includes('--dry-run')

// ─── 1. Carregar .env.local ────────────────────────────────────────────────
function loadEnv(path) {
  const env = {}
  const content = readFileSync(path, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/^\uFEFF/, '')
    if (!line || line.trim().startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue
    const key = line.slice(0, eqIdx).trim()
    let value = line.slice(eqIdx + 1)
    // Remove comentário inline (só fora de aspas)
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hashIdx = value.indexOf('#')
      if (hashIdx !== -1) value = value.slice(0, hashIdx)
    }
    value = value.trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const envPath = join(__dirname, '..', '.env.local')
const env = loadEnv(envPath)

const SA_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const SA_KEY_RAW = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
const ROOT_FOLDER_ID = env.GOOGLE_DRIVE_ROOT_FOLDER_ID
const SHARED_DRIVE_ID = env.GOOGLE_DRIVE_SHARED_DRIVE_ID || null

if (!SA_EMAIL || !SA_KEY_RAW || !ROOT_FOLDER_ID) {
  console.error('❌ Faltam variáveis no .env.local:')
  console.error('   GOOGLE_SERVICE_ACCOUNT_EMAIL =', SA_EMAIL ? '✓' : '✗')
  console.error('   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =', SA_KEY_RAW ? '✓' : '✗')
  console.error('   GOOGLE_DRIVE_ROOT_FOLDER_ID =', ROOT_FOLDER_ID ? '✓' : '✗')
  process.exit(1)
}

const SA_KEY = SA_KEY_RAW.replace(/\\n/g, '\n')

// ─── 2. Gerar JWT e trocar por access_token ────────────────────────────────
function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(claim)),
  ]
  const signingInput = segments.join('.')
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  const signature = signer.sign(SA_KEY)
  const jwt = signingInput + '.' + base64url(signature)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Falha ao obter token: ${res.status} ${text}`)
  }
  const data = await res.json()
  return data.access_token
}

// ─── 3. Helpers de Drive API ───────────────────────────────────────────────
const commonQuery = SHARED_DRIVE_ID ? '&supportsAllDrives=true' : ''

async function getFolderMeta(token, folderId) {
  const url = `https://www.googleapis.com/drive/v3/files/${folderId}` +
    `?fields=id,name,mimeType,driveId,parents${commonQuery}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Falha ao ler pasta ${folderId}: ${res.status} ${text}`)
  }
  return res.json()
}

async function listChildren(token, parentId) {
  const url = `https://www.googleapis.com/drive/v3/files` +
    `?q=${encodeURIComponent(`'${parentId}' in parents and trashed=false`)}` +
    `&fields=files(id,name,mimeType)` +
    `&pageSize=100${commonQuery}` +
    (SHARED_DRIVE_ID ? `&driveId=${SHARED_DRIVE_ID}&corpora=drive&includeItemsFromAllDrives=true` : '')
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Falha ao listar filhos: ${res.status} ${text}`)
  }
  const data = await res.json()
  return data.files || []
}

async function createFolder(token, name, parentId) {
  if (DRY_RUN) {
    return { id: `[dry-run]`, name }
  }
  const url = `https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink${commonQuery}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Falha ao criar "${name}": ${res.status} ${text}`)
  }
  return res.json()
}

async function ensureFolder(token, name, parentId, existingChildren) {
  const existing = existingChildren.find(
    (c) => c.name === name && c.mimeType === 'application/vnd.google-apps.folder'
  )
  if (existing) {
    console.log(`   ↪︎  já existe — ${name} (${existing.id})`)
    return { id: existing.id, name, skipped: true }
  }
  const created = await createFolder(token, name, parentId)
  console.log(`   ✓  criada — ${name} (${created.id})`)
  return { id: created.id, name, skipped: false }
}

// ─── 4. Estrutura desejada ─────────────────────────────────────────────────
const TREE = [
  { name: '01 - Clientes' }, // SA cria subpastas aqui automaticamente
  { name: '02 - Funcionarios' },
  {
    name: '03 - Templates e Modelos',
    children: ['Peticoes', 'Contratos', 'Procuracoes', 'Declaracoes'],
  },
  {
    name: '04 - Escritorio',
    children: [
      'Documentos legais',
      'Contratos com terceiros',
      'Identidade visual',
    ],
  },
  {
    name: '05 - Financeiro',
    children: ['Notas fiscais', 'Recibos', 'Extratos bancarios'],
  },
  {
    name: '06 - Marketing',
    children: ['Conteudo (blog, posts)', 'Materiais visuais'],
  },
  { name: '99 - Arquivo Morto' },
]

// ─── 5. Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Sistema HV — Setup de pastas no Google Drive')
  console.log(`   Pasta-raiz: ${ROOT_FOLDER_ID}`)
  console.log(`   Shared Drive: ${SHARED_DRIVE_ID || '(My Drive)'}`)
  console.log(`   Modo: ${DRY_RUN ? 'DRY-RUN' : 'EXECUÇÃO'}\n`)

  const token = await getAccessToken()
  console.log('✅ Access token obtido\n')

  // Validar acesso à pasta-raiz
  console.log('🔍 Validando acesso à pasta-raiz...')
  const root = await getFolderMeta(token, ROOT_FOLDER_ID)
  console.log(`   Pasta: "${root.name}"`)
  console.log(`   MIME: ${root.mimeType}`)
  console.log(`   driveId: ${root.driveId || '(My Drive)'}\n`)

  if (root.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('O ID fornecido não é uma pasta!')
  }

  // Listar filhos existentes pra ser idempotente
  const existingChildren = await listChildren(token, ROOT_FOLDER_ID)
  console.log(`📁 Filhos atuais da raiz: ${existingChildren.length}`)
  if (existingChildren.length > 0) {
    console.log('   (idempotente — vou pular o que já existe)\n')
  } else {
    console.log()
  }

  const summary = { created: 0, skipped: 0 }

  for (const node of TREE) {
    console.log(`📂 ${node.name}`)
    const folder = await ensureFolder(token, node.name, ROOT_FOLDER_ID, existingChildren)
    folder.skipped ? summary.skipped++ : summary.created++

    if (node.children) {
      const subChildren = await listChildren(token, folder.id)
      for (const child of node.children) {
        const sub = await ensureFolder(token, child, folder.id, subChildren)
        sub.skipped ? summary.skipped++ : summary.created++
      }
    }
    console.log()
  }

  console.log('━'.repeat(60))
  console.log(`✅ Concluído!  criadas: ${summary.created} · puladas: ${summary.skipped}`)
  console.log(`🔗 https://drive.google.com/drive/folders/${ROOT_FOLDER_ID}`)
}

main().catch((err) => {
  console.error('\n❌ ERRO:', err.message)
  if (err.message.includes('403') || err.message.includes('404')) {
    console.error('\n💡 Possíveis causas:')
    console.error('   1. Pasta-raiz não compartilhada com a SA')
    console.error(`      → Compartilhe com: ${SA_EMAIL}`)
    console.error('      → Permissão: Editor')
    console.error('   2. Se for Shared Drive, a SA precisa ser MEMBRO do Drive (não só da pasta)')
    console.error('   3. Google Drive API não habilitada no projeto GCP "hv-sistema"')
  }
  process.exit(1)
})
