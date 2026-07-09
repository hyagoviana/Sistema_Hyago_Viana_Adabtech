import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMoveCaseStatus } from "@/hooks/useCases";
import { useServiceTypes, useStages } from "@/hooks/usePipeline";
import { MACRO_OP_LABELS, type MacroOp } from "@/lib/cases/constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseCode: string;
  // Slug do tipo do caso — resolve as ETAPAS configuráveis da categoria.
  caseType: string;
  // Slug da etapa op atual.
  currentStatus: string;
};

// (2026-07-09) — as opções de status vêm das ETAPAS da categoria (banco), não mais
// de uma lista fixa. Assim, criar/renomear um funil numa categoria reflete aqui.
export function MoveCaseDialog({
  open,
  onOpenChange,
  caseId,
  caseCode,
  caseType,
  currentStatus,
}: Props) {
  const move = useMoveCaseStatus();
  const { data: serviceTypes } = useServiceTypes();
  const serviceTypeId = (serviceTypes ?? []).find((t) => t.slug === caseType)?.id ?? null;
  const { data: stages } = useStages(serviceTypeId ?? "", "op");
  const [target, setTarget] = useState<string>(currentStatus);

  // Ao (re)abrir ou trocar de caso, reinicia o alvo para a etapa atual.
  useEffect(() => {
    if (open) setTarget(currentStatus);
  }, [open, currentStatus]);

  // Rótulo de uma etapa: prefere o label do banco; cai no rótulo fixo/slug cru.
  const labelOf = (slug: string) =>
    (stages ?? []).find((s) => s.slug === slug)?.label ?? MACRO_OP_LABELS[slug as MacroOp] ?? slug;

  const options = stages ?? [];

  async function handleConfirm() {
    if (target === currentStatus) {
      onOpenChange(false);
      return;
    }
    try {
      await move.mutateAsync({ id: caseId, to: target });
      toast.success(`${caseCode} movido pra ${labelOf(target)}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao mover");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Mover {caseCode}</DialogTitle>
          <DialogDescription>
            De <strong>{labelOf(currentStatus)}</strong> para…
          </DialogDescription>
        </DialogHeader>

        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <SelectItem value={currentStatus} disabled>
                {labelOf(currentStatus)} (atual)
              </SelectItem>
            ) : (
              options.map((s) => (
                <SelectItem key={s.id} value={s.slug} disabled={s.slug === currentStatus}>
                  {s.label}
                  {s.slug === currentStatus ? " (atual)" : ""}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={move.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={move.isPending || target === currentStatus}>
            {move.isPending ? "Movendo…" : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
