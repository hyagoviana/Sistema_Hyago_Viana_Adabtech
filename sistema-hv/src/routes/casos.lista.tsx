import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Breadcrumb, Btn, Eyebrow, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import {
  CASE_TYPE_LABELS,
  MACRO_FIN_LABELS,
  MACRO_OP_LABELS,
  type CaseType,
  type MacroFin,
  type MacroOp,
} from "@/lib/cases/constants";

export const Route = createFileRoute("/casos/lista")({
  component: CasosLista,
});

const PAGE_SIZE = 50;

function fmtBRL(centavos: number | null): string {
  if (centavos === null || centavos === undefined) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CasosLista() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, error } = useCasesList(search ? { search } : undefined);

  const sliced = useMemo(() => {
    const start = page * PAGE_SIZE;
    return (data ?? []).slice(start, start + PAGE_SIZE);
  }, [data, page]);

  const total = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Operação", to: "/hoje" },
          { label: "Casos", to: "/casos" },
          { label: "Lista" },
        ]}
      />
      <PageHeader
        eyebrow="Operação"
        title="Lista de casos"
        subtitle={isLoading ? "Carregando…" : `${total} caso${total === 1 ? "" : "s"} no total.`}
        aside={
          <Link to="/casos">
            <Btn variant="outline">
              <ArrowLeft size={14} />
              Voltar ao Kanban
            </Btn>
          </Link>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por código ou próximo passo…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
      </div>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Erro ao carregar casos: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--gold-pale)]/40 border-b border-[var(--border)]">
                {[
                  "Código",
                  "Cliente",
                  "Tipo",
                  "Operacional",
                  "Financeiro",
                  "Município",
                  "Valor",
                ].map((h) => (
                  <th key={h} className="text-left px-4 py-3.5">
                    <Eyebrow>{h}</Eyebrow>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[rgba(152,120,20,0.08)]">
                    <td colSpan={7} className="px-4 py-3">
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))
              ) : sliced.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground italic">
                    Nenhum caso encontrado.
                  </td>
                </tr>
              ) : (
                sliced.map((c) => (
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-display font-semibold text-[var(--navy)]"
                          style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
                        >
                          {c.client_name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-[var(--navy)] font-medium">{c.client_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">
                      {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      {MACRO_OP_LABELS[c.macrostatus_op as MacroOp] ?? c.macrostatus_op}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">
                      {MACRO_FIN_LABELS[c.macrostatus_fin as MacroFin] ?? c.macrostatus_fin}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.municipio ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-[var(--navy)]">
                      {fmtBRL(c.valor_centavos)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between text-[12px] text-muted-foreground">
          <span>
            Página {page + 1} de {totalPages} · {total} casos
          </span>
          <div className="flex gap-2">
            <Btn
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Btn>
            <Btn
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Próximo
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
