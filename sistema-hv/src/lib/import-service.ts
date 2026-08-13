// Server-only — orquestra importacao em massa de clientes/casos.
// NUNCA importe este arquivo em codigo que roda no browser.

import { createCase } from "./cases-service";
import { findOrCreateClient } from "./clients-service";
import { getSupabaseAdmin } from "./supabase/server";
import {
  applyTransform,
  type ColumnMapping,
  type ImportExecuteInput,
  type ImportTemplateCreateInput,
} from "./validators/import";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// Tabelas novas — types serao regenerados apos aplicar a migration.
// Ate la, usamos `from()` com cast via esta helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromAny(sb: ReturnType<typeof getSupabaseAdmin>, table: string) {
  return (sb as any).from(table);
}

export class ImportServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "VALIDATION" | "NOT_FOUND" | "DB_ERROR",
    public readonly status: number,
  ) {
    super(message);
    this.name = "ImportServiceError";
  }
}

// ----------------------------------------------------------------------------
// Templates CRUD
// ----------------------------------------------------------------------------
export async function listImportTemplates() {
  const sb = getSupabaseAdmin();
  const { data, error } = await fromAny(sb, "system_import_mapping_templates")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new ImportServiceError(error.message, "DB_ERROR", 500);
  return data ?? [];
}

export async function getImportTemplate(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await fromAny(sb, "system_import_mapping_templates")
    .select("*")
    .eq("id", id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .is("deleted_at", null)
    .single();
  if (error) throw new ImportServiceError("Template nao encontrado", "NOT_FOUND", 404);
  return data;
}

export async function createImportTemplate(input: ImportTemplateCreateInput, userId?: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await fromAny(sb, "system_import_mapping_templates")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      name: input.name,
      source_system: input.source_system ?? null,
      target_entity: input.target_entity,
      column_mappings: input.column_mappings,
      settings: input.settings ?? {},
      created_by: userId ?? null,
    })
    .select()
    .single();
  if (error) throw new ImportServiceError(error.message, "DB_ERROR", 500);
  return data;
}

export async function deleteImportTemplate(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await fromAny(sb, "system_import_mapping_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", DEFAULT_ORG_ID);
  if (error) throw new ImportServiceError(error.message, "DB_ERROR", 500);
}

// ----------------------------------------------------------------------------
// Historico
// ----------------------------------------------------------------------------
export async function listImportRuns() {
  const sb = getSupabaseAdmin();
  const { data, error } = await fromAny(sb, "system_import_runs")
    .select("*")
    .eq("organization_id", DEFAULT_ORG_ID)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new ImportServiceError(error.message, "DB_ERROR", 500);
  return data ?? [];
}

// ----------------------------------------------------------------------------
// Core: executar importacao
// ----------------------------------------------------------------------------

// Monta um objeto nested a partir de mapeamentos com chaves dot-notation.
// ex.: { "address.street": "Rua X" } => { address: { street: "Rua X" } }
function buildNestedObject(
  row: Record<string, unknown>,
  mappings: ColumnMapping[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const m of mappings) {
    const rawValue = row[m.sourceColumn];
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;

    const transformed = applyTransform(String(rawValue), m.transform);
    if (!transformed) continue;

    // Para campos multiselect, split por ; ou ,
    const value: unknown = m.transform === "split_list"
      ? transformed.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
      : transformed;

    const parts = m.targetField.split(".");
    if (parts.length === 1) {
      result[parts[0]] = value;
    } else {
      // nested: address.street, professional_data.crm_numero, etc.
      const parent = parts[0];
      const child = parts[1];
      if (!result[parent] || typeof result[parent] !== "object") {
        result[parent] = {};
      }
      (result[parent] as Record<string, unknown>)[child] = value;
    }
  }

  return result;
}

type ImportRowError = { row: number; field?: string; message: string };

