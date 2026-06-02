import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight } from "lucide-react";

import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useExceptions, type ExcGroup, type ExcItem } from "@/hooks/useExceptions";

export const Route = createFileRoute("/controladoria/excecoes")({
  component: ExcecoesPage,
});

const TONE_COLOR: Record<string, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  neutral: "var(--ink-500)",
};

function ExcecoesPage() {
  const { loading, total, groups } = useExceptions();

  return (
    <div className="page-container">
      <Breadcrumb
        items={[
          { label: "Controladoria", to: "/controladoria" },
          { label: "Exceções" },
        ]}
      />
      <PageHeader
        eyebrow="Controladoria"
        title="Centro de Exceções"
        subtitle={
          loading
            ? "Carregando…"
            : total === 0
              ? "Nenhuma exceção aberta. Tudo sob controle. 🎉"
              : `${total} ocorrência${total === 1 ? "" : "s"} que pedem atenção.`
        }
      />

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {groups.map((g) => (
            <ExceptionCard key={g.key} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExceptionCard({ group }: { group: ExcGroup }) {
  const color = TONE_COLOR[group.tone];
  return (
    <section className="card-editorial !p-0 overflow-hidden">
      <header className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--border)]">
        <AlertTriangle size={16} style={{ color: group.items.length > 0 ? color : "var(--ink-300)" }} />
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-[15px] font-semibold text-[var(--navy)]">{group.label}</h2>
          <p className="text-[11px] text-muted-foreground">{group.hint}</p>
        </div>
        <span
          className="text-[13px] font-semibold tabular px-2.5 py-0.5 rounded-full shrink-0"
          style={{
            color: group.items.length > 0 ? color : "var(--ink-400)",
            background: group.items.length > 0 ? "rgba(0,0,0,0.03)" : "transparent",
            border: "1px solid var(--border)",
          }}
        >
          {group.items.length}
        </span>
      </header>

      {group.items.length === 0 ? (
        <div className="px-5 py-6 text-center text-[12.5px] text-muted-foreground">
          Nenhuma ocorrência.
        </div>
      ) : (
        <ul className="max-h-72 overflow-y-auto">
          {group.items.slice(0, 30).map((it, i) => (
            <ExceptionRow key={it.id} item={it} last={i === Math.min(group.items.length, 30) - 1} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ExceptionRow({ item, last }: { item: ExcItem; last: boolean }) {
  return (
    <li style={last ? undefined : { borderBottom: "1px solid var(--border)" }}>
      <Link
        to="/casos/$id"
        params={{ id: item.caseId }}
        className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-[var(--ink-50)]"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-[var(--navy)] truncate">{item.title}</div>
          <div className="text-[11px] text-muted-foreground truncate">{item.subtitle}</div>
        </div>
        <span
          className="text-[11.5px] font-medium tabular shrink-0"
          style={{ color: TONE_COLOR[item.tone] }}
        >
          {item.meta}
        </span>
        <ChevronRight size={14} className="text-[var(--ink-300)] shrink-0" />
      </Link>
    </li>
  );
}
