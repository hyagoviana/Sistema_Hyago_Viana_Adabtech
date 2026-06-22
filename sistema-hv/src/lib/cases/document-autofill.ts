// Auto-preenchimento de placeholders de modelo de documento com dados do
// cliente/caso. Lógica PURA (sem React) — usada tanto no front (GenerateDialog)
// quanto no servidor (geração da procuração ao criar caso comercial).

import { formatCpfCnpj } from "@/lib/format";

export type TemplateField = {
  key: string;
  label: string;
  source: "auto" | "manual" | "blank";
  required?: boolean;
  auto_field?: string;
};

/** Dados de cliente/caso usados para preencher os placeholders. */
export type AutoFillData = {
  clientName?: string;
  clientCpf?: string;
  municipio?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  crm_numero?: string;
  crm_uf?: string;
  oab_numero?: string;
  oab_uf?: string;
  especialidade?: string;
  vinculo_institucional?: string;
  caseCode?: string;
  responsavel?: string;
};

/** Resolve o valor de um placeholder a partir dos dados do cliente/caso. */
export function resolveAutoValue(field: TemplateField, data: AutoFillData): string | undefined {
  // Try auto_field first (set by sync), then fall back to key-based heuristics
  const autoField = field.auto_field?.toLowerCase();
  if (autoField) {
    if (autoField === "client_name") return data.clientName;
    if (autoField === "cpf") return data.clientCpf ? formatCpfCnpj(data.clientCpf) : undefined;
    if (autoField === "municipio") return data.municipio;
    if (autoField === "email") return data.email;
    if (autoField === "phone" || autoField === "telefone") return data.phone;
    if (autoField === "crm" || autoField === "crm_numero") return data.crm_numero;
    if (autoField === "crm_uf") return data.crm_uf;
    if (autoField === "oab" || autoField === "oab_numero") return data.oab_numero;
    if (autoField === "oab_uf") return data.oab_uf;
    if (autoField === "especialidade") return data.especialidade;
    if (autoField === "vinculo_institucional") return data.vinculo_institucional;
    if (autoField === "case_code" || autoField === "codigo_caso") return data.caseCode;
    if (autoField === "responsavel") return data.responsavel;
    if (autoField === "cidade" || autoField === "city") return data.city;
    if (autoField === "estado" || autoField === "uf" || autoField === "state") return data.state;
    // "dados_pessoais" = nome + CPF combinado
    if (autoField === "dados_pessoais") {
      const parts = [
        data.clientName,
        data.clientCpf ? `CPF: ${formatCpfCnpj(data.clientCpf)}` : "",
      ].filter(Boolean);
      return parts.length ? parts.join(", ") : undefined;
    }
  }

  // Fallback: match by key content (for manually created templates)
  const key = field.key.toLowerCase();
  const label = (field.label ?? "").toLowerCase();
  const match = (patterns: RegExp) => patterns.test(key) || patterns.test(label);

  if (/\bdados pessoais\b/.test(key)) {
    const parts = [
      data.clientName,
      data.clientCpf ? `CPF: ${formatCpfCnpj(data.clientCpf)}` : "",
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : undefined;
  }
  // Nome do cliente / médico / profissional → sempre é o nome do cliente
  if (
    match(
      /\b(nome.*cliente|nome.*m[eé]dico|client.*name|nome.*profissional|nome_cliente|nome_do_cliente|nome_medico)\b/,
    ) ||
    key === "nome" ||
    key === "client_name"
  )
    return data.clientName;
  if (match(/\b(cpf|cpf_cnpj|documento)\b/))
    return data.clientCpf ? formatCpfCnpj(data.clientCpf) : undefined;
  if (match(/\bmunic[ií]pio\b/)) return data.municipio;
  if (match(/\be[-_]?mail\b/)) return data.email;
  if (match(/\b(telefone|phone|celular|fone)\b/)) return data.phone;
  if (match(/\b(crm_uf|uf.*crm)\b/)) return data.crm_uf;
  if (match(/\bcrm\b/) && !match(/\buf\b/)) return data.crm_numero;
  if (match(/\b(oab_uf|uf.*oab)\b/)) return data.oab_uf;
  if (match(/\boab\b/) && !match(/\buf\b/)) return data.oab_numero;
  if (match(/\bespecialidade\b/)) return data.especialidade;
  if (match(/\bv[ií]nculo\b/)) return data.vinculo_institucional;
  if (match(/\b(c[oó]digo.*caso|case.*code|numero.*caso)\b/)) return data.caseCode;
  if (match(/\brespons[aá]vel\b/)) return data.responsavel;
  if (match(/\b(cidade|city)\b/)) return data.city;
  if (key === "uf" || key === "estado" || key === "state") return data.state;
  return undefined;
}

/** Monta o AutoFillData a partir de um registro de cliente + dados do caso. */
export function buildAutoFillFromClient(
  client: {
    full_name?: string | null;
    cpf_cnpj?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: unknown;
    professional_data?: unknown;
  },
  caso?: {
    municipio?: string | null;
    case_code?: string | null;
    responsavel?: string | null;
  },
): AutoFillData {
  const addr = (client.address ?? {}) as Record<string, unknown>;
  const prof = (client.professional_data ?? {}) as Record<string, unknown>;
  const pick = (o: Record<string, unknown>, k: string) =>
    typeof o[k] === "string" ? (o[k] as string) : undefined;

  return {
    clientName: client.full_name ?? undefined,
    clientCpf: client.cpf_cnpj ?? undefined,
    municipio: caso?.municipio ?? undefined,
    email: client.email ?? undefined,
    phone: client.phone ?? undefined,
    city: pick(addr, "city"),
    state: pick(addr, "state"),
    crm_numero: pick(prof, "crm_numero"),
    crm_uf: pick(prof, "crm_uf"),
    oab_numero: pick(prof, "oab_numero"),
    oab_uf: pick(prof, "oab_uf"),
    especialidade: pick(prof, "especialidade"),
    vinculo_institucional: pick(prof, "vinculo_institucional"),
    caseCode: caso?.case_code ?? undefined,
    responsavel: caso?.responsavel ?? undefined,
  };
}

/** Resolve todos os placeholders auto-preenchíveis em um mapa key→value. */
export function buildAutoFillValues(
  fields: TemplateField[],
  data: AutoFillData,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.source === "blank") continue;
    const v = resolveAutoValue(f, data);
    if (v) out[f.key] = v;
  }
  return out;
}
