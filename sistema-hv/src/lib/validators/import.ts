import { z } from "zod";

// ----------------------------------------------------------------------------
// Constantes
// ----------------------------------------------------------------------------
export const SOURCE_SYSTEMS = ["SAJ", "PJe", "Projuris", "ESAJ", "Themis", "GAJUR", "Outro"] as const;
export const TARGET_ENTITIES = ["client", "case", "client+case"] as const;

// ----------------------------------------------------------------------------
// Registry de campos-alvo — cada entrada descreve um campo importavel
// ----------------------------------------------------------------------------
export type TargetFieldDef = {
  key: string;
  label: string;
  entity: "client" | "case";
  required?: boolean;
  group: string;
  fieldType?: string; // text, select, multiselect, date, boolean, number, money
};

export const TARGET_FIELDS: TargetFieldDef[] = [
  // Cliente — dados pessoais
  { key: "full_name", label: "Nome completo", entity: "client", required: true, group: "Dados pessoais" },
  { key: "cpf_cnpj", label: "CPF / CNPJ", entity: "client", required: true, group: "Dados pessoais" },
  { key: "rg", label: "RG", entity: "client", group: "Dados pessoais" },
  { key: "birth_date", label: "Data de nascimento", entity: "client", group: "Dados pessoais" },
  { key: "email", label: "E-mail", entity: "client", required: true, group: "Dados pessoais" },
  { key: "phone", label: "Telefone", entity: "client", required: true, group: "Dados pessoais" },
  { key: "tipo", label: "Tipo de pessoa", entity: "client", group: "Dados pessoais" },

  // Cliente — endereco
  { key: "address.street", label: "Rua / Logradouro", entity: "client", group: "Endereco" },
  { key: "address.number", label: "Numero", entity: "client", group: "Endereco" },
  { key: "address.complement", label: "Complemento", entity: "client", group: "Endereco" },
  { key: "address.neighborhood", label: "Bairro", entity: "client", group: "Endereco" },
  { key: "address.city", label: "Cidade", entity: "client", group: "Endereco" },
  { key: "address.state", label: "UF", entity: "client", group: "Endereco" },
  { key: "address.zipcode", label: "CEP", entity: "client", group: "Endereco" },

  // Cliente — profissional
  { key: "professional_data.crm_numero", label: "CRM - Numero", entity: "client", group: "Profissional" },
  { key: "professional_data.crm_uf", label: "CRM - UF", entity: "client", group: "Profissional" },
  { key: "professional_data.especialidade", label: "Especialidade", entity: "client", group: "Profissional" },
  { key: "professional_data.instituicao_graduacao", label: "Instituicao de graduacao", entity: "client", group: "Profissional" },
  { key: "professional_data.ano_formatura", label: "Ano de formatura", entity: "client", group: "Profissional" },
  { key: "professional_data.observacoes", label: "Observacoes profissionais", entity: "client", group: "Profissional" },

  // Caso
  { key: "case_type", label: "Tipo de caso", entity: "case", group: "Caso" },
  { key: "municipio", label: "Municipio / Comarca", entity: "case", group: "Caso" },
  { key: "proximo_passo", label: "Proximo passo", entity: "case", group: "Caso" },
  { key: "responsavel", label: "Responsavel", entity: "case", group: "Caso" },
  { key: "observacoes", label: "Observacoes do caso", entity: "case", group: "Caso" },
];

// ----------------------------------------------------------------------------
// Transforms disponiveis
// ----------------------------------------------------------------------------
export const TRANSFORMS = [
  { key: "none", label: "Nenhum" },
  { key: "cpf_clean", label: "Limpar CPF/CNPJ (remover pontos/tracos)" },
  { key: "phone_clean", label: "Limpar telefone" },
  { key: "date_br_to_iso", label: "Data BR → ISO (DD/MM/AAAA → AAAA-MM-DD)" },
  { key: "date_us_to_iso", label: "Data US → ISO (MM/DD/AAAA → AAAA-MM-DD)" },
  { key: "cep_clean", label: "Limpar CEP" },
  { key: "trim", label: "Remover espacos" },
  { key: "uppercase", label: "Maiusculas (p/ UF)" },
  { key: "split_list", label: "Separar por ; ou , (multipla escolha)" },
] as const;

export type TransformKey = (typeof TRANSFORMS)[number]["key"];

