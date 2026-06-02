import { z } from "zod";

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

export const addressSchema = z.object({
  street: z.string().trim().max(200).optional().nullable(),
  number: z.string().trim().max(20).optional().nullable(),
  complement: z.string().trim().max(100).optional().nullable(),
  neighborhood: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().length(2, "UF deve ter 2 letras").optional().nullable(),
  zipcode: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido")
    .transform((v) => v.replace(/\D/g, ""))
    .optional()
    .nullable(),
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
  MEDICOS_BRASIL_FORMACAO: "Médicos pelo Brasil — Formação",
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
    oab_numero: textOptional(20),
    oab_uf: ufOptional,
    vinculo_institucional: textOptional(100), // ex.: ANMR, AMPB
    especialidade: textOptional(100),
    programas: z.array(z.enum(PROGRAMAS_GOVERNAMENTAIS)).optional().nullable(),
    observacoes: textOptional(1000),
  })
  .optional()
  .nullable();

export const clientCreateSchema = z.object({
  full_name: z.string().trim().min(3, "Nome muito curto").max(200),
  cpf_cnpj: cpfCnpjSchema,
  tipo: z.string().trim().max(50).optional().nullable(),
  professional_data: professionalDataSchema,
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .max(200)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  phone: phoneSchema
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  address: addressSchema.optional().nullable(),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export type ClientCreateInput = z.input<typeof clientCreateSchema>;
export type ClientCreateOutput = z.output<typeof clientCreateSchema>;
export type ClientUpdateInput = z.input<typeof clientUpdateSchema>;
export type ClientUpdateOutput = z.output<typeof clientUpdateSchema>;
