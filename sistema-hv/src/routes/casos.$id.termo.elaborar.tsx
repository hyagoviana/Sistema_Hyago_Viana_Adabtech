// S6-03 — Tela "Elaborar termo" (form real + prévia via calcularTermo + snapshot
// RASCUNHO). Substitui o StubPage. O cálculo é AUTORITATIVO no servidor
// (useCalcTermo); o front só exibe. O `remanescente anterior` (só COMPLEMENTAR)
// é input de tela (opção A da story): não altera o cálculo/snapshot, entra como
// placeholder do documento na S6-04. S6-04 acopla o botão "Gerar documento".

import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Breadcrumb, Eyebrow } from "@/components/hv/primitives";
import { GerarDocumentoTermoButton } from "@/components/cases/GerarDocumentoTermoButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCase } from "@/hooks/useCases";
import { useCalcTermo, useCreateTermo, useTermos } from "@/hooks/useTermo";
import { useAuth } from "@/lib/auth";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";
import { setRouteTitle, usePublishRouteTitle } from "@/lib/route-title";

export const Route = createFileRoute("/casos/$id/termo/elaborar")({
  component: ElaborarTermo,
});

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

// Defaults do PRD (espelham TERMO_DEFAULTS do termo-service; editáveis no form).
const DEFAULT_PERCENTUAL = "15";
const DEFAULT_PARCELA = "500,00";
const DEFAULT_DESCONTO = "10";

type CalcResult = {
  valor_efetivo_centavos: number;
  valor_total_centavos: number;
  qtd_parcelas: number;
  valor_parcela_centavos: number;
  valor_ultima_parcela_centavos: number;
  valor_avista_centavos: number;
  percentual_honorarios: number;
  desconto_avista_pct: number;
};

