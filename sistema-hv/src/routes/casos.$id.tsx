import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  DollarSign,
  ExternalLink,
  FileSignature,
  FolderOpen,
  Phone,
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
import { CaseDocumentsTab } from "@/components/cases/CaseDocumentsTab";
import { CaseDossie } from "@/components/cases/CaseDossie";
import { CaseTimeline } from "@/components/cases/CaseTimeline";
import { FiesFields } from "@/components/cases/FiesFields";
import { isCasoFies } from "@/lib/cases/fies-fields";
import { GenerateCaseDocumentFlow } from "@/components/cases/GenerateCaseDocumentFlow";
import { AsaasCobrancasPanel } from "@/components/cases/AsaasCobrancasPanel";
import { TermoPanel } from "@/components/cases/TermoPanel";
import { NotesBlock } from "@/components/notes/NotesBlock";
import { MoveCaseDialog } from "@/components/cases/MoveCaseDialog";
import { MoveCaseFinDialog } from "@/components/cases/MoveCaseFinDialog";
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
import { Breadcrumb, Eyebrow, OrnamentalDivider } from "@/components/hv/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMyModulePerms } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/auth";
import { can, permissaoEfetiva } from "@/lib/rbac";
import { resolveEntityLabel, useDocumentTitle } from "@/lib/use-document-title";
import { usePublishRouteTitle } from "@/lib/route-title";
import { useClient } from "@/hooks/useClients";
import { useMunicipios, usePerfis } from "@/hooks/useReferencias";
import {
  augmentWithMunicipio,
  augmentWithPerfil,
  buildAutoFillFromClient,
} from "@/lib/cases/document-autofill";
import { useCase, useCaseEvents, useDeleteCase, usePromoverCasoManual } from "@/hooks/useCases";
import { useEntrarFinanceiro, useVoltarOperacional } from "@/hooks/usePipeline";
import {
  CASE_TYPE_LABELS,
  MACRO_FIN_LABELS,
  MACRO_OP_LABELS,
  type CaseType,
  type MacroFin,
  type MacroOp,
} from "@/lib/cases/constants";

