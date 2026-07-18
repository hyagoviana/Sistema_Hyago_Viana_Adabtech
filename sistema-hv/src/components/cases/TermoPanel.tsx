import { Copy, ExternalLink, Loader2, Plus, QrCode, Receipt, Trash2 } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { maskBrlReais, maskPercentBr, normalizeBrl, normalizePercentBr } from "@/lib/format";
import { usePixQrCode, useCancelCharge } from "@/hooks/useAsaas";
import { useCreateContaAzulCharge } from "@/hooks/useContaAzul";
import {
  useAceitarTermo,
  useApresentarTermo,
  useAprovarTermo,
  useCalcTermo,
  useCaseHonorarios,
  useConferirTermo,
  useCreateTermo,
  useDarBaixaParcela,
  useDeleteAllParcelas,
  useDeleteParcela,
  useDeleteTermo,
  useEnviarConferencia,
  useEstornarParcela,
  useGerarDocumentoTermo,
  useParcelas,
  useRecusarTermo,
  useTermos,
} from "@/hooks/useTermo";

// Garante a barra de ferramentas completa do Google Docs dentro do iframe.
function toEmbedUrl(url: string): string {
  if (url.includes("rm=embedded")) return url;
  return url.includes("?") ? `${url}&rm=embedded` : `${url}?rm=embedded`;
}

