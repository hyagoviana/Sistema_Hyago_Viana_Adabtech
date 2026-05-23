import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteClient } from "@/hooks/useClients";

type Props = {
  clientId: string;
  clientName: string;
  onEdit: () => void;
};

// Botão posicionado absoluto no canto do card — usa stopPropagation pra não
// disparar o Link envolvente do card.
export function ClientCardMenu({ clientId, clientName, onEdit }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteMutation = useDeleteClient();

  function stopAll(e: React.MouseEvent | React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div onClick={stopAll} onPointerDown={stopAll}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Ações do cliente"
            className="p-1.5 rounded-md hover:bg-[var(--gold)]/10 text-[var(--gold)] opacity-60 hover:opacity-100 transition"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={(e) => {
              stopAll(e);
              onEdit();
            }}
          >
            <Pencil size={14} className="mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              stopAll(e);
              setConfirmOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 size={14} className="mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {clientName}?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente fica como excluído (soft-delete) e desaparece da lista. Você ainda pode
              recuperar via banco se precisar. A pasta no Drive não é apagada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await deleteMutation.mutateAsync(clientId);
                  toast.success(`${clientName} excluído`);
                  setConfirmOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Erro ao excluir");
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