export const Route = createFileRoute("/casos/$id")({
  component: CasoDetalhe,
});

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function maskPhone(phone: string | null): string {
  if (!phone) return "—";
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
  const podeFinanceiro = can(role, "financeiro.manage");
  const podeGerirCaso = can(role, "casos.manage");
  // R4-02 — gate de $ no bloco financeiro da ficha do caso (TermoPanel +
  // AsaasCobrancasPanel). Usa a infra efetiva de R3-01 (permissaoEfetiva):
  // combina o PAPEL com overrides por usuário×módulo. Com a tabela de overrides
  // vazia isto é IDÊNTICO ao papel (regressão zero). Sem `financeiro:view` o
  // bloco não é montado, então os hooks de $ (termo/parcelas) nem disparam.
  const { data: perms } = useMyModulePerms();
  const podeVerFinanceiro = permissaoEfetiva(role, perms ?? {}, "financeiro", "view");
  // Autofill B/C — tabelas de referência (município / perfil).
  const { data: municipios } = useMunicipios();
  const { data: perfis } = usePerfis();

  // S4-06 — título da aba por NOME (case_code), nunca UUID.
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
  // ITEM 2 — popup "Enviar contrato e procuração" (mesmo do "Gerar documento").
  const [genFlowOpen, setGenFlowOpen] = useState(false);

  // S1-03 — promover manualmente lead→cliente (independe da flag comercial).
  async function handlePromover() {
    try {
      await promover.mutateAsync(id);
      toast.success("Caso promovido para CLIENTE");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao promover caso");
    }
  }

  // Carrega cliente vinculado pra header
  const { data: cliente } = useClient(caso?.client_id ?? "");

  // fix breadcrumb Topbar (2026-07-03) — publica o NOME DO CLIENTE (não o UUID)
  // para o breadcrumb automático do Topbar. Enquanto o caso/cliente carregam,
  // mostra "Carregando…"; em 404, rótulo genérico.
  usePublishRouteTitle(
    resolveEntityLabel(cliente?.full_name, {
      loading: isLoading || (!!caso?.client_id && cliente === undefined),
      notFound: isError,
      notFoundLabel: "Caso não encontrado",
    }),
  );

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

  const dias = daysSince(caso.status_changed_at);
  const diasFin = daysSince(caso.status_fin_changed_at);
  const tipoLabel = CASE_TYPE_LABELS[caso.case_type as CaseType] ?? caso.case_type;
  const opLabel = MACRO_OP_LABELS[caso.macrostatus_op as MacroOp] ?? caso.macrostatus_op;
  const finLabel = MACRO_FIN_LABELS[caso.macrostatus_fin as MacroFin] ?? caso.macrostatus_fin;
  const finBifurcated = caso.macrostatus_fin !== "NAO_APLICAVEL";
  // S1-01/S1-03: lifecycle do caso (LEAD | CLIENTE | PERDIDO). A coluna entra no
  // types.ts só após db:types; lemos defensivamente.
  const lifecycle =
    (caso as { lifecycle?: "LEAD" | "CLIENTE" | "PERDIDO" | null }).lifecycle ?? "LEAD";
  const lifecycleMeta: Record<string, { label: string; cls: string }> = {
    LEAD: { label: "Lead", cls: "bg-[var(--muted)] text-muted-foreground" },
    CLIENTE: { label: "Cliente", cls: "bg-green-600 text-white" },
    PERDIDO: { label: "Perdido", cls: "bg-red-600 text-white" },
  };
  const lcMeta = lifecycleMeta[lifecycle] ?? lifecycleMeta.LEAD;
  // `removido_do_operacional_at` entra no types.ts só após db:push + db:types (S19).
  const removidoDoOp = !!(caso as { removido_do_operacional_at?: string | null })
    .removido_do_operacional_at;

  // Autofill do documento: cadastro + endereço + campos do caso (canonical) e,
  // por cima, dados do MUNICÍPIO (tabela) e do PERFIL (tabela). Tudo editável.
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

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: caso.case_code }]} />

      {/* S2-05 — alerta de checklist inconsistente (item required desmarcado após avanço) */}
      <ChecklistInconsistencyAlert events={events} />

      <header className="flex items-start justify-between gap-8 mb-8">
        <div>
          <Eyebrow>Caso · {caso.case_code}</Eyebrow>
          <h1 className="font-display text-[40px] font-bold text-[var(--navy)] leading-tight mt-2">
            {cliente?.full_name ?? "—"}{" "}
            <span className="text-[var(--gold-700)]">— {tipoLabel}</span>
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
          {/* S1-03 — qualquer usuário autenticado promove/marca perdido (sem gate por cargo) */}
          {lifecycle !== "CLIENTE" && lifecycle !== "PERDIDO" && (
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
          {/* ITEM 4 (2026-07-07) — "Enviar para o financeiro" também no TOPO (abre
              o mesmo popup: duplicar p/ financeiro ou somente-financeiro). Só
              enquanto o caso ainda não está no financeiro. */}
          {podeFinanceiro && !finBifurcated && (
            <Button variant="outline" size="sm" onClick={() => setEntrarOpen(true)}>
              <DollarSign size={14} className="mr-1.5" /> Enviar para o financeiro
            </Button>
          )}
          {/* ITEM 2 (2026-07-06) — "Marcar como perdido" REMOVIDO do topo (decisão do
              owner). O ciclo de vida do caso é governado pelo board Comercial +
              assinatura. */}
          {/* ITEM 2 — "Enviar contrato e procuração" abre o MESMO popup do "Gerar
              documento" (Procuração vs Documento do caso). Gera e abre o Word; o
              envio ao ZapSign continua na aba Documentos. */}
          <Button variant="outline" size="sm" onClick={() => setGenFlowOpen(true)}>
            <FileSignature size={14} className="mr-1.5" /> Enviar contrato e procuração
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)}>
            <ArrowRightLeft size={14} className="mr-1.5" /> Mover status
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={14} className="mr-1.5" /> Excluir
          </Button>
        </div>
      </header>

      {caso.drive_folder_url && (
        <div className="card-hero p-5 mb-6 flex items-center justify-between">
          <div>
            <Eyebrow>Pasta no Drive</Eyebrow>
            <p className="text-[13px] text-muted-foreground mt-1">
              Arquivos do cliente ficam aqui — você pode subir/baixar pelo Drive direto.
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

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-hero p-7">
          <Eyebrow>Rastro Operacional</Eyebrow>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-[17px] font-semibold text-[var(--navy)]">{opLabel}</span>
            <span className="text-[12px] text-muted-foreground">há {dias} dia(s) neste estado</span>
          </div>
        </div>

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

            {/* R4-02 — gate de $ (AC-1/AC-2/AC-4): sem `financeiro:view` o bloco
                do termo (honorários/parcelas) e o de cobranças NÃO são montados,
                então os hooks de $ (termo/useParcelas) nem disparam. O botão
                "Enviar para o financeiro" e o bloco `removido_do_operacional`
                acima são de FLUXO (não de $) e continuam gate-ados por
                `podeFinanceiro`. */}
            {finBifurcated && podeVerFinanceiro && (
              <div className="pt-4 border-t border-[rgba(30,32,68,0.08)] space-y-6">
                <TermoPanel caseId={caso.id} />
                <div className="pt-4 border-t border-[rgba(30,32,68,0.08)]">
                  <AsaasCobrancasPanel caseId={caso.id} clientId={caso.client_id} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <OrnamentalDivider />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* (2026-07-09) — checklist é SÓ do financeiro. Passa apenas a etapa fin
            (quando o caso já bifurcou); no operacional não há checklist. */}
        <CaseChecklistPanel
          caseId={caso.id}
          canEdit={podeGerirCaso}
          currentStageSlugs={finBifurcated && caso.macrostatus_fin ? [caso.macrostatus_fin] : []}
        />
        <CaseCanonicalFields
          caseId={caso.id}
          canonicalFields={
            (caso as { canonical_fields?: Record<string, unknown> | null }).canonical_fields
          }
          canEdit={podeGerirCaso}
          temaId={(caso as { tema_id?: string | null }).tema_id ?? null}
          frenteSlug={caso.frente_slug}
        />
      </div>

      {/* R5-06 (A2) — campos ESTRUTURADOS do contrato FIES (só p/ casos FIES).
          Grava nos mesmos canonical_fields; não duplica armazenamento. */}
      {isCasoFies(caso.case_type) && (
        <FiesFields
          caseId={caso.id}
          canonicalFields={
            (caso as { canonical_fields?: Record<string, unknown> | null }).canonical_fields
          }
          canEdit={podeGerirCaso}
        />
      )}

      <OrnamentalDivider />

      <CaseDossie caseId={caso.id} />

      <OrnamentalDivider />

      <CaseDocumentsTab
        caseId={caso.id}
        caseType={caso.case_type}
        frenteSlug={caso.frente_slug}
        clientName={cliente?.full_name}
        clientCpf={cliente?.cpf_cnpj}
        municipio={caso.municipio ?? undefined}
        autoFillExtra={docAutoFill}
      />

      <OrnamentalDivider />

      {/* S4-03 — bloco de notas do caso (auth-only, soft-delete). */}
      <NotesBlock target="case" entityId={caso.id} />

      <OrnamentalDivider />

      {/* S4-04 — timeline read-only (eventos automáticos) + entrada manual. */}
      <CaseTimeline caseId={caso.id} />

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

      {/* ITEM 2 — fluxo "Enviar contrato e procuração" (mesmo popup do "Gerar
          documento"): Procuração vs Documento do caso → modelo → preenche → Word. */}
      <GenerateCaseDocumentFlow
        open={genFlowOpen}
        onOpenChange={setGenFlowOpen}
        caseId={caso.id}
        caseType={caso.case_type}
        frenteSlug={caso.frente_slug}
        autoFill={docAutoFill}
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
