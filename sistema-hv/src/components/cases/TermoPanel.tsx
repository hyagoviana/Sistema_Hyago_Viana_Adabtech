import { ExternalLink, Loader2, Plus } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import {
  useAceitarTermo,
  useApresentarTermo,
  useAprovarTermo,
  useCalcTermo,
  useConferirTermo,
  useCreateTermo,
  useDarBaixaParcela,
  useEnviarConferencia,
  useEstornarParcela,
  useParcelas,
  useRecusarTermo,
  useTermos,
} from "@/hooks/useTermo";

function brl(c: number | null | undefined) {
  return "R$ " + ((c ?? 0) / 100).toFixed(2).replace(".", ",");
}
function toCents(v: string): number {
  const n = Number(
    String(v)
      .replace(/[^\d,.-]/g, "")
      .replace(".", "")
      .replace(",", "."),
  );
  return Math.round((isNaN(n) ? 0 : n) * 100);
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  EM_CONFERENCIA: { label: "Em conferência", cls: "bg-amber-100 text-amber-800" },
  APROVACAO_JURIDICA: { label: "Aprovação jurídica", cls: "bg-amber-100 text-amber-800" },
  APROVADO_JURIDICO: { label: "Aprovado", cls: "bg-green-600 text-white" },
  APRESENTADO: { label: "Apresentado", cls: "bg-[var(--navy)] text-white" },
  ACEITO: { label: "Aceito", cls: "bg-green-700 text-white" },
  RECUSADO: { label: "Recusado", cls: "bg-[var(--danger)] text-white" },
  SUBSTITUIDO: { label: "Substituído", cls: "bg-muted text-muted-foreground line-through" },
};

