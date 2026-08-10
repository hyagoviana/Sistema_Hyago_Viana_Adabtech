import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, Pencil, Search, ShieldCheck } from "lucide-react";
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
  useThemeMappings,
  useUpsertThemeMapping,
  useExecutorMappings,
} from "@/hooks/useDistribuicao";

export const Route = createFileRoute("/controladoria/distribuicao/temas")({
  component: TemasPage,
});

const NONE = "__none__";

const TEMPORAL_LABELS: Record<number, string> = {
  0: "Normal",
  1: "Prioritario (+10%)",
  2: "Urgente (+30%)",
};

type ThemeRow = {
  id: string;
  projuris_tema_codigo: string;
  projuris_tema_descricao: string | null;
  motor_theme_id: string;
  multiplier: number;
  temporal_level: number;
  exclusive_executor_id: string | null;
  active: boolean;
};

function TemasPage() {
  const { data: mappings, isLoading } = useThemeMappings();
  const { data: executors } = useExecutorMappings();
  const upsert = useUpsertThemeMapping();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [filter, setFilter] = useState("");

  const [projurisCodigo, setProjurisCodigo] = useState("");
  const [projurisDesc, setProjurisDesc] = useState("");
  const [motorId, setMotorId] = useState("");
  const [multiplier, setMultiplier] = useState("1.0");
  const [temporal, setTemporal] = useState("0");
  const [exclusiveExecutor, setExclusiveExecutor] = useState<string>(NONE);
  const [active, setActive] = useState(true);

  const execOptions = useMemo(
    () =>
      (
        (executors ?? []) as Array<{
          executor_id: string;
          active: boolean;
          system_users?: { full_name?: string | null } | null;
        }>
      )
        .filter((e) => e.active && e.executor_id)
        .map((e) => ({ id: e.executor_id, nome: e.system_users?.full_name ?? e.executor_id })),
    [executors],
  );
  const execNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of execOptions) m.set(e.id, e.nome);
    return m;
  }, [execOptions]);

  const previewPoints = useMemo(
    () => (10 * parseFloat(multiplier || "1")).toFixed(2),
    [multiplier],
  );

  const filtered = (mappings ?? []).filter(
    (m) =>
      m.projuris_tema_codigo.toLowerCase().includes(filter.toLowerCase()) ||
      (m.projuris_tema_descricao ?? "").toLowerCase().includes(filter.toLowerCase()),
  );

  function openEdit(m: Record<string, unknown>) {
    setEditing(m);
    setProjurisCodigo(m.projuris_tema_codigo as string);
    setProjurisDesc((m.projuris_tema_descricao as string) ?? "");
    setMotorId(m.motor_theme_id as string);
    setMultiplier(String(m.multiplier));
    setTemporal(String(m.temporal_level));
    setExclusiveExecutor((m.exclusive_executor_id as string | null) ?? NONE);
    setActive(m.active as boolean);
    setDialogOpen(true);
  }

  function openNew() {
    setEditing(null);
    setProjurisCodigo("");
    setProjurisDesc("");
    setMotorId("");
    setMultiplier("1.0");
    setTemporal("0");
    setExclusiveExecutor(NONE);
    setActive(true);
    setDialogOpen(true);
  }

  async function handleSave() {
    const mult = parseFloat(multiplier);
    if (!projurisCodigo || !motorId) {
      toast.error("Campos obrigatorios");
      return;
    }
    if (!mult || mult <= 0) {
      toast.error("Multiplicador deve ser > 0");
      return;
    }
    try {
      await upsert.mutateAsync({
        projuris_tema_codigo: projurisCodigo,
        projuris_tema_descricao: projurisDesc,
        motor_theme_id: motorId,
        multiplier: mult,
        temporal_level: parseInt(temporal),
        exclusive_executor_id: exclusiveExecutor === NONE ? null : exclusiveExecutor,
        active,
      });
      toast.success(editing ? "Tema atualizado" : "Tema adicionado");
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Filtrar..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo Tema
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
                  <th className="text-right py-2">Multiplicador</th>
                  <th className="text-center py-2">Temporalidade</th>
                  <th className="text-left py-2">Exclusivo</th>
                  <th className="text-center py-2">Status</th>
                  <th className="text-center py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(filtered as ThemeRow[]).map((m) => (
                  <tr key={m.id} className="border-b hover:bg-accent/50">
                    <td className="py-2 font-medium">{m.projuris_tema_codigo}</td>
                    <td className="py-2 text-muted-foreground">{m.motor_theme_id}</td>
                    <td className="py-2 text-right">{m.multiplier}x</td>
                    <td className="py-2 text-center">
                      <Badge variant="outline" className="text-xs">
                        {TEMPORAL_LABELS[m.temporal_level]}
                      </Badge>
                    </td>
                    <td className="py-2 text-xs">
                      {m.exclusive_executor_id ? (
                        <Badge variant="outline" className="text-[11px] gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {execNameById.get(m.exclusive_executor_id) ?? "definido"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">·</span>
                      )}
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
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
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
            <DialogTitle>{editing ? "Editar Tema" : "Novo Tema"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Codigo Projuris</Label>
              <Input
                value={projurisCodigo}
                onChange={(e) => setProjurisCodigo(e.target.value)}
                disabled={!!editing}
                placeholder="TRABALHISTA"
              />
            </div>
            <div>
              <Label>Descricao</Label>
              <Input
                value={projurisDesc}
                onChange={(e) => setProjurisDesc(e.target.value)}
                placeholder="Trabalhista Reclamacao"
              />
            </div>
            <div>
              <Label>Motor Theme ID</Label>
              <Input
                value={motorId}
                onChange={(e) => setMotorId(e.target.value)}
                placeholder="trabalhista_reclamacao"
              />
            </div>
            <div>
              <Label>Multiplicador</Label>
              <Input
                type="number"
                min="0.5"
                max="3.0"
                step="0.1"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Preview: tipo com 10pts = <strong>{previewPoints}pts</strong> base
              </p>
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
            <div>
              <Label className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Executor exclusivo (opcional)
              </Label>
              <Select value={exclusiveExecutor} onValueChange={setExclusiveExecutor}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum (distribui normalmente)</SelectItem>
                  {execOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Se preenchido, toda tarefa deste <b>tema</b> vai direto a esse executor (fluxo
                ABSOLUTE). A regra de tema tem <b>precedência</b> sobre a regra por tipo de tarefa.
              </p>
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