function ElaborarTermo() {
  const { id } = useParams({ from: "/casos/$id/termo/elaborar" });
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: caso, isLoading, isError } = useCase(id);
  const { data: termos } = useTermos(id);

  const calc = useCalcTermo();
  const create = useCreateTermo(id);

  const [tipo, setTipo] = useState<"PARCIAL" | "COMPLEMENTAR">("PARCIAL");
  const [antes, setAntes] = useState("");
  const [depois, setDepois] = useState("0,00");
  const [pagas, setPagas] = useState("0,00");
  const [percentual, setPercentual] = useState(DEFAULT_PERCENTUAL);
  const [parcela, setParcela] = useState(DEFAULT_PARCELA);
  const [desconto, setDesconto] = useState(DEFAULT_DESCONTO);
  const [remanescente, setRemanescente] = useState("");
  const [preview, setPreview] = useState<CalcResult | null>(null);

  // S4-06 — nome do caso no breadcrumb e título, nunca UUID.
  const casoLabel = resolveEntityLabel(caso?.case_code, {
    loading: isLoading,
    notFound: isError,
    notFoundLabel: "Caso não encontrado",
  });
  useDocumentTitle(`${casoLabel} · Elaborar termo`);

  usePublishRouteTitle("Elaborar");
  useEffect(() => {
    setRouteTitle(`/casos/${id}`, casoLabel);
    setRouteTitle(`/casos/${id}/termo`, "Termo");
    return () => {
      setRouteTitle(`/casos/${id}`, null);
      setRouteTitle(`/casos/${id}/termo`, null);
    };
  }, [id, casoLabel]);

  // Snapshot RASCUNHO vigente (para a S6-04 gerar o documento). listTermos
  // ordena version desc, então [0] é o vigente.
  const vigente = (termos ?? [])[0] as
    | { id: string; status: string; tipo_termo: string }
    | undefined;
  const rascunhoVigente = vigente?.status === "RASCUNHO" ? vigente : undefined;

  // Payload de cálculo (memo para o efeito de prévia debounced).
  const calcInput = useMemo(
    () => ({
      saldoAntesCentavos: toCents(antes),
      saldoDepoisCentavos: toCents(depois),
      parcelasPagasCentavos: toCents(pagas),
      percentual: Number(percentual) || undefined,
      valorParcelaCentavos: toCents(parcela) || undefined,
      descontoAvistaPct: Number(desconto),
    }),
    [antes, depois, pagas, percentual, parcela, desconto],
  );

  const calcMutate = calc.mutate;
  // Prévia ao vivo (debounced) — servidor autoritativo, sem recalcular no front.
  useEffect(() => {
    if (calcInput.saldoAntesCentavos <= 0) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      calcMutate(calcInput, {
        onSuccess: (r) => setPreview(r as CalcResult),
        onError: () => setPreview(null),
      });
    }, 350);
    return () => clearTimeout(t);
  }, [calcInput, calcMutate]);

  function salvarRascunho() {
    create.mutate(
      {
        caseId: id,
        saldoAntesCentavos: calcInput.saldoAntesCentavos,
        saldoDepoisCentavos: calcInput.saldoDepoisCentavos,
        parcelasPagasCentavos: calcInput.parcelasPagasCentavos,
        percentual: calcInput.percentual,
        valorParcelaCentavos: calcInput.valorParcelaCentavos,
        descontoAvistaPct: calcInput.descontoAvistaPct,
        tipoTermo: tipo,
        formaPagamento: "PARCELADO",
        elaboradoPorId: profile?.id ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Rascunho do termo criado");
          navigate({ to: "/casos/$id/termo", params: { id } });
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar rascunho"),
      },
    );
  }

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Casos", to: "/casos" },
          { label: casoLabel, to: `/casos/${id}` },
          { label: "Termo", to: `/casos/${id}/termo` },
          { label: "Elaborar" },
        ]}
      />
      <header className="mb-6">
        <Eyebrow>Caso · {casoLabel} · Termo</Eyebrow>
        <h1 className="font-display text-[32px] font-bold text-[var(--navy)] mt-1">
          Elaborar Termo de Acerto
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informe os saldos e confira a prévia dos valores antes de gerar o rascunho. Padrões: 15%
          de honorários, parcela de R$500 e 10% de desconto à vista (editáveis).
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ─── Form ─────────────────────────────────────────────── */}
        <div className="card-hero p-6 space-y-4">
          <div>
            <Label>Tipo de termo</Label>
            <div className="mt-1 flex rounded-md border border-[var(--border)] overflow-hidden text-[13px] max-w-xs">
              {(["PARCIAL", "COMPLEMENTAR"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTipo(v)}
                  className={
                    tipo === v
                      ? "flex-1 px-3 py-2 bg-[var(--navy)] text-white"
                      : "flex-1 px-3 py-2 text-muted-foreground hover:bg-[var(--muted)]"
                  }
                >
                  {v === "PARCIAL" ? "Parcial" : "Complementar"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
              <Input
                value={depois}
                onChange={(e) => setDepois(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Parcelas pagas no processo (R$)</Label>
              <Input value={pagas} onChange={(e) => setPagas(e.target.value)} placeholder="0,00" />
            </div>
            {tipo === "COMPLEMENTAR" && (
              <div>
                <Label>Remanescente anterior (R$)</Label>
                <Input
                  value={remanescente}
                  onChange={(e) => setRemanescente(e.target.value)}
                  placeholder="0,00"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Informado manualmente — usado no documento (não altera o cálculo do snapshot).
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3 pt-2 border-t border-[var(--border)]">
            <div>
              <Label>% honorários</Label>
              <Input
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
                placeholder="15"
              />
            </div>
            <div>
              <Label>Valor da parcela (R$)</Label>
              <Input
                value={parcela}
                onChange={(e) => setParcela(e.target.value)}
                placeholder="500,00"
              />
            </div>
            <div>
              <Label>% desconto à vista</Label>
              <Input
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                placeholder="10"
              />
            </div>
          </div>
        </div>

        {/* ─── Prévia + ações ───────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card-hero p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-[var(--gold-700)]" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Prévia dos valores
              </span>
              {calc.isPending && (
                <Loader2 size={13} className="animate-spin text-muted-foreground" />
              )}
            </div>

            {!preview ? (
              <p className="text-[13px] text-muted-foreground">
                Informe o saldo antes para calcular.
              </p>
            ) : (
              <dl className="space-y-3 text-[13px]">
                <Row
                  label="Valor efetivo do abatimento"
                  value={brl(preview.valor_efetivo_centavos)}
                />
                <Row
                  label={`Honorários (${preview.percentual_honorarios}%)`}
                  value={brl(preview.valor_total_centavos)}
                  strong
                />
                <div className="border-t border-[var(--border)] pt-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    Parcelado
                  </div>
                  <Row
                    label={`${preview.qtd_parcelas}× parcela`}
                    value={brl(preview.valor_parcela_centavos)}
                  />
                  <Row label="Última parcela" value={brl(preview.valor_ultima_parcela_centavos)} />
                </div>
                <div className="border-t border-[var(--border)] pt-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    À vista ({preview.desconto_avista_pct}% desc.)
                  </div>
                  <Row label="Valor à vista" value={brl(preview.valor_avista_centavos)} strong />
                </div>
              </dl>
            )}

            <Button
              className="w-full mt-4"
              disabled={create.isPending || !preview}
              onClick={salvarRascunho}
            >
              {create.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
              Gerar termo (rascunho)
            </Button>
          </div>

          {/* S6-04 — gerar o documento editável a partir do rascunho vigente. */}
          {rascunhoVigente && (
            <div className="card-hero p-6">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Documento do termo
              </div>
              <p className="text-[13px] text-muted-foreground mb-3">
                Rascunho salvo ({rascunhoVigente.tipo_termo}). Gere o documento editável no Google
                Docs com as duas formas de pagamento.
              </p>
              <GerarDocumentoTermoButton
                caseId={id}
                termoId={rascunhoVigente.id}
                remanescenteAnteriorCentavos={
                  rascunhoVigente.tipo_termo === "COMPLEMENTAR" ? toCents(remanescente) : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-semibold text-[var(--navy)]" : "text-[var(--navy)]"}>
        {value}
      </dd>
    </div>
  );
}
