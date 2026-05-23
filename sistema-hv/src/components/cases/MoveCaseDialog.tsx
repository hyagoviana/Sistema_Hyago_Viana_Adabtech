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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMoveCaseStatus } from "@/hooks/useCases";
import { MACRO_OP, MACRO_OP_LABELS, type MacroOp } from "@/lib/cases/constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseCode: string;
  currentStatus: MacroOp;
};

export function MoveCaseDialog({ open, onOpenChange, caseId, caseCode, currentStatus }: Props) {
  const move = useMoveCaseStatus();
  const [target, setTarget] = useState<MacroOp>(currentStatus);

  async function handleConfirm() {
    if (target === currentStatus) {
      onOpenChange(false);
      return;
    }
    try {
      await move.mutateAsync({ id: caseId, to: target });
      toast.success(`${caseCode} movido pra ${MACRO_OP_LABELS[target]}`);
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
            De <strong>{MACRO_OP_LABELS[currentStatus]}</strong> para…
          </DialogDescription>
        </DialogHeader>

        <Select value={target} onValueChange={(v) => setTarget(v as MacroOp)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MACRO_OP.map((s) => (
              <SelectItem key={s} value={s} disabled={s === currentStatus}>
                {MACRO_OP_LABELS[s]}
                {s === currentStatus ? " (atual)" : ""}
              </SelectItem>
            ))}
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
