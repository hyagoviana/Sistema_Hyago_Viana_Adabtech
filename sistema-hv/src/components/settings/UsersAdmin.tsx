import { Pencil, Plus, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Btn } from "@/components/hv/primitives";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsers, useSetUserRole, useSetUserStatus, useUpdateUserProfile } from "@/hooks/useUsers";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";

import { InviteUserDialog } from "./InviteUserDialog";
import { UserReportDialog } from "./UserReportDialog";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  INVITED: "Convidado",
  SUSPENDED: "Suspenso",
};
const STATUS_TONE: Record<string, string> = {
  ACTIVE: "var(--gold-700)",
  INVITED: "#6b7280",
  SUSPENDED: "#b4232a",
};

export function UsersAdmin({ currentUserId }: { currentUserId: string }) {
  const { data, isLoading, isError, error } = useUsers();
  const setRole = useSetUserRole();
  const setStatus = useSetUserStatus();
  const updateProfile = useUpdateUserProfile();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    full_name: string;
    phone: string;
    email: string;
    role: string;
    originalRole: string;
    isSelf: boolean;
  } | null>(null);

  async function salvarPerfil() {
    if (!editing) return;
    try {
      await updateProfile.mutateAsync({
        id: editing.id,
        full_name: editing.full_name.trim() || null,
        phone: editing.phone.trim() || null,
      });
      // Se o cargo mudou (e é permitido), atualiza também.
      if (
        editing.role !== editing.originalRole &&
        !editing.isSelf &&
        editing.originalRole !== "admin"
      ) {
        await setRole.mutateAsync({ id: editing.id, role: editing.role });
      }
      toast.success("Dados do usuário atualizados.");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  async function handleRole(id: string, role: string) {
    try {
      await setRole.mutateAsync({ id, role });
      toast.success("Papel atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar papel");
    }
  }

  async function handleStatus(id: string, status: string) {
    try {
      await setStatus.mutateAsync({ id, status });
      toast.success(status === "SUSPENDED" ? "Usuário suspenso." : "Usuário reativado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar status");
    }
  }

  return (
    <section className="card-editorial !p-0 overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <UserCog size={16} className="text-[var(--gold)]" />
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--navy)]">Usuários e permissões</h2>
            <p className="text-[11.5px] text-muted-foreground">
              {isLoading ? "Carregando…" : `${data?.length ?? 0} usuário(s)`}
            </p>
          </div>
        </div>
        <Btn variant="gold" onClick={() => setInviteOpen(true)}>
          <Plus size={14} />
          Convidar
        </Btn>
      </header>

      {isError && (
        <Alert variant="destructive" className="m-4">
          <AlertDescription>
            Erro ao carregar usuários: {error instanceof Error ? error.message : "desconhecido"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {(data ?? []).map((u) => {
            const isSelf = u.id === currentUserId;
            const suspended = u.status === "SUSPENDED";
            return (
              <li key={u.id} className="flex items-center gap-4 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setReport(u.id)}
                  title="Ver relatório do usuário"
                  className="flex items-center gap-3 flex-1 min-w-0 text-left group"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold text-[var(--navy)] shrink-0"
                    style={{ background: "linear-gradient(135deg, #fbf3dd, #d4a832)" }}
                  >
                    {(u.full_name?.[0] ?? u.email[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-[var(--navy)] truncate group-hover:underline">
                      {u.full_name || u.email.split("@")[0]}
                      {isSelf && (
                        <span className="text-[11px] text-muted-foreground font-normal">
                          {" "}
                          · você
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground truncate">{u.email}</div>
                  </div>
                </button>

                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    color: STATUS_TONE[u.status] ?? "#6b7280",
                    background: "rgba(0,0,0,0.03)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {STATUS_LABEL[u.status] ?? u.status}
                </span>

                <div className="w-[200px] shrink-0">
                  <Select
                    value={u.role}
                    onValueChange={(v) => handleRole(u.id, v)}
                    disabled={isSelf || u.role === "admin"}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r as Role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <button
                  onClick={() =>
                    setEditing({
                      id: u.id,
                      full_name: u.full_name ?? "",
                      phone: (u as { phone?: string | null }).phone ?? "",
                      email: u.email,
                      role: u.role,
                      originalRole: u.role,
                      isSelf,
                    })
                  }
                  title="Editar dados e cargo"
                  className="text-muted-foreground hover:text-[var(--navy)] p-1.5 rounded-md shrink-0"
                >
                  <Pencil size={14} />
                </button>

                <button
                  onClick={() => handleStatus(u.id, suspended ? "ACTIVE" : "SUSPENDED")}
                  disabled={isSelf || u.role === "admin"}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-[var(--border)] transition-colors hover:bg-black/[0.03] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{ color: suspended ? "var(--gold-700)" : "#b4232a" }}
                >
                  {suspended ? "Reativar" : "Suspender"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>E-mail (login)</Label>
                <Input value={editing.email} disabled />
              </div>
              <div>
                <Label>Nome completo</Label>
                <Input
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label>Cargo</Label>
                <Select
                  value={editing.role}
                  onValueChange={(v) => setEditing({ ...editing, role: v })}
                  disabled={editing.isSelf || editing.originalRole === "admin"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r as Role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(editing.isSelf || editing.originalRole === "admin") && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    O cargo do administrador e o seu próprio não podem ser alterados aqui.
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarPerfil} disabled={updateProfile.isPending || setRole.isPending}>
              {updateProfile.isPending || setRole.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserReportDialog userId={report} onClose={() => setReport(null)} />
    </section>
  );
}
