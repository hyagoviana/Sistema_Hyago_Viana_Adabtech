import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter, List, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CaseCardReal } from "@/components/cases/CaseCardReal";
import { CaseFormDialog } from "@/components/cases/CaseFormDialog";
import { Breadcrumb, Btn, Eyebrow, PageHeader } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useCasesList } from "@/hooks/useCases";
import { MACRO_OP, MACRO_OP_LABELS, type MacroOp } from "@/lib/cases/constants";

export const Route = createFileRoute("/casos/")({
  component: CasosKanban,
});

const COLUMN_TONE: Record<MacroOp, string> = {
  ONBOARDING: "neutral",
  ANALISE: "neutral",
  CONFERENCIA: "navy",
  PRONTO_AJUIZAR: "gold",
  EM_ANDAMENTO: "gold",
  AGUARDANDO_DECISAO: "warning",
  IMPLANTADO: "success",
  IMPLANTACAO_PARCIAL: "success",
  ENCERRADO: "neutral",
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

function CasosKanban() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, isError, error } = useCasesList(search ? { search } : undefined);

  const grouped = useMemo(() => {
    const map = new Map<MacroOp, NonNullable<typeof data>>();
    for (const s of MACRO_OP) map.set(s, []);
    (data ?? []).forEach((c) => {
      const col = c.macrostatus_op as MacroOp;
      if (map.has(col)) map.get(col)!.push(c);
    });
    return map;
  }, [data]);

  const total = data?.length ?? 0;

  return (
    <div className="page-container !pb-10">
      <Breadcrumb items={[{ label: "Operação", to: "/hoje" }, { label: "Pipeline Operacional" }]} />
      <PageHeader
        eyebrow="Operação"
        title="Pipeline Operacional"
        subtitle={
          isLoading
            ? "Carregando…"
            : `${total} caso${total === 1 ? "" : "s"} em ${MACRO_OP.length} estados operacionais.`
        }
        aside={
          <div className="flex items-center gap-2">
            <Link to="/casos/lista">
              <Btn variant="ghost">
                <List size={14} />
                Ver lista
              </Btn>
            </Link>
            <Btn variant="gold" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              Novo caso
            </Btn>
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
        <Btn variant="outline" size="sm" disabled>
          <Filter size={13} />
          Filtros (em breve)
        </Btn>
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
          {MACRO_OP.map((col) => {
            const items = grouped.get(col) ?? [];
            const tone = COLUMN_TONE[col];
            return (
              <div key={col} className="w-[280px] shrink-0 flex flex-col">
                <div
                  className="flex items-center justify-between px-2 py-3 border-b-2 mb-3"
                  style={{ borderColor: TONE_COLOR[tone] }}
                >
                  <Eyebrow>{MACRO_OP_LABELS[col]}</Eyebrow>
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
                    items.map((c) => <CaseCardReal key={c.id} caso={c} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CaseFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
