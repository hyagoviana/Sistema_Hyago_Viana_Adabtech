// Ficha do caso (conteúdo principal). F1/G1/G4 (2026-08-05): a rota
// `/casos/$id` virou um LAYOUT fino (casos.$id.tsx) com nav de submenus +
// <Outlet/>; ESTE arquivo (casos.$id.index.tsx) é a ficha comum de antes.
//
// Preserva J2 (editar nome do caso — CaseNameEditDialog) e C3 (rastro
// operacional multi-kanban via useCaseOperationalTrail). Mudanças F1:
//   - REMOVIDO o bloco financeiro integral (TermoPanel + AsaasCobrancasPanel);
//     o "Rastro Financeiro" vira um RESUMO (etapa + a pagar/vencido/pago) com
//     botão "Abrir financeiro" → submenu (/casos/$id/financeiro).
//   - Timeline filtra eventos `fin_*` (isolamento — ver CaseTimeline).
// Mudança G1/G4: card "Judicial" resumido (só quando podeVerJudicial) + seção
//   de gestão de sigilo (só gestor do caso) — abrem o submenu /casos/$id/judicial.

import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  DollarSign,
  ExternalLink,
  FileSignature,
  FolderOpen,
  Gavel,
  Layers,
  ListPlus,
  Pencil,
  Phone,
  SlidersHorizontal,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  CaseChecklistPanel,
  ChecklistInconsistencyAlert,
} from "@/components/cases/CaseChecklistPanel";
import { CaseCanonicalFields } from "@/components/cases/CaseCanonicalFields";
import { CaseDossie } from "@/components/cases/CaseDossie";
import { CaseFeed } from "@/components/cases/CaseFeed";
import { CaseSigiloSection } from "@/components/cases/CaseSigiloSection";
import { GenerateCaseDocumentFlow } from "@/components/cases/GenerateCaseDocumentFlow";
import { CaseFilterFillDialog } from "@/components/cases/CaseFilterFillDialog";
import { CaseNameEditDialog } from "@/components/cases/CaseNameEditDialog";
import { MoveCaseDialog } from "@/components/cases/MoveCaseDialog";
import { MoveCaseFinDialog } from "@/components/cases/MoveCaseFinDialog";
import { AddCaseToBoardDialog } from "@/components/cases/AddCaseToBoardDialog";
import { LinkCaseToTemaDialog } from "@/components/cases/LinkCaseToTemaDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow, OrnamentalDivider } from "@/components/hv/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMyModulePerms, useMyModuleValues, usePodeEditar } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth";
import { can, podeVerValores } from "@/lib/rbac";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";
import { useClient } from "@/hooks/useClients";
import { useMunicipios, usePerfis } from "@/hooks/useReferencias";
import {
  augmentWithHonorarios,
  augmentWithMunicipio,
  augmentWithPerfil,
  augmentWithResponsaveis,
  buildAutoFillFromClient,
} from "@/lib/cases/document-autofill";
import { useCaseHonorarios } from "@/hooks/useTermo";
import {
  useCase,
  useCaseEvents,
  useCaseResponsaveis,
  useDeleteCase,
  usePromoverCasoManual,
  useUpdateCaseObservacoes,
  useSetCaseUrgency,
} from "@/hooks/useCases";
import { useEntrarFinanceiro, useVoltarOperacional } from "@/hooks/usePipeline";
import { useRastroFinanceiroCaso } from "@/hooks/useFinanceiro";
import { usePodeVerJudicial } from "@/hooks/usePodeVerJudicial";
import { useCaseJudicial } from "@/hooks/useJudicial";
import { useCaseOperationalTrail } from "@/hooks/useBoards";
import {
  CASE_TYPE_LABELS,
  MACRO_FIN_LABELS,
  MACRO_OP_LABELS,
  type CaseType,
  type MacroFin,
  type MacroOp,
} from "@/lib/cases/constants";

export const Route = createFileRoute("/casos/$id/")({
  component: CasoDetalhe,
});

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function brl(c: number | null | undefined) {
  return "R$ " + ((c ?? 0) / 100).toFixed(2).replace(".", ",");
}

