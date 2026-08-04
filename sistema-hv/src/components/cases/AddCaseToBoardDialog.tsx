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
import { useAddCaseToBoard, useBoards } from "@/hooks/useBoards";

// A3 — "Adicionar à lista/board": espelha MoveCaseFinDialog. Insere o caso na 1ª
// etapa do board escolhido (board CUSTOM; o principal já contém todo caso).
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseCode: string;
  serviceTypeId: string | null;
};

export function AddCaseToBoardDialog({
  open,
  onOpenChange,
  caseId,
  caseCode,
  serviceTypeId,
}: Props) {
  const { data: boards } = useBoards(serviceTypeId ?? "");
  const add = useAddCaseToBoard();

  // Só boards CUSTOM (o principal contém todo caso automaticamente).
  const eligible = (boards ?? []).filter((b) => !b.is_principal);

  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (open) setTargetId(eligible[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boards]);

  async function handleConfirm() {
    if (!targetId) {
      onOpenChange(false);
      return;
    }
    const board = eligible.find((b) => b.id === targetId);
    try {
      await add.mutateAsync({ caseId, boardId: targetId });
      toast.success(`${caseCode} — adicionado à lista "${board?.label ?? "?"}"`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Adicionar à lista · {caseCode}</DialogTitle>
          <DialogDescription>
            Escolha um board/lista deste tema. O caso entra na primeira etapa. As listas
            compartilham os mesmos campos e filtros do tema.
          </DialogDescription>
        </DialogHeader>

        {eligible.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-2">
            Este tema ainda não tem outras listas. Crie uma em "Editar etapas" › "Listas do tema".
          </p>
        ) : (
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma lista…" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={add.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={add.isPending || !targetId || eligible.length === 0}
          >
            {add.isPending ? "Adicionando…" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
