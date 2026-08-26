// Painéis do FINANCEIRO DO CASO (FN1) — Desenhos 1, 2 e 3 do doc "25.08".
//
//   • Receitas do caso   • Despesas do caso   • Valores lançados
//
// Os outros dois painéis do Desenho 1 (Rastro com checklist e Linha do tempo
// financeira) JÁ EXISTEM na aba financeira e não são recriados aqui.
//
// "Fazer lançamento" e "Revisar lançamento" existem como AÇÃO, mas nesta fase
// apenas mudam o status no SHV — quem conversa com o ContaAzul é a FN2. O botão
// diz isso em voz alta para ninguém achar que já foi ao ERP.

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eyebrow } from "@/components/hv/primitives";
import { CaseFinanceiroEntryDialog } from "@/components/cases/CaseFinanceiroEntryDialog";
import {
  useCaseFinEntries,
  useExcluirFinEntry,
  useResumoFinanceiroCaso,
  useSetFinEntryStatus,
} from "@/hooks/useFinanceiroCaso";
import {
  FIN_STATUS_LABEL,
  PARCELA_STATUS_LABEL,
  tipoLabel,
  type FinKind,
  type FinStatus,
  type ParcelaStatus,
} from "@/lib/financeiro-caso-shared";
import { centavosToMask } from "@/lib/format";

const STATUS_TONE: Record<FinStatus, string> = {
  AGUARDANDO: "bg-amber-100 text-amber-800",
  DISPENSADO: "bg-[var(--muted)] text-muted-foreground",
  LANCADO: "bg-emerald-100 text-emerald-800",
};

const PARCELA_TONE: Record<ParcelaStatus, string> = {
  AGUARDANDO: "bg-[var(--muted)] text-muted-foreground",
  VENCIDA: "bg-red-100 text-red-800",
  PAGA: "bg-emerald-100 text-emerald-800",
  CANCELADA: "bg-[var(--muted)] text-muted-foreground line-through",
};

function fmtData(iso: string | null): string {
  if (!iso) return "·";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : iso;
}

