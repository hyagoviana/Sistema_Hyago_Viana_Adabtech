import { AlertCircle } from "lucide-react";
import { caseTypeLabels, fmtBRL, type CaseType } from "@/mocks/fixtures";
import { Badge, StatusDot } from "./primitives";
import { Link } from "@tanstack/react-router";

export function CaseCard({
  caso,
  compact = true,
}: {
  caso: {
    id: string;
    codigo: string;
    clienteNome: string;
    tipo: CaseType;
    diasNoEstado: number;
    valor: number;
    inadimplente?: boolean;
    proximoPasso?: string;
  };
  compact?: boolean;
}) {
  return (
    <Link
      to="/casos/$id"
      params={{ id: caso.id }}
      className="block bg-[var(--card)] rounded-lg border border-[rgba(120,96,30,0.12)] p-3.5 hover:-translate-y-0.5 hover:border-[rgba(152,120,20,0.26)] hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-[10.5px] text-muted-foreground tracking-tight">
          {caso.codigo}
        </span>
        {caso.inadimplente && <AlertCircle size={13} className="text-[var(--danger)]" />}
      </div>
      <div className="font-display text-[15px] text-[var(--navy)] leading-tight font-semibold group-hover:text-[var(--gold-700)] transition-colors">
        {caso.clienteNome}
      </div>
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <Badge tone="gold">{caseTypeLabels[caso.tipo]}</Badge>
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
          <StatusDot tone={caso.diasNoEstado > 30 ? "danger" : caso.diasNoEstado > 15 ? "warning" : "success"} />
          {caso.diasNoEstado}d
        </span>
      </div>
      {!compact && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground line-clamp-1">{caso.proximoPasso}</span>
          <span className="font-mono text-[11px] text-[var(--navy)]">{fmtBRL(caso.valor)}</span>
        </div>
      )}
    </Link>
  );
}
