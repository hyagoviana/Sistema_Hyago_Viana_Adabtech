import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { TrendingUp, Target, Users, AlertTriangle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { useM90, usePreferenceRate, useLoadDeviation, useDailyProduction } from "@/hooks/useDistribuicaoDashboard";
import { useAlertsSummary30d } from "@/hooks/useDistribuicao";

export const Route = createFileRoute("/controladoria/distribuicao/indicadores")({
  component: IndicadoresPage,
});

function IndicadoresPage() {
  const [period, setPeriod] = useState(30);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const startDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - period); return d.toISOString().split("T")[0];
  }, [period]);

  const { data: m90, isLoading: m90Loading } = useM90();
  const { data: prefRate, isLoading: prefLoading } = usePreferenceRate(startDate, today);
  const { data: loadDev, isLoading: devLoading } = useLoadDeviation(startDate, today);
  const { data: dailyProd } = useDailyProduction(startDate, today);
  const { data: alertsSummary } = useAlertsSummary30d();

  // Tarefas D+0 (fatal == distribution_date)
  const d0Count = useMemo(() => {
    return (dailyProd ?? []).filter(r => r.distribution_date === r.final_date).length;
  }, [dailyProd]);

  // Producao diaria por data
  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of dailyProd ?? []) {
      totals.set(r.distribution_date, (totals.get(r.distribution_date) ?? 0) + r.final_points);
    }
    return [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [dailyProd]);

  // Producao por executor
  const executorTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of dailyProd ?? []) {
      totals.set(r.executor_id, (totals.get(r.executor_id) ?? 0) + r.final_points);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [dailyProd]);

  return (
    <div className="space-y-6 p-6">
      {/* Seletor de periodo */}
      <div className="flex gap-2">
        {[7, 30, 90].map(p => (
          <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>{p} dias</Button>
        ))}
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            {m90Loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{m90?.toFixed(2) ?? "·"}</div>}
            <div className="text-xs text-muted-foreground">M90 (media producao)</div>
            <div className="text-xs text-muted-foreground mt-1">Referencia capacidade diaria</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            {devLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{loadDev?.toFixed(1) ?? "·"}%</span>
                <Badge className={`text-xs ${(loadDev ?? 0) < 15 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{(loadDev ?? 0) < 15 ? "Meta" : "Acima"}</Badge>
              </div>
            )}
            <div className="text-xs text-muted-foreground">Desvio de Carga</div>
            <div className="text-xs text-muted-foreground mt-1">Meta: &lt; 15%</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            {prefLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{prefRate?.toFixed(1) ?? "·"}%</span>
                <Badge className={`text-xs ${(prefRate ?? 0) >= 80 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{(prefRate ?? 0) >= 80 ? "Meta" : "Abaixo"}</Badge>
              </div>
            )}
            <div className="text-xs text-muted-foreground">Taxa Preferencia</div>
            <div className="text-xs text-muted-foreground mt-1">Meta: &gt; 80%</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{d0Count}</span>
              <Badge className={`text-xs ${d0Count === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{d0Count === 0 ? "Zero" : "Atencao"}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">Tarefas D+0</div>
            <div className="text-xs text-muted-foreground mt-1">Meta: zero</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tendencia de Producao */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Producao Diaria ({period}d)</CardTitle></CardHeader>
          <CardContent>
            {dailyTotals.length === 0 ? <div className="text-sm text-muted-foreground py-4">Sem dados no periodo</div> : (
              <div className="space-y-1">
                {dailyTotals.slice(-14).map(([date, total]) => {
                  const maxTotal = Math.max(...dailyTotals.map(([, t]) => t), 1);
                  const pct = Math.round(total / maxTotal * 100);
                  return (
                    <div key={date} className="flex items-center gap-2 text-xs">
                      <span className="w-20 text-muted-foreground">{date.slice(5)}</span>
                      <div className="flex-1 bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                      <span className="w-12 text-right">{total.toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Carga por executor no periodo */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Carga por Executor ({period}d)</CardTitle></CardHeader>
          <CardContent>
            {executorTotals.length === 0 ? <div className="text-sm text-muted-foreground py-4">Sem dados no periodo</div> : (
              <div className="space-y-2">
                {executorTotals.slice(0, 10).map(([execId, total]) => {
                  const maxTotal = executorTotals[0]?.[1] ?? 1;
                  const pct = Math.round(total / maxTotal * 100);
                  return (
                    <div key={execId} className="flex items-center gap-2 text-xs">
                      <span className="w-24 truncate">{execId.slice(0, 8)}...</span>
                      <div className="flex-1 bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} /></div>
                      <span className="w-16 text-right font-medium">{total.toFixed(1)}pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertas por tipo */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas por Tipo (30d)</CardTitle></CardHeader>
          <CardContent>
            {alertsSummary && Object.keys(alertsSummary).length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(alertsSummary).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
                  <div key={code} className="flex items-center justify-between p-3 border rounded-lg">
                    <Badge variant="outline" className="text-xs">{code}</Badge>
                    <span className="text-lg font-bold">{count}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground py-4">Nenhum alerta nos ultimos 30 dias</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
