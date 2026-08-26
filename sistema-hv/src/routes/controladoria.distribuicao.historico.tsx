import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useBatchHistory,
  useBatchHistoryStats,
  useSincronizarDistribuicao,
} from "@/hooks/useDistribuicaoDashboard";
import { usePodeEditar } from "@/hooks/usePermissions";

export const Route = createFileRoute("/controladoria/distribuicao/historico")({
  component: HistoricoPage,
});

function HistoricoPage() {
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }, []);
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  const { data: historyData, isLoading } = useBatchHistory(startDate, endDate, page);
  const batches = historyData?.data ?? [];
  const totalCount = historyData?.count ?? 0;

  // KPIs sobre o PERÍODO INTEIRO (não só a página de 30 exibida na tabela).
  const { data: kpis = { total: 0, successRate: 0, avgTasks: 0, avgDuration: 0 } } =
    useBatchHistoryStats(startDate, endDate);

  const podeEditar = usePodeEditar("controladoria");
  const sync = useSincronizarDistribuicao();

  const statusColors: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    running: "bg-blue-100 text-blue-700",
  };

  function formatDuration(batch: any) {
    if (!batch.started_at || !batch.completed_at) return "·";
    const ms = new Date(batch.completed_at).getTime() - new Date(batch.started_at).getTime();
    return ms > 60000
      ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
      : `${Math.round(ms / 1000)}s`;
  }

  // Re-executa um batch de UMA data pelo motor SEGURO (Node/runSync): LÊ o
  // ProJuris e regrava system_distribution_results daquela data (idempotente).
  // ZERO writeback ao ProJuris. Substitui a antiga chamada à Edge Function.
  async function reExecute(batchDate: string) {
    try {
      await sync.mutateAsync({ distributionDate: batchDate });
      toast.success("Re-execucao concluida (leitura ProJuris, sem escrita)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  function exportCSV() {
    const header = "Data;Inicio;Duracao;Status;Total;Sucesso;Falhas;Alertas\n";
    const rows = batches
      .map(
        (b: any) =>
          `${b.batch_date};${b.started_at};${formatDuration(b)};${b.status};${b.total_tasks};${b.successful};${b.failed};${b.alerts_generated}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico_batches.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      {/* AU1 — o motor tem histórico próprio (execuções); a AUDITORIA fina de
          quem-mexeu-no-quê vive no menu Sistema. Atalho para não obrigar a
          procurar. */}
      <div className="mb-3">
        <Link to="/auditoria" className="text-[12px] text-[var(--gold-700)] hover:underline">
          Ver auditoria completa (quem alterou o quê) →
        </Link>
      </div>

      {/* Filtros + KPIs */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        />
        <span className="text-muted-foreground">a</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        />
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{kpis.total}</div>
            <div className="text-xs text-muted-foreground">Total Batches</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{kpis.successRate}%</div>
            <div className="text-xs text-muted-foreground">Taxa Sucesso</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{kpis.avgTasks}</div>
            <div className="text-xs text-muted-foreground">Media Tarefas/Batch</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{kpis.avgDuration}s</div>
            <div className="text-xs text-muted-foreground">Media Duracao</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-[300px]" />
      ) : (
        <Card>
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Data</th>
                  <th className="text-left py-2">Inicio</th>
                  <th className="text-left py-2">Duracao</th>
                  <th className="text-center py-2">Status</th>
                  <th className="text-right py-2">Total</th>
                  <th className="text-right py-2">OK</th>
                  <th className="text-right py-2">Bloq</th>
                  <th className="text-right py-2">Alertas</th>
                  <th className="text-center py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b: any) => (
                  <tr
                    key={b.id}
                    className="border-b hover:bg-accent/50 cursor-pointer"
                    onClick={() => setSelected(b)}
                  >
                    <td className="py-2 font-medium">{b.batch_date}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {b.started_at ? new Date(b.started_at).toLocaleTimeString("pt-BR") : "·"}
                    </td>
                    <td className="py-2">{formatDuration(b)}</td>
                    <td className="py-2 text-center">
                      <Badge className={`text-xs ${statusColors[b.status] ?? ""}`}>
                        {b.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">{b.total_tasks}</td>
                    <td className="py-2 text-right">{b.successful}</td>
                    <td className="py-2 text-right">{b.failed}</td>
                    <td className="py-2 text-right">{b.alerts_generated}</td>
                    <td className="py-2 text-center">
                      {b.status === "failed" && podeEditar && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={sync.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            reExecute(b.batch_date);
                          }}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted-foreground">
                Pagina {page + 1} de {Math.ceil(totalCount / 30)}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * 30 >= totalCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do Batch</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-3 mt-4 text-sm">
              <div>
                <strong>Data:</strong> {(selected as any).batch_date}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                <Badge className={statusColors[(selected as any).status] ?? ""}>
                  {(selected as any).status}
                </Badge>
              </div>
              <div>
                <strong>Duracao:</strong> {formatDuration(selected)}
              </div>
              <div>
                <strong>Total:</strong> {(selected as any).total_tasks} | OK:{" "}
                {(selected as any).successful} | Bloq: {(selected as any).failed}
              </div>
              <div>
                <strong>Alertas gerados:</strong> {(selected as any).alerts_generated}
              </div>
              {(selected as any).error_message && (
                <div className="text-destructive">
                  <strong>Erro:</strong> {(selected as any).error_message}
                </div>
              )}
              {(selected as any).metrics && (
                <div>
                  <strong>Metricas:</strong>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify((selected as any).metrics, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
