// S5-02 (reunião 02/09) — PADRÃO DE ACESSO POR PAPEL (a matriz do Thiago).
//
// Thiago: "eu acho que a gente precisava de um menu de permissão do perfil, onde a
// gente pode configurar o que que o perfil em si vai ver".
// Adavio traduziu: "ele quer para todo o perfil, que hoje ele consegue editar para
// um usuário. Não para todo o papel."
//
// Como ler esta tela:
//   • cada célula é o padrão do PAPEL naquele módulo;
//   • "Padrão do sistema" (célula vazia) = o papel ainda usa a régua embutida no
//     código — é o estado de todos os papéis antigos até o de-para da S5-04;
//   • o override por USUÁRIO (na janela de cada pessoa) continua vencendo isto.

import { useMemo, useState } from "react";
import { AlertTriangle, Save, Users } from "lucide-react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRolePermsMatriz, useSetRolePerms } from "@/hooks/usePermissions";
import {
  MODULES,
  MODULE_LABELS,
  ROLES,
  ROLE_LABELS,
  type Module,
  type ModuleAccess,
  type Role,
} from "@/lib/rbac";

const HERDADO = "__herdado__";

const NIVEL_COR: Record<ModuleAccess, string> = {
  none: "text-muted-foreground",
  view: "text-[var(--navy)]",
  edit: "text-[var(--navy)] font-medium",
  configure: "text-[var(--gold-700)] font-semibold",
};

// Papéis legados aparecem no fim e sinalizados — some com o de-para (S5-04).
const LEGADOS: string[] = [
  "advogado_titular",
  "advogado_associado",
  "prestador_externo",
  "comercial",
];

export function RolePermsMatrix() {
  const { data, isLoading } = useRolePermsMatriz();
  const salvar = useSetRolePerms();

  // Edição por PAPEL: a pessoa mexe numa linha e salva aquela linha.
  const [rascunho, setRascunho] = useState<Record<string, Record<string, string>>>({});

  const atual = useMemo(() => {
    const m: Record<string, Partial<Record<Module, ModuleAccess>>> = {};
    for (const l of data?.linhas ?? []) {
      m[l.role] = { ...(m[l.role] ?? {}), [l.module]: l.access };
    }
    return m;
  }, [data]);

  const papeisOrdenados = useMemo(
    () => [...ROLES].sort((a, b) => Number(LEGADOS.includes(a)) - Number(LEGADOS.includes(b))),
    [],
  );

  function valorDaCelula(role: string, module: Module): string {
    const doRascunho = rascunho[role]?.[module];
    if (doRascunho !== undefined) return doRascunho;
    return atual[role]?.[module] ?? HERDADO;
  }

  function mudar(role: string, module: Module, valor: string) {
    setRascunho((r) => ({ ...r, [role]: { ...(r[role] ?? {}), [module]: valor } }));
  }

  const temMudanca = (role: string) => Object.keys(rascunho[role] ?? {}).length > 0;

  async function salvarLinha(role: string) {
    const mudancas = rascunho[role];
    if (!mudancas) return;

    // Aviso de impacto: quantas pessoas sentem esta mudança.
    const quantos = data?.usuariosPorPapel?.[role] ?? 0;
    const reduziu = Object.entries(mudancas).some(([mod, novo]) => {
      const antes = atual[role]?.[mod as Module];
      const escada = ["none", "view", "edit", "configure"];
      const nAntes = antes ? escada.indexOf(antes) : -1;
      const nNovo = novo === HERDADO ? -1 : escada.indexOf(novo);
      return nAntes >= 0 && nNovo >= 0 && nNovo < nAntes;
    });
    if (reduziu && quantos > 0) {
      const ok = window.confirm(
        `Esta mudança reduz o acesso de ${quantos} pessoa(s) com o papel "${
          ROLE_LABELS[role as Role] ?? role
        }". Continuar?`,
      );
      if (!ok) return;
    }

    const access: Record<string, string | null> = {};
    for (const [mod, valor] of Object.entries(mudancas)) {
      access[mod] = valor === HERDADO ? null : valor;
    }

    try {
      await salvar.mutateAsync({ role, access });
      setRascunho((r) => {
        const novo = { ...r };
        delete novo[role];
        return novo;
      });
      toast.success(`Padrão de "${ROLE_LABELS[role as Role] ?? role}" atualizado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar o padrão do papel");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-[12px] text-muted-foreground">
        Aqui você muda o padrão de <strong>todo mundo que tem o papel</strong>. O ajuste individual
        continua na janela de cada pessoa e <strong>vence este padrão</strong>. Célula em{" "}
        <em>Padrão do sistema</em> significa que aquele papel ainda usa a régua embutida no código.
      </div>

      <div className="card-editorial !p-0 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-[var(--card)]">
                Papel
              </th>
              {MODULES.map((m) => (
                <th
                  key={m}
                  className="px-3 py-3 font-medium text-muted-foreground whitespace-nowrap"
                >
                  {MODULE_LABELS[m]}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {papeisOrdenados.map((role) => {
              const quantos = data?.usuariosPorPapel?.[role] ?? 0;
              const legado = LEGADOS.includes(role);
              return (
                <tr
                  key={role}
                  className={`border-b border-[var(--border)] last:border-0 ${
                    legado ? "opacity-70" : ""
                  }`}
                >
                  <td className="px-4 py-3 sticky left-0 bg-[var(--card)]">
                    <div className="text-[var(--navy)] font-medium whitespace-nowrap">
                      {ROLE_LABELS[role as Role] ?? role}
                    </div>
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Users size={11} />
                      {quantos} pessoa(s)
                      {legado && " · legado"}
                    </div>
                  </td>

                  {MODULES.map((m) => {
                    const valor = valorDaCelula(role, m);
                    return (
                      <td key={m} className="px-3 py-2">
                        <Select value={valor} onValueChange={(v) => mudar(role, m, v)}>
                          <SelectTrigger
                            className={`h-8 text-[12px] ${
                              valor === HERDADO
                                ? "text-muted-foreground"
                                : NIVEL_COR[valor as ModuleAccess]
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={HERDADO}>Padrão do sistema</SelectItem>
                            <SelectItem value="none">Sem acesso</SelectItem>
                            <SelectItem value="view">Ver</SelectItem>
                            <SelectItem value="edit">Editar</SelectItem>
                            <SelectItem value="configure">Configurar</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    );
                  })}

                  <td className="px-4 py-2">
                    {temMudanca(role) && (
                      <Button
                        size="sm"
                        onClick={() => salvarLinha(role)}
                        disabled={salvar.isPending}
                      >
                        <Save size={13} className="mr-1.5" />
                        Salvar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <Eyebrow>Níveis</Eyebrow>
        <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
          <li>
            <strong className="text-[var(--navy)]">Ver</strong> — enxerga a aba, não altera nada.
          </li>
          <li>
            <strong className="text-[var(--navy)]">Editar</strong> — o dia a dia: preencher campos,
            mover card, anexar.
          </li>
          <li>
            <strong className="text-[var(--gold-700)]">Configurar</strong> — o estratégico: mudar
            tema, mexer na estrutura do módulo.
          </li>
        </ul>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <AlertTriangle size={12} />
          Reduzir o acesso de um papel afeta todas as pessoas que o têm — a tela avisa antes de
          salvar.
        </p>
      </div>
    </div>
  );
}
