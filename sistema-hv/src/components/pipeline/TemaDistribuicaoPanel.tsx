// Parâmetros do TEMA no motor de distribuição, dentro da configuração do tema.
//
// Doc "21.08 _ Controladoria": a configuração do tema deve ficar em um só lugar,
// unindo "o que já existe aqui (que serve para tarefas, distribuição e etc.) com
// as configurações que são para casos (pasta, etc.)". Este painel é a parte de
// distribuição — os mesmos campos da aba Temas do motor, agora ao lado dos
// campos da ficha e das pastas do Drive.
//
// A tabela continua sendo `system_theme_mapping` (nada foi movido): aqui é só
// outra porta para o mesmo dado.

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useThemeMappings, useUpsertThemeMapping } from "@/hooks/useDistribuicao";
import { useTemas } from "@/hooks/useTemas";
import { useAssignableUsers } from "@/hooks/useUsers";
import { usePodeEditar } from "@/hooks/usePermissions";

const SEM = "__sem__";

export function TemaDistribuicaoPanel({ temaId, temaNome }: { temaId: string; temaNome: string }) {
  const podeEditar = usePodeEditar("controladoria");
  const { data: temas } = useTemas();
  const { data: mappings, isLoading } = useThemeMappings();
  const { data: users } = useAssignableUsers();
  const upsert = useUpsertThemeMapping();

  // O motor identifica o tema pelo slug (motor_theme_id).
  const slug = useMemo(() => {
    const t = (temas ?? []).find((x) => x.id === temaId) as { slug?: string } | undefined;
    return t?.slug ?? null;
  }, [temas, temaId]);

  const mapping = useMemo(() => {
    if (!slug) return null;
    return (
      ((mappings ?? []) as Array<Record<string, unknown>>).find((m) => m.motor_theme_id === slug) ??
      null
    );
  }, [mappings, slug]);

  const [multiplier, setMultiplier] = useState<string | null>(null);
  const [temporal, setTemporal] = useState<string | null>(null);
  const [exclusivo, setExclusivo] = useState<string | null>(null);

  const valMultiplier = multiplier ?? String(mapping?.multiplier ?? 1);
  const valTemporal = temporal ?? String(mapping?.temporal_level ?? 0);
  const valExclusivo = exclusivo ?? (mapping?.exclusive_executor_id as string | null) ?? SEM;

  if (isLoading) return <p className="text-[13px] text-muted-foreground">Carregando…</p>;

  if (!slug)
    return (
      <p className="text-[13px] text-muted-foreground">
        Este tema ainda não tem identificador para o motor.
      </p>
    );

  if (!mapping)
    return (
      <p className="text-[13px] text-muted-foreground">
        O tema <strong>{temaNome}</strong> ainda não está mapeado no motor de distribuição. O
        vínculo é criado na sincronização com o ProJuris (aba Temas da Controladoria).
      </p>
    );

  async function salvar() {
    try {
      await upsert.mutateAsync({
        projuris_tema_codigo: mapping!.projuris_tema_codigo,
        motor_theme_id: mapping!.motor_theme_id,
        // Aceita vírgula (teclado pt-BR): sem isto, "1,5" caía para 1.
        multiplier: Number(valMultiplier.replace(",", ".")) || 1,
        temporal_level: Number(valTemporal) || 0,
        exclusive_executor_id: valExclusivo === SEM ? null : valExclusivo,
        active: mapping!.active ?? true,
      });
      toast.success("Configuração de distribuição salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Multiplicador de pontos</Label>
          <Input
            inputMode="decimal"
            value={valMultiplier}
            disabled={!podeEditar}
            onChange={(e) => setMultiplier(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nível de urgência padrão</Label>
          <Select value={valTemporal} disabled={!podeEditar} onValueChange={(v) => setTemporal(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Normal</SelectItem>
              <SelectItem value="1">Atenção</SelectItem>
              <SelectItem value="2">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Responsável exclusivo do tema</Label>
          <Select
            value={valExclusivo}
            disabled={!podeEditar}
            onValueChange={(v) => setExclusivo(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM}>Distribuição normal</SelectItem>
              {(users ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name ?? u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground">
        A exceção por tipo de tarefa tem precedência sobre esta regra — ela é configurada em
        Configurações › Tipos de tarefa.
      </p>

      {podeEditar && (
        <Button size="sm" onClick={salvar} disabled={upsert.isPending}>
          Salvar
        </Button>
      )}
    </div>
  );
}
