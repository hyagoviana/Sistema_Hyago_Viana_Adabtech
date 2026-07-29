import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { Settings, Play, FlaskConical, Clock, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { useDistributionConfig, useUpdateDistributionConfig, useLastBatchLog, useAlertsSummary30d } from "@/hooks/useDistribuicao";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const supabase = getSupabaseBrowserClient();

export const Route = createFileRoute("/controladoria/distribuicao/configuracao")({
  component: ConfiguracaoPage,
});

function ConfiguracaoPage() {
  const { data: config, isLoading: configLoading } = useDistributionConfig();
  const { data: lastBatch, isLoading: batchLoading } = useLastBatchLog();
  const { data: alertsSummary } = useAlertsSummary30d();
  const updateConfig = useUpdateDistributionConfig();

  const [mode, setMode] = useState<string>("HIGH_PRODUCTION");
  const [batchHour, setBatchHour] = useState("6");
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (config) { setMode(config.mode); setBatchHour(String(config.batch_hour)); }
  }, [config]);

  // Auto-save com debounce
  const debouncedSave = useCallback((field: string, value: unknown) => {
    const timer = setTimeout(() => {
      updateConfig.mutate({ [field]: value }, {
        onSuccess: () => toast.success("Configuracao salva"),
        onError: () => toast.error("Erro ao salvar"),
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [updateConfig]);

  function handleModeChange(newMode: string) {
    setMode(newMode);
    debouncedSave("mode", newMode);
  }

  async function executeBatch(simulate: boolean) {
    setExecuting(true); setExecutionResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/projuris-sync`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ simulate, manual: true }),
      });
      const result = await response.json();
      setExecutionResult(result);
      toast.success(simulate ? "Simulacao concluida" : "Batch executado");
    } catch (error) {
      toast.error("Erro na execucao");
    } finally { setExecuting(false); }
  }

  const statusColors: Record<string, string> = { completed: "bg-green-100 text-green-700", failed: "bg-red-100 text-red-700", running: "bg-blue-100 text-blue-700" };
  const StatusIcon = lastBatch?.status === "completed" ? CheckCircle : lastBatch?.status === "failed" ? XCircle : Clock;

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Modo de Operacao */}
        <Card>
          <CardHeader><CardTitle className="text-base">Modo de Operacao</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {configLoading ? <Skeleton className="h-[100px]" /> : <>
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === "HIGH_PRODUCTION" ? "border-primary bg-primary/5" : "hover:bg-accent"}`} onClick={() => handleModeChange("HIGH_PRODUCTION")}>
                <input type="radio" checked={mode === "HIGH_PRODUCTION"} readOnly className="mt-1" />
                <div><div className="font-medium">High Production</div><div className="text-sm text-muted-foreground">Prioriza volume. Seg 95%, Ter-Qui 100%, Sex 90%.</div></div>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === "HIGH_CONTROL" ? "border-primary bg-primary/5" : "hover:bg-accent"}`} onClick={() => handleModeChange("HIGH_CONTROL")}>
                <input type="radio" checked={mode === "HIGH_CONTROL"} readOnly className="mt-1" />
                <div><div className="font-medium">High Control</div><div className="text-sm text-muted-foreground">Prioriza controle. Seg 90%, Ter-Qui 100%, Sex 80%.</div></div>
              </label>
            </>}
          </CardContent>
        </Card>

        {/* Horario e Acoes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Batch Diario</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Horario (BRT)</Label>
              <Input type="number" min="0" max="23" value={batchHour} onChange={e => setBatchHour(e.target.value)} className="w-24" />
              <p className="text-xs text-muted-foreground mt-1">Proxima execucao: proximo dia util as {batchHour}:00</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => executeBatch(false)} disabled={executing}>{executing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Executar Agora</Button>
              <Button variant="outline" onClick={() => executeBatch(true)} disabled={executing}><FlaskConical className="h-4 w-4 mr-1" /> Simular</Button>
            </div>
            {executionResult && (
              <div className="text-sm p-3 bg-muted rounded">
                <p><strong>Status:</strong> {(executionResult as any).status}</p>
                <p><strong>Tarefas:</strong> {(executionResult as any).total_tasks ?? 0} | Sucesso: {(executionResult as any).successful ?? 0} | Falhas: {(executionResult as any).failed ?? 0}</p>
                <p><strong>Duracao:</strong> {(executionResult as any).duration_ms ?? 0}ms</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ultimo Batch */}
        <Card>
          <CardHeader><CardTitle className="text-base">Ultimo Batch</CardTitle></CardHeader>
          <CardContent>
            {batchLoading ? <Skeleton className="h-[80px]" /> : lastBatch ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><StatusIcon className="h-4 w-4" /><Badge className={statusColors[lastBatch.status]}>{lastBatch.status}</Badge><span className="text-muted-foreground">{lastBatch.batch_date}</span></div>
                <div>Total: {lastBatch.total_tasks} | Sucesso: {lastBatch.successful} | Falhas: {lastBatch.failed}</div>
                {lastBatch.error_message && <div className="text-destructive text-xs">{lastBatch.error_message}</div>}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhum batch executado ainda.</p>}
          </CardContent>
        </Card>

        {/* Alertas 30 dias */}
        <Card>
          <CardHeader><CardTitle className="text-base">Alertas (30 dias)</CardTitle></CardHeader>
          <CardContent>
            {alertsSummary && Object.keys(alertsSummary).length > 0 ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-1">Alerta</th><th className="text-right py-1">Qtd</th></tr></thead>
                <tbody>{Object.entries(alertsSummary).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
                  <tr key={code} className="border-b"><td className="py-1"><Badge variant="outline" className="text-xs">{code}</Badge></td><td className="py-1 text-right font-medium">{count}</td></tr>
                ))}</tbody>
              </table>
            ) : <p className="text-sm text-muted-foreground">Nenhum alerta nos ultimos 30 dias.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
