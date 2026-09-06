// Formulários de NOVA RECEITA (Desenho 4) e NOVA DESPESA (Desenho 5) — FN1.
//
// Os dois vivem no mesmo componente porque compartilham 80% dos campos; o que
// muda é o bloco final (parcelamento na receita, fornecedor/recorrência na
// despesa) e a lista de tipos.
//
// "Revisar parcelas" é o pedido explícito do doc: "abre uma opção de visualização
// de todas as parcelas que serão criadas e permite editar o vencimento/valor de
// alguma parcela específica".

import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCatalogoContaAzul,
  useCriarFinEntry,
  useFinCategorias,
} from "@/hooks/useFinanceiroCaso";
import {
  descricaoPadraoDespesa,
  dividirEmParcelas,
  somarMeses,
  tipoLabel,
  tiposDoKind,
  type FinKind,
} from "@/lib/financeiro-caso-shared";
// Máscara de centavos que o sistema já usa (parcelas, termo) — não inventar outra.
import { centavosFromMask, centavosToMask, maskCentavos } from "@/lib/format";

const SEM = "__sem__";

// Lista fixa: a forma é combinada com o cliente ("negociado um a um", Thiago
// 28/08) e serve de informação no registro, não de configuração do sistema.
const FORMAS_PAGAMENTO = [
  "Pix",
  "Boleto",
  "Cartão de crédito",
  "Cartão de débito",
  "Transferência",
  "Dinheiro",
  "Outro",
] as const;

type Parcela = { numero: number; data_vencimento: string; valor_centavos: number };

