import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Tag, Plus, Pencil, Search } from "lucide-react";
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
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { useThemeMappings, useUpsertThemeMapping } from "@/hooks/useDistribuicao";

export const Route = createFileRoute("/controladoria/distribuicao/temas")({
  component: TemasPage,
});

const TEMPORAL_LABELS: Record<number, string> = {
  0: "Normal",
  1: "Prioritario (+10%)",
  2: "Urgente (+30%)",
};

function TemasPage() {
  const { data: mappings, isLoading } = useThemeMappings();
  const upsert = useUpsertThemeMapping();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [filter, setFilter] = useState("");

  const [projurisCodigo, setProjurisCodigo] = useState("");
  const [projurisDesc, setProjurisDesc] = useState("");
  const [motorId, setMotorId] = useState("");
  const [multiplier, setMultiplier] = useState("1.0");
  const [temporal, setTemporal] = useState("0");
  const [active, setActive] = useState(true);

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
                  <th className="text-center py-2">Status</th>
                  <th className="text-center py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: any) => (
                  <tr key={m.id} className="border-b hover:bg-accent/50">
                    <td className="py-2 font-medium">{m.projuris_tema_codigo}</td>
                    <td className="py-2 text-muted-foreground">{m.motor_theme_id}</td>
                    <td className="py-2 text-right">{m.multiplier}x</td>
                    <td className="py-2 text-center">
                      <Badge variant="outline" className="text-xs">
                        {TEMPORAL_LABELS[m.temporal_level]}
                      </Badge>
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
