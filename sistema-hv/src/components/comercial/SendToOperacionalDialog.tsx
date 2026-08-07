import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCasesList, useLiberarCaso } from "@/hooks/useCases";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";

// ITEM 5 (2026-07-06) — "Enviar para operacional" a partir do board Comercial.
// Lista os casos do lead que ainda estão AGUARDANDO ASSINATURA (no comercial) e
// deixa o usuário escolher QUAL promover. Promover = liberar (limpa
// `aguardando_assinatura_at` via liberarCasoFn) → o Kanban operacional deixa de
// esconder o caso e ele aparece lá. Se só houver 1 caso, fica pré-selecionado.
export function SendToOperacionalDialog({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string | null;
  clientName: string;
  onClose: () => void;
}) {
  const open = clientId !== null;
  const { data: cases, isLoading } = useCasesList(clientId ? { client_id: clientId } : undefined);
  const liberar = useLiberarCaso();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Só os casos AINDA no comercial (aguardando assinatura). Casos já liberados /
  // clientes / perdidos não aparecem aqui.
  const comercialCases = (cases ?? []).filter(
    (c) =>
      !!(c as { aguardando_assinatura_at?: string | null }).aguardando_assinatura_at &&
      (c as { lifecycle?: string }).lifecycle !== "PERDIDO",
  );

  async function promote(id: string) {
    setBusyId(id);
    try {
      await liberar.mutateAsync(id);
      toast.success("Caso enviado para o operacional");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar para operacional");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar para operacional</DialogTitle>
          <DialogDescription>
            {clientName ? `${clientName} · ` : ""}escolha qual caso entra na pipeline operacional. O
            caso sai do funil comercial (aguardando assinatura).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Carregando casos…</div>
        ) : comercialCases.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Nenhum caso aguardando assinatura para este lead.
          </div>
        ) : (
          <div className="space-y-2">
            {comercialCases.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busyId !== null}
                onClick={() => promote(c.id)}
                className="w-full text-left rounded-md border border-[var(--border)] p-3 hover:border-[var(--gold)] transition-colors disabled:opacity-50 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[var(--navy)] truncate">{c.case_code}</div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}
                    {c.proximo_passo ? ` · ${c.proximo_passo}` : ""}
                  </div>
                </div>
                {busyId === c.id ? (
                  <Loader2 size={16} className="animate-spin shrink-0 text-[var(--gold-700)]" />
                ) : (
                  <ArrowRight size={16} className="shrink-0 text-[var(--gold-700)]" />
                )}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busyId !== null}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
