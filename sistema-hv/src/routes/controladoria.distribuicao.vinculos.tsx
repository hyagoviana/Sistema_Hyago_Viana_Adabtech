// Conferência de vínculo CASO ↔ PROCESSOS do ProJuris.
//
// Sem esse vínculo, distribuir uma tarefa não tem onde criá-la lá — a decisão da
// controladoria fica presa dentro do SHV.
//
// O modelo é o que o Thiago descreveu em 24/08: o ProJuris só tem processo
// JUDICIAL, o caso é nosso, e um caso pode ter VÁRIOS processos — o principal,
// os relacionados e os incidentais, que são os recursos. Por isso aqui se vincula
// quantos forem precisos, e não um só.
//
// E a escolha é MANUAL, também por decisão dele: "a gente vai selecionar quais os
// processos do ProJuris a gente quer vincular naquele caso (…) a gente vai
// resolver na mão". O sistema só ajuda a achar — sugere pelo tema e aceita busca
// pelo número de quem já sabe qual quer.

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Link2, Link2Off, RefreshCw, Search, Star, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBuscarProcesso,
  useCasosComProcessos,
  useDefinirPrincipal,
  useDesvincularProcesso,
  useRecarregarProcessos,
  useVincularProcesso,
} from "@/hooks/useVinculoProcessos";
import type { CasoComProcessos } from "@/hooks/useVinculoProcessos";
import { usePodeEditar } from "@/hooks/usePermissions";

export const Route = createFileRoute("/controladoria/distribuicao/vinculos")({
  component: VinculosPage,
});

type Filtro = "pendentes" | "vinculados";

