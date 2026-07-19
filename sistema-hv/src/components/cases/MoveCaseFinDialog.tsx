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
import { useMoveCaseStageFin, useStages } from "@/hooks/usePipeline";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseCode: string;
  currentFinSlug: string;
  serviceTypeId: string | null;
};

export function MoveCaseFinDialog({
  open,
  onOpenChange,
  caseId,
  caseCode,
  currentFinSlug,
  serviceTypeId,
}: Props) {
  // `serviceTypeId` pode ser null (caso sem tipo vinculado); "" desativa a query
  // (useStages usa `enabled: !!serviceTypeId`) e a lista de etapas fica vazia.
  const { data: stages } = useStages(serviceTypeId ?? "", "fin");
  const move = useMoveCaseStageFin(serviceTypeId ?? "");

  // Filter out NAO_APLICAVEL stages
  const eligible = (stages ?? []).filter((s) => s.slug !== "NAO_APLICAVEL");

  const currentStage = eligible.find((s) => s.slug === currentFinSlug);
  const currentLabel = currentStage?.label ?? currentFinSlug;

  const [targetId, setTargetId] = useState("");

  // Reset selection when dialog opens
  useEffect(() => {
    if (open && currentStage) {
      setTargetId(currentStage.id);
    }
  }, [open, currentStage]);

  async function handleConfirm() {
    if (!targetId || targetId === currentStage?.id) {
      onOpenChange(false);
      return;
    }
    const targetStage = eligible.find((s) => s.id === targetId);
    try {
      await move.mutateAsync({ caseId, stageId: targetId, toSlug: targetStage?.slug });
      toast.success(`${caseCode} — financeiro movido pra ${targetStage?.label ?? "?"}`);
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
            De <strong>{currentLabel}</strong> para…
          </DialogDescription>
        </DialogHeader>

        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {eligible.map((s) => (
              <SelectItem key={s.id} value={s.id} disabled={s.id === currentStage?.id}>
                {s.label}
                {s.id === currentStage?.id ? " (atual)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={move.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={move.isPending || !targetId || targetId === currentStage?.id}
          >
            {move.isPending ? "Movendo…" : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
