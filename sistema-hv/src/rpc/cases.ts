import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { listCaseResponsaveis } from "@/lib/case-responsaveis-service";
import { MACRO_FIN, MACRO_OP } from "@/lib/cases/constants";
import {
  aprovarConferenciaFin,
  CaseServiceError,
  createCase,
  createComercialCaseAndGenerateProcuracao,
  enviarConferenciaFin,
  generateContratoFromTemplate,
  generateProcuracaoFromTemplate,
  getCase,
  getConferenciaFinPendente,
  liberarCasoComercial,
  listCaseEvents,
  listCases,
  duplicateCaseToTema,
  listComercialCases,
  listComercialDocuments,
  marcarCasoPerdido,
  moveCaseStatus,
  moveCaseStatusFin,
  moverCasoParaTema,
  previewProcuracao,
  promoverCasoManual,
  setCaseSigilo,
  setCaseUrgency,
  softDeleteCase,
  updateCase,
  updateCaseCanonicalFields,
  updateCaseObservacoes,
} from "@/lib/cases-service";
import { AuthError, requireAuth, requireAnyModule, requireModule } from "@/lib/supabase/auth-guard";
import {
  caseCreateSchema,
  caseUpdateSchema,
  createComercialProcuracaoSchema,
  previewProcuracaoSchema,
} from "@/lib/validators/case";

const idSchema = z.object({ id: z.string().uuid() });

async function handle<T>(fn: (userId: string) => Promise<T>): Promise<T> {
  try {
    const { id: userId } = await requireAuth();
    return await fn(userId);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof CaseServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

// Guards de ESCRITA por MÓDULO (2026-07-19) — respeitam a régua efetiva
// (papel + overrides por usuário). Um colaborador com "view" no módulo é barrado
// (403) ao tentar criar/editar/mover, mesmo que a UI escape. Fábrica única para
// não duplicar o tratamento de erro.
function makeGuarded(guard: () => Promise<{ id: string }>) {
  return async function <T>(fn: (userId: string) => Promise<T>): Promise<T> {
    try {
      const { id: userId } = await guard();
      return await fn(userId);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      if (err instanceof CaseServiceError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err;
    }
  };
}

// operacional:edit (casos.manage) — mutações operacionais do caso.
const handleManage = makeGuarded(() => requireModule("operacional", "edit"));
// financeiro:edit — mutações na pipeline/conferência financeira.
const handleFin = makeGuarded(() => requireModule("financeiro", "edit"));
// comercial:edit — ações do funil comercial (procuração comercial).
const handleComercial = makeGuarded(() => requireModule("comercial", "edit"));
// Entidade COMPARTILHADA (comercial OU operacional) — criar caso / gerar documento
// / ações de lifecycle (liberar/promover/perdido) acontecem em ambas as abas.
const handleBiz = makeGuarded(() => requireAnyModule(["comercial", "operacional"], "edit"));

// ----------------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------------

const listFiltersSchema = z
  .object({
    search: z.string().optional(),
    macrostatus_op: z.enum(MACRO_OP).optional(),
    macrostatus_fin: z.enum(MACRO_FIN).optional(),
    client_id: z.string().uuid().optional(),
  })
  .optional()
  .default({});

export const listCasesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listFiltersSchema.parse(data))
  .handler(async ({ data }) => handle((userId) => listCases(data, userId)));

export const getCaseFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle(() => getCase(data.id)));

export const listCaseEventsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle(() => listCaseEvents(data.id)));

// ----------------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------------

export const createCaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => caseCreateSchema.parse(data))
  .handler(async ({ data }) => handleBiz((userId) => createCase(data, userId)));

// Responsáveis (advogados) vinculados a um caso — para carregar ao editar.
export const listCaseResponsaveisFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listCaseResponsaveis(data.caseId)));

// Procuração comercial — preview dos campos <...> + valores do cadastro.
export const previewProcuracaoFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => previewProcuracaoSchema.parse(data))
  .handler(async ({ data }) =>
    handle(() =>
      previewProcuracao({
        clientId: data.client_id,
        templateId: data.template_id,
        municipio: data.municipio,
        responsavel: data.responsavel,
      }),
    ),
  );

