import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRightLeft } from "lucide-react";
import { useState } from "react";

import { MoveCaseDialog } from "./MoveCaseDialog";
import { MoveCaseFinDialog } from "./MoveCaseFinDialog";
import { Badge, StatusDot } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { CASE_TYPE_LABELS, type CaseType, type MacroOp } from "@/lib/cases/constants";

type Props = {
  caso: {
    id: string;
    case_code: string;
    case_type: string;
    caso_pasta_nome?: string | null;
    macrostatus_op: string;
    macrostatus_fin?: string | null;
    service_type_id?: string | null;
    status_changed_at: string;
    inadimplente: boolean;
    proximo_passo: string | null;
    client_name: string;
    /**
     * Doc 31.08 — prazo da tarefa ABERTA mais urgente do caso (menor due_date).
     * NULL = nenhuma tarefa aberta com prazo → o card não mostra contagem, que é
     * o estado normal de um caso em dia. Vem de attachOpenTaskDueDate.
     */
    task_due_date?: string | null;
  };
  compact?: boolean;
  // ITEM 5 (2026-07-07) — o board por onde o card é visto. O botão "mover" abre o
  // dialog do MESMO funil: "op" move a etapa operacional; "fin" a financeira.
  kind?: "op" | "fin";
};

/**
 * Dias entre hoje e uma data ISO (YYYY-MM-DD), pelo CALENDÁRIO — não por 24h
 * corridas. Positivo = faltam N dias; 0 = vence hoje; negativo = N dias de atraso.
 * Comparar meia-noite local dos dois lados evita o clássico "vence hoje mas já
 * mostra 1 dia de atraso" às 00h30.
 */
function daysUntilDue(ymd: string): number {
  const [a, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const alvo = new Date(a, (m ?? 1) - 1, d ?? 1);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export function CaseCardReal({ caso, compact = true, kind = "op" }: Props) {
  const [moveOpen, setMoveOpen] = useState(false);
  const isFin = kind === "fin";
  const tipoLabel =
    caso.caso_pasta_nome ?? CASE_TYPE_LABELS[caso.case_type as CaseType] ?? caso.case_type;

  // Doc 31.08 (Thiago) — a contagem do card é a da TAREFA, não a de tempo parado
  // na etapa: "se não existir tarefa = sem prazo = sem contagem visual aqui".
  // Em prazo → quantos dias faltam. Em atraso → há quantos dias venceu (vermelho).
  const dias = caso.task_due_date ? daysUntilDue(caso.task_due_date) : null;
  const atrasada = dias !== null && dias < 0;
  const prazoTone =
    dias === null ? "success" : atrasada ? "danger" : dias <= 3 ? "warning" : "success";
  const prazoLabel =
    dias === null
      ? null
      : atrasada
        ? `${Math.abs(dias)}d atraso`
        : dias === 0
          ? "hoje"
          : `${dias}d`;

  function stopAll(e: React.MouseEvent | React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className="relative group">
      <Link
        to="/casos/$id"
        params={{ id: caso.id }}
        className="block bg-[var(--card)] rounded-[10px] border border-[rgba(120,96,30,0.12)] p-3 hover:-translate-y-0.5 hover:border-[rgba(152,120,20,0.26)] hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--ink-500)] tabular tracking-tight truncate">
            {caso.case_code}
          </span>
          {caso.inadimplente && <AlertCircle size={12} className="text-[var(--danger)] shrink-0" />}
        </div>
        <div className="mt-1 text-[14px] font-semibold text-[var(--navy)] leading-snug group-hover:text-[var(--gold-700)] transition-colors truncate">
          {caso.client_name}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge tone="gold">{tipoLabel}</Badge>
          {prazoLabel && (
            <span
              className="text-[11px] inline-flex items-center gap-1 shrink-0 tabular"
              style={{
                color: atrasada ? "var(--danger)" : "var(--ink-500)",
                fontWeight: atrasada ? 600 : undefined,
              }}
              title={
                atrasada
                  ? "Tarefa vencida — dias de atraso"
                  : "Dias até o vencimento da próxima tarefa"
              }
            >
              <StatusDot tone={prazoTone} />
              {prazoLabel}
            </span>
          )}
        </div>
        {!compact && caso.proximo_passo && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] text-[11px] text-muted-foreground line-clamp-2">
            {caso.proximo_passo}
          </div>
        )}
      </Link>
      <div className="absolute top-2 right-2" onClick={stopAll} onPointerDown={stopAll}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Mover status"
          onClick={() => setMoveOpen(true)}
        >
          <ArrowRightLeft size={13} />
        </Button>
      </div>
      {isFin && caso.service_type_id ? (
        <MoveCaseFinDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          caseId={caso.id}
          caseCode={caso.case_code}
          currentFinSlug={caso.macrostatus_fin ?? "NAO_APLICAVEL"}
          serviceTypeId={caso.service_type_id}
        />
      ) : (
        <MoveCaseDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          caseId={caso.id}
          caseCode={caso.case_code}
          caseType={caso.case_type}
          currentStatus={caso.macrostatus_op}
        />
      )}
    </div>
  );
}
