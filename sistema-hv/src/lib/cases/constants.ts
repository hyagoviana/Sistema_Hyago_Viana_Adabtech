// Constants compartilhadas entre UI e validações.
// Devem bater 1:1 com o CHECK do schema (system_cases).

// #15/#16 — Tipo de serviço SENTINELA dono do funil ÚNICO (comercial + fin).
// Inativo no banco (não aparece nas seleções de tipo); usado só como fonte das
// etapas globais editáveis. Migration 20260706000010_global_funnel_sentinel.sql.
export const GLOBAL_FUNNEL_SERVICE_TYPE_ID = "00000000-0000-0000-0000-0000000000f0";

export const CASE_TYPES = [
  "FIES_ESF",
  "FIES_DGM",
  "COVID",
  "MAIS_MEDICOS",
  "RESIDENCIA",
  "CFM_CRM",
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  FIES_ESF: "FIES ESF",
  FIES_DGM: "FIES DGM",
  COVID: "COVID",
  MAIS_MEDICOS: "Mais Médicos",
  RESIDENCIA: "Residência",
  CFM_CRM: "CFM/CRM",
};

// Estados operacionais — UNIÃO dos slugs usados pelos fluxos por tipo (POPs).
// As ETAPAS reais por tipo vivem em system_pipeline_stages (configuráveis); esta
// lista serve p/ exibição de rótulos e validação na criação. Nem todo tipo usa
// todos (ex.: DGM_ENVIADA só no FIES_DGM; COVID não usa TRIAGEM).
export const MACRO_OP = [
  "ONBOARDING",
  "TRIAGEM",
  "DOCS_PENDENTES",
  "DGM_ENVIADA",
  "PRONTO_PROTOCOLO",
  "ACOMPANHAMENTO_ADM",
  "JUDICIAL_OPERACIONAL",
  "IMPLANTADO",
  "ENCERRADO_OPERACIONAL",
  "CANCELADO",
] as const;
export type MacroOp = (typeof MACRO_OP)[number];

export const MACRO_OP_LABELS: Record<MacroOp, string> = {
  ONBOARDING: "Onboarding",
  TRIAGEM: "Triagem",
  DOCS_PENDENTES: "Documentos pendentes",
  DGM_ENVIADA: "DGM enviada",
  PRONTO_PROTOCOLO: "Pronto p/ protocolo",
  ACOMPANHAMENTO_ADM: "Acompanhamento adm.",
  JUDICIAL_OPERACIONAL: "Judicial",
  IMPLANTADO: "Implantado",
  ENCERRADO_OPERACIONAL: "Encerrado",
  CANCELADO: "Cancelado",
};

export const MACRO_FIN = [
  "NAO_APLICAVEL",
  "ELABORANDO",
  "APROVACAO",
  "AGUARDANDO_ATIVACAO",
  "ATIVO",
  "QUITANDO",
  "QUITADO",
  "INADIMPLENTE",
  "PARCIAL",
  "RENEGOCIADO",
  "SUSPENSO",
  "CANCELADO",
] as const;
export type MacroFin = (typeof MACRO_FIN)[number];

export const MACRO_FIN_LABELS: Record<MacroFin, string> = {
  NAO_APLICAVEL: "—",
  ELABORANDO: "Elaborando",
  APROVACAO: "Aprovação",
  AGUARDANDO_ATIVACAO: "Aguardando ativação",
  ATIVO: "Ativo",
  QUITANDO: "Quitando",
  QUITADO: "Quitado",
  INADIMPLENTE: "Inadimplente",
  PARCIAL: "Parcial",
  RENEGOCIADO: "Renegociado",
  SUSPENSO: "Suspenso",
  CANCELADO: "Cancelado",
};
