// S2-01 (reunião 02/09) — diálogo ENXUTO de criação de tema.
//
// Thiago: "Hoje existem 2 'menus' diferentes para configurar temas (…) vamos
// remover daqui e manter apenas no painel de configuração."
//
// A CRIAÇÃO continua acessível de onde a pessoa trabalha (Área de Trabalho) — o
// que saiu de lá foi a CONFIGURAÇÃO (renomear, pastas, campos, motor), que agora
// mora só em Configurações › Configuração de temas. Ao criar, este diálogo
// devolve o tema para quem chamou decidir o que fazer (levar para a configuração,
// selecionar na lista, etc.).
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateTema } from "@/hooks/useTemas";

export type TemaCriado = { id: string; name: string; slug?: string };

export function NovoTemaDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado depois de criar. Quem chama decide o próximo passo. */
  onCreated?: (tema: TemaCriado) => void;
}) {
  const [name, setName] = useState("");
  const createTema = useCreateTema();

  async function criar() {
    const nome = name.trim();
    if (!nome) return;
    try {
      const criado = (await createTema.mutateAsync({ name: nome })) as TemaCriado;
      setName("");
      onOpenChange(false);
      toast.success(`Tema "${criado.name}" criado`);
      onCreated?.(criado);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar tema");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setName("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo tema</DialogTitle>
          <DialogDescription>
            O sistema já cria a pasta do tema no Drive (com as subpastas Casos e Procurações). Em
            seguida você configura campos, modelos e motor em Configuração de temas.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label>Nome do tema</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Servidor Público"
            onKeyDown={(e) => e.key === "Enter" && criar()}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={criar} disabled={createTema.isPending || !name.trim()}>
            <Plus size={14} />
            {createTema.isPending ? "Criando…" : "Criar tema"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