function brl(c: number | null | undefined) {
  return "R$ " + ((c ?? 0) / 100).toFixed(2).replace(".", ",");
}
function toCents(v: string): number {
  // Remove tudo que não é dígito/vírgula/ponto/sinal, tira TODOS os separadores
  // de milhar (".") e troca a vírgula decimal por ".". Precisa remover todos os
  // pontos (não só o 1º) porque a máscara BRL insere milhar (ex.: "1.234.567,00").
  const n = Number(
    String(v)
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Math.round((isNaN(n) ? 0 : n) * 100);
}

// Fallback client-side dos TERMO_DEFAULTS (termo-service.ts é server-only por
// causa do node:crypto; não dá para importar num componente client). Espelha
// { percentual_honorarios: 15, valor_parcela_centavos: 50000, desconto_avista_pct: 10 }.
// O cálculo autoritativo continua no servidor com os MESMOS defaults — aqui é só
// para semear os campos quando o caso não tem honorários registrados.
const TERMO_DEFAULTS_UI = {
  percentual_honorarios: 15, // %
  valor_parcela_centavos: 50000, // R$ 500,00
  desconto_avista_pct: 10, // %
};

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
  const del = useDeleteTermo(caseId);
  const delParcela = useDeleteParcela(caseId);
  const delAllParcelas = useDeleteAllParcelas(caseId);
  const { data: parcelas } = useParcelas(caseId);
  const darBaixa = useDarBaixaParcela(caseId);
  const estornar = useEstornarParcela(caseId);
  const [open, setOpen] = useState(false);
  const [baixaFor, setBaixaFor] = useState<{ id: string; valor: number; numero: number } | null>(
    null,
  );
  // Asaas — cobrança e Pix
  const [cobrancaFor, setCobrancaFor] = useState<{
    id: string;
    valor: number;
    numero: number;
    vencimento: string;
  } | null>(null);
  const [pixFor, setPixFor] = useState<string | null>(null);

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
        <div className="text-[13px] text-muted-foreground">Nenhum termo elaborado.</div>
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
                  {t.status === "RASCUNHO" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={del.isPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Excluir este rascunho de termo? Apaga o documento no Drive e some também da aba Documentos.",
                          )
                        )
                          return;
                        del.mutate(t.id, {
                          onSuccess: () => toast.success("Rascunho de termo excluído"),
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                        });
                      }}
                    >
                      <Trash2 size={13} className="mr-1" /> Excluir
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
                  {/* Aprovar direto (2026-07-08) — o termo NÃO vai ao ZapSign; é
                      enviado ao cliente por e-mail/baixado. Este botão aprova em 1
                      clique (gera o PDF), sem depender da conferência por 2ª pessoa. */}
                  {(t.status === "RASCUNHO" || t.status === "EM_CONFERENCIA") && (
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
                      Aprovar
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
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Parcelas
            </div>
            <button
              type="button"
              disabled={delAllParcelas.isPending}
              onClick={() => {
                if (!window.confirm("Excluir TODAS as parcelas deste caso?")) return;
                delAllParcelas.mutate(undefined, {
                  onSuccess: (r) => toast.success(`${r.count} parcela(s) excluída(s)`),
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                });
              }}
              className="text-[11px] text-destructive hover:underline disabled:opacity-40"
            >
              Excluir todas
            </button>
          </div>
          <ul className="space-y-1 text-[13px]">
            {(parcelas ?? []).map((p) => {
              const isAsaas = p.provider === "asaas" && !!p.provider_ext_id;
              const statusBadgeCls =
                p.status === "PAGA"
                  ? "bg-green-600 text-white"
                  : p.status === "VENCIDA"
                    ? "bg-[var(--danger)] text-white"
                    : "bg-muted text-muted-foreground";

              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between border-b border-[var(--border)] pb-1.5 pt-1"
                >
                  <span>
                    {String(p.numero).padStart(2, "0")} · vence{" "}
                    {new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                  <span className="flex items-center gap-2">
                    {brl(p.valor_centavos)}
                    <Badge className={statusBadgeCls}>{p.status}</Badge>

                    {/* Asaas: link boleto/fatura */}
                    {isAsaas && p.boleto_url && p.status !== "PAGA" && (
                      <a
                        href={p.boleto_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Ver fatura / boleto"
                      >
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">
                          <ExternalLink size={11} className="mr-1" /> Fatura
                        </Button>
                      </a>
                    )}

                    {/* Asaas: gerar Pix QR Code */}
                    {isAsaas && p.status !== "PAGA" && p.status !== "CANCELADA" && (
                      <button
                        type="button"
                        onClick={() => setPixFor(p.id)}
                        className="text-[var(--navy)] hover:underline text-[11px] inline-flex items-center gap-0.5"
                        title="Gerar QR Code Pix"
                      >
                        <QrCode size={11} /> Pix
                      </button>
                    )}

                    {/* Asaas badge */}
                    {isAsaas && (
                      <Badge className="bg-blue-100 text-blue-800 text-[10px]">Asaas</Badge>
                    )}

                    {/* Cobrar via Asaas (parcela sem provider vinculado) */}
                    {!isAsaas && p.status !== "PAGA" && p.status !== "CANCELADA" && (
                      <button
                        type="button"
                        onClick={() =>
                          setCobrancaFor({
                            id: p.id,
                            valor: p.valor_centavos,
                            numero: p.numero,
                            vencimento: p.vencimento,
                          })
                        }
                        className="text-blue-600 hover:underline text-[11px] inline-flex items-center gap-0.5"
                        title="Gerar cobrança no Conta Azul"
                      >
                        <Receipt size={11} /> cobrar
                      </button>
                    )}

                    {/* Baixa manual */}
                    {p.status !== "PAGA" && p.status !== "CANCELADA" && (
                      <button
                        type="button"
                        onClick={() =>
                          setBaixaFor({ id: p.id, valor: p.valor_centavos, numero: p.numero })
                        }
                        className="text-[var(--gold-700)] hover:underline text-[11px]"
                      >
                        pagar
                      </button>
                    )}

                    {/* Estorno */}
                    {p.status === "PAGA" && (
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

                    {/* Excluir parcela (item 5) */}
                    <button
                      type="button"
                      disabled={delParcela.isPending}
                      onClick={() => {
                        if (
                          !window.confirm(`Excluir a parcela ${String(p.numero).padStart(2, "0")}?`)
                        )
                          return;
                        delParcela.mutate(p.id, {
                          onSuccess: () => toast.success("Parcela excluída"),
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
                        });
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      title="Excluir parcela"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </li>
              );
            })}
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

      <CobrancaAsaasDialog
        caseId={caseId}
        parcela={cobrancaFor}
        onOpenChange={(v) => !v && setCobrancaFor(null)}
      />

      <PixQrCodeDialog parcelaId={pixFor} onOpenChange={(v) => !v && setPixFor(null)} />

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
  const gerarDoc = useGerarDocumentoTermo(caseId);
  // R5-07 (A3) — honorários do caso (persistidos da procuração em
  // system_case_honorarios). Usados para pré-preencher % e valor da parcela.
  const { data: honorarios } = useCaseHonorarios(caseId);
  const [antes, setAntes] = useState("");
  const [depois, setDepois] = useState("");
  const [pagas, setPagas] = useState("");
  const [tipo, setTipo] = useState<"PARCIAL" | "COMPLEMENTAR">("PARCIAL");
  const [forma, setForma] = useState<"PARCELADO" | "A_VISTA">("PARCELADO");
  // R5-07 (A3) — % de honorários editável (antes fixo 15%). Pré-preenchido do
  // caso; fallback TERMO_DEFAULTS. Máscara percentual BR (vírgula decimal).
  const [percentual, setPercentual] = useState("");
  // R5-07 (A3) — valor da parcela editável (antes fixo R$500). Pré-preenchido do
  // caso; fallback TERMO_DEFAULTS. Máscara monetária BRL (em reais → centavos).
  const [valorParcela, setValorParcela] = useState("");
  // #17 — desconto à vista (%), editável só quando Forma = À vista. Default 10%.
  const [descontoAvista, setDescontoAvista] = useState("10");
  // Campos FIES (texto livre) que fluem para o documento do termo.
  const [taxaJuros, setTaxaJuros] = useState("");
  const [percentualFinanciado, setPercentualFinanciado] = useState("");
  // Word editável do termo gerado (aberto num Dialog aninhado).
  const [docUrl, setDocUrl] = useState<string | null>(null);
  // Último editUrl gerado nesta sessão — persiste mesmo com o dialog do Word
  // fechado, para permitir reabrir sem regerar quando os inputs não mudaram.
  const [ultimoDocUrl, setUltimoDocUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    valor_total_centavos: number;
    qtd_parcelas: number;
    valor_parcela_centavos: number;
    valor_avista_centavos: number;
  } | null>(null);
  // Snapshot RASCUNHO criado nesta sessão do modal (id do termo). Reaproveitado
  // entre recliques em "Calcular e revisar" enquanto os inputs não mudarem, para
  // não acumular snapshots/documentos duplicados no Drive.
  const [termoId, setTermoId] = useState<string | null>(null);
  // Assinatura dos inputs que geraram o snapshot atual. Se o usuário reclicar
  // "Calcular e revisar" com os MESMOS valores só reabrimos o Word já gerado;
  // se mudou algo, aí sim geramos um novo snapshot/documento (valores diferentes
  // exigem doc novo). Assim há no máximo 1 doc por conjunto distinto de inputs.
  const [sigGerada, setSigGerada] = useState<string | null>(null);

  // Desconto em fração (0..1) só quando à vista; senão undefined (usa o padrão do servidor).
  const descontoAvistaPct =
    forma === "A_VISTA"
      ? Math.max(0, Number(descontoAvista.replace(",", ".")) || 0) / 100
      : undefined;

  // R5-07 (A3) — % de honorários editável (percentual inteiro, ex.: 15). Vazio →
  // undefined → o servidor cai em TERMO_DEFAULTS. Nunca envia valor negativo.
  const percentualNum = (() => {
    const v = percentual.trim();
    if (v === "") return undefined;
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  })();
  // R5-07 (A3) — valor da parcela editável (em centavos). Vazio/zero → undefined →
  // o servidor cai em TERMO_DEFAULTS (R$ 500).
  const valorParcelaCentavos = (() => {
    const c = toCents(valorParcela);
    return c > 0 ? c : undefined;
  })();

  // Reseta o estado da sessão sempre que o modal abre (evita reaproveitar um
  // termo de uma abertura anterior).
  useEffect(() => {
    if (open) {
      setTermoId(null);
      setSigGerada(null);
      setDocUrl(null);
      setUltimoDocUrl(null);
      setPreview(null);
    }
  }, [open]);

  // R5-07 (A3) — pré-preenche % e valor da parcela ao abrir: usa os honorários do
  // caso quando existem (system_case_honorarios); senão cai em TERMO_DEFAULTS.
  // Depende de `honorarios` porque o hook pode resolver depois do modal abrir.
  useEffect(() => {
    if (!open) return;
    const pct = honorarios?.percentual_honorarios ?? TERMO_DEFAULTS_UI.percentual_honorarios;
    const parcelaCentavos =
      honorarios?.valor_parcela_centavos ?? TERMO_DEFAULTS_UI.valor_parcela_centavos;
    setPercentual(normalizePercentBr(String(pct).replace(".", ",")));
    setValorParcela(normalizeBrl((parcelaCentavos / 100).toFixed(2).replace(".", ",")));
    // Desconto à vista também pré-preenche do caso (fallback TERMO_DEFAULTS).
    const desc = honorarios?.desconto_avista_pct ?? TERMO_DEFAULTS_UI.desconto_avista_pct;
    setDescontoAvista(String(desc).replace(".", ","));
  }, [open, honorarios]);

  // Assinatura dos parâmetros que afetam o cálculo/documento.
  function calcSignature() {
    return JSON.stringify({
      antes: toCents(antes),
      depois: toCents(depois),
      pagas: toCents(pagas),
      tipo,
      forma,
      percentual: percentualNum ?? null,
      valorParcelaCentavos: valorParcelaCentavos ?? null,
      descontoAvistaPct: descontoAvistaPct ?? null,
      taxaJuros: taxaJuros.trim(),
      percentualFinanciado: percentualFinanciado.trim(),
    });
  }

  const busy = calc.isPending || create.isPending || gerarDoc.isPending;

  // "Calcular e revisar": calcula (preview) → cria snapshot RASCUNHO → gera o
  // documento → abre o Word. Recliques com os mesmos inputs apenas reabrem o Word.
  function doCalcularERevisar() {
    const sig = calcSignature();
    // Mesmos inputs de um doc já gerado nesta sessão → só reabre o Word já
    // gerado (não cria snapshot nem documento novo).
    if (sig === sigGerada && ultimoDocUrl) {
      setDocUrl(ultimoDocUrl);
      toast.success("Reabrindo documento já gerado");
      return;
    }

    calc.mutate(
      {
        saldoAntesCentavos: toCents(antes),
        saldoDepoisCentavos: toCents(depois),
        parcelasPagasCentavos: toCents(pagas),
        // R5-07 (A3) — % e valor da parcela editáveis (undefined → default no servidor).
        percentual: percentualNum,
        valorParcelaCentavos,
        descontoAvistaPct,
      },
      {
        onSuccess: (r) => {
          setPreview(r);
          // Cria o snapshot RASCUNHO e, na sequência, gera o documento e abre o Word.
          create.mutate(
            {
              caseId,
              saldoAntesCentavos: toCents(antes),
              saldoDepoisCentavos: toCents(depois),
              parcelasPagasCentavos: toCents(pagas),
              tipoTermo: tipo,
              formaPagamento: forma,
              // R5-07 (A3) — % e valor da parcela editáveis persistem no snapshot.
              percentual: percentualNum,
              valorParcelaCentavos,
              descontoAvistaPct,
              elaboradoPorId,
            },
            {
              onSuccess: (termo) => {
                setTermoId(termo.id);
                gerarDoc.mutate(
                  {
                    termoId: termo.id,
                    taxaJuros: taxaJuros.trim() || undefined,
                    percentualFinanciado: percentualFinanciado.trim() || undefined,
                  },
                  {
                    onSuccess: (res) => {
                      if (res.editUrl) {
                        setDocUrl(res.editUrl);
                        setUltimoDocUrl(res.editUrl);
                        setSigGerada(sig);
                        toast.success("Documento gerado — abrindo para revisão");
                      } else {
                        toast.error("Documento não retornou link editável");
                      }
                    },
                    onError: (e) =>
                      toast.error(
                        e instanceof Error
                          ? `Termo salvo, mas o documento não foi gerado: ${e.message}`
                          : "Termo salvo, mas o documento não foi gerado (modelo não cadastrado).",
                      ),
                  },
                );
              },
              onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar termo"),
            },
          );
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
      },
    );
  }

  // "Salvar termo": o snapshot RASCUNHO já foi criado em "Calcular e revisar" e as
  // edições do Word já persistem no Google Docs. Aqui só confirmamos e fechamos.
  function doSalvarTermo() {
    toast.success("Termo salvo (rascunho) — aguardando aprovação");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Elaborar Termo de Acerto</DialogTitle>
          <DialogDescription>
            Informe os saldos e clique em “Calcular e revisar” para gerar o documento e abrir o
            Word. O percentual de honorários e o valor da parcela vêm pré-preenchidos do caso e
            podem ser editados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Saldo antes (R$)</Label>
            <Input
              value={antes}
              onChange={(e) => setAntes(maskBrlReais(e.target.value))}
              onBlur={() => setAntes((v) => normalizeBrl(v))}
              inputMode="decimal"
              placeholder="20.000,00"
            />
          </div>
          <div>
            <Label>Saldo depois (R$)</Label>
            <Input
              value={depois}
              onChange={(e) => setDepois(maskBrlReais(e.target.value))}
              onBlur={() => setDepois((v) => normalizeBrl(v))}
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>
          <div>
            <Label>Parcelas pagas no processo (R$)</Label>
            <Input
              value={pagas}
              onChange={(e) => setPagas(maskBrlReais(e.target.value))}
              onBlur={() => setPagas((v) => normalizeBrl(v))}
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>
          {/* R5-07 (A3) — % de honorários e valor da parcela editáveis, pré-preenchidos
              do caso (system_case_honorarios) com fallback TERMO_DEFAULTS (15% / R$500). */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Honorários (%)</Label>
              <Input
                value={percentual}
                onChange={(e) => setPercentual(maskPercentBr(e.target.value))}
                onBlur={() => setPercentual((v) => normalizePercentBr(v))}
                inputMode="decimal"
                placeholder="15"
              />
            </div>
            <div>
              <Label>Valor da parcela (R$)</Label>
              <Input
                value={valorParcela}
                onChange={(e) => setValorParcela(maskBrlReais(e.target.value))}
                onBlur={() => setValorParcela((v) => normalizeBrl(v))}
                inputMode="decimal"
                placeholder="500,00"
              />
            </div>
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
          {/* #17 — desconto à vista só aparece quando Forma = À vista */}
          {forma === "A_VISTA" && (
            <div>
              <Label>Desconto à vista (%)</Label>
              <Input
                value={descontoAvista}
                onChange={(e) => setDescontoAvista(e.target.value)}
                placeholder="10"
                inputMode="decimal"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Taxa de juros (%)</Label>
              <Input
                value={taxaJuros}
                onChange={(e) => setTaxaJuros(e.target.value)}
                placeholder="0,28"
                inputMode="decimal"
              />
            </div>
            <div>
              <Label>% Financiado</Label>
              <Input
                value={percentualFinanciado}
                onChange={(e) => setPercentualFinanciado(maskPercentBr(e.target.value))}
                onBlur={() => setPercentualFinanciado((v) => normalizePercentBr(v))}
                placeholder="100,00"
                inputMode="decimal"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={doCalcularERevisar} disabled={busy}>
            {busy ? <Loader2 size={13} className="mr-1 animate-spin" /> : null}
            Calcular e revisar
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          {/* "Salvar termo" só habilita depois de o documento ter sido gerado
              (snapshot RASCUNHO já existe). Aqui apenas conclui e fecha. */}
          <Button disabled={busy || !termoId} onClick={doSalvarTermo}>
            Salvar termo
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* #17 — Word editável do termo (Google Docs) aberto após "Calcular e revisar".
          Fechar aqui NÃO conclui: as edições já persistem no Google Docs e o termo
          segue RASCUNHO/reabrível; concluir é o botão "Salvar termo". */}
      <Dialog
        open={!!docUrl}
        onOpenChange={(v) => {
          if (!v) {
            setDocUrl(null);
            toast.success("Documento salvo — clique em Salvar termo para concluir.");
          }
        }}
      >
        <DialogContent className="max-w-6xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Termo de acerto — revisão</DialogTitle>
            <DialogDescription>
              O termo com as duas formas de pagamento (à vista e parcelado) em formato Word (Google
              Docs). Edite o que precisar antes de aprovar/imprimir.
            </DialogDescription>
          </DialogHeader>
          {docUrl && (
            <>
              <div className="flex items-center justify-end mb-2">
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--gold-700)] hover:underline text-sm inline-flex items-center gap-1"
                >
                  <ExternalLink size={13} /> Abrir em nova aba (tela cheia)
                </a>
              </div>
              <iframe
                src={toEmbedUrl(docUrl)}
                title="Termo de acerto"
                className="w-full rounded-md border border-[var(--border)]"
                style={{ height: "70vh" }}
                allow="clipboard-read; clipboard-write"
              />
            </>
          )}
          <DialogFooter>
            {/* Fechar apenas zera docUrl; o toast "Documento salvo…" é disparado
                pelo onOpenChange do Dialog (cobre Fechar, Esc e clique fora). */}
            <Button variant="outline" onClick={() => setDocUrl(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ─── Dialog: Gerar Cobrança no Conta Azul ────────────────────────────────────

// Métodos de pagamento do Conta Azul (evento financeiro de contas a receber).
const BILLING_LABELS: Record<string, string> = {
  PIX: "Pix",
  BOLETO_BANCARIO: "Boleto bancário",
  CARTAO_CREDITO: "Cartão de crédito",
  TRANSFERENCIA_BANCARIA: "Transferência",
  DINHEIRO: "Dinheiro",
  OUTRO: "Outro",
};

function CobrancaAsaasDialog({
  caseId,
  parcela,
  onOpenChange,
}: {
  caseId: string;
  parcela: { id: string; valor: number; numero: number; vencimento: string } | null;
  onOpenChange: (v: boolean) => void;
}) {
  const createCharge = useCreateContaAzulCharge();
  // Vem pré-selecionado (Pix) e editável — o owner só troca se quiser.
  const [billingType, setBillingType] = useState<string>("PIX");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (parcela) {
      setBillingType("PIX");
      setDescricao("");
    }
  }, [parcela]);

  function handleConfirm() {
    if (!parcela) return;
    createCharge.mutate(
      {
        caseId,
        paymentMethod: billingType,
        value: parcela.valor / 100,
        dueDate: parcela.vencimento,
        description: descricao.trim() || undefined,
        installmentCount: 1,
      },
      {
        onSuccess: () => {
          toast.success("Cobrança criada no Conta Azul — o cliente recebe por e-mail");
          onOpenChange(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar cobrança"),
      },
    );
  }

  return (
    <Dialog open={!!parcela} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Gerar cobrança
            {parcela ? ` — parcela ${String(parcela.numero).padStart(2, "0")}` : ""}
          </DialogTitle>
          <DialogDescription>
            A cobrança é criada no Conta Azul e o cliente recebe por e-mail, com link de pagamento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-[var(--muted)] p-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-medium text-[var(--navy)]">{brl(parcela?.valor ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-muted-foreground">Vencimento</span>
              <span className="font-medium">
                {parcela
                  ? new Date(parcela.vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                  : "—"}
              </span>
            </div>
          </div>

          <div>
            <Label>Forma de pagamento</Label>
            <Select value={billingType} onValueChange={setBillingType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BILLING_LABELS).map(([value, label]) => (
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
              placeholder="Ex: Honorários advocatícios - parcela 01"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createCharge.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={createCharge.isPending}>
            {createCharge.isPending ? (
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

// ─── Dialog: Pix QR Code ─────────────────────────────────────────────────────

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
              Erro ao gerar QR Code. Verifique se a cobrança está ativa no Asaas.
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
          {pix?.expirationDate && (
            <div className="text-[11px] text-muted-foreground">
              Expira em{" "}
              {new Date(pix.expirationDate).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
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

// ─── Dialog: Baixa Manual ────────────────────────────────────────────────────

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
