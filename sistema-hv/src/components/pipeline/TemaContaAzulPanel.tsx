// FN1 — Desenho 6 do doc "25.08 _ Financeiro SHV": vínculo do TEMA com o ContaAzul.
//
// Thiago: "Após criarmos as classificações no Contaazul, nessa opção aqui
// vinculamos manualmente qual o centro de custo / serviço é relacionado ao tema.
// Assim o SHV já tem nativamente a informação para o registro das despesas /
// receitas."
//
// É POR TEMA — ele repetiu isso na reunião: "sempre que a gente for trabalhar um
// tema, ele é para tudo. Ele vai tudo até para o financeiro (…) cria um tema
// aqui, vincula no centro de custo lá, que é o do tema."
//
// Nesta fase os campos são TEXTO: o ID vem do ContaAzul e é colado à mão. A FN2,
// se a API permitir listar centro de custo e serviço, troca por um seletor.

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCatalogoContaAzul,
  useSetTemaContaAzul,
  useSincronizarCategoriasContaAzul,
} from "@/hooks/useFinanceiroCaso";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemas } from "@/hooks/useTemas";

export function TemaContaAzulPanel({ temaId }: { temaId: string }) {
  const { data: temas } = useTemas();
  const salvar = useSetTemaContaAzul();
  const catalogo = useCatalogoContaAzul();
  const sinc = useSincronizarCategoriasContaAzul();

  async function handleSincronizar() {
    try {
      const r = (await sinc.mutateAsync()) as {
        vinculadas: number;
        jaVinculadas: number;
        desvinculadas: number;
        semParNoContaAzul: Array<{ codigo: string }>;
      };
      const faltam = r.semParNoContaAzul.length;
      toast.success(
        `${r.vinculadas + r.jaVinculadas} categoria(s) ligada(s) ao ContaAzul` +
          (faltam ? ` · ${faltam} ainda não existe(m) lá` : "") +
          (r.desvinculadas ? ` · ${r.desvinculadas} vínculo(s) solto(s) (sumiram de lá)` : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar");
    }
  }

  const tema = (
    temas as
      | Array<{
          id: string;
          contaazul_centro_custo_id?: string | null;
          contaazul_centro_custo_nome?: string | null;
          contaazul_servico_id?: string | null;
          contaazul_servico_nome?: string | null;
        }>
      | undefined
  )?.find((t) => t.id === temaId);

  const [ccId, setCcId] = useState("");
  const [ccNome, setCcNome] = useState("");
  const [svId, setSvId] = useState("");
  const [svNome, setSvNome] = useState("");

  useEffect(() => {
    setCcId(tema?.contaazul_centro_custo_id ?? "");
    setCcNome(tema?.contaazul_centro_custo_nome ?? "");
    setSvId(tema?.contaazul_servico_id ?? "");
    setSvNome(tema?.contaazul_servico_nome ?? "");
  }, [
    tema?.contaazul_centro_custo_id,
    tema?.contaazul_centro_custo_nome,
    tema?.contaazul_servico_id,
    tema?.contaazul_servico_nome,
  ]);

  async function handleSalvar() {
    try {
      await salvar.mutateAsync({
        temaId,
        centroCustoId: ccId.trim() || null,
        centroCustoNome: ccNome.trim() || null,
        servicoId: svId.trim() || null,
        servicoNome: svNome.trim() || null,
      });
      toast.success("Vínculo com o ContaAzul salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-muted-foreground">
        O centro de custo e o serviço do ContaAzul são <strong>um por tema</strong>. Com eles
        preenchidos, toda receita e despesa registrada num caso deste tema já sai classificada.
      </p>

      {/* FN2 (2026-08-28) — o cabeçalho deste arquivo prometia: "se a API permitir
          listar centro de custo e serviço, troca por um seletor". Permite (são 6
          centros de custo na conta do escritório), então cumprido: acabou a
          colagem de ID à mão, que era onde nascia erro silencioso. */}
      {catalogo.isLoading ? (
        <p className="text-[12px] text-muted-foreground">Carregando dados do ContaAzul…</p>
      ) : catalogo.data && catalogo.data.centros.length > 0 ? (
        <div className="space-y-1 max-w-md">
          <Label className="text-xs">Centro de custo no ContaAzul</Label>
          <Select
            value={ccId || "__sem__"}
            onValueChange={(v) => {
              const alvo = catalogo.data?.centros.find((c) => c.id === v);
              setCcId(v === "__sem__" ? "" : v);
              setCcNome(alvo?.nome ?? "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Escolha o centro de custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__sem__">— sem centro de custo</SelectItem>
              {catalogo.data.centros.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Centro de custo — ID no ContaAzul</Label>
            <Input value={ccId} onChange={(e) => setCcId(e.target.value)} placeholder="cole o ID" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Centro de custo — nome</Label>
            <Input value={ccNome} onChange={(e) => setCcNome(e.target.value)} />
          </div>
        </div>
      )}

      {/* Serviço segue como texto: a listagem da API devolve os itens sem um nome
          legível, então um seletor aqui mostraria códigos e seria pior que colar. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Serviço — ID no ContaAzul</Label>
          <Input value={svId} onChange={(e) => setSvId(e.target.value)} placeholder="cole o ID" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Serviço — nome</Label>
          <Input
            value={svNome}
            onChange={(e) => setSvNome(e.target.value)}
            placeholder="ex.: SERVIÇO TESTE"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={handleSalvar} disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar vínculo"}
        </Button>
        {/* Amarra as categorias do SHV às do ContaAzul pelo código. É global (não
            por tema), mas fica aqui porque é onde se configura o ContaAzul — e
            precisa ser rodado toda vez que o escritório cadastrar categoria nova lá. */}
        <Button size="sm" variant="outline" onClick={handleSincronizar} disabled={sinc.isPending}>
          {sinc.isPending ? "Conferindo…" : "Sincronizar categorias"}
        </Button>
      </div>
    </div>
  );
}
