import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  ExternalLink,
  FileSignature,
  FolderOpen,
  Phone,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CaseDocumentsTab } from "@/components/cases/CaseDocumentsTab";
import { CaseDossie } from "@/components/cases/CaseDossie";
import { TermoPanel } from "@/components/cases/TermoPanel";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { useClient } from "@/hooks/useClients";
import { useCase, useCaseEvents, useDeleteCase, useLiberarCaso } from "@/hooks/useCases";
import {
  useEntrarFinanceiro,
  useSetAcertoParcial,
  useVoltarOperacional,
} from "@/hooks/usePipeline";
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

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Extrai string de um campo JSONB (address / professional_data). */
function pickStr(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "string" && val ? val : undefined;
}

function CasoDetalhe() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const { data: caso, isLoading, isError, error } = useCase(id);
  const { data: events } = useCaseEvents(id);
  const remove = useDeleteCase();
  const entrar = useEntrarFinanceiro();
  const voltar = useVoltarOperacional();
  const acerto = useSetAcertoParcial();
  const liberar = useLiberarCaso();
  const { role } = useAuth();
  const podeFinanceiro = can(role, "financeiro.manage");
  const podeGerirCaso = can(role, "casos.manage");

  async function handleLiberar() {
    if (
      !confirm(
        "Confirmar que a procuração foi assinada pelo cliente? O caso sai da fase comercial e entra no funil operacional.",
      )
    ) {
      return;
    }
    try {
      await liberar.mutateAsync(id);
      toast.success("Caso liberado para o operacional");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao liberar caso");
    }
  }

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFinOpen, setMoveFinOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [entrarOpen, setEntrarOpen] = useState(false);

  // Carrega cliente vinculado pra header
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

  const dias = daysSince(caso.status_changed_at);
  const diasFin = daysSince(caso.status_fin_changed_at);
  const tipoLabel = CASE_TYPE_LABELS[caso.case_type as CaseType] ?? caso.case_type;
  const opLabel = MACRO_OP_LABELS[caso.macrostatus_op as MacroOp] ?? caso.macrostatus_op;
  const finLabel = MACRO_FIN_LABELS[caso.macrostatus_fin as MacroFin] ?? caso.macrostatus_fin;
  const finBifurcated = caso.macrostatus_fin !== "NAO_APLICAVEL";
  // `removido_do_operacional_at` entra no types.ts só após db:push + db:types (S19).
  const removidoDoOp = !!(caso as { removido_do_operacional_at?: string | null })
    .removido_do_operacional_at;

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: caso.case_code }]} />

      {/* Melhoria 3: caso em fase comercial — aguardando assinatura da procuração */}
      {caso.aguardando_assinatura_at && (
        <div
          className="rounded-xl px-4 py-3 mb-4 flex items-start gap-3"
          style={{ background: "rgba(162, 90, 8, 0.05)", border: "1px solid rgba(162,90,8,0.25)" }}
        >
          <FileSignature size={18} className="text-[var(--warning)] mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[var(--warning)]">
              Aguardando assinatura da procuração
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Este caso está na aba Comercial e ainda não entrou no funil operacional. Envie a
              procuração ao ZapSign pela aba <strong>Documentos</strong>. Quando o cliente assinar
              (ou ao confirmar manualmente o upload do documento assinado), o caso é liberado.
            </p>
          </div>
          {podeGerirCaso && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleLiberar}
              disabled={liberar.isPending}
            >
              {liberar.isPending ? "Liberando…" : "Confirmar assinatura"}
            </Button>
          )}
        </div>
      )}

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
        <div className="flex gap-2 self-start">
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

            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Acerto
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[13px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={caso.acerto_parcial}
                    onCheckedChange={(v) =>
                      acerto.mutate({
                        caseId: caso.id,
                        acerto_parcial: !!v,
                        tem_pendencia_judicial: caso.tem_pendencia_judicial,
                        obs: caso.acerto_parcial_obs,
                      })
                    }
                  />
                  Acerto parcial
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={caso.tem_pendencia_judicial}
                    onCheckedChange={(v) =>
                      acerto.mutate({
                        caseId: caso.id,
                        acerto_parcial: caso.acerto_parcial,
                        tem_pendencia_judicial: !!v,
                        obs: caso.acerto_parcial_obs,
                      })
                    }
                  />
                  Pendência judicial
                </label>
              </div>
              {(caso.acerto_parcial || caso.tem_pendencia_judicial) && (
                <div className="mt-2 flex gap-2">
                  {caso.acerto_parcial && (
                    <Badge className="bg-[var(--gold-700)] text-white">Acerto parcial</Badge>
                  )}
                  {caso.tem_pendencia_judicial && (
                    <Badge className="bg-amber-100 text-amber-800">Judicial</Badge>
                  )}
                </div>
              )}
            </div>

            {finBifurcated && (
              <div className="pt-4 border-t border-[rgba(30,32,68,0.08)]">
                <TermoPanel caseId={caso.id} />
              </div>
            )}
          </div>
        </div>
      </div>

      <OrnamentalDivider />

      <CaseDossie caseId={caso.id} />

      <OrnamentalDivider />

      <CaseDocumentsTab
        caseId={caso.id}
        caseType={caso.case_type}
        clientName={cliente?.full_name}
        clientCpf={cliente?.cpf_cnpj}
        municipio={caso.municipio ?? undefined}
        autoFillExtra={{
          email: cliente?.email ?? undefined,
          phone: cliente?.phone ?? undefined,
          city: pickStr(cliente?.address, "city"),
          state: pickStr(cliente?.address, "state"),
          crm_numero: pickStr(cliente?.professional_data, "crm_numero"),
          crm_uf: pickStr(cliente?.professional_data, "crm_uf"),
          oab_numero: pickStr(cliente?.professional_data, "oab_numero"),
          oab_uf: pickStr(cliente?.professional_data, "oab_uf"),
          especialidade: pickStr(cliente?.professional_data, "especialidade"),
          vinculo_institucional: pickStr(cliente?.professional_data, "vinculo_institucional"),
          caseCode: caso.case_code,
          responsavel: caso.responsavel ?? undefined,
        }}
      />

      <OrnamentalDivider />

      <h2 className="font-display text-[24px] font-semibold text-[var(--navy)] mb-3">
        Linha do tempo
      </h2>
      <div className="card-editorial !p-0 overflow-hidden">
        {(events ?? []).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground italic text-sm">
            Sem eventos registrados.
          </div>
        ) : (
          <ul>
            {(events ?? []).map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-3 px-5 py-3 border-b border-[var(--border)] last:border-0"
              >
                <div className="w-2 h-2 rounded-full bg-[var(--gold)] mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--navy)] font-medium">
                    {e.action === "created" && "Caso criado"}
                    {e.action === "created_comercial" &&
                      "Caso criado (comercial — aguardando assinatura da procuração)"}
                    {e.action === "status_changed" &&
                      `Status mudou: ${e.from_macrostatus_op ?? "—"} → ${e.to_macrostatus_op ?? "—"}`}
                    {e.action === "fin_status_changed" &&
                      `Status financeiro mudou: ${(e.diff as Record<string, string> | null)?.from ?? "—"} → ${(e.diff as Record<string, string> | null)?.to ?? "—"}`}
                    {e.action === "updated" && "Caso editado"}
                    {e.action === "soft_deleted" && "Caso excluído"}
                    {/* Tarefas */}
                    {e.action === "task_created" &&
                      `Tarefa criada: ${(e.diff as Record<string, string> | null)?.task_title ?? "—"}`}
                    {e.action === "task_started" &&
                      `Tarefa iniciada: ${(e.diff as Record<string, string> | null)?.task_title ?? "—"}`}
                    {e.action === "task_completed" &&
                      `Tarefa concluída: ${(e.diff as Record<string, string> | null)?.task_title ?? "—"}`}
                    {e.action === "task_status_changed" &&
                      `Tarefa "${(e.diff as Record<string, string> | null)?.task_title ?? "—"}" → ${(e.diff as Record<string, string> | null)?.status ?? "—"}`}
                    {e.action === "task_deleted" &&
                      `Tarefa excluída: ${(e.diff as Record<string, string> | null)?.task_title ?? "—"}`}
                    {/* Documentos */}
                    {e.action === "doc_generated" &&
                      `Documento gerado: ${(e.diff as Record<string, string> | null)?.doc_title ?? "—"}`}
                    {e.action === "doc_finalized" &&
                      `Documento finalizado: ${(e.diff as Record<string, string> | null)?.doc_title ?? "—"}`}
                    {e.action === "doc_reopened" &&
                      `Documento reaberto: ${(e.diff as Record<string, string> | null)?.doc_title ?? "—"}`}
                    {e.action === "doc_sent_zapsign" &&
                      `Documento enviado para assinatura: ${(e.diff as Record<string, string> | null)?.doc_title ?? "—"}`}
                    {e.action === "doc_deleted" &&
                      `Documento excluído: ${(e.diff as Record<string, string> | null)?.doc_title ?? "—"}`}
                    {/* Procuração / fase comercial */}
                    {e.action === "procuracao_preparada" && "Procuração preparada"}
                    {e.action === "liberado_comercial" &&
                      `Procuração assinada — caso liberado para operação${
                        (e.diff as Record<string, string> | null)?.via
                          ? ` (${(e.diff as Record<string, string> | null)?.via})`
                          : ""
                      }`}
                    {/* Prazos */}
                    {e.action === "deadline_created" &&
                      `Prazo criado: ${(e.diff as Record<string, string> | null)?.deadline_title ?? "—"} (${(e.diff as Record<string, string> | null)?.fatal_date ?? "—"})`}
                    {e.action === "deadline_completed" &&
                      `Prazo cumprido: ${(e.diff as Record<string, string> | null)?.deadline_title ?? "—"}`}
                    {e.action === "deadline_missed" &&
                      `Prazo perdido: ${(e.diff as Record<string, string> | null)?.deadline_title ?? "—"}`}
                    {e.action === "deadline_status_changed" &&
                      `Prazo "${(e.diff as Record<string, string> | null)?.deadline_title ?? "—"}" → ${(e.diff as Record<string, string> | null)?.status ?? "—"}`}
                    {e.action === "deadline_deleted" &&
                      `Prazo excluído: ${(e.diff as Record<string, string> | null)?.deadline_title ?? "—"}`}
                    {/* Comunicações */}
                    {e.action === "communication_logged" &&
                      `Comunicação registrada (${(e.diff as Record<string, string> | null)?.channel ?? "—"}): ${(e.diff as Record<string, string> | null)?.summary ?? "—"}`}
                    {e.action === "communication_deleted" &&
                      `Comunicação excluída: ${(e.diff as Record<string, string> | null)?.summary ?? "—"}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtDateTime(e.created_at)}
                    {e.triggered_by_name && (
                      <span className="ml-2">
                        por <strong>{e.triggered_by_name}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MoveCaseDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        caseId={caso.id}
        caseCode={caso.case_code}
        currentStatus={caso.macrostatus_op as MacroOp}
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
