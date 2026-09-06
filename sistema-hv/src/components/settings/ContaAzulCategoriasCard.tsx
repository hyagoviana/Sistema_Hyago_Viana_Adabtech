// CONFIGURAÇÕES › INTEGRAÇÕES — de-para das categorias financeiras com o Conta Azul.
//
// Pedido do Thiago (28/08), com as palavras dele:
//   "em uma tela de configuração da parte da integração do financeiro, a gente
//    tem como depois mudar qual categoria que fica vinculada a essas receitas,
//    essas despesas (…) a gente tem no sistema o tipo de receita que é entrada, e
//    isso vai estar vinculado com uma determinada categoria do CA. Se a gente tem
//    essa tela de configuração, a gente pode depois ir lá na mão e mudar (…) e
//    acaba trazendo um pouco mais de adaptabilidade pro longo prazo."
//
// A tela faz as duas coisas que ele pediu, nessa ordem de esforço:
//   1. "Buscar pelo código" resolve tudo que segue a numeração, de uma vez;
//   2. o seletor de cada linha cobre o resto — e é o que dá a adaptabilidade,
//      porque depois de amarrado à mão o nome e o número lá deixam de importar.
//
// Só as categorias FOLHA aceitam vínculo: as de nível 1 (4.01, 10.01) existem no
// Conta Azul para relatório e não recebem lançamento — oferecer vínculo nelas só
// geraria dúvida.

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCategoriasContaAzul,
  useFinCategorias,
  useSincronizarCategoriasContaAzul,
  useVincularCategoriaContaAzul,
} from "@/hooks/useFinanceiroCaso";

const SEM = "__sem__";

type Cat = {
  id: string;
  codigo: string;
  nome: string;
  kind: string;
  contaazul_id?: string | null;
  /** Vem pronto do serviço, calculado pela hierarquia real (parent_id). */
  folha?: boolean;
};

export function ContaAzulCategoriasCard({ podeEditar }: { podeEditar: boolean }) {
  const { data: locais, isLoading } = useFinCategorias();
  const catalogo = useCategoriasContaAzul();
  const sinc = useSincronizarCategoriasContaAzul();
  const vincular = useVincularCategoriaContaAzul();
  const [salvando, setSalvando] = useState<string | null>(null);

  const lista = ((locais ?? []) as Cat[]).slice().sort((a, b) => a.codigo.localeCompare(b.codigo));

  // Folha = onde o lançamento cai. Uso o campo que o serviço já calcula por
  // `parent_id`; deduzir pelo prefixo do código aqui dava um número diferente,
  // porque a numeração e a hierarquia gravada não são a mesma coisa.
  const folhas = lista.filter((c) => c.folha !== false);
  const vinculadas = folhas.filter((c) => c.contaazul_id).length;

  async function buscarPorCodigo() {
    try {
      const r = (await sinc.mutateAsync()) as {
        vinculadas: number;
        jaVinculadas: number;
        renomeadas: number;
        desvinculadas: number;
        semParNoContaAzul: Array<{ codigo: string }>;
      };
      const partes = [`${r.vinculadas + r.jaVinculadas} ligada(s)`];
      if (r.renomeadas) partes.push(`${r.renomeadas} nome(s) atualizado(s)`);
      if (r.desvinculadas) partes.push(`${r.desvinculadas} vínculo(s) solto(s)`);
      toast.success(partes.join(" · "));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao buscar");
    }
  }

  async function escolher(cat: Cat, contaazulId: string | null) {
    setSalvando(cat.id);
    try {
      const r = (await vincular.mutateAsync({ categoriaId: cat.id, contaazulId })) as
        | { ok: true }
        | { ok: false; motivo: string };
      if (r.ok) toast.success(contaazulId ? "Vínculo salvo" : "Vínculo removido");
      else toast.warning(r.motivo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="card-hero p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[15px] font-semibold text-[var(--navy)]">
            Categorias financeiras · Conta Azul
          </p>
          <p className="text-[12.5px] text-muted-foreground mt-1 max-w-2xl">
            Cada tipo de receita e despesa do sistema aponta para uma categoria do Conta Azul. É
            esse vínculo que faz o lançamento cair no lugar certo lá. Depois de amarrado, pode
            renomear a categoria no Conta Azul à vontade — a ligação continua valendo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={vinculadas === folhas.length ? "success" : "warning"}>
            {vinculadas} de {folhas.length}
          </Badge>
          {podeEditar && (
            <Button size="sm" variant="outline" onClick={buscarPorCodigo} disabled={sinc.isPending}>
              {sinc.isPending ? "Buscando…" : "Buscar pelo código"}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="space-y-1.5">
          {folhas.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_260px] gap-2 items-center rounded-md border border-[rgba(30,32,68,0.08)] px-3 py-2"
            >
              <div className="min-w-0">
                <span className="text-[13px] text-[var(--navy)]">
                  <span className="text-muted-foreground">{c.codigo}</span> {c.nome}
                </span>
                <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.kind === "RECEITA" ? "receita" : "despesa"}
                </span>
              </div>
              <Select
                value={c.contaazul_id ?? SEM}
                onValueChange={(v) => escolher(c, v === SEM ? null : v)}
                disabled={!podeEditar || salvando === c.id || catalogo.isLoading}
              >
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue placeholder={catalogo.isLoading ? "Carregando…" : "Sem vínculo"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>— sem vínculo</SelectItem>
                  {(catalogo.data ?? [])
                    // Só oferece categorias do MESMO tipo: ligar uma despesa a uma
                    // categoria de receita passaria despercebido aqui e viraria
                    // erro contábil lá.
                    .filter((o) => !o.tipo || o.tipo === c.kind)
                    .map((o) => (
                      <SelectItem key={o.id} value={o.id} className="text-[12px]">
                        {o.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      {!catalogo.isLoading && (catalogo.data ?? []).length === 0 && (
        <p className="text-[12px] text-[var(--warning,#a16207)]">
          Não consegui ler as categorias do Conta Azul agora. Verifique a conexão em Integrações.
        </p>
      )}
    </div>
  );
}
