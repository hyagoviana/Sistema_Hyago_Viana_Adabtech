import {
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  XCircle,
} from "lucide-react";
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
import { useCancelCharge, useCreateCharge, usePixQrCode, useSyncAsaasPagamentos, useSyncClientToAsaas } from "@/hooks/useAsaas";
import { useSyncClientToContaAzul, useCreateContaAzulCharge } from "@/hooks/useContaAzul";
import { useParcelas } from "@/hooks/useTermo";

function brl(c: number | null | undefined) {
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

const PROVIDER_LABELS: Record<string, { label: string; cls: string }> = {
  conta_azul: { label: "Conta Azul", cls: "bg-blue-50 text-blue-700" },
  asaas: { label: "Asaas", cls: "bg-emerald-50 text-emerald-700" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  PAGA: { label: "Paga", cls: "bg-green-600 text-white" },
  VENCIDA: { label: "Vencida", cls: "bg-[var(--danger)] text-white" },
  CANCELADA: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  RENEGOCIADA: { label: "Renegociada", cls: "bg-blue-100 text-blue-800" },
};

const CA_PAYMENT_LABELS: Record<string, string> = {
  BOLETO: "Boleto bancário",
  PIX: "Pix",
  CARTAO_CREDITO: "Cartão de crédito",
  TRANSFERENCIA: "Transferência",
  DINHEIRO: "Dinheiro",
  OUTRO: "Outro",
};

type Props = {
  caseId: string;
  clientId: string;
};

export function AsaasCobrancasPanel({ caseId, clientId }: Props) {
  const { data: parcelas, isLoading } = useParcelas(caseId);
  const syncClient = useSyncClientToContaAzul();
  const syncAsaasClient = useSyncClientToAsaas();
  const syncAsaasPagamentos = useSyncAsaasPagamentos();
  const cancelCharge = useCancelCharge();
  const [novaOpen, setNovaOpen] = useState(false);
  const [pixFor, setPixFor] = useState<string | null>(null);

  const hasParcelas = (parcelas ?? []).length > 0;
  const semProvider = (parcelas ?? []).filter(
    (p) => !p.provider && p.status !== "PAGA" && p.status !== "CANCELADA",
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Cobranças
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={syncClient.isPending}
            onClick={() =>
              syncClient.mutate(clientId, {
                onSuccess: (r) =>
                  toast.success(
                    r.created
                      ? "Cliente criado no Conta Azul"
                      : "Cliente sincronizado com Conta Azul",
                  ),
                onError: (e) =>
                  toast.error(e instanceof Error ? e.message : "Falha ao sincronizar"),
              })
            }
            title="Sincronizar cliente com Conta Azul"
          >
            {syncClient.isPending ? (
              <Loader2 size={12} className="mr-1 animate-spin" />
            ) : (
              <RefreshCw size={12} className="mr-1" />
            )}
            Sync Conta Azul
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={syncAsaasClient.isPending || syncAsaasPagamentos.isPending}
            onClick={() => {
              syncAsaasClient.mutate(clientId, {
                onSuccess: (r) =>
                  toast.success(
                    r.created
                      ? "Cliente criado no Asaas"
                      : "Cliente sincronizado com Asaas",
                  ),
                onError: (e) =>
                  toast.error(e instanceof Error ? e.message : "Falha ao sincronizar"),
              });
              syncAsaasPagamentos.mutate(caseId, {
                onSuccess: (r) => {
                  if (r.atualizadas > 0) toast.success(`${r.atualizadas} parcela(s) atualizada(s) via Asaas`);
                },
              });
            }}
            title="Sincronizar cliente e pagamentos com Asaas"
          >
            {(syncAsaasClient.isPending || syncAsaasPagamentos.isPending) ? (
              <Loader2 size={12} className="mr-1 animate-spin" />
            ) : (
              <RefreshCw size={12} className="mr-1" />
            )}
            Sync Asaas
          </Button>
          <Button size="sm" onClick={() => setNovaOpen(true)}>
            <Plus size={13} className="mr-1" /> Nova cobrança
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-[13px] text-muted-foreground py-4 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Carregando parcelas…
        </div>
      )}

      {!isLoading && !hasParcelas && (
        <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center">
          <Receipt size={28} className="mx-auto text-muted-foreground mb-2" />
          <div className="text-[13px] text-muted-foreground">
            Nenhuma cobrança gerada ainda.
          </div>
          <div className="text-[12px] text-muted-foreground mt-1">
            Clique em "Nova cobrança" para gerar parcelas via Conta Azul.
          </div>
        </div>
      )}

      {hasParcelas && (
        <div className="rounded-md border border-[var(--border)] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-2 bg-[var(--muted)] text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <span>#</span>
            <span>Vencimento</span>
            <span>Valor</span>
            <span>Status</span>
            <span>Ações</span>
          </div>

          {/* Linhas */}
          {(parcelas ?? []).map((p) => {
            const hasProvider = !!p.provider;
            const providerMeta = p.provider ? PROVIDER_LABELS[p.provider] : null;
            const meta = STATUS_BADGE[p.status] ?? STATUS_BADGE.PENDENTE;
            const isActive = p.status !== "PAGA" && p.status !== "CANCELADA";
            const isAsaas = p.provider === "asaas" && !!p.provider_ext_id;

            return (
              <div
                key={p.id}
                className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-t border-[var(--border)] items-center text-[13px] hover:bg-[var(--cream)] transition-colors"
              >
                <span className="font-mono text-[12px] text-muted-foreground w-6">
                  {String(p.numero).padStart(2, "0")}
                </span>

                <span className="flex items-center gap-2">
                  {new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                  {providerMeta && (
                    <Badge className={`${providerMeta.cls} text-[9px] px-1.5 py-0`}>
                      {providerMeta.label}
                    </Badge>
                  )}
                  {p.metodo_pagamento && p.status === "PAGA" && (
                    <span className="text-[11px] text-muted-foreground">
                      via {p.metodo_pagamento}
                    </span>
                  )}
                </span>

                <span className="font-medium text-[var(--navy)] tabular-nums">
                  {brl(p.valor_centavos)}
                </span>

                <Badge className={`${meta.cls} text-[10px]`}>{meta.label}</Badge>

                <span className="flex items-center gap-1.5">
                  {/* Fatura/Boleto (Asaas) */}
                  {isAsaas && p.boleto_url && isActive && (
                    <a href={p.boleto_url} target="_blank" rel="noreferrer" title="Ver fatura">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[var(--navy)]">
                        <ExternalLink size={13} />
                      </Button>
                    </a>
                  )}

                  {/* Pix QR Code (Asaas) */}
                  {isAsaas && isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-[var(--navy)]"
                      onClick={() => setPixFor(p.id)}
                      title="QR Code Pix"
                    >
                      <QrCode size={13} />
                    </Button>
                  )}

                  {/* Cancelar (Asaas) */}
                  {isAsaas && isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-[var(--danger)]"
                      disabled={cancelCharge.isPending}
                      onClick={() =>
                        cancelCharge.mutate(p.id, {
                          onSuccess: () => toast.success("Cobrança cancelada"),
                          onError: (e) =>
                            toast.error(e instanceof Error ? e.message : "Falha"),
                        })
                      }
                      title="Cancelar cobrança"
                    >
                      <XCircle size={13} />
                    </Button>
                  )}
                </span>
              </div>
            );
          })}

          {/* Rodapé */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-t-2 border-[var(--navy)] bg-[var(--cream)]">
            <span />
            <span className="text-[12px] font-medium text-[var(--navy)]">
              {(parcelas ?? []).length} parcela(s)
            </span>
            <span className="font-semibold text-[var(--navy)] tabular-nums text-[13px]">
              {brl((parcelas ?? []).reduce((sum, p) => sum + (p.valor_centavos ?? 0), 0))}
            </span>
            <span>
              <Badge className="bg-green-100 text-green-800 text-[10px]">
                {(parcelas ?? []).filter((p) => p.status === "PAGA").length} paga(s)
              </Badge>
            </span>
            <span />
          </div>
        </div>
      )}

      {semProvider.length > 0 && (
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-800">
          <strong>{semProvider.length}</strong> parcela(s) pendente(s) sem provider vinculado.
        </div>
      )}

      <NovaCobrancaDialog caseId={caseId} open={novaOpen} onOpenChange={setNovaOpen} />

      <PixQrCodeDialog parcelaId={pixFor} onOpenChange={(v) => !v && setPixFor(null)} />
    </div>
  );
}

