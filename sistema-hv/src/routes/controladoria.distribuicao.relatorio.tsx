import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { FileText, Download, Rocket, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { supabase } from "@/lib/supabase/browser";

export const Route = createFileRoute("/controladoria/distribuicao/relatorio")({
  component: RelatorioPage,
});

const ORG_ID = "00000000-0000-0000-0000-000000000001";

function RelatorioPage() {
  const qc = useQueryClient();

  const thirtyDaysAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; }, []);
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [observations, setObservations] = useState("");
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [sections, setSections] = useState({
    resumo: true, concordancia: true, carga: true, alertas: true, recomendacao: true,
  });

  // Buscar dados de simulacao do periodo
  const { data: simData, isLoading } = useQuery({
    queryKey: ["simulation-report", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_simulations")
        .select("*")
        .gte("distribution_date", startDate)
        .lte("distribution_date", endDate)
        .eq("organization_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });

  // Buscar dados reais
  const { data: realData } = useQuery({
    queryKey: ["real-report", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_results")
        .select("task_id, executor_id, final_points, distribution_date")
        .gte("distribution_date", startDate)
        .lte("distribution_date", endDate)
        .eq("organization_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });

  const simDays = useMemo(() => new Set((simData ?? []).map(s => s.distribution_date)).size, [simData]);
  const totalSim = (simData ?? []).length;
  const blockedSim = (simData ?? []).filter(s => s.blocked).length;

  // Concordancia
  const concordance = useMemo(() => {
    if (!realData?.length || !simData?.length) return null;
    const realMap = new Map<string, string>();
    for (const r of realData) realMap.set(`${r.task_id}-${r.distribution_date}`, r.executor_id);
    let matches = 0; let total = 0;
    for (const s of simData) {
      const key = `${s.task_id}-${s.distribution_date}`;
      const realExec = realMap.get(key);
      if (realExec) { total++; if (realExec === s.executor_id) matches++; }
    }
    return total > 0 ? Math.round(matches / total * 100) : null;
  }, [simData, realData]);

  const canGenerate = simDays >= 5;

  // Ativar Motor
  const activate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("system_distribution_config")
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq("organization_id", ORG_ID);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Motor ativado em producao!");
      qc.invalidateQueries({ queryKey: ["distribution-config"] });
      setActivateDialogOpen(false);
    },
    onError: () => toast.error("Erro ao ativar"),
  });

  function toggleSection(key: keyof typeof sections) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function exportCSV() {
    const header = "Task ID;Processo;Data;Motor Executor;Motor Pontos;Motor Fluxo;Motor Data Final;Bloqueada;Alertas\n";
    const rows = (simData ?? []).map(s =>
      `${s.task_id};${s.process_id};${s.distribution_date};${s.executor_id ?? ""};${s.final_points};${s.flow};${s.final_date};${s.blocked};${(s.alerts ?? []).join(",")}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `relatorio_simulacao_${startDate}_${endDate}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function generatePDFText() {
    // Gera texto formatado para copiar/imprimir (PDF via browser print)
    const content = [
      `RELATORIO DE VALIDACAO — MOTOR DE DISTRIBUICAO v1.0`,
      `Hyago Viana Advocacia`,
      `Periodo: ${startDate} a ${endDate}`,
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      ``,
      sections.resumo ? [
        `== RESUMO EXECUTIVO ==`,
        `Total de tarefas simuladas: ${totalSim}`,
        `Tarefas bloqueadas: ${blockedSim}`,
        `Dias de simulacao: ${simDays}`,
        concordance !== null ? `Taxa de concordancia com real: ${concordance}%` : `Dados reais nao disponiveis para comparacao`,
        ``,
      ].join("\n") : "",
      sections.carga ? [
        `== ANALISE DE CARGA ==`,
        `Total pontos distribuidos: ${(simData ?? []).reduce((s, r) => s + (r.blocked ? 0 : r.final_points), 0).toFixed(2)}`,
        ``,
      ].join("\n") : "",
      sections.alertas ? [
        `== ALERTAS ==`,
        ...Object.entries((simData ?? []).reduce((acc: Record<string, number>, s) => {
          for (const a of s.alerts ?? []) acc[a] = (acc[a] ?? 0) + 1;
          return acc;
        }, {})).map(([code, count]) => `  ${code}: ${count}`),
        ``,
      ].join("\n") : "",
      sections.recomendacao && observations ? [
        `== OBSERVACOES DO CONTROLADOR ==`,
        observations,
        ``,
      ].join("\n") : "",
    ].filter(Boolean).join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `relatorio_validacao_${startDate}_${endDate}.txt`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb items={[{ label: "Controladoria", href: "/controladoria" }, { label: "Distribuicao", href: "/controladoria/distribuicao" }, { label: "Relatorio" }]} />
      <PageHeader title="Relatorio de Validacao" subtitle="Aprovacao para Go-Live do Motor" icon={<FileText className="h-6 w-6" />} />

      {/* Config do relatorio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Periodo e Secoes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-center">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-3 py-1.5 text-sm" />
              <span className="text-muted-foreground">a</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-3 py-1.5 text-sm" />
            </div>
            <div className="space-y-2">
              {(Object.entries(sections) as [keyof typeof sections, boolean][]).map(([key, checked]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={() => toggleSection(key)} />
                  {{ resumo: "Resumo Executivo", concordancia: "Metricas de Concordancia", carga: "Analise de Carga", alertas: "Alertas e Excecoes", recomendacao: "Observacoes" }[key]}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Resumo do Periodo</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[120px]" /> : (
              <div className="space-y-2 text-sm">
                <div>Dias de simulacao: <strong>{simDays}</strong> {simDays < 5 && <Badge variant="destructive" className="text-xs ml-2">Minimo 5 dias</Badge>}</div>
                <div>Total tarefas: <strong>{totalSim}</strong></div>
                <div>Bloqueadas: <strong>{blockedSim}</strong></div>
                <div>Concordancia: <strong>{concordance !== null ? `${concordance}%` : "N/A"}</strong></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Observacoes */}
      {sections.recomendacao && (
        <Card>
          <CardHeader><CardTitle className="text-base">Observacoes do Controlador</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Insira observacoes, recomendacoes ou ressalvas antes de gerar o relatorio..." rows={4} />
          </CardContent>
        </Card>
      )}

      {/* Acoes */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={generatePDFText} disabled={!canGenerate}><Download className="h-4 w-4 mr-1" /> Gerar Relatorio (TXT)</Button>
        <Button variant="outline" onClick={exportCSV} disabled={!totalSim}><Download className="h-4 w-4 mr-1" /> Exportar CSV</Button>
        <div className="ml-auto">
          <Button variant="destructive" onClick={() => setActivateDialogOpen(true)} disabled={!canGenerate}>
            <Rocket className="h-4 w-4 mr-1" /> Ativar Motor em Producao
          </Button>
        </div>
      </div>

      {!canGenerate && <p className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Necessarios pelo menos 5 dias de simulacao para gerar o relatorio.</p>}

      {/* Dialog de ativacao */}
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ativar Motor em Producao</DialogTitle>
            <DialogDescription>Esta acao ativa o Motor de Distribuicao em producao. A distribuicao manual deixara de ser necessaria. O proximo batch sera executado automaticamente no horario configurado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm"><strong>Atencao:</strong> Certifique-se de que o periodo de simulacao foi validado e aprovado pelo Dr. Hyago antes de ativar.</div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => activate.mutate()} disabled={activate.isPending}>{activate.isPending ? "Ativando..." : "Confirmar Ativacao"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