export function CaseFinanceiroPanels({
  caseId,
  temaNome,
  clienteNome,
  podeEditar,
}: {
  caseId: string;
  temaNome?: string | null;
  clienteNome?: string | null;
  podeEditar: boolean;
}) {
  const { data: entries, isLoading } = useCaseFinEntries(caseId);
  const { data: resumo } = useResumoFinanceiroCaso(caseId);
  const setStatus = useSetFinEntryStatus(caseId);
  const excluir = useExcluirFinEntry(caseId);

  const [dialogKind, setDialogKind] = useState<FinKind | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const lista = entries ?? [];
  const receitas = lista.filter((e) => e.kind === "RECEITA");
  const despesas = lista.filter((e) => e.kind === "DESPESA");

  async function mudarStatus(entryId: string, status: FinStatus) {
    try {
      await setStatus.mutateAsync({ entryId, status });
      toast.success(
        status === "LANCADO"
          ? "Marcado como lançado. A gravação no ContaAzul entra na próxima etapa."
          : "Status atualizado",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
    }
  }

  function Tabela({ dados, kind }: { dados: typeof lista; kind: FinKind }) {
    if (dados.length === 0) {
      return (
        <div className="rounded-md border border-dashed border-[var(--border)] p-5 text-[13px] text-muted-foreground">
          Nenhuma {kind === "RECEITA" ? "receita" : "despesa"} registrada neste caso.
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {dados.map((e) => {
          const pago = e.installments
            .filter((p) => p.status === "PAGA")
            .reduce((a, p) => a + (p.valor_pago_centavos ?? p.valor_centavos), 0);
          return (
            <div key={e.id} className="card-editorial p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--navy)] text-[14px]">
                  {tipoLabel(e.tipo)}
                </span>
                <Badge className={`text-[10px] ${STATUS_TONE[e.status as FinStatus] ?? ""}`}>
                  {FIN_STATUS_LABEL[e.status as FinStatus] ?? e.status}
                </Badge>
                {e.origem_despesa_id && (
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    title="Criada a partir de uma despesa reembolsável"
                  >
                    reembolso automático
                  </Badge>
                )}
                {e.reembolsavel && (
                  <Badge variant="outline" className="text-[10px]">
                    reembolsável
                  </Badge>
                )}
                <span className="ml-auto text-[15px] font-semibold text-[var(--navy)]">
                  R$ {centavosToMask(e.valor_centavos)}
                </span>
              </div>

              <div className="mt-1 text-[12px] text-muted-foreground">
                {e.categoria_caminho ?? "sem categoria"}
                {e.parcelas > 1 ? ` · ${e.parcelas}× ` : " · "}
                {e.data_vencimento ? `vence ${fmtData(e.data_vencimento)}` : "sem vencimento"}
                {e.fornecedor ? ` · ${e.fornecedor}` : ""}
                {pago > 0 ? ` · recebido R$ ${centavosToMask(pago)}` : ""}
              </div>
              {e.descricao && (
                <div className="mt-0.5 text-[12px] text-muted-foreground">{e.descricao}</div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[11px] h-7"
                  onClick={() => setAberto(aberto === e.id ? null : e.id)}
                >
                  {aberto === e.id
                    ? "− ocultar parcelas"
                    : `+ ver ${e.installments.length} parcela(s)`}
                </Button>

                {podeEditar && (
                  <>
                    {/* Fase 1: a ação registra a intenção. A integração é a FN2 —
                        e o texto do botão precisa deixar isso claro. */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] h-7"
                      disabled={setStatus.isPending}
                      title="Nesta versão, marca como lançado no SHV. A gravação no ContaAzul entra na próxima etapa."
                      onClick={() =>
                        mudarStatus(e.id, e.status === "LANCADO" ? "AGUARDANDO" : "LANCADO")
                      }
                    >
                      {e.status === "LANCADO" ? "Revisar lançamento" : "Fazer lançamento"}
                    </Button>
                    {e.status !== "DISPENSADO" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[11px] h-7"
                        onClick={() => mudarStatus(e.id, "DISPENSADO")}
                      >
                        Dispensar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[11px] h-7"
                        onClick={() => mudarStatus(e.id, "AGUARDANDO")}
                      >
                        Reativar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[11px] h-7 text-destructive ml-auto"
                      onClick={async () => {
                        if (!confirm("Excluir este registro?")) return;
                        try {
                          await excluir.mutateAsync(e.id);
                          toast.success("Registro excluído");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Falha ao excluir");
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </>
                )}
              </div>

              {/* Detalhamento por parcela (Desenho 3). */}
              {aberto === e.id && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground border-b border-[var(--border)]">
                        <th className="py-1.5 pr-3">Parcela</th>
                        <th className="py-1.5 pr-3">Vencimento</th>
                        <th className="py-1.5 pr-3">Valor devido</th>
                        <th className="py-1.5 pr-3">Valor pago</th>
                        <th className="py-1.5 pr-3">Data da baixa</th>
                        <th className="py-1.5">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.installments.map((p) => (
                        <tr key={p.id} className="border-b border-[var(--border)]">
                          <td className="py-1.5 pr-3">
                            {p.numero}/{e.installments.length}
                          </td>
                          <td className="py-1.5 pr-3">{fmtData(p.data_vencimento)}</td>
                          <td className="py-1.5 pr-3">R$ {centavosToMask(p.valor_centavos)}</td>
                          <td className="py-1.5 pr-3">
                            {p.valor_pago_centavos != null
                              ? `R$ ${centavosToMask(p.valor_pago_centavos)}`
                              : "·"}
                          </td>
                          <td className="py-1.5 pr-3">{fmtData(p.data_pagamento)}</td>
                          <td className="py-1.5">
                            <Badge
                              className={`text-[10px] ${PARCELA_TONE[p.status as ParcelaStatus] ?? ""}`}
                            >
                              {PARCELA_STATUS_LABEL[p.status as ParcelaStatus] ?? p.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------- Valores lançados -- */}
      {(resumo ?? []).length > 0 && (
        <section>
          <Eyebrow>Valores do caso</Eyebrow>
          <p className="text-[12px] text-muted-foreground mb-2">
            Devido, vencido, recebido e a vencer — por tipo. Registros dispensados não entram.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(resumo ?? []).map((r) => (
              <div key={`${r.kind}:${r.tipo}`} className="card-editorial p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[var(--navy)]">
                    {tipoLabel(r.tipo)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {r.kind === "RECEITA" ? "receita" : "despesa"}
                  </Badge>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px]">
                  <span className="text-muted-foreground">Devido</span>
                  <span className="text-right font-medium">
                    R$ {centavosToMask(r.devido_centavos)}
                  </span>
                  <span className="text-muted-foreground">Vencido</span>
                  <span className="text-right font-medium text-[var(--danger)]">
                    R$ {centavosToMask(r.vencido_centavos)}
                  </span>
                  <span className="text-muted-foreground">
                    {r.kind === "RECEITA" ? "Recebido" : "Pago"}
                  </span>
                  <span className="text-right font-medium text-emerald-700">
                    R$ {centavosToMask(r.recebido_centavos)}
                  </span>
                  <span className="text-muted-foreground">A vencer</span>
                  <span className="text-right font-medium">
                    R$ {centavosToMask(r.vincendo_centavos)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------- Receitas do caso -- */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <Eyebrow>Receitas do caso</Eyebrow>
          </div>
          {podeEditar && (
            <Button size="sm" variant="outline" onClick={() => setDialogKind("RECEITA")}>
              <Plus size={14} className="mr-1" /> Registrar receita
            </Button>
          )}
        </div>
        <Tabela dados={receitas} kind="RECEITA" />
      </section>

      {/* ------------------------------------------------- Despesas do caso -- */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <Eyebrow>Despesas do caso</Eyebrow>
          </div>
          {podeEditar && (
            <Button size="sm" variant="outline" onClick={() => setDialogKind("DESPESA")}>
              <Plus size={14} className="mr-1" /> Registrar despesa
            </Button>
          )}
        </div>
        <Tabela dados={despesas} kind="DESPESA" />
      </section>

      {/* ---------------------------------------------------- Sucumbências ---
          O doc reserva o painel mas adia o detalhamento: "esse aqui também vamos
          só manter a ideia / posição visual. Mas ainda vou trazer o detalhamento
          deste item para desenvolvermos no SHV." */}
      <section>
        <Eyebrow>Sucumbências</Eyebrow>
        <div className="rounded-md border border-dashed border-[var(--border)] p-4 text-[12.5px] text-muted-foreground">
          Espaço reservado. O Thiago ficou de trazer o detalhamento deste item.
        </div>
      </section>

      {dialogKind && (
        <CaseFinanceiroEntryDialog
          caseId={caseId}
          kind={dialogKind}
          temaNome={temaNome}
          clienteNome={clienteNome}
          open={!!dialogKind}
          onOpenChange={(v) => !v && setDialogKind(null)}
        />
      )}
    </div>
  );
}