// ─── Dialog: Nova Cobrança ───────────────────────────────────────────────────

function NovaCobrancaDialog({
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
            toast.success(`${r.parcelaIds.length} parcela(s) gerada(s) — Conta Azul`);
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
            toast.success(`${r.parcelaIds.length} parcela(s) gerada(s) — Asaas`);
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
                    : "—"}
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

// ─── Dialog: Pix QR Code (Asaas) ────────────────────────────────────────────

function PixQrCodeDialog({
  parcelaId,
  onOpenChange,
}: {
  parcelaId: string | null;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: pix, isLoading, isError } = usePixQrCode(parcelaId ?? undefined);

  function copyPayload() {
    if (!pix?.payload) return;
    navigator.clipboard.writeText(pix.payload).then(
      () => toast.success("Código Pix copiado!"),
      () => toast.error("Não foi possível copiar"),
    );
  }

  return (
    <Dialog open={!!parcelaId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pix QR Code</DialogTitle>
          <DialogDescription>
            Escaneie o QR Code ou copie o código Pix copia-e-cola.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {isLoading && (
            <div className="flex items-center gap-2 py-8 text-muted-foreground text-[13px]">
              <Loader2 size={16} className="animate-spin" /> Gerando QR Code…
            </div>
          )}
          {isError && (
            <div className="text-[var(--danger)] text-[13px] py-4">
              Erro ao gerar QR Code. Verifique se a cobrança está ativa.
            </div>
          )}
          {pix?.encodedImage && (
            <img
              src={`data:image/png;base64,${pix.encodedImage}`}
              alt="QR Code Pix"
              className="w-52 h-52 rounded-md border border-[var(--border)]"
            />
          )}
          {pix?.payload && (
            <div className="w-full">
              <div className="flex items-center gap-1 mb-1">
                <Label className="text-[11px]">Copia e cola</Label>
              </div>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={pix.payload}
                  className="text-[11px] font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button size="sm" variant="outline" onClick={copyPayload} title="Copiar">
                  <Copy size={13} />
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
