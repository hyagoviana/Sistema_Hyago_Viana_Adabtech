import { z } from "zod";

import { UF_SIGLAS } from "@/lib/br/estados";

// ----------------------------------------------------------------------------
// Algoritmo CPF (Receita Federal)
// ----------------------------------------------------------------------------
export function isValidCpf(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (check !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return check === parseInt(digits[10], 10);
}

// ----------------------------------------------------------------------------
// Algoritmo CNPJ (Receita Federal)
// ----------------------------------------------------------------------------
export function isValidCnpj(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i], 10) * w1[i];
  const check1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (check1 !== parseInt(digits[12], 10)) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i], 10) * w2[i];
  const check2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return check2 === parseInt(digits[13], 10);
}

// Devolve só os dígitos — usado antes de gravar no banco (UNIQUE assume canônico).
export function sanitizeCpfCnpj(input: string): string {
  return input.replace(/\D/g, "");
}

// ----------------------------------------------------------------------------
// Schemas Zod
// ----------------------------------------------------------------------------

// CPF (11) ou CNPJ (14). Aceita formatado ou só dígitos no input — sempre
// retorna canônico (só dígitos) via `transform`.
export const cpfCnpjSchema = z
  .string()
  .trim()
  .min(11, "CPF/CNPJ muito curto")
  .refine(
    (v) => {
      const clean = sanitizeCpfCnpj(v);
      if (clean.length === 11) return isValidCpf(clean);
      if (clean.length === 14) return isValidCnpj(clean);
      return false;
    },
    { message: "CPF ou CNPJ inválido" },
  )
  .transform(sanitizeCpfCnpj);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/, "Telefone inválido (formato esperado: (99) 99999-9999)")
  .transform((v) => v.replace(/\D/g, ""));

// Endereço do cadastro (Melhoria 2): CEP, rua, número, UF e município são
// obrigatórios; complemento e bairro são opcionais. UF e município são
// escolhidos em selects (UF válida / município vindo do IBGE), nunca digitados.
export const addressSchema = z.object({
  street: z.string().trim().min(1, "Informe a rua").max(200),
  number: z.string().trim().min(1, "Informe o número (use S/N se não houver)").max(20),
  complement: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  neighborhood: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  city: z.string().trim().min(1, "Selecione o município").max(100),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, "Selecione a UF")
    .refine((v) => UF_SIGLAS.includes(v), "UF inválida"),
  zipcode: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido")
    .transform((v) => v.replace(/\D/g, "")),
});

// ----------------------------------------------------------------------------
// Atributos profissionais estruturados (P1 — item 1 do escopo)
// ----------------------------------------------------------------------------
// Programas governamentais que o escritório atende. Alinhado aos tipos de caso.
export const PROGRAMAS_GOVERNAMENTAIS = [
  "FIES",
  "MAIS_MEDICOS",
  "MEDICOS_BRASIL_FORMACAO",
  "RESIDENCIA_MEDICA",
] as const;

export const PROGRAMA_LABELS: Record<(typeof PROGRAMAS_GOVERNAMENTAIS)[number], string> = {
  FIES: "FIES",
  MAIS_MEDICOS: "Programa Mais Médicos",
  MEDICOS_BRASIL_FORMACAO: "Médicos pelo Brasil · Formação",
  RESIDENCIA_MEDICA: "Residência Médica",
};

// UF opcional: aceita "" (vira null) ou sigla de 2 letras.
const ufOptional = z
  .string()
  .trim()
  .toUpperCase()
  .length(2, "UF deve ter 2 letras")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

const textOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null));

export const professionalDataSchema = z
  .object({
    crm_numero: textOptional(20),
    crm_uf: ufOptional,
    // RG — órgão emissor (ex.: SSP/BA). Guardado no JSONB professional_data para
    // não exigir migração de coluna.
    rg_orgao: textOptional(20),
    // Estado civil (ex.: solteira, casado) — usado no bloco "dados pessoais" de
    // alguns documentos (ex.: COVID). Em professional_data (sem migração).
    estado_civil: textOptional(30),
    oab_numero: textOptional(20),
    oab_uf: ufOptional,
    vinculo_institucional: textOptional(100), // ex.: ANMR, AMPB
    especialidade: textOptional(100),
    // Formação / FIES / Residência (Hyago 2, 2026-07-06) — em professional_data.
    instituicao_graduacao: textOptional(150),
    ano_formatura: textOptional(4),
    fies: textOptional(10), // "Sim" | "Não"
    fies_contrato_numero: textOptional(50),
    fies_contrato_obs: textOptional(500),
    residencia_hospital: textOptional(150),
    residencia_inicio: textOptional(10),
    residencia_termino: textOptional(10),
    residencia_especialidade: textOptional(100),
    // Tags de perfil (médico militar, mais médicos, médicos pelo brasil).
    tags: z.array(z.string().max(60)).optional().nullable(),
    programas: z.array(z.enum(PROGRAMAS_GOVERNAMENTAIS)).optional().nullable(),
    observacoes: textOptional(1000),
  })
  .optional()
  .nullable();

export const clientCreateSchema = z
  .object({
    full_name: z.string().trim().min(3, "Nome muito curto").max(200),
    cpf_cnpj: cpfCnpjSchema,
    // RG — obrigatório apenas para pessoa física (validado no superRefine).
    rg: textOptional(20),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)").optional().or(z.literal("")),
    tipo: z.string().trim().max(50).optional().nullable(),
    professional_data: professionalDataSchema,
    email: z.string().trim().email("E-mail inválido").max(200),
    phone: phoneSchema,
    address: addressSchema,
    // Valores dos campos customizados (Melhoria 1). Validação fina contra as
    // definições (obrigatoriedade/opções) acontece no service.
    custom_fields: z.record(z.string(), z.unknown()).optional().nullable(),
    // Chave "É um cliente" (2026-07-19) — quando true, o cadastro já nasce como
    // CLIENTE (marcado_cliente_at); default off = fica em Leads.
    is_cliente: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // PF (CPF, 11 dígitos) exige RG. PJ (CNPJ) não.
    const isPF = sanitizeCpfCnpj(data.cpf_cnpj).length === 11;
    if (isPF && !data.rg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rg"],
        message: "RG é obrigatório para pessoa física",
      });
    }
  });

// No update os campos são parciais (edição futura campo a campo). Como o create
// é um objeto com superRefine, derivamos o partial do shape interno.
export const clientUpdateSchema = z.object({
  full_name: z.string().trim().min(3, "Nome muito curto").max(200).optional(),
  cpf_cnpj: cpfCnpjSchema.optional(),
  rg: textOptional(20),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)").optional().nullable().or(z.literal("")),
  tipo: z.string().trim().max(50).optional().nullable(),
  professional_data: professionalDataSchema,
  email: z.string().trim().email("E-mail inválido").max(200).optional(),
  phone: phoneSchema.optional(),
  address: addressSchema.optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type ClientCreateInput = z.input<typeof clientCreateSchema>;
export type ClientCreateOutput = z.output<typeof clientCreateSchema>;
export type ClientUpdateInput = z.input<typeof clientUpdateSchema>;
export type ClientUpdateOutput = z.output<typeof clientUpdateSchema>;