// ----------------------------------------------------------------------------
// Auto-suggest: dicionario de aliases para mapeamento automatico
// ----------------------------------------------------------------------------
export const COLUMN_ALIASES: Record<string, string[]> = {
  // Cliente — dados pessoais
  full_name: [
    "nome", "nome completo", "name", "razao social", "razão social",
    "nome do cliente", "nome_completo", "cliente", "nome_cliente",
    "nome cliente", "full_name", "fullname",
  ],
  cpf_cnpj: [
    "cpf", "cnpj", "cpf/cnpj", "cpf_cnpj", "documento", "doc",
    "nr documento", "nr_documento", "cpf cnpj", "numero documento",
  ],
  email: ["email", "e-mail", "correio", "mail", "e_mail", "email_cliente"],
  phone: [
    "telefone", "celular", "tel", "phone", "fone", "whatsapp", "contato",
    "telefone_cliente", "celular_cliente", "tel_cliente",
  ],
  rg: ["rg", "identidade", "registro geral", "rg_cliente"],
  birth_date: [
    "nascimento", "data de nascimento", "data nascimento", "dt nasc",
    "dt_nascimento", "data_nascimento", "data nasc", "birth_date",
  ],
  tipo: ["tipo", "tipo pessoa", "tipo_pessoa", "pf_pj", "tipo_cliente"],

  // Cliente — endereco
  "address.street": ["rua", "logradouro", "endereco", "endereço", "street", "end", "endereco_cliente"],
  "address.number": ["numero", "número", "nro", "num", "nr", "numero_endereco"],
  "address.complement": ["complemento", "compl", "apto", "complemento_endereco"],
  "address.neighborhood": ["bairro", "neighborhood", "bairro_cliente"],
  "address.city": ["cidade", "city"],
  "address.state": ["estado", "uf", "state", "sigla_uf", "uf_cliente"],
  "address.zipcode": ["cep", "zip", "codigo postal", "cod_postal", "cep_cliente"],

  // Cliente — profissional
  "professional_data.crm_numero": ["crm", "nr crm", "crm_numero", "numero_crm", "numero crm", "crm numero"],
  "professional_data.crm_uf": ["crm uf", "crm_uf", "uf_crm", "uf crm"],
  "professional_data.especialidade": ["especialidade", "especialidade_medica"],

  // Caso
  case_type: [
    "tipo de caso", "categoria", "tipo caso", "servico", "serviço",
    "tipo_caso", "tipo_servico", "status_caso", "status caso",
  ],
  municipio: [
    "comarca", "foro", "municipio do caso", "municipio_caso", "localidade",
    "municipio", "município", "municipio entrada", "municipio_entrada",
    "municipio_entrada_atual", "municipio atual",
  ],
  proximo_passo: [
    "proximo passo", "próximo passo", "andamento", "proximo_passo",
    "ultimo andamento", "ultimo_andamento", "etapa", "etapa_fluxo",
    "etapa_fluxo_atual", "etapa fluxo atual",
  ],
  responsavel: [
    "responsavel", "responsável", "advogado", "adv", "responsavel_caso",
    "advogado_responsavel", "executor",
  ],
  observacoes: [
    "observacao", "observação", "obs", "notas", "observacoes",
    "observacoes_importadas", "observacoes importadas", "obs_caso",
  ],
};

// Normaliza: lowercase, remove acentos, troca tudo que nao e alfanumerico por espaco
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tokeniza: quebra em palavras individuais
function tokenize(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

export function suggestMapping(sourceColumn: string): string | null {
  const norm = normalize(sourceColumn);
  const tokens = tokenize(sourceColumn);

  // 1) Match exato normalizado
  for (const [targetKey, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const normAlias = normalize(alias);
      if (norm === normAlias) return targetKey;
    }
  }

  // 2) Source contem alias inteiro (ex: "municipio_entrada_atual" contem "municipio entrada")
  for (const [targetKey, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const normAlias = normalize(alias);
      if (norm.includes(normAlias) && normAlias.length >= 3) return targetKey;
    }
  }

  // 3) Match por tokens: se o alias e uma unica palavra e aparece nos tokens do source
  //    (mas so para aliases com 4+ chars, pra evitar falsos positivos com "uf", "nr", etc.)
  for (const [targetKey, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const aliasTokens = tokenize(alias);
      if (aliasTokens.length === 1 && aliasTokens[0].length >= 4) {
        if (tokens.includes(aliasTokens[0])) return targetKey;
      }
    }
  }

  return null;
}

// ----------------------------------------------------------------------------
// Schemas Zod
// ----------------------------------------------------------------------------
export const columnMappingSchema = z.object({
  sourceColumn: z.string().min(1),
  targetField: z.string().min(1),
  transform: z.string().optional(),
});

export type ColumnMapping = z.infer<typeof columnMappingSchema>;

export const importTemplateCreateSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio").max(100),
  source_system: z.string().optional().nullable(),
  target_entity: z.enum(TARGET_ENTITIES),
  column_mappings: z.array(columnMappingSchema).min(1, "Mapeie pelo menos 1 coluna"),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type ImportTemplateCreateInput = z.infer<typeof importTemplateCreateSchema>;

export const importExecuteSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "Nenhuma linha para importar").max(500, "Maximo 500 linhas por importacao"),
  mappings: z.array(columnMappingSchema).min(1, "Mapeie pelo menos 1 coluna"),
  targetEntity: z.enum(TARGET_ENTITIES),
  templateId: z.string().uuid().optional().nullable(),
  temaId: z.string().uuid().optional().nullable(),
  fileName: z.string().min(1),
  fileSize: z.number().optional(),
  criarPastaDrive: z.boolean().optional().default(false),
  marcarComoCliente: z.boolean().optional().default(false),
});

export type ImportExecuteInput = z.infer<typeof importExecuteSchema>;

// ----------------------------------------------------------------------------
// Funcoes de transformacao de valor
// ----------------------------------------------------------------------------
export function applyTransform(value: string, transform?: string): string {
  if (!value || !transform || transform === "none") return value;

  switch (transform) {
    case "cpf_clean":
      return value.replace(/\D/g, "");
    case "phone_clean":
      return value.replace(/\D/g, "");
    case "date_br_to_iso": {
      // DD/MM/YYYY -> YYYY-MM-DD
      const m = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
      return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : value;
    }
    case "date_us_to_iso": {
      // MM/DD/YYYY -> YYYY-MM-DD
      const m = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
      return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : value;
    }
    case "cep_clean":
      return value.replace(/\D/g, "");
    case "trim":
      return value.trim();
    case "uppercase":
      return value.toUpperCase().trim();
    case "split_list":
      // Retorna como string mesmo — o service vai interpretar como array
      return value;
    default:
      return value;
  }
}
