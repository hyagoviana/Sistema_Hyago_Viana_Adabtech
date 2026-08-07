import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Download, Search, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useTaskTypeMappings,
  useUpsertTaskTypeMapping,
  useSyncTaskTypes,
} from "@/hooks/useDistribuicao";

export const Route = createFileRoute("/controladoria/distribuicao/tipos-tarefa")({
  component: TiposTarefaPage,
});

const COMPLEXITY_LABELS: Record<number, string> = {
  0: "Regular",
  1: "Nivel 1 (+20%)",
  2: "Nivel 2 (+30%)",
};
const TEMPORAL_LABELS: Record<number, string> = {
  0: "Normal",
  1: "Prioritario (+10%)",
  2: "Urgente (+30%)",
};

function TiposTarefaPage() {
  const { data: mappings, isLoading } = useTaskTypeMappings();
  const upsert = useUpsertTaskTypeMapping();
  const syncTipos = useSyncTaskTypes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [filter, setFilter] = useState("");

  const [projurisCodigo, setProjurisCodigo] = useState("");
  const [projurisDesc, setProjurisDesc] = useState("");
  const [motorId, setMotorId] = useState("");
  const [points, setPoints] = useState("10");
  const [complexity, setComplexity] = useState("0");
  const [temporal, setTemporal] = useState("0");
  const [prazoPrevisto, setPrazoPrevisto] = useState("");
  const [prazoFatal, setPrazoFatal] = useState("");
  const [active, setActive] = useState(true);

  const filtered = (mappings ?? []).filter(
    (m) =>
      m.projuris_tipo_codigo.toLowerCase().includes(filter.toLowerCase()) ||
      m.motor_task_type_id.toLowerCase().includes(filter.toLowerCase()),
  );

  function openEdit(m: Record<string, unknown>) {
    setEditing(m);
    setProjurisCodigo(m.projuris_tipo_codigo as string);
    setProjurisDesc((m.projuris_tipo_descricao as string) ?? "");
    setMotorId(m.motor_task_type_id as string);
    setPoints(String(m.points));
    setComplexity(String(m.complexity_level));
    setTemporal(String(m.temporal_level));
    setPrazoPrevisto(m.prazo_previsto_dias != null ? String(m.prazo_previsto_dias) : "");
    setPrazoFatal(m.prazo_fatal_dias != null ? String(m.prazo_fatal_dias) : "");
    setActive(m.active as boolean);
    setDialogOpen(true);
  }

  function openNew() {
    setEditing(null);
    setProjurisCodigo("");
    setProjurisDesc("");
    setMotorId("");
    setPoints("10");
    setComplexity("0");
    setTemporal("0");
    setPrazoPrevisto("");
    setPrazoFatal("");
    setActive(true);
    setDialogOpen(true);
  }

  // H6: dias -> INT | null (campo vazio = sem default interno).
  function parseDias(v: string): number | null {
    const t = v.trim();
    if (!t) return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  async function handleSave() {
    if (!projurisCodigo || !motorId) {
      toast.error("Campos obrigatorios");
      return;
    }
    try {
      await upsert.mutateAsync({
        projuris_tipo_codigo: projurisCodigo,
        projuris_tipo_descricao: projurisDesc,
        motor_task_type_id: motorId,
        points: parseFloat(points),
        complexity_level: parseInt(complexity),
        temporal_level: parseInt(temporal),
        prazo_previsto_dias: parseDias(prazoPrevisto),
        prazo_fatal_dias: parseDias(prazoFatal),
        active,
      });
      toast.success(editing ? "Tipo atualizado" : "Tipo adicionado");
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  // H6: sincronizar tipos do ProJuris (de-para por nome). So leitura no ProJuris.
  async function handleSyncTipos() {
    try {
      const r = await syncTipos.mutateAsync();
      const pend = r.nearMiss.length + r.collisions.length;
      toast.success(
        `Sincronizado: ${r.matched.length} casados (${r.numericos}/${r.shvLinhas} com codigo real)` +
          (pend ? ` — ${pend} para revisar manualmente` : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar tipos");
    }
  }

  function exportCSV() {
    const header =
      "Codigo Projuris;Motor ID;Pontos;Complexidade;Temporalidade;Prazo previsto (dias);Prazo fatal (dias);Ativo\n";
    const rows = (mappings ?? [])
      .map(
        (m) =>
          `${m.projuris_tipo_codigo};${m.motor_task_type_id};${m.points};${m.complexity_level};${m.temporal_level};${m.prazo_previsto_dias ?? ""};${m.prazo_fatal_dias ?? ""};${m.active}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tipos_tarefa.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Filtrar..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/controladoria/distribuicao/excecoes">
            <ShieldCheck className="h-4 w-4 mr-1" /> Executor exclusivo
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncTipos}
          disabled={syncTipos.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${syncTipos.isPending ? "animate-spin" : ""}`} />{" "}
          {syncTipos.isPending ? "Sincronizando..." : "Sincronizar tipos"}
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo Tipo
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-[300px]" />
      ) : (
        <Card>
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Codigo Projuris</th>
                  <th className="text-left py-2">Motor ID</th>
                  <th className="text-right py-2">Pontos</th>
                  <th className="text-center py-2">Complexidade</th>
                  <th className="text-center py-2">Temporalidade</th>
                  <th className="text-center py-2">Prazo prev. (d)</th>
                  <th className="text-center py-2">Prazo fatal (d)</th>
                  <th className="text-center py-2">Status</th>
                  <th className="text-center py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b hover:bg-accent/50">
                    <td className="py-2 font-medium">{m.projuris_tipo_codigo}</td>
                    <td className="py-2 text-muted-foreground">{m.motor_task_type_id}</td>
                    <td className="py-2 text-right">{m.points}</td>
                    <td className="py-2 text-center">
                      <Badge variant="outline" className="text-xs">
                        {COMPLEXITY_LABELS[m.complexity_level]}
                      </Badge>
                    </td>
                    <td className="py-2 text-center">
                      <Badge variant="outline" className="text-xs">
                        {TEMPORAL_LABELS[m.temporal_level]}
                      </Badge>
                    </td>
                    <td className="py-2 text-center text-muted-foreground">
                      {m.prazo_previsto_dias ?? "—"}
                    </td>
                    <td className="py-2 text-center text-muted-foreground">
                      {m.prazo_fatal_dias ?? "—"}
                    </td>
                    <td className="py-2 text-center">
                      {m.active ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(m as Record<string, unknown>)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tipo" : "Novo Tipo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Codigo Projuris</Label>
              <Input
                value={projurisCodigo}
                onChange={(e) => setProjurisCodigo(e.target.value)}
                disabled={!!editing}
                placeholder="AUDIENCIA"
              />
            </div>
            <div>
              <Label>Descricao</Label>
              <Input
                value={projurisDesc}
                onChange={(e) => setProjurisDesc(e.target.value)}
                placeholder="Audiencia Trabalhista"
              />
            </div>
            <div>
              <Label>Motor Task Type ID</Label>
              <Input
                value={motorId}
                onChange={(e) => setMotorId(e.target.value)}
                placeholder="audiencia_trabalhista"
              />
            </div>
            <div>
              <Label>Pontos Base</Label>
              <Input
                type="number"
                min="0.1"
                step="0.5"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>
            <div>
              <Label>Complexidade</Label>
              <Select value={complexity} onValueChange={setComplexity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Temporalidade</Label>
              <Select value={temporal} onValueChange={setTemporal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPORAL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prazo previsto (dias)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={prazoPrevisto}
                  onChange={(e) => setPrazoPrevisto(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div>
                <Label>Prazo fatal (dias)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={prazoFatal}
                  onChange={(e) => setPrazoFatal(e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Default interno de prazo (fallback do motor quando a tarefa do ProJuris nao trouxer o
              prazo). Vazio = sem default.
            </p>
            <div className="rounded-md border p-3 text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Regra <b>exclusiva</b> (tarefa deste tipo/tema vai direto a um executor): configure
                em{" "}
                <Link to="/controladoria/distribuicao/excecoes" className="underline">
                  Executor exclusivo
                </Link>
                .
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
