// S2-02 — vínculo do TEMA com o ASSUNTO do ProJuris.
//
// Thiago (desenho 13): "Identificar do projuris para o ASSUNTO relacionado ao
// tema. No geral todos os temas já possuem seu próprio assunto no PROJURIS, mas
// podem existir temas que não tem um assunto próprio (compartilham um registro
// geral lá). Fazendo dessa forma com identificador ajustável, acho que amarramos
// bem essa situação."
//
// É isto que impede o ProJuris de ganhar um assunto novo a cada processo criado
// pelo SHV — antes ia o código do caso ("INADIMPLENCIAHV-2026-0422") no campo
// ASSUNTO.
//
// Por que o campo aceita TEXTO e não só um id de lista: o Thiago não achou
// identificador sistêmico para o assunto geral "CÍVEIS". O seletor lista o que a
// API devolve, e o campo livre cobre o resto — incluindo o caso em que a API
// está fora do ar.

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useApoioProcesso,
  useAssuntoGeralProjuris,
  useSetAssuntoGeralProjuris,
  useSetTemaAssuntoProjuris,
} from "@/hooks/useProjurisProcesso";
import { useTemas } from "@/hooks/useTemas";

type TemaComAssunto = {
  id: string;
  projuris_assunto_id?: string | null;
  projuris_assunto_nome?: string | null;
};

export function TemaProjurisPanel({ temaId, temaNome }: { temaId: string; temaNome: string }) {
  const { data: temas } = useTemas();
  const salvarTema = useSetTemaAssuntoProjuris();
  const { data: geral } = useAssuntoGeralProjuris();
  const salvarGeral = useSetAssuntoGeralProjuris();
  // A lista vem da API do ProJuris; se falhar, o campo manual continua servindo.
  const apoio = useApoioProcesso();

  const tema = (temas as TemaComAssunto[] | undefined)?.find((t) => t.id === temaId);

  const [nome, setNome] = useState("");
  const [id, setId] = useState("");
  const [geralNome, setGeralNome] = useState("");

  useEffect(() => {
    setNome(tema?.projuris_assunto_nome ?? "");
    setId(tema?.projuris_assunto_id ?? "");
  }, [tema?.projuris_assunto_nome, tema?.projuris_assunto_id]);

  useEffect(() => {
    setGeralNome(geral?.nome ?? "");
  }, [geral?.nome]);

  const assuntos = apoio.data?.assuntos ?? [];
  const definido = !!tema?.projuris_assunto_nome?.trim();

  async function handleSalvarTema() {
    try {
      await salvarTema.mutateAsync({ temaId, id: id.trim() || null, nome: nome.trim() || null });
      toast.success(
        nome.trim()
          ? `Assunto do ProJuris salvo para ${temaNome}`
          : `${temaNome} passa a usar o assunto geral`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  async function handleSalvarGeral() {
    try {
      await salvarGeral.mutateAsync({ nome: geralNome.trim() || null });
      toast.success("Assunto geral salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-[12.5px] text-muted-foreground">
          O assunto é o que vai no campo <strong>ASSUNTO</strong> do processo quando ele é criado no
          ProJuris a partir daqui. Sem este vínculo, cada caso criava um assunto novo lá.
        </p>

        <div className="rounded-md border border-[var(--border)] px-3 py-2 text-[12px]">
          {definido ? (
            <span className="text-[var(--navy)]">
              <strong>{tema?.projuris_assunto_nome}</strong> — definido manualmente para este tema.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Este tema ainda não tem assunto próprio. Os processos vão usar o assunto geral
              {geral?.nome ? ` (${geral.nome})` : " — que também não está configurado"}.
            </span>
          )}
        </div>

        {assuntos.length > 0 && (
          <div className="space-y-1 max-w-md">
            <Label className="text-xs">Escolher entre os assuntos do ProJuris</Label>
            <Command className="rounded-md border border-[var(--border)]">
              <CommandInput placeholder="Buscar assunto…" />
              <CommandList className="max-h-48">
                <CommandEmpty>Nenhum assunto com esse nome.</CommandEmpty>
                <CommandGroup>
                  {assuntos.map((a) => (
                    <CommandItem
                      key={a.chave}
                      value={a.label}
                      onSelect={() => {
                        setNome(a.label);
                        setId(String(a.chave));
                      }}
                    >
                      {a.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          <div className="space-y-1">
            <Label className="text-xs">Assunto</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: FIES — abatimento"
              disabled={salvarTema.isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              Deixe vazio para este tema usar o assunto geral.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Identificador (opcional)</Label>
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Código do assunto no ProJuris"
              disabled={salvarTema.isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              Nem todo assunto tem um — o nome sozinho já resolve.
            </p>
          </div>
        </div>

        <Button size="sm" onClick={handleSalvarTema} disabled={salvarTema.isPending}>
          {salvarTema.isPending ? "Salvando…" : "Salvar assunto do tema"}
        </Button>
      </div>

      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <div>
          <Label className="text-xs">Assunto geral (vale para todo tema sem assunto próprio)</Label>
          <p className="text-[11px] text-muted-foreground">
            É um só para o escritório inteiro. Sem ele e sem o do tema, a criação de processo no
            ProJuris fica bloqueada — de propósito, para nunca mais ir o código do caso.
          </p>
        </div>
        <div className="flex gap-2 max-w-md">
          <Input
            value={geralNome}
            onChange={(e) => setGeralNome(e.target.value)}
            placeholder="Ex.: CÍVEIS"
            disabled={salvarGeral.isPending}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSalvarGeral}
            disabled={salvarGeral.isPending}
          >
            {salvarGeral.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
