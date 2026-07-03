// S3-04 — Preview do termo em modo LEITURA (substitui o StubPage).
// Lê o snapshot vigente do caso via useTermos (system_termo_snapshots_active) e
// exibe os campos (valores em centavos formatados, status, parcelas, forma de
// pagamento) + link do PDF (drive_url) quando houver. SEM calculadora / edição /
// geração — isso é BACKLOG (B-01): botões desabilitados com marca "em breve".
// Estado vazio amigável quando não há termo.

import { createFileRoute, useParams } from "@tanstack/react-router";
import { ExternalLink, FileText, Lock } from "lucide-react";
import { useEffect } from "react";

import { Breadcrumb, Eyebrow } from "@/components/hv/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCase } from "@/hooks/useCases";
import { useTermos } from "@/hooks/useTermo";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";
import { setRouteTitle, usePublishRouteTitle } from "@/lib/route-title";

export const Route = createFileRoute("/casos/$id/termo")({
  component: TermoPreview,
});

function brl(c: number | null | undefined) {
  return "R$ " + ((c ?? 0) / 100).toFixed(2).replace(".", ",");
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

const FORMA_LABELS: Record<string, string> = {
  PARCELADO: "Parcelado",
  A_VISTA: "À vista",
};

function TermoPreview() {
  const { id } = useParams({ from: "/casos/$id/termo" });
  const { data: termos, isLoading } = useTermos(id);
  const { data: caso, isLoading: casoLoading, isError: casoError } = useCase(id);

  // S4-06 — nome do caso resolvido para breadcrumb e título (nunca UUID).
  const casoLabel = resolveEntityLabel(caso?.case_code, {
    loading: casoLoading,
    notFound: casoError,
    notFoundLabel: "Caso não encontrado",
  });
  useDocumentTitle(`${casoLabel} · Termo`);

  // fix breadcrumb Topbar (2026-07-03) — publica rótulos p/ o Topbar:
  // segmento $id (`/casos/<id>`) = nome do caso; segmento final = "Termo".
  usePublishRouteTitle("Termo");
  useEffect(() => {
    const casePath = `/casos/${id}`;
    setRouteTitle(casePath, casoLabel);
    return () => setRouteTitle(casePath, null);
  }, [id, casoLabel]);

  // Snapshot vigente = maior version (listTermos já ordena version desc).
  const vigente = (termos ?? [])[0] as
    | {
        id: string;
        version: number;
        status: string;
        valor_efetivo_centavos: number;
        valor_total_centavos: number;
        valor_parcela_centavos: number;
        valor_avista_centavos: number;
        percentual_honorarios: number;
        qtd_parcelas: number;
        forma_pagamento: string;
        tipo_termo: string;
        drive_url: string | null;
      }
    | undefined;

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Casos", to: "/casos" },
          { label: casoLabel, to: `/casos/${id}` },
          { label: "Termo" },
        ]}
      />
      <header className="mb-6">
        <Eyebrow>Caso</Eyebrow>
        <h1 className="font-display text-[32px] font-bold text-[var(--navy)] mt-1">
          Termo de Acerto
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualização em leitura do termo vigente. Cálculo, edição e geração de novas versões estão
          na ficha do caso e no backlog.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando termo…</p>
      ) : !vigente ? (
        <div className="card-hero p-8 text-center">
          <FileText size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum termo gerado para este caso.</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Elabore um termo na ficha do caso (aba financeira).
          </p>
        </div>
      ) : (
        <div className="card-hero p-7 max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="font-display text-lg font-semibold text-[var(--navy)]">
              Versão {vigente.version}
            </div>
            <Badge className={STATUS_META[vigente.status]?.cls ?? STATUS_META.RASCUNHO.cls}>
              {STATUS_META[vigente.status]?.label ?? vigente.status}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
            <Field label="Valor efetivo" value={brl(vigente.valor_efetivo_centavos)} />
            <Field label="Honorários (total)" value={brl(vigente.valor_total_centavos)} />
            <Field label="Percentual honorários" value={`${vigente.percentual_honorarios}%`} />
            <Field
              label="Forma de pagamento"
              value={FORMA_LABELS[vigente.forma_pagamento] ?? vigente.forma_pagamento}
            />
            <Field
              label="Parcelas"
              value={`${vigente.qtd_parcelas}x de ${brl(vigente.valor_parcela_centavos)}`}
            />
            <Field label="À vista" value={brl(vigente.valor_avista_centavos)} />
            <Field label="Tipo" value={vigente.tipo_termo} />
          </dl>

          <div className="mt-5 flex items-center gap-2">
            {vigente.drive_url && (
              <a href={vigente.drive_url} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink size={13} className="mr-1" /> Abrir PDF
                </Button>
              </a>
            )}
            <Button size="sm" variant="outline" disabled title="Em breve (backlog)">
              <Lock size={13} className="mr-1" /> Editar / recalcular (em breve)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-[var(--navy)] font-medium mt-0.5">{value}</dd>
    </div>
  );
}
