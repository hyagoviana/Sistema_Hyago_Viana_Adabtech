import { z } from "zod";

import { MACRO_FIN, MACRO_OP } from "@/lib/cases/constants";

export const caseCreateSchema = z.object({
  client_id: z.string().uuid("Cliente obrigatório"),
  case_type: z.string().min(1, "Tipo obrigatório"),
  macrostatus_op: z.enum(MACRO_OP).optional(),
  macrostatus_fin: z.enum(MACRO_FIN).optional(),
  proximo_passo: z.string().trim().max(500).optional().nullable(),
  responsavel: z.string().trim().max(200).optional().nullable(),
  municipio: z.string().trim().max(200).optional().nullable(),
  valor_centavos: z.number().int().nonnegative().optional().nullable(),
  // Melhoria 3: quando true, o caso nasce em fase comercial (aguardando
  // assinatura da procuração) e não entra no Kanban operacional até liberar.
  comercial: z.boolean().optional(),
  // Procuração escolhida no ato da criação comercial. Quando presente, o sistema
  // gera o documento já preenchido com os dados do cliente (em vez do placeholder).
  procuracao_template_id: z.string().uuid().optional().nullable(),
});

export const caseUpdateSchema = caseCreateSchema
  .partial()
  .omit({ client_id: true, case_type: true, comercial: true, procuracao_template_id: true });

export type CaseCreateInput = z.input<typeof caseCreateSchema>;
export type CaseCreateOutput = z.output<typeof caseCreateSchema>;
export type CaseUpdateInput = z.input<typeof caseUpdateSchema>;
export type CaseUpdateOutput = z.output<typeof caseUpdateSchema>;
