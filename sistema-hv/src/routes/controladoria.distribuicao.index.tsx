import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  PieChart,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import {
  useDistributionResults,
  useBatchLog,
  useSincronizarDistribuicao,
} from "@/hooks/useDistribuicaoDashboard";
import { usePodeEditar } from "@/hooks/usePermissions";

export const Route = createFileRoute("/controladoria/distribuicao/")({
  component: DistribuicaoPainelPage,
});

function DistribuicaoPainelPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const { data: resultsData, isLoading: resultsLoading } = useDistributionResults(date);
  const { data: batchLog, isLoading: batchLoading } = useBatchLog(date);

  // Sincronizacao sob demanda — mesmo gate da rota (controladoria/edit).
  const podeSincronizar = usePodeEditar("controladoria");
  const sync = useSincronizarDistribuicao();

  function handleSync() {
    sync.mutate(
      { distributionDate: date, windowDays: 3 },
      {
        onSuccess: (r) => {
          toast.success(
            `Sincronizado: ${r.distributed} distribuidas` +
              (r.blocked ? `, ${r.blocked} bloqueadas` : "") +
              ` (de ${r.totalTasks} tarefas)`,
          );
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Falha ao sincronizar distribuicao.");
        },
      },
    );
  }

  const results = resultsData?.data ?? [];
  const flowCounts = useMemo(() => {
    const counts = { ABSOLUTE: 0, COMPLEX: 0, GENERAL: 0 };
    results.forEach((r) => {
      if (!r.blocked && r.flow in counts) counts[r.flow as keyof typeof counts]++;
    });
    return counts;
  }, [results]);

  const executorLoads = useMemo(() => {
    const loads: Record<string, { name: string; points: number }> = {};
    results
      .filter((r) => !r.blocked)
      .forEach((r) => {
        if (!loads[r.executor_id]) loads[r.executor_id] = { name: r.executor_id, points: 0 };
        loads[r.executor_id].points += r.final_points;
      });
    return Object.values(loads).sort((a, b) => b.points - a.points);
  }, [results]);

  const alertResults = results.filter((r) => r.alerts?.length > 0);
  const blockedCount = results.filter((r) => r.blocked).length;
  const successCount = results.filter((r) => !r.blocked).length;

  const statusColors: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    running: "bg-blue-100 text-blue-700",
  };
  const flowColors: Record<string, string> = {
    ABSOLUTE: "bg-purple-500",
    COMPLEX: "bg-amber-500",
    GENERAL: "bg-blue-500",
  };

  function changeDate(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Seletor de data */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        />
        <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {batchLog && (
          <Badge className={statusColors[batchLog.status] ?? ""}>{batchLog.status}</Badge>
        )}
        {batchLog?.completed_at && (
          <span className="text-xs text-muted-foreground">
            Concluido: {new Date(batchLog.completed_at).toLocaleTimeString("pt-BR")}
          </span>
        )}
        {podeSincronizar && (
          <Button className="ml-auto" onClick={handleSync} disabled={sync.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Sincronizando…" : "Sincronizar"}
          </Button>
        )}
      </div>

      {resultsLoading || batchLoading ? (
        <Skeleton className="h-[400px]" />
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma distribuicao realizada em {date}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{successCount}</div>
                <div className="text-sm text-muted-foreground">Distribuidas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-destructive">{blockedCount}</div>
                <div className="text-sm text-muted-foreground">Bloqueadas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-amber-600">{alertResults.length}</div>
                <div className="text-sm text-muted-foreground">Com Alertas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">
                  {(() => {
                    const d = (batchLog?.metrics as { duration_ms?: number } | null | undefined)
                      ?.duration_ms;
                    return d ? `${Math.round(d / 1000)}s` : "—";
                  })()}
                </div>
                <div className="text-sm text-muted-foreground">Duracao</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Distribuicao por Fluxo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4" /> Por Fluxo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(flowCounts).map(([flow, count]) => {
                    const pct = successCount > 0 ? Math.round((count / successCount) * 100) : 0;
                    return (
                      <div key={flow} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${flowColors[flow]}`} />
                        <span className="text-sm font-medium w-24">{flow}</span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${flowColors[flow]}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-16 text-right">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Carga por Executor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Carga por Executor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {executorLoads.slice(0, 10).map(({ name, points }) => {
                    const maxPts = executorLoads[0]?.points ?? 1;
                    const pct = Math.round((points / maxPts) * 100);
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-sm w-28 truncate">{name.slice(0, 8)}...</span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-16 text-right">
                          {points.toFixed(1)}pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alertas pendentes */}
          {alertResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas (
                  {alertResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Tarefa</th>
                      <th className="text-left py-2">Alertas</th>
                      <th className="text-left py-2">Data Final</th>
                      <th className="text-center py-2">Status</th>
                      <th className="py-2">Acao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertResults.slice(0, 10).map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="py-2 font-mono text-xs">{r.task_id}</td>
                        <td className="py-2">
                          {(r.alerts ?? []).map((a: string) => (
                            <Badge key={a} variant="outline" className="text-xs mr-1">
                              {a}
                            </Badge>
                          ))}
                        </td>
                        <td className="py-2">{r.final_date}</td>
                        <td className="py-2 text-center">
                          {r.blocked ? (
                            <Badge variant="destructive" className="text-xs">
                              Bloqueada
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 text-xs">OK</Badge>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {r.blocked && (
                            <Link
                              to="/controladoria/distribuicao/excecoes"
                              className="text-xs text-primary underline"
                            >
                              Tratar
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
