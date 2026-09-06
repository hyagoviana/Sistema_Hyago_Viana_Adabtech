// S4-01 — trocar o responsável do caso.
//
// Thiago (reunião 02/09): "colocar um registro lá, uma opção de que esse caso
// tem um vínculo com X usuário, e aí o sistema na hora de rodar o motor vai
// puxar". Até aqui a ficha só MOSTRAVA o responsável; a edição estava prometida
// no menu "Editar caso" e não existia.
//
// Um responsável por caso (A2, Thiago 04/09). O efeito no motor é o que importa
// e está dito na tela: com um, ele direciona; sem nenhum, distribui por pontos.

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCaseResponsaveis, useSetCaseResponsaveis } from "@/hooks/useCases";
import { useUsers } from "@/hooks/useUsers";

const SEM = "__sem__";

export function CaseResponsavelDialog({
  caseId,
  open,
  onOpenChange,
}: {
  caseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: atuais } = useCaseResponsaveis(caseId);
  const { data: usuarios } = useUsers();
  const salvar = useSetCaseResponsaveis(caseId);
  const [escolhido, setEscolhido] = useState<string>(SEM);

  useEffect(() => {
    if (open) setEscolhido((atuais ?? [])[0]?.user_id ?? SEM);
  }, [open, atuais]);

  // Só quem está ativo pode receber caso — atribuir a alguém suspenso deixaria
  // o caso sem dono de fato, e o motor não teria para quem direcionar.
  const ativos = (usuarios ?? []).filter(
    (u) => (u as { status?: string | null }).status?.toUpperCase() === "ACTIVE",
  );

  async function handleSalvar() {
    try {
      await salvar.mutateAsync(escolhido === SEM ? [] : [escolhido]);
      toast.success(
        escolhido === SEM
          ? "Responsável removido — o motor volta a distribuir por pontos"
          : "Responsável atualizado",
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responsável pelo caso</DialogTitle>
          <DialogDescription>
            Com um responsável, o motor de distribuição manda as tarefas deste caso para ele. Sem
            nenhum, distribui por pontuação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label className="text-xs">Responsável</Label>
          <select
            value={escolhido}
            onChange={(e) => setEscolhido(e.target.value)}
            disabled={salvar.isPending}
            className="w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm"
          >
            <option value={SEM}>Sem responsável (distribui por pontos)</option>
            {ativos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.email}
              </option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