function VinculosPage() {
  const podeEditar = usePodeEditar("controladoria");
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const somentePendentes = filtro === "pendentes";

  const { data: casos, isLoading, isError, error } = useCasosComProcessos(somentePendentes);
  const recarregar = useRecarregarProcessos(somentePendentes);

  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const lista = (casos ?? []).filter((c) =>
      filtro === "vinculados" ? c.vinculados.length > 0 : true,
    );
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter(
      (c) =>
        c.clienteNome.toLowerCase().includes(termo) ||
        (c.caseCode ?? "").toLowerCase().includes(termo) ||
        (c.temaNome ?? "").toLowerCase().includes(termo),
    );
  }, [casos, busca, filtro]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Falha ao carregar"}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Vincular casos a processos</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Um caso pode ter mais de um processo judicial — o principal e os recursos, que correm
            com número próprio. Vincule quantos forem necessários; o marcado com estrela é o que
            responde pelo caso no motor.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!podeEditar || recarregar.isPending}
          onClick={() => {
            recarregar
              .mutateAsync()
              .then(() => toast.success("Lista de processos atualizada"))
              .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar"));
          }}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${recarregar.isPending ? "animate-spin" : ""}`} />
          Atualizar do ProJuris
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={filtro === "pendentes" ? "default" : "outline"}
          onClick={() => setFiltro("pendentes")}
        >
          Sem processo
        </Button>
        <Button
          size="sm"
          variant={filtro === "vinculados" ? "default" : "outline"}
          onClick={() => setFiltro("vinculados")}
        >
          Já vinculados
        </Button>

        <div className="relative ml-auto w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Cliente, código do caso ou tema"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum caso nesta situação.
        </p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((caso) => (
            <CasoCard key={caso.id} caso={caso} podeEditar={podeEditar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CasoCard({ caso, podeEditar }: { caso: CasoComProcessos; podeEditar: boolean }) {
  const vincular = useVincularProcesso();
  const desvincular = useDesvincularProcesso();
  const definirPrincipal = useDefinirPrincipal();
  const [buscaManual, setBuscaManual] = useState("");
  const { data: achados, isFetching } = useBuscarProcesso(buscaManual);

  const ocupado = vincular.isPending || desvincular.isPending || definirPrincipal.isPending;

  async function aoVincular(codigo: number, rotulo: string) {
    try {
      await vincular.mutateAsync({ casoId: caso.id, codigoProcesso: codigo });
      toast.success(`${rotulo} vinculado`);
      setBuscaManual("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível vincular");
    }
  }

  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{caso.clienteNome || "(sem cliente)"}</span>
        {caso.caseCode && (
          <span className="font-mono text-xs text-muted-foreground">{caso.caseCode}</span>
        )}
        {caso.temaNome && <Badge variant="secondary">{caso.temaNome}</Badge>}
      </div>

      {/* ---- já vinculados ---- */}
      {caso.vinculados.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {caso.vinculados.map((v) => (
            <li
              key={v.codigo}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs">{v.identificador ?? v.codigo}</span>
              <span className="text-muted-foreground">{v.assunto ?? "—"}</span>
              {v.numeroCnj && (
                <span className="font-mono text-xs text-muted-foreground">{v.numeroCnj}</span>
              )}
              {v.principal ? (
                <Badge className="gap-1">
                  <Star className="h-3 w-3" />
                  principal
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={!podeEditar || ocupado}
                  onClick={() =>
                    definirPrincipal
                      .mutateAsync({ casoId: caso.id, codigoProcesso: v.codigo })
                      .then(() => toast.success("Principal atualizado"))
                      .catch((e) =>
                        toast.error(e instanceof Error ? e.message : "Falha ao definir"),
                      )
                  }
                >
                  tornar principal
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-7 w-7"
                title="Desvincular"
                disabled={!podeEditar || ocupado}
                onClick={() =>
                  desvincular
                    .mutateAsync({ casoId: caso.id, codigoProcesso: v.codigo })
                    .then(() => toast.success("Processo desvinculado"))
                    .catch((e) =>
                      toast.error(e instanceof Error ? e.message : "Falha ao desvincular"),
                    )
                }
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* ---- sugestões do mesmo cliente ---- */}
      {caso.candidatos.length > 0 && (
        <>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Processos deste cliente
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {caso.candidatos.map((p) => (
              <li
                key={p.codigo}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs">{p.identificador ?? p.codigo}</span>
                <span className="text-muted-foreground">{p.assunto ?? "—"}</span>
                {p.numeroCnj && (
                  <span className="font-mono text-xs text-muted-foreground">{p.numeroCnj}</span>
                )}
                {p.combinaComTema && <Badge>combina com o tema</Badge>}
                {p.encerrado && <Badge variant="outline">encerrado</Badge>}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={!podeEditar || ocupado}
                  onClick={() => aoVincular(p.codigo, p.identificador ?? String(p.codigo))}
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  Vincular
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {caso.candidatos.length === 0 && caso.vinculados.length === 0 && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Link2Off className="h-4 w-4" />
          Nenhum processo com esse nome de cliente no ProJuris. Procure pelo número abaixo.
        </p>
      )}

      {/* ---- busca por número ---- */}
      <div className="mt-3 border-t pt-3">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8 text-sm"
            placeholder="Procurar por número do processo, PRO.xxxx ou nome"
            value={buscaManual}
            onChange={(e) => setBuscaManual(e.target.value)}
          />
        </div>
        {buscaManual.trim().length >= 4 && (
          <ul className="mt-2 space-y-1.5">
            {isFetching && <li className="text-xs text-muted-foreground">procurando…</li>}
            {!isFetching && (achados ?? []).length === 0 && (
              <li className="text-xs text-muted-foreground">nenhum processo encontrado</li>
            )}
            {(achados ?? []).map((p) => (
              <li
                key={p.codigo}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs">{p.identificador ?? p.codigo}</span>
                <span className="text-muted-foreground">{p.nomeCliente.slice(0, 28)}</span>
                <span className="text-muted-foreground">{p.assunto ?? "—"}</span>
                {p.numeroCnj && (
                  <span className="font-mono text-xs text-muted-foreground">{p.numeroCnj}</span>
                )}
                {p.encerrado && <Badge variant="outline">encerrado</Badge>}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={!podeEditar || ocupado}
                  onClick={() => aoVincular(p.codigo, p.identificador ?? String(p.codigo))}
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  Vincular
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
