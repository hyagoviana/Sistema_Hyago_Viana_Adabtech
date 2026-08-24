// TELA 2 do motor (doc "21.08 _ Controladoria") — TAREFAS A DISTRIBUIR.
//
// "Nessa página, o sistema lista as tarefas indicadas manualmente como aptas a
//  distribuir. (…) Aqui ele atribui ponto / datas. (…) Nessa etapa também é
//  feita uma validação manual de poder alterar os dados identificados
//  automaticamente, conforme necessidade."
//
// Ou seja: o sistema preenche, a pessoa confere e corrige, e só então o botão
// [Distribuir tarefas] libera o motor para lançar nas agendas.

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useStaging,
  useUpdateStagingItem,
  useCancelStagingItem,
  useDistribuirStaging,
} from "@/hooks/useDistribuicaoStaging";
import { useTaskTypesCatalog } from "@/hooks/useTaskTypes";
import { useTemas } from "@/hooks/useTemas";
import { useAssignableUsers } from "@/hooks/useUsers";
import { usePodeEditar } from "@/hooks/usePermissions";

export const Route = createFileRoute("/controladoria/distribuicao/a-distribuir")({
  component: ADistribuirPage,
});

const SEM = "__sem__";

function ADistribuirPage() {
  const podeEditar = usePodeEditar("controladoria");
  const { data: itens, isLoading, isError, error } = useStaging("ABERTA");
  const { data: tipos } = useTaskTypesCatalog({ estado: "todos" });
  const { data: temas } = useTemas();
  const { data: users } = useAssignableUsers();

  const distribuir = useDistribuirStaging();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const nomeTipo = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tipos ?? []) m.set(t.id, t.nome);
    return m;
  }, [tipos]);
  const nomeTema = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of temas ?? []) m.set(t.id, t.name);
    return m;
  }, [temas]);

  const todosIds = (itens ?? []).map((i) => i.id);
  const todosMarcados = todosIds.length > 0 && todosIds.every((id) => selecionados.has(id));

  function toggle(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleDistribuir() {
    const loteInteiro = selecionados.size === 0;
    const ids = loteInteiro ? todosIds : [...selecionados];
    if (ids.length === 0) return toast.error("Nada para distribuir");
    // Distribuir lança tarefas na agenda de outras pessoas e não tem desfazer na
    // tela. Quando não há seleção, o clique vale para a fila TODA — isso precisa
    // ser dito antes, não depois.
    if (loteInteiro && !window.confirm(`Distribuir todas as ${ids.length} tarefas da fila?`))
      return;
    try {
      const r = await distribuir.mutateAsync({ ids });
      toast.success(
        `${r.distribuidas} tarefa(s) distribuída(s)${r.bloqueadas ? ` · ${r.bloqueadas} bloqueada(s)` : ""}`,
      );
      setSelecionados(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao distribuir");
    }
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[13px] text-muted-foreground flex-1">
          {(itens ?? []).length} tarefa(s) aguardando revisão.{" "}
          {selecionados.size > 0 && <strong>{selecionados.size} selecionada(s).</strong>}
        </div>
        {podeEditar && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelecionados(todosMarcados ? new Set() : new Set(todosIds))}
            >
              {todosMarcados ? "Desmarcar todas" : "Marcar todas"}
            </Button>
            <Button onClick={handleDistribuir} disabled={distribuir.isPending || !todosIds.length}>
              <Play size={14} className="mr-1" />
              {distribuir.isPending
                ? "Distribuindo…"
                : selecionados.size > 0
                  ? `Distribuir ${selecionados.size} selecionada(s)`
                  : `Distribuir as ${todosIds.length} da fila`}
            </Button>
          </>
        )}
      </div>

      <p className="text-[12px] text-muted-foreground max-w-3xl">
        O sistema já preencheu as variáveis a partir do tipo de tarefa e do caso. Confira e ajuste o
        que for exceção — <em>este caso não é urgente</em>, <em>este é coletivo</em> — antes de
        liberar. O motor só roda quando você clica em "Distribuir tarefas".
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md border border-[var(--danger)] p-6 text-[13px]">
          Não foi possível carregar a fila.{" "}
          {error instanceof Error ? error.message : "Tente recarregar a página."}
        </div>
      ) : (itens ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-[13px] text-muted-foreground">
          Nenhuma tarefa aguardando. Marque "Distribuir tarefa" em Andamentos pendentes.
        </div>
      ) : (
        <div className="space-y-3">
          {(itens ?? []).map((it) => (
            <LinhaStaging
              key={it.id}
              item={it}
              marcado={selecionados.has(it.id)}
              onToggle={() => toggle(it.id)}
              podeEditar={podeEditar}
              nomeTipo={nomeTipo.get(it.task_type_id ?? "") ?? "Sem tipo"}
              nomeTema={nomeTema.get(it.tema_id ?? "") ?? "Sem tema"}
              users={users ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaStaging({
  item,
  marcado,
  onToggle,
  podeEditar,
  nomeTipo,
  nomeTema,
  users,
}: {
  item: {
    id: string;
    numero_cnj: string | null;
    cliente_nome: string | null;
    coletivo: boolean;
    complexo: boolean;
    urgente: boolean;
    exclusive_executor_id: string | null;
    data_prevista: string | null;
    data_fatal: string | null;
    pontos: number | null;
  };
  marcado: boolean;
  onToggle: () => void;
  podeEditar: boolean;
  nomeTipo: string;
  nomeTema: string;
  users: Array<{ id: string; full_name: string | null; email: string }>;
}) {
  const salvar = useUpdateStagingItem();
  const cancelar = useCancelStagingItem();

  async function patch(p: Record<string, unknown>) {
    try {
      await salvar.mutateAsync({ id: item.id, patch: p });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  return (
    <div className="rounded-md border border-[var(--border)] p-4 space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={marcado}
          onChange={onToggle}
          disabled={!podeEditar}
          aria-label="Selecionar tarefa"
        />
        <div className="flex-1 min-w-[220px]">
          <div className="text-[14px] font-medium">{nomeTipo}</div>
          <div className="text-[12px] text-muted-foreground">
            {item.numero_cnj ?? "sem CNJ"}
            {item.cliente_nome ? ` · ${item.cliente_nome}` : ""} · {nomeTema}
          </div>
        </div>
        <Badge variant="secondary">{item.pontos ?? 0} pts</Badge>
        {podeEditar && (
          <Button
            variant="ghost"
            size="sm"
            disabled={cancelar.isPending}
            onClick={async () => {
              try {
                await cancelar.mutateAsync({ id: item.id });
                toast.success("Removida da fila");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Falha ao remover");
              }
            }}
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {/* Marcadores — o sistema sugeriu; a pessoa confirma ou inverte. */}
        <div className="flex gap-2">
          {(
            [
              ["coletivo", "Coletivo", item.coletivo],
              ["complexo", "Complexo", item.complexo],
              ["urgente", "Urgente", item.urgente],
            ] as const
          ).map(([campo, rotulo, valor]) => (
            <Button
              key={campo}
              type="button"
              size="sm"
              variant={valor ? "default" : "outline"}
              disabled={!podeEditar || salvar.isPending}
              onClick={() => patch({ [campo]: !valor })}
            >
              {rotulo}
            </Button>
          ))}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Prevista</Label>
          <Input
            type="date"
            className="w-[150px]"
            defaultValue={item.data_prevista ?? ""}
            disabled={!podeEditar}
            onBlur={(e) => patch({ data_prevista: e.target.value || null })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fatal</Label>
          <Input
            type="date"
            className="w-[150px]"
            defaultValue={item.data_fatal ?? ""}
            disabled={!podeEditar}
            onBlur={(e) => patch({ data_fatal: e.target.value || null })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pontos</Label>
          <Input
            className="w-[90px]"
            inputMode="decimal"
            defaultValue={String(item.pontos ?? "")}
            disabled={!podeEditar}
            onBlur={(e) => {
              // Teclado pt-BR oferece vírgula; sem isto "1,5" virava null.
              const n = Number(e.target.value.replace(",", "."));
              patch({ pontos: Number.isFinite(n) ? n : null });
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Responsável exclusivo</Label>
          <Select
            value={item.exclusive_executor_id ?? SEM}
            disabled={!podeEditar}
            onValueChange={(v) => patch({ exclusive_executor_id: v === SEM ? null : v })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM}>Distribuição normal</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name ?? u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
