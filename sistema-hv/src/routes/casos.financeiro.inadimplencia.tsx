import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { Breadcrumb, Btn, Eyebrow, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";

export const Route = createFileRoute("/casos/financeiro/inadimplencia")({
  component: Inadimplencia,
});

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function fmtBRL(centavos: number | null): string {
  if (!centavos) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Inadimplencia() {
  const { data, isLoading, isError, error } = useCasesList({ macrostatus_fin: "INADIMPLENTE" });
  const cases = data ?? [];

  const totalAberto = cases.reduce((sum, c) => sum + (c.valor_centavos ?? 0), 0);

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Casos", to: "/casos" },
          { label: "Financeiro", to: "/casos/financeiro" },
          { label: "Inadimplência" },
        ]}
      />
      <PageHeader
        eyebrow="Financeiro"
        title="Inadimplência"
        subtitle={
          isLoading
            ? "Carregando…"
            : `${cases.length} caso${cases.length === 1 ? "" : "s"} inadimplente${
                cases.length === 1 ? "" : "s"
              } · ${fmtBRL(totalAberto)} em aberto`
        }
        aside={
          <Link to="/casos/financeiro">
            <Btn variant="outline">
              <ArrowLeft size={14} />
              Voltar ao Kanban Financeiro
            </Btn>
          </Link>
        }
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar inadimplência:{" "}
            {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      <div className="card-editorial !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--gold-pale)]/40 border-b border-[var(--border)]">
                {["Código", "Cliente", "Tipo", "Dias atrasado", "Valor", "Próximo passo"].map(
                  (h) => (
                    <th key={h} className="text-left px-4 py-3.5">
                      <Eyebrow>{h}</Eyebrow>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[rgba(152,120,20,0.08)]">
                    <td colSpan={6} className="px-4 py-3">
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-12 py-12 text-center">
                    <AlertTriangle
                      size={32}
                      className="mx-auto mb-3 text-[var(--success)] opacity-60"
                    />
                    <p className="text-muted-foreground italic">
                      Nenhum caso inadimplente. Tudo em dia.
                    </p>
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[rgba(152,120,20,0.08)] hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">
                      <Link
                        to="/casos/$id"
                        params={{ id: c.id }}
                        className="hover:text-[var(--gold-700)]"
                      >
                        {c.case_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--navy)] font-medium">{c.client_name}</td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">
                      {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[var(--danger)] font-medium">
                        <AlertTriangle size={12} />
                        {daysSince(c.status_fin_changed_at)}d
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--navy)]">
                      {fmtBRL(c.valor_centavos)}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground max-w-[300px] truncate">
                      {c.proximo_passo ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
