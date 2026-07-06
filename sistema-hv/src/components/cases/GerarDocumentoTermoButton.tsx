// S6-04 — Botão "Gerar documento do termo". A partir do snapshot RASCUNHO,
// chama gerarDocumentoTermo (motor de docs) e abre o Google Doc EDITÁVEL na
// própria tela (iframe embutido, formato "Word" para aprovação do colaborador —
// Hyago 2026-07-06). Se o modelo do tipo não estiver cadastrado, o serviço
// devolve 424 com mensagem clara (degrada, não quebra).

import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGerarDocumentoTermo } from "@/hooks/useTermo";

// Garante a barra de ferramentas completa do Google Docs dentro do iframe.
function toEmbedUrl(url: string): string {
  if (url.includes("rm=embedded")) return url;
  return url.includes("?") ? `${url}&rm=embedded` : `${url}?rm=embedded`;
}

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
  const [open, setOpen] = useState(false);

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
          const url = r.editUrl ?? null;
          setEditUrl(url);
          if (url) setOpen(true);
          toast.success("Documento do termo gerado — abrindo para revisão");
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
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setOpen(true)}>
          <FileText size={13} className="mr-1" /> Ver documento na tela
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Termo de acerto — revisão</DialogTitle>
            <DialogDescription>
              O termo com as duas formas de pagamento (à vista e parcelado) abaixo, em formato Word
              (Google Docs). Edite o que precisar antes de aprovar/imprimir.
            </DialogDescription>
          </DialogHeader>

          {editUrl && (
            <>
              <div className="flex items-center justify-end mb-2">
                <a
                  href={editUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--gold-700)] hover:underline text-sm inline-flex items-center gap-1"
                >
                  <ExternalLink size={13} /> Abrir em nova aba (tela cheia)
                </a>
              </div>
              <iframe
                src={toEmbedUrl(editUrl)}
                title="Termo de acerto"
                className="w-full rounded-md border border-[var(--border)]"
                style={{ height: "70vh" }}
                allow="clipboard-read; clipboard-write"
              />
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
