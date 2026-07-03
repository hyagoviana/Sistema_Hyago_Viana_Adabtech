// S6-04 — Botão "Gerar documento do termo". A partir do snapshot RASCUNHO,
// chama gerarDocumentoTermo (motor de docs) e abre o Google Doc editável. Se o
// modelo do tipo não estiver cadastrado, o serviço devolve 424 com mensagem
// clara (degrada, não quebra).

import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useGerarDocumentoTermo } from "@/hooks/useTermo";

export function GerarDocumentoTermoButton({
  caseId,
  termoId,
  remanescenteAnteriorCentavos,
  saldoAtualCentavos,
  percentualAbatimento,
  saldoOriginarioCentavos,
  saldoEpocaAbatimentoCentavos,
}: {
  caseId: string;
  termoId: string;
  remanescenteAnteriorCentavos?: number;
  // S7-02 — inputs opcionais p/ placeholders sem fonte no cálculo.
  saldoAtualCentavos?: number;
  percentualAbatimento?: number;
  saldoOriginarioCentavos?: number;
  saldoEpocaAbatimentoCentavos?: number;
}) {
  const gerar = useGerarDocumentoTermo(caseId);
  const [editUrl, setEditUrl] = useState<string | null>(null);

  function handle() {
    gerar.mutate(
      {
        termoId,
        remanescenteAnteriorCentavos,
        saldoAtualCentavos,
        percentualAbatimento,
        saldoOriginarioCentavos,
        saldoEpocaAbatimentoCentavos,
      },
      {
        onSuccess: (r) => {
          setEditUrl(r.editUrl ?? null);
          toast.success("Documento do termo gerado");
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Falha ao gerar documento do termo"),
      },
    );
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full" onClick={handle} disabled={gerar.isPending}>
        {gerar.isPending ? (
          <Loader2 size={14} className="mr-1 animate-spin" />
        ) : (
          <FileText size={14} className="mr-1" />
        )}
        Gerar documento (editável)
      </Button>
      {editUrl && (
        <a href={editUrl} target="_blank" rel="noreferrer">
          <Button variant="ghost" size="sm" className="w-full">
            <ExternalLink size={13} className="mr-1" /> Abrir documento
          </Button>
        </a>
      )}
    </div>
  );
}
