import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { CaseFormDialog } from "./CaseFormDialog";
import { CaseSignActions } from "./CaseSignActions";
import { Badge } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import {
  CASE_TYPE_LABELS,
  MACRO_OP_LABELS,
  type CaseType,
  type MacroOp,
} from "@/lib/cases/constants";

type Props = {
  clientId: string;
  clientName?: string;
  clientCpf?: string;
  clientEmail?: string;
  clientPhone?: string;
};

export function ClientCasesSection({
  clientId,
  clientName,
  clientCpf,
  clientEmail,
  clientPhone,
}: Props) {
  const { data, isLoading, isError, error } = useCasesList({ client_id: clientId });
  const [createOpen, setCreateOpen] = useState(false);
  const cases = data ?? [];

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[24px] font-semibold text-[var(--navy)]">
          Casos do cliente
        </h2>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1.5" /> Novo caso
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>
            Erro ao listar casos: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="card-editorial !p-8 text-center text-muted-foreground italic text-sm">
          Esse cliente ainda não tem casos. Clique em "Novo caso" pra começar.
        </div>
      ) : (
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.id} className="card-editorial !p-4">
              <div className="flex items-center gap-4">
                <Link
                  to="/casos/$id"
                  params={{ id: c.id }}
                  className="flex-1 min-w-0 group"
                >
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}
                  </span>
                  <div className="text-[15px] text-[var(--navy)] font-semibold mt-0.5 group-hover:text-[var(--gold-700)] transition-colors">
                    {c.case_code}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge tone="gold">
                      {MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op}
                    </Badge>
                    {c.proximo_passo && (
                      <span className="text-[11.5px] text-muted-foreground line-clamp-1">
                        {c.proximo_passo}
                      </span>
                    )}
                  </div>
                </Link>
                {/* S9-09 — enviar procuração/contrato direto da ficha do cliente
                    (por caso). Visível para lead E cliente. */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <CaseSignActions
                    caseId={c.id}
                    clientId={clientId}
                    caseType={c.case_type}
                    clientName={clientName}
                    clientCpf={clientCpf}
                    municipio={c.municipio ?? undefined}
                    procuracaoAssinada={
                      !!(c as { procuracao_assinada_at?: string | null }).procuracao_assinada_at
                    }
                    autoFillExtra={{
                      email: clientEmail,
                      phone: clientPhone,
                      caseCode: c.case_code,
                      responsavel: c.responsavel ?? undefined,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CaseFormDialog open={createOpen} onOpenChange={setCreateOpen} presetClientId={clientId} />
    </>
  );
}