export function TermoPanel({ caseId }: { caseId: string }) {
  const { profile } = useAuth();
  const { data: termos } = useTermos(caseId);
  const enviar = useEnviarConferencia(caseId);
  const conferir = useConferirTermo(caseId);
  const aprovar = useAprovarTermo(caseId);
  const apresentar = useApresentarTermo(caseId);
  const aceitar = useAceitarTermo(caseId);
  const recusar = useRecusarTermo(caseId);
  const { data: parcelas } = useParcelas(caseId);
  const darBaixa = useDarBaixaParcela(caseId);
  const estornar = useEstornarParcela(caseId);
  const [open, setOpen] = useState(false);
  const [baixaFor, setBaixaFor] = useState<{ id: string; valor: number; numero: number } | null>(
    null,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Termo de Acerto
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus size={13} className="mr-1" /> Elaborar
        </Button>
      </div>

      {(termos ?? []).length === 0 ? (
        <div className="text-[13px] text-muted-foreground italic">Nenhum termo elaborado.</div>
      ) : (
        <ul className="space-y-2">
          {(termos ?? []).map((t) => {
            const meta = STATUS_META[t.status] ?? STATUS_META.RASCUNHO;
            return (
              <li key={t.id} className="border border-[var(--border)] rounded-md p-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-[var(--navy)]">
                    v{t.version} · {brl(t.valor_total_centavos)} em {t.qtd_parcelas}x
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.aprovacao_automatica && (
                      <Badge className="bg-[var(--gold-700)] text-white">Auto</Badge>
                    )}
                    <Badge className={meta.cls}>{meta.label}</Badge>
                  </div>
                </div>
                <div className="text-muted-foreground mt-1">
                  Efetivo {brl(t.valor_efetivo_centavos)} · {t.percentual_honorarios}% · parcela{" "}
                  {brl(t.valor_parcela_centavos)} · à vista {brl(t.valor_avista_centavos)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {t.status === "RASCUNHO" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={enviar.isPending}
                      onClick={() =>
                        enviar.mutate(t.id, {
                          onSuccess: () => toast.success("Enviado para conferência"),
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                        })
                      }
                    >
                      Enviar p/ conferência
                    </Button>
                  )}
                  {t.status === "EM_CONFERENCIA" && (
                    <Button
                      size="sm"
                      disabled={conferir.isPending || !profile}
                      onClick={() =>
                        conferir.mutate(
                          { termoId: t.id, conferidoPorId: profile!.id },
                          {
                            onSuccess: (res) =>
                              toast.success(
                                res?.auto
                                  ? "Conferido e auto-aprovado"
                                  : "Conferido — aguarda aprovação jurídica",
                              ),
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                          },
                        )
                      }
                    >
                      Conferir
                    </Button>
                  )}
                  {t.status === "APROVACAO_JURIDICA" && (
                    <Button
                      size="sm"
                      disabled={aprovar.isPending || !profile}
                      onClick={() =>
                        aprovar.mutate(
                          { termoId: t.id, aprovadoPorId: profile!.id },
                          {
                            onSuccess: () => toast.success("Termo aprovado"),
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                          },
                        )
                      }
                    >
                      Aprovar (jurídico)
                    </Button>
                  )}
                  {t.status === "APROVADO_JURIDICO" && (
                    <Button
                      size="sm"
                      disabled={apresentar.isPending}
                      onClick={() =>
                        apresentar.mutate(t.id, {
                          onSuccess: () => toast.success("Apresentado ao cliente"),
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                        })
                      }
                    >
                      Apresentar
                    </Button>
                  )}
                  {t.status === "APRESENTADO" && (
                    <Button
                      size="sm"
                      disabled={aceitar.isPending}
                      onClick={() =>
                        aceitar.mutate(t.id, {
                          onSuccess: (r) =>
                            toast.success(`Aceito — ${r?.parcelas ?? 0} parcela(s) gerada(s)`),
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                        })
                      }
                    >
                      Registrar aceite
                    </Button>
                  )}
                  {t.status === "APRESENTADO" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={recusar.isPending}
                      onClick={() =>
                        recusar.mutate(t.id, {
                          onSuccess: () => toast.success("Recusa registrada"),
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                        })
                      }
                    >
                      Registrar recusa
                    </Button>
                  )}
                  {t.drive_url && (
                    <a href={t.drive_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        <ExternalLink size={12} className="mr-1" /> PDF
                      </Button>
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(parcelas ?? []).length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Parcelas
          </div>
          <ul className="space-y-1 text-[13px]">
            {(parcelas ?? []).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border-b border-[var(--border)] pb-1"
              >
                <span>
                  {String(p.numero).padStart(2, "0")} · vence{" "}
                  {new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
                <span className="flex items-center gap-2">
                  {brl(p.valor_centavos)}
                  <Badge
                    className={
                      p.status === "PAGA"
                        ? "bg-green-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {p.status}
                  </Badge>
                  {p.status !== "PAGA" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setBaixaFor({ id: p.id, valor: p.valor_centavos, numero: p.numero })
                      }
                      className="text-[var(--gold-700)] hover:underline text-[11px]"
                    >
                      pagar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={estornar.isPending}
                      onClick={() =>
                        estornar.mutate(p.id, {
                          onSuccess: () => toast.success("Baixa estornada"),
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                        })
                      }
                      className="text-muted-foreground hover:underline text-[11px]"
                    >
                      estornar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BaixaParcelaDialog
        parcela={baixaFor}
        onOpenChange={(v) => !v && setBaixaFor(null)}
        onConfirm={(valorPagoCentavos, metodoPagamento) => {
          if (!baixaFor) return;
          darBaixa.mutate(
            { parcelaId: baixaFor.id, valorPagoCentavos, metodoPagamento },
            {
              onSuccess: () => {
                toast.success("Pagamento registrado");
                setBaixaFor(null);
              },
              onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
            },
          );
        }}
        pending={darBaixa.isPending}
      />

      <ElaborarDialog
        caseId={caseId}
        open={open}
        onOpenChange={setOpen}
        elaboradoPorId={profile?.id ?? null}
      />
    </div>
  );
}

function ElaborarDialog({
  caseId,
  open,
  onOpenChange,
  elaboradoPorId,
}: {
  caseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  elaboradoPorId: string | null;
}) {
  const calc = useCalcTermo();
  const create = useCreateTermo(caseId);
  const [antes, setAntes] = useState("");
  const [depois, setDepois] = useState("");
  const [pagas, setPagas] = useState("");
  const [tipo, setTipo] = useState<"PARCIAL" | "COMPLEMENTAR">("PARCIAL");
  const [forma, setForma] = useState<"PARCELADO" | "A_VISTA">("PARCELADO");
  const [preview, setPreview] = useState<{
    valor_total_centavos: number;
    qtd_parcelas: number;
    valor_parcela_centavos: number;
    valor_avista_centavos: number;
  } | null>(null);

  function doCalc() {
    calc.mutate(
      {
        saldoAntesCentavos: toCents(antes),
        saldoDepoisCentavos: toCents(depois),
        parcelasPagasCentavos: toCents(pagas),
      },
      {
        onSuccess: (r) => setPreview(r),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Elaborar Termo de Acerto</DialogTitle>
          <DialogDescription>
            Informe os saldos. O cálculo usa 15% / R$500 / 10% (padrão PRD).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Saldo antes (R$)</Label>
            <Input
              value={antes}
              onChange={(e) => setAntes(e.target.value)}
              placeholder="20000,00"
            />
          </div>
          <div>
            <Label>Saldo depois (R$)</Label>
            <Input value={depois} onChange={(e) => setDepois(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label>Parcelas pagas no processo (R$)</Label>
            <Input value={pagas} onChange={(e) => setPagas(e.target.value)} placeholder="0,00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <div className="mt-1 flex rounded-md border border-[var(--border)] overflow-hidden text-[12px]">
                {(["PARCIAL", "COMPLEMENTAR"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTipo(v)}
                    className={
                      tipo === v
                        ? "flex-1 px-2 py-1.5 bg-[var(--navy)] text-white"
                        : "flex-1 px-2 py-1.5 text-muted-foreground hover:bg-[var(--muted)]"
                    }
                  >
                    {v === "PARCIAL" ? "Parcial" : "Complementar"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Forma</Label>
              <div className="mt-1 flex rounded-md border border-[var(--border)] overflow-hidden text-[12px]">
                {(["PARCELADO", "A_VISTA"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setForma(v)}
                    className={
                      forma === v
                        ? "flex-1 px-2 py-1.5 bg-[var(--navy)] text-white"
                        : "flex-1 px-2 py-1.5 text-muted-foreground hover:bg-[var(--muted)]"
                    }
                  >
                    {v === "PARCELADO" ? "Parcelado" : "À vista"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={doCalc} disabled={calc.isPending}>
            {calc.isPending ? <Loader2 size={13} className="mr-1 animate-spin" /> : null}
            Calcular
          </Button>
          {preview && (
            <div className="rounded-md bg-[var(--muted)] p-3 text-[13px]">
              <div className="font-medium text-[var(--navy)]">
                Honorários: {brl(preview.valor_total_centavos)}
              </div>
              <div className="text-muted-foreground">
                {preview.qtd_parcelas}x de {brl(preview.valor_parcela_centavos)} · à vista{" "}
                {brl(preview.valor_avista_centavos)}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={create.isPending || !preview}
            onClick={() =>
              create.mutate(
                {
                  caseId,
                  saldoAntesCentavos: toCents(antes),
                  saldoDepoisCentavos: toCents(depois),
                  parcelasPagasCentavos: toCents(pagas),
                  tipoTermo: tipo,
                  formaPagamento: forma,
                  elaboradoPorId,
                },
                {
                  onSuccess: () => {
                    toast.success("Termo elaborado (rascunho v1)");
                    onOpenChange(false);
                  },
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                },
              )
            }
          >
            Salvar termo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BaixaParcelaDialog({
  parcela,
  onOpenChange,
  onConfirm,
  pending,
}: {
  parcela: { id: string; valor: number; numero: number } | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (valorPagoCentavos: number, metodoPagamento: string | null) => void;
  pending: boolean;
}) {
  const [valor, setValor] = useState("");
  const [metodo, setMetodo] = useState("");

  useEffect(() => {
    if (parcela) {
      setValor(((parcela.valor ?? 0) / 100).toFixed(2).replace(".", ","));
      setMetodo("");
    }
  }, [parcela]);

  return (
    <Dialog open={!!parcela} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Registrar pagamento
            {parcela ? ` — parcela ${String(parcela.numero).padStart(2, "0")}` : ""}
          </DialogTitle>
          <DialogDescription>
            Baixa manual da parcela (substitui a cobrança automática até a integração via n8n).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Valor pago (R$)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="500,00" />
          </div>
          <div>
            <Label>Método (opcional)</Label>
            <Input
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              placeholder="PIX, boleto, transferência…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() => onConfirm(toCents(valor), metodo.trim() || null)}
          >
            {pending ? <Loader2 size={13} className="mr-1 animate-spin" /> : null}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
