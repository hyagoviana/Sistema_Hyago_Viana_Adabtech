import { Link } from "@tanstack/react-router";
import { ArrowRightLeft } from "lucide-react";
import { useState } from "react";

import { MoveCaseFinDialog } from "./MoveCaseFinDialog";
import { Badge, StatusDot } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { CASE_TYPE_LABELS, type CaseType, type MacroFin } from "@/lib/cases/constants";

type Props = {
  caso: {
    id: string;
    case_code: string;
    case_type: string;
    macrostatus_fin: string;
    status_fin_changed_at: string;
    client_name: string;
  };
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function CaseCardFin({ caso }: Props) {
  const [moveOpen, setMoveOpen] = useState(false);
  const dias = daysSince(caso.status_fin_changed_at);
  const tipoLabel = CASE_TYPE_LABELS[caso.case_type as CaseType] ?? caso.case_type;
  const tone = dias > 30 ? "danger" : dias > 15 ? "warning" : "success";

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
          <Badge tone="navy">FIN</Badge>
        </div>
        <div className="mt-1 text-[14px] font-semibold text-[var(--navy)] leading-snug group-hover:text-[var(--gold-700)] transition-colors truncate">
          {caso.client_name}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge tone="gold">{tipoLabel}</Badge>
          <span className="text-[11px] text-[var(--ink-500)] inline-flex items-center gap-1 shrink-0 tabular">
            <StatusDot tone={tone} />
            {dias}d
          </span>
        </div>
      </Link>
      <div className="absolute top-2 right-2" onClick={stopAll} onPointerDown={stopAll}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Mover financeiro"
          onClick={() => setMoveOpen(true)}
        >
          <ArrowRightLeft size={13} />
        </Button>
      </div>
      <MoveCaseFinDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        caseId={caso.id}
        caseCode={caso.case_code}
        currentStatus={caso.macrostatus_fin as MacroFin}
      />
    </div>
  );
}
