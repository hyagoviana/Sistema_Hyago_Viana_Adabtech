import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, UserPlus, RefreshCw, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { usePendingExceptions, useResolveException } from "@/hooks/useDistribuicaoDashboard";
import { useExecutorMappings } from "@/hooks/useDistribuicao";

export const Route = createFileRoute("/controladoria/distribuicao/excecoes")({
  component: ExcecoesPage,
});

const ALERT_COLORS: Record<string, string> = {
  "ALT-DATA-001": "bg-red-100 text-red-700", "ALT-PRAZO-002": "bg-red-100 text-red-700",
  "ALT-CAD-001": "bg-orange-100 text-orange-700", "ALT-RESP-001": "bg-orange-100 text-orange-700",
  "ALT-RESP-002": "bg-orange-100 text-orange-700",
};

function ExcecoesPage() {
  const { toast } = useToast();
  const { data: exceptions, isLoading } = usePendingExceptions();
  const { data: executors } = useExecutorMappings();
  const resolve = useResolveException();

  const [action, setAction] = useState<{ type: "assign" | "ignore"; exception: any } | null>(null);
  const [selectedExecutor, setSelectedExecutor] = useState("");
  const [reason, setReason] = useState("");

  async function handleAssign() {
    if (!selectedExecutor || !action) return;
    try {
      await resolve.mutateAsync({ id: action.exception.id, status: "manually_assigned", manual_executor_id: selectedExecutor, override_reason: reason });
      toast({ title: "Excecao resolvida", description: "Tarefa atribuida manualmente" });
      setAction(null); setSelectedExecutor(""); setReason("");
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  async function handleIgnore() {
    if (!reason || !action) { toast({ title: "Justificativa obrigatoria", variant: "destructive" }); return; }
    try {
      await resolve.mutateAsync({ id: action.exception.id, status: "ignored", ignore_reason: reason });
      toast({ title: "Excecao ignorada" });
      setAction(null); setReason("");
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  async function handleReprocess(exc: any) {
    try {
      await resolve.mutateAsync({ id: exc.id, status: "reprocess" });
      toast({ title: "Marcada para reprocessamento" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb items={[{ label: "Controladoria", href: "/controladoria" }, { label: "Distribuicao", href: "/controladoria/distribuicao" }, { label: "Excecoes" }]} />
      <PageHeader title="Tratamento de Excecoes" subtitle="Tarefas bloqueadas que requerem acao manual" icon={<AlertTriangle className="h-6 w-6 text-amber-500" />} />

      {isLoading ? <Skeleton className="h-[300px]" /> : (exceptions ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma excecao pendente</CardContent></Card>
      ) : (
        <Card><CardContent className="pt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2">Tarefa</th><th className="text-left py-2">Processo</th><th className="text-center py-2">Alerta</th><th className="text-left py-2">Data Fatal</th><th className="text-center py-2">Dias</th><th className="text-center py-2">Acoes</th></tr></thead>
            <tbody>{(exceptions ?? []).map((exc: any) => {
              const result = exc.system_distribution_results;
              const fatalDate = result?.final_date;
              const today = new Date();
              const fatal = fatalDate ? new Date(fatalDate) : null;
              const daysLeft = fatal ? Math.ceil((fatal.getTime() - today.getTime()) / 86400000) : null;
              return (
                <tr key={exc.id} className="border-b hover:bg-accent/50">
                  <td className="py-2 font-mono text-xs">{exc.task_id}</td>
                  <td className="py-2 text-xs">{result?.process_id ?? "—"}</td>
                  <td className="py-2 text-center"><Badge className={`text-xs ${ALERT_COLORS[exc.alert_code] ?? "bg-gray-100"}`}>{exc.alert_code}</Badge></td>
                  <td className="py-2">{fatalDate ?? "—"}</td>
                  <td className="py-2 text-center">{daysLeft !== null ? <span className={daysLeft <= 2 ? "text-destructive font-bold" : ""}>{daysLeft}d</span> : "—"}</td>
                  <td className="py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setAction({ type: "assign", exception: exc }); setSelectedExecutor(""); setReason(""); }}><UserPlus className="h-3 w-3 mr-1" />Atribuir</Button>
                      <Button variant="outline" size="sm" onClick={() => handleReprocess(exc)}><RefreshCw className="h-3 w-3 mr-1" />Reproc</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setAction({ type: "ignore", exception: exc }); setReason(""); }}><Ban className="h-3 w-3 mr-1" />Ignorar</Button>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </CardContent></Card>
      )}

      {/* Dialog atribuir/ignorar */}
      <Dialog open={!!action} onOpenChange={() => setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{action?.type === "assign" ? "Atribuir Manualmente" : "Ignorar Excecao"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm"><strong>Tarefa:</strong> {action?.exception?.task_id} | <strong>Alerta:</strong> {action?.exception?.alert_code}</div>
            {action?.type === "assign" && (
              <div>
                <Label>Executor</Label>
                <Select value={selectedExecutor} onValueChange={setSelectedExecutor}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{(executors ?? []).filter((e: any) => e.active).map((e: any) => <SelectItem key={e.executor_id} value={e.executor_id}>{(e as any).system_users?.full_name ?? e.executor_id}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>{action?.type === "assign" ? "Justificativa (opcional)" : "Justificativa (obrigatoria)"}</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo da acao..." /></div>
            <Button className="w-full" onClick={action?.type === "assign" ? handleAssign : handleIgnore} disabled={resolve.isPending}>{resolve.isPending ? "Processando..." : action?.type === "assign" ? "Confirmar Atribuicao" : "Confirmar Ignorar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
