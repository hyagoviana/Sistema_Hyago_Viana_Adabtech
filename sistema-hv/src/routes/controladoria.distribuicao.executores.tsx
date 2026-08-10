import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useExecutorMappings, useUpsertExecutorMapping } from "@/hooks/useDistribuicao";
import { usePodeEditar } from "@/hooks/usePermissions";

export const Route = createFileRoute("/controladoria/distribuicao/executores")({
  component: ExecutoresPage,
});

type ExecutorRow = {
  id: string;
  projuris_responsavel_id: string;
  executor_id: string;
  active: boolean;
  weight: number | null;
  eligible_complex: boolean | null;
  system_users?: { full_name?: string | null } | null;
};

function ExecutoresPage() {
  const podeEditar = usePodeEditar("controladoria");
  const { data: executors, isLoading } = useExecutorMappings();
  const upsert = useUpsertExecutorMapping();
  const [editing, setEditing] = useState<ExecutorRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [projurisId, setProjurisId] = useState("");
  const [weight, setWeight] = useState("1.0");
  const [eligibleComplex, setEligibleComplex] = useState(true);
  const [active, setActive] = useState(true);

  const totalWeight = useMemo(() => {
    return ((executors ?? []) as ExecutorRow[])
      .filter((e) => e.active)
      .reduce((s, e) => s + (e.weight ?? 1), 0)
      .toFixed(2);
  }, [executors]);

  function openEdit(exec: ExecutorRow) {
    setEditing(exec);
    setProjurisId(exec.projuris_responsavel_id);
    setWeight(String(exec.weight ?? 1));
    setEligibleComplex(exec.eligible_complex ?? true);
    setActive(exec.active ?? true);
    setDialogOpen(true);
  }

  async function handleSave() {
    // Tela AVANÇADA (H5): só EDITA mappings existentes. A CRIAÇÃO/associação de
    // executor↔usuário passou a ser feita na tela de Usuários e Permissões
    // (fonte da verdade), evitando o bug legado de gravar o CÓDIGO ProJuris no
    // campo FK executor_id (UUID). Aqui nunca alteramos executor_id.
    if (!editing) return;
    const w = parseFloat(weight);
    if (!w || w <= 0) {
      toast.error("Peso deve ser maior que 0");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: editing.id,
        projuris_responsavel_id: editing.projuris_responsavel_id,
        executor_id: editing.executor_id,
        weight: w,
        eligible_complex: eligibleComplex,
        active,
      });
      toast.success("Executor atualizado");
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Badge variant="outline">Soma de pesos (ativos): {totalWeight}</Badge>
      </div>

      {/* Tela AVANÇADA / leitura+edição (H5). A fonte da verdade do executor
          (ID ProJuris + participa) é a tela de Usuários e Permissões. Aqui só
          se ajusta peso / elegibilidade / ativação de mappings já existentes. */}
      <p className="text-sm text-muted-foreground">
        Para associar um usuário a um ID ProJuris e marcá-lo como participante da distribuição, use
        a tela <span className="font-medium">Usuários e Permissões</span>. Aqui você apenas ajusta o
        peso, a elegibilidade a tarefas complexas e a ativação dos executores já mapeados.
      </p>

      {isLoading ? (
        <Skeleton className="h-[300px]" />
      ) : (
        <Card>
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Nome</th>
                  <th className="text-left py-2">Projuris ID</th>
                  <th className="text-right py-2">Peso</th>
                  <th className="text-center py-2">Complexa</th>
                  <th className="text-center py-2">Status</th>
                  <th className="text-center py-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {((executors ?? []) as ExecutorRow[]).map((e) => (
                  <tr key={e.id} className="border-b hover:bg-accent/50">
                    <td className="py-2 font-medium">{e.system_users?.full_name ?? "·"}</td>
                    <td className="py-2 text-muted-foreground">{e.projuris_responsavel_id}</td>
                    <td className="py-2 text-right">{e.weight ?? 1}</td>
                    <td className="py-2 text-center">
                      {e.eligible_complex ? (
                        <Badge variant="default" className="text-xs">
                          Sim
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Nao
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      {e.active ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      {podeEditar ? (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">·</span>
                      )}
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
            <DialogTitle>Editar Executor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Projuris ID</Label>
              <Input value={projurisId} onChange={(e) => setProjurisId(e.target.value)} disabled />
            </div>
            <div>
              <Label>Peso Geral</Label>
              <Input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Elegivel Fila Complexa</Label>
              <Switch checked={eligibleComplex} onCheckedChange={setEligibleComplex} />
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
