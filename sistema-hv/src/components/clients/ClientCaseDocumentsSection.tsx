import { Link } from "@tanstack/react-router";
import { ExternalLink, FileSignature, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClientCaseDocuments } from "@/hooks/useCaseDocuments";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  EM_EDICAO: { label: "Em edição", cls: "bg-amber-100 text-amber-800" },
  FINALIZADO: { label: "Finalizado", cls: "bg-[var(--navy)] text-white" },
  ENVIADO_ZAPSIGN: { label: "Aguardando assinatura", cls: "bg-[var(--gold-700)] text-white" },
  ASSINADO: { label: "Assinado", cls: "bg-green-600 text-white" },
  CANCELADO: { label: "Cancelado", cls: "bg-muted text-muted-foreground line-through" },
};

type Props = { clientId: string };

export function ClientCaseDocumentsSection({ clientId }: Props) {
  const { data: docs, isLoading } = useClientCaseDocuments(clientId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-md" />
        ))}
      </div>
    );
  }

  if ((docs ?? []).length === 0) {
    return (
      <div className="card-editorial !p-8 text-center text-muted-foreground italic text-sm">
        Nenhum documento gerado nos casos deste cliente ainda.
      </div>
    );
  }

  return (
    <div className="card-editorial !p-0 overflow-hidden">
      <ul>
        {(docs ?? []).map((d) => {
          const meta = STATUS_META[d.status] ?? STATUS_META.RASCUNHO;
          const isProcuracao = d.doc_kind === "procuracao";
          return (
            <li
              key={d.id}
              className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] last:border-0"
            >
              <FileText size={16} className="text-[var(--gold-700)] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-[var(--navy)] font-medium truncate">{d.title}</div>
                <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                  {isProcuracao && (
                    <Badge className="bg-[var(--navy)]/10 text-[var(--navy)]">Procuração</Badge>
                  )}
                  <Badge className={meta.cls}>{meta.label}</Badge>
                  {d.case_code && (
                    <span className="text-[11px] text-muted-foreground">· {d.case_code}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {d.status === "ENVIADO_ZAPSIGN" && d.zapsign_sign_url && (
                  <a href={d.zapsign_sign_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <FileSignature size={13} className="mr-1" /> Assinatura
                    </Button>
                  </a>
                )}
                {d.status === "ASSINADO" && d.drive_url && (
                  <a href={d.drive_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink size={13} className="mr-1" /> Assinado
                    </Button>
                  </a>
                )}
                <Button asChild variant="ghost" size="sm">
                  <Link to="/casos/$id" params={{ id: d.case_id }}>
                    Ver no caso
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
