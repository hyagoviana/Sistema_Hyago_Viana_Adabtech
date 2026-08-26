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
import { useSetTemaContaAzul } from "@/hooks/useFinanceiroCaso";
import { useTemas } from "@/hooks/useTemas";

export function TemaContaAzulPanel({ temaId }: { temaId: string }) {
  const { data: temas } = useTemas();
  const salvar = useSetTemaContaAzul();

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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Centro de custo — ID no ContaAzul</Label>
          <Input value={ccId} onChange={(e) => setCcId(e.target.value)} placeholder="cole o ID" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Centro de custo — nome</Label>
          <Input
            value={ccNome}
            onChange={(e) => setCcNome(e.target.value)}
            placeholder="ex.: 1% ESF"
          />
        </div>
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

      <Button size="sm" onClick={handleSalvar} disabled={salvar.isPending}>
        {salvar.isPending ? "Salvando…" : "Salvar vínculo"}
      </Button>
    </div>
  );
}
