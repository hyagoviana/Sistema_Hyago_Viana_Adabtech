// S6-01 (reunião 02/09) — CASOS PRIORITÁRIOS da controladoria.
//
// Thiago: "Vamos adicionar uma nova página vinculada a controladoria, em que
// teremos uma listagem e algumas informações de processos prioritários. (…) Se o
// caso prioritário possui mais de 1 processo judicial / recurso, todos eles são
// listados aqui 1 por 1 (…) Como data de última movimentação administrativa,
// vamos considerar a data de última mudança de etapa do caso."
//
// A pergunta que a tela responde é "o que está parado?" — por isso a ordenação
// padrão é pelo MAIS PARADO (feita no servidor) e o destaque é por dias sem
// movimentação.
//
// "Prioritário" = a urgência que já existe no caso (decisão do owner, 03/09).
// Quem marca é o menu do caso; aqui só espelhamos.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Gavel, Star } from "lucide-react";

import { Breadcrumb, Eyebrow, PageHeader } from "@/components/hv/primitives";
import { Badge } from "@/components/ui/badge";
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
import { useCasosPrioritarios, type PrioritarioRow } from "@/hooks/usePrioritarios";
import { useDocumentTitle } from "@/lib/use-document-title";

export const Route = createFileRoute("/controladoria/prioritarios")({
  component: PrioritariosPage,
});

const TODOS = "__todos__";

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Data + "há N dias", com destaque quando passa do limiar. */
function CelulaData({ iso, limiar }: { iso: string | null; limiar: number }) {
  const dias = diasDesde(iso);
  const parado = dias !== null && dias >= limiar;
  return (
    <div className="whitespace-nowrap">
      <div className={parado ? "font-semibold text-[var(--danger)]" : "text-[var(--navy)]"}>
        {dataBr(iso)}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {dias === null ? "sem registro" : `há ${dias} dia(s)`}
      </div>
    </div>
  );
}

