// F1 — SUBMENU FINANCEIRO do caso (página própria, gate-ada por financeiro:view).
// Agrega o que ANTES era o bloco integral inline da ficha: detalhamento de
// parcelas/honorários (TermoPanel), cobranças/faturas (AsaasCobrancasPanel),
// conferência (CaseConferenciaFinPanel), o "mover" financeiro (MoveCaseFinDialog),
// entrar/voltar do financeiro, sync ContaAzul/Asaas (useSyncAllPagamentos) e os
// COMENTÁRIOS EXCLUSIVOS do financeiro (FinNotesBlock, scope='financeiro').
//
// GATE: a página inteira exige financeiro:view. Sem isso, mostra estado "sem
// permissão" e não monta nenhum bloco de $ (os hooks nem disparam). O servidor
// (rpc/financeiro.ts) já barra os RPCs com requireModule('financeiro', ...).

import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowRightLeft, DollarSign, FileText, Lock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Eyebrow, OrnamentalDivider } from "@/components/hv/primitives";
import { CaseConferenciaFinPanel } from "@/components/cases/CaseConferenciaFinPanel";
import { MoveCaseFinDialog } from "@/components/cases/MoveCaseFinDialog";
import { TermoPanel } from "@/components/cases/TermoPanel";
import { CaseStageChecklist } from "@/components/cases/CaseChecklistPanel";
import { FinNotesBlock } from "@/components/notes/FinNotesBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCase } from "@/hooks/useCases";
import { useEntrarFinanceiro, useVoltarOperacional } from "@/hooks/usePipeline";
import { useSyncAllPagamentos, useRastroFinanceiroCaso } from "@/hooks/useFinanceiro";
import { useMyModulePerms, useMyModuleValues, usePodeEditar } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth";
import { can, podeVerValores } from "@/lib/rbac";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";
import { CaseFinanceiroPanels } from "@/components/cases/CaseFinanceiroPanels";
import { useClient } from "@/hooks/useClients";
import { useTemas } from "@/hooks/useTemas";
import { MACRO_FIN_LABELS, type MacroFin } from "@/lib/cases/constants";

export const Route = createFileRoute("/casos/$id/financeiro")({
  component: CasoFinanceiro,
});

