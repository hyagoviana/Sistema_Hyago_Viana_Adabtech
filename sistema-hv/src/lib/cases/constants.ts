// Constants compartilhadas entre UI e validações.
// Devem bater 1:1 com o CHECK do schema (system_cases).

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

export const MACRO_OP = [
  "ONBOARDING",
  "ANALISE",
  "CONFERENCIA",
  "PRONTO_AJUIZAR",
  "EM_ANDAMENTO",
  "AGUARDANDO_DECISAO",
  "IMPLANTADO",
  "IMPLANTACAO_PARCIAL",
  "ENCERRADO",
  "CANCELADO",
] as const;
export type MacroOp = (typeof MACRO_OP)[number];

export const MACRO_OP_LABELS: Record<MacroOp, string> = {
  ONBOARDING: "Onboarding",
  ANALISE: "Análise",
  CONFERENCIA: "Conferência",
  PRONTO_AJUIZAR: "Pronto p/ ajuizar",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_DECISAO: "Aguardando decisão",
  IMPLANTADO: "Implantado",
  IMPLANTACAO_PARCIAL: "Implantação parcial",
  ENCERRADO: "Encerrado",
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
