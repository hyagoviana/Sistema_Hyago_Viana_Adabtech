// S3-03 — Painel de conferência financeira (dupla checagem).
//   - "Enviar para conferência": move o card fin de uma etapa para a próxima
//     (ex.: ELABORANDO → APROVAÇÃO) e registra o envio (ator = enviador).
//   - "Aprovar conferência": segunda pessoa aprova. Segregação por ATOR
//     (aprovador <> enviador) — validada no servidor; SEM trava de cargo.
// Estado "pendente" é derivado por EVENTO (sem coluna materializada).

import { CheckCircle2, Send, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import type { MacroFin } from "@/lib/cases/constants";
import {
  useAprovarConferenciaFin,
  useConferenciaFinPendente,
  useEnviarConferenciaFin,
} from "@/hooks/useCases";
import { useStages } from "@/hooks/usePipeline";

type Stage = { slug: string; label: string; ordem: number };

export function CaseConferenciaFinPanel({
  caseId,
  serviceTypeId,
  currentFinSlug,
}: {
  caseId: string;
  serviceTypeId: string;
  currentFinSlug: string;
}) {
  const { profile } = useAuth();
  const { data: stages } = useStages(serviceTypeId, "fin");
  const { data: pendente } = useConferenciaFinPendente(caseId);
  const enviar = useEnviarConferenciaFin();
  const aprovar = useAprovarConferenciaFin();

  // Próxima etapa fin real (menor ordem > atual, nunca NAO_APLICAVEL).
  const next = useMemo(() => {
    const list = ((stages ?? []) as Stage[]).filter((s) => s.slug !== "NAO_APLICAVEL");
    const current = list.find((s) => s.slug === currentFinSlug);
    if (!current) return null;
    return list.filter((s) => s.ordem > current.ordem).sort((a, b) => a.ordem - b.ordem)[0] ?? null;
  }, [stages, currentFinSlug]);

  const currentLabel =
    ((stages ?? []) as Stage[]).find((s) => s.slug === currentFinSlug)?.label ?? currentFinSlug;

  const meuId = profile?.id ?? null;
  const souOEnviador = !!pendente && !!meuId && pendente.enviado_por === meuId;

  function handleEnviar() {
    if (!next) return;
    enviar.mutate(
      { id: caseId, to: next.slug as MacroFin },
      {
        onSuccess: () => toast.success(`Enviado para conferência (→ ${next.label})`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao enviar"),
      },
    );
  }

  function handleAprovar() {
    aprovar.mutate(caseId, {
      onSuccess: () => toast.success("Conferência aprovada"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao aprovar"),
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={14} className="text-[var(--gold-700)]" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Conferência (dupla checagem)
        </span>
      </div>

      {pendente ? (
        <div className="rounded-md border border-[var(--gold)] bg-[var(--cream)] p-3 text-[13px]">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-amber-100 text-amber-800">Pendente de aprovação</Badge>
            <span className="text-muted-foreground">
              {pendente.from ?? "·"} → {pendente.to ?? "·"}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Enviado para conferência. A aprovação exige uma segunda pessoa (quem enviou não pode
            aprovar).
          </p>
          <div className="mt-2">
            <Button
              size="sm"
              disabled={aprovar.isPending || souOEnviador}
              title={souOEnviador ? "Você enviou · outra pessoa deve aprovar" : undefined}
              onClick={handleAprovar}
            >
              <CheckCircle2 size={13} className="mr-1" />
              {souOEnviador ? "Aguardando 2ª pessoa" : "Aprovar conferência"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-[13px]">
          <p className="text-muted-foreground mb-2">
            Etapa atual: <strong className="text-[var(--navy)]">{currentLabel}</strong>.
            {next
              ? ` Enviar para conferência move para "${next.label}".`
              : " Não há próxima etapa financeira para conferência."}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={!next || enviar.isPending}
            onClick={handleEnviar}
          >
            <Send size={13} className="mr-1" />
            Enviar para conferência
          </Button>
        </div>
      )}
    </div>
  );
}
