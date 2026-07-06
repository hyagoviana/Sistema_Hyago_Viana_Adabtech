import { ArrowLeft, FileSignature, FileText, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";

import { GenerateCaseDocumentFlow } from "@/components/cases/GenerateCaseDocumentFlow";
import { ProcuracaoFormDialog } from "@/components/cases/ProcuracaoFormDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCasesList } from "@/hooks/useCases";
import { CASE_TYPE_LABELS, type CaseType } from "@/lib/cases/constants";
import type { AutoFillData } from "@/lib/cases/document-autofill";

// ITEM 2 (2026-07-06) — botão "Gerar documento" na FICHA DO CLIENTE. Abre o MESMO
// popup do caso (Procuração vs Documento do caso). Diferença: o cliente não tem
// um caso implícito, então:
//   - Procuração → ProcuracaoFormDialog (fluxo dedicado, cria o caso comercial).
//   - Documento do caso → primeiro escolhe UM caso existente do cliente; sem caso
//     selecionado não dá pra gerar. Com o caso escolhido, reusa
//     GenerateCaseDocumentFlow (que opera sobre um caseId) direto no modo "caso".
type Step = "pick" | "select-case";

type ClientCase = {
  id: string;
  case_code: string;
  case_type: string;
  municipio?: string | null;
};

export function ClientGenerateDocumentFlow({
  open,
  onOpenChange,
  clientId,
  autoFill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  autoFill: AutoFillData;
}) {
  const { data: casesData } = useCasesList({ client_id: clientId });
  const cases = (casesData ?? []) as ClientCase[];

  const [step, setStep] = useState<Step>("pick");
  const [procOpen, setProcOpen] = useState(false);
  const [chosenCase, setChosenCase] = useState<ClientCase | null>(null);

  // Reset ao (re)abrir o popup principal.
  useEffect(() => {
    if (open) {
      setStep("pick");
      setChosenCase(null);
    }
  }, [open]);

  // Etapa 1 — escolher tipo de documento.
  const pick = (
    <Dialog
      open={open && step === "pick"}
      onOpenChange={(v) => {
        if (!v) onOpenChange(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar documento</DialogTitle>
          <DialogDescription>O que você quer gerar para este cliente?</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              setProcOpen(true);
            }}
            className="rounded-md border border-[var(--border)] p-4 text-left hover:border-[var(--gold)] transition-colors"
          >
            <div className="flex items-center gap-2 font-medium text-[var(--navy)]">
              <FileSignature size={16} className="text-[var(--gold-700)]" /> Procuração
            </div>
            <div className="text-[12px] text-muted-foreground mt-1">
              Cria um caso comercial e gera a procuração.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setStep("select-case")}
            className="rounded-md border border-[var(--border)] p-4 text-left hover:border-[var(--gold)] transition-colors"
          >
            <div className="flex items-center gap-2 font-medium text-[var(--navy)]">
              <FileText size={16} className="text-[var(--gold-700)]" /> Documento do caso
            </div>
            <div className="text-[12px] text-muted-foreground mt-1">
              Escolha um caso do cliente e gere um documento do tipo dele.
            </div>
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Etapa 2 — escolher o caso do cliente (documento de caso precisa de um caso).
  const selectCase = (
    <Dialog
      open={open && step === "select-case"}
      onOpenChange={(v) => {
        if (!v) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escolher o caso</DialogTitle>
          <DialogDescription>
            O documento do caso é gerado dentro de um caso. Selecione um caso do cliente.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => setStep("pick")}
          className="text-xs text-[var(--gold-700)] hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} /> Voltar
        </button>

        {cases.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Este cliente ainda não tem casos. Crie um caso na seção “Casos” abaixo e depois gere o
            documento por dentro dele.
          </div>
        ) : (
          <Command className="mt-1 rounded-md border border-[var(--border)]">
            <CommandInput placeholder="Buscar caso (código ou tipo)…" />
            <CommandList className="max-h-72">
              <CommandEmpty>Nenhum caso encontrado.</CommandEmpty>
              <CommandGroup>
                {cases.map((c) => {
                  const tipo = CASE_TYPE_LABELS[c.case_type as CaseType] ?? c.case_type;
                  return (
                    <CommandItem
                      key={c.id}
                      value={`${c.case_code} ${tipo}`}
                      onSelect={() => {
                        setChosenCase(c);
                        onOpenChange(false);
                      }}
                    >
                      <FolderOpen size={14} className="mr-2 text-[var(--gold-700)]" />
                      <span className="font-medium text-[var(--navy)]">{c.case_code}</span>
                      <span className="ml-2 text-muted-foreground text-xs">{tipo}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {pick}
      {selectCase}

      {/* Procuração — fluxo dedicado (cria caso comercial). */}
      <ProcuracaoFormDialog
        open={procOpen}
        onOpenChange={setProcOpen}
        presetClientId={clientId}
      />

      {/* Documento do caso — reusa o fluxo do caso sobre o caseId escolhido, já no
          modo "caso" (pula a pergunta Procuração vs Caso). */}
      {chosenCase && (
        <GenerateCaseDocumentFlow
          open={!!chosenCase}
          onOpenChange={(v) => !v && setChosenCase(null)}
          caseId={chosenCase.id}
          caseType={chosenCase.case_type}
          initialMode="caso"
          autoFill={{
            ...autoFill,
            municipio: chosenCase.municipio ?? autoFill.municipio,
            caseCode: chosenCase.case_code,
          }}
        />
      )}
    </>
  );
}
