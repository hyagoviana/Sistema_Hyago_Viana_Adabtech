import { Pencil, Plus, Trash2, UserCog } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  useUsers,
  useSetUserRole,
  useSetUserStatus,
  useUpdateUserProfile,
  useSetUserDistribution,
  useProjurisUsuarios,
} from "@/hooks/useUsers";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";
import { CARGO_OPTS, NONE, PERFIL_OPTS, STATUS_PROJURIS_OPTS } from "@/lib/cadastro-colaborador";

import { DeleteUserDialog } from "./DeleteUserDialog";
import { InviteUserDialog } from "./InviteUserDialog";
import { PasswordAdminSection } from "./PasswordAdminSection";
import { UserModulePermsEditor } from "./UserModulePermsEditor";
import { UserReportDialog } from "./UserReportDialog";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  INVITED: "Convidado",
  SUSPENDED: "Suspenso",
  // M17 — registro sem acesso (arquivado/desabilitado no ProJuris).
  ARCHIVED: "Arquivado / sem acesso",
};
const STATUS_TONE: Record<string, string> = {
  ACTIVE: "var(--gold-700)",
  INVITED: "#6b7280",
  SUSPENDED: "#b4232a",
  ARCHIVED: "#6b7280",
};

export function UsersAdmin({ currentUserId }: { currentUserId: string }) {
  const { data, isLoading, isError, error } = useUsers();
  const setRole = useSetUserRole();
  const setStatus = useSetUserStatus();
  const updateProfile = useUpdateUserProfile();
  const setDistribution = useSetUserDistribution();
  const [inviteOpen, setInviteOpen] = useState(false);
  // Só busca quando o diálogo de edição está aberto: a chamada passa por
  // autenticação + API externa, não vale pagar isso ao abrir a lista.
  const [report, setReport] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    full_name: string;
    phone: string;
    email: string;
    role: string;
    originalRole: string;
    isSelf: boolean;
    // Cadastro do colaborador (M8).
    perfil: string;
    cargo: string;
    unidadeOrg: string;
    statusProjuris: string;
    peticionante: boolean;
    participaGeral: boolean;
    // Distribuição (ProJuris) — H5.
    projurisId: string;
    participa: boolean;
    eligibleComplex: boolean;
    weight: string;
  } | null>(null);

  // Lista do ProJuris para o seletor de vínculo. Só carrega com o diálogo aberto:
  // a chamada passa por autenticação + API externa, e não vale pagar isso só para
  // exibir a lista de colaboradores.
  const projurisUsuarios = useProjurisUsuarios(editing !== null);

  async function salvarPerfil() {
    if (!editing) return;
    // Orienta o admin: "participa" sem ID ProJuris não faz sentido (o motor
    // casa a tarefa pelo código). Bloqueia no cliente antes do save.
    if (editing.participa && !editing.projurisId.trim()) {
      toast.error(
        "Escolha o usuário no ProJuris antes de marcar como participante da distribuição.",
      );
      return;
    }
    try {
      await updateProfile.mutateAsync({
        id: editing.id,
        full_name: editing.full_name.trim() || null,
        phone: editing.phone.trim() || null,
        // Cadastro do colaborador (M8) — só o admin grava (gate no RPC).
        perfil: editing.perfil || null,
        cargo: editing.cargo || null,
        unidade_organizacional: editing.unidadeOrg.trim() || null,
        status_projuris: editing.statusProjuris || null,
        peticionante: editing.peticionante,
        participa_distribuicao_padrao: editing.participaGeral,
      });
      // Se o cargo mudou (e é permitido), atualiza também.
      if (
        editing.role !== editing.originalRole &&
        !editing.isSelf &&
        editing.originalRole !== "admin"
      ) {
        await setRole.mutateAsync({ id: editing.id, role: editing.role });
      }
      // Distribuição (ProJuris) — H5. Grava o mapping por executor_id.
      const w = parseFloat(editing.weight);
      await setDistribution.mutateAsync({
        id: editing.id,
        projuris_responsavel_id: editing.projurisId.trim() || null,
        participa: editing.participa,
        weight: Number.isFinite(w) && w > 0 ? w : 100,
        eligible_complex: editing.eligibleComplex,
      });
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
                    <div className="text-[11.5px] text-muted-foreground truncate">
                      {u.email}
                      {/* Ajuste A6 (2026-07-20) — mostra o telefone que o colaborador
                          preencheu no onboarding, sem precisar abrir "Editar". */}
                      {(u as { phone?: string | null }).phone
                        ? ` · ${(u as { phone?: string | null }).phone}`
                        : ""}
                    </div>
                  </div>
                </button>

                {/* Distribuição (ProJuris) — H5: mostra rapidamente quem é
                    executor e o código ProJuris. */}
                {u.participa_distribuicao ? (
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      color: "var(--gold-700)",
                      background: "rgba(212,168,50,0.08)",
                      border: "1px solid var(--border)",
                    }}
                    title="Participa da distribuição (motor ProJuris)"
                  >
                    Distribuição {u.projuris_responsavel_id ? `· ${u.projuris_responsavel_id}` : ""}
                  </span>
                ) : null}

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
                      perfil: u.perfil ?? "",
                      cargo: u.cargo ?? "",
                      unidadeOrg: u.unidade_organizacional ?? "",
                      statusProjuris: u.status_projuris ?? "",
                      peticionante: u.peticionante ?? false,
                      participaGeral: u.participa_distribuicao_padrao ?? false,
                      projurisId: u.projuris_responsavel_id ?? "",
                      participa: u.participa_distribuicao ?? false,
                      eligibleComplex: u.eligible_complex ?? true,
                      weight: String(u.weight ?? 100),
                    })
                  }
                  title="Editar dados e cargo"
                  className="text-muted-foreground hover:text-[var(--navy)] p-1.5 rounded-md shrink-0"
                >
                  <Pencil size={14} />
                </button>

                <button
                  onClick={() => handleStatus(u.id, suspended ? "ACTIVE" : "SUSPENDED")}
                  disabled={isSelf}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-[var(--border)] transition-colors hover:bg-black/[0.03] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{ color: suspended ? "var(--gold-700)" : "#b4232a" }}
                >
                  {suspended ? "Reativar" : "Suspender"}
                </button>

                <button
                  onClick={() =>
                    setDeleting({ id: u.id, name: u.full_name || u.email.split("@")[0] })
                  }
                  disabled={isSelf}
                  title="Excluir colaborador (reatribui o trabalho e remove o acesso)"
                  className="text-[#b4232a] hover:bg-[#b4232a]/10 p-1.5 rounded-md shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <DeleteUserDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        userId={deleting?.id ?? null}
        userName={deleting?.name ?? ""}
        users={(data ?? []).map((u) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
        }))}
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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

              {/* Cadastro do colaborador (M8) — Perfil / Cargo-nível / Unidade /
                  Status ProJuris + as DUAS flags do motor. */}
              <div className="border-t border-[var(--border)] pt-3 space-y-3">
                <p className="text-[12px] font-semibold text-[var(--navy)]">
                  Cadastro do colaborador
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Perfil</Label>
                    <Select
                      value={editing.perfil || NONE}
                      onValueChange={(v) => setEditing({ ...editing, perfil: v === NONE ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {PERFIL_OPTS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cargo / nível</Label>
                    <Select
                      value={editing.cargo || NONE}
                      onValueChange={(v) => setEditing({ ...editing, cargo: v === NONE ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {CARGO_OPTS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Unidade organizacional</Label>
                    <Input
                      value={editing.unidadeOrg}
                      onChange={(e) => setEditing({ ...editing, unidadeOrg: e.target.value })}
                      placeholder="Unidade / filial"
                    />
                  </div>
                  <div>
                    <Label>Status ProJuris</Label>
                    <Select
                      value={editing.statusProjuris || NONE}
                      onValueChange={(v) =>
                        setEditing({ ...editing, statusProjuris: v === NONE ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {STATUS_PROJURIS_OPTS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="mb-0">Peticionante</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Se desligado, o colaborador não entra no motor de distribuição.
                    </p>
                  </div>
                  <Switch
                    checked={editing.peticionante}
                    onCheckedChange={(v) => setEditing({ ...editing, peticionante: v })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="mb-0">Participa da distribuição geral</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Só quem participa entra na fila ordinária; os demais recebem só por exceção.
                    </p>
                  </div>
                  <Switch
                    checked={editing.participaGeral}
                    onCheckedChange={(v) => setEditing({ ...editing, participaGeral: v })}
                  />
                </div>
              </div>

              {/* Distribuição (ProJuris) — H5. Fonte da verdade do executor do
                  motor: ID ProJuris + participa + peso + elegível-complexo.
                  Grava em system_projuris_executor_mapping por executor_id. */}
              <div className="border-t border-[var(--border)] pt-3 space-y-3">
                <p className="text-[12px] font-semibold text-[var(--navy)]">
                  Distribuição (ProJuris)
                </p>
                <div>
                  <Label>Usuário no ProJuris</Label>
                  {/* 2026-08-27 — era campo de texto com placeholder "ex.: PES.0000030",
                      que ensinava o formato ERRADO: o motor faz Number() nesse campo e
                      "PES.0000040" vira NaN, então a tarefa nunca espelha, em silêncio.
                      Foi assim que 12 vínculos nasceram quebrados. Com a lista real não
                      há o que digitar errado. Se a API não responder, cai no campo de
                      texto para ninguém ficar travado. */}
                  {projurisUsuarios.isLoading ? (
                    <p className="text-[12px] text-muted-foreground py-2">
                      Carregando usuários do ProJuris…
                    </p>
                  ) : projurisUsuarios.data && projurisUsuarios.data.length > 0 ? (
                    <Select
                      value={editing.projurisId || "__none__"}
                      onValueChange={(v) =>
                        setEditing({ ...editing, projurisId: v === "__none__" ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem usuário no ProJuris" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem usuário no ProJuris</SelectItem>
                        {projurisUsuarios.data.map((u) => (
                          <SelectItem key={u.codigo} value={u.codigo}>
                            {u.nome} · {u.login}
                            {u.ativo ? "" : " (inativo lá)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <Input
                        value={editing.projurisId}
                        onChange={(e) => setEditing({ ...editing, projurisId: e.target.value })}
                        placeholder="ex.: 131019"
                      />
                      <p className="text-[11px] text-[var(--warning,#a16207)] mt-1">
                        Não consegui ler a lista do ProJuris agora. Digite o código numérico — o
                        formato antigo (PES.…) não funciona.
                      </p>
                    </>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Quem não tem usuário no ProJuris trabalha só pelo SHV — e está tudo certo: a
                    tarefa dele simplesmente não é espelhada lá.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="mb-0">Participa da distribuição</Label>
                  <Switch
                    checked={editing.participa}
                    onCheckedChange={(v) => setEditing({ ...editing, participa: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="mb-0">Elegível a tarefas complexas</Label>
                  <Switch
                    checked={editing.eligibleComplex}
                    onCheckedChange={(v) => setEditing({ ...editing, eligibleComplex: v })}
                  />
                </div>
                <div>
                  <Label>Peso na fila</Label>
                  <Input
                    type="number"
                    min="0"
                    max="200"
                    step="5"
                    value={editing.weight}
                    onChange={(e) => setEditing({ ...editing, weight: e.target.value })}
                  />
                  {/* M9 (2026-08-07) — base 100 = "distribui igual". */}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Padrão <strong>100</strong> = distribui igual. Reduza para quem está saindo
                    (recebe menos); aumente para quem está entrando/voltando. Vale já na próxima
                    rodada. Não confunda com tirar do rodízio (use a flag acima).
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Um usuário suspenso não distribui, mesmo com a flag ligada.
                </p>
              </div>

              {/* Permissões por aba do usuário (R3, 2026-07-19) — carrega/salva com
                  botão próprio, desacoplado do "Salvar" de perfil/cargo acima. Não
                  exibido para admin nem para você mesmo: um override só rebaixaria
                  (o admin já tem acesso total) e evita auto-bloqueio. */}
              <div className="border-t border-[var(--border)] pt-3">
                {editing.isSelf || editing.originalRole === "admin" ? (
                  <p className="text-[11.5px] text-muted-foreground">
                    Permissões por aba não se aplicam ao administrador nem ao seu próprio usuário.
                  </p>
                ) : (
                  <UserModulePermsEditor userId={editing.id} />
                )}
              </div>

              {/* Senha de acesso — admin define manualmente ou dispara e-mail de
                  redefinição para o colaborador (2026-08-12). */}
              <PasswordAdminSection userId={editing.id} email={editing.email} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={salvarPerfil}
              disabled={updateProfile.isPending || setRole.isPending || setDistribution.isPending}
            >
              {updateProfile.isPending || setRole.isPending || setDistribution.isPending
                ? "Salvando…"
                : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserReportDialog userId={report} onClose={() => setReport(null)} />
    </section>
  );
}