function PrioritariosPage() {
  useDocumentTitle("Casos prioritários");
  const navigate = useNavigate();
  const { data: linhas, isLoading } = useCasosPrioritarios();

  const [tema, setTema] = useState(TODOS);
  const [responsavel, setResponsavel] = useState(TODOS);
  const [urgencia, setUrgencia] = useState(TODOS);
  // Limiar de "parado" — o Thiago não fixou número; começa em 30 dias e quem
  // olha ajusta na própria tela.
  const [limiar, setLimiar] = useState(30);

  const todas = useMemo(() => linhas ?? [], [linhas]);

  const temas = useMemo(
    () => [...new Set(todas.map((l) => l.tema_nome).filter(Boolean))].sort() as string[],
    [todas],
  );
  const responsaveis = useMemo(
    () => [...new Set(todas.flatMap((l) => l.responsaveis))].sort(),
    [todas],
  );

  const filtradas = useMemo(() => {
    return todas.filter((l) => {
      if (tema !== TODOS && l.tema_nome !== tema) return false;
      if (urgencia !== TODOS && l.urgencia !== urgencia) return false;
      if (responsavel !== TODOS && !l.responsaveis.includes(responsavel)) return false;
      return true;
    });
  }, [todas, tema, urgencia, responsavel]);

  // "Parado" = a movimentação MAIS RECENTE (judicial ou administrativa) já passou
  // do limiar. Linha sem movimentação nenhuma conta como parada.
  const paradas = useMemo(() => {
    return filtradas.filter((l) => {
      const dj = diasDesde(l.ultima_mov_judicial);
      const da = diasDesde(l.ultima_mov_administrativa);
      const maisRecente = Math.min(dj ?? Infinity, da ?? Infinity);
      return maisRecente === Infinity || maisRecente >= limiar;
    }).length;
  }, [filtradas, limiar]);

  function abrirCaso(l: PrioritarioRow, judicial: boolean) {
    navigate({
      to: judicial ? "/casos/$id/judicial" : "/casos/$id",
      params: { id: l.case_id },
    });
  }

  return (
    <div className="page-container">
      <Breadcrumb
        items={[{ label: "Controladoria", to: "/controladoria" }, { label: "Casos prioritários" }]}
      />
      <PageHeader
        eyebrow="Controladoria"
        title="Casos prioritários"
        subtitle="Casos marcados como prioritário ou urgente, do mais parado para o mais recente. Um processo judicial por linha."
      />

      {/* Filtros */}
      <div className="card-editorial !p-4 mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-[12px]">Tema</Label>
          <Select value={tema} onValueChange={setTema}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {temas.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[12px]">Responsável</Label>
          <Select value={responsavel} onValueChange={setResponsavel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {responsaveis.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[12px]">Urgência</Label>
          <Select value={urgencia} onValueChange={setUrgencia}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="prioritario">Prioritário</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[12px]">Sem movimentação há (dias)</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={limiar}
            onChange={(e) => setLimiar(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : todas.length === 0 ? (
        <div className="card-editorial !p-8 text-center">
          <Star size={28} className="mx-auto mb-3 text-muted-foreground/60" />
          <div className="text-[14px] font-medium text-[var(--navy)]">
            Nenhum caso marcado como prioritário
          </div>
          <p className="mx-auto mt-1 max-w-[420px] text-[12.5px] text-muted-foreground">
            A marcação é a urgência do caso. Abra o caso, use “Editar caso” e escolha{" "}
            <strong>Prioritário</strong> ou <strong>Urgente</strong> — ele passa a aparecer aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[12.5px] text-muted-foreground">
            <span>
              <strong className="text-[var(--navy)]">{filtradas.length}</strong> linha(s)
            </span>
            {paradas > 0 && (
              <span className="inline-flex items-center gap-1 text-[var(--danger)]">
                <AlertTriangle size={13} /> {paradas} sem movimentação há {limiar}+ dias
              </span>
            )}
          </div>

          <div className="card-editorial !p-0 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Caso</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Tema</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Urgência</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Processo</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Últ. mov. judicial
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Últ. mov. administrativa
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l, i) => (
                  <tr
                    key={`${l.case_id}-${l.numero_processo ?? "sem-processo"}-${i}`}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/50 cursor-pointer"
                    onClick={() => abrirCaso(l, false)}
                  >
                    <td className="px-4 py-3 text-[var(--navy)]">{l.client_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="text-[var(--navy)] font-medium">
                        {l.case_name ?? l.case_code}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{l.case_code}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.tema_nome ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          l.urgencia === "urgente"
                            ? "bg-[var(--danger)] text-white"
                            : "bg-[var(--gold)] text-white"
                        }
                      >
                        {l.urgencia === "urgente" ? "Urgente" : "Prioritário"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {l.numero_processo ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirCaso(l, true);
                          }}
                          className="inline-flex items-center gap-1.5 text-[var(--gold-700)] hover:underline"
                          title="Abrir a aba Judicial do caso"
                        >
                          <Gavel size={13} />
                          <span className="font-mono text-[12px]">{l.numero_processo}</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground">
                          administrativo
                          <span className="block text-[11px]">sem processo judicial</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CelulaData iso={l.ultima_mov_judicial} limiar={limiar} />
                    </td>
                    <td className="px-4 py-3">
                      <CelulaData iso={l.ultima_mov_administrativa} limiar={limiar} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.responsaveis.length ? l.responsaveis.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtradas.length === 0 && (
            <div className="card-editorial !p-6 mt-3 text-center text-[13px] text-muted-foreground">
              Nenhuma linha com os filtros atuais.
            </div>
          )}

          <div className="mt-4">
            <Eyebrow>Como ler</Eyebrow>
            <p className="mt-1 max-w-3xl text-[12px] text-muted-foreground">
              A <strong>movimentação administrativa</strong> é a data da última mudança de etapa do
              caso — vale para o caso inteiro. A <strong>movimentação judicial</strong> é individual
              de cada processo, por isso um caso com vários processos aparece em várias linhas.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
