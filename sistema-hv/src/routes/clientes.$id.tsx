import { createFileRoute, notFound } from "@tanstack/react-router";
import { AlertTriangle, ExternalLink, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { Breadcrumb, Card, Eyebrow, OrnamentalDivider } from "@/components/hv/primitives";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClient, useDeleteClient, useResyncDrive } from "@/hooks/useClients";

export const Route = createFileRoute("/clientes/$id")({
  component: ClienteDetalhe,
});

function maskCpfCnpj(d: string): string {
  const c = d.replace(/\D/g, "");
  if (c.length === 11) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  if (c.length === 14)
    return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  return d;
}

function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const { data: cliente, isLoading, isError, error } = useClient(id);
  const resyncMutation = useResyncDrive();
  const deleteMutation = useDeleteClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <div className="page-container">
        <Skeleton className="h-6 w-64 mb-4" />
        <Skeleton className="h-24 w-full mb-8" />
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "erro desconhecido";
    if (msg.toLowerCase().includes("não encontrado")) throw notFound();
    return (
      <div className="page-container">
        <Alert variant="destructive">
          <AlertDescription>Erro ao carregar cliente: {msg}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!cliente) throw notFound();

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Clientes", to: "/clientes" }, { label: cliente.full_name }]} />

      <header className="flex items-end gap-6 mb-8">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center font-display text-[40px] font-bold text-[var(--navy)]"
          style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
        >
          {cliente.full_name[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1">
          <Eyebrow>
            {cliente.tipo ? `${cliente.tipo} · ` : ""}CPF/CNPJ {maskCpfCnpj(cliente.cpf_cnpj)}
          </Eyebrow>
          <h1 className="font-display text-[40px] font-bold text-[var(--navy)] mt-2 h1-ornament">
            {cliente.full_name}
          </h1>
        </div>
        <div className="flex gap-2 self-start mt-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil size={14} className="mr-1.5" /> Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={14} className="mr-1.5" /> Excluir
          </Button>
        </div>
      </header>

      {cliente.drive_sync_failed && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha ao criar pasta no Google Drive</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-xs opacity-80 truncate">
              {cliente.drive_sync_error ?? "Erro desconhecido"}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={resyncMutation.isPending}
              onClick={async () => {
                try {
                  await resyncMutation.mutateAsync(cliente.id);
                  toast.success("Pasta criada no Drive");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falhou de novo");
                }
              }}
            >
              <RefreshCw
                size={14}
                className={`mr-1.5 ${resyncMutation.isPending ? "animate-spin" : ""}`}
              />
              {resyncMutation.isPending ? "Tentando…" : "Tentar de novo"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Total de casos" value="—" />
        <Stat label="Receita total" value="—" />
        <Stat label="LTV estimado" value="—" />
      </div>

      <OrnamentalDivider />

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <Eyebrow>Contato</Eyebrow>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="text-[var(--navy)] font-medium">{cliente.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Telefone</dt>
              <dd className="text-[var(--navy)] font-medium">{maskPhone(cliente.phone)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Cadastrado em</dt>
              <dd className="text-[var(--navy)] font-medium">
                {new Date(cliente.created_at).toLocaleDateString("pt-BR")}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <Eyebrow>Pasta no Drive</Eyebrow>
          {cliente.drive_folder_url ? (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-3">
                Arquivos do cliente ficam aqui — você pode subir/baixar pelo Drive direto.
              </p>
              <Button asChild variant="outline" size="sm">
                <a href={cliente.drive_folder_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} className="mr-1.5" /> Abrir no Drive
                </a>
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground italic">
              Pasta ainda não criada.{" "}
              {cliente.drive_sync_failed && "Use o botão acima pra tentar de novo."}
            </p>
          )}
        </Card>
      </div>

      <h2 className="font-display text-[24px] font-semibold text-[var(--navy)] mb-3">
        Casos vinculados
      </h2>
      <div className="card-editorial !p-10 text-center text-muted-foreground italic">
        Casos chegam na Sprint F4 (módulo Operacional).
      </div>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" client={cliente} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {cliente.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente fica como excluído (soft-delete) e desaparece da lista. A pasta no Drive não
              é apagada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await deleteMutation.mutateAsync(cliente.id);
                  toast.success("Cliente excluído");
                  navigate({ to: "/clientes" });
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <Eyebrow>{label}</Eyebrow>
      <div className="kpi-number text-[36px] mt-3">{value}</div>
    </Card>
  );
}