export async function executeImport(
  input: ImportExecuteInput,
  userId?: string,
): Promise<{
  imported: number;
  skipped: number;
  errors: ImportRowError[];
  importRunId: string;
}> {
  const sb = getSupabaseAdmin();
  const { rows, mappings, targetEntity, templateId, temaId, fileName, fileSize } = input;

  // Separar mapeamentos por entidade
  const clientMappings = mappings.filter((m) => {
    const f = m.targetField;
    return (
      f.startsWith("address.") ||
      f.startsWith("professional_data.") ||
      ["full_name", "cpf_cnpj", "rg", "birth_date", "email", "phone", "tipo"].includes(f)
    );
  });
  const caseMappings = mappings.filter((m) => {
    return ["case_type", "municipio", "proximo_passo", "responsavel", "observacoes"].includes(
      m.targetField,
    );
  });

  let imported = 0;
  let skipped = 0;
  const errors: ImportRowError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const rowNum = i + 1;

    try {
      // --- Importar cliente ---
      if (targetEntity === "client" || targetEntity === "client+case") {
        const clientData = buildNestedObject(row, clientMappings);

        // Validacao basica: precisa ter nome no minimo
        if (!clientData.full_name) {
          errors.push({ row: rowNum, field: "full_name", message: "Nome nao informado" });
          skipped++;
          continue;
        }

        // Defaults para campos obrigatorios ausentes
        if (!clientData.email) clientData.email = "importado@semmail.com";
        if (!clientData.phone) clientData.phone = "00000000000";
        if (!clientData.address) {
          clientData.address = {
            street: "A definir",
            number: "S/N",
            city: "A definir",
            state: "DF",
            zipcode: "00000000",
          };
        }

        const hasCpf = !!clientData.cpf_cnpj && String(clientData.cpf_cnpj).trim().length >= 11;
        let clientId: string | null = null;

        if (hasCpf) {
          // Com CPF — usa findOrCreateClient (dedup por CPF)
          const result = await findOrCreateClient(clientData as Parameters<typeof findOrCreateClient>[0]);
          clientId = result.client.id;
          imported++;
          if (!result.created && result.conflitos.length > 0) {
            for (const c of result.conflitos) {
              errors.push({
                row: rowNum,
                field: c.campo,
                message: `Conflito: valor atual "${c.valor_atual}" difere do novo "${c.valor_novo}"`,
              });
            }
          }
        } else {
          // Sem CPF — insert direto com placeholder unico
          const placeholder = `IMP${Date.now()}${i}`.slice(0, 14).padEnd(14, "0");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const insertPayload: any = {
            organization_id: DEFAULT_ORG_ID,
            full_name: clientData.full_name,
            cpf_cnpj: placeholder,
            person_type: "PF",
            email: clientData.email,
            phone: clientData.phone,
            address: clientData.address,
            rg: clientData.rg ?? null,
            birth_date: clientData.birth_date ?? null,
            tipo: clientData.tipo ?? null,
            professional_data: clientData.professional_data ?? null,
          };
          const { data: inserted, error: insertErr } = await sb
            .from("system_clients")
            .insert(insertPayload)
            .select("id")
            .single();
          if (insertErr || !inserted) {
            errors.push({ row: rowNum, message: insertErr?.message ?? "Erro ao criar cliente" });
            skipped++;
            continue;
          }
          clientId = inserted.id;
          imported++;
        }

        // --- Criar caso vinculado ao cliente (se tem tema selecionado) ---
        if (clientId && temaId) {
          try {
            const caseData = buildNestedObject(row, caseMappings);
            await createCase(
              {
                client_id: clientId,
                case_type: "IMPORTADO",
                tema_id: temaId,
                proximo_passo: (caseData.proximo_passo as string) ?? null,
                responsavel: (caseData.responsavel as string) ?? null,
                municipio: (caseData.municipio as string) ?? null,
                comercial: true,
              },
              userId,
            );
          } catch (caseErr) {
            const msg = caseErr instanceof Error ? caseErr.message : "Erro ao criar caso";
            errors.push({ row: rowNum, field: "caso", message: msg });
          }
        }
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      errors.push({ row: rowNum, message: msg });
      skipped++;
    }
  }

  // Registrar a execucao no historico
  const errorRows = errors.filter(
    (e) => !e.message.startsWith("Conflito:"),
  ).length;

  const { data: run } = await fromAny(sb, "system_import_runs")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      template_id: templateId ?? null,
      file_name: fileName,
      file_size_bytes: fileSize ?? null,
      total_rows: rows.length,
      imported_rows: imported,
      skipped_rows: skipped,
      error_rows: errorRows,
      errors: errors,
      status: errorRows === 0 ? "completed" : skipped === rows.length ? "failed" : "partial",
      target_entity: targetEntity,
      created_by: userId ?? null,
    })
    .select("id")
    .single();

  return {
    imported,
    skipped,
    errors,
    importRunId: run?.id ?? "",
  };
}