// Procuração comercial — cria o caso + gera + finaliza (sem enviar ao ZapSign).
export const createComercialProcuracaoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createComercialProcuracaoSchema.parse(data))
  .handler(async ({ data }) =>
    handleComercial((userId) =>
      createComercialCaseAndGenerateProcuracao(
        {
          case: data.case,
          templateId: data.template_id,
          values: data.values,
          honorarios: data.honorarios,
        },
        userId,
      ),
    ),
  );

// S9-02 — gera o CONTRATO do caso (doc_kind='contrato') a partir de um modelo.
// Idempotente por caso; degrada 424 se não houver modelo de contrato cadastrado.
// A escolha do template na UI é da S9-09; aqui só recebemos o id (nullable).
const generateContratoSchema = z.object({
  case_id: z.string().uuid(),
  client_id: z.string().uuid(),
  template_id: z.string().uuid().nullable().optional(),
  // S9-12 — valores revisados no diálogo (documento COMBINADO). Opcional.
  values: z.record(z.string(), z.string()).optional(),
});

export const generateContratoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => generateContratoSchema.parse(data))
  .handler(async ({ data }) =>
    handleBiz((userId) =>
      generateContratoFromTemplate(
        data.case_id,
        data.template_id ?? null,
        data.client_id,
        userId,
        data.values,
      ),
    ),
  );

// S9-09 — gera a PROCURAÇÃO do caso (doc_kind='procuracao') a partir de um modelo,
// idempotente por caso. O envio ao ZapSign (RPC genérico) carimba
// aguardando_assinatura_at (ramo de procuração), colocando o caso no comercial.
const generateProcuracaoSchema = z.object({
  case_id: z.string().uuid(),
  client_id: z.string().uuid(),
  template_id: z.string().uuid(),
  values: z.record(z.string(), z.string()).optional(),
});

export const generateProcuracaoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => generateProcuracaoSchema.parse(data))
  .handler(async ({ data }) =>
    handleBiz((userId) =>
      generateProcuracaoFromTemplate(
        data.case_id,
        data.template_id,
        data.client_id,
        userId,
        data.values,
      ),
    ),
  );

const updateInputSchema = z.object({
  id: z.string().uuid(),
  input: caseUpdateSchema,
});

export const updateCaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInputSchema.parse(data))
  .handler(async ({ data }) => handleManage((userId) => updateCase(data.id, data.input, userId)));

// S2-07 — campos canônicos do CASO (merge no JSONB canonical_fields).
const canonicalFieldsSchema = z.object({
  id: z.string().uuid(),
  // R2-09 — `multiselect` grava um ARRAY de strings; os demais tipos gravam
  // string/number/boolean; null remove a chave.
  patch: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
  ),
});

export const updateCaseCanonicalFieldsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => canonicalFieldsSchema.parse(data))
  .handler(async ({ data }) =>
    handleManage((userId) => updateCaseCanonicalFields(data.id, data.patch, userId)),
  );

// M2 (2026-08-07) — salva o campo Observações (texto livre) do caso. Gate de
// escrita compartilhado (comercial OU operacional : edit). NÃO grava evento na
// timeline (diferente das notas). Aceita string vazia (limpa a coluna → NULL).
const observacoesSchema = z.object({
  id: z.string().uuid(),
  observacoes: z.string(),
});

export const updateCaseObservacoesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => observacoesSchema.parse(data))
  .handler(async ({ data }) => handleBiz(() => updateCaseObservacoes(data.id, data.observacoes)));

// M13 (T3) — urgência do caso (prioritário/urgente/normal) p/ o motor. Gate
// operacional:edit (mesma régua das mutações operacionais do caso).
const urgencySchema = z.object({
  id: z.string().uuid(),
  urgency: z.enum(["normal", "prioritario", "urgente"]),
});

export const setCaseUrgencyFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => urgencySchema.parse(data))
  .handler(async ({ data }) =>
    handleManage(() => setCaseUrgency(data.id, data.urgency === "normal" ? null : data.urgency)),
  );

// (2026-07-09) — `to` é o SLUG da etapa op. Aceita qualquer slug (as etapas são
// configuráveis por categoria em system_pipeline_stages; o CHECK fixo já foi
// relaxado na migration 0017). Antes era z.enum(MACRO_OP), o que barrava etapas
// de funil criadas/renomeadas pelo usuário.
const moveSchema = z.object({ id: z.string().uuid(), to: z.string().min(1) });

