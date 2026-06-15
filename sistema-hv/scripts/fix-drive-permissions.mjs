#!/usr/bin/env node
// ============================================================================
// Sistema HV — Corrige permissões das pastas existentes no Google Drive
// ----------------------------------------------------------------------------
// Adiciona "qualquer pessoa com o link pode visualizar" (anyone → reader)
// em todas as pastas de clientes e casos já criadas.
//
// Uso:
//   node scripts/fix-drive-permissions.mjs            (aplica)
//   node scripts/fix-drive-permissions.mjs --dry-run  (só lista o que faria)
//
// Pré-requisito:
//   - .env.local preenchido com credenciais da SA
//   - SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local
// ============================================================================

import { readFileSync, existsSync } from 'node:fs'
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

// Tenta .env.local primeiro, depois .env
const envLocal = join(__dirname, '..', '.env.local')
const envDefault = join(__dirname, '..', '.env')
const envPath = existsSync(envLocal) ? envLocal : envDefault
const env = loadEnv(envPath)

const SA_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const SA_KEY_RAW = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
const SHARED_DRIVE_ID = env.GOOGLE_DRIVE_SHARED_DRIVE_ID || null
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SA_EMAIL || !SA_KEY_RAW) {
  console.error('❌ Faltam variáveis de SA no .env.local')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const SA_KEY = SA_KEY_RAW.replace(/\\n/g, '\n')

// ─── 2. JWT → access_token ────────────────────────────────────────────────
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

// ─── 3. Supabase REST ─────────────────────────────────────────────────────
async function supabaseQuery(table, select) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&drive_folder_id=not.is.null`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${table}: ${res.status} ${text}`)
  }
  return res.json()
}

// ─── 4. Drive: adicionar permissão ────────────────────────────────────────
async function addReaderPermission(token, folderId) {
  const params = SHARED_DRIVE_ID ? '?supportsAllDrives=true' : ''
  const url = `https://www.googleapis.com/drive/v3/files/${folderId}/permissions${params}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'anyone', role: 'reader' }),
  })
  if (!res.ok) {
    const text = await res.text()
    // 400 com "already has" = já tem a permissão, não é erro
    if (res.status === 400 && text.includes('already')) {
      return { skipped: true }
    }
    throw new Error(`${res.status} ${text}`)
  }
  return { skipped: false }
}

// ─── 5. Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('🔧 Fix Drive Permissions — anyone:reader')
  console.log(`   Modo: ${DRY_RUN ? 'DRY-RUN' : 'EXECUÇÃO'}\n`)

  // Buscar pastas do banco
  console.log('📊 Buscando pastas do Supabase...')

  const [clients, cases] = await Promise.all([
    supabaseQuery('system_clients', 'id,full_name,drive_folder_id'),
    supabaseQuery('system_cases', 'id,case_code,drive_folder_id'),
  ])

  const folders = []
  for (const c of clients) {
    folders.push({ type: 'cliente', label: c.full_name, folderId: c.drive_folder_id })
  }
  for (const c of cases) {
    folders.push({ type: 'caso', label: c.case_code, folderId: c.drive_folder_id })
  }

  console.log(`   Clientes com pasta: ${clients.length}`)
  console.log(`   Casos com pasta:    ${cases.length}`)
  console.log(`   Total a processar:  ${folders.length}\n`)

  if (folders.length === 0) {
    console.log('✅ Nenhuma pasta para corrigir.')
    return
  }

  if (DRY_RUN) {
    console.log('📋 Pastas que seriam atualizadas:')
    for (const f of folders) {
      console.log(`   [${f.type}] ${f.label} → ${f.folderId}`)
    }
    console.log('\n✅ Dry-run concluído. Use sem --dry-run para aplicar.')
    return
  }

  // Obter token
  const token = await getAccessToken()
  console.log('✅ Access token obtido\n')

  const summary = { ok: 0, skipped: 0, errors: 0 }

  for (const f of folders) {
    const prefix = `[${f.type}] ${f.label}`
    try {
      const result = await addReaderPermission(token, f.folderId)
      if (result.skipped) {
        console.log(`   ↪︎  ${prefix} — já compartilhada`)
        summary.skipped++
      } else {
        console.log(`   ✓  ${prefix} — permissão adicionada`)
        summary.ok++
      }
    } catch (err) {
      console.error(`   ✗  ${prefix} — ERRO: ${err.message}`)
      summary.errors++
    }
  }

  console.log('\n' + '━'.repeat(60))
  console.log(`✅ Concluído!  atualizadas: ${summary.ok} · já ok: ${summary.skipped} · erros: ${summary.errors}`)
}

main().catch((err) => {
  console.error('\n❌ ERRO:', err.message)
  process.exit(1)
})
