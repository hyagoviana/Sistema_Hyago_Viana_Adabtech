import { Loader2, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { maskBrlReais, normalizeBrl } from "@/lib/format";
import { useCreateCharge } from "@/hooks/useAsaas";
import { useCreateContaAzulCharge } from "@/hooks/useContaAzul";

// R4-05 — dialog "Nova cobrança" EXTRAÍDO de AsaasCobrancasPanel para ser
// reusado em dois lugares sem duplicar o fluxo: (1) painel de cobranças da
// ficha do CASO (AsaasCobrancasPanel) e (2) painel financeiro do CLIENTE
// (ClientFinanceiroSection, dentro do gate financeiro:edit). Um único código
// de criação de cobrança (Conta Azul/Asaas), sem divergência.

export function brl(c: number | null | undefined) {
  return "R$ " + ((c ?? 0) / 100).toFixed(2).replace(".", ",");
}

function toCents(v: string): number {
  const n = Number(
    String(v)
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Math.round((isNaN(n) ? 0 : n) * 100);
}

export const PROVIDER_LABELS: Record<string, { label: string; cls: string }> = {
  conta_azul: { label: "Conta Azul", cls: "bg-blue-50 text-blue-700" },
  asaas: { label: "Asaas", cls: "bg-emerald-50 text-emerald-700" },
};

export const CA_PAYMENT_LABELS: Record<string, string> = {
  BOLETO: "Boleto bancário",
  PIX: "Pix",
  CARTAO_CREDITO: "Cartão de crédito",
  TRANSFERENCIA: "Transferência",
  DINHEIRO: "Dinheiro",
  OUTRO: "Outro",
};

export function NovaCobrancaDialog({
  caseId,
  open,
  onOpenChange,
}: {
  caseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createContaAzul = useCreateContaAzulCharge();
  const createAsaas = useCreateCharge();
  const [provider, setProvider] = useState<"conta_azul" | "asaas">("conta_azul");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [parcelas, setParcelas] = useState("1");

  useEffect(() => {
    if (open) {
      setProvider("conta_azul");
      setPaymentMethod("PIX");
      setValor("");
      setVencimento(new Date().toISOString().slice(0, 10));
      setDescricao("");
      setParcelas("1");
    }
  }, [open]);

  const valorCentavos = toCents(valor);
  const qtdParcelas = Math.max(1, Math.min(60, parseInt(parcelas) || 1));
  const valorParcela = qtdParcelas > 1 ? Math.round(valorCentavos / qtdParcelas) : valorCentavos;
  const isPending = createContaAzul.isPending || createAsaas.isPending;

  function handleConfirm() {
    if (!valorCentavos || !vencimento) {
      toast.error("Informe o valor e a data de vencimento");
      return;
    }

    if (provider === "conta_azul") {
      createContaAzul.mutate(
        {
          caseId,
          paymentMethod,
          value: valorCentavos / 100,
          dueDate: vencimento,
          description: descricao.trim() || undefined,
          installmentCount: qtdParcelas > 1 ? qtdParcelas : undefined,
        },
        {
          onSuccess: (r) => {
            toast.success(`${r.parcelaIds.length} parcela(s) gerada(s) · Conta Azul`);
            onOpenChange(false);
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
        },
      );
    } else {
      // Asaas
      const billingMap: Record<string, "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED"> = {
        BOLETO: "BOLETO",
        PIX: "PIX",
        CARTAO_CREDITO: "CREDIT_CARD",
        OUTRO: "UNDEFINED",
      };
      createAsaas.mutate(
        {
          caseId,
          billingType: billingMap[paymentMethod] ?? "UNDEFINED",
          value: valorCentavos / 100,
          dueDate: vencimento,
          description: descricao.trim() || undefined,
          installmentCount: qtdParcelas > 1 ? qtdParcelas : undefined,
        },
        {
          onSuccess: (r) => {
            toast.success(`${r.parcelaIds.length} parcela(s) gerada(s) · Asaas`);
            onOpenChange(false);
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
        },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
          <DialogDescription>
            Gere parcelas vinculadas ao caso. O cliente é sincronizado automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* Provider */}
          <div>
            <Label>Plataforma</Label>
            <div className="mt-1 flex rounded-md border border-[var(--border)] overflow-hidden text-[12px]">
              {(["conta_azul", "asaas"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setProvider(v)}
                  className={
                    provider === v
                      ? "flex-1 px-3 py-1.5 bg-[var(--navy)] text-white"
                      : "flex-1 px-3 py-1.5 text-muted-foreground hover:bg-[var(--muted)]"
                  }
                >
                  {v === "conta_azul" ? "Conta Azul" : "Asaas"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Valor total (R$)</Label>
            <Input
              value={valor}
              onChange={(e) => setValor(maskBrlReais(e.target.value))}
              onBlur={() => setValor((v) => normalizeBrl(v))}
              inputMode="decimal"
              placeholder="500,00"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
            <div>
              <Label>Parcelas</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <div>
            <Label>Forma de pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CA_PAYMENT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descrição (opcional)</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Honorários advocatícios"
            />
          </div>

          {/* Preview */}
          {valorCentavos > 0 && (
            <div className="rounded-md bg-[var(--muted)] p-3 text-[13px] space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium text-[var(--navy)]">{brl(valorCentavos)}</span>
              </div>
              {qtdParcelas > 1 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{qtdParcelas}x de</span>
                  <span className="font-medium">{brl(valorParcela)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Forma</span>
                <span>{CA_PAYMENT_LABELS[paymentMethod] ?? paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">1º vencimento</span>
                <span>
                  {vencimento
                    ? new Date(vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                    : "·"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plataforma</span>
                <Badge className={PROVIDER_LABELS[provider].cls + " text-[10px]"}>
                  {PROVIDER_LABELS[provider].label}
                </Badge>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !valorCentavos || !vencimento}>
            {isPending ? (
              <Loader2 size={13} className="mr-1 animate-spin" />
            ) : (
              <Receipt size={13} className="mr-1" />
            )}
            Gerar cobrança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
