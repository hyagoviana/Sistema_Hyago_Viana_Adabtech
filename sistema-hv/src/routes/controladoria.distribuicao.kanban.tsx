import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useKanbanTasks } from "@/hooks/useDistribuicaoDashboard";
import type { KanbanTask } from "@/rpc/distribuicao";

export const Route = createFileRoute("/controladoria/distribuicao/kanban")({
  component: KanbanPage,
});

// Colunas estilo ProJuris (Kanban de Tarefas). Mantido em sincronia com
// KANBAN_COLUMNS de sync-core (não importável aqui: sync-core é server-only).
const COLUMNS = [
  "Pendente",
  "Em execução",
  "Concluída com sucesso",
  "Concluída sem sucesso",
  "Cancelado",
  "A confirmar",
  "Revisão",
] as const;

const COL_ACCENT: Record<string, string> = {
  Pendente: "border-t-amber-400",
  "Em execução": "border-t-blue-400",
  "Concluída com sucesso": "border-t-green-500",
  "Concluída sem sucesso": "border-t-red-400",
  Cancelado: "border-t-gray-400",
  "A confirmar": "border-t-purple-400",
  Revisão: "border-t-orange-400",
};

function KanbanPage() {
  const { data: tasks, isLoading } = useKanbanTasks();

  const byColumn = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    for (const c of COLUMNS) map.set(c, []);
    for (const t of tasks ?? []) {
      const col = map.has(t.situacao_col) ? t.situacao_col : "Pendente";
      map.get(col)!.push(t);
    }
    return map;
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const total = tasks?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-2 text-sm text-muted-foreground">
        {total === 0 ? (
          <span>
            Nenhuma tarefa no snapshot. O quadro é populado a cada sincronização do motor (lê as
            tarefas do ProJuris).
          </span>
        ) : (
          <span>{total} tarefas · você vê apenas as vinculadas ao seu nome (admin vê todas).</span>
        )}
      </div>
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        <div className="flex gap-3 min-w-max h-full">
          {COLUMNS.map((col) => {
            const items = byColumn.get(col) ?? [];
            return (
              <div key={col} className="w-72 flex-shrink-0 flex flex-col">
                <div
                  className={`rounded-t-md border-t-4 bg-muted/40 px-3 py-2 flex items-center justify-between ${
                    COL_ACCENT[col] ?? "border-t-gray-300"
                  }`}
                >
                  <span className="font-medium text-sm">{col}</span>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2 bg-muted/10 rounded-b-md max-h-[calc(100vh-260px)]">
                  {items.map((t) => (
                    <Card key={t.id} className="shadow-sm">
                      <CardContent className="p-2.5 space-y-1">
                        <div className="text-xs font-medium leading-snug">
                          {t.tipo_nome ?? "(sem tipo)"}
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-snug">
                          {t.process_nome ?? t.process_id ?? "—"}
                        </div>
                        {t.numero_processo && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {t.numero_processo}
                          </div>
                        )}
                        {t.responsavel_nomes.length > 0 && (
                          <div className="text-[11px]">{t.responsavel_nomes.join(", ")}</div>
                        )}
                        {(t.prazo_previsto || t.prazo_fatal) && (
                          <div className="text-[10px] text-muted-foreground">
                            {t.prazo_previsto && <>Previsto: {t.prazo_previsto} </>}
                            {t.prazo_fatal && <>· Fatal: {t.prazo_fatal}</>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <div className="text-[11px] text-muted-foreground text-center py-4">·</div>
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
