// Server-only — Sincroniza modelos de documento do Google Drive com a tabela
// system_document_templates. Lê a pasta "07- Modelos" (ou configurável via env),
// mapeia subpastas → case_type, e para cada Google Doc encontrado faz upsert.
// Placeholders (<campo>) são extraídos automaticamente do corpo do documento.

import { getDriveClient, listFilesInFolder } from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const FOLDER_MIME = "application/vnd.google-apps.folder";

// ---------------------------------------------------------------------------
// Mapping: folder name keywords → case_type
// ---------------------------------------------------------------------------
const FOLDER_TO_CASE_TYPE: Record<string, string> = {
  "esf dgm": "FIES_DGM",
  "esf censo": "FIES_ESF",
  "esf portaria": "FIES_ESF",
  fies: "FIES_ESF",
  covid: "COVID",
  militar: "MAIS_MEDICOS",
  "mais medicos": "MAIS_MEDICOS",
  "mais médicos": "MAIS_MEDICOS",
  residencia: "RESIDENCIA",
  residência: "RESIDENCIA",
  cfm: "CFM_CRM",
  crm: "CFM_CRM",
  cobrança: "FIES_ESF",
  cobranca: "FIES_ESF",
};

function folderToCaseType(folderName: string): string | null {
  const lower = folderName.toLowerCase();
  const sorted = Object.entries(FOLDER_TO_CASE_TYPE).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [keyword, caseType] of sorted) {
    if (lower.includes(keyword)) return caseType;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extract <placeholder> patterns from a Google Doc or Office file
// Uses Service Account (has access to Shared Drive files)
// ---------------------------------------------------------------------------
async function extractPlaceholders(docId: string): Promise<string[]> {
  try {
    // Exporta como texto via Service Account
    const drive = getDriveClient();
    let fullText = "";
    try {
      const res = await drive.files.export(
        { fileId: docId, mimeType: "text/plain" },
        { responseType: "text" },
      );
      fullText = typeof res.data === "string" ? res.data : String(res.data ?? "");
    } catch {
      // .docx: tenta exportar via Google Docs API (OAuth) que converte automaticamente
      console.log(`[template-sync] Export SA falhou para ${docId}, tentando via OAuth...`);
      try {
        // Importa o driveClient OAuth (da conta-sistema) que é dona dos modelos
        const { default: { google } } = await import("googleapis");
        const { OAuth2Client } = await import("google-auth-library");
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
        if (clientId && clientSecret && refreshToken) {
          const oauth = new OAuth2Client(clientId, clientSecret);
          oauth.setCredentials({ refresh_token: refreshToken });
          const oauthDrive = google.drive({ version: "v3", auth: oauth });
          // Copia via OAuth (dona dos modelos), exporta, e deleta
          const copy = await oauthDrive.files.copy({
            fileId: docId,
            supportsAllDrives: true,
            requestBody: { name: "_temp_extract", mimeType: GOOGLE_DOC_MIME },
            fields: "id",
          });
          const tmpId = copy.data.id!;
          try {
            const res2 = await oauthDrive.files.export(
              { fileId: tmpId, mimeType: "text/plain" },
              { responseType: "text" },
            );
            fullText = typeof res2.data === "string" ? res2.data : String(res2.data ?? "");
          } finally {
            await oauthDrive.files.delete({ fileId: tmpId }).catch(() => {});
          }
        }
      } catch (oauthErr) {
        console.warn(`[template-sync] OAuth fallback também falhou para ${docId}:`,
          oauthErr instanceof Error ? oauthErr.message : oauthErr);
      }
    }

    // Log: procura qualquer variação de delimitadores de placeholder
    const angleBrackets = fullText.match(/<[^>]{2,}>/g) ?? [];
    const guillemets = fullText.match(/«[^»]{2,}»/g) ?? [];
    const doubleBrackets = fullText.match(/\{\{[^}]{2,}\}\}/g) ?? [];
    const singleAngles = fullText.match(/\u2039[^\u203a]{2,}\u203a/g) ?? [];
    const squareBrackets = fullText.match(/\[[^\]]{2,}\]/g) ?? [];
    console.log(`[template-sync] Doc ${docId}: ${fullText.length} chars | <>=` +
      `${angleBrackets.length} «»=${guillemets.length} {{}}=${doubleBrackets.length} ‹›=${singleAngles.length} []=${squareBrackets.length}`);
    if (angleBrackets.length) console.log(`[template-sync]   Encontrados <> :`, angleBrackets.slice(0, 5));
    if (squareBrackets.length) console.log(`[template-sync]   Encontrados [] :`, squareBrackets.slice(0, 5));
    // Primeiros 500 chars para debug quando nenhum placeholder é encontrado
    if (!angleBrackets.length && !guillemets.length && !doubleBrackets.length && !singleAngles.length && !squareBrackets.length) {
      console.log(`[template-sync]   Preview (sem placeholders): "${fullText.slice(0, 500).replace(/\n/g, "\\n")}"`);
    }

    // Tenta múltiplos formatos de placeholder
    const allMatches = [
      ...angleBrackets,        // <campo>
      ...guillemets,           // «campo»
      ...doubleBrackets,       // {{campo}}
      ...singleAngles,         // ‹campo›
      ...squareBrackets,       // [campo]
    ];

    const unique = [...new Set(allMatches.map((m) => {
      // Remove delimitadores externos
      return m.replace(/^[<«\u2039{\[]+|[>»\u203a}\]]+$/g, "").trim();
    }))].filter((s) => s.length >= 2);
    return unique;
  } catch (err) {
    console.warn(`template-sync: falha ao ler ${docId}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Auto-fill detection: match placeholder text to client/case data
// ---------------------------------------------------------------------------
// Keywords that indicate a placeholder maps to known client data.
// Returns the auto_field name if matched, or null if it's manual.
function detectAutoField(placeholder: string): string | null {
  const lower = placeholder.toLowerCase();
  // "dados pessoais" → client full_name + cpf combo
  if (lower.includes("dados pessoais")) return "dados_pessoais";
  // nome / cliente
  if (/\bnome\b.*\bcliente\b|\bcliente\b.*\bnome\b|\bnome completo\b/.test(lower)) return "client_name";
  if (lower === "nome" || lower === "nome_cliente" || lower === "nome_do_cliente" || lower === "client_name") return "client_name";
  // CPF
  if (/\bcpf\b|\bcnpj\b/.test(lower)) return "cpf";
  // Municipality
  if (/\bmunic[ií]pio\b|\bcidade\b/.test(lower)) return "municipio";
  return null;
}

function fieldSource(key: string): "auto" | "manual" {
  return detectAutoField(key) ? "auto" : "manual";
}

function fieldLabel(placeholder: string): string {
  // For descriptive placeholders, strip " - obrigatório" suffix and capitalize
  const clean = placeholder
    .replace(/\s*-\s*obrigat[oó]rio\s*$/i, "")
    .trim();
  // Capitalize first letter
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function isFieldRequired(placeholder: string): boolean {
  return /obrigat[oó]rio/i.test(placeholder);
}

// ---------------------------------------------------------------------------
// Check if a file is a usable document template
// ---------------------------------------------------------------------------
function isTemplateDoc(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return mimeType === GOOGLE_DOC_MIME
    || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    || mimeType === "application/msword";
}

// ---------------------------------------------------------------------------
// PUBLIC: Extract placeholders from a template (used at generation time)
// ---------------------------------------------------------------------------
export async function getTemplatePlaceholders(googleDocId: string) {
  const raw = await extractPlaceholders(googleDocId);
  return raw.map((ph) => ({
    key: ph,
    label: fieldLabel(ph),
    source: fieldSource(ph) as "auto" | "manual",
    required: isFieldRequired(ph),
    auto_field: detectAutoField(ph) ?? undefined,
  }));
}

// ---------------------------------------------------------------------------
// SYNC
// ---------------------------------------------------------------------------
export type SyncResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  foldersScanned: number;
  filesFound: number;
  details: Array<{ name: string; action: "created" | "updated" | "skipped"; caseType: string | null }>;
};

export async function syncTemplatesFromDrive(modelsFolderId: string): Promise<SyncResult> {
  const sb = getSupabaseAdmin();
  const result: SyncResult = {
    created: 0, updated: 0, skipped: 0,
    errors: [], foldersScanned: 0, filesFound: 0, details: [],
  };

  if (!modelsFolderId) {
    result.errors.push("GOOGLE_DRIVE_TEMPLATES_FOLDER_ID não configurado");
    return result;
  }

  console.log(`[template-sync] Iniciando sync da pasta ${modelsFolderId}`);

  // 1. List everything in the models folder
  const items = await listFilesInFolder(modelsFolderId, 200);
  console.log(`[template-sync] Itens na pasta raiz: ${items.length}`, items.map((i) => `${i.name} (${i.mimeType})`));

  const folders = items.filter((f) => f.mimeType === FOLDER_MIME);
  const looseDocs = items.filter((f) => isTemplateDoc(f.mimeType));

  // 2. Get existing templates for dedup (by google_doc_id AND by name)
  const { data: existing } = await sb
    .from("system_document_templates")
    .select("id, google_doc_id, name, fields")
    .eq("organization_id", DEFAULT_ORG)
    .is("deleted_at", null);
  const existingByDocId = new Map((existing ?? []).map((t) => [t.google_doc_id, t]));
  const existingByName = new Map((existing ?? []).map((t) => [t.name.toLowerCase(), t]));

  // Helper: process a single doc
  async function processDoc(
    doc: { id?: string | null; name?: string | null; mimeType?: string | null },
    caseType: string | null,
  ) {
    if (!doc.id || !doc.name) return;
    // Normaliza: remove extensão, prefixo "Cópia de", e sufixos de modelo
    const docName = doc.name
      .replace(/\.(docx?|pdf|txt)$/i, "")
      .replace(/^c[oó]pia\s+de\s+/i, "")
      .replace(/\s*-\s*modelo$/i, "")
      .replace(/\s*\(modelo\)\s*/i, "")
      .trim();
    result.filesFound++;

    try {
      // Dedup by google_doc_id
      const exById = existingByDocId.get(doc.id);
      if (exById) {
        result.skipped++;
        result.details.push({ name: docName, action: "skipped", caseType });
        return;
      }

      // Dedup by name (avoid creating "1ª Cobrança ADM" twice)
      const exByName = existingByName.get(docName.toLowerCase());
      if (exByName) {
        const isNewNativeDoc = doc.mimeType === GOOGLE_DOC_MIME;
        if (exByName.google_doc_id === doc.id) {
          // Mesmo arquivo, pula
          result.skipped++;
          result.details.push({ name: docName, action: "skipped", caseType });
          return;
        }
        if (!isNewNativeDoc) {
          // Novo é .docx mas já temos registro (provavelmente Google Doc nativo) — pula
          result.skipped++;
          result.details.push({ name: docName, action: "skipped", caseType });
          return;
        }
        // Novo é Google Doc nativo e existente é diferente — atualiza (upgrade de .docx para nativo)
        const newPlaceholders = await extractPlaceholders(doc.id);
        const newFields = newPlaceholders.map((ph) => ({
          key: ph, label: fieldLabel(ph), source: fieldSource(ph),
          required: isFieldRequired(ph),
          ...(detectAutoField(ph) ? { auto_field: detectAutoField(ph) } : {}),
        }));
        await sb
          .from("system_document_templates")
          .update({ google_doc_id: doc.id, case_type: caseType, fields: newFields as never })
          .eq("id", exByName.id);
        existingByDocId.set(doc.id, { ...exByName, google_doc_id: doc.id, fields: newFields });
        existingByName.set(docName.toLowerCase(), { ...exByName, google_doc_id: doc.id, fields: newFields });
        result.updated++;
        result.details.push({ name: docName, action: "updated", caseType });
        return;
      }

      // Extrai placeholders (funciona com Google Doc nativo e .docx via export)
      const placeholders = await extractPlaceholders(doc.id);
      console.log(`[template-sync]   Placeholders em "${docName}":`, placeholders);
      const fields = placeholders.map((ph) => ({
        key: ph,
        label: fieldLabel(ph),
        source: fieldSource(ph),
        required: isFieldRequired(ph),
        ...(detectAutoField(ph) ? { auto_field: detectAutoField(ph) } : {}),
      }));

      await sb.from("system_document_templates").insert({
        organization_id: DEFAULT_ORG,
        name: docName,
        google_doc_id: doc.id,
        case_type: caseType,
        fields: fields as never,
        goes_to_zapsign: false,
        active: true,
      });

      // Track for future dedup within this sync run
      existingByDocId.set(doc.id, { id: "", google_doc_id: doc.id, name: docName, fields: [] });
      existingByName.set(docName.toLowerCase(), { id: "", google_doc_id: doc.id, name: docName, fields: [] });

      result.created++;
      result.details.push({ name: docName, action: "created", caseType });
    } catch (err) {
      const msg = `${docName}: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(`[template-sync] Erro processando ${docName}:`, err);
    }
  }

  // 3. Process each subfolder (recursivo 1 nível)
  for (const folder of folders) {
    if (!folder.id || !folder.name) continue;
    const caseType = folderToCaseType(folder.name);
    result.foldersScanned++;

    console.log(`[template-sync] Escaneando pasta "${folder.name}" → case_type=${caseType ?? "null"}`);

    try {
      const docsInFolder = await listFilesInFolder(folder.id, 100);
      console.log(`[template-sync]   └─ ${docsInFolder.length} itens:`, docsInFolder.map((d) => `${d.name} (${d.mimeType})`));

      const templateDocs = docsInFolder.filter((f) => isTemplateDoc(f.mimeType));
      // Google Docs nativos primeiro — extraem placeholders melhor que .docx
      templateDocs.sort((a, b) => {
        const aIsNative = a.mimeType === GOOGLE_DOC_MIME ? 0 : 1;
        const bIsNative = b.mimeType === GOOGLE_DOC_MIME ? 0 : 1;
        return aIsNative - bIsNative;
      });

      for (const doc of templateDocs) {
        await processDoc(doc, caseType);
      }
    } catch (err) {
      const msg = `Pasta "${folder.name}": ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(`[template-sync] Erro na pasta ${folder.name}:`, err);
    }
  }

  // 4. Process loose docs at root level
  for (const doc of looseDocs) {
    await processDoc(doc, null);
  }

  console.log(`[template-sync] Resultado: ${result.created} criados, ${result.updated} atualizados, ${result.skipped} já existiam, ${result.errors.length} erros`);

  return result;
}
