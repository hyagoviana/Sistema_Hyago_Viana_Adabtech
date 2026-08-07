import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSignature, LayoutGrid } from "lucide-react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLeadsPipeline } from "@/hooks/usePipeline";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";
import { useDocumentTitle } from "@/lib/use-document-title";

export const Route = createFileRoute("/comercial/")({
  component: ComercialIndex,
});

// Rótulos das etapas comerciais default (S5-01). O editor de funil permite
// etapas customizadas por tipo; para o resumo consolidado usamos este mapa e,
// no fallback, o próprio slug — nunca um valor inventado.
const COMERCIAL_STAGE_LABELS: Record<string, string> = {
  NOVO: "Novo",
  EM_CONTATO: "Em contato",
  PROPOSTA_ENVIADA: "Proposta enviada",
  AGUARDANDO_ASSINATURA: "Aguardando assinatura",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
};
const STAGE_ORDER = [
  "NOVO",
  "EM_CONTATO",
  "PROPOSTA_ENVIADA",
  "AGUARDANDO_ASSINATURA",
  "GANHO",
  "PERDIDO",
];

function ComercialIndex() {
  const { data: leads, isLoading, isError, error } = useLeadsPipeline();
  useDocumentTitle("Comercial");

  const list = leads ?? [];

  // Contagem por etapa comercial (leads = lifecycle='LEAD'; GANHO/PERDIDO já
  // saíram da fonte — a coluna terminal mostra só instantâneo recém-movido).
  const byStage = new Map<string, number>();
  for (const l of list) {
    const slug = (l as { macrostatus_comercial?: string | null }).macrostatus_comercial ?? "·";
    byStage.set(slug, (byStage.get(slug) ?? 0) + 1);
  }
  const stageEntries = [
    ...STAGE_ORDER.filter((s) => byStage.has(s)),
    ...[...byStage.keys()].filter((s) => !STAGE_ORDER.includes(s)),
  ].map((slug) => ({
    slug,
    label: COMERCIAL_STAGE_LABELS[slug] ?? slug,
    count: byStage.get(slug) ?? 0,
  }));

  // Breakdown por tipo de serviço.
  const byType = new Map<string, number>();
  for (const l of list) {
    byType.set(l.case_type, (byType.get(l.case_type) ?? 0) + 1);
  }

  // Nº aguardando assinatura (mesma fonte/regra do Sidebar).
  const aguardando = list.filter(
    (l) => (l as { aguardando_assinatura_at?: string | null }).aguardando_assinatura_at,
  ).length;

  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Comercial" }]} />
      <PageHeader
        eyebrow="Inteligência"
        title="Comercial · CRM"
        subtitle="Panorama dos leads em captação."
        aside={
          <div className="flex items-center gap-2">
            <Link
              to="/comercial/leads"
              className="inline-flex items-center gap-1.5 font-medium transition-colors px-3 py-1.5 text-[12.5px] rounded-lg text-white hover:opacity-95"
              style={{
                background: "linear-gradient(180deg, #a98a22 0%, #987814 60%, #856611 100%)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 16px -8px rgba(152,120,20,0.5)",
              }}
            >
              <LayoutGrid size={14} />
              Ver pipeline de leads
            </Link>
            <Link
              to="/comercial/assinaturas"
              className="inline-flex items-center gap-1.5 font-medium transition-colors px-3 py-1.5 text-[12.5px] rounded-lg text-[#1a1a1f] hover:bg-[var(--ink-50)]"
            >
              <FileSignature size={14} />
              Assinaturas
              {aguardando > 0 ? ` (${aguardando})` : ""}
            </Link>
          </div>
        }
      />

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Erro ao carregar leads: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando…</div>
      ) : list.length === 0 ? (
        <Alert>
          <AlertDescription>
            Nenhum lead em captação.{" "}
            <Link to="/comercial/leads" className="underline">
              Abrir a pipeline de leads
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 text-[13px] font-semibold text-[var(--navy)]">Leads por etapa</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {stageEntries.map((s) => (
                <div key={s.slug} className="card-hero p-4">
                  <div className="text-[24px] font-semibold text-[var(--navy)] tabular">
                    {s.count}
                  </div>
                  <div className="text-[12px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 text-[13px] font-semibold text-[var(--navy)]">
              Leads por tipo de serviço
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...byType.entries()].map(([type, count]) => (
                <div key={type} className="card-hero p-4">
                  <div className="text-[24px] font-semibold text-[var(--navy)] tabular">
                    {count}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {CASE_TYPE_LABELS[type as CaseType] ?? type}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
