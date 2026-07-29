import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { List, Search, Download, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { useDistributionResults } from "@/hooks/useDistribuicaoDashboard";
import { useExecutorMappings } from "@/hooks/useDistribuicao";

export const Route = createFileRoute("/controladoria/distribuicao/lista")({
  component: ListaDistribuicoesPage,
});

const FLOW_COLORS: Record<string, string> = { ABSOLUTE: "bg-purple-100 text-purple-700", COMPLEX: "bg-amber-100 text-amber-700", GENERAL: "bg-blue-100 text-blue-700" };

function ListaDistribuicoesPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [executor, setExecutor] = useState("");
  const [flowFilter, setFlowFilter] = useState<string[]>([]);
  const [hasAlerts, setHasAlerts] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  const { data: executors } = useExecutorMappings();
  const { data: resultsData, isLoading } = useDistributionResults(date, { executor: executor || undefined, flow: flowFilter.length ? flowFilter : undefined, hasAlerts, page });

  const results = resultsData?.data ?? [];
  const totalCount = resultsData?.count ?? 0;

  function toggleFlow(f: string) {
    setFlowFilter(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
    setPage(0);
  }

  function exportCSV() {
    const header = "Task ID;Processo;Executor;Fluxo;Data Final;Pontos;Alertas;Status\n";
    const rows = results.map(r => `${r.task_id};${r.process_id};${r.executor_id};${r.flow};${r.final_date};${r.final_points};${(r.alerts ?? []).join(",")};${r.blocked ? "Bloqueada" : "OK"}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `distribuicoes_${date}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb items={[{ label: "Controladoria", href: "/controladoria" }, { label: "Distribuicao", href: "/controladoria/distribuicao" }, { label: "Lista" }]} />
      <PageHeader title="Lista de Distribuicoes" subtitle="Detalhamento com filtros" icon={<List className="h-6 w-6" />} />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(0); }} className="border rounded px-3 py-1.5 text-sm" />
        <Select value={executor} onValueChange={v => { setExecutor(v === "all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Executor..." /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{(executors ?? []).filter((e: any) => e.active).map((e: any) => <SelectItem key={e.executor_id} value={e.executor_id}>{(e as any).system_users?.full_name ?? e.executor_id}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm">{["ABSOLUTE", "COMPLEX", "GENERAL"].map(f => (
          <label key={f} className="flex items-center gap-1 cursor-pointer"><Checkbox checked={flowFilter.includes(f)} onCheckedChange={() => toggleFlow(f)} />{f}</label>
        ))}</div>
        <label className="flex items-center gap-1 text-sm cursor-pointer"><Checkbox checked={hasAlerts} onCheckedChange={() => { setHasAlerts(!hasAlerts); setPage(0); }} />Com alertas</label>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
      </div>

      <div className="text-sm text-muted-foreground">{totalCount} distribuicoes encontradas</div>

      {isLoading ? <Skeleton className="h-[400px]" /> : (
        <Card><CardContent className="pt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2">Tarefa</th><th className="text-left py-2">Processo</th><th className="text-left py-2">Executor</th><th className="text-center py-2">Fluxo</th><th className="text-left py-2">Data Final</th><th className="text-right py-2">Pontos</th><th className="text-center py-2">Alertas</th><th className="text-center py-2">Status</th></tr></thead>
            <tbody>{results.map((r: any) => (
              <tr key={r.id} className="border-b hover:bg-accent/50 cursor-pointer" onClick={() => setSelected(r)}>
                <td className="py-2 font-mono text-xs">{r.task_id}</td>
                <td className="py-2 text-xs">{r.process_id}</td>
                <td className="py-2 text-xs">{r.executor_id?.slice(0, 8) ?? "—"}</td>
                <td className="py-2 text-center"><Badge className={`text-xs ${FLOW_COLORS[r.flow] ?? ""}`}>{r.flow}</Badge></td>
                <td className="py-2">{r.final_date}</td>
                <td className="py-2 text-right font-medium">{r.final_points?.toFixed(2)}</td>
                <td className="py-2 text-center">{r.alerts?.length > 0 ? <Badge variant="outline" className="text-xs">{r.alerts.length}</Badge> : "—"}</td>
                <td className="py-2 text-center">{r.blocked ? <Badge variant="destructive" className="text-xs">Bloq</Badge> : <Badge className="bg-green-100 text-green-700 text-xs">OK</Badge>}</td>
              </tr>
            ))}</tbody>
          </table>

          {/* Paginacao */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">Pagina {page + 1} de {Math.ceil(totalCount / 50)}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * 50 >= totalCount} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* Sheet de detalhes */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>Detalhes da Distribuicao</SheetTitle></SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4 text-sm">
              <div><span className="font-medium text-muted-foreground">Tarefa:</span> {(selected as any).task_id}</div>
              <div><span className="font-medium text-muted-foreground">Processo:</span> {(selected as any).process_id}</div>
              <div><span className="font-medium text-muted-foreground">Fluxo:</span> <Badge className={FLOW_COLORS[(selected as any).flow] ?? ""}>{(selected as any).flow}</Badge></div>
              <div><span className="font-medium text-muted-foreground">Pontos Finais:</span> {(selected as any).final_points?.toFixed(4)}</div>
              <hr />
              <div><span className="font-medium text-muted-foreground">Data Base:</span> {(selected as any).base_date}</div>
              <div><span className="font-medium text-muted-foreground">Limite Aplicavel:</span> {(selected as any).applicable_limit}</div>
              <div><span className="font-medium text-muted-foreground">Data Preferencial:</span> {(selected as any).preferred_date ?? "—"}</div>
              <div><span className="font-medium text-muted-foreground">Data Final:</span> {(selected as any).final_date}</div>
              <hr />
              <div><span className="font-medium text-muted-foreground">Executor:</span> {(selected as any).executor_id || "—"}</div>
              <div><span className="font-medium text-muted-foreground">Preferencia Aplicada:</span> {(selected as any).preference_applied ? "Sim" : "Nao"}</div>
              <div><span className="font-medium text-muted-foreground">Write-back:</span> {(selected as any).writeback_pending ? <Badge variant="outline">Pendente</Badge> : <Badge className="bg-green-100 text-green-700 text-xs">OK</Badge>}</div>
              <hr />
              <div><span className="font-medium text-muted-foreground">Alertas:</span></div>
              {((selected as any).alerts ?? []).length > 0 ? (selected as any).alerts.map((a: string) => <Badge key={a} variant="outline" className="mr-1">{a}</Badge>) : <span className="text-muted-foreground">Nenhum</span>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