export function CaseFinanceiroEntryDialog({
  caseId,
  kind,
  temaNome,
  clienteNome,
  open,
  onOpenChange,
}: {
  caseId: string;
  kind: FinKind;
  temaNome?: string | null;
  clienteNome?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const criar = useCriarFinEntry(caseId);
  const { data: categorias } = useFinCategorias(kind);

  // Contas reais do Conta Azul (só busca com o diálogo aberto).
  const catalogo = useCatalogoContaAzul(open);
  const [tipo, setTipo] = useState<string>(tiposDoKind(kind)[0] ?? "");
  const [categoriaId, setCategoriaId] = useState<string>(SEM);
  const [valorTexto, setValorTexto] = useState("");
  const [vencimento, setVencimento] = useState(() => new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("");
  const [conta, setConta] = useState("");
  const [descricao, setDescricao] = useState("");
  // Receita
  const [parcelas, setParcelas] = useState(1);
  const [periodicidade, setPeriodicidade] = useState(1);
  // Despesa
  const [fornecedor, setFornecedor] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [reembolsavel, setReembolsavel] = useState(false);
  // Revisão de parcelas
  const [revisando, setRevisando] = useState(false);
  const [parcelasEditadas, setParcelasEditadas] = useState<Parcela[] | null>(null);

  const valorCentavos = centavosFromMask(valorTexto) ?? 0;

  // Só as FOLHAS são selecionáveis — é nelas que o Conta Azul lança de fato.
  const folhas = useMemo(() => (categorias ?? []).filter((c) => c.folha), [categorias]);
  const categoriaEscolhida = folhas.find((c) => c.id === categoriaId);
  // A chave "Reembolsável" só existe quando a categoria é de um balde reembolsável
  // (regra do doc, Desenho X).
  const podeReembolsar = kind === "DESPESA" && !!categoriaEscolhida?.reembolsavel;

  const previa = useMemo<Parcela[]>(() => {
    if (parcelasEditadas) return parcelasEditadas;
    return dividirEmParcelas(valorCentavos, parcelas).map((v, i) => ({
      numero: i + 1,
      data_vencimento: somarMeses(vencimento, i * periodicidade),
      valor_centavos: v,
    }));
  }, [parcelasEditadas, valorCentavos, parcelas, vencimento, periodicidade]);

  const somaPrevia = previa.reduce((acc, p) => acc + p.valor_centavos, 0);

  function limpar() {
    setTipo(tiposDoKind(kind)[0] ?? "");
    setCategoriaId(SEM);
    setValorTexto("");
    setDescricao("");
    setForma("");
    setConta("");
    setParcelas(1);
    setPeriodicidade(1);
    setFornecedor("");
    setRecorrente(false);
    setReembolsavel(false);
    setRevisando(false);
    setParcelasEditadas(null);
  }

  async function salvar() {
    if (valorCentavos <= 0) {
      toast.error("Informe o valor");
      return;
    }
    try {
      const r = await criar.mutateAsync({
        caseId,
        kind,
        tipo,
        categoriaId: categoriaId === SEM ? null : categoriaId,
        descricao:
          descricao.trim() ||
          (kind === "DESPESA" ? descricaoPadraoDespesa(tipo, temaNome, clienteNome) : null),
        valorCentavos,
        formaPagamento: forma.trim() || null,
        contaFinanceira: conta.trim() || null,
        dataVencimento: vencimento,
        parcelas: kind === "RECEITA" ? parcelas : 1,
        periodicidadeMeses: periodicidade,
        fornecedor: kind === "DESPESA" ? fornecedor.trim() || null : null,
        recorrente: kind === "DESPESA" ? recorrente : false,
        reembolsavel: podeReembolsar ? reembolsavel : false,
        parcelasCustomizadas: parcelasEditadas ?? undefined,
      });
      toast.success(
        (r as { receitaEspelhoId?: string | null })?.receitaEspelhoId
          ? "Despesa registrada · receita de reembolso criada como Aguardando"
          : kind === "RECEITA"
            ? "Receita registrada"
            : "Despesa registrada",
      );
      limpar();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kind === "RECEITA" ? "Nova receita" : "Nova despesa"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">
              {kind === "RECEITA" ? "Tipo de receita" : "Tipo de despesa"}
            </Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposDoKind(kind).map((t) => (
                  <SelectItem key={t} value={t}>
                    {tipoLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Categoria financeira (Conta Azul)</Label>
            <Select
              value={categoriaId}
              onValueChange={(v) => {
                setCategoriaId(v);
                setReembolsavel(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM}>Sem categoria</SelectItem>
                {folhas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigo} · {c.caminho}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Valor</Label>
            <Input
              placeholder="0,00"
              value={valorTexto}
              onChange={(e) => {
                setValorTexto(maskCentavos(e.target.value));
                setParcelasEditadas(null); // valor mudou: a revisão anterior não vale mais
              }}
              inputMode="decimal"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Data de vencimento</Label>
            <Input
              type="date"
              value={vencimento}
              onChange={(e) => {
                setVencimento(e.target.value);
                setParcelasEditadas(null);
              }}
            />
          </div>

          {/* FN2 (2026-08-28) — os dois eram texto livre, e isso quebraria o
              lançamento: o Conta Azul identifica a conta por um código, não pelo
              nome. Quem digitasse "Bradesco" veria o envio falhar sem entender.
              Agora a conta vem da lista real da conta do escritório.
              A forma de pagamento é lista fixa porque, como o Thiago explicou,
              "depende do que o cliente tenha optado, é negociado um a um" — ela
              viaja como observação no registro, para o financeiro ler. */}
          <div className="space-y-1">
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={forma || SEM} onValueChange={(v) => setForma(v === SEM ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Como o cliente combinou pagar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM}>—</SelectItem>
                {FORMAS_PAGAMENTO.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              {kind === "RECEITA" ? "Conta de recebimento" : "Conta de pagamento"}
            </Label>
            {catalogo.isLoading ? (
              <p className="text-[12px] text-muted-foreground py-2">Carregando contas…</p>
            ) : catalogo.data && catalogo.data.contas.length > 0 ? (
              <Select value={conta || SEM} onValueChange={(v) => setConta(v === SEM ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>—</SelectItem>
                  {catalogo.data.contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input value={conta} onChange={(e) => setConta(e.target.value)} />
                <p className="text-[11px] text-[var(--warning,#a16207)]">
                  Não consegui ler as contas do Conta Azul agora. Sem escolher da lista, o
                  lançamento não vai conseguir subir.
                </p>
              </>
            )}
          </div>

          {kind === "RECEITA" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Nº de parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  max={240}
                  value={parcelas}
                  onChange={(e) => {
                    setParcelas(Math.max(1, Math.min(Number(e.target.value) || 1, 240)));
                    setParcelasEditadas(null);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Repetir a cada (meses)</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={periodicidade}
                  onChange={(e) => {
                    setPeriodicidade(Math.max(1, Math.min(Number(e.target.value) || 1, 12)));
                    setParcelasEditadas(null);
                  }}
                />
              </div>
            </>
          )}

          {kind === "DESPESA" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Fornecedor (recebedor/beneficiário)</Label>
                <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Recorrente</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={recorrente ? "default" : "outline"}
                    onClick={() => setRecorrente((v) => !v)}
                  >
                    {recorrente ? "Sim" : "Não"}
                  </Button>
                  {recorrente && (
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={periodicidade}
                      onChange={(e) =>
                        setPeriodicidade(Math.max(1, Math.min(Number(e.target.value) || 1, 12)))
                      }
                      className="w-[90px]"
                      title="Repetir a cada N meses"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Reembolsável — só quando a categoria escolhida é de um balde reembolsável. */}
        {podeReembolsar && (
          <div className="rounded-md border border-[var(--border)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-[var(--navy)]">Reembolsável</div>
                <p className="text-[11.5px] text-muted-foreground">
                  Ao salvar, o sistema cria automaticamente uma <strong>receita Aguardando</strong>{" "}
                  com as mesmas informações.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={reembolsavel ? "default" : "outline"}
                onClick={() => setReembolsavel((v) => !v)}
              >
                {reembolsavel ? "Sim" : "Não"}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Textarea
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={
              kind === "DESPESA" ? descricaoPadraoDespesa(tipo, temaNome, clienteNome) : "Opcional"
            }
          />
          {kind === "DESPESA" && !descricao.trim() && (
            <p className="text-[11px] text-muted-foreground">
              Em branco, usa o padrão:{" "}
              <em>{descricaoPadraoDespesa(tipo, temaNome, clienteNome)}</em>
            </p>
          )}
        </div>

        {/* Revisar parcelas (Desenho 4) */}
        {(kind === "RECEITA" || recorrente) && valorCentavos > 0 && (
          <div className="rounded-md border border-[var(--border)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[var(--navy)]">
                {previa.length} parcela(s) · total R$ {centavosToMask(somaPrevia)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRevisando((v) => !v)}
              >
                {revisando ? "Fechar" : "Revisar parcelas"}
              </Button>
            </div>
            {revisando && (
              <div className="max-h-[240px] overflow-y-auto space-y-1.5">
                {previa.map((p, i) => (
                  <div key={p.numero} className="flex items-center gap-2">
                    <span className="w-8 text-[12px] text-muted-foreground">{p.numero}</span>
                    <Input
                      type="date"
                      className="w-[150px]"
                      value={p.data_vencimento}
                      onChange={(e) => {
                        const novas = [...previa];
                        novas[i] = { ...p, data_vencimento: e.target.value };
                        setParcelasEditadas(novas);
                      }}
                    />
                    <Input
                      className="w-[130px]"
                      value={centavosToMask(p.valor_centavos)}
                      onChange={(e) => {
                        const cent = centavosFromMask(maskCentavos(e.target.value)) ?? 0;
                        const novas = [...previa];
                        novas[i] = { ...p, valor_centavos: cent };
                        setParcelasEditadas(novas);
                      }}
                    />
                  </div>
                ))}
                {somaPrevia !== valorCentavos && (
                  <p className="text-[11.5px] text-[var(--danger)]">
                    A soma das parcelas (R$ {centavosToMask(somaPrevia)}) está diferente do valor
                    informado (R$ {centavosToMask(valorCentavos)}).
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={criar.isPending || valorCentavos <= 0}>
            {criar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
