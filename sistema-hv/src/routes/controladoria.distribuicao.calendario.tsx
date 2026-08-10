import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Calendar, Plus, Trash2, Users, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useCalendarBlocks,
  useCalendarBlocksYear,
  useAddCalendarBlock,
  useRemoveCalendarBlock,
  useExecutorMappings,
  useDistributionTasksByDay,
} from "@/hooks/useDistribuicao";
import { usePodeEditar } from "@/hooks/usePermissions";

export const Route = createFileRoute("/controladoria/distribuicao/calendario")({
  component: CalendarioPage,
});

const FLOW_COLORS: Record<string, string> = {
  ABSOLUTE: "bg-purple-100 text-purple-700",
  COMPLEX: "bg-amber-100 text-amber-700",
  GENERAL: "bg-blue-100 text-blue-700",
};

function CalendarioPage() {
  const podeEditar = usePodeEditar("controladoria");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [view, setView] = useState<"month" | "year">("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  // Dia selecionado → abre o painel de tarefas do dia (RBAC no servidor).
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const { data: dayTasks, isLoading: dayLoading } = useDistributionTasksByDay(selectedDay);

  const { data: blocks, isLoading } = useCalendarBlocks(year, month);
  const { data: yearBlocks } = useCalendarBlocksYear(year);
  const { data: executors } = useExecutorMappings();
  const addBlock = useAddCalendarBlock();
  const removeBlock = useRemoveCalendarBlock();

  // Form state
  const [blockType, setBlockType] = useState<"general" | "individual">("general");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [executorId, setExecutorId] = useState("");

  const generalBlocks = useMemo(
    () => new Set((blocks ?? []).filter((b) => b.block_type === "general").map((b) => b.date)),
    [blocks],
  );
  const individualBlocks = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of (blocks ?? []).filter((b) => b.block_type === "individual")) {
      const existing = map.get(b.date) ?? [];
      if (b.executor_id) existing.push(b.executor_id);
      map.set(b.date, existing);
    }
    return map;
  }, [blocks]);

  // De-para executor_id (UUID = system_users.id) → nome, p/ a visão Ano.
  const execNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of (executors ?? []) as Array<{
      executor_id: string;
      system_users?: { full_name?: string | null } | null;
    }>) {
      if (e.executor_id && e.system_users?.full_name)
        m.set(e.executor_id, e.system_users.full_name);
    }
    return m;
  }, [executors]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  async function handleAddBlock() {
    if (!startDate) return;
    const end = endDate || startDate;
    const dates: Array<{
      date: string;
      block_type: string;
      executor_id?: string;
      reason?: string;
    }> = [];
    const current = new Date(startDate);
    const endDt = new Date(end);
    while (current <= endDt) {
      const iso = current.toISOString().split("T")[0];
      dates.push({
        date: iso,
        block_type: blockType,
        ...(blockType === "individual" ? { executor_id: executorId } : {}),
        reason: reason || undefined,
      });
      current.setDate(current.getDate() + 1);
    }
    try {
      await addBlock.mutateAsync(dates);
      toast.success("Bloqueio adicionado");
      setDialogOpen(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      setExecutorId("");
    } catch {
      toast.error("Erro ao adicionar bloqueio");
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeBlock.mutateAsync(id);
      toast.success("Bloqueio removido");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  const monthNames = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (month === 1) {
                setMonth(12);
                setYear((y) => y - 1);
              } else setMonth((m) => m - 1);
            }}
          >
            ←
          </Button>
          <span className="font-medium min-w-[120px] text-center">
            {monthNames[month - 1]} {year}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (month === 12) {
                setMonth(1);
                setYear((y) => y + 1);
              } else setMonth((m) => m + 1);
            }}
          >
            →
          </Button>
        </div>
        <Button
          variant={view === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("month")}
        >
          Mes
        </Button>
        <Button
          variant={view === "year" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("year")}
        >
          Ano
        </Button>
        <div className="ml-auto">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {podeEditar && (
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Bloqueio
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Bloqueio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={blockType}
                    onValueChange={(v) => setBlockType(v as "general" | "individual")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Geral (feriado/recesso)</SelectItem>
                      <SelectItem value="individual">Individual (ferias/licenca)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {blockType === "individual" && (
                  <div>
                    <Label>Executor</Label>
                    <Select value={executorId} onValueChange={setExecutorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(executors ?? [])
                          .filter((e) => e.active)
                          .map((e) => (
                            <SelectItem key={e.id} value={e.executor_id}>
                              {(e as { system_users?: { full_name?: string | null } | null })
                                .system_users?.full_name ?? e.executor_id}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Data Inicio</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Motivo</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex: Natal, Ferias Dr. Silva..."
                  />
                </div>
                <Button className="w-full" onClick={handleAddBlock} disabled={addBlock.isPending}>
                  {addBlock.isPending ? "Salvando..." : "Adicionar Bloqueio"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[300px]" />
      ) : view === "month" ? (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {dayNames.map((d) => (
                <div key={d} className="font-medium text-muted-foreground py-1">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDayOfWeek }, (_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isGeneral = generalBlocks.has(iso);
                const indivExecs = individualBlocks.get(iso);
                const dow = new Date(year, month - 1, day).getDay();
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(iso)}
                    className={`p-2 rounded text-sm relative cursor-pointer transition-colors min-h-[38px] ${isGeneral ? "bg-red-100 text-red-800 dark:bg-red-900/30" : isWeekend ? "bg-muted text-muted-foreground hover:bg-muted/80" : "hover:bg-accent"}`}
                    title={
                      isGeneral
                        ? "Bloqueio geral — clique para ver as tarefas do dia"
                        : indivExecs
                          ? `Bloqueados: ${indivExecs.length} — clique para ver as tarefas do dia`
                          : "Clique para ver as tarefas do dia"
                    }
                  >
                    {day}
                    {indivExecs && (
                      <Users className="h-3 w-3 absolute top-0.5 right-0.5 text-amber-500" />
                    )}
                    {isGeneral && (
                      <Ban className="h-3 w-3 absolute top-0.5 right-0.5 text-red-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Bloqueios {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Data</th>
                  <th className="text-left py-2">Tipo</th>
                  <th className="text-left py-2">Executor</th>
                  <th className="text-left py-2">Motivo</th>
                  <th className="py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(yearBlocks ?? []).map((b) => (
                  <tr key={b.id} className="border-b">
                    <td className="py-2">{b.date}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${b.block_type === "general" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {b.block_type === "general" ? "Geral" : "Individual"}
                      </span>
                    </td>
                    <td className="py-2">
                      {b.executor_id ? (execNameById.get(b.executor_id) ?? b.executor_id) : "·"}
                    </td>
                    <td className="py-2">{b.reason ?? "·"}</td>
                    <td className="py-2 text-center">
                      {podeEditar && (
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(b.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Tarefas do dia (clique num dia). RBAC no servidor: admin vê de todos,
          demais só as próprias. */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Tarefas de{" "}
              {selectedDay ? selectedDay.split("-").reverse().join("/") : ""}
            </DialogTitle>
          </DialogHeader>
          {dayLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (dayTasks ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma tarefa distribuída para este dia.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Processo</th>
                    <th className="py-2">Número do processo</th>
                    <th className="py-2">Tipo</th>
                    <th className="py-2">Executor</th>
                    <th className="py-2 text-center">Fluxo</th>
                  </tr>
                </thead>
                <tbody>
                  {(dayTasks ?? []).map((t) => (
                    <tr key={t.id} className="border-b hover:bg-accent/50">
                      <td className="py-2 pr-2">{t.nome_processo || t.numero_processo || "·"}</td>
                      <td className="py-2 pr-2 font-mono text-[11px]">
                        {t.numero_processo || "·"}
                      </td>
                      <td className="py-2 pr-2 text-xs">{t.tipo_nome || "·"}</td>
                      <td className="py-2 pr-2 text-xs">{t.executor_nome || "·"}</td>
                      <td className="py-2 text-center">
                        <Badge className={`text-xs ${FLOW_COLORS[t.flow] ?? ""}`}>{t.flow}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