function maskPhone(phone: string | null): string {
  if (!phone) return "·";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function CasoDetalhe() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const { data: caso, isLoading, isError, error } = useCase(id);
  const { data: events } = useCaseEvents(id);
  const remove = useDeleteCase();
  const entrar = useEntrarFinanceiro();
  const voltar = useVoltarOperacional();
  const promover = usePromoverCasoManual();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const podeFinanceiro = can(role, "financeiro.manage");
  const podeGerirCaso = usePodeEditar("operacional");
  const { data: perms } = useMyModulePerms();
  const { data: values } = useMyModuleValues();
  const podeVerFinanceiro = podeVerValores(role, perms ?? {}, values ?? {}, "financeiro");
  const { data: municipios } = useMunicipios();
  const { data: perfis } = usePerfis();
  const { data: honorarios } = useCaseHonorarios(id);
  const { data: responsaveis } = useCaseResponsaveis(id);
  // C3 (2026-08-05) — rastro operacional MULTI-KANBAN (preservado).
  const { data: opTrail } = useCaseOperationalTrail(id);
  // F1 (AC-4) — rastro financeiro RESUMIDO por caso (só carrega p/ financeiro:view).
  const { data: rastroFin } = useRastroFinanceiroCaso(id, podeVerFinanceiro);
  // G4 — visibilidade do submenu Judicial (regra de sigilo). G1 usa o mesmo hook.
  const { podeVer: podeVerJudicial } = usePodeVerJudicial(id);
  // G1 — resumo judicial do caso (só carrega quando pode ver o judicial).
  const { data: judicial } = useCaseJudicial(id, podeVerJudicial);

  useDocumentTitle(
    resolveEntityLabel(caso?.case_code, {
      loading: isLoading,
      notFound: isError,
      notFoundLabel: "Caso não encontrado",
    }),
  );

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFinOpen, setMoveFinOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [entrarOpen, setEntrarOpen] = useState(false);
  const [linkTemaOpen, setLinkTemaOpen] = useState(false);
  const [addBoardOpen, setAddBoardOpen] = useState(false);
  const [genFlowOpen, setGenFlowOpen] = useState(false);
  const [fillFiltersOpen, setFillFiltersOpen] = useState(false);
  const [nameEditOpen, setNameEditOpen] = useState(false);

  // M2 (2026-08-07) — Observações (texto livre do caso). O rascunho é semeado a
  // partir de caso.observacoes; `obsSeededFor` garante o seed 1x por caso (e re-
  // seed se a rota trocar de caso), sem sobrescrever a edição do usuário.
  const salvarObs = useUpdateCaseObservacoes(id);
  // M13 (T3) — urgência do caso (prioritário/urgente) p/ o motor de distribuição.
  const setUrgency = useSetCaseUrgency(id);
  const [obsDraft, setObsDraft] = useState("");
  const [obsSeededFor, setObsSeededFor] = useState<string | null>(null);

  async function handlePromover() {
    try {
      await promover.mutateAsync(id);
      toast.success("Caso promovido para CLIENTE");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao promover caso");
    }
  }

  const { data: cliente } = useClient(caso?.client_id ?? "");

  if (isLoading) {
    return (
      <div className="page-container">
        <Skeleton className="h-6 w-64 mb-4" />
        <Skeleton className="h-24 w-full mb-8" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "desconhecido";
    if (msg.toLowerCase().includes("não encontrado")) throw notFound();
    return (
      <div className="page-container">
        <Alert variant="destructive">
          <AlertDescription>Erro ao carregar caso: {msg}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!caso) throw notFound();

  // M2 — semeia o rascunho de Observações 1x por caso (padrão React de derivar
  // estado durante o render, guardado por id → sem loop e sem useEffect).
  const casoObservacoes = (caso as { observacoes?: string | null }).observacoes ?? "";
  if (obsSeededFor !== caso.id) {
    setObsSeededFor(caso.id);
    setObsDraft(casoObservacoes);
  }
  const obsDirty = obsDraft !== casoObservacoes;

  async function handleSalvarObs() {
    try {
      await salvarObs.mutateAsync(obsDraft);
      toast.success("Observações salvas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar observações");
    }
  }

  const dias = daysSince(caso.status_changed_at);
  const diasFin = daysSince(caso.status_fin_changed_at);
  const tipoLabel =
    (caso as { caso_pasta_nome?: string | null }).caso_pasta_nome ??
    CASE_TYPE_LABELS[caso.case_type as CaseType] ??
    caso.case_type;
  const opLabel = MACRO_OP_LABELS[caso.macrostatus_op as MacroOp] ?? caso.macrostatus_op;
  const finLabel = MACRO_FIN_LABELS[caso.macrostatus_fin as MacroFin] ?? caso.macrostatus_fin;
  const finBifurcated = caso.macrostatus_fin !== "NAO_APLICAVEL";
  const lifecycle =
    (caso as { lifecycle?: "LEAD" | "CLIENTE" | "PERDIDO" | null }).lifecycle ?? "LEAD";
  const lifecycleMeta: Record<string, { label: string; cls: string }> = {
    LEAD: { label: "Lead", cls: "bg-[var(--muted)] text-muted-foreground" },
    CLIENTE: { label: "Cliente", cls: "bg-green-600 text-white" },
    PERDIDO: { label: "Perdido", cls: "bg-red-600 text-white" },
  };
  const procuracaoAssinada = !!(caso as { procuracao_assinada_at?: string | null })
    .procuracao_assinada_at;
  const lcMeta =
    lifecycle === "LEAD" && procuracaoAssinada
      ? lifecycleMeta.CLIENTE
      : (lifecycleMeta[lifecycle] ?? lifecycleMeta.LEAD);
  const removidoDoOp = !!(caso as { removido_do_operacional_at?: string | null })
    .removido_do_operacional_at;

  let docAutoFill = buildAutoFillFromClient(cliente ?? {}, caso);
  const municipioRow = (municipios ?? []).find(
    (m) => m.nome.trim().toLowerCase() === (caso.municipio ?? "").trim().toLowerCase(),
  );
  docAutoFill = augmentWithMunicipio(docAutoFill, municipioRow);
  const perfilNum = Object.entries(docAutoFill.canonical ?? {}).find(
    ([k]) => /perfil/i.test(k) && !/informa/i.test(k),
  )?.[1];
  const perfilRow = perfilNum
    ? (perfis ?? []).find((p) => p.nome.trim().toLowerCase() === perfilNum.trim().toLowerCase())
    : undefined;
  docAutoFill = augmentWithPerfil(docAutoFill, perfilRow);
  docAutoFill = augmentWithHonorarios(docAutoFill, honorarios);
  docAutoFill = augmentWithResponsaveis(docAutoFill, responsaveis);

  const judProcesso = judicial?.processo as
    | { tribunal?: string | null; orgao?: string | null; fase?: string | null }
    | null
    | undefined;

  return (
    <div className="page-container">
      {/* S2-05 — alerta de checklist inconsistente */}
      <ChecklistInconsistencyAlert events={events} />

      <header className="flex items-start justify-between gap-8 mb-8">
        <div>
          <Eyebrow>Caso · {caso.case_code}</Eyebrow>
          <h1 className="font-display text-[40px] font-bold text-[var(--navy)] leading-tight mt-2 flex items-center gap-2 flex-wrap">
            <span>
              {cliente?.full_name ?? "·"}{" "}
              <span className="text-[var(--gold-700)]">· {tipoLabel}</span>
            </span>
            {/* J2 — editar o nome do caso (caso_pasta_nome). */}
            {podeGerirCaso && (
              <button
                type="button"
                onClick={() => setNameEditOpen(true)}
                title="Editar nome do caso"
                className="text-muted-foreground hover:text-[var(--gold-700)] transition-colors"
              >
                <Pencil size={18} />
              </button>
            )}
          </h1>
          {cliente && (
            <div className="mt-4 flex items-center gap-5 text-[13px] text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Phone size={12} /> {maskPhone(cliente.phone)}
              </span>
              {cliente.email && (
                <>
                  <span className="text-[var(--gold)]">·</span>
                  <span>{cliente.email}</span>
                </>
              )}
              <span className="text-[var(--gold)]">·</span>
              <Link
                to="/clientes/$id"
                params={{ id: cliente.id }}
                className="text-[var(--gold-700)] hover:underline"
              >
                Ver ficha do cliente →
              </Link>
            </div>
          )}
        </div>
        <div className="flex gap-2 self-start flex-wrap justify-end">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold self-center ${lcMeta.cls}`}
            title="Ciclo de vida do caso"
          >
            {lcMeta.label}
          </span>
          {/* M13 (T3) — urgência p/ o motor (prioritário/urgente). Campo nosso,
              não existe no ProJuris. Só quem gere o caso edita. */}
          {podeGerirCaso && (
            <select
              value={
                (caso as { distribution_urgency?: string | null }).distribution_urgency ?? "normal"
              }
              onChange={(e) => {
                const v = e.target.value as "normal" | "prioritario" | "urgente";
                setUrgency.mutate(v, {
                  onSuccess: () =>
                    toast.success(v === "normal" ? "Urgência removida" : `Marcado como ${v}`),
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : "Falha ao salvar urgência"),
                });
              }}
              disabled={setUrgency.isPending}
              title="Urgência para o motor de distribuição"
              className="self-center h-7 rounded-full border border-[var(--border)] bg-white px-2 text-[11px] font-semibold text-[var(--navy)]"
            >
              <option value="normal">Normal</option>
              <option value="prioritario">Prioritário</option>
              <option value="urgente">Urgente</option>
            </select>
          )}
          {podeGerirCaso &&
            lifecycle !== "CLIENTE" &&
            lifecycle !== "PERDIDO" &&
            !procuracaoAssinada && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePromover}
                disabled={promover.isPending}
              >
                <UserCheck size={14} className="mr-1.5" />
                {promover.isPending ? "Promovendo…" : "Marcar como cliente"}
              </Button>
            )}
          {podeFinanceiro && !finBifurcated && (
            <Button variant="outline" size="sm" onClick={() => setEntrarOpen(true)}>
              <DollarSign size={14} className="mr-1.5" /> Enviar para o financeiro
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setGenFlowOpen(true)}>
            <FileSignature size={14} className="mr-1.5" /> Enviar contrato e procuração
          </Button>
          {podeGerirCaso && (
            <Button variant="outline" size="sm" onClick={() => setLinkTemaOpen(true)}>
              <Layers size={14} className="mr-1.5" /> Vincular ao tema ou kanban
            </Button>
          )}
          {podeGerirCaso && caso.service_type_id && (
            <Button variant="outline" size="sm" onClick={() => setAddBoardOpen(true)}>
              <ListPlus size={14} className="mr-1.5" /> Adicionar à lista
            </Button>
          )}
          {podeGerirCaso && (
            <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)}>
              <ArrowRightLeft size={14} className="mr-1.5" /> Mover status
            </Button>
          )}
          {podeGerirCaso && (caso as { tema_id?: string | null }).tema_id && (
            <Button variant="outline" size="sm" onClick={() => setFillFiltersOpen(true)}>
              <SlidersHorizontal size={14} className="mr-1.5" /> Preencher campos
            </Button>
          )}
          {podeGerirCaso && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} className="mr-1.5" /> Excluir
            </Button>
          )}
        </div>
      </header>

      {caso.drive_folder_url && (
        <div className="card-hero p-5 mb-6 flex items-center justify-between">
          <div>
            <Eyebrow>Pasta no Drive</Eyebrow>
            <p className="text-[13px] text-muted-foreground mt-1">
              Arquivos do cliente ficam aqui · você pode subir/baixar pelo Drive direto.
            </p>
          </div>
          <a
            href={caso.drive_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[var(--navy)] text-[13px] font-medium hover:border-[var(--gold)] hover:bg-[var(--cream)] transition-colors shrink-0"
          >
            <FolderOpen size={16} className="text-[var(--gold-700)]" /> Abrir no Drive
            <ExternalLink size={12} className="text-muted-foreground" />
          </a>
        </div>
      )}

      {/* Ordem da ficha (2026-08-08): Rastro Operacional → Checklist → Sigilo →
          Judicial → Dados do caso → Notas/Linha do tempo → Tarefas/Prazos/
          Comunicações (CaseDossie) → Observações. */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-hero p-7">
          <Eyebrow>Rastro Operacional</Eyebrow>
          {/* C3 (2026-08-05) — MULTI-KANBAN com cards clicáveis por board. */}
          {opTrail && opTrail.length > 0 ? (
            <div className="mt-4 space-y-3">
              {opTrail.map((t, idx) => (
                <Link
                  key={t.board_id ?? "__principal__"}
                  to="/pipeline"
                  search={{
                    cat: caso.service_type_id ?? undefined,
                    catName: tipoLabel,
                    ...(t.board_id ? { board: t.board_id } : {}),
                  }}
                  className="block rounded-lg border border-[rgba(30,32,68,0.10)] px-4 py-3 hover:border-[var(--gold-400,rgba(180,155,80,0.4))] hover:bg-[rgba(180,155,80,0.03)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{
                        background: t.is_principal
                          ? "var(--gold-100, rgba(180,155,80,0.15))"
                          : "rgba(30,32,68,0.08)",
                        color: t.is_principal
                          ? "var(--gold-700, #8a6d1b)"
                          : "var(--navy, #1e2044)",
                      }}
                    >
                      {t.is_principal ? "Kanban Principal" : `Kanban ${idx + 1} · ${t.board_label}`}
                    </span>
                    {t.entered_at && (
                      <span className="text-[11px] text-muted-foreground">
                        há {daysSince(t.entered_at)} dia(s)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-semibold text-[var(--navy)]">
                      {t.stage_label}
                    </span>
                    <ExternalLink size={13} className="text-muted-foreground opacity-50" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[17px] font-semibold text-[var(--navy)]">{opLabel}</span>
              <span className="text-[12px] text-muted-foreground">
                há {dias} dia(s) neste estado
              </span>
            </div>
          )}
        </div>

        {/* F1 (AC-3/AC-4) — Rastro Financeiro RESUMIDO. O bloco integral
            (TermoPanel + AsaasCobrancasPanel) foi movido para o submenu
            /casos/$id/financeiro. Aqui só: etapa + a pagar/vencido/pago +
            "Abrir financeiro". Só para quem tem financeiro:view. */}
        {podeVerFinanceiro && (
          <div className="card-hero p-7">
            <div className="flex items-start justify-between">
              <Eyebrow>Rastro Financeiro</Eyebrow>
              {finBifurcated && (
                <button
                  type="button"
                  onClick={() => setMoveFinOpen(true)}
                  className="text-[var(--gold-700)] hover:underline text-[11px] inline-flex items-center gap-1 normal-case tracking-normal"
                >
                  <ArrowRightLeft size={11} /> mover
                </button>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[17px] font-semibold text-[var(--navy)]">
                {finBifurcated ? finLabel : "Não bifurcado"}
              </span>
              {finBifurcated && (
                <span className="text-[12px] text-muted-foreground">
                  há {diasFin} dia(s) neste estado
                </span>
              )}
            </div>

            {finBifurcated && (
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    A pagar
                  </div>
                  <div className="text-[15px] font-semibold text-[var(--navy)]">
                    {brl(rastroFin?.a_pagar_centavos)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Vencido
                  </div>
                  <div className="text-[15px] font-semibold text-[var(--danger)]">
                    {brl(rastroFin?.vencido_centavos)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Pago
                  </div>
                  <div className="text-[15px] font-semibold text-green-700">
                    {brl(rastroFin?.pago_centavos)}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-[rgba(30,32,68,0.08)] space-y-4">
              {removidoDoOp && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-[var(--muted)] text-muted-foreground">
                    Fora do operacional
                  </Badge>
                  {podeFinanceiro && (
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

              {!finBifurcated && podeFinanceiro && (
                <Button size="sm" onClick={() => setEntrarOpen(true)}>
                  Enviar para o financeiro
                </Button>
              )}

              {/* F1 (AC-1/AC-3) — abre o submenu financeiro (detalhamento, cobranças, sync). */}
              <div>
                <Link to="/casos/$id/financeiro" params={{ id: caso.id }}>
                  <Button size="sm" variant="outline">
                    <DollarSign size={13} className="mr-1.5" /> Abrir financeiro
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <OrnamentalDivider />

      <CaseChecklistPanel
        caseId={caso.id}
        currentStageSlugs={[
          caso.macrostatus_op,
          // C3-ext — inclui os stage slugs dos boards CUSTOM (multi-kanban)
          ...(opTrail ?? [])
            .filter((t) => !t.is_principal && t.stage_slug)
            .map((t) => t.stage_slug!),
          caso.macrostatus_fin,
        ].filter((s): s is string => !!s && s !== "NAO_APLICAVEL")}
        boardTrail={opTrail}
        serviceTypeId={caso.service_type_id}
        serviceTypeName={tipoLabel}
        canEdit={podeGerirCaso}
      />

      {/* G4 — gestão de sigilo: só ADMINISTRADORES (pedido reunião 2026-08-10). */}
      {isAdmin && (
        <>
          <OrnamentalDivider />
          <CaseSigiloSection caseId={caso.id} />
        </>
      )}

      {/* G1/G4 — Rastro JUDICIAL resumido (tribunal + nº + etapa) + "Abrir
          judicial". Some para não-autorizados em caso sigiloso (usePodeVerJudicial). */}
      {podeVerJudicial && (
        <>
          <OrnamentalDivider />
          <div className="card-hero p-7">
            <div className="flex items-center gap-2">
              <Gavel size={16} className="text-[var(--gold-700)]" />
              <Eyebrow>Judicial (ProJuris)</Eyebrow>
            </div>
            {judicial?.vinculado ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
                <span className="text-[var(--navy)]">
                  <span className="text-muted-foreground">Tribunal/órgão: </span>
                  {judProcesso?.tribunal || judProcesso?.orgao || "·"}
                </span>
                <span className="text-[var(--navy)]">
                  <span className="text-muted-foreground">Nº processo: </span>
                  {judicial.numeroProcesso ?? "·"}
                </span>
                <span className="text-[var(--navy)]">
                  <span className="text-muted-foreground">Etapa: </span>
                  {judProcesso?.fase ?? "·"}
                </span>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Nenhum processo ProJuris vinculado a este caso.
              </p>
            )}
            <div className="mt-4">
              <Link to="/casos/$id/judicial" params={{ id: caso.id }}>
                <Button size="sm" variant="outline">
                  <Gavel size={13} className="mr-1.5" /> Abrir judicial
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}

      {(caso as { tema_id?: string | null }).tema_id && (
        <>
          <OrnamentalDivider />
          <CaseCanonicalFields
            caseId={caso.id}
            canonicalFields={
              (caso as { canonical_fields?: Record<string, unknown> | null }).canonical_fields ??
              null
            }
            canEdit={podeGerirCaso}
            temaId={(caso as { tema_id?: string | null }).tema_id ?? null}
            frenteSlug={caso.frente_slug}
            clientId={caso.client_id}
            clientCustomFields={
              (cliente as { custom_fields?: Record<string, unknown> | null } | undefined)
                ?.custom_fields ?? null
            }
          />
        </>
      )}

      {/* M1 (2026-08-07) — Feed "Notas / Linha do tempo": eventos automáticos +
          comentários das pessoas num fluxo cronológico só. */}
      <OrnamentalDivider />

      <CaseFeed caseId={caso.id} />

      {/* CaseDossie = Tarefas + Prazos + Comunicações (nesta ordem). */}
      <OrnamentalDivider />

      <CaseDossie caseId={caso.id} canEdit={podeGerirCaso} />

      {/* M3 (2026-08-07) — O CaseDocumentsTab saiu daqui: virou a aba de topo
          "Documentos" (casos.$id.documentos.tsx). O docAutoFill PERMANECE nesta
          ficha porque ainda alimenta o GenerateCaseDocumentFlow (contrato/procuração). */}

      {/* M2 (2026-08-07) — Observações: texto grande e livre do caso inteiro,
          separado da linha do tempo (NÃO emite evento). Fica no fim da ficha.
          Read-only para quem não pode gerir o caso (operacional:edit). */}
      <OrnamentalDivider />

      <div>
        <Eyebrow>Observações</Eyebrow>
        <p className="text-[13px] text-muted-foreground mt-1 mb-3">
          Texto livre sobre o desenvolvimento do caso. Fica só registrado aqui — não entra na linha
          do tempo.
        </p>
        <Textarea
          value={obsDraft}
          onChange={(e) => setObsDraft(e.target.value)}
          rows={8}
          className="resize-y"
          placeholder="Escreva livremente o histórico e as particularidades deste caso…"
          disabled={!podeGerirCaso || salvarObs.isPending}
          readOnly={!podeGerirCaso}
        />
        {podeGerirCaso && (
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={handleSalvarObs} disabled={salvarObs.isPending || !obsDirty}>
              {salvarObs.isPending ? "Salvando…" : "Salvar observações"}
            </Button>
          </div>
        )}
      </div>

      {/* J2 — editar o nome do caso (caso_pasta_nome). */}
      <CaseNameEditDialog
        open={nameEditOpen}
        onOpenChange={setNameEditOpen}
        caseId={caso.id}
        currentName={(caso as { caso_pasta_nome?: string | null }).caso_pasta_nome ?? null}
      />

      <MoveCaseDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        caseId={caso.id}
        caseCode={caso.case_code}
        caseType={caso.case_type}
        currentStatus={caso.macrostatus_op ?? ""}
      />

      <MoveCaseFinDialog
        open={moveFinOpen}
        onOpenChange={setMoveFinOpen}
        caseId={caso.id}
        caseCode={caso.case_code}
        currentFinSlug={caso.macrostatus_fin}
        serviceTypeId={caso.service_type_id}
      />

      <AddCaseToBoardDialog
        open={addBoardOpen}
        onOpenChange={setAddBoardOpen}
        caseId={caso.id}
        caseCode={caso.case_code}
        serviceTypeId={caso.service_type_id}
      />

      <LinkCaseToTemaDialog
        open={linkTemaOpen}
        onOpenChange={setLinkTemaOpen}
        caseId={caso.id}
        caseCode={caso.case_code}
        currentTemaId={(caso as { tema_id?: string | null }).tema_id ?? null}
        serviceTypeId={caso.service_type_id}
      />

      <Dialog open={entrarOpen} onOpenChange={setEntrarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar {caso.case_code} para o financeiro</DialogTitle>
            <DialogDescription>
              O caso entra na primeira etapa da pipeline financeira. Escolha se ele permanece também
              no operacional ou se sai dele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <button
              type="button"
              disabled={entrar.isPending}
              onClick={async () => {
                try {
                  await entrar.mutateAsync({ caseId: caso.id, removerOperacional: false });
                  toast.success("Caso duplicado para o financeiro");
                  setEntrarOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha");
                }
              }}
              className="w-full text-left rounded-md border border-[var(--border)] p-4 hover:border-[var(--gold)] transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--navy)]">Duplicar para o financeiro</div>
              <div className="text-[13px] text-muted-foreground mt-0.5">
                O caso fica nas duas pipelines (operacional + financeiro).
              </div>
            </button>
            <button
              type="button"
              disabled={entrar.isPending}
              onClick={async () => {
                try {
                  await entrar.mutateAsync({ caseId: caso.id, removerOperacional: true });
                  toast.success("Caso movido somente para o financeiro");
                  setEntrarOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha");
                }
              }}
              className="w-full text-left rounded-md border border-[var(--border)] p-4 hover:border-[var(--gold)] transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-[var(--navy)]">Somente financeiro</div>
              <div className="text-[13px] text-muted-foreground mt-0.5">
                O caso entra no financeiro e sai da pipeline operacional (reversível depois).
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEntrarOpen(false)}
              disabled={entrar.isPending}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GenerateCaseDocumentFlow
        open={genFlowOpen}
        onOpenChange={setGenFlowOpen}
        caseId={caso.id}
        caseType={caso.case_type}
        frenteSlug={caso.frente_slug}
        temaId={(caso as { tema_id?: string | null }).tema_id ?? null}
        clientId={caso.client_id}
        canonicalFields={
          (caso as { canonical_fields?: Record<string, unknown> | null }).canonical_fields ?? null
        }
        autoFill={docAutoFill}
        casoCriaNovoCaso
      />

      <CaseFilterFillDialog
        open={fillFiltersOpen}
        onOpenChange={setFillFiltersOpen}
        caseId={caso.id}
        clientId={caso.client_id}
        temaId={(caso as { tema_id?: string | null }).tema_id ?? null}
        frenteSlug={caso.frente_slug}
        initialValues={
          (caso as { canonical_fields?: Record<string, unknown> | null }).canonical_fields ?? null
        }
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {caso.case_code}?</AlertDialogTitle>
            <AlertDialogDescription>
              O caso fica como excluído (soft-delete) e some do Kanban e da Lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await remove.mutateAsync(caso.id);
                  toast.success(`${caso.case_code} excluído`);
                  navigate({ to: "/casos" });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha");
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
