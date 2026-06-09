import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { CaseFormDialog } from "./CaseFormDialog";
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

type Props = { clientId: string };

export function ClientCasesSection({ clientId }: Props) {
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
            <li key={c.id}>
              <Link
                to="/casos/$id"
                params={{ id: c.id }}
                className="card-editorial !p-4 flex items-center gap-4 hover:border-[rgba(30,32,68,0.18)] transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {c.case_code}
                    </span>
                    <Badge tone="gold">
                      {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}
                    </Badge>
                  </div>
                  <div className="text-[14px] text-[var(--navy)] font-semibold">
                    {MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op}
                  </div>
                  {c.proximo_passo && (
                    <div className="text-[11.5px] text-muted-foreground mt-1 line-clamp-1">
                      {c.proximo_passo}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CaseFormDialog open={createOpen} onOpenChange={setCreateOpen} presetClientId={clientId} />
    </>
  );
}
