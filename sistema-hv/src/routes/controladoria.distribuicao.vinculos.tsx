// Conferência de vínculo CASO ↔ PROCESSO do ProJuris.
//
// Sem esse vínculo, distribuir uma tarefa não tem onde criá-la lá — a decisão da
// controladoria fica presa dentro do SHV. Em 24/08 eram 233 casos nessa situação.
//
// A tela é de CONFERÊNCIA, não de automação: o sistema acha os processos do mesmo
// cliente e coloca os ativos na frente, mas quem escolhe é a pessoa. A medição do
// dia mostrou por quê — a maioria dos clientes tem vários processos ativos, e um
// palpite errado manda a tarefa para o processo de outra pessoa.

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Link2, Link2Off, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCasosSemProcesso,
  useRecarregarProcessos,
  useVincularCaso,
} from "@/hooks/useVinculoProcessos";
import { usePodeEditar } from "@/hooks/usePermissions";

export const Route = createFileRoute("/controladoria/distribuicao/vinculos")({
  component: VinculosPage,
});

type Filtro = "todos" | "com-candidato" | "sem-candidato";

function VinculosPage() {
  const podeEditar = usePodeEditar("controladoria");
  const { data: casos, isLoading, isError, error } = useCasosSemProcesso();
  const recarregar = useRecarregarProcessos();
  const vincular = useVincularCaso();

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("com-candidato");

  const { comCandidato, semCandidato } = useMemo(() => {
    const lista = casos ?? [];
    return {
      comCandidato: lista.filter((c) => c.candidatos.length > 0).length,
      semCandidato: lista.filter((c) => c.candidatos.length === 0).length,
    };
  }, [casos]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (casos ?? []).filter((c) => {
      if (filtro === "com-candidato" && c.candidatos.length === 0) return false;
      if (filtro === "sem-candidato" && c.candidatos.length > 0) return false;
      if (!termo) return true;
      return (
        c.clienteNome.toLowerCase().includes(termo) ||
        (c.caseCode ?? "").toLowerCase().includes(termo) ||
        (c.temaNome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [casos, busca, filtro]);

  async function aoVincular(casoId: string, codigoProcesso: number, rotulo: string) {
    try {
      await vincular.mutateAsync({ casoId, codigoProcesso });
      toast.success(`Caso vinculado a ${rotulo}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível vincular");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
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
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Enquanto o caso não apontar para um processo do ProJuris, a tarefa distribuída aqui não
            tem onde ser criada lá.
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
        <FiltroBotao atual={filtro} valor="com-candidato" ao={setFiltro}>
          Com processo do cliente ({comCandidato})
        </FiltroBotao>
        <FiltroBotao atual={filtro} valor="sem-candidato" ao={setFiltro}>
          Cliente não encontrado ({semCandidato})
        </FiltroBotao>
        <FiltroBotao atual={filtro} valor="todos" ao={setFiltro}>
          Todos ({(casos ?? []).length})
        </FiltroBotao>

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
            <li key={caso.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium">{caso.clienteNome || "(sem cliente)"}</span>
                {caso.caseCode && (
                  <span className="font-mono text-xs text-muted-foreground">{caso.caseCode}</span>
                )}
                {caso.temaNome && <Badge variant="secondary">{caso.temaNome}</Badge>}
              </div>

              {caso.candidatos.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Link2Off className="h-4 w-4" />
                  Nenhum processo desse cliente no ProJuris — provavelmente o cadastro só existe
                  aqui.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {caso.candidatos.map((p) => (
                    <li
                      key={p.codigo}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs">{p.identificador ?? p.codigo}</span>
                      <span className="text-muted-foreground">{p.assunto ?? "—"}</span>
                      {p.numeroCnj && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.numeroCnj}
                        </span>
                      )}
                      {p.combinaComTema && <Badge>combina com o tema</Badge>}
                      {p.encerrado && <Badge variant="outline">encerrado</Badge>}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        disabled={!podeEditar || vincular.isPending}
                        onClick={() =>
                          aoVincular(caso.id, p.codigo, p.identificador ?? String(p.codigo))
                        }
                      >
                        <Link2 className="mr-1.5 h-3.5 w-3.5" />
                        Vincular
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FiltroBotao({
  atual,
  valor,
  ao,
  children,
}: {
  atual: Filtro;
  valor: Filtro;
  ao: (v: Filtro) => void;
  children: React.ReactNode;
}) {
  return (
    <Button size="sm" variant={atual === valor ? "default" : "outline"} onClick={() => ao(valor)}>
      {children}
    </Button>
  );
}
