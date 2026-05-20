import { macroFinLabels, macroOpLabels, type MacroFin, type MacroOp } from "@/mocks/fixtures";
import { Badge } from "./primitives";

const opTone: Record<MacroOp, "neutral" | "navy" | "gold" | "success" | "danger" | "warning"> = {
  ONBOARDING: "neutral", ANALISE: "neutral", CONFERENCIA: "navy", PRONTO_AJUIZAR: "gold",
  EM_ANDAMENTO: "gold", AGUARDANDO_DECISAO: "warning", IMPLANTADO: "success",
  IMPLANTACAO_PARCIAL: "success", ENCERRADO: "neutral", CANCELADO: "danger",
};
const finTone: Record<MacroFin, "neutral" | "navy" | "gold" | "success" | "danger" | "warning"> = {
  ELABORANDO: "neutral", APROVACAO: "navy", AGUARDANDO_ATIVACAO: "warning", ATIVO: "gold",
  QUITANDO: "gold", QUITADO: "success", INADIMPLENTE: "danger", PARCIAL: "warning",
  RENEGOCIADO: "navy", SUSPENSO: "warning", CANCELADO: "danger",
};

export function MacrostatusOp({ status }: { status: MacroOp }) {
  return <Badge tone={opTone[status]}>{macroOpLabels[status]}</Badge>;
}
export function MacrostatusFin({ status }: { status: MacroFin }) {
  return <Badge tone={finTone[status]}>{macroFinLabels[status]}</Badge>;
}
