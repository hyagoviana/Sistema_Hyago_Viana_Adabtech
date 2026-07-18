import { z } from "zod";

import { MACRO_FIN, MACRO_OP } from "@/lib/cases/constants";

export const caseCreateSchema = z.object({
  client_id: z.string().uuid("Cliente obrigatório"),
  case_type: z.string().min(1, "Tipo obrigatório"),
  // R2-05 — modelo TEMA→CASO→FRENTE (dual-write, ADITIVO ao case_type/service_type_id).
  // `tema_id` = tema escolhido; `frente_slug` = frente do tema (docs/checklist puxam
  // pela frente — R2-04). Ambos opcionais: o caminho legado por "categoria"
  // (case_type = slug do service_type) segue funcionando sem tema.
  tema_id: z.string().uuid().optional().nullable(),
  frente_slug: z.string().trim().max(60).optional().nullable(),
  macrostatus_op: z.enum(MACRO_OP).optional(),
  macrostatus_fin: z.enum(MACRO_FIN).optional(),
  proximo_passo: z.string().trim().max(500).optional().nullable(),
  responsavel: z.string().trim().max(200).optional().nullable(),
  // (2026-07-09) — responsáveis do caso = advogados vinculados (múltipla escolha).
  // Fonte de verdade do vínculo/visibilidade; `responsavel` (texto) vira cache.
  responsavelIds: z.array(z.string().uuid()).optional(),
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

// ----------------------------------------------------------------------------
// Procuração comercial: revisão de campos + envio direto ao ZapSign.
// Fluxo: o usuário escolhe a procuração ao criar o caso, revê os campos <...>
// preenchidos com os dados do cliente (editáveis) e confirma. O sistema cria
// o caso, gera o documento com os valores revisados, finaliza e envia ao
// ZapSign de uma vez — disparando o e-mail de assinatura ao signatário.
// ----------------------------------------------------------------------------

// Preview: lê os campos do modelo e os valores auto-preenchidos do cadastro,
// para o usuário revisar ANTES de criar o caso (nenhum dado é gravado aqui).
export const previewProcuracaoSchema = z.object({
  client_id: z.string().uuid("Cliente obrigatório"),
  template_id: z.string().uuid("Modelo obrigatório"),
  municipio: z.string().trim().max(200).optional().nullable(),
  responsavel: z.string().trim().max(200).optional().nullable(),
});

// Confirmação: cria o caso comercial + gera + finaliza a procuração. NÃO envia
// ao ZapSign — o envio é uma ação separada na ficha do caso (com signatário).
export const createComercialProcuracaoSchema = z.object({
  case: caseCreateSchema,
  template_id: z.string().uuid("Modelo obrigatório"),
  // Valores revisados pelo usuário (key do placeholder → valor). O servidor
  // complementa com o autofill do caso recém-criado (ex.: código do caso).
  values: z.record(z.string(), z.string()).default({}),
  // S7-01 (opção A): honorários ESTRUTURADOS da revisão (centavos/número), para
  // persistir em system_case_honorarios. Todos opcionais/nullable — quando
  // ausentes, o servidor faz fallback parseando os placeholders de `values`.
  honorarios: z
    .object({
      percentualHonorarios: z.number().nullable().optional(),
      valorParcelaCentavos: z.number().int().nullable().optional(),
      descontoAvistaPct: z.number().nullable().optional(),
      formaPagamento: z.string().nullable().optional(),
      honorariosTotalCentavos: z.number().int().nullable().optional(),
    })
    .optional(),
});

export type PreviewProcuracaoInput = z.input<typeof previewProcuracaoSchema>;
export type CreateComercialProcuracaoInput = z.input<typeof createComercialProcuracaoSchema>;
export type CreateComercialProcuracaoOutput = z.output<typeof createComercialProcuracaoSchema>;
