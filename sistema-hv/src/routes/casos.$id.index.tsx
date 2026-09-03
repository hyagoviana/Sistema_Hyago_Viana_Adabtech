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
  Check,
  ChevronDown,
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
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  CaseStageChecklist,
  ChecklistInconsistencyAlert,
} from "@/components/cases/CaseChecklistPanel";
import { CaseCanonicalFields } from "@/components/cases/CaseCanonicalFields";
import { CaseDossie } from "@/components/cases/CaseDossie";
import { CaseFeed } from "@/components/cases/CaseFeed";
import { CaseObservacoes } from "@/components/cases/CaseObservacoes";
import { CaseLinkedCases } from "@/components/cases/CaseLinkedCases";
import { CaseSigiloSection } from "@/components/cases/CaseSigiloSection";
import { GenerateCaseDocumentFlow } from "@/components/cases/GenerateCaseDocumentFlow";
import { CaseFilterFillDialog } from "@/components/cases/CaseFilterFillDialog";
import { CaseNameEditDialog } from "@/components/cases/CaseNameEditDialog";
import { MoveCaseDialog } from "@/components/cases/MoveCaseDialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eyebrow, OrnamentalDivider } from "@/components/hv/primitives";
import { AuditTable } from "@/components/cases/AuditTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useMyModulePerms,
  useMyModuleValues,
  usePodeEditar,
  usePodeVer,
} from "@/hooks/usePermissions";
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
  useSetCaseUrgency,
  useSetCaseFieldsLocked,
} from "@/hooks/useCases";
import { useEntrarFinanceiro } from "@/hooks/usePipeline";
import { usePodeVerJudicial } from "@/hooks/usePodeVerJudicial";
import { useCaseJudicial } from "@/hooks/useJudicial";
import { useCaseOperationalTrail, useRemoveCaseFromBoard } from "@/hooks/useBoards";
import {
  CASE_TYPE_LABELS,
  MACRO_OP_LABELS,
  type CaseType,
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
  const podeVerAuditoria = usePodeVer("sistema");
  // C3 (2026-08-05) — rastro operacional MULTI-KANBAN (preservado).
  const { data: opTrail } = useCaseOperationalTrail(id);
  // F1 (AC-4) — rastro financeiro RESUMIDO por caso (só carrega p/ financeiro:view).
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  // AJ2 (Thiago, 27/08): tirar o caso de um kanban ADICIONAL. O principal nunca
  // sai — o board-service ja recusa com 409, e a UI nem oferece o botao.
  const removeFromBoard = useRemoveCaseFromBoard();
  const [boardParaRemover, setBoardParaRemover] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [entrarOpen, setEntrarOpen] = useState(false);
  const [linkTemaOpen, setLinkTemaOpen] = useState(false);
  const [addBoardOpen, setAddBoardOpen] = useState(false);
  const [genFlowOpen, setGenFlowOpen] = useState(false);
  const [fillFiltersOpen, setFillFiltersOpen] = useState(false);
  const [nameEditOpen, setNameEditOpen] = useState(false);

  // M13 (T3) — urgência do caso (prioritário/urgente) p/ o motor de distribuição.
  const setUrgency = useSetCaseUrgency(id);
  // #10 — cadeado dos campos do caso (só-leitura).
  const setFieldsLocked = useSetCaseFieldsLocked(id);

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

  // #6 (2026-08-17) — texto legado de observações (campo único antigo), exibido
  // como registro histórico read-only dentro do painel CaseObservacoes.
  const casoObservacoes = (caso as { observacoes?: string | null }).observacoes ?? "";

  const dias = daysSince(caso.status_changed_at);
  const tipoLabel =
    (caso as { caso_pasta_nome?: string | null }).caso_pasta_nome ??
    CASE_TYPE_LABELS[caso.case_type as CaseType] ??
    caso.case_type;
  const opLabel = MACRO_OP_LABELS[caso.macrostatus_op as MacroOp] ?? caso.macrostatus_op;
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
          {/* T2 (2026-08-26) — VÍNCULO do caso com quem responde por ele. Thiago:
              "colocar um registro lá, uma opção de que esse caso tem um vínculo
              com X usuário, e aí o sistema na hora de rodar o motor vai puxar".
              Aqui é leitura; a edição continua no "Editar caso". Quando há UM
              responsável, o motor usa esse nome ao distribuir (T2). */}
          <div className="mt-2 flex items-center gap-2 text-[12.5px] flex-wrap">
            <span className="text-muted-foreground">Responsável:</span>
            {(responsaveis ?? []).length === 0 ? (
              <span className="text-muted-foreground italic">
                sem vínculo — o motor distribui por pontos
              </span>
            ) : (
              <>
                <span className="font-medium text-[var(--navy)]">
                  {(responsaveis ?? [])
                    .map((r) => (r as { full_name?: string | null }).full_name ?? "·")
                    .join(", ")}
                </span>
                <span
                  className="text-muted-foreground"
                  title={
                    (responsaveis ?? []).length === 1
                      ? "Com um único responsável, o motor de distribuição atribui as tarefas deste caso a ele (quando não há regra exclusiva de tipo/tema)."
                      : "Com mais de um responsável, o motor não escolhe: distribui por pontos."
                  }
                >
                  {(responsaveis ?? []).length === 1
                    ? "· o motor distribui para ele"
                    : "· o motor distribui por pontos"}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 self-start flex-wrap justify-end">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold self-center ${lcMeta.cls}`}
            title="Ciclo de vida do caso"
          >
            {lcMeta.label}
          </span>
          {/* QA S4-02 (03/09) — "Fora do operacional" é informação OPERACIONAL e
              vinha no card do rastro financeiro, que saiu da ficha. Sem este selo,
              quem não tem acesso ao financeiro não teria como saber que o caso foi
              removido do operacional. */}
          {removidoDoOp && (
            <span
              className="inline-flex items-center rounded-full bg-[var(--muted)] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground self-center"
              title="Caso removido da pipeline operacional (vive só no financeiro)"
            >
              Fora do operacional
            </span>
          )}
          {/* #3 (2026-08-17) — EDITAR CASO: mudar tema/tipo (pipeline), preencher
              campos e urgência (agrupa o antigo <select> + "Vincular" + "Preencher"). */}
          {podeGerirCaso && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Pencil size={14} className="mr-1.5" /> Editar caso
                  <ChevronDown size={13} className="ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={() => setLinkTemaOpen(true)}>
                  <Layers size={14} className="mr-2" /> Mudar tema / tipo (pipeline)
                </DropdownMenuItem>
                {(caso as { tema_id?: string | null }).tema_id && (
                  <DropdownMenuItem onClick={() => setFillFiltersOpen(true)}>
                    <SlidersHorizontal size={14} className="mr-2" /> Preencher campos
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Urgência (motor de distribuição)</DropdownMenuLabel>
                {(
                  [
                    { v: "normal", label: "Normal" },
                    { v: "prioritario", label: "Prioritário" },
                    { v: "urgente", label: "Urgente" },
                  ] as const
                ).map((o) => {
                  const atual =
                    ((caso as { distribution_urgency?: string | null }).distribution_urgency ??
                      "normal") === o.v;
                  return (
                    <DropdownMenuItem
                      key={o.v}
                      disabled={setUrgency.isPending}
                      onClick={() =>
                        setUrgency.mutate(o.v, {
                          onSuccess: () =>
                            toast.success(
                              o.v === "normal" ? "Urgência removida" : `Marcado como ${o.label}`,
                            ),
                          onError: (err) =>
                            toast.error(
                              err instanceof Error ? err.message : "Falha ao salvar urgência",
                            ),
                        })
                      }
                    >
                      <Check size={14} className={`mr-2 ${atual ? "opacity-100" : "opacity-0"}`} />
                      {o.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* #4 (2026-08-17) — NOVO ESTÁGIO: mover no fluxo principal + adicionar a
              outro kanban do mesmo tema. */}
          {podeGerirCaso && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowRightLeft size={14} className="mr-1.5" /> Novo estágio
                  <ChevronDown size={13} className="ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={() => setMoveOpen(true)}>
                  <ArrowRightLeft size={14} className="mr-2" /> Mover etapa (fluxo principal)
                </DropdownMenuItem>
                {caso.service_type_id && (
                  <DropdownMenuItem onClick={() => setAddBoardOpen(true)}>
                    <ListPlus size={14} className="mr-2" /> Adicionar a outro kanban
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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

      {/* Ordem da ficha (2026-08-17): Rastro Operacional → Checklist → Judicial →
          Dados do caso → Andamentos (CaseFeed) → Observações gerais → Tarefas/
          Prazos (CaseDossie) → Sigilo (fim, #14). */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-hero p-7">
          <Eyebrow>Rastro Operacional</Eyebrow>
          {/* C3 (2026-08-05) — MULTI-KANBAN com cards clicáveis por board.
              #3 (reunião 2026-08-17) — o checklist de cada etapa fica ANINHADO
              logo abaixo do próprio card (sem bloco "Checklist da etapa" separado
              nem a explicação "Ao concluir…"; maximiza o espaço e some com a
              duplicação de kanban/etapa). */}
          {opTrail && opTrail.length > 0 ? (
            <div className="mt-4 space-y-3">
              {opTrail.map((t, idx) => (
                <div
                  key={t.board_id ?? "__principal__"}
                  className="rounded-lg border border-[rgba(30,32,68,0.10)] overflow-hidden"
                >
                  <div className="relative">
                    {/* AJ2 — sair do kanban ADICIONAL. Fica FORA do <Link> (por
                        cima dele): dentro, o clique navegaria para o pipeline. */}
                    {!t.is_principal && t.board_id && podeGerirCaso && (
                      <button
                        type="button"
                        title={`Tirar o caso de "${t.board_label}"`}
                        aria-label={`Tirar o caso do kanban ${t.board_label}`}
                        onClick={() =>
                          setBoardParaRemover({ id: t.board_id as string, label: t.board_label })
                        }
                        className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-[rgba(30,32,68,0.06)] transition"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <Link
                      to="/pipeline"
                      search={{
                        cat: caso.service_type_id ?? undefined,
                        catName: tipoLabel,
                        ...(t.board_id ? { board: t.board_id } : {}),
                      }}
                      // pr-10 quando há o botão de sair: sem isso, um rótulo de
                      // kanban longo passa por baixo do "×".
                      className={`block py-3 pl-4 hover:bg-[rgba(180,155,80,0.03)] transition-colors cursor-pointer ${
                        !t.is_principal && t.board_id && podeGerirCaso ? "pr-10" : "pr-4"
                      }`}
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
                          {t.is_principal
                            ? "Kanban Principal"
                            : `Kanban ${idx + 1} · ${t.board_label}`}
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
                  </div>
                  {/* #3 — checklist DESTA etapa, embaixo do card correspondente. */}
                  {t.stage_slug && (
                    <div className="px-4 pb-3 pt-3 border-t border-[rgba(30,32,68,0.06)] bg-[rgba(30,32,68,0.015)]">
                      <CaseStageChecklist
                        caseId={caso.id}
                        stageSlug={t.stage_slug}
                        canEdit={podeGerirCaso}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <span className="text-[17px] font-semibold text-[var(--navy)]">{opLabel}</span>
                <span className="text-[12px] text-muted-foreground">
                  há {dias} dia(s) neste estado
                </span>
              </div>
              {caso.macrostatus_op && caso.macrostatus_op !== "NAO_APLICAVEL" && (
                <CaseStageChecklist
                  caseId={caso.id}
                  stageSlug={caso.macrostatus_op}
                  canEdit={podeGerirCaso}
                  className="mt-3 pt-3 border-t border-[rgba(30,32,68,0.08)]"
                />
              )}
            </div>
          )}
        </div>

        {/* S4-02 (reunião 02/09) — o RASTRO FINANCEIRO saiu daqui e foi para a aba
            Financeiro do caso. Thiago: "Esse painel rastro financeiro vai para a
            aba 'financeiro'" e, apontando o espaço que sobrou, "Vamos levar esse
            painel para o espaço que vagou". Quem sobe é Casos vinculados; as
            Observações ficam logo abaixo, em largura inteira (é o painel que mais
            cresce). A ficha vira operacional; dinheiro é na aba Financeiro. */}
        <div className="card-hero p-7">
          <CaseLinkedCases caseId={caso.id} canEdit={podeGerirCaso} />
        </div>
      </div>

      {/* Observações gerais (estilo Trello) — largura inteira desde a S4-02, já que
          Casos vinculados subiu para a dobra de cima. */}
      <OrnamentalDivider />

      <div className="card-hero p-7">
        <CaseObservacoes caseId={caso.id} legacyText={casoObservacoes} canEdit={podeGerirCaso} />
      </div>

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
            locked={(caso as { fields_locked?: boolean }).fields_locked ?? false}
            togglingLock={setFieldsLocked.isPending}
            onToggleLock={() => {
              const next = !((caso as { fields_locked?: boolean }).fields_locked ?? false);
              setFieldsLocked.mutate(next, {
                onSuccess: () => toast.success(next ? "Campos bloqueados" : "Campos desbloqueados"),
                onError: (e) =>
                  toast.error(e instanceof Error ? e.message : "Falha ao alterar o cadeado"),
              });
            }}
          />
        </>
      )}

      {/* #15 (2026-08-17) — layout ⅔ / ⅓: "Andamentos do caso" (Feed) à esquerda
          ocupando 2 colunas, "Tarefas" (CaseDossie) à direita em 1 coluna. Cada
          um com rolagem própria. Observações vivem no painel de cima. */}
      <OrnamentalDivider />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 min-w-0">
          <CaseFeed caseId={caso.id} />
        </div>
        <div className="min-w-0">
          <CaseDossie caseId={caso.id} canEdit={podeGerirCaso} />
        </div>
      </div>

      {/* M3 (2026-08-07) — O CaseDocumentsTab saiu daqui: virou a aba de topo
          "Documentos" (casos.$id.documentos.tsx). O docAutoFill PERMANECE nesta
          ficha porque ainda alimenta o GenerateCaseDocumentFlow (contrato/procuração). */}

      {/* G4 — gestão de sigilo: só ADMINISTRADORES (pedido reunião 2026-08-10).
          #14 (2026-08-17): movido para o FINAL da ficha (era no meio). */}
      {isAdmin && (
        <>
          <OrnamentalDivider />
          <CaseSigiloSection caseId={caso.id} />

          {/* AU1 (2026-08-26) — auditoria DESTE caso. O owner pediu a busca também
              dentro do caso, não só no menu global. Mesma tabela, `caseId` fixo.
              Some para quem não administra o sistema (o RPC também nega). */}
          {podeVerAuditoria && (
            <>
              <OrnamentalDivider />
              {/* 31.08 (Thiago) — "o painel de auditoria do caso, ser uma opção
                  sim/não. Assim ele aparece fechado, e caso tenhamos interesse
                  vamos abrir para ver o detalhamento." Nasce FECHADO; a tabela só
                  monta (e só consulta) quando alguém abre. */}
              <CaseAuditSection caseId={caso.id} />
            </>
          )}
        </>
      )}

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

      {/* AJ2 — confirmacao de saida do kanban adicional. */}
      <AlertDialog
        open={boardParaRemover !== null}
        onOpenChange={(o) => !o && setBoardParaRemover(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Tirar o caso de &ldquo;{boardParaRemover?.label}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O caso sai deste kanban e continua normalmente no kanban principal. Nada do caso é
              excluído, e dá para colocá-lo de volta depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!boardParaRemover) return;
                try {
                  await removeFromBoard.mutateAsync({
                    caseId: caso.id,
                    boardId: boardParaRemover.id,
                  });
                  toast.success(`Caso removido de "${boardParaRemover.label}"`);
                  setBoardParaRemover(null);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falha ao remover do kanban");
                }
              }}
            >
              Tirar do kanban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

// 31.08 — auditoria do caso em painel recolhível (nasce fechado).
function CaseAuditSection({ caseId }: { caseId: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 text-left group"
        aria-expanded={aberto}
      >
        <ChevronDown
          size={15}
          className={`text-[var(--ink-400)] transition-transform ${aberto ? "" : "-rotate-90"}`}
        />
        <Eyebrow>Auditoria deste caso</Eyebrow>
        {!aberto && (
          <span className="text-[11.5px] text-muted-foreground">— clique para abrir</span>
        )}
      </button>
      {aberto && (
        <div className="mt-3">
          <p className="text-[12px] text-muted-foreground mb-3">
            Quem mexeu no quê — inclui as alterações de campo, que saíram da linha do tempo.
          </p>
          <AuditTable caseId={caseId} compact />
        </div>
      )}
    </section>
  );
}
