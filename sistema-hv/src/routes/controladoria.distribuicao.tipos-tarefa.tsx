import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ListTodo, Plus, Pencil, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { useTaskTypeMappings, useUpsertTaskTypeMapping } from "@/hooks/useDistribuicao";

export const Route = createFileRoute("/controladoria/distribuicao/tipos-tarefa")({
  component: TiposTarefaPage,
});

const COMPLEXITY_LABELS: Record<number, string> = { 0: "Regular", 1: "Nivel 1 (+20%)", 2: "Nivel 2 (+30%)" };
const TEMPORAL_LABELS: Record<number, string> = { 0: "Normal", 1: "Prioritario (+10%)", 2: "Urgente (+30%)" };

function TiposTarefaPage() {
  const { toast } = useToast();
  const { data: mappings, isLoading } = useTaskTypeMappings();
  const upsert = useUpsertTaskTypeMapping();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [filter, setFilter] = useState("");

  const [projurisCodigo, setProjurisCodigo] = useState("");
  const [projurisDesc, setProjurisDesc] = useState("");
  const [motorId, setMotorId] = useState("");
  const [points, setPoints] = useState("10");
  const [complexity, setComplexity] = useState("0");
  const [temporal, setTemporal] = useState("0");
  const [active, setActive] = useState(true);

  const filtered = (mappings ?? []).filter(m =>
    m.projuris_tipo_codigo.toLowerCase().includes(filter.toLowerCase()) ||
    m.motor_task_type_id.toLowerCase().includes(filter.toLowerCase())
  );

  function openEdit(m: Record<string, unknown>) {
    setEditing(m); setProjurisCodigo(m.projuris_tipo_codigo as string);
    setProjurisDesc((m.projuris_tipo_descricao as string) ?? "");
    setMotorId(m.motor_task_type_id as string); setPoints(String(m.points));
    setComplexity(String(m.complexity_level)); setTemporal(String(m.temporal_level));
    setActive(m.active as boolean); setDialogOpen(true);
  }

  function openNew() {
    setEditing(null); setProjurisCodigo(""); setProjurisDesc(""); setMotorId("");
    setPoints("10"); setComplexity("0"); setTemporal("0"); setActive(true); setDialogOpen(true);
  }

  async function handleSave() {
    if (!projurisCodigo || !motorId) { toast({ title: "Campos obrigatorios", variant: "destructive" }); return; }
    try {
      await upsert.mutateAsync({
        projuris_tipo_codigo: projurisCodigo, projuris_tipo_descricao: projurisDesc,
        motor_task_type_id: motorId, points: parseFloat(points),
        complexity_level: parseInt(complexity), temporal_level: parseInt(temporal), active,
      });
      toast({ title: editing ? "Tipo atualizado" : "Tipo adicionado" }); setDialogOpen(false);
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  }

  function exportCSV() {
    const header = "Codigo Projuris;Motor ID;Pontos;Complexidade;Temporalidade;Ativo\n";
    const rows = (mappings ?? []).map(m => `${m.projuris_tipo_codigo};${m.motor_task_type_id};${m.points};${m.complexity_level};${m.temporal_level};${m.active}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "tipos_tarefa.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb items={[{ label: "Controladoria", href: "/controladoria" }, { label: "Distribuicao" }, { label: "Tipos de Tarefa" }]} />
      <PageHeader title="Tipos de Tarefa" subtitle="Mapeamento Projuris -> Motor" icon={<ListTodo className="h-6 w-6" />} />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xs"><Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" /><Input placeholder="Filtrar..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-9" /></div>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Tipo</Button>
      </div>

      {isLoading ? <Skeleton className="h-[300px]" /> : (
        <Card><CardContent className="pt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2">Codigo Projuris</th><th className="text-left py-2">Motor ID</th><th className="text-right py-2">Pontos</th><th className="text-center py-2">Complexidade</th><th className="text-center py-2">Temporalidade</th><th className="text-center py-2">Status</th><th className="text-center py-2">Acoes</th></tr></thead>
            <tbody>{filtered.map((m: any) => (
              <tr key={m.id} className="border-b hover:bg-accent/50">
                <td className="py-2 font-medium">{m.projuris_tipo_codigo}</td>
                <td className="py-2 text-muted-foreground">{m.motor_task_type_id}</td>
                <td className="py-2 text-right">{m.points}</td>
                <td className="py-2 text-center"><Badge variant="outline" className="text-xs">{COMPLEXITY_LABELS[m.complexity_level]}</Badge></td>
                <td className="py-2 text-center"><Badge variant="outline" className="text-xs">{TEMPORAL_LABELS[m.temporal_level]}</Badge></td>
                <td className="py-2 text-center">{m.active ? <Badge className="bg-green-100 text-green-700 text-xs">Ativo</Badge> : <Badge variant="secondary" className="text-xs">Inativo</Badge>}</td>
                <td className="py-2 text-center"><Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button></td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent></Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Tipo" : "Novo Tipo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Codigo Projuris</Label><Input value={projurisCodigo} onChange={e => setProjurisCodigo(e.target.value)} disabled={!!editing} placeholder="AUDIENCIA" /></div>
            <div><Label>Descricao</Label><Input value={projurisDesc} onChange={e => setProjurisDesc(e.target.value)} placeholder="Audiencia Trabalhista" /></div>
            <div><Label>Motor Task Type ID</Label><Input value={motorId} onChange={e => setMotorId(e.target.value)} placeholder="audiencia_trabalhista" /></div>
            <div><Label>Pontos Base</Label><Input type="number" min="0.1" step="0.5" value={points} onChange={e => setPoints(e.target.value)} /></div>
            <div><Label>Complexidade</Label><Select value={complexity} onValueChange={setComplexity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(COMPLEXITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Temporalidade</Label><Select value={temporal} onValueChange={setTemporal}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TEMPORAL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={active} onCheckedChange={setActive} /></div>
            <Button className="w-full" onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
