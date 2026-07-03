import { Link } from "@tanstack/react-router";

import { Badge, StatusDot } from "@/components/hv/primitives";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";

// Card de LEAD (esteira comercial). Variante enxuta de CaseCardReal SEM o
// MoveCaseDialog operacional — no Kanban comercial a movimentação é por DnD e a
// coluna é lida de macrostatus_comercial (não macrostatus_op). Clicar abre a ficha.
type Props = {
  lead: {
    id: string;
    case_code: string;
    case_type: string;
    macrostatus_comercial: string | null;
    created_at: string;
    client_name: string;
  };
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function LeadCard({ lead }: Props) {
  const dias = daysSince(lead.created_at);
  const tipoLabel = CASE_TYPE_LABELS[lead.case_type as CaseType] ?? lead.case_type;
  const tone = dias > 30 ? "danger" : dias > 15 ? "warning" : "success";

  return (
    <Link
      to="/casos/$id"
      params={{ id: lead.id }}
      className="group block bg-[var(--card)] rounded-[10px] border border-[rgba(120,96,30,0.12)] p-3 hover:-translate-y-0.5 hover:border-[rgba(152,120,20,0.26)] hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--ink-500)] tabular tracking-tight truncate">
          {lead.case_code}
        </span>
      </div>
      <div className="mt-1 text-[14px] font-semibold text-[var(--navy)] leading-snug group-hover:text-[var(--gold-700)] transition-colors truncate">
        {lead.client_name}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Badge tone="gold">{tipoLabel}</Badge>
        <span className="text-[11px] text-[var(--ink-500)] inline-flex items-center gap-1 shrink-0 tabular">
          <StatusDot tone={tone} />
          {dias}d
        </span>
      </div>
    </Link>
  );
}
