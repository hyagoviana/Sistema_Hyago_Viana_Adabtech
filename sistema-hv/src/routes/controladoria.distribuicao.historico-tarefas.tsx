// HISTÓRICO DE TAREFAS — página 4 do doc "21.08 _ Controladoria".
//
// "nº identificador tarefa - processo X - tipo de Tarefa distribuída - Executor -
//  Situação - Data prevista - Data fatal - Regra de distribuição - Pontos"
//
// A "regra de distribuição" é o fluxo que o motor escolheu (GENERAL = fila
// normal, ABSOLUTE = responsável exclusivo, etc.).

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHistoricoTarefas } from "@/hooks/useDistribuicaoStaging";
import { useTaskTypesCatalog } from "@/hooks/useTaskTypes";

export const Route = createFileRoute("/controladoria/distribuicao/historico-tarefas")({
  component: HistoricoTarefasPage,
});

// Rótulos dos fluxos do motor, em português — na tela do doc isso é a "regra".
const REGRA_LABEL: Record<string, string> = {
  GENERAL: "Fila geral",
  ABSOLUTE: "Responsável exclusivo",
  COMPLEX: "Fila de complexos",
  PREFERENCE: "Preferência",
};

// `status` do banco → português.
const SITUACAO_LABEL: Record<string, string> = {
  ABERTA: "Na fila",
  DISTRIBUIDA: "Distribuída",
  CANCELADA: "Cancelada",
};

function fmt(d: string | null): string {
  if (!d) return "·";
  const iso = d.length > 10 ? d.slice(0, 10) : d;
  const [a, m, dia] = iso.split("-");
  return dia ? `${dia}/${m}/${a}` : iso;
}

function HistoricoTarefasPage() {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const { data: linhas, isLoading, isError } = useHistoricoTarefas(de || null, ate || null);
  const { data: tipos } = useTaskTypesCatalog({ estado: "todos" });

  const nomeTipo = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tipos ?? []) m.set(t.id, t.nome);
    return m;
  }, [tipos]);

  const totalPontos = (linhas ?? []).reduce((s, l) => s + Number(l.pontos ?? 0), 0);

  function exportarCSV() {
    const cab = "processo;tipo;executor;situacao;prevista;fatal;regra;pontos;distribuida_em";
    // Campo com ";" ou quebra de linha estouraria as colunas.
    const esc = (v: unknown) => {
      const t = String(v ?? "");
      return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const corpo = (linhas ?? []).map((l) =>
      [
        esc(l.numero_cnj),
        esc(l.task_type_id ? nomeTipo.get(l.task_type_id) : ""),
        esc(l.executor_nome),
        esc(SITUACAO_LABEL[l.situacao] ?? l.situacao),
        esc(l.data_prevista),
        esc(l.data_fatal),
        esc(l.regra ? (REGRA_LABEL[l.regra] ?? l.regra) : ""),
        esc(l.pontos),
        esc(l.data_distribuicao),
      ].join(";"),
    );
    // \uFEFF (BOM) faz o Excel pt-BR abrir os acentos corretamente.
    const blob = new Blob(["\uFEFF" + [cab, ...corpo].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historico-tarefas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Distribuídas de</Label>
          <Input
            type="date"
            className="w-[160px]"
            value={de}
            onChange={(e) => setDe(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">até</Label>
          <Input
            type="date"
            className="w-[160px]"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={exportarCSV} disabled={!linhas?.length}>
          <Download size={14} className="mr-1" /> CSV
        </Button>
        <div className="ml-auto text-[13px] text-muted-foreground">
          {(linhas ?? []).length} tarefa(s) · <strong>{totalPontos.toFixed(2)}</strong> pontos
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground">
        O que o motor efetivamente lançou nas agendas, com a regra que ele aplicou em cada caso.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md border border-[var(--danger)] p-6 text-[13px]">
          Não foi possível carregar o histórico. Tente recarregar a página.
        </div>
      ) : (linhas ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-[13px] text-muted-foreground">
          Nenhuma tarefa distribuída por este caminho no período. (As distribuições do batch
          automático aparecem na aba Lista.)
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Processo</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Executor</th>
                <th className="py-2 pr-3">Situação</th>
                <th className="py-2 pr-3">Prevista</th>
                <th className="py-2 pr-3">Fatal</th>
                <th className="py-2 pr-3">Regra</th>
                <th className="py-2">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {(linhas ?? []).map((l, i) => (
                <tr key={l.id} className="border-b border-[var(--border)] align-top">
                  {/* Numeração sequencial da própria lista: o identificador interno
                      é um UUID, que não diz nada para quem lê. */}
                  <td className="py-2.5 pr-3 text-[12px] text-muted-foreground">{i + 1}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{l.numero_cnj ?? "—"}</div>
                    {l.cliente_nome && (
                      <div className="text-[12px] text-muted-foreground">{l.cliente_nome}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    {l.task_type_id ? (nomeTipo.get(l.task_type_id) ?? "—") : "—"}
                  </td>
                  <td className="py-2.5 pr-3">{l.executor_nome ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <Badge variant="secondary">{SITUACAO_LABEL[l.situacao] ?? l.situacao}</Badge>
                  </td>
                  <td className="py-2.5 pr-3">{fmt(l.data_prevista)}</td>
                  <td className="py-2.5 pr-3">{fmt(l.data_fatal)}</td>
                  <td className="py-2.5 pr-3">
                    {l.regra ? (REGRA_LABEL[l.regra] ?? l.regra) : "—"}
                  </td>
                  <td className="py-2.5 font-medium">{l.pontos ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