export const moveCaseStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => moveSchema.parse(data))
  .handler(async ({ data }) => handleManage((userId) => moveCaseStatus(data.id, data.to, userId)));

const moveFinSchema = z.object({ id: z.string().uuid(), to: z.enum(MACRO_FIN) });

export const moveCaseStatusFinFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => moveFinSchema.parse(data))
  .handler(async ({ data }) => handleFin((userId) => moveCaseStatusFin(data.id, data.to, userId)));

export const softDeleteCaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handleManage((userId) => softDeleteCase(data.id, userId)));

// R2 — VINCULAR CASO a um TEMA (reatribui case_type p/ o service_type interno do
// tema + grava tema_id/frente_slug; reseta a etapa op se não houver equivalente).
// Gate: casos.manage (handleManage). frenteSlug opcional/nullable.
const moverParaTemaSchema = z.object({
  id: z.string().uuid(),
  temaId: z.string().uuid(),
  frenteSlug: z.string().nullish(),
});

export const moverCasoParaTemaFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => moverParaTemaSchema.parse(data))
  .handler(async ({ data }) =>
    handleManage((userId) =>
      moverCasoParaTema(data.id, data.temaId, data.frenteSlug ?? null, userId),
    ),
  );

// A4 (2026-08-03) — DUPLICAR o caso em outro tema (mantém o original). Mesmo gate
// (casos.manage) e schema do mover.
export const duplicarCasoParaTemaFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => moverParaTemaSchema.parse(data))
  .handler(async ({ data }) =>
    handleManage((userId) =>
      duplicateCaseToTema(data.id, data.temaId, data.frenteSlug ?? null, userId),
    ),
  );

// ----------------------------------------------------------------------------
// S3-03 — Conferência financeira (dupla checagem). Auth-only, sem requireRole.
// Segregação por ATOR (aprovador <> enviador) é validada no serviço.
// ----------------------------------------------------------------------------
export const getConferenciaFinPendenteFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle(() => getConferenciaFinPendente(data.id)));

const enviarConferenciaFinSchema = z.object({
  id: z.string().uuid(),
  to: z.enum(MACRO_FIN),
});

export const enviarConferenciaFinFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => enviarConferenciaFinSchema.parse(data))
  .handler(async ({ data }) =>
    handleFin((userId) => enviarConferenciaFin(data.id, data.to, userId)),
  );

export const aprovarConferenciaFinFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handleFin((userId) => aprovarConferenciaFin(data.id, userId)));

// ----------------------------------------------------------------------------
// Comercial (Melhoria 3)
// ----------------------------------------------------------------------------
export const listComercialCasesFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listComercialCases()),
);

// Aba Assinaturas — DOCUMENTOS enviados ao ZapSign aguardando assinatura.
export const listComercialDocumentsFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listComercialDocuments()),
);

// Liberação manual: usuário confirma que a procuração foi assinada.
export const liberarCasoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) =>
    handleBiz((userId) => liberarCasoComercial(data.id, { via: "manual", userId })),
  );

// ----------------------------------------------------------------------------
// S1-03 / S1-01b — Botões manuais lead→cliente e lead/cliente→perdido.
// Qualquer usuário autenticado pode (sem gate por cargo); auditoria obrigatória.
// ----------------------------------------------------------------------------
export const promoverCasoManualFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handleBiz((userId) => promoverCasoManual(data.id, userId)));

const marcarPerdidoSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().min(1, "Informe o motivo da perda"),
});

export const marcarCasoPerdidoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => marcarPerdidoSchema.parse(data))
  .handler(async ({ data }) =>
    handleBiz((userId) => marcarCasoPerdido(data.id, data.motivo, userId)),
  );

// G4 — marcar/desmarcar SIGILO do caso + autorizados. Gate: gestor do caso
// (operacional:edit) OU admin. Só quem pode gerir o caso muda o sigilo.
const setSigiloSchema = z.object({
  caseId: z.string().uuid(),
  sigiloso: z.boolean(),
  userIds: z.array(z.string().uuid()).default([]),
});
export const setCaseSigiloFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => setSigiloSchema.parse(data))
  .handler(async ({ data }) =>
    handleManage((userId) => setCaseSigilo(data.caseId, data.sigiloso, data.userIds, userId)),
  );
