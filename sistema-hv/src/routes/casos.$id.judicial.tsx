// G1 — SUBMENU JUDICIAL do caso (só leitura, espelho do ProJuris).
//   - Quadro-resumo: tribunal/órgão + nº do processo + etapa (G3).
//   - Lista de tarefas do processo (tipo, pra quem, status, prazos) (G1/G3).
//   - Botão "Atualizar do ProJuris" (sync de LEITURA idempotente).
//   - Botão "Ver andamentos" → modal com scroll + limite/keyset (G5).
// Read-only: NADA escreve de volta no ProJuris (D1).
//
// GATE (G4): usePodeVerJudicial (regra de sigilo). O servidor (rpc/judicial.ts)
// já barra os RPCs com requireJudicial — a UI é só conforto.

import { createFileRoute, useParams } from "@tanstack/react-router";
import { Gavel, Link2, Lock, Pencil, RefreshCw, ScrollText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCase } from "@/hooks/useCases";
import {
  useCaseJudicial,
  useCaseJudicialAndamentos,
  useSetCaseHonorariosJudicial,
  useSetCaseProjurisLink,
  useSyncCaseJudicial,
} from "@/hooks/useJudicial";
import { usePodeVerJudicial } from "@/hooks/usePodeVerJudicial";
import { usePodeEditar } from "@/hooks/usePermissions";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";

export const Route = createFileRoute("/casos/$id/judicial")({
  component: CasoJudicial,
});

type JudTask = {
  id: string;
  tipo_nome: string | null;
  tipo_codigo: string | null;
  responsavel_nome: string | null;
  situacao: string | null;
  concluida: boolean;
  prazo_previsto: string | null;
  prazo_fatal: string | null;
};

