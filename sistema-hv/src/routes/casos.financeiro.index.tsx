import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CaseCardFin } from "@/components/cases/CaseCardFin";
import { Breadcrumb, Btn, Eyebrow, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import { MACRO_FIN, MACRO_FIN_LABELS, type MacroFin } from "@/lib/cases/constants";

export const Route = createFileRoute("/casos/financeiro/")({
  component: CasosFinanceiro,
});

// NAO_APLICAVEL não aparece como coluna — esse estado é "ainda não bifurcado"
const COLUMNS: MacroFin[] = MACRO_FIN.filter((s) => s !== "NAO_APLICAVEL");

const COLUMN_TONE: Record<MacroFin, string> = {
  NAO_APLICAVEL: "neutral",
  ELABORANDO: "neutral",
  APROVACAO: "navy",
  AGUARDANDO_ATIVACAO: "navy",
  ATIVO: "success",
  QUITANDO: "success",
  QUITADO: "success",
  INADIMPLENTE: "danger",
  PARCIAL: "warning",
  RENEGOCIADO: "warning",
  SUSPENSO: "warning",
  CANCELADO: "danger",
};

const TONE_COLOR: Record<string, string> = {
  neutral: "var(--muted-foreground)",
  navy: "var(--navy)",
  gold: "var(--gold-700)",
  warning: "var(--warning)",
  success: "var(--success)",
  danger: "var(--danger)",
};

function CasosFinanceiro() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useCasesList(search ? { search } : undefined);

  // Só casos já bifurcados aparecem (macrostatus_fin != NAO_APLICAVEL)
  const bifurcated = useMemo(
    () => (data ?? []).filter((c) => c.macrostatus_fin !== "NAO_APLICAVEL"),
    [data],
  );

  const grouped = useMemo(() => {
    const map = new Map<MacroFin, typeof bifurcated>();
    for (const s of COLUMNS) map.set(s, []);
    bifurcated.forEach((c) => {
      const col = c.macrostatus_fin as MacroFin;
      if (map.has(col)) map.get(col)!.push(c);
    });
    return map;
  }, [bifurcated]);

  const total = bifurcated.length;
  const naoBifurcados = (data ?? []).length - total;

  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: "Financeiro" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Pipeline Financeira"
        subtitle={
          isLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} bifurcado${total === 1 ? "" : "s"}${
                naoBifurcados > 0 ? ` · ${naoBifurcados} ainda não bifurcado(s)` : ""
              }`
        }
        aside={
          <div className="flex items-center gap-2">
            <Link to="/casos">
              <Btn variant="ghost">
                <ArrowLeft size={14} />
                Voltar ao Operacional
              </Btn>
            </Link>
            <Link to="/casos/financeiro/inadimplencia">
              <Btn variant="outline">Inadimplência</Btn>
            </Link>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código ou próximo passo…"
            className="w-full pl-9 pr-4 py-2.5 bg-[var(--card)] border border-[rgba(120,96,30,0.12)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
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

      <div className="overflow-x-auto -mx-2 pb-4">
        <div className="flex gap-3 px-2 min-w-max">
          {COLUMNS.map((col) => {
            const items = grouped.get(col) ?? [];
            const tone = COLUMN_TONE[col];
            return (
              <div key={col} className="w-[280px] shrink-0 flex flex-col">
                <div
                  className="flex items-center justify-between px-2 py-3 border-b-2 mb-3"
                  style={{ borderColor: TONE_COLOR[tone] }}
                >
                  <Eyebrow>{MACRO_FIN_LABELS[col]}</Eyebrow>
                  <span
                    className="font-display text-[20px] font-semibold"
                    style={{ color: TONE_COLOR[tone] }}
                  >
                    {String(items.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-lg" />
                    ))
                  ) : items.length === 0 ? (
                    <div className="text-[12px] text-muted-foreground text-center py-8 italic">
                      vazio
                    </div>
                  ) : (
                    items.map((c) => <CaseCardFin key={c.id} caso={c} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
