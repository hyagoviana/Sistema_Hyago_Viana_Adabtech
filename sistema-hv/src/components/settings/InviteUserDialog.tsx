import { useState } from "react";
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
import { useInviteUser, useProjurisUsuarios, useSetUserDistribution } from "@/hooks/useUsers";
import { useSetUserModulePerms } from "@/hooks/usePermissions";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";
import { CARGO_OPTS, NONE, PERFIL_OPTS, STATUS_PROJURIS_OPTS } from "@/lib/cadastro-colaborador";

import { ModulePermsGrid, type ModulePermsValue } from "./ModulePermsGrid";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// admin não é atribuível por convite — evita escalada acidental de privilégio.
const ASSIGNABLE: Role[] = ROLES.filter((r) => r !== "admin");

export function InviteUserDialog({ open, onOpenChange }: Props) {
  const invite = useInviteUser();
  const setPerms = useSetUserModulePerms();
  const setDistribution = useSetUserDistribution();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("operacional");
  // Overrides por aba definidos JÁ no convite (2026-07-19). Vazio = tudo no
  // padrão do papel escolhido.
  const [modulePerms, setModulePerms] = useState<ModulePermsValue>({ access: {}, values: {} });
  // Cadastro do colaborador (M8) — igualar a tela de convite à de editar.
  const [perfil, setPerfil] = useState("");
  const [cargo, setCargo] = useState("");
  const [unidadeOrg, setUnidadeOrg] = useState("");
  const [statusProjuris, setStatusProjuris] = useState("");
  const [peticionante, setPeticionante] = useState(false);
  const [participaGeral, setParticipaGeral] = useState(false);
  // Distribuição (ProJuris) — H5.
  const [projurisId, setProjurisId] = useState("");
  // Lista do ProJuris só quando o diálogo está aberto (chamada externa + auth).
  const projurisUsuarios = useProjurisUsuarios(open);
  const [participaDist, setParticipaDist] = useState(false);
  const [eligibleComplex, setEligibleComplex] = useState(true);
  // M9 — peso em base 100 (100 = distribui igual).
  const [weight, setWeight] = useState("100");

  function reset() {
    setEmail("");
    setFullName("");
    setRole("operacional");
    setModulePerms({ access: {}, values: {} });
    setPerfil("");
    setCargo("");
    setUnidadeOrg("");
    setStatusProjuris("");
    setPeticionante(false);
    setParticipaGeral(false);
    setProjurisId("");
    setParticipaDist(false);
    setEligibleComplex(true);
    setWeight("100");
  }

  async function handleConfirm() {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (participaDist && !projurisId.trim()) {
      toast.error("Informe o ID ProJuris antes de marcar como participante da distribuição.");
      return;
    }
    try {
      const created = await invite.mutateAsync({
        email: cleanEmail,
        full_name: fullName.trim() || undefined,
        role,
        redirectTo: `${window.location.origin}/nova-senha`,
        // Cadastro do colaborador (M8) — gravado já no convite.
        perfil: perfil || null,
        cargo: cargo || null,
        unidade_organizacional: unidadeOrg.trim() || null,
        status_projuris: statusProjuris || null,
        peticionante,
        participa_distribuicao_padrao: participaGeral,
      });
      // Grava os overrides por aba definidos no convite. O usuário já existe em
      // system_users (status INVITED), então o user_id está disponível. Se essa
      // etapa falhar, o convite já foi enviado — avisamos sem reverter.
      const hasOverrides =
        Object.values(modulePerms.access).some((v) => v != null) ||
        Object.values(modulePerms.values).some((v) => v != null);
      if (created?.id && hasOverrides) {
        try {
          await setPerms.mutateAsync({
            userId: created.id,
            access: modulePerms.access,
            values: modulePerms.values,
          });
        } catch {
          toast.warning(
            "Convite enviado, mas não consegui salvar as permissões por aba. Ajuste na tela de Permissões.",
          );
          reset();
          onOpenChange(false);
          return;
        }
      }
      // Distribuição (ProJuris) — H5. Mesmo padrão do setPerms: se falhar, o
      // convite já foi enviado; avisamos sem reverter.
      if (created?.id && (projurisId.trim() || participaDist)) {
        try {
          const w = parseFloat(weight);
          await setDistribution.mutateAsync({
            id: created.id,
            projuris_responsavel_id: projurisId.trim() || null,
            participa: participaDist,
            weight: Number.isFinite(w) && w > 0 ? w : 1.0,
            eligible_complex: eligibleComplex,
          });
        } catch {
          toast.warning(
            "Convite enviado, mas não consegui salvar a distribuição (ProJuris). Ajuste em Editar usuário.",
          );
          reset();
          onOpenChange(false);
          return;
        }
      }
      toast.success(`Convite enviado para ${cleanEmail}`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao convidar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : (reset(), onOpenChange(o)))}>
      <DialogContent className="sm:max-w-[480px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>
            Enviamos um e-mail de convite. O acesso fica restrito ao papel e às permissões por aba
            escolhidas abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-[12.5px] font-medium text-[var(--navy)] mb-1">E-mail</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@escritorio.com"
              className="w-full px-3 py-2.5 bg-white border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <p className="text-[12.5px] font-medium text-[var(--navy)] mb-1">Nome (opcional)</p>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
              className="w-full px-3 py-2.5 bg-white border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <p className="text-[12.5px] font-medium text-[var(--navy)] mb-1">Papel</p>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cadastro do colaborador (M8) — mesmos campos da tela de editar. */}
          <div className="border-t border-[var(--border)] pt-3 space-y-3">
            <p className="text-[12px] font-semibold text-[var(--navy)]">Dados do colaborador</p>
            <p className="text-[11px] text-muted-foreground -mt-2">
              Informação de cadastro. Nada aqui muda permissão nem afeta o motor.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Perfil</Label>
                <Select
                  value={perfil || NONE}
                  onValueChange={(v) => setPerfil(v === NONE ? "" : v)}
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
                <Label>Cargo</Label>
                <Select value={cargo || NONE} onValueChange={(v) => setCargo(v === NONE ? "" : v)}>
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
                  value={unidadeOrg}
                  onChange={(e) => setUnidadeOrg(e.target.value)}
                  placeholder="Unidade / filial"
                />
              </div>
              <div>
                <Label>Status ProJuris</Label>
                <Select
                  value={statusProjuris || NONE}
                  onValueChange={(v) => setStatusProjuris(v === NONE ? "" : v)}
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
          </div>

          {/* Distribuição (ProJuris) — H5. */}
          <div className="border-t border-[var(--border)] pt-3 space-y-3">
            <p className="text-[12px] font-semibold text-[var(--navy)]">Motor de distribuição</p>
            <div>
              <Label>Usuário no ProJuris</Label>
              {/* 2026-08-27 — mesma troca feita no UsersAdmin: o campo era texto
                  livre com placeholder no formato antigo (PES.…), que o motor não
                  lê. Escolher da lista real elimina a digitação errada. */}
              {projurisUsuarios.data && projurisUsuarios.data.length > 0 ? (
                <Select
                  value={projurisId || "__none__"}
                  onValueChange={(v) => setProjurisId(v === "__none__" ? "" : v)}
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
                <Input
                  value={projurisId}
                  onChange={(e) => setProjurisId(e.target.value)}
                  placeholder="ex.: 131019"
                />
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Quem não tem usuário no ProJuris trabalha só pelo SHV.
              </p>
            </div>
            {/* Mesma reorganização do UsersAdmin (2026-08-27): os interruptores do
                motor ficam juntos, e "geral" × "do ProJuris" ganham nomes que os
                distinguem de fato. As duas telas têm de contar a mesma história. */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="mb-0">Peticionante</Label>
                <p className="text-[11px] text-muted-foreground">
                  Se desligado, não entra no motor de jeito nenhum.
                </p>
              </div>
              <Switch checked={peticionante} onCheckedChange={setPeticionante} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="mb-0">Entra na fila ordinária</Label>
                <p className="text-[11px] text-muted-foreground">
                  Desligado, só recebe tarefa por exceção (executor exclusivo).
                </p>
              </div>
              <Switch checked={participaGeral} onCheckedChange={setParticipaGeral} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="mb-0">Vínculo com o ProJuris ativo</Label>
                <p className="text-[11px] text-muted-foreground">
                  Desligado, a tarefa dela não é criada nem atualizada no ProJuris.
                </p>
              </div>
              <Switch checked={participaDist} onCheckedChange={setParticipaDist} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="mb-0">Elegível a tarefas complexas</Label>
                <p className="text-[11px] text-muted-foreground">
                  Desligado, o motor não manda o que está marcado como complexo.
                </p>
              </div>
              <Switch checked={eligibleComplex} onCheckedChange={setEligibleComplex} />
            </div>
            <div>
              <Label>Peso na fila</Label>
              <Input
                type="number"
                min="0"
                max="200"
                step="5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Padrão <strong>100</strong> = distribui igual.
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <ModulePermsGrid
              value={modulePerms}
              onChange={setModulePerms}
              disabled={invite.isPending || setPerms.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={invite.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={invite.isPending}>
            {invite.isPending ? "Enviando…" : "Enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
