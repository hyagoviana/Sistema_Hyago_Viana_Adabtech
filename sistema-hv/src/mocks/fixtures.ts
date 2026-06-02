// NÃO contém mais dados mocados (faker removido em 2026-06-02).
// Mantém apenas tipos, labels e formatadores reutilizados pela UI.
// Fonte canônica dos enums de status vive em `@/lib/cases/constants`.

export type CaseType = "FIES_ESF" | "FIES_DGM" | "COVID" | "MAIS_MEDICOS" | "RESIDENCIA" | "CFM_CRM";
export type MacroOp =
  | "ONBOARDING" | "ANALISE" | "CONFERENCIA" | "PRONTO_AJUIZAR" | "EM_ANDAMENTO"
  | "AGUARDANDO_DECISAO" | "IMPLANTADO" | "IMPLANTACAO_PARCIAL" | "ENCERRADO" | "CANCELADO";
export type MacroFin =
  | "ELABORANDO" | "APROVACAO" | "AGUARDANDO_ATIVACAO" | "ATIVO" | "QUITANDO" | "QUITADO"
  | "INADIMPLENTE" | "PARCIAL" | "RENEGOCIADO" | "SUSPENSO" | "CANCELADO";

export const caseTypeLabels: Record<CaseType, string> = {
  FIES_ESF: "FIES ESF",
  FIES_DGM: "FIES DGM",
  COVID: "COVID",
  MAIS_MEDICOS: "Mais Médicos",
  RESIDENCIA: "Residência",
  CFM_CRM: "CFM/CRM",
};

export const macroOpLabels: Record<MacroOp, string> = {
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

export const macroFinLabels: Record<MacroFin, string> = {
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

export function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
export function maskCPF(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4");
}
