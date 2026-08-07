import { z } from "zod";

// ----------------------------------------------------------------------------
// Campos customizados de cliente (Melhoria 1) — definições do "form builder".
// O admin cria campos ADICIONAIS de cadastro, usados para enriquecer e
// pesquisar o cliente. Os campos fixos do cadastro não passam por aqui.
// ----------------------------------------------------------------------------

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "multiselect",
  "boolean",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto curto",
  textarea: "Descrição (texto longo)",
  number: "Número",
  date: "Data",
  select: "Escolha única",
  multiselect: "Múltipla escolha",
  boolean: "Sim / Não",
};

// Tipos que exigem lista de opções.
export const FIELD_TYPES_WITH_OPTIONS: FieldType[] = ["select", "multiselect"];

export const fieldDefCreateSchema = z
  .object({
    label: z.string().trim().min(1, "Informe o rótulo do campo").max(80),
    field_type: z.enum(FIELD_TYPES),
    options: z.array(z.string().trim().min(1).max(120)).max(100).optional().nullable(),
    required: z.boolean().optional().default(false),
    // B1 (2026-08-05) — o campo "aparece nos casos" (espelhado nos temas vinculados).
    appears_in_cases: z.boolean().optional().default(false),
    help_text: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    ordem: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (FIELD_TYPES_WITH_OPTIONS.includes(data.field_type)) {
      const opts = (data.options ?? []).filter((o) => o.trim().length > 0);
      if (opts.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Adicione ao menos uma opção para este tipo de campo",
        });
      }
    }
  });

export const fieldDefUpdateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  field_type: z.enum(FIELD_TYPES).optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(100).optional().nullable(),
  required: z.boolean().optional(),
  appears_in_cases: z.boolean().optional(),
  help_text: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  ordem: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

// B1 (2026-08-05) — vínculo campo-do-cliente → tema(s). A UI manda o conjunto
// DESEJADO de temas; o service faz o diff (cria/oculta defs-espelho).
export const setClientFieldTemaLinksSchema = z.object({
  clientFieldDefId: z.string().uuid("ID de campo inválido"),
  temaIds: z.array(z.string().uuid()).max(200),
});
export type SetClientFieldTemaLinksInput = z.infer<typeof setClientFieldTemaLinksSchema>;

export type FieldDefCreateInput = z.input<typeof fieldDefCreateSchema>;
export type FieldDefCreateOutput = z.output<typeof fieldDefCreateSchema>;
export type FieldDefUpdateInput = z.input<typeof fieldDefUpdateSchema>;
export type FieldDefUpdateOutput = z.output<typeof fieldDefUpdateSchema>;

// Reordenação em lote: lista de ids na nova ordem.
export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).max(200),
});
