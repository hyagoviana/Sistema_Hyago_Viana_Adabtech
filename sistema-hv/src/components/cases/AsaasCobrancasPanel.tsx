import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
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
// R4-05 — dialog "Nova cobrança" extraído para NovaCobrancaDialog (reusado
// aqui e no painel financeiro do cliente). PROVIDER_LABELS/brl também vêm de lá.
import { NovaCobrancaDialog, PROVIDER_LABELS, brl } from "@/components/cases/NovaCobrancaDialog";
import {
  useCancelCharge,
  usePixQrCode,
  useSyncAsaasPagamentos,
  useSyncClientToAsaas,
} from "@/hooks/useAsaas";
import {
  useCancelContaAzulCharge,
  useSyncClientToContaAzul,
  useSyncContaAzulPagamentos,
} from "@/hooks/useContaAzul";
import { useParcelas, useSetParcelaContaAzulFatura } from "@/hooks/useTermo";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  PAGA: { label: "Paga", cls: "bg-green-600 text-white" },
  VENCIDA: { label: "Vencida", cls: "bg-[var(--danger)] text-white" },
  CANCELADA: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  RENEGOCIADA: { label: "Renegociada", cls: "bg-blue-100 text-blue-800" },
};

type Props = {
  caseId: string;
  clientId: string;
  // M6 (2026-08-07) — habilita a edição do nº da fatura Conta Azul por parcela.
  podeEditarFin?: boolean;
};

export function AsaasCobrancasPanel({ caseId, clientId, podeEditarFin = false }: Props) {
  const { data: parcelas, isLoading } = useParcelas(caseId);
  const syncClient = useSyncClientToContaAzul();
  const syncAsaasClient = useSyncClientToAsaas();
  const syncAsaasPagamentos = useSyncAsaasPagamentos();
  const syncCAPagamentos = useSyncContaAzulPagamentos();
  const cancelCharge = useCancelCharge();
  const cancelCACharge = useCancelContaAzulCharge();
  const [novaOpen, setNovaOpen] = useState(false);
  const [pixFor, setPixFor] = useState<string | null>(null);

  const hasParcelas = (parcelas ?? []).length > 0;
  const semProvider = (parcelas ?? []).filter(
    (p) => !p.provider && p.status !== "PAGA" && p.status !== "CANCELADA",
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Cobranças</div>
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
                    r.created ? "Cliente criado no Asaas" : "Cliente sincronizado com Asaas",
                  ),
                onError: (e) =>
                  toast.error(e instanceof Error ? e.message : "Falha ao sincronizar"),
              });
              syncAsaasPagamentos.mutate(caseId, {
                onSuccess: (r) => {
                  if (r.atualizadas > 0)
                    toast.success(`${r.atualizadas} parcela(s) atualizada(s) via Asaas`);
                },
              });
            }}
            title="Sincronizar cliente e pagamentos com Asaas"
          >
            {syncAsaasClient.isPending || syncAsaasPagamentos.isPending ? (
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
          <div className="text-[13px] text-muted-foreground">Nenhuma cobrança gerada ainda.</div>
          <div className="text-[12px] text-muted-foreground mt-1">
            Clique em "Nova cobrança" para gerar parcelas via Conta Azul.
          </div>
        </div>
      )}

      {hasParcelas && (
        <div className="rounded-md border border-[var(--border)] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-2 bg-[var(--muted)] text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <span>#</span>
            <span>Vencimento</span>
            <span>Valor</span>
            <span>Status</span>
            <span>Fatura CA</span>
            <span>Ações</span>
          </div>

          {/* Linhas */}
          {(parcelas ?? []).map((p) => {
            const hasProvider = !!p.provider;
            const providerMeta = p.provider ? PROVIDER_LABELS[p.provider] : null;
            const meta = STATUS_BADGE[p.status] ?? STATUS_BADGE.PENDENTE;
            const isActive = p.status !== "PAGA" && p.status !== "CANCELADA";
            const isAsaas = p.provider === "asaas" && !!p.provider_ext_id;
            const isCA = p.provider === "conta_azul";

            return (
              <div
                key={p.id}
                className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-2.5 border-t border-[var(--border)] items-center text-[13px] hover:bg-[var(--cream)] transition-colors"
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

                {/* M6 — nº da fatura Conta Azul (manual, por cobrança). */}
                <FaturaContaAzulCell
                  caseId={caseId}
                  parcelaId={p.id}
                  value={
                    (p as { contaazul_fatura_numero?: string | null }).contaazul_fatura_numero ??
                    null
                  }
                  canEdit={podeEditarFin}
                />

                <span className="flex items-center gap-1.5">
                  {/* Link da cobrança (ambos: Asaas e Conta Azul) */}
                  {p.boleto_url && isActive && (
                    <a
                      href={p.boleto_url}
                      target="_blank"
                      rel="noreferrer"
                      title="Ver fatura/cobrança"
                    >
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
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                        })
                      }
                      title="Cancelar cobrança"
                    >
                      <XCircle size={13} />
                    </Button>
                  )}

                  {/* Cancelar (Conta Azul) */}
                  {isCA && isActive && p.provider_ext_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-[var(--danger)]"
                      disabled={cancelCACharge.isPending}
                      onClick={() =>
                        cancelCACharge.mutate(p.id, {
                          onSuccess: () => toast.success("Cobrança cancelada no Conta Azul"),
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                        })
                      }
                      title="Cancelar cobrança Conta Azul"
                    >
                      <XCircle size={13} />
                    </Button>
                  )}
                </span>
              </div>
            );
          })}

          {/* Rodapé */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-2.5 border-t-2 border-[var(--navy)] bg-[var(--cream)]">
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

// ─── M6: Nº da fatura do Conta Azul por parcela (edição inline) ──────────────

function FaturaContaAzulCell({
  caseId,
  parcelaId,
  value,
  canEdit,
}: {
  caseId: string;
  parcelaId: string;
  value: string | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const setFatura = useSetParcelaContaAzulFatura(caseId);

  function save() {
    const next = draft.trim() ? draft.trim() : null;
    setFatura.mutate(
      { parcelaId, faturaNumero: next },
      {
        onSuccess: () => {
          toast.success(next ? "Nº da fatura salvo" : "Nº da fatura removido");
          setEditing(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
      },
    );
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <Input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Nº fatura CA"
          className="h-7 w-28 text-[12px]"
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-green-700"
          disabled={setFatura.isPending}
          onClick={save}
          title="Salvar"
        >
          {setFatura.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Check size={13} />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-muted-foreground"
          onClick={() => {
            setDraft(value ?? "");
            setEditing(false);
          }}
          title="Cancelar"
        >
          <X size={13} />
        </Button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[12px] min-w-0">
      {value ? (
        <span
          className="font-mono text-[var(--navy)] truncate"
          title={`Fatura Conta Azul: ${value}`}
        >
          {value}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
      {canEdit && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-muted-foreground shrink-0"
          onClick={() => {
            setDraft(value ?? "");
            setEditing(true);
          }}
          title={value ? "Editar nº da fatura" : "Adicionar nº da fatura"}
        >
          <Pencil size={12} />
        </Button>
      )}
    </span>
  );
}
