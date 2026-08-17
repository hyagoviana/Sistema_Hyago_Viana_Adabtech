import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { usePendingExceptions, useResolveException } from "@/hooks/useDistribuicaoDashboard";
import { useExecutorMappings } from "@/hooks/useDistribuicao";

export const Route = createFileRoute("/controladoria/distribuicao/excecoes")({
  component: ExcecoesPage,
});

const ALERT_COLORS: Record<string, string> = {
  "ALT-DATA-001": "bg-red-100 text-red-700",
  "ALT-PRAZO-002": "bg-red-100 text-red-700",
  "ALT-CAD-001": "bg-orange-100 text-orange-700",
  "ALT-RESP-001": "bg-orange-100 text-orange-700",
  "ALT-RESP-002": "bg-orange-100 text-orange-700",
  "ALT-DUP-001": "bg-amber-100 text-amber-700",
};

// Rótulo humano por código de alerta (o duplicado é o R3).
const ALERT_LABEL: Record<string, string> = {
  "ALT-DUP-001": "Duplicado",
};

type ExcRow = {
  id: string;
  task_id: string;
  alert_code: string;
  process_id?: string | null;
  detail?: string | null;
  system_distribution_results?: { final_date?: string | null; process_id?: string | null } | null;
};

type ExecRow = {
  executor_id: string;
  active: boolean;
  system_users?: { full_name?: string | null } | null;
};

function ExcecoesPage() {
  const { data: exceptions, isLoading } = usePendingExceptions();
  const { data: executors } = useExecutorMappings();
  const resolve = useResolveException();

  const [action, setAction] = useState<{ type: "assign" | "ignore"; exception: ExcRow } | null>(
    null,
  );
  const [selectedExecutor, setSelectedExecutor] = useState("");
  const [reason, setReason] = useState("");

  async function handleAssign() {
    if (!selectedExecutor || !action) return;
    try {
      await resolve.mutateAsync({
        id: action.exception.id,
        status: "manually_assigned",
        manual_executor_id: selectedExecutor,
        override_reason: reason,
      });
      toast.success("Excecao resolvida");
      setAction(null);
      setSelectedExecutor("");
      setReason("");
    } catch {
      toast.error("Erro");
    }
  }

  async function handleIgnore() {
    if (!reason || !action) {
      toast.error("Justificativa obrigatoria");
      return;
    }
    try {
      await resolve.mutateAsync({
        id: action.exception.id,
        status: "ignored",
        ignore_reason: reason,
      });
      toast.success("Excecao ignorada");
      setAction(null);
      setReason("");
    } catch {
      toast.error("Erro");
    }
  }

  return (
    <div className="space-y-6 p-6">
      {isLoading ? (
        <Skeleton className="h-[300px]" />
      ) : (exceptions ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma excecao pendente
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Tarefa</th>
                  <th className="text-left py-2">Processo</th>
                  <th className="text-center py-2">Alerta</th>
                  <th className="text-left py-2">Data Fatal</th>
                  <th className="text-center py-2">Dias</th>
                  <th className="text-center py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {((exceptions ?? []) as ExcRow[]).map((exc) => {
                  const result = exc.system_distribution_results;
                  const fatalDate = result?.final_date;
                  const today = new Date();
                  const fatal = fatalDate ? new Date(fatalDate) : null;
                  const daysLeft = fatal
                    ? Math.ceil((fatal.getTime() - today.getTime()) / 86400000)
                    : null;
                  return (
                    <tr key={exc.id} className="border-b hover:bg-accent/50">
                      <td className="py-2 font-mono text-xs align-top">
                        {exc.task_id}
                        {exc.detail && (
                          <div className="font-sans text-[11px] text-muted-foreground mt-0.5 max-w-xs">
                            {exc.detail}
                          </div>
                        )}
                      </td>
                      <td className="py-2 text-xs align-top">
                        {exc.process_id ?? result?.process_id ?? "·"}
                      </td>
                      <td className="py-2 text-center align-top">
                        <Badge
                          className={`text-xs ${ALERT_COLORS[exc.alert_code] ?? "bg-gray-100"}`}
                        >
                          {ALERT_LABEL[exc.alert_code] ?? exc.alert_code}
                        </Badge>
                      </td>
                      <td className="py-2">{fatalDate ?? "·"}</td>
                      <td className="py-2 text-center">
                        {daysLeft !== null ? (
                          <span className={daysLeft <= 2 ? "text-destructive font-bold" : ""}>
                            {daysLeft}d
                          </span>
                        ) : (
                          "·"
                        )}
                      </td>
                      <td className="py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAction({ type: "assign", exception: exc });
                              setSelectedExecutor("");
                              setReason("");
                            }}
                          >
                            <UserPlus className="h-3 w-3 mr-1" />
                            Atribuir
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAction({ type: "ignore", exception: exc });
                              setReason("");
                            }}
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            Ignorar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Dialog atribuir/ignorar */}
      <Dialog open={!!action} onOpenChange={() => setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.type === "assign" ? "Atribuir Manualmente" : "Ignorar Excecao"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <strong>Tarefa:</strong> {action?.exception?.task_id} | <strong>Alerta:</strong>{" "}
              {action?.exception?.alert_code}
            </div>
            {action?.type === "assign" && (
              <div>
                <Label>Executor</Label>
                <Select value={selectedExecutor} onValueChange={setSelectedExecutor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {((executors ?? []) as ExecRow[])
                      .filter((e) => e.active)
                      .map((e) => (
                        <SelectItem key={e.executor_id} value={e.executor_id}>
                          {e.system_users?.full_name ?? e.executor_id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>
                {action?.type === "assign"
                  ? "Justificativa (opcional)"
                  : "Justificativa (obrigatoria)"}
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo da acao..."
              />
            </div>
            <Button
              className="w-full"
              onClick={action?.type === "assign" ? handleAssign : handleIgnore}
              disabled={resolve.isPending}
            >
              {resolve.isPending
                ? "Processando..."
                : action?.type === "assign"
                  ? "Confirmar Atribuicao"
                  : "Confirmar Ignorar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
