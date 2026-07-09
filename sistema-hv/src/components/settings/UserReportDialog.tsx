// Relatório de tudo vinculado a um usuário: casos (responsável/criador), tarefas
// atribuídas e itens de checklist sob sua responsabilidade — com pendências.
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Briefcase, CheckSquare, ListChecks } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserReport } from "@/hooks/useUsers";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";
import { ROLE_LABELS, type Role } from "@/lib/rbac";

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-3 text-center">
      <div className="text-[20px] font-semibold" style={{ color: tone }}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function UserReportDialog({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useUserReport(userId);
  const u = data?.user;

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{u?.full_name || u?.email || "Usuário"}</DialogTitle>
          <DialogDescription>
            {u ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px]">
                <span>{u.email}</span>
                {u.phone && <span>· {u.phone}</span>}
                <span>· {ROLE_LABELS[u.role as Role] ?? u.role}</span>
              </span>
            ) : (
              "Relatório do usuário"
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2">
              <Kpi label="Casos" value={data.resumo.total_casos} tone="var(--navy)" />
              <Kpi
                label="Tarefas pendentes"
                value={data.resumo.tarefas_pendentes}
                tone={data.resumo.tarefas_pendentes ? "var(--danger)" : "var(--success)"}
              />
              <Kpi
                label="Checklist pendente"
                value={data.resumo.checklist_pendentes}
                tone={data.resumo.checklist_pendentes ? "var(--danger)" : "var(--success)"}
              />
            </div>

            {/* Pendências (destaque) */}
            {(data.resumo.tarefas_pendentes > 0 || data.resumo.checklist_pendentes > 0) && (
              <section>
                <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--navy)] mb-2">
                  <AlertTriangle size={14} className="text-amber-500" /> Pendências
                </h4>
                <ul className="space-y-1">
                  {data.tarefas
                    .filter((t) => t.status !== "CONCLUIDA")
                    .map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12.5px]"
                      >
                        <CheckSquare size={13} className="text-amber-600 shrink-0" />
                        <span className="flex-1 truncate">{t.title}</span>
                        <Link
                          to="/casos/$id"
                          params={{ id: t.case_id }}
                          className="text-[var(--gold-700)] hover:underline shrink-0"
                        >
                          {t.case_code}
                        </Link>
                      </li>
                    ))}
                  {data.checklist
                    .filter((c) => !c.done)
                    .map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12.5px]"
                      >
                        <ListChecks size={13} className="text-amber-600 shrink-0" />
                        <span className="flex-1 truncate">{c.label}</span>
                        <Link
                          to="/casos/$id"
                          params={{ id: c.case_id }}
                          className="text-[var(--gold-700)] hover:underline shrink-0"
                        >
                          {c.case_code}
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {/* Casos vinculados */}
            <section>
              <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--navy)] mb-2">
                <Briefcase size={14} className="text-[var(--gold-700)]" /> Casos vinculados (
                {data.casos.length})
              </h4>
              {data.casos.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">Nenhum caso vinculado.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
                  {data.casos.map((c) => (
                    <li key={c.case_id} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                      <Link
                        to="/casos/$id"
                        params={{ id: c.case_id }}
                        className="font-medium text-[var(--navy)] hover:underline shrink-0"
                      >
                        {c.case_code}
                      </Link>
                      <span className="text-muted-foreground truncate flex-1">{c.client_name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type}
                      </span>
                      <span className="text-[10.5px] text-[var(--gold-700)] shrink-0">
                        {c.is_responsavel ? "Responsável" : "Criador"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
