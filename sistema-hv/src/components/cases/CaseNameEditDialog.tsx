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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateCase } from "@/hooks/useCases";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  currentName: string | null;
};

// J2 — edição do NOME DO CASO (system_cases.caso_pasta_nome). O fluxo normal grava
// esse campo a partir da pasta escolhida; os importados Mais Médicos (A8) vieram
// sem ele, caindo no nome do TEMA na lista (redundante). Aqui o admin/usuário com
// edição define/altera o nome (grava via updateCaseFn; vazio → volta a null). O
// validador (case.ts) limita a 200 chars com trim.
export function CaseNameEditDialog({ open, onOpenChange, caseId, currentName }: Props) {
  const update = useUpdateCase();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue(currentName ?? "");
  }, [open, currentName]);

  const handleSave = async () => {
    const trimmed = value.trim();
    try {
      await update.mutateAsync({
        id: caseId,
        // Vazio limpa o nome (volta a null → lista cai no tema de novo).
        input: { caso_pasta_nome: trimmed ? trimmed : null },
      });
      toast.success("Nome do caso atualizado");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar o nome");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Nome do caso</DialogTitle>
          <DialogDescription>
            Define como o caso aparece na ficha e na lista. Deixe em branco para usar o nome do
            tema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="case-name">Nome do caso</Label>
          <Input
            id="case-name"
            placeholder="Ex.: Mais Médicos · Município X"
            autoFocus
            maxLength={200}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