// S4-02 — helpers que vieram junto com o rastro financeiro (mesma implementação
// que a ficha do caso usava, para os números não mudarem de formato no caminho).
function brlCentavos(c: number | null | undefined) {
  return "R$ " + ((c ?? 0) / 100).toFixed(2).replace(".", ",");
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function CasoFinanceiro() {
  const { id } = useParams({ from: "/casos/$id/financeiro" });
  const { role } = useAuth();
  const { data: perms } = useMyModulePerms();
  const { data: values } = useMyModuleValues();
  const podeVerFinanceiro = podeVerValores(role, perms ?? {}, values ?? {}, "financeiro");
  const podeEditarFin = usePodeEditar("financeiro");
  const podeFinanceiro = can(role, "financeiro.manage");

  const { data: caso, isLoading } = useCase(id);
  // FN1 — o nome do tema e do cliente alimentam a descrição padrão da despesa
  // ("{Tipo}: caso {tema} - {Nome cliente}", do doc).
  const { data: cliente } = useClient(
    (caso as { client_id?: string } | undefined)?.client_id ?? "",
  );
  const { data: temasFin } = useTemas();
  const entrar = useEntrarFinanceiro();
  const voltar = useVoltarOperacional();
  const sync = useSyncAllPagamentos();
  // S4-02 — totais do rastro financeiro (vieram da ficha do caso).
  const { data: rastroFin } = useRastroFinanceiroCaso(id, podeVerFinanceiro);

  const [moveFinOpen, setMoveFinOpen] = useState(false);

  useDocumentTitle(
    `${resolveEntityLabel(caso?.case_code, { notFoundLabel: "Caso" })} · Financeiro`,
  );

  // GATE de VISIBILIDADE — quem não tem financeiro:view nunca vê valores.
  if (!podeVerFinanceiro) {
    return (
      <div className="page-container">
        <div className="card-hero p-10 text-center">
          <Lock size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para ver o financeiro deste caso.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !caso) {
    return (
      <div className="page-container">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const finBifurcated = caso.macrostatus_fin !== "NAO_APLICAVEL";
  const tipoLabelCaso =
    (temasFin as { id: string; name: string }[] | undefined)?.find(
      (t) => t.id === (caso as { tema_id?: string | null }).tema_id,
    )?.name ?? null;
  const clienteNome = (cliente as { full_name?: string } | undefined)?.full_name ?? null;
  const finLabel = MACRO_FIN_LABELS[caso.macrostatus_fin as MacroFin] ?? caso.macrostatus_fin;
  const diasFin = daysSince(
    (caso as { status_fin_changed_at?: string | null }).status_fin_changed_at,
  );
  const removidoDoOp = !!(caso as { removido_do_operacional_at?: string | null })
    .removido_do_operacional_at;

  return (
    <div className="page-container">
      <header className="flex items-start justify-between gap-6 mb-6">
        <div>
          <Eyebrow>Financeiro do caso</Eyebrow>
          <h1 className="font-display text-[28px] font-bold text-[var(--navy)] mt-1">
            {caso.case_code}
          </h1>
          <div className="mt-2 flex items-center gap-3 text-[13px]">
            <span className="text-[var(--navy)] font-medium">
              Etapa: {finBifurcated ? finLabel : "Não bifurcado"}
            </span>
            {removidoDoOp && (
              <Badge className="bg-[var(--muted)] text-muted-foreground">Fora do operacional</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {/* M4 (2026-08-07) — Termo é 100% financeiro: acessível DE DENTRO do
              Financeiro (saiu da nav de topo). A rota /termo é gate-ada por
              financeiro:view, mas aqui já estamos nesse gate. */}
          <Link to="/casos/$id/termo" params={{ id }}>
            <Button variant="outline" size="sm">
              <FileText size={14} className="mr-1.5" /> Termo de honorários
            </Button>
          </Link>
          {finBifurcated && podeFinanceiro && (
            <Button variant="outline" size="sm" onClick={() => setMoveFinOpen(true)}>
              <ArrowRightLeft size={14} className="mr-1.5" /> Mover etapa
            </Button>
          )}
          {/* Sync ContaAzul/Asaas DENTRO do módulo (AC-7) — gate financeiro:edit. */}
          {podeEditarFin && (
            <Button
              variant="outline"
              size="sm"
              disabled={sync.isPending}
              onClick={async () => {
                try {
                  await sync.mutateAsync();
                  toast.success("Sincronização concluída (ContaAzul + Asaas)");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha ao sincronizar");
                }
              }}
            >
              <RefreshCw size={14} className={`mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} />
              {sync.isPending ? "Sincronizando…" : "Sincronizar ContaAzul/Asaas"}
            </Button>
          )}
        </div>
      </header>

      {/* Fluxo entrar/voltar financeiro (gate por podeFinanceiro). */}
      {(!finBifurcated || removidoDoOp) && podeFinanceiro && (
        <div className="card-hero p-5 mb-6 flex flex-wrap items-center gap-3">
          {!finBifurcated && (
            <Button
              size="sm"
              disabled={entrar.isPending}
              onClick={async () => {
                try {
                  await entrar.mutateAsync({ caseId: caso.id, removerOperacional: false });
                  toast.success("Caso enviado para o financeiro");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha");
                }
              }}
            >
              <DollarSign size={14} className="mr-1.5" /> Enviar para o financeiro
            </Button>
          )}
          {removidoDoOp && (
            <Button
              size="sm"
              variant="outline"
              disabled={voltar.isPending}
              onClick={async () => {
                try {
                  await voltar.mutateAsync(caso.id);
                  toast.success("Caso devolvido ao operacional");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha");
                }
              }}
            >
              Trazer de volta ao operacional
            </Button>
          )}
        </div>
      )}

      {finBifurcated ? (
        <div className="space-y-6">
          {/* S4-02 (reunião 02/09) — RASTRO FINANCEIRO, vindo da ficha do caso.
              Thiago: "Esse painel rastro financeiro vai para a aba 'financeiro'".
              Traz o que o card tinha: etapa + tempo no estado, checklist da etapa
              financeira e os totais. Mover etapa e entrar/voltar já existem no
              cabeçalho desta página. */}
          <div className="card-hero p-6">
            <Eyebrow>Rastro financeiro</Eyebrow>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[17px] font-semibold text-[var(--navy)]">{finLabel}</span>
              <span className="text-[12px] text-muted-foreground">
                há {diasFin} dia(s) neste estado
              </span>
            </div>

            {caso.macrostatus_fin && caso.macrostatus_fin !== "NAO_APLICAVEL" && (
              <CaseStageChecklist
                caseId={caso.id}
                stageSlug={caso.macrostatus_fin}
                canEdit={podeEditarFin}
                className="mt-4 pt-4 border-t border-[rgba(30,32,68,0.08)]"
              />
            )}

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  A pagar
                </div>
                <div className="text-[15px] font-semibold text-[var(--navy)]">
                  {brlCentavos(rastroFin?.a_pagar_centavos)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Vencido
                </div>
                <div className="text-[15px] font-semibold text-[var(--danger)]">
                  {brlCentavos(rastroFin?.vencido_centavos)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Pago
                </div>
                <div className="text-[15px] font-semibold text-green-700">
                  {brlCentavos(rastroFin?.pago_centavos)}
                </div>
              </div>
            </div>
          </div>

          {/* Detalhamento de parcelas / honorários. */}
          <TermoPanel caseId={caso.id} />

          {/* Conferência financeira (dupla checagem). */}
          {caso.service_type_id && (
            <div className="card-hero p-6">
              <CaseConferenciaFinPanel
                caseId={caso.id}
                serviceTypeId={caso.service_type_id}
                currentFinSlug={caso.macrostatus_fin}
              />
            </div>
          )}

          {/* S4-03 (reunião 02/09) — o painel COBRANÇAS ("Sync Conta Azul / Sync
              Asaas / Nova cobrança") foi REMOVIDO daqui. Thiago: "Esse painel era
              de uma ideia anterior sobre gerar cobrança no CA/ASAAS. Substituímos
              pelos paineis logo abaixo, vamos remover esse painel e reutilizar o
              espaço."
              As parcelas continuam visíveis no TermoPanel (acima) e os registros
              em "Valores do caso" (abaixo) — nada de informação se perdeu.
              O componente `AsaasCobrancasPanel` e todo o backend de Conta
              Azul/Asaas seguem no repositório, intactos, para quando a integração
              de cobrança for retomada (fora desta leva por decisão do owner). */}
        </div>
      ) : (
        <div className="card-hero p-8 text-center text-sm text-muted-foreground">
          Este caso ainda não está na pipeline financeira.
        </div>
      )}

      <OrnamentalDivider />

      {/* FN1 (2026-08-26) — REGISTROS FINANCEIROS DO CASO (doc 25.08).
          Vive fora do `if` da bifurcação de propósito: o Thiago quer poder
          registrar valor a receber/pagar mesmo em caso que ainda não entrou na
          pipeline financeira ("valores que são questões futuras e que dependem
          de outra situação"). */}
      <CaseFinanceiroPanels
        caseId={caso.id}
        temaNome={tipoLabelCaso}
        clienteNome={clienteNome}
        podeEditar={podeEditarFin}
      />

      <OrnamentalDivider />

      {/* Comentários EXCLUSIVOS do financeiro (scope='financeiro'). */}
      <FinNotesBlock caseId={caso.id} canEdit={podeEditarFin} />

      <MoveCaseFinDialog
        open={moveFinOpen}
        onOpenChange={setMoveFinOpen}
        caseId={caso.id}
        caseCode={caso.case_code}
        currentFinSlug={caso.macrostatus_fin}
        serviceTypeId={caso.service_type_id}
      />
    </div>
  );
}
