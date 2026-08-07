import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  UserCog,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDistributionResults } from "@/hooks/useDistribuicaoDashboard";
import {
  useExecutorMappings,
  useTaskTypeMappings,
  useDistributionApprovals,
  useAprovarTarefa,
  useRejeitarTarefa,
  useEditarExecutor,
  useAprovarBatch,
  usePreviewWriteback,
  useEfetivarWriteback,
  type DistributionApprovalRow,
  type WritebackSummary,
} from "@/hooks/useDistribuicao";
import { usePodeEditar } from "@/hooks/usePermissions";
import { deriveRuleLabel } from "@/lib/distribuicao/rule-label";

export const Route = createFileRoute("/controladoria/distribuicao/lista")({
  component: ListaDistribuicoesPage,
});

const FLOW_COLORS: Record<string, string> = {
  ABSOLUTE: "bg-purple-100 text-purple-700",
  COMPLEX: "bg-amber-100 text-amber-700",
  GENERAL: "bg-blue-100 text-blue-700",
};

type ResultRaw = {
  numero_processo?: string | null;
  tipo_codigo?: string | null;
  tipo_nome?: string | null;
} | null;

type ResultRow = {
  id: string;
  task_id: string;
  process_id: string;
  executor_id: string | null;
  flow: string;
  base_date?: string | null;
  applicable_limit?: string | null;
  preferred_date?: string | null;
  final_date?: string | null;
  final_points?: number | null;
  preference_applied?: boolean | null;
  writeback_pending?: boolean | null;
  blocked?: boolean | null;
  alerts?: string[] | null;
  raw_data?: ResultRaw;
  [k: string]: unknown;
};

type ExecutorMappingRow = {
  executor_id: string;
  active: boolean;
  system_users?: { full_name?: string | null } | null;
};

type TaskTypeMappingRow = {
  projuris_tipo_codigo: string;
  projuris_tipo_descricao: string | null;
};

type ApprovalStatus = "pending" | "approved" | "rejected";

