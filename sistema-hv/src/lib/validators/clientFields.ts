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
  // C1 (2026-08-26) — paridade com os campos do CASO. O Thiago pediu o LINK
  // olhando um caso real: "queria colocar 2 links para cada cliente".
  "link",
  "money",
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
  link: "Link (URL)",
  money: "Valor (R$)",
};

// Tipos que exigem lista de opções.
export const FIELD_TYPES_WITH_OPTIONS: FieldType[] = ["select", "multiselect"];

// C1 — opções de paridade com os campos do CASO. Os nomes são os MESMOS de
// `system_tema_field_defs` de propósito: a UI compartilha controles e a regra
// não é reescrita duas vezes.
const paridadeShape = {
  /** Teto de linhas do campo multi-ocorrência (1 = campo simples). */
  max_occurrences: z.number().int().min(1).max(20).optional(),
  /** Quantas linhas aparecem de largada (nunca acima do teto). */
  initial_occurrences: z.number().int().min(1).max(20).optional(),
  /** Rótulo por linha: 'auto' (enumerado) | 'custom' (textos) | null (sem). */
  subtitle_mode: z.enum(["auto", "custom"]).nullish(),
  subtitles: z.array(z.string().trim().max(80)).max(20).optional(),
  /** DEPENDENTE: só fica editável quando o pai está preenchido. */
  parent_field_def_id: z.string().uuid().nullish(),
  /** VINCULADO: aparece SEMPRE junto do outro. Não condiciona nada. */
  linked_field_def_id: z.string().uuid().nullish(),
  hidden_in_list: z.boolean().optional(),
  hidden_in_filters: z.boolean().optional(),
};

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
    ...paridadeShape,
  })
  .superRefine((data, ctx) => {
    if (
      data.initial_occurrences !== undefined &&
      data.max_occurrences !== undefined &&
      data.initial_occurrences > data.max_occurrences
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["initial_occurrences"],
        message: "As linhas iniciais não podem passar do máximo de linhas",
      });
    }
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
  ...paridadeShape,
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
