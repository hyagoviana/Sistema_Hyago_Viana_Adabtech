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
import { useUpdateClientCpf } from "@/hooks/useClients";
import { formatCpfCnpj } from "@/lib/format";
import { isValidCnpj, isValidCpf, sanitizeCpfCnpj } from "@/lib/validators/client";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  currentCpf: string | null;
};

// J2 — diálogo para trocar o marcador provisório (CL-XXXX, importados Mais
// Médicos / A8) pelo CPF ou CNPJ REAL. Valida no cliente (reusa isValidCpf/
// isValidCnpj) antes de enviar; o servidor revalida e trata o UNIQUE parcial
// (CPF já usado por outro cliente ativo) com mensagem clara.
export function ClientCpfFillDialog({ open, onOpenChange, clientId, currentCpf }: Props) {
  const update = useUpdateClientCpf();
  const [value, setValue] = useState("");

  // Ao abrir: começa vazio (o valor atual é o marcador, não um CPF editável).
  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  const digits = sanitizeCpfCnpj(value);
  const isValid =
    (digits.length === 11 && isValidCpf(digits)) || (digits.length === 14 && isValidCnpj(digits));

  const handleSave = async () => {
    if (!isValid) {
      toast.error("Informe um CPF ou CNPJ válido");
      return;
    }
    try {
      await update.mutateAsync({ id: clientId, cpf_cnpj: digits });
      toast.success("CPF atualizado");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar o CPF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Preencher CPF/CNPJ</DialogTitle>
          <DialogDescription>
            Substitui o marcador provisório
            {currentCpf ? ` (${currentCpf})` : ""} pelo CPF ou CNPJ real do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cpf-fill">CPF / CNPJ *</Label>
          <Input
            id="cpf-fill"
            placeholder="000.000.000-00"
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={(e) => setValue(formatCpfCnpj(e.target.value))}
          />
          {value && !isValid && (
            <p className="text-[12px] text-destructive">CPF ou CNPJ inválido.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={update.isPending || !isValid}>
            {update.isPending ? "Salvando…" : "Salvar CPF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
