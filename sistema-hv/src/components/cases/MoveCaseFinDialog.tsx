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
import { useMoveCaseStatusFin } from "@/hooks/useCases";
import { MACRO_FIN, MACRO_FIN_LABELS, type MacroFin } from "@/lib/cases/constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseCode: string;
  currentStatus: MacroFin;
};

// NAO_APLICAVEL não aparece como opção de destino — política de negócio.
const ELIGIBLE_TARGETS = MACRO_FIN.filter((s) => s !== "NAO_APLICAVEL");

export function MoveCaseFinDialog({ open, onOpenChange, caseId, caseCode, currentStatus }: Props) {
  const move = useMoveCaseStatusFin();
  const initial = currentStatus === "NAO_APLICAVEL" ? "ELABORANDO" : currentStatus;
  const [target, setTarget] = useState<MacroFin>(initial as MacroFin);

  async function handleConfirm() {
    if (target === currentStatus) {
      onOpenChange(false);
      return;
    }
    try {
      await move.mutateAsync({ id: caseId, to: target });
      toast.success(`${caseCode} — financeiro movido pra ${MACRO_FIN_LABELS[target]}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao mover");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Mover financeiro · {caseCode}</DialogTitle>
          <DialogDescription>
            De <strong>{MACRO_FIN_LABELS[currentStatus]}</strong> para…
          </DialogDescription>
        </DialogHeader>

        <Select value={target} onValueChange={(v) => setTarget(v as MacroFin)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ELIGIBLE_TARGETS.map((s) => (
              <SelectItem key={s} value={s} disabled={s === currentStatus}>
                {MACRO_FIN_LABELS[s]}
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
