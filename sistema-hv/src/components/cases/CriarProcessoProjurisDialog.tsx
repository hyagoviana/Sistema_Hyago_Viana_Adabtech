// Cadastrar processo judicial no ProJuris a partir do caso (31/08).
//
// Fluxo em DOIS PASSOS de propósito — "preencher" e depois "conferir e enviar":
// cadastrar processo escreve na base de um sistema de terceiro e não tem desfazer
// por API. O passo de conferência mostra o corpo exato que vai, e é a diferença
// entre um engano corrigível e um processo duplicado no ProJuris.
//
// As listas (área, justiça, situação, classe e assunto do CNJ) vêm do próprio
// ProJuris — ninguém digita código à mão.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Gavel, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApoioProcesso,
  useCriarProcessoProjuris,
  usePreviewProcesso,
  useSugestaoProcesso,
  type OpcaoProcesso,
} from "@/hooks/useProjurisProcesso";

const NENHUM = "";

/** Select nativo: a lista de assuntos CNJ passa de mil itens e o combobox trava. */
function Selecao({
  label,
  valor,
  onChange,
  opcoes,
  placeholder,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: OpcaoProcesso[];
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-[var(--border)] bg-white px-2.5 text-[13px] text-[var(--navy)] focus:border-[var(--gold)] focus:outline-none"
      >
        <option value={NENHUM}>{placeholder}</option>
        {opcoes.map((o) => (
          <option key={o.chave} value={String(o.chave)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CriarProcessoProjurisDialog({
  open,
  onOpenChange,
  caseId,
  caseCode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  caseCode: string;
}) {
  const { data: apoio, isLoading: carregandoApoio, isError } = useApoioProcesso(open);
  const { data: sugestao } = useSugestaoProcesso(caseId, open);
  const preview = usePreviewProcesso();
  const criar = useCriarProcessoProjuris(caseId);

  const [passo, setPasso] = useState<"form" | "conferir">("form");
  const [nomePasta, setNomePasta] = useState("");
  const [assunto, setAssunto] = useState("");
  const [numeroCnj, setNumeroCnj] = useState("");
  const [area, setArea] = useState(NENHUM);
  const [justica, setJustica] = useState(NENHUM);
  const [situacao, setSituacao] = useState(NENHUM);
  const [classe, setClasse] = useState(NENHUM);
  const [assuntoCnj, setAssuntoCnj] = useState(NENHUM);
  const [dataDistribuicao, setDataDistribuicao] = useState("");
  const [corpoJson, setCorpoJson] = useState("");

  // Preenche com o que o caso já sabe, sem sobrescrever o que a pessoa digitou.
  useEffect(() => {
    if (!sugestao) return;
    setNomePasta((v) => v || sugestao.nomePasta);
    setAssunto((v) => v || sugestao.assunto);
    setNumeroCnj((v) => v || sugestao.numeroCnj);
  }, [sugestao]);

  // Fechar e reabrir recomeça no formulário — nunca na confirmação.
  useEffect(() => {
    if (!open) {
      setPasso("form");
      setCorpoJson("");
    }
  }, [open]);

  const entrada = useMemo(
    () => ({
      caseId,
      nomePasta: nomePasta.trim(),
      assunto: assunto.trim(),
      numeroCnj: numeroCnj.trim(),
      codigoArea: area ? Number(area) : null,
      codigoJustica: justica ? Number(justica) : null,
      codigoSituacao: situacao ? Number(situacao) : null,
      codigoClasseCnj: classe ? Number(classe) : null,
      codigoAssuntoCnj: assuntoCnj ? Number(assuntoCnj) : null,
      dataDistribuicao: dataDistribuicao || null,
      segredoJustica: false,
    }),
    [
      caseId,
      nomePasta,
      assunto,
      numeroCnj,
      area,
      justica,
      situacao,
      classe,
      assuntoCnj,
      dataDistribuicao,
    ],
  );

  const podeAvancar = nomePasta.trim().length > 0 && assunto.trim().length > 0;

  async function conferir() {
    try {
      const r = await preview.mutateAsync(entrada);
      setCorpoJson(r.corpoJson);
      setPasso("conferir");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui montar o envio");
    }
  }

  async function enviar() {
    try {
      const r = await criar.mutateAsync(entrada);
      if (r.ok) {
        toast.success(`Processo criado no ProJuris (código ${r.codigo}) e vinculado ao caso`);
        onOpenChange(false);
      } else {
        toast.error(r.motivo || "O ProJuris recusou o cadastro");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao cadastrar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel size={17} />
            Cadastrar processo no ProJuris
          </DialogTitle>
        </DialogHeader>

        {passo === "form" ? (
          <div className="space-y-4">
            <p className="text-[12.5px] text-muted-foreground">
              O processo é criado no ProJuris e já fica vinculado ao caso {caseCode}. As listas
              abaixo vêm de lá.
            </p>

            {isError && (
              <div className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--ink-50)] p-3 text-[12.5px]">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--warning)]" />
                <span>
                  Não consegui carregar as listas do ProJuris. Dá para cadastrar assim mesmo (só o
                  essencial), ou fechar e tentar de novo.
                </span>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Nome da pasta *</Label>
                <Input
                  value={nomePasta}
                  onChange={(e) => setNomePasta(e.target.value)}
                  placeholder="Como o processo aparece na lista do ProJuris"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Assunto *</Label>
                <Input
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  placeholder="Ex.: Restituição INSS"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Número do processo (CNJ)</Label>
                <Input
                  value={numeroCnj}
                  onChange={(e) => setNumeroCnj(e.target.value)}
                  placeholder="0000000-00.0000.0.00.0000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de distribuição</Label>
                <Input
                  type="date"
                  value={dataDistribuicao}
                  onChange={(e) => setDataDistribuicao(e.target.value)}
                />
              </div>
            </div>

            {carregandoApoio ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-md" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Selecao
                  label="Justiça"
                  valor={justica}
                  onChange={setJustica}
                  opcoes={apoio?.justicas ?? []}
                  placeholder="Não informar"
                />
                <Selecao
                  label="Área"
                  valor={area}
                  onChange={setArea}
                  opcoes={apoio?.areas ?? []}
                  placeholder="Não informar"
                />
                <Selecao
                  label="Situação"
                  valor={situacao}
                  onChange={setSituacao}
                  opcoes={apoio?.situacoes ?? []}
                  placeholder="Não informar"
                />
                <Selecao
                  label="Classe (CNJ)"
                  valor={classe}
                  onChange={setClasse}
                  opcoes={apoio?.classes ?? []}
                  placeholder="Não informar"
                />
                <div className="sm:col-span-2">
                  <Selecao
                    label="Assunto (CNJ)"
                    valor={assuntoCnj}
                    onChange={setAssuntoCnj}
                    opcoes={apoio?.assuntos ?? []}
                    placeholder="Não informar"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={conferir} disabled={!podeAvancar || preview.isPending}>
                {preview.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                Conferir antes de enviar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-[rgba(152,120,20,0.28)] bg-[rgba(152,120,20,0.06)] p-3 text-[12.5px]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--gold-700)]" />
              <span>
                Isto cria um processo <strong>de verdade</strong> no ProJuris. A API não tem
                desfazer — para remover, só pelo painel de lá.
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">O que será enviado</Label>
              <pre className="max-h-[280px] overflow-auto rounded-md border border-[var(--border)] bg-[var(--ink-50)] p-3 text-[11.5px] leading-relaxed">
                {corpoJson}
              </pre>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setPasso("form")}>
                <ArrowLeft size={14} className="mr-1.5" />
                Voltar e ajustar
              </Button>
              <Button onClick={enviar} disabled={criar.isPending}>
                {criar.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                Cadastrar no ProJuris
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