function fmtDate(d: string | null): string {
  if (!d) return "·";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

function brl(centavos: number | null | undefined): string {
  if (centavos == null) return "·";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Reais (texto BR "1.234,56") → centavos. Vazio → null.
function reaisToCentavos(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function CasoJudicial() {
  const { id } = useParams({ from: "/casos/$id/judicial" });
  const { podeVer, isLoading: sigiloLoading } = usePodeVerJudicial(id);
  const podeEditar = usePodeEditar("controladoria"); // M5 — gate de EDIÇÃO do vínculo
  const { data: caso } = useCase(id);
  const { data: judicial, isLoading } = useCaseJudicial(id, podeVer);
  const sync = useSyncCaseJudicial(id);

  const [linkOpen, setLinkOpen] = useState(false); // M5 — dialog de vincular/editar

  const [andamentosOpen, setAndamentosOpen] = useState(false);
  const [andamentosLimit, setAndamentosLimit] = useState(30);
  const { data: andamentos, isFetching: fetchingAndamentos } = useCaseJudicialAndamentos(
    id,
    andamentosLimit,
    0,
    andamentosOpen,
  );

  useDocumentTitle(`${resolveEntityLabel(caso?.case_code, { notFoundLabel: "Caso" })} · Judicial`);

  // GATE de VISIBILIDADE (G4).
  if (!podeVer) {
    return (
      <div className="page-container">
        <div className="card-hero p-10 text-center">
          <Lock size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {sigiloLoading
              ? "Verificando permissão…"
              : "Este caso é sigiloso. Você não está autorizado a ver o judicial."}
          </p>
        </div>
      </div>
    );
  }

  const processo = judicial?.processo as
    | {
        tribunal?: string | null;
        orgao?: string | null;
        orgao_julgador?: string | null;
        fase?: string | null;
        assunto?: string | null;
        classe_cnj?: string | null;
        situacao?: string | null;
        instancia?: string | null;
        vara?: string | null;
        tipo_justica?: string | null;
        data_distribuicao?: string | null;
        valor_causa_centavos?: number | null;
        monitoramento_push?: boolean | null;
        data_julgamento?: string | null;
        resultado_encerramento?: string | null;
        descricao_encerramento?: string | null;
        data_ultima_modificacao?: string | null;
      }
    | null
    | undefined;
  const tarefas = (judicial?.tarefas ?? []) as JudTask[];

  return (
    <div className="page-container">
      <header className="flex items-start justify-between gap-6 mb-6">
        <div>
          <Eyebrow>Judicial (espelho ProJuris · leitura)</Eyebrow>
          <h1 className="font-display text-[28px] font-bold text-[var(--navy)] mt-1 flex items-center gap-2">
            <Gavel size={22} className="text-[var(--gold-700)]" /> {caso?.case_code ?? "…"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAndamentosOpen(true)}>
            <ScrollText size={14} className="mr-1.5" /> Ver andamentos
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={sync.isPending}
            onClick={async () => {
              try {
                const r = await sync.mutateAsync();
                toast.success(`Atualizado do ProJuris (${r.tarefas} tarefa(s))`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
              }
            }}
          >
            <RefreshCw size={14} className={`mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Atualizando…" : "Atualizar do ProJuris"}
          </Button>
        </div>
      </header>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !judicial?.vinculado ? (
        <div className="card-hero p-10 text-center">
          <Gavel size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum processo ProJuris vinculado a este caso.
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">
            O vínculo (código do processo) é preenchido pela controladoria/importação.
          </p>
          {podeEditar && (
            <Button size="sm" className="mt-4" onClick={() => setLinkOpen(true)}>
              <Link2 size={14} className="mr-1.5" /> Vincular ao ProJuris
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Quadro-resumo (G3). */}
          <div className="card-hero p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <Eyebrow>Resumo do processo</Eyebrow>
              {podeEditar && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 -mt-1 text-[12px]"
                  onClick={() => setLinkOpen(true)}
                >
                  <Pencil size={13} className="mr-1.5" /> Editar vínculo
                </Button>
              )}
            </div>
            {/* Campos espelhados do ProJuris (docx Thiago). Assunto = TEMA. */}
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[13px]">
              <Field
                label="Órgão julgador"
                value={processo?.orgao_julgador || processo?.orgao || processo?.tribunal || "·"}
              />
              <Field label="Nº do processo (CNJ)" value={judicial.numeroProcesso ?? "·"} />
              <Field
                label="Código ProJuris"
                value={judicial.codigoProcesso ? `PRO.${String(judicial.codigoProcesso)}` : "·"}
              />
              <Field label="Classe (CNJ)" value={processo?.classe_cnj ?? "·"} />
              <Field label="Situação" value={processo?.situacao ?? "·"} />
              <Field label="Instância" value={processo?.instancia ?? "·"} />
              <Field label="Etapa/fase" value={processo?.fase ?? "·"} />
              <Field label="Assunto (tema)" value={processo?.assunto ?? "·"} />
              <Field label="Vara" value={processo?.vara ?? "·"} />
              <Field label="Tipo de justiça" value={processo?.tipo_justica ?? "·"} />
              <Field label="Distribuição" value={fmtDate(processo?.data_distribuicao ?? null)} />
              <Field label="Valor da causa" value={brl(processo?.valor_causa_centavos)} />
              <Field
                label="Monitoramento (Push)"
                value={
                  processo?.monitoramento_push == null
                    ? "·"
                    : processo.monitoramento_push
                      ? "Ativo"
                      : "Inativo"
                }
              />
              <Field
                label="Última movimentação"
                value={fmtDate(processo?.data_ultima_modificacao ?? null)}
              />
            </div>
            {/* Última decisão (resultado/tipo + data + descrição) — só aparece quando há decisão. */}
            {(processo?.resultado_encerramento ||
              processo?.descricao_encerramento ||
              processo?.data_julgamento) && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <Eyebrow>Última decisão</Eyebrow>
                <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[13px]">
                  <Field label="Resultado/Tipo" value={processo?.resultado_encerramento ?? "·"} />
                  <Field
                    label="Data do julgamento"
                    value={fmtDate(processo?.data_julgamento ?? null)}
                  />
                  <div className="sm:col-span-2">
                    <Field label="Descrição" value={processo?.descricao_encerramento ?? "·"} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Honorários contratuais MANUAIS (SHV) — não vêm do ProJuris. */}
          <HonorariosBlock
            caseId={id}
            podeEditar={podeEditar}
            estimados={judicial.honorariosEstimadosCentavos ?? null}
            provisionados={judicial.honorariosProvisionadosCentavos ?? null}
          />

          {/* Tarefas do processo (G1/G3). */}
          <div className="card-hero p-6">
            <Eyebrow>Tarefas do processo</Eyebrow>
            {tarefas.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Nenhuma tarefa espelhada. Clique em “Atualizar do ProJuris”.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--border)]">
                {tarefas.map((t) => (
                  <li key={t.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[var(--navy)]">
                        {t.tipo_nome || t.tipo_codigo || "Tarefa"}
                      </div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">
                        {t.responsavel_nome
                          ? `Responsável: ${t.responsavel_nome}`
                          : "Sem responsável"}
                        {(t.prazo_previsto || t.prazo_fatal) && (
                          <span className="ml-2">
                            · Prazo previsto: {fmtDate(t.prazo_previsto)} · Fatal:{" "}
                            {fmtDate(t.prazo_fatal)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge
                      className={
                        t.concluida
                          ? "bg-green-600 text-white"
                          : "bg-[var(--muted)] text-muted-foreground"
                      }
                    >
                      {t.situacao ?? (t.concluida ? "Concluída" : "Em aberto")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* M5 — vincular/editar o identificador do processo no ProJuris. */}
      {podeEditar && (
        <ProjurisLinkDialog
          caseId={id}
          open={linkOpen}
          onOpenChange={setLinkOpen}
          codigoAtual={judicial?.codigoProcesso ?? null}
          numeroAtual={judicial?.numeroProcesso ?? null}
        />
      )}

      {/* Andamentos com scroll + limite (G5). */}
      <Dialog open={andamentosOpen} onOpenChange={setAndamentosOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Andamentos do processo</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {fetchingAndamentos && !andamentos ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !andamentos || andamentos.items.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Nenhum andamento disponível.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {andamentos.items.map((rec, i) => {
                  const desc =
                    rec.descricao ??
                    rec.texto ??
                    rec.movimento ??
                    JSON.stringify(rec).slice(0, 200);
                  const data = rec.data ?? rec.dataAndamento ?? rec.dataMovimento ?? "";
                  return (
                    <li key={i} className="py-2.5 text-[13px]">
                      {data && (
                        <span className="text-[11px] text-muted-foreground mr-2">
                          {String(data)}
                        </span>
                      )}
                      <span className="text-[var(--navy)]">{String(desc)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {andamentos?.hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={fetchingAndamentos}
                onClick={() => setAndamentosLimit((n) => n + 30)}
              >
                {fetchingAndamentos ? "Carregando…" : "Carregar mais"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-[var(--navy)] font-medium mt-0.5 break-words">{value}</dd>
    </div>
  );
}

// Honorários contratuais MANUAIS do SHV (estimados/provisionados) — o docx do
// Thiago diz "apenas manter no SHV" (não vem do ProJuris). Edição gate-ada por
// controladoria:edit (o servidor barra; a UI só oculta o botão).
function HonorariosBlock({
  caseId,
  podeEditar,
  estimados,
  provisionados,
}: {
  caseId: string;
  podeEditar: boolean;
  estimados: number | null;
  provisionados: number | null;
}) {
  const save = useSetCaseHonorariosJudicial(caseId);
  const [editing, setEditing] = useState(false);
  const [est, setEst] = useState("");
  const [prov, setProv] = useState("");

  function startEdit() {
    setEst(estimados != null ? (estimados / 100).toFixed(2).replace(".", ",") : "");
    setProv(provisionados != null ? (provisionados / 100).toFixed(2).replace(".", ",") : "");
    setEditing(true);
  }
  async function handleSave() {
    try {
      await save.mutateAsync({
        estimadosCentavos: reaisToCentavos(est),
        provisionadosCentavos: reaisToCentavos(prov),
      });
      toast.success("Honorários salvos");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar honorários");
    }
  }

  return (
    <div className="card-hero p-6 mt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Honorários contratuais (SHV)</Eyebrow>
          <p className="text-[11px] text-muted-foreground mt-1">
            Preenchimento manual — não vem do ProJuris.
          </p>
        </div>
        {podeEditar && !editing && (
          <Button variant="ghost" size="sm" className="h-7 -mt-1 text-[12px]" onClick={startEdit}>
            <Pencil size={13} className="mr-1.5" /> Editar
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Estimados (R$)</Label>
            <Input
              value={est}
              onChange={(e) => setEst(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
          <div>
            <Label>Provisionados (R$)</Label>
            <Input
              value={prov}
              onChange={(e) => setProv(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={save.isPending}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid sm:grid-cols-2 gap-4 text-[13px]">
          <Field label="Estimados" value={brl(estimados)} />
          <Field label="Provisionados" value={brl(provisionados)} />
        </div>
      )}
    </div>
  );
}

// M5 — mini-form para preencher/editar/limpar o vínculo ProJuris do caso.
// O identificador amigável `PRO.0007713` é o CÓDIGO interno do ProJuris; o input
// aceita `PRO.0007713` ou só o número (`7713`). O nº CNJ é texto livre. Salvar
// com ambos os campos vazios LIMPA o vínculo. A normalização real do código roda
// no servidor (setCaseProjurisLinkFn).
function ProjurisLinkDialog({
  caseId,
  open,
  onOpenChange,
  codigoAtual,
  numeroAtual,
}: {
  caseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  codigoAtual: number | null;
  numeroAtual: string | null;
}) {
  const setLink = useSetCaseProjurisLink(caseId);
  const [codigo, setCodigo] = useState(codigoAtual ? `PRO.${String(codigoAtual)}` : "");
  const [numero, setNumero] = useState(numeroAtual ?? "");

  // Reidrata os campos quando o dialog abre (pré-preenche com o vínculo atual).
  function handleOpenChange(v: boolean) {
    if (v) {
      setCodigo(codigoAtual ? `PRO.${String(codigoAtual)}` : "");
      setNumero(numeroAtual ?? "");
    }
    onOpenChange(v);
  }

  async function handleSave() {
    try {
      await setLink.mutateAsync({
        codigoProcesso: codigo.trim() === "" ? null : codigo.trim(),
        numeroProcesso: numero.trim() === "" ? null : numero.trim(),
      });
      const limpou = codigo.trim() === "" && numero.trim() === "";
      toast.success(limpou ? "Vínculo ProJuris removido." : "Vínculo ProJuris salvo.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar o vínculo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular ao ProJuris</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="projuris-codigo">Código do processo (ProJuris)</Label>
            <Input
              id="projuris-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="PRO.0007713 ou 7713"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Aceita o identificador (ex.: <code>PRO.0007713</code>) ou só o número. É o que o botão
              “Atualizar do ProJuris” usa para puxar o processo.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="projuris-numero">Nº do processo (CNJ)</Label>
            <Input
              id="projuris-numero"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="0733583-07.2026.8.07.0016"
              autoComplete="off"
            />
          </div>
          <div className="flex justify-between gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={setLink.isPending || (codigo.trim() === "" && numero.trim() === "")}
              onClick={() => {
                setCodigo("");
                setNumero("");
              }}
            >
              Limpar campos
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={setLink.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button size="sm" disabled={setLink.isPending} onClick={handleSave}>
                {setLink.isPending ? "Salvando…" : "Salvar vínculo"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
