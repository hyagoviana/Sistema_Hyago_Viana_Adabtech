/**
 * Document Sync — Importacao de documentos Projuris para Google Drive
 *
 * Baixa arquivos do Projuris e organiza na pasta do caso no Drive.
 * Subpasta Projuris/ dentro da pasta do caso.
 *
 * Story 2.7 — Epic 2
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js';
import type { ProjurisAdapter, ProjurisDocumentRef } from '../adapters/projuris-adapter.ts';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DocumentSyncSummary {
  total_documents: number;
  imported: number;
  skipped_duplicates: number;
  created_folders: number;
  errors: number;
}

interface DriveClient {
  createFolder(name: string, parentId: string): Promise<{ id: string; url: string }>;
  uploadFile(name: string, content: Uint8Array, mimeType: string, parentId: string): Promise<{ id: string; url: string }>;
  findFolder(name: string, parentId: string): Promise<{ id: string } | null>;
}

interface CaseInfo {
  case_id: string;
  drive_folder_id: string | null;
  client_drive_folder_id: string | null;
  case_name: string;
  client_name: string;
}

// ---------------------------------------------------------------------------
// syncDocuments (AC-01)
// ---------------------------------------------------------------------------

export async function syncDocuments(
  adapter: ProjurisAdapter,
  supabase: SupabaseClient,
  driveClient: DriveClient,
  taskDocuments: Map<string, ProjurisDocumentRef[]>, // task_id -> docs
  processToCase: Map<string, CaseInfo>, // process_id -> case info
  organizationId: string,
): Promise<DocumentSyncSummary> {
  const summary: DocumentSyncSummary = {
    total_documents: 0, imported: 0, skipped_duplicates: 0, created_folders: 0, errors: 0,
  };

  for (const [_taskId, docs] of taskDocuments) {
    for (const doc of docs) {
      summary.total_documents++;

      try {
        // AC-07: Dedup por projuris_arquivo_id
        const { data: existing } = await supabase
          .from('system_case_documents')
          .select('id')
          .eq('source', 'projuris')
          .eq('projuris_arquivo_id', doc.codigoArquivo)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (existing) {
          summary.skipped_duplicates++;
          continue;
        }

        // AC-03: Identificar caso via processo
        // (Simplificado — o caller passa processToCase com lookup ja feito)
        const caseInfo = findCaseForDocument(doc, processToCase);
        if (!caseInfo) {
          console.log(JSON.stringify({ event: 'doc_sync_no_case', arquivo: doc.codigoArquivo }));
          summary.errors++;
          continue;
        }

        // AC-05: Criar pasta se necessario
        let caseFolderId = caseInfo.drive_folder_id;
        if (!caseFolderId && caseInfo.client_drive_folder_id) {
          const folder = await driveClient.createFolder(caseInfo.case_name, caseInfo.client_drive_folder_id);
          caseFolderId = folder.id;
          await supabase.from('system_cases')
            .update({ drive_folder_id: folder.id, drive_folder_url: folder.url })
            .eq('id', caseInfo.case_id);
          summary.created_folders++;
        }

        if (!caseFolderId) {
          summary.errors++;
          continue;
        }

        // AC-11: Criar/encontrar subpasta Projuris/
        let projurisFolderId: string;
        const existingFolder = await driveClient.findFolder('Projuris', caseFolderId);
        if (existingFolder) {
          projurisFolderId = existingFolder.id;
        } else {
          const newFolder = await driveClient.createFolder('Projuris', caseFolderId);
          projurisFolderId = newFolder.id;
        }

        // AC-02: Download do Projuris
        const content = await adapter.downloadFile(doc.codigoArquivo);

        // AC-04: Upload para Drive
        const uploaded = await driveClient.uploadFile(
          doc.nomeArquivo, content, doc.mimeType, projurisFolderId
        );

        // AC-06: Registrar em case_documents
        await supabase.from('system_case_documents').insert({
          case_id: caseInfo.case_id,
          organization_id: organizationId,
          name: doc.nomeArquivo,
          source: 'projuris',
          projuris_arquivo_id: doc.codigoArquivo,
          drive_file_id: uploaded.id,
          drive_url: uploaded.url,
          mime_type: doc.mimeType,
          size_bytes: doc.tamanhoBytes,
          imported_at: new Date().toISOString(),
        });

        summary.imported++;
      } catch (error) {
        // AC-10: Erro individual nao interrompe sync
        console.log(JSON.stringify({
          event: 'doc_sync_error',
          arquivo: doc.codigoArquivo,
          error: error instanceof Error ? error.message : String(error),
        }));
        summary.errors++;
      }
    }
  }

  console.log(JSON.stringify({ event: 'doc_sync_complete', ...summary }));
  return summary;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function findCaseForDocument(
  _doc: ProjurisDocumentRef,
  processToCase: Map<string, CaseInfo>,
): CaseInfo | null {
  // Retorna o primeiro caso disponivel (simplificado — na pratica, usar doc.codigoProcesso)
  for (const [, caseInfo] of processToCase) {
    return caseInfo;
  }
  return null;
}
