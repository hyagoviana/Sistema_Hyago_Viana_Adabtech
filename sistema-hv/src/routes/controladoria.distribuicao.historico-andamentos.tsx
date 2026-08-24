// HISTÓRICO DE ANDAMENTOS — página 3 do doc "21.08 _ Controladoria".
//
// "Andamento 1 - processo X - DATA - DISTRIBUIDO TAREFA X - Data análise"
//   · DATA          = quando o ProJuris registrou (data de referência)
//   · Data análise  = quando a pessoa da controladoria decidiu
//   · filtro pela data referência-projuris
//
// É o espelho da tela 1 depois da decisão: o que entrou, o que foi feito, quando.

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";

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
import { useHistoricoAndamentos } from "@/hooks/useDistribuicaoStaging";
import { useTaskTypesCatalog } from "@/hooks/useTaskTypes";

export const Route = createFileRoute("/controladoria/distribuicao/historico-andamentos")({
  component: HistoricoAndamentosPage,
});

const TODAS = "__todas__";

const DECISAO_LABEL: Record<string, string> = {
  ARQUIVADO: "Arquivado",
  LIDO: "Marcado lido",
  DISTRIBUIR: "Distribuiu tarefa",
};

function fmt(d: string | null): string {
  if (!d) return "·";
  const iso = d.length > 10 ? d.slice(0, 10) : d;
  const [a, m, dia] = iso.split("-");
  return dia ? `${dia}/${m}/${a}` : iso;
}

function HistoricoAndamentosPage() {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [decisao, setDecisao] = useState(TODAS);

  const {
    data: linhas,
    isLoading,
    isError,
  } = useHistoricoAndamentos(de || null, ate || null, decisao === TODAS ? null : decisao);
  const { data: tipos } = useTaskTypesCatalog({ estado: "todos" });

  const nomeTipo = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tipos ?? []) m.set(t.id, t.nome);
    return m;
  }, [tipos]);

  function exportarCSV() {
    const cab = "processo;data_projuris;decisao;tipo_tarefa;data_analise;quem;no_projuris";
    const esc = (v: unknown) => {
      const t = String(v ?? "");
      return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const corpo = (linhas ?? []).map((l) =>
      [
        esc(l.numero_cnj),
        esc(l.data_referencia),
        esc(DECISAO_LABEL[l.decisao] ?? l.decisao),
        esc(l.task_type_id ? nomeTipo.get(l.task_type_id) : ""),
        esc(l.decidido_em),
        esc(l.decidido_por_nome),
        l.projuris_sync_at ? "sim" : "não",
      ].join(";"),
    );
    // BOM p/ o Excel pt-BR não quebrar os acentos.
    const blob = new Blob(["\uFEFF" + [cab, ...corpo].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historico-andamentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Data ProJuris — de</Label>
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
        <div className="space-y-1">
          <Label className="text-xs">Decisão</Label>
          <Select value={decisao} onValueChange={setDecisao}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              <SelectItem value="DISTRIBUIR">Distribuiu tarefa</SelectItem>
              <SelectItem value="ARQUIVADO">Arquivado</SelectItem>
              <SelectItem value="LIDO">Marcado lido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportarCSV} disabled={!linhas?.length}>
          <Download size={14} className="mr-1" /> CSV
        </Button>
      </div>

      <p className="text-[12px] text-muted-foreground">
        Tudo que passou pela análise da controladoria: quando o ProJuris registrou, o que foi
        decidido e quando a decisão foi tomada.
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
          Nada analisado neste período.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Processo</th>
                <th className="py-2 pr-3">Data ProJuris</th>
                <th className="py-2 pr-3">Decisão</th>
                <th className="py-2 pr-3">Tarefa distribuída</th>
                <th className="py-2 pr-3">Data da análise</th>
                <th className="py-2 pr-3">Quem</th>
                <th className="py-2">ProJuris</th>
              </tr>
            </thead>
            <tbody>
              {(linhas ?? []).map((l) => (
                <tr key={l.id} className="border-b border-[var(--border)] align-top">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{l.numero_cnj ?? "—"}</div>
                    {l.cliente_nome && (
                      <div className="text-[12px] text-muted-foreground">{l.cliente_nome}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">{fmt(l.data_referencia)}</td>
                  <td className="py-2.5 pr-3">
                    <Badge variant="secondary">{DECISAO_LABEL[l.decisao] ?? l.decisao}</Badge>
                  </td>
                  <td className="py-2.5 pr-3">
                    {l.task_type_id ? (nomeTipo.get(l.task_type_id) ?? "—") : "—"}
                  </td>
                  <td className="py-2.5 pr-3">{fmt(l.decidido_em)}</td>
                  <td className="py-2.5 pr-3">{l.decidido_por_nome ?? "—"}</td>
                  <td className="py-2.5">
                    {l.projuris_sync_at ? (
                      <Badge variant="secondary">refletido</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