function ApprovalStatusBadge({ status, blocked }: { status: ApprovalStatus; blocked?: boolean }) {
  if (blocked) {
    return (
      <Badge variant="destructive" className="text-xs">
        Bloqueada
      </Badge>
    );
  }
  if (status === "approved") {
    return <Badge className="bg-green-100 text-green-700 text-xs">Aprovada</Badge>;
  }
  if (status === "rejected") {
    return (
      <Badge variant="outline" className="text-xs text-red-600 border-red-300">
        Rejeitada
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
      Pendente
    </Badge>
  );
}

function ListaDistribuicoesPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [executor, setExecutor] = useState("");
  const [flowFilter, setFlowFilter] = useState<string[]>([]);
  const [hasAlerts, setHasAlerts] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ResultRow | null>(null);

  // H2: estado de aprovacao.
  const podeEditar = usePodeEditar("controladoria");
  const [editing, setEditing] = useState<ResultRow | null>(null);
  const [editExecutorId, setEditExecutorId] = useState<string>("");
  const [rejecting, setRejecting] = useState<ResultRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [batchConfirm, setBatchConfirm] = useState<null | "approve" | "reject">(null);

  // H3: write-back ao ProJuris (dry-run preview + efetivação irreversível).
  const [writebackOpen, setWritebackOpen] = useState(false);
  const [writebackPreview, setWritebackPreview] = useState<WritebackSummary | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const previewWriteback = usePreviewWriteback();
  const efetivarWriteback = useEfetivarWriteback();

  const { data: executors } = useExecutorMappings();
  const { data: taskTypes } = useTaskTypeMappings();
  const { data: resultsData, isLoading } = useDistributionResults(date, {
    executor: executor || undefined,
    flow: flowFilter.length ? flowFilter : undefined,
    hasAlerts,
    page,
  });
  const { data: approvalsByResultId } = useDistributionApprovals(date);

  const aprovar = useAprovarTarefa();
  const rejeitar = useRejeitarTarefa();
  const editarExecutor = useEditarExecutor();
  const aprovarBatch = useAprovarBatch();

  const results = (resultsData?.data ?? []) as ResultRow[];
  const totalCount = resultsData?.count ?? 0;

  function approvalOf(r: ResultRow): DistributionApprovalRow | undefined {
    return approvalsByResultId?.[r.id];
  }
  function statusOf(r: ResultRow): ApprovalStatus {
    return approvalOf(r)?.status ?? "pending";
  }

  const mutating =
    aprovar.isPending || rejeitar.isPending || editarExecutor.isPending || aprovarBatch.isPending;

  // ── De-para código → NOME (H1). Resolvido do BANCO (mappings + raw_data),
  // sem chamar o ProJuris. Fallback marca o código como "não sincronizado".
  const executorNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of (executors ?? []) as ExecutorMappingRow[]) {
      const name = e.system_users?.full_name;
      if (e.executor_id && name) m.set(e.executor_id, name);
    }
    return m;
  }, [executors]);

  const tipoDescByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of (taskTypes ?? []) as TaskTypeMappingRow[]) {
      if (t.projuris_tipo_codigo && t.projuris_tipo_descricao) {
        m.set(String(t.projuris_tipo_codigo), t.projuris_tipo_descricao);
      }
    }
    return m;
  }, [taskTypes]);

  function resolveExecutor(r: ResultRow): string {
    if (!r?.executor_id) return "·";
    return (
      executorNameById.get(r.executor_id) ??
      `(cód. ${String(r.executor_id).slice(0, 8)} · não sincronizado)`
    );
  }

  function resolveTipo(r: ResultRow): string {
    const rd = (r?.raw_data ?? {}) as NonNullable<ResultRaw>;
    if (rd.tipo_nome) return rd.tipo_nome;
    if (rd.tipo_codigo) {
      const desc = tipoDescByCode.get(String(rd.tipo_codigo));
      return desc ?? `(cód. ${rd.tipo_codigo} · não sincronizado)`;
    }
    return "·";
  }

  function resolveProcesso(r: ResultRow): string {
    const rd = (r?.raw_data ?? {}) as NonNullable<ResultRaw>;
    return rd.numero_processo || r?.process_id || "·";
  }

  function toggleFlow(f: string) {
    setFlowFilter((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
    setPage(0);
  }

  function exportCSV() {
    const csvEscape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const header = "Task ID;Processo;Executor;Tipo;Fluxo;Data Final;Pontos;Alertas;Status\n";
    const rows = results
      .map((r) =>
        [
          r.task_id,
          resolveProcesso(r),
          resolveExecutor(r),
          resolveTipo(r),
          r.flow,
          r.final_date,
          r.final_points,
          (r.alerts ?? []).join(","),
          r.blocked ? "Bloqueada" : "OK",
        ]
          .map((c) => csvEscape(String(c ?? "")))
          .join(";"),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distribuicoes_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── H2: acoes de aprovacao ────────────────────────────────────────────────
  function openEdit(r: ResultRow) {
    setEditing(r);
    setEditExecutorId(r.executor_id ?? "");
  }
  function openReject(r: ResultRow) {
    setRejecting(r);
    setRejectReason("");
  }
  function confirmEdit() {
    if (!editing || !editExecutorId) return;
    editarExecutor.mutate(
      { resultId: editing.id, overrideExecutorId: editExecutorId },
      { onSuccess: () => setEditing(null) },
    );
  }
  function confirmReject() {
    if (!rejecting) return;
    rejeitar.mutate(
      { resultId: rejecting.id, reason: rejectReason || undefined },
      { onSuccess: () => setRejecting(null) },
    );
  }
  function confirmBatch() {
    if (!batchConfirm) return;
    aprovarBatch.mutate(
      { distributionDate: date, action: batchConfirm },
      { onSuccess: () => setBatchConfirm(null) },
    );
  }

  // ── H3: write-back ao ProJuris ────────────────────────────────────────────
  function openWriteback() {
    setConfirmText("");
    setWritebackPreview(null);
    setWritebackOpen(true);
    // Dispara o dry-run ao abrir (nunca escreve no ProJuris).
    previewWriteback.mutate(date, {
      onSuccess: (s) => setWritebackPreview(s as WritebackSummary),
    });
  }
  function confirmEfetivar() {
    efetivarWriteback.mutate(
      { distributionDate: date, confirmText },
      {
        onSuccess: (s) => {
          setWritebackPreview(s as WritebackSummary);
          setConfirmText("");
        },
      },
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 p-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(0);
            }}
            className="border rounded px-3 py-1.5 text-sm"
          />
          <Select
            value={executor}
            onValueChange={(v) => {
              setExecutor(v === "all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Executor..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {((executors ?? []) as ExecutorMappingRow[])
                .filter((e) => e.active)
                .map((e) => (
                  <SelectItem key={e.executor_id} value={e.executor_id}>
                    {e.system_users?.full_name ?? e.executor_id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm">
            {["ABSOLUTE", "COMPLEX", "GENERAL"].map((f) => (
              <label key={f} className="flex items-center gap-1 cursor-pointer">
                <Checkbox checked={flowFilter.includes(f)} onCheckedChange={() => toggleFlow(f)} />
                {f}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-1 text-sm cursor-pointer">
            <Checkbox
              checked={hasAlerts}
              onCheckedChange={() => {
                setHasAlerts(!hasAlerts);
                setPage(0);
              }}
            />
            Com alertas
          </label>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          {podeEditar && (
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                disabled={mutating || totalCount === 0}
                onClick={() => setBatchConfirm("approve")}
              >
                <Check className="h-4 w-4 mr-1" /> Aprovar todas
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={mutating || totalCount === 0}
                onClick={() => setBatchConfirm("reject")}
              >
                <X className="h-4 w-4 mr-1" /> Rejeitar todas
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={mutating || totalCount === 0}
                onClick={openWriteback}
                title="Efetivar no ProJuris (só tarefas aprovadas)"
              >
                <Upload className="h-4 w-4 mr-1" /> Write-back ProJuris
              </Button>
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground">{totalCount} distribuicoes encontradas</div>

        {isLoading ? (
          <Skeleton className="h-[400px]" />
        ) : (
          <Card>
            <CardContent className="pt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Tarefa</th>
                    <th className="text-left py-2">Processo</th>
                    <th className="text-left py-2">Executor</th>
                    <th className="text-left py-2">Tipo</th>
                    <th className="text-center py-2">Fluxo</th>
                    <th className="text-left py-2">Regra aplicada</th>
                    <th className="text-left py-2">Data Final</th>
                    <th className="text-right py-2">Pontos</th>
                    <th className="text-center py-2">Alertas</th>
                    <th className="text-center py-2">Aprovação</th>
                    {podeEditar && <th className="text-center py-2">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const rule = deriveRuleLabel(r);
                    const status = statusOf(r);
                    const appr = approvalOf(r);
                    const overridden = !!appr?.override_executor_id;
                    return (
                      <tr key={r.id} className="border-b hover:bg-accent/50">
                        <td
                          className="py-2 font-mono text-xs cursor-pointer"
                          onClick={() => setSelected(r)}
                        >
                          {r.task_id}
                        </td>
                        <td className="py-2 text-xs">{resolveProcesso(r)}</td>
                        <td className="py-2 text-xs">
                          {overridden
                            ? (executorNameById.get(appr!.override_executor_id!) ??
                              resolveExecutor(r))
                            : resolveExecutor(r)}
                          {overridden && (
                            <Badge variant="outline" className="ml-1 text-[10px]">
                              editado
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 text-xs">{resolveTipo(r)}</td>
                        <td className="py-2 text-center">
                          <Badge className={`text-xs ${FLOW_COLORS[r.flow] ?? ""}`}>{r.flow}</Badge>
                        </td>
                        <td className="py-2 text-xs">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted">
                                {rule.short}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">{rule.detail}</TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="py-2">{r.final_date}</td>
                        <td className="py-2 text-right font-medium">
                          {r.final_points?.toFixed(2)}
                        </td>
                        <td className="py-2 text-center">
                          {(r.alerts?.length ?? 0) > 0 ? (
                            <Badge variant="outline" className="text-xs">
                              {r.alerts?.length}
                            </Badge>
                          ) : (
                            "·"
                          )}
                        </td>
                        <td className="py-2 text-center">
                          <ApprovalStatusBadge status={status} blocked={!!r.blocked} />
                        </td>
                        {podeEditar && (
                          <td className="py-2">
                            {r.blocked ? (
                              <span className="text-xs text-muted-foreground">·</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Aprovar"
                                  disabled={mutating}
                                  onClick={() => aprovar.mutate(r.id)}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Rejeitar"
                                  disabled={mutating}
                                  onClick={() => openReject(r)}
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Editar executor"
                                  disabled={mutating}
                                  onClick={() => openEdit(r)}
                                >
                                  <UserCog className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Paginacao */}
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground">
                  Pagina {page + 1} de {Math.ceil(totalCount / 50)}
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
                    disabled={(page + 1) * 50 >= totalCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sheet de detalhes */}
        <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Detalhes da Distribuicao</SheetTitle>
            </SheetHeader>
            {selected && (
              <div className="space-y-4 mt-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Tarefa:</span>{" "}
                  {selected.task_id}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Processo:</span>{" "}
                  {resolveProcesso(selected)}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Tipo:</span>{" "}
                  {resolveTipo(selected)}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Fluxo:</span>{" "}
                  <Badge className={FLOW_COLORS[selected.flow] ?? ""}>{selected.flow}</Badge>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Regra aplicada:</span>{" "}
                  {deriveRuleLabel(selected).short}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {deriveRuleLabel(selected).detail}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Aprovação:</span>{" "}
                  <ApprovalStatusBadge status={statusOf(selected)} blocked={!!selected.blocked} />
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Pontos Finais:</span>{" "}
                  {selected.final_points?.toFixed(4)}
                </div>
                <hr />
                <div>
                  <span className="font-medium text-muted-foreground">Data Base:</span>{" "}
                  {selected.base_date}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Limite Aplicavel:</span>{" "}
                  {selected.applicable_limit}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Data Preferencial:</span>{" "}
                  {selected.preferred_date ?? "·"}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Data Final:</span>{" "}
                  {selected.final_date}
                </div>
                <hr />
                <div>
                  <span className="font-medium text-muted-foreground">Executor:</span>{" "}
                  {resolveExecutor(selected)}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Preferencia Aplicada:</span>{" "}
                  {selected.preference_applied ? "Sim" : "Nao"}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Write-back:</span>{" "}
                  {selected.writeback_pending ? (
                    <Badge variant="outline">Pendente</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 text-xs">OK</Badge>
                  )}
                </div>
                <hr />
                <div>
                  <span className="font-medium text-muted-foreground">Alertas:</span>
                </div>
                {(selected.alerts ?? []).length > 0 ? (
                  (selected.alerts ?? []).map((a: string) => (
                    <Badge key={a} variant="outline" className="mr-1">
                      {a}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">Nenhum</span>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* H2: Editar executor (override manual) */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar executor</DialogTitle>
              <DialogDescription>
                Troca o executor sugerido pelo motor por outro elegível. A troca é registrada como
                override manual (auditável) e a tarefa fica aprovada.
              </DialogDescription>
            </DialogHeader>
            {editing && (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Sugerido pelo motor:</span>{" "}
                  {resolveExecutor(editing)}
                </div>
                <Select value={editExecutorId} onValueChange={setEditExecutorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar executor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {((executors ?? []) as ExecutorMappingRow[])
                      .filter((e) => e.active)
                      .map((e) => (
                        <SelectItem key={e.executor_id} value={e.executor_id}>
                          {e.system_users?.full_name ?? e.executor_id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {editarExecutor.isError && (
                  <p className="text-xs text-red-600">
                    {(editarExecutor.error as Error)?.message ?? "Falha ao editar executor."}
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmEdit} disabled={!editExecutorId || editarExecutor.isPending}>
                Salvar e aprovar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* H2: Rejeitar com motivo */}
        <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar tarefa</DialogTitle>
              <DialogDescription>
                A tarefa rejeitada não é efetivada nem entra no writeback ao ProJuris.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Motivo (opcional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            {rejeitar.isError && (
              <p className="text-xs text-red-600">
                {(rejeitar.error as Error)?.message ?? "Falha ao rejeitar."}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejecting(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmReject} disabled={rejeitar.isPending}>
                Rejeitar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* H2: Confirmacao de acao em massa */}
        <AlertDialog open={!!batchConfirm} onOpenChange={(o) => !o && setBatchConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {batchConfirm === "approve"
                  ? "Aprovar todas as tarefas?"
                  : "Rejeitar todas as tarefas?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação aplica o estado a todas as tarefas não bloqueadas de {date}. Tarefas
                bloqueadas são ignoradas.
                {batchConfirm === "approve"
                  ? " Só as aprovadas ficam elegíveis à efetivação (H3)."
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmBatch} disabled={aprovarBatch.isPending}>
                {batchConfirm === "approve" ? "Aprovar todas" : "Rejeitar todas"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* H3: Write-back ao ProJuris (dry-run preview + efetivação irreversível) */}
        <Dialog open={writebackOpen} onOpenChange={(o) => !o && setWritebackOpen(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" /> Write-back ao ProJuris · {date}
              </DialogTitle>
              <DialogDescription>
                Grava no ProJuris a atribuição das tarefas <strong>aprovadas</strong>. Só tarefas
                com status Aprovada (portão de aprovação) entram; rejeitadas e bloqueadas são
                ignoradas. Esta ação é <strong>irreversível</strong>.
              </DialogDescription>
            </DialogHeader>

            {previewWriteback.isPending && !writebackPreview ? (
              <div className="text-sm text-muted-foreground">Calculando plano (dry-run)…</div>
            ) : previewWriteback.isError ? (
              <p className="text-sm text-red-600">
                {(previewWriteback.error as Error)?.message ?? "Falha ao calcular o plano."}
              </p>
            ) : writebackPreview ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border p-2">
                    <div className="text-muted-foreground text-xs">Elegíveis (aprovadas)</div>
                    <div className="text-lg font-semibold">{writebackPreview.eligible}</div>
                  </div>
                  <div className="rounded border p-2">
                    <div className="text-muted-foreground text-xs">Já efetivadas</div>
                    <div className="text-lg font-semibold">{writebackPreview.alreadyDone}</div>
                  </div>
                  {writebackPreview.confirmed && (
                    <>
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground text-xs">Efetivadas agora</div>
                        <div className="text-lg font-semibold text-green-700">
                          {writebackPreview.effected}
                        </div>
                      </div>
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground text-xs">Falhas</div>
                        <div className="text-lg font-semibold text-red-600">
                          {writebackPreview.failed}
                        </div>
                      </div>
                    </>
                  )}
                  {writebackPreview.unmapped > 0 && (
                    <div className="rounded border p-2 col-span-2 border-amber-300">
                      <div className="text-amber-700 text-xs flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Sem mapeamento ProJuris
                      </div>
                      <div className="text-lg font-semibold">{writebackPreview.unmapped}</div>
                    </div>
                  )}
                </div>

                {!writebackPreview.confirmed && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    <p className="font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Pré-visualização (dry-run) · nada foi
                      gravado no ProJuris.
                    </p>
                    <p className="mt-1">
                      Para efetivar (irreversível), digite a data <strong>{date}</strong> abaixo e
                      confirme. A escrita real também depende de a infraestrutura ter o write-back
                      habilitado.
                    </p>
                  </div>
                )}

                {writebackPreview.confirmed && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-3 text-xs text-green-800">
                    Write-back efetivado. {writebackPreview.effected} tarefa(s) gravada(s) no
                    ProJuris.
                    {writebackPreview.failed > 0 &&
                      " Falhas ficaram pendentes para retry (ALT-SYNC-001)."}
                  </div>
                )}

                {efetivarWriteback.isError && (
                  <p className="text-xs text-red-600">
                    {(efetivarWriteback.error as Error)?.message ?? "Falha ao efetivar."}
                  </p>
                )}
              </div>
            ) : null}

            <DialogFooter className="flex-col sm:flex-col gap-2 items-stretch">
              {writebackPreview && !writebackPreview.confirmed && writebackPreview.eligible > 0 && (
                <div className="space-y-2">
                  <Input
                    placeholder={`Digite a data (${date}) para efetivar`}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={confirmText.trim() !== date || efetivarWriteback.isPending}
                    onClick={confirmEfetivar}
                  >
                    <Upload className="h-4 w-4 mr-1" /> Efetivar write-back (irreversível)
                  </Button>
                </div>
              )}
              <Button variant="outline" onClick={() => setWritebackOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
