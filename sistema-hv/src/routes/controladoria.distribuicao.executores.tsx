import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { UserCheck, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Breadcrumb, PageHeader } from "@/components/hv/primitives";
import { useExecutorMappings, useUpsertExecutorMapping } from "@/hooks/useDistribuicao";

export const Route = createFileRoute("/controladoria/distribuicao/executores")({
  component: ExecutoresPage,
});

function ExecutoresPage() {
  const { data: executors, isLoading } = useExecutorMappings();
  const upsert = useUpsertExecutorMapping();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [projurisId, setProjurisId] = useState("");
  const [weight, setWeight] = useState("1.0");
  const [eligibleComplex, setEligibleComplex] = useState(true);
  const [active, setActive] = useState(true);

  const totalWeight = useMemo(() => {
    return (executors ?? []).filter(e => e.active).reduce((s, e) => s + (e.weight ?? 1), 0).toFixed(2);
  }, [executors]);

  function openEdit(exec: Record<string, unknown>) {
    setEditing(exec);
    setProjurisId(exec.projuris_responsavel_id as string);
    setWeight(String(exec.weight ?? 1));
    setEligibleComplex((exec.eligible_complex ?? true) as boolean);
    setActive((exec.active ?? true) as boolean);
    setDialogOpen(true);
  }

  function openNew() {
    setEditing(null);
    setProjurisId(""); setWeight("1.0"); setEligibleComplex(true); setActive(true);
    setDialogOpen(true);
  }

  async function handleSave() {
    const w = parseFloat(weight);
    if (!w || w <= 0) { toast.error("Peso deve ser maior que 0"); return; }
    if (!projurisId) { toast.error("Projuris ID obrigatorio"); return; }
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: (editing as any).id } : {}),
        projuris_responsavel_id: projurisId,
        executor_id: (editing as any)?.executor_id ?? projurisId,
        weight: w,
        eligible_complex: eligibleComplex,
        active,
      });
      toast.success(editing ? "Executor atualizado" : "Executor adicionado");
      setDialogOpen(false);
    } catch { toast.error("Erro ao salvar"); }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Badge variant="outline">Soma de pesos (ativos): {totalWeight}</Badge>
        <div className="ml-auto">
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Executor</Button>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-[300px]" /> : (
        <Card>
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2">Nome</th><th className="text-left py-2">Projuris ID</th><th className="text-right py-2">Peso</th><th className="text-center py-2">Complexa</th><th className="text-center py-2">Status</th><th className="text-center py-2">Acoes</th></tr></thead>
              <tbody>
                {(executors ?? []).map((e: any) => (
                  <tr key={e.id} className="border-b hover:bg-accent/50">
                    <td className="py-2 font-medium">{e.system_users?.full_name ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">{e.projuris_responsavel_id}</td>
                    <td className="py-2 text-right">{e.weight ?? 1}</td>
                    <td className="py-2 text-center">{e.eligible_complex ? <Badge variant="default" className="text-xs">Sim</Badge> : <Badge variant="secondary" className="text-xs">Nao</Badge>}</td>
                    <td className="py-2 text-center">{e.active ? <Badge className="bg-green-100 text-green-700 text-xs">Ativo</Badge> : <Badge variant="secondary" className="text-xs">Inativo</Badge>}</td>
                    <td className="py-2 text-center"><Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Executor" : "Novo Executor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Projuris ID</Label><Input value={projurisId} onChange={e => setProjurisId(e.target.value)} disabled={!!editing} /></div>
            <div><Label>Peso Geral</Label><Input type="number" min="0.1" max="10" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} /></div>
            <div className="flex items-center justify-between"><Label>Elegivel Fila Complexa</Label><Switch checked={eligibleComplex} onCheckedChange={setEligibleComplex} /></div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={active} onCheckedChange={setActive} /></div>
            <Button className="w-full" onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
