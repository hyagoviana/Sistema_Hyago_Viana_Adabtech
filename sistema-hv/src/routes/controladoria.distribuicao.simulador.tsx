import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { FlaskConical, BarChart3, CheckCircle, XCircle, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const supabase = getSupabaseBrowserClient();

export const Route = createFileRoute("/controladoria/distribuicao/simulador")({
  component: SimuladorPage,
});

const ORG_ID = "00000000-0000-0000-0000-000000000001";

function SimuladorPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [onlyDivergences, setOnlyDivergences] = useState(false);

  // Buscar simulacoes do dia
  const { data: simResults, isLoading: simLoading } = useQuery({
    queryKey: ["simulation-results", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_simulations")
        .select("*")
        .eq("distribution_date", date)
        .eq("organization_id", ORG_ID)
        .order("task_id");
      if (error) throw error;
      return data;
    },
  });

  // Buscar distribuicoes reais do dia (se existirem)
  const { data: realResults } = useQuery({
    queryKey: ["real-results-compare", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_results")
        .select("task_id, executor_id, final_points, flow, final_date, blocked")
        .eq("distribution_date", date)
        .eq("organization_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });

  const realMap = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const r of realResults ?? []) map.set(r.task_id, r);
    return map;
  }, [realResults]);

  const hasRealData = (realResults ?? []).length > 0;

  // Comparacao
  const comparison = useMemo(() => {
    if (!simResults) return [];
    return simResults.map(sim => {
      const real = realMap.get(sim.task_id);
      return {
        task_id: sim.task_id,
        sim_executor: sim.executor_id,
        real_executor: real?.executor_id ?? null,
        sim_flow: sim.flow,
        sim_points: sim.final_points,
        sim_date: sim.final_date,
        match: real ? sim.executor_id === real.executor_id : null,
        blocked: sim.blocked,
      };
    });
  }, [simResults, realMap]);

  const filteredComparison = onlyDivergences ? comparison.filter(c => c.match === false) : comparison;

  const concordance = useMemo(() => {
    const withReal = comparison.filter(c => c.match !== null);
    if (withReal.length === 0) return null;
    const matches = withReal.filter(c => c.match).length;
    return Math.round(matches / withReal.length * 100);
  }, [comparison]);

  // Carga por executor (simulada vs real)
  const executorComparison = useMemo(() => {
    const simLoads: Record<string, number> = {};
    const realLoads: Record<string, number> = {};
    for (const s of simResults ?? []) { if (!s.blocked) simLoads[s.executor_id] = (simLoads[s.executor_id] ?? 0) + s.final_points; }
    for (const r of realResults ?? []) { if (!r.blocked) realLoads[r.executor_id] = (realLoads[r.executor_id] ?? 0) + r.final_points; }
    const allExecs = [...new Set([...Object.keys(simLoads), ...Object.keys(realLoads)])];
    return allExecs.map(e => ({ executor: e, sim: simLoads[e] ?? 0, real: realLoads[e] ?? 0 })).sort((a, b) => b.sim - a.sim);
  }, [simResults, realResults]);

  const simCount = (simResults ?? []).filter(s => !s.blocked).length;
  const blockedCount = (simResults ?? []).filter(s => s.blocked).length;

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb items={[{ label: "Controladoria", href: "/controladoria" }, { label: "Distribuicao", href: "/controladoria/distribuicao" }, { label: "Simulador" }]} />
      <PageHeader title="Simulador — Comparacao" subtitle="Simulacao vs distribuicao real" icon={<FlaskConical className="h-6 w-6" />} />

      <div className="flex items-center gap-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-3 py-1.5 text-sm" />
        {hasRealData && <Badge className="bg-green-100 text-green-700">Dados reais disponiveis</Badge>}
        {!hasRealData && <Badge variant="secondary">Sem dados reais para comparacao</Badge>}
        <label className="flex items-center gap-1 text-sm cursor-pointer ml-auto">
          <input type="checkbox" checked={onlyDivergences} onChange={() => setOnlyDivergences(!onlyDivergences)} />
          Somente divergencias
        </label>
      </div>

      {simLoading ? <Skeleton className="h-[400px]" /> : !simResults?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma simulacao encontrada para {date}. Execute uma simulacao primeiro.</CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{simCount}</div><div className="text-xs text-muted-foreground">Simuladas</div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-destructive">{blockedCount}</div><div className="text-xs text-muted-foreground">Bloqueadas</div></CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-2xl font-bold">{concordance !== null ? `${concordance}%` : "—"}</div>
              <div className="text-xs text-muted-foreground">Concordancia</div>
              {concordance !== null && <Badge className={`text-xs mt-1 ${concordance >= 80 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{concordance >= 80 ? "Alta" : "Baixa"}</Badge>}
            </CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{(simResults ?? []).find(s => s.simulation_run_id)?.simulation_run_id?.slice(0, 8) ?? "—"}</div><div className="text-xs text-muted-foreground">Run ID</div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tabela lado-a-lado */}
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Comparacao por Tarefa</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">Tarefa</th><th className="text-center py-2">Motor</th><th className="text-center py-2">Real</th><th className="text-center py-2">Match</th><th className="text-right py-2">Pontos</th><th className="text-center py-2">Fluxo</th></tr></thead>
                  <tbody>{filteredComparison.slice(0, 50).map(c => (
                    <tr key={c.task_id} className={`border-b ${c.match === false ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                      <td className="py-2 font-mono text-xs">{c.task_id}</td>
                      <td className="py-2 text-center text-xs">{c.sim_executor?.slice(0, 8) ?? "—"}</td>
                      <td className="py-2 text-center text-xs">{c.real_executor ? String(c.real_executor).slice(0, 8) : "—"}</td>
                      <td className="py-2 text-center">{c.match === true ? <CheckCircle className="h-4 w-4 text-green-500 inline" /> : c.match === false ? <XCircle className="h-4 w-4 text-red-500 inline" /> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 text-right">{c.sim_points?.toFixed(2)}</td>
                      <td className="py-2 text-center"><Badge variant="outline" className="text-xs">{c.sim_flow}</Badge></td>
                    </tr>
                  ))}</tbody>
                </table>
              </CardContent>
            </Card>

            {/* Carga comparativa */}
            {hasRealData && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Carga Motor vs Real</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {executorComparison.slice(0, 10).map(({ executor, sim, real }) => {
                      const max = Math.max(...executorComparison.map(e => Math.max(e.sim, e.real)), 1);
                      return (
                        <div key={executor} className="space-y-1">
                          <span className="text-xs">{executor.slice(0, 8)}...</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-12 text-right text-blue-600">{sim.toFixed(0)}</span>
                            <div className="flex-1 bg-muted rounded-full h-2 relative"><div className="h-2 rounded-full bg-blue-500 absolute" style={{ width: `${sim / max * 100}%` }} /></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs w-12 text-right text-green-600">{real.toFixed(0)}</span>
                            <div className="flex-1 bg-muted rounded-full h-2 relative"><div className="h-2 rounded-full bg-green-500 absolute" style={{ width: `${real / max * 100}%` }} /></div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex gap-4 text-xs mt-2"><span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500" /> Motor</span><span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500" /> Real</span></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
