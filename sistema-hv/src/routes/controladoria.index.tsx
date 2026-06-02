import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ShieldCheck, ChevronRight } from "lucide-react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useExceptions } from "@/hooks/useExceptions";

export const Route = createFileRoute("/controladoria/")({
  component: ControladoriaPage,
});

const TONE_COLOR: Record<string, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  neutral: "var(--ink-500)",
};

function ControladoriaPage() {
  const { loading, total, groups } = useExceptions();

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Inteligência", to: "/hoje" }, { label: "Controladoria" }]} />
      <PageHeader
        eyebrow="Inteligência"
        title="Controladoria Jurídica"
        subtitle="Monitoramento de prazos, tarefas e exceções operacionais."
        aside={
          <Link
            to="/controladoria/excecoes"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--gold-700)] hover:text-[var(--gold)]"
          >
            Abrir Centro de Exceções <ChevronRight size={14} />
          </Link>
        }
      />

      {/* Resumo de exceções (dados reais) */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <Link to="/controladoria/excecoes" className="block mb-5">
            <div
              className="card-editorial !p-5 flex items-center gap-4"
              style={total > 0 ? { borderColor: "rgba(180,36,50,0.22)" } : undefined}
            >
              {total > 0 ? (
                <AlertTriangle size={22} className="text-[var(--danger)] shrink-0" />
              ) : (
                <ShieldCheck size={22} className="text-[var(--success)] shrink-0" />
              )}
              <div className="flex-1">
                <div
                  className="kpi-number"
                  style={{ fontSize: 28, color: total > 0 ? "var(--danger)" : "var(--success)" }}
                >
                  {total}
                </div>
                <div className="text-[12.5px] text-muted-foreground">
                  {total === 0
                    ? "Nenhuma exceção aberta — tudo sob controle."
                    : `exceção${total === 1 ? "" : "ões"} aberta${total === 1 ? "" : "s"} para resolução`}
                </div>
              </div>
              <ChevronRight size={18} className="text-[var(--ink-300)]" />
            </div>
          </Link>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((g) => (
              <Link
                key={g.key}
                to="/controladoria/excecoes"
                className="card-editorial !p-4"
              >
                <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)] mb-2 truncate">
                  {g.label}
                </div>
                <div
                  className="kpi-number"
                  style={{
                    fontSize: 26,
                    color: g.items.length > 0 ? TONE_COLOR[g.tone] : "var(--navy)",
                  }}
                >
                  {g.items.length}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="mt-6 text-[12px] text-muted-foreground">
        Integração com Projuris, classificação de movimentações por IA e base de teses/decisões
        entram na frente dedicada da Controladoria.
      </p>
    </div>
  );
}
