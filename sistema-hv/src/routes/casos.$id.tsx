import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRightLeft, CheckCircle2, Pencil, Phone, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, Eyebrow, OrnamentalDivider } from "@/components/hv/primitives";
import { useClient } from "@/hooks/useClients";
import { useCase, useCaseEvents, useDeleteCase, useUpdateCase } from "@/hooks/useCases";
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

function CasoDetalhe() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const { data: caso, isLoading, isError, error } = useCase(id);
  const { data: events } = useCaseEvents(id);
  const update = useUpdateCase();
  const remove = useDeleteCase();

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFinOpen, setMoveFinOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editPasso, setEditPasso] = useState(false);
  const [passoDraft, setPassoDraft] = useState("");

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

  async function savePasso() {
    try {
      await update.mutateAsync({ id, input: { proximo_passo: passoDraft || null } });
      setEditPasso(false);
      toast.success("Próximo passo atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  return (
    <div className="page-container !pb-32">
      <Breadcrumb items={[{ label: "Casos", to: "/casos" }, { label: caso.case_code }]} />

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

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-hero p-7">
          <Eyebrow>Rastro Operacional</Eyebrow>
          <div className="mt-4 flex items-center gap-3">
            <span className="font-display text-[20px] font-semibold text-[var(--navy)]">
              {opLabel}
            </span>
            <span className="text-[12px] text-muted-foreground">há {dias} dia(s) neste estado</span>
          </div>
          <div className="mt-5 pt-5 border-t border-[rgba(30,32,68,0.08)]">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
              <span>Próximo passo</span>
              {!editPasso && (
                <button
                  type="button"
                  onClick={() => {
                    setPassoDraft(caso.proximo_passo ?? "");
                    setEditPasso(true);
                  }}
                  className="text-[var(--gold-700)] hover:underline inline-flex items-center gap-1 normal-case tracking-normal"
                >
                  <Pencil size={11} /> editar
                </button>
              )}
            </div>
            {editPasso ? (
              <div className="space-y-2">
                <textarea
                  value={passoDraft}
                  onChange={(e) => setPassoDraft(e.target.value)}
                  className="w-full p-2 border border-[var(--border)] rounded-md text-[14px] font-display"
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditPasso(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={savePasso} disabled={update.isPending}>
                    {update.isPending ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="font-display text-[18px] text-[var(--navy)]">
                {caso.proximo_passo ?? <span className="text-muted-foreground italic">—</span>}
              </div>
            )}
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
            <span className="font-display text-[20px] font-semibold text-[var(--navy)]">
              {finBifurcated ? finLabel : "Não bifurcado"}
            </span>
            {finBifurcated && (
              <span className="text-[12px] text-muted-foreground">
                há {diasFin} dia(s) neste estado
              </span>
            )}
          </div>
          <div className="mt-5 pt-5 border-t border-[rgba(30,32,68,0.08)] text-[13px] text-muted-foreground italic">
            {finBifurcated
              ? "Pipeline financeira ativa. Parcelas e cobrança virão na Sprint F4-S09 (Conta Azul / Asaas)."
              : "Será ativado automaticamente quando o caso for movido pra Implantado ou Implantação Parcial."}
          </div>
        </div>
      </div>

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
                    {e.action === "status_changed" &&
                      `Status mudou: ${e.from_macrostatus_op ?? "—"} → ${e.to_macrostatus_op ?? "—"}`}
                    {e.action === "updated" && "Caso editado"}
                    {e.action === "soft_deleted" && "Caso excluído"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtDateTime(e.created_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer
        className="fixed bottom-0 left-64 right-0 bg-white/95 backdrop-blur border-t border-[var(--border)] px-10 py-4 flex items-center justify-between z-30"
        style={{ boxShadow: "0 -8px 24px -12px rgba(30,32,68,0.15)" }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, #d4a832, #987814)" }}
          >
            <CheckCircle2 size={18} />
          </div>
          <div>
            <Eyebrow>Próxima ação</Eyebrow>
            <div className="font-display text-[15px] text-[var(--navy)] font-semibold mt-1">
              {caso.proximo_passo ?? "—"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted-foreground">
            Responsável:{" "}
            <span className="text-[var(--navy)] font-medium">{caso.responsavel ?? "—"}</span>
          </span>
          <Button onClick={() => setMoveOpen(true)} variant="default">
            Mover status
          </Button>
        </div>
      </footer>

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
        currentStatus={caso.macrostatus_fin as MacroFin}
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
