import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useClientsList } from "@/hooks/useClients";
import { useCreateComercialProcuracao, usePreviewProcuracao } from "@/hooks/useCases";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { useServiceTypes } from "@/hooks/usePipeline";
import { formatCpfCnpj, isCpfCnpjField } from "@/lib/format";
import type { CaseCreateInput } from "@/lib/validators/case";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetClientId?: string;
};

// Fluxo DEDICADO de Procuração (separado do Caso). Escolhe cliente + tipo +
// modelo de procuração, revisa os campos <...> preenchidos com o cadastro e gera
// a procuração. Ao gerar, o cliente entra como LEAD no pipeline COMERCIAL — a
// procuração fica na ficha do caso para baixar ou enviar ao ZapSign.
export function ProcuracaoFormDialog({ open, onOpenChange, presetClientId }: Props) {
  const { data: clients } = useClientsList();
  const { data: serviceTypes } = useServiceTypes();

  const [clientId, setClientId] = useState(presetClientId ?? "");
  const [caseType, setCaseType] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [clientPopOpen, setClientPopOpen] = useState(false);
  const [procPopOpen, setProcPopOpen] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");

  const { data: templates } = useDocumentTemplates(caseType);
  const selectedClient = (clients ?? []).find((c) => c.id === clientId);
  const selectedTemplate = (templates ?? []).find((t) => t.id === templateId);

  useEffect(() => {
    if (open) {
      setClientId(presetClientId ?? "");
      setCaseType(serviceTypes?.[0]?.slug ?? "");
      setTemplateId("");
      setMunicipio("");
      setResponsavel("");
      setStep("form");
    }
  }, [open, presetClientId, serviceTypes]);

  const podeAvancar = !!clientId && !!caseType && !!templateId;

  const caseData: CaseCreateInput = {
    client_id: clientId,
    case_type: caseType,
    proximo_passo: "",
    responsavel,
    municipio,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        {step === "review" ? (
          <ProcuracaoReviewStep
            caseData={caseData}
            templateId={templateId}
            templateName={selectedTemplate?.name ?? "Procuração"}
            onBack={() => setStep("form")}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nova procuração</DialogTitle>
              <DialogDescription>
                Escolha o cliente e o modelo de procuração. Os campos são preenchidos com o cadastro
                para revisão. Ao gerar, o cliente entra como lead no Comercial.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Cliente */}
              <div className="flex flex-col gap-1.5">
                <Label>Cliente *</Label>
                <Popover open={clientPopOpen} onOpenChange={setClientPopOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientPopOpen}
                      disabled={!!presetClientId}
                      className={cn(
                        "w-full justify-between font-normal",
                        !clientId && "text-muted-foreground",
                      )}
                    >
                      {selectedClient?.full_name ?? "Buscar cliente…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Digite o nome do cliente…" />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {(clients ?? []).map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.full_name}
                              onSelect={() => {
                                setClientId(c.id);
                                setClientPopOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  c.id === clientId ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {c.full_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Tipo de serviço */}
              <div className="flex flex-col gap-1.5">
                <Label>Tipo *</Label>
                <Select value={caseType} onValueChange={setCaseType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(serviceTypes ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.slug}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Modelo de procuração */}
              <div className="flex flex-col gap-1.5">
                <Label>Procuração *</Label>
                <Popover open={procPopOpen} onOpenChange={setProcPopOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={procPopOpen}
                      className={cn(
                        "w-full justify-between font-normal",
                        !templateId && "text-muted-foreground",
                      )}
                    >
                      {selectedTemplate?.name ?? "Buscar procuração…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar pelo nome (ex.: covid)…" />
                      <CommandList>
                        <CommandEmpty>
                          Nenhum modelo. Sincronize os modelos na aba Documentos primeiro.
                        </CommandEmpty>
                        <CommandGroup>
                          {(templates ?? []).map((t) => (
                            <CommandItem
                              key={t.id}
                              value={t.name}
                              onSelect={() => {
                                setTemplateId(t.id === templateId ? "" : t.id);
                                setProcPopOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  t.id === templateId ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {t.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Responsável + Município (opcionais — ajudam o preenchimento) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Responsável</Label>
                  <Input
                    placeholder="Nome"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Município</Label>
                  <Input
                    placeholder="Cidade/UF"
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={!podeAvancar} onClick={() => setStep("review")}>
                Preencher procuração
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Etapa 2 — Revisão da procuração: mostra os campos <...> preenchidos com os
// dados do cliente (editáveis), permite completar os que faltarem. Ao confirmar,
// cria o caso comercial + gera a procuração (fica na ficha para enviar ao ZapSign).
// --------------------------------------------------------------------------
function brlToCentavosUI(v: string | undefined): number | null {
  if (!v) return null;
  const cleaned = String(v).replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function pctToNumberUI(v: string | undefined): number | null {
  if (!v) return null;
  const cleaned = String(v)
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function ProcuracaoReviewStep({
  caseData,
  templateId,
  templateName,
  onBack,
  onClose,
}: {
  caseData: CaseCreateInput;
  templateId: string;
  templateName: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const preview = usePreviewProcuracao({
    clientId: caseData.client_id,
    templateId,
    municipio: caseData.municipio,
    responsavel: caseData.responsavel,
  });
  const gerar = useCreateComercialProcuracao();

  const [values, setValues] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (preview.data && !initialized) {
      setValues(preview.data.values ?? {});
      setInitialized(true);
    }
  }, [preview.data, initialized]);

  const fields = preview.data?.fields ?? [];
  const faltando = fields.filter((f) => f.required && !String(values[f.key] ?? "").trim());

  async function confirmar() {
    if (faltando.length) {
      toast.error(`Preencha os campos obrigatórios: ${faltando.map((f) => f.label).join(", ")}`);
      return;
    }
    const nonEmpty: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (String(v).trim()) nonEmpty[k] = v;
    }
    const honorarios = {
      percentualHonorarios: pctToNumberUI(nonEmpty.percentual_honorarios),
      valorParcelaCentavos: brlToCentavosUI(nonEmpty.valor_parcela),
      descontoAvistaPct: pctToNumberUI(nonEmpty.desconto_avista),
      honorariosTotalCentavos:
        brlToCentavosUI(nonEmpty.honorarios_total) ??
        brlToCentavosUI(nonEmpty.honorarios_abatimento),
    };
    try {
      const res = await gerar.mutateAsync({
        case: caseData,
        template_id: templateId,
        values: nonEmpty,
        honorarios,
      });
      toast.success(
        `Caso ${res.case.case_code} criado no Comercial — procuração gerada e disponível na ficha do caso para enviar ao ZapSign.`,
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar a procuração");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Preencher procuração</DialogTitle>
        <DialogDescription>
          {templateName} — confira os campos preenchidos com os dados do cliente. Edite o que
          precisar; os vazios você completa à mão. Ao confirmar, o cliente entra no Comercial e a
          procuração fica na ficha do caso para enviar ao ZapSign.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {preview.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 size={14} className="animate-spin" /> Lendo os campos do modelo…
          </div>
        ) : preview.isError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {preview.error instanceof Error
              ? preview.error.message
              : "Falha ao ler os campos do modelo."}
          </div>
        ) : (
          <>
            {fields.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Nenhum campo &lt;…&gt; detectado neste modelo. A procuração será gerada como está.
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Campos com <span className="text-emerald-600 font-medium">(preenchido)</span> vieram
                do cadastro do cliente. Os marcados com <span className="text-destructive">*</span>{" "}
                são obrigatórios.
              </div>
            )}

            {fields.map((f) => {
              const isDoc = isCpfCnpjField(f.key, f.label);
              const hasValue = !!String(values[f.key] ?? "").trim();
              return (
                <div key={f.key}>
                  <Label className="flex items-center gap-1.5">
                    <span>{f.label}</span>
                    {f.required && <span className="text-destructive">*</span>}
                    {hasValue ? (
                      <span className="text-emerald-600 text-xs">(preenchido)</span>
                    ) : (
                      <span className="text-amber-600 text-xs">(preencha manualmente)</span>
                    )}
                  </Label>
                  <Input
                    value={values[f.key] ?? ""}
                    inputMode={isDoc ? "numeric" : undefined}
                    maxLength={isDoc ? 18 : undefined}
                    onChange={(e) =>
                      setValues((s) => ({
                        ...s,
                        [f.key]: isDoc ? formatCpfCnpj(e.target.value) : e.target.value,
                      }))
                    }
                    placeholder={isDoc ? "000.000.000-00" : f.label}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={onBack} disabled={gerar.isPending}>
          Voltar
        </Button>
        <Button
          type="button"
          onClick={confirmar}
          disabled={preview.isLoading || preview.isError || gerar.isPending || faltando.length > 0}
        >
          {gerar.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
          {gerar.isPending ? "Gerando…" : "Gerar procuração"}
        </Button>
      </DialogFooter>
    </>
  );
}
