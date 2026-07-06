import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Badge, StatusDot } from "@/components/hv/primitives";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";

// Card de LEAD (esteira comercial). Variante enxuta de CaseCardReal SEM o
// MoveCaseDialog operacional — no Kanban comercial a movimentação é por DnD e a
// coluna é lida de macrostatus_comercial (não macrostatus_op). Clicar abre a ficha.
// #15 — is_registration=true: cadastro-lead SEM caso; clicar abre a ficha do
// cadastro (/clientes/$id) e o card não tem tag de tipo.
// ITEM 5 (2026-07-06): cards de CASO (não cadastro) ganham a ação "Enviar para
// operacional" (onSendToOperacional) — libera o caso (limpa aguardando_assinatura_at)
// e o manda ao Kanban operacional. Se o lead tem >1 caso, a página abre um popup.
type Props = {
  lead: {
    id: string;
    client_id?: string;
    case_code: string;
    case_type: string;
    macrostatus_comercial: string | null;
    created_at: string;
    client_name: string;
    is_registration?: boolean;
  };
  onSendToOperacional?: (lead: { id: string; client_id?: string; client_name: string }) => void;
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function LeadCard({ lead, onSendToOperacional }: Props) {
  const dias = daysSince(lead.created_at);
  const tipoLabel = CASE_TYPE_LABELS[lead.case_type as CaseType] ?? lead.case_type;
  const tone = dias > 30 ? "danger" : dias > 15 ? "warning" : "success";
  const isReg = lead.is_registration === true;

  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--ink-500)] tabular tracking-tight truncate">
          {isReg ? "Cadastro" : lead.case_code}
        </span>
        {isReg && <Badge tone="navy">Novo cadastro</Badge>}
      </div>
      <div className="mt-1 text-[14px] font-semibold text-[var(--navy)] leading-snug group-hover:text-[var(--gold-700)] transition-colors truncate">
        {lead.client_name}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {isReg ? <span /> : <Badge tone="gold">{tipoLabel}</Badge>}
        <span className="text-[11px] text-[var(--ink-500)] inline-flex items-center gap-1 shrink-0 tabular">
          <StatusDot tone={tone} />
          {dias}d
        </span>
      </div>
      {/* ITEM 5 — envia o caso ao operacional (só p/ cards de caso). O clique não
          navega (stopPropagation/preventDefault): dispara a promoção manual. */}
      {!isReg && onSendToOperacional && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSendToOperacional({
              id: lead.id,
              client_id: lead.client_id,
              client_name: lead.client_name,
            });
          }}
          className="mt-2 w-full inline-flex items-center justify-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--navy)] hover:border-[var(--gold)] hover:bg-[var(--cream)] transition-colors"
        >
          <ArrowRight size={12} /> Enviar para operacional
        </button>
      )}
    </>
  );

  const cls =
    "group block bg-[var(--card)] rounded-[10px] border border-[rgba(120,96,30,0.12)] p-3 hover:-translate-y-0.5 hover:border-[rgba(152,120,20,0.26)] hover:shadow-md transition-all";

  if (isReg) {
    return (
      <Link to="/clientes/$id" params={{ id: lead.client_id ?? lead.id }} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <Link to="/casos/$id" params={{ id: lead.id }} className={cls}>
      {inner}
    </Link>
  );
}
